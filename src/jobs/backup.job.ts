/**
 * backup.job.ts
 *
 * Bun Cron Worker — Generic PostgreSQL → USB Backup
 *
 * Drop this file into any Bun project (Astro, plain Node-compat, etc.).
 * Zero machine config: reads .env, auto-detects pg_dump, auto-detects USB.
 *
 * ─── Runtime requirement ─────────────────────────────────────────────────────
 *  Bun ≥ 1.3.11  (ships Bun.cron, cross-platform Task Scheduler / crontab)
 *
 * ─── .env keys used ──────────────────────────────────────────────────────────
 *  DATABASE_URL       postgresql://user:pass@host:5432/dbname   (preferred)
 *  DB_HOST            localhost          (fallback if no DATABASE_URL)
 *  DB_PORT            5432
 *  DB_NAME            my_db
 *  DB_USER            my_user
 *  DB_PASSWORD        secret
 *  USB_BACKUP_PATH    E:\Backups         (optional — skips auto-detect)
 *  PG_BIN_PATH        C:\...\bin         (optional — skips pg_dump search)
 *  PG_VERSION_MIN     9                  (optional — default 9)
 *  PG_VERSION_MAX     18                 (optional — default 18)
 *  BACKUP_KEEP_FILES  10                 (optional — rotated copies to keep)
 *
 * ─── How USB is found ────────────────────────────────────────────────────────
 *  Windows : wmic DriveType=2 → Get-WmiObject fallback → write-access probe
 *  Linux   : /proc/mounts scan for vfat/exfat/ntfs/ext4 entries
 *  Both    : USB_BACKUP_PATH env var always wins when set
 *
 * ─── pg_dump search order ────────────────────────────────────────────────────
 *  1. PG_BIN_PATH env var
 *  2. pg_dump / pg_dump.exe already on PATH
 *  3. Windows: C:\Program Files\PostgreSQL\{18..9}\bin\pg_dump.exe
 *     Linux:   /usr/bin, /usr/local/bin, /usr/lib/postgresql/{18..9}/bin
 *
 * ─── Output files ────────────────────────────────────────────────────────────
 *  <project>/backups/backup_cron_<ISO>.dump   — always written
 *  <USB>/backup_cron_<ISO>.dump               — copied when USB present
 *  <USB>/.last_backup                         — ISO timestamp for UI panels
 *  <project>/backups/backup-cron.log          — rolling log
 */

import { appendFile, mkdir, readdir, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { platform } from "os";

// ── Constants ─────────────────────────────────────────────────────────────────

const IS_WINDOWS = platform() === "win32";
const BACKUP_DIR = join(process.cwd(), "backups");
const LOG_FILE = join(BACKUP_DIR, "backup-cron.log");
const MIN_FREE_BYTES = 200 * 1024 * 1024; // 200 MB safety guard
const KEEP_FILES = Number(process.env.BACKUP_KEEP_FILES ?? "10");

// ── Logging ───────────────────────────────────────────────────────────────────

async function log(msg: string): Promise<void> {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    process.stdout.write(line);
    try { await appendFile(LOG_FILE, line); } catch { /* non-fatal */ }
}

async function logResult(success: boolean, size?: number, error?: string): Promise<void> {
    const status = success ? `✓ ${formatBytes(size!)}` : `✗ ${error}`;
    await log(`backup ${status}`);
}
// ── pg_dump detection ─────────────────────────────────────────────────────────

type PgBinaryInfo = {
    found: boolean;
    path: string | null;
    version: string | null;
    major: number | null;
};

function parsePgVersion(raw: string): { version: string | null; major: number | null } {
    const m = raw.match(/(\d+)(?:\.(\d+))?/);
    if (!m?.[1]) return { version: null, major: null };
    const major = parseInt(m[1], 10);
    return { version: m[0], major: isNaN(major) ? null : major };
}

function probeVersion(binPath: string): PgBinaryInfo {
    try {
        const proc = Bun.spawnSync([binPath, "--version"], { stdout: "pipe", stderr: "pipe" });
        if (proc.exitCode !== 0) return { found: false, path: null, version: null, major: null };
        const raw = `${proc.stdout.toString()} ${proc.stderr.toString()}`.trim();
        const { version, major } = parsePgVersion(raw);
        return { found: true, path: binPath, version, major };
    } catch {
        return { found: false, path: null, version: null, major: null };
    }
}

async function findPgDump(): Promise<PgBinaryInfo> {
    const binName = IS_WINDOWS ? "pg_dump.exe" : "pg_dump";
    const vMin = parseInt(process.env.PG_VERSION_MIN ?? "17", 10);
    const vMax = parseInt(process.env.PG_VERSION_MAX ?? "18", 10);

    // 1. Explicit PG_BIN_PATH
    const customDir = process.env.PG_BIN_PATH?.trim();
    if (customDir) {
      const p = join(customDir, binName);
      const file = Bun.file(p);
      if (await file.exists()) {
        const info = probeVersion(p);
        if (info.found) return info;
      }
    }

    // 2. Already on PATH
    const fromPath = probeVersion(binName);
    if (fromPath.found) return fromPath;

    // 3. Well-known install locations
    const candidates: string[] = [];
    if (IS_WINDOWS) {
        const pf = process.env["ProgramFiles"] ?? "C:\\Program Files";
        const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
        for (let v = vMax; v >= vMin; v--) {
            candidates.push(join(pf, `PostgreSQL\\${v}\\bin`, binName));
            candidates.push(join(pf86, `PostgreSQL\\${v}\\bin`, binName));
        }
    } else {
        candidates.push("/usr/bin/pg_dump", "/usr/local/bin/pg_dump");
        for (let v = vMax; v >= vMin; v--) {
            candidates.push(`/usr/lib/postgresql/${v}/bin/pg_dump`);
        }
    }

    for (const c of candidates) {
        if (!existsSync(c)) continue;
        const info = probeVersion(c);
        if (info.found) return info;
    }

    return { found: false, path: null, version: null, major: null };
}

// ── DB config ─────────────────────────────────────────────────────────────────

function resolveDbConfig() {
    const url = process.env.DATABASE_URL?.trim();
    if (url) {
        const p = new URL(url);
        return {
            host: p.hostname,
            port: p.port || "5432",
            database: p.pathname.slice(1),
            user: p.username,
            password: p.password,
        };
    }
    const host = process.env.DB_HOST ?? "localhost";
    const port = process.env.DB_PORT ?? "5432";
    const database = process.env.DB_NAME ?? "";
    const user = process.env.DB_USER ?? "";
    const password = process.env.DB_PASSWORD ?? "";
    if (!database || !user || !password) {
        throw new Error(
            "Missing DB config. Set DATABASE_URL or DB_HOST / DB_NAME / DB_USER / DB_PASSWORD in .env",
        );
    }
    return { host, port, database, user, password };
}

// ── USB detection — Windows ───────────────────────────────────────────────────

function listRemovableDrivesWmic(): string[] {
    try {
        const proc = Bun.spawnSync(
            ["wmic", "logicaldisk", "where", "DriveType=2", "get", "DeviceID"],
            { stdout: "pipe", stderr: "pipe" },
        );
        if (proc.exitCode !== 0) return [];
        return proc.stdout.toString()
            .split(/\r?\n/)
            .map((l) => l.trim().match(/^([A-Z]:)$/i)?.[1])
            .filter(Boolean)
            .map((d) => `${d!.toUpperCase()}\\`) as string[];
    } catch { return []; }
}

function listRemovableDrivesPowerShell(): string[] {
    try {
        const proc = Bun.spawnSync(
            [
                "powershell", "-NoProfile", "-NonInteractive", "-Command",
                "Get-WmiObject Win32_LogicalDisk -Filter \"DriveType=2\" | Select-Object -ExpandProperty DeviceID",
            ],
            { stdout: "pipe", stderr: "pipe" },
        );
        if (proc.exitCode !== 0) return [];
        return proc.stdout.toString()
            .split(/\r?\n/)
            .map((l) => l.trim().match(/^([A-Z]:)$/i)?.[1])
            .filter(Boolean)
            .map((d) => `${d!.toUpperCase()}\\`) as string[];
    } catch { return []; }
}

function getFreeBytesWindows(driveLetter: string): number | null {
    try {
        const letter = driveLetter.replace(/[:\\]/g, "");
        const proc = Bun.spawnSync(
            [
                "powershell", "-NoProfile", "-NonInteractive", "-Command",
                `(Get-PSDrive -Name ${letter} -ErrorAction SilentlyContinue).Free`,
            ],
            { stdout: "pipe", stderr: "pipe" },
        );
        const n = Number(proc.stdout.toString().trim());
        return (!isNaN(n) && n > 0) ? n : null;
    } catch { return null; }
}

async function detectUsbWindows(): Promise<string | null> {
    let drives = listRemovableDrivesWmic();
    if (drives.length === 0) drives = listRemovableDrivesPowerShell();
    await log(`Removable drives: ${drives.length > 0 ? drives.join(", ") : "none found"}`);

    for (const drive of drives) {
        const free = getFreeBytesWindows(drive);
        if (free !== null && free < MIN_FREE_BYTES) {
            await log(`SKIP ${drive} — only ${formatBytes(free)} free.`);
            continue;
        }
        // Confirm write access
        const probe = join(drive, `.bun_probe_${Date.now()}`);
        try {
            await writeFile(probe, "x");
            const { exited } = Bun.spawn(["cmd", "/c", "del", "/f", "/q", normPath(probe)], {
                stdout: "pipe", stderr: "pipe",
            });
            await exited;
            await log(`USB selected: ${drive}${free !== null ? ` (${formatBytes(free)} free)` : ""}`);
            return drive;
        } catch {
            await log(`SKIP ${drive} — not writable.`);
        }
    }
    return null;
}

// ── USB detection — Linux ─────────────────────────────────────────────────────

async function detectUsbLinux(): Promise<string | null> {
    const portableFs = new Set(["vfat", "exfat", "ntfs", "ntfs-3g", "ext4", "ext3"]);
    const systemPrefixes = ["/sys", "/proc", "/dev", "/run", "/snap", "/boot"];
    try {
        const mounts = await Bun.file("/proc/mounts").text();
        for (const line of mounts.split("\n")) {
            const [, mp, fs] = line.split(" ");
            if (!mp || !fs) continue;
            if (systemPrefixes.some((p) => mp.startsWith(p)) || mp === "/") continue;
            if (!portableFs.has(fs)) continue;
            const proc = Bun.spawnSync(["df", "-k", "--output=avail", mp], {
                stdout: "pipe", stderr: "pipe",
            });
            if (proc.exitCode === 0) {
                const lines = proc.stdout.toString().trim().split("\n");
                const kb = parseInt(lines[lines.length - 1]?.trim() ?? "0", 10);
                if (isNaN(kb) || kb * 1024 < MIN_FREE_BYTES) continue;
            }
            await log(`USB selected: ${mp}`);
            return mp;
        }
    } catch { /* /proc/mounts unreadable */ }
    return null;
}

// ── USB detection — unified ───────────────────────────────────────────────────

async function detectUsb(): Promise<string | null> {
    const explicit = process.env.USB_BACKUP_PATH?.trim();
    if (explicit) {
        try {
            await readdir(explicit);
            await log(`USB from env USB_BACKUP_PATH: ${explicit}`);
            return explicit;
        } catch {
            await log(`WARN: USB_BACKUP_PATH="${explicit}" not accessible — auto-detecting.`);
        }
    }
    return IS_WINDOWS ? detectUsbWindows() : detectUsbLinux();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatBytes(b: number) {
    if (b === 0) return "0 B";
    const k = 1024, labels = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / k ** i).toFixed(2)} ${labels[i]}`;
}

/** Windows pg_dump requires backslashes in -f paths. */
function normPath(p: string) {
    return IS_WINDOWS ? p.replace(/\//g, "\\") : p;
}

async function copyFile(src: string, dest: string): Promise<boolean> {
    try {
        const args = IS_WINDOWS
            ? ["cmd", "/c", "copy", "/y", normPath(src), normPath(dest)]
            : ["cp", src, dest];
        const { exited } = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
        return (await exited) === 0;
    } catch { return false; }
}

/** Keep the newest KEEP_FILES .dump files; delete the rest. */
async function rotate(dir: string) {
    try {
        const dumps = (await readdir(dir))
            .filter((f) => f.endsWith(".dump"))
            .sort()
            .reverse(); // ISO timestamps sort newest-first when reversed

        for (const old of dumps.slice(KEEP_FILES)) {
            const target = join(dir, old);
            const args = IS_WINDOWS
                ? ["cmd", "/c", "del", "/f", "/q", normPath(target)]
                : ["rm", "-f", target];
            const { exited } = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
            await exited;
            await log(`Rotated old file: ${old}`);
        }
    } catch { /* non-fatal */ }
}

// ── Core backup ───────────────────────────────────────────────────────────────

async function runBackup(): Promise<void> {
    await mkdir(BACKUP_DIR, { recursive: true });

    const usbPath = await detectUsb();
    const pg = await findPgDump();
    if (!pg.found) throw new Error(`pg_dump not found.`);

    const db = resolveDbConfig();
    const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
    const filename = `backup_cron_${ts}.dump`;
    const localPath = join(BACKUP_DIR, filename);

    const proc = Bun.spawn(
        [pg.path!, "-h", db.host, "-p", db.port, "-U", db.user,
         "-F", "c", "--data-only", "-f", normPath(localPath), db.database],
        { env: { ...process.env, PGPASSWORD: db.password }, stdout: "pipe", stderr: "pipe" },
    );

    const [exitCode, pgStderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    if (exitCode !== 0) throw new Error(`pg_dump failed: ${pgStderr}`);

    const { size } = await stat(localPath);
    if (size < 512) throw new Error(`Dump too small (${size}b)`);

    if (usbPath) {
        const usbFile = join(usbPath, filename);
        if (await copyFile(localPath, usbFile)) {
            await writeFile(join(usbPath, ".last_backup"), new Date().toISOString());
            await rotate(usbPath);
        }
    }

    await rotate(BACKUP_DIR);
    await logResult(true, size);
}

// ── Bun Cron export ───────────────────────────────────────────────────────────
// Bun.cron fires this when the OS scheduler triggers the job.
// Shape follows the Cloudflare Workers Cron Triggers API.

export default {
    async scheduled(event: Bun.CronController) {
        try {
            await runBackup();
        } catch (err) {
            await log(`✗ ${err instanceof Error ? err.message : String(err)}`);
            process.exitCode = 1;
        }
    },
};

// ── Direct run (bun run backup.job.ts) ───────────────────────────────────────
// When executed directly, run the backup immediately — useful for testing
// without waiting for the scheduled cron to fire.
if (import.meta.main) {
    await log(`Manual run triggered.`);
    try {
        await runBackup();
    } catch (err) {
        await log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
