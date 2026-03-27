import { existsSync } from "fs";
import { platform } from "os";
import { join } from "path";

export type PgBinaryName = "pg_dump" | "pg_restore" | "psql";

export type PgBinaryInfo = {
    found: boolean;
    path: string | null;
    version: string | null;
    major: number | null;
    supported: boolean;
    supportedRange: string;
};

function getSupportedPgVersionRange() {
    const min = Number.parseInt(import.meta.env.PG_VERSION_MIN || "9", 10);
    const max = Number.parseInt(import.meta.env.PG_VERSION_MAX || "18", 10);

    if (Number.isNaN(min) || Number.isNaN(max) || min > max) {
        return { min: 9, max: 18 };
    }

    return { min, max };
}

function parsePgVersion(output: string): { version: string | null; major: number | null } {
    // Matches strings like: "pg_dump (PostgreSQL) 16.4"
    const m = output.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m?.[1]) return { version: null, major: null };

    const major = Number.parseInt(m[1], 10);
    if (Number.isNaN(major)) return { version: null, major: null };

    return { version: m[0], major };
}

function readVersion(binPathOrName: string): { ok: boolean; version: string | null; major: number | null } {
    try {
        const proc = Bun.spawnSync([binPathOrName, "--version"], {
            stdout: "pipe",
            stderr: "pipe",
        });

        if (proc.exitCode !== 0) {
            return { ok: false, version: null, major: null };
        }

        const raw = `${proc.stdout.toString()} ${proc.stderr.toString()}`.trim();
        const parsed = parsePgVersion(raw);
        return { ok: true, version: parsed.version, major: parsed.major };
    } catch {
        return { ok: false, version: null, major: null };
    }
}

function buildBinarySearchPaths(binaryName: PgBinaryName): string[] {
    const os = platform();
    const binName = os === "win32" ? `${binaryName}.exe` : binaryName;
    const out: string[] = [];
    const { min, max } = getSupportedPgVersionRange();

    if (os === "win32") {
        const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
        const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

        for (let version = max; version >= min; version--) {
            out.push(
                join(programFiles, `PostgreSQL\\${version}\\bin`, binName),
                join(programFilesX86, `PostgreSQL\\${version}\\bin`, binName),
            );
        }
    } else {
        out.push(`/usr/bin/${binName}`, `/usr/local/bin/${binName}`);
        for (let version = max; version >= min; version--) {
            out.push(`/usr/lib/postgresql/${version}/bin/${binName}`);
        }
    }

    return out;
}

export function findPgBinary(binaryName: PgBinaryName): PgBinaryInfo {
    const os = platform();
    const binName = os === "win32" ? `${binaryName}.exe` : binaryName;
    const range = getSupportedPgVersionRange();
    const supportedRange = `${range.min}-${range.max}`;

    const customPath = import.meta.env.PG_BIN_PATH;
    if (customPath) {
        const customBin = join(customPath, binName);
        if (existsSync(customBin)) {
            const v = readVersion(customBin);
            if (v.ok) {
                return {
                    found: true,
                    path: customBin,
                    version: v.version,
                    major: v.major,
                    supported: v.major ? v.major >= range.min && v.major <= range.max : true,
                    supportedRange,
                };
            }
        }
    }

    const fromPath = readVersion(binName);
    if (fromPath.ok) {
        return {
            found: true,
            path: binName,
            version: fromPath.version,
            major: fromPath.major,
            supported: fromPath.major
                ? fromPath.major >= range.min && fromPath.major <= range.max
                : true,
            supportedRange,
        };
    }

    for (const candidate of buildBinarySearchPaths(binaryName)) {
        if (!existsSync(candidate)) continue;
        const v = readVersion(candidate);
        if (!v.ok) continue;

        return {
            found: true,
            path: candidate,
            version: v.version,
            major: v.major,
            supported: v.major ? v.major >= range.min && v.major <= range.max : true,
            supportedRange,
        };
    }

    return {
        found: false,
        path: null,
        version: null,
        major: null,
        supported: false,
        supportedRange,
    };
}

export function getPgBinaryMismatchMessage(pgDumpInfo: PgBinaryInfo, pgRestoreInfo: PgBinaryInfo): string | null {
    if (!pgDumpInfo.found || !pgRestoreInfo.found) return null;
    if (pgDumpInfo.major == null || pgRestoreInfo.major == null) return null;
    if (pgDumpInfo.major === pgRestoreInfo.major) return null;

    return `Versiones incompatibles detectadas: pg_dump ${pgDumpInfo.version ?? "?"} y pg_restore ${pgRestoreInfo.version ?? "?"}.`;
}
