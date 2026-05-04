import { mkdir, readdir, readFile, stat } from "fs/promises";
import { arch, platform } from "os";
import { join } from "path";
import {
    findPgBinary,
    getPgBinaryMismatchMessage,
} from "./pg.bins.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const APP_BACKUP_DIR = join(process.cwd(), "backups");
const USB_BACKUP_DIR = import.meta.env.USB_BACKUP_PATH ?? null;
const CRON_TIMESTAMP_FILE = USB_BACKUP_DIR ? `${USB_BACKUP_DIR}/.last_backup` : null;
const USB_MIN_FREE_BYTES = 200 * 1024 * 1024; // 200 MB safety guard

// ── Types ─────────────────────────────────────────────────────────────────────

export type BackupOrigin = "manual" | "cron";

export type BackupFileInfo = {
    filename: string;
    size: number;
    created: string;
    formattedSize: string;
    formattedDate: string;
    origin: BackupOrigin;
};

export type UsbStatus = {
    configured: boolean;
    mounted: boolean;
    freeBytes: number | null;
    formattedFree: string | null;
    lastCronBackup: string | null;  // ISO timestamp
    lastCronHoursAgo: number | null;
};

export type BackupSystemInfo = {
    platform: string;
    architecture: string;
    isWindows: boolean;
    isLinux: boolean;
    postgresInstalled: boolean;
    pgDumpCommand: string;
    pgRestoreCommand: string;
    customPathUsed: boolean;
    usbStatus: UsbStatus;
};

type DbConfig = {
    host: string;
    port: string;
    database: string;
    user: string;
    password: string;
};

type BackupAction = "backup" | "restore";

export type ExecuteBackupActionInput = {
    action: BackupAction;
    filename: string;
};

// ── Strategy interface ────────────────────────────────────────────────────────

interface OsBackupStrategy {
    readonly pgDumpBinary: string;
    readonly pgRestoreBinary: string;
    readonly psqlBinary: string;
    buildDumpArgs(dbConfig: DbConfig, outputPath: string): string[];
    buildRestoreArgs(dbConfig: DbConfig, inputPath: string): string[];
    buildTruncateArgs(dbConfig: DbConfig): string[];
}

// ── Shared SQL ────────────────────────────────────────────────────────────────

const TRUNCATE_SQL = `
DO $$
DECLARE table_list text;
BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO table_list
    FROM pg_tables
    WHERE schemaname IN ('public', 'auth', 'finance', 'drizzle');
    IF table_list IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
    END IF;
END $$;
`.trim();

// ── Linux Strategy ────────────────────────────────────────────────────────────

class LinuxBackupStrategy implements OsBackupStrategy {
    readonly pgDumpBinary: string;
    readonly pgRestoreBinary: string;
    readonly psqlBinary: string;

    constructor() {
        this.pgDumpBinary = findPgBinary("pg_dump").path ?? "pg_dump";
        this.pgRestoreBinary = findPgBinary("pg_restore").path ?? "pg_restore";
        this.psqlBinary = findPgBinary("psql").path ?? "psql";
    }

    buildDumpArgs(dbConfig: DbConfig, outputPath: string): string[] {
        return [
            this.pgDumpBinary,
            "-h", dbConfig.host, "-p", dbConfig.port, "-U", dbConfig.user,
            "-F", "c", "--data-only", "-v", "-f", outputPath,
            dbConfig.database,
        ];
    }

    buildRestoreArgs(dbConfig: DbConfig, inputPath: string): string[] {
        return [
            this.pgRestoreBinary,
            "-h", dbConfig.host, "-p", dbConfig.port, "-U", dbConfig.user,
            "-d", dbConfig.database, "--data-only", "-v",
            inputPath,
        ];
    }

    buildTruncateArgs(dbConfig: DbConfig): string[] {
        return [
            this.psqlBinary,
            "-h", dbConfig.host, "-p", dbConfig.port,
            "-U", dbConfig.user, "-d", dbConfig.database,
            "-c", TRUNCATE_SQL,
        ];
    }
}

// ── Windows Strategy ──────────────────────────────────────────────────────────

class WindowsBackupStrategy implements OsBackupStrategy {
    readonly pgDumpBinary: string;
    readonly pgRestoreBinary: string;
    readonly psqlBinary: string;

    constructor() {
        this.pgDumpBinary = findPgBinary("pg_dump").path ?? "pg_dump.exe";
        this.pgRestoreBinary = findPgBinary("pg_restore").path ?? "pg_restore.exe";
        this.psqlBinary = findPgBinary("psql").path ?? "psql.exe";
    }

    private normalize(p: string): string {
        return p.replace(/\\/g, "/");
    }

    buildDumpArgs(dbConfig: DbConfig, outputPath: string): string[] {
        return [
            this.pgDumpBinary,
            "-h", dbConfig.host, "-p", dbConfig.port, "-U", dbConfig.user,
            "-F", "c", "--data-only", "-v", "-f", this.normalize(outputPath),
            dbConfig.database,
        ];
    }

    buildRestoreArgs(dbConfig: DbConfig, inputPath: string): string[] {
        return [
            this.pgRestoreBinary,
            "-h", dbConfig.host, "-p", dbConfig.port, "-U", dbConfig.user,
            "-d", dbConfig.database, "--data-only", "-v",
            this.normalize(inputPath),
        ];
    }

    buildTruncateArgs(dbConfig: DbConfig): string[] {
        return [
            this.psqlBinary,
            "-h", dbConfig.host, "-p", dbConfig.port,
            "-U", dbConfig.user, "-d", dbConfig.database,
            "-c", TRUNCATE_SQL,
        ];
    }
}

// ── Strategy Factory ──────────────────────────────────────────────────────────

class BackupStrategyFactory {
    static create(): OsBackupStrategy {
        const os = platform();
        if (os === "linux") return new LinuxBackupStrategy();
        if (os === "win32") return new WindowsBackupStrategy();
        throw new Error(
            `Sistema operativo "${os}" no soportado. Solo Windows y Linux son compatibles.`,
        );
    }
}

// ── Repository ────────────────────────────────────────────────────────────────

class BackupRepository {
    async ensureDir(): Promise<void> {
        await mkdir(APP_BACKUP_DIR, { recursive: true });
    }

    outputPath(filename: string): string {
        return join(APP_BACKUP_DIR, filename);
    }

    async list(): Promise<BackupFileInfo[]> {
        await this.ensureDir();
        const files = await readdir(APP_BACKUP_DIR);
        const dumps = files.filter((f) => f.endsWith(".dump"));

        const withStats = await Promise.all(
            dumps.map(async (filename): Promise<BackupFileInfo> => {
                const filePath = join(APP_BACKUP_DIR, filename);
                const s = await stat(filePath);
                const parsedTs = parseTimestampFromFilename(filename);
                const backupDate = parsedTs ?? s.mtime;

                return {
                    filename,
                    size: s.size,
                    created: backupDate.toISOString(),
                    formattedSize: formatBytes(s.size),
                    formattedDate: formatDate(backupDate),
                    origin: filename.startsWith('backup_cron_') ? 'cron' : 'manual',
                };
            }),
        );

        return withStats.sort(
            (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
        );
    }

    async getUsbStatus(): Promise<UsbStatus> {
        if (!USB_BACKUP_DIR) {
            return { configured: false, mounted: false, freeBytes: null, formattedFree: null, lastCronBackup: null, lastCronHoursAgo: null };
        }

        try {
            await readdir(USB_BACKUP_DIR); // throws if not mounted

            let freeBytes: number | null = null;

            if (platform() === "linux") {
                try {
                    const proc = Bun.spawnSync(["df", "-k", "--output=avail", USB_BACKUP_DIR], {
                        stdout: "pipe", stderr: "pipe",
                    });
                    if (proc.exitCode === 0) {
                        const lines = proc.stdout.toString().trim().split("\n");
                        const kb = parseInt(lines[lines.length - 1]?.trim() ?? "0", 10);
                        if (!isNaN(kb)) freeBytes = kb * 1024;
                    }
                } catch { /* df unavailable */ }
            }

            let lastCronBackup: string | null = null;
            let lastCronHoursAgo: number | null = null;

            if (CRON_TIMESTAMP_FILE) {
                try {
                    const ts = await readFile(CRON_TIMESTAMP_FILE, "utf-8");
                    const parsed = new Date(ts.trim());
                    if (!isNaN(parsed.getTime())) {
                        lastCronBackup = parsed.toISOString();
                        lastCronHoursAgo = Math.floor(
                            (Date.now() - parsed.getTime()) / (1000 * 60 * 60),
                        );
                    }
                } catch { /* file not written yet */ }
            }

            const mounted = freeBytes === null || freeBytes >= USB_MIN_FREE_BYTES;

            return { configured: true, mounted, freeBytes, formattedFree: freeBytes !== null ? formatBytes(freeBytes) : null, lastCronBackup, lastCronHoursAgo };
        } catch {
            return { configured: true, mounted: false, freeBytes: null, formattedFree: null, lastCronBackup: null, lastCronHoursAgo: null };
        }
    }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function parseConnectionString(url: string): DbConfig {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parsed.port || "5432",
            database: parsed.pathname.slice(1),
            user: parsed.username,
            password: parsed.password,
        };
    } catch {
        throw new Error("URL de base de datos invalida");
    }
}

function resolveDbConfig(): DbConfig {
    const raw = import.meta.env.DATABASE_URL?.trim();
    if (raw) {
        try { return parseConnectionString(raw); } catch { /* fall through */ }
    }

    const host = import.meta.env.DB_HOST || "localhost";
    const port = import.meta.env.DB_PORT || "5432";
    const database = import.meta.env.DB_NAME;
    const user = import.meta.env.DB_USER;
    const password = import.meta.env.DB_PASSWORD;

    if (!database || !user || !password) {
        throw new Error(
            "No se pudo conectar a la base de datos. Verifica DATABASE_URL o DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.",
        );
    }

    return { host, port, database, user, password };
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(date: Date): string {
    const BOLIVIA_OFFSET_MS = -4 * 60 * 60 * 1000; // America/La_Paz UTC-4, no DST
    const nowBolivia = Date.now() + BOLIVIA_OFFSET_MS;
    const dateBolivia = date.getTime() + BOLIVIA_OFFSET_MS;
    const days = Math.floor((nowBolivia - dateBolivia) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Ayer";
    if (days < 7) return `Hace ${days} dia${days > 1 ? "s" : ""}`;
    return date.toLocaleDateString("es-BO", { year: "numeric", month: "short", day: "numeric", timeZone: "America/La_Paz" });
}

function parseTimestampFromFilename(filename: string): Date | null {
    // Accepts both zero-padded and single-digit day/time segments
    // e.g. backup_data_2026-03-3T16-47-45.dump or backup_data_2026-03-03T16-47-45.dump
    const match = filename.match(/_(\d{4}-\d{1,2}-\d{1,2}T\d{1,2}-\d{1,2}-\d{1,2})\.dump$/);
    if (!match?.[1]) return null;
    const parsed = new Date(match[1].replace(/-(\d{1,2})-(\d{1,2})$/, ":$1:$2"));
    return isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeFilename(filename: string): string {
    const trimmed = String(filename || "").trim();
    if (!trimmed.endsWith(".dump")) throw new Error("Nombre de archivo invalido");
    if (/[/\\]|\.\./.test(trimmed)) throw new Error("Nombre de archivo invalido");
    if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) throw new Error("Nombre de archivo invalido");
    return trimmed;
}

async function spawnProcess(
    args: string[],
    env: Record<string, string | undefined>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const proc = Bun.spawn(args, {
        env: { ...process.env, ...env },
        stdout: "pipe",
        stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);

    return { exitCode, stdout, stderr };
}

// ── Singletons ────────────────────────────────────────────────────────────────

const repo = new BackupRepository();

// ── Public API ────────────────────────────────────────────────────────────────

export async function listBackupFiles(): Promise<BackupFileInfo[]> {
    return repo.list();
}

export async function getBackupSystemInfo(): Promise<BackupSystemInfo> {
    const os = platform();
    const pgDumpInfo = findPgBinary("pg_dump");
    const pgRestoreInfo = findPgBinary("pg_restore");
    const binaryMismatch = getPgBinaryMismatchMessage(pgDumpInfo, pgRestoreInfo);
    const usbStatus = await repo.getUsbStatus();

    return {
        platform: os,
        architecture: arch(),
        isWindows: os === "win32",
        isLinux: os === "linux",
        postgresInstalled:
            pgDumpInfo.found &&
            pgRestoreInfo.found &&
            pgDumpInfo.supported &&
            pgRestoreInfo.supported &&
            !binaryMismatch,
        pgDumpCommand: pgDumpInfo.path ?? "pg_dump not found",
        pgRestoreCommand: pgRestoreInfo.path ?? "pg_restore not found",
        customPathUsed: Boolean(import.meta.env.PG_BIN_PATH),
        usbStatus,
    };
}

export async function getHoursSinceLastBackup(): Promise<number | null> {
    const usb = await repo.getUsbStatus();
    if (usb.lastCronHoursAgo !== null) return usb.lastCronHoursAgo;

    const files = await repo.list();
    if (files.length === 0) return null;
    return Math.floor((Date.now() - new Date(files[0].created).getTime()) / (1000 * 60 * 60));
}

export async function executeBackupAction(input: ExecuteBackupActionInput) {
    const action = input.action;
    const filename = sanitizeFilename(input.filename);
    const dbConfig = resolveDbConfig();

    const pgDumpInfo = findPgBinary("pg_dump");
    const pgRestoreInfo = findPgBinary("pg_restore");
    const binaryMismatch = getPgBinaryMismatchMessage(pgDumpInfo, pgRestoreInfo);
    if (binaryMismatch) throw new Error(binaryMismatch);

    await repo.ensureDir();

    const strategy = BackupStrategyFactory.create();
    const pgEnv = { PGPASSWORD: dbConfig.password };

    if (action === "backup") {
        if (!pgDumpInfo.found || !pgDumpInfo.supported) {
            throw new Error(
                `pg_dump no disponible o version no soportada (${pgDumpInfo.version ?? "desconocida"}). Rango: ${pgDumpInfo.supportedRange}.`,
            );
        }

        const outputPath = repo.outputPath(filename);
        const result = await spawnProcess(strategy.buildDumpArgs(dbConfig, outputPath), pgEnv);

        if (result.exitCode !== 0) {
            throw new Error(`pg_dump fallo (codigo ${result.exitCode}): ${result.stderr}`);
        }

        const fileStats = await stat(outputPath).catch(() => null);
        if (!fileStats || fileStats.size < 512) {
            throw new Error("El archivo de respaldo esta vacio o es invalido.");
        }

        return {
            success: true,
            message: "Respaldo creado exitosamente",
            filename,
            fileSize: formatBytes(fileStats.size),
            output: result.stdout,
            warnings: result.stderr,
            exitCode: result.exitCode,
            platform: platform(),
            binaryUsed: strategy.pgDumpBinary,
            binaryVersion: pgDumpInfo.version,
        };
    }

    // ── Restore ───────────────────────────────────────────────────────────────
    if (!pgRestoreInfo.found || !pgRestoreInfo.supported) {
        throw new Error(
            `pg_restore no disponible o version no soportada (${pgRestoreInfo.version ?? "desconocida"}). Rango: ${pgRestoreInfo.supportedRange}.`,
        );
    }

    const truncResult = await spawnProcess(strategy.buildTruncateArgs(dbConfig), pgEnv);
    if (truncResult.exitCode !== 0) {
        throw new Error(`Error limpiando tablas: ${truncResult.stderr}`);
    }

    const inputPath = repo.outputPath(filename);
    const result = await spawnProcess(strategy.buildRestoreArgs(dbConfig, inputPath), pgEnv);

    if (result.exitCode !== 0) {
        throw new Error(`pg_restore fallo (codigo ${result.exitCode}): ${result.stderr}`);
    }

    return {
        success: true,
        message: "Datos restaurados correctamente",
        output: result.stdout,
        warnings: result.stderr,
        exitCode: result.exitCode,
        platform: platform(),
        binaryUsed: strategy.pgRestoreBinary,
        binaryVersion: pgRestoreInfo.version,
        preRestoreSteps: ["Tablas limpiadas antes de restaurar"],
    };
}
