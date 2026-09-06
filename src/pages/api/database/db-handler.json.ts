import type { APIRoute } from "astro";
import { platform } from "os";
import { stat } from "fs/promises";
import { join } from "path";
import {
    executeBackupAction,
    listBackupFiles,
    type ExecuteBackupActionInput,
} from "@/lib/server/backup.service";
import { withAuth, json } from "@/lib/server/with-auth";

const APP_BACKUP_DIR = join(process.cwd(), "backups");

function parseBody(body: unknown): ExecuteBackupActionInput {
    const payload = (body ?? {}) as { action?: unknown; filename?: unknown };
    if (payload.action !== "backup" && payload.action !== "restore") {
        throw new Error("Accion no valida");
    }
    if (typeof payload.filename !== "string" || !payload.filename.trim()) {
        throw new Error("Nombre de archivo invalido");
    }
    return { action: payload.action, filename: payload.filename };
}

export const GET: APIRoute = withAuth(async ({ url }) => {
    const downloadFile = url.searchParams.get("download");
    if (downloadFile) {
        const sanitized = downloadFile.replace(/[/\\]|\.\./g, "");
        if (!/^[A-Za-z0-9._-]+\.dump$/.test(sanitized)) {
            return json({ error: "Invalid filename" }, 400);
        }
        const filePath = join(APP_BACKUP_DIR, sanitized);
        try {
            const fileStat = await stat(filePath);
            const file = Bun.file(filePath);
            return new Response(file, {
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": `attachment; filename="${sanitized}"`,
                    "Content-Length": fileStat.size.toString(),
                },
            });
        } catch {
            return json({ error: "File not found" }, 404);
        }
    }

    if (!url.searchParams.get("list")) {
        return json({ error: "Not found" }, 404);
    }
    try {
        const files = await listBackupFiles();
        return json({ files });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error listando respaldos";
        return json({ files: [], error: message }, 500);
    }
}, ["ADMIN"]);

export const POST: APIRoute = withAuth(async ({ request, url }) => {
    if (url.searchParams.get("upload")) {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const action = formData.get("action") as string | null;

        if (!file || action !== "upload-restore") {
            return json({ success: false, message: "Archivo no proporcionado" }, 400);
        }
        if (!file.name.endsWith(".dump")) {
            return json({ success: false, message: "Solo se aceptan archivos .dump" }, 400);
        }

        const sanitized = file.name.replace(/[/\\]|\.\./g, "");
        if (!/^[A-Za-z0-9._-]+\.dump$/.test(sanitized)) {
            return json({ success: false, message: "Nombre de archivo invalido" }, 400);
        }

        try {
            const filePath = join(APP_BACKUP_DIR, sanitized);
            const bytes = new Uint8Array(await file.arrayBuffer());
            await Bun.write(filePath, bytes);

            const result = await executeBackupAction({ action: "restore", filename: sanitized });
            return json(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error restaurando desde archivo";
            return json({ success: false, message }, 500);
        }
    }

    let input: ExecuteBackupActionInput;
    try {
        input = parseBody(await request.json());
    } catch (error) {
        const message = error instanceof Error ? error.message : "Solicitud invalida";
        return json({ success: false, message }, 400);
    }
    try {
        const result = await executeBackupAction(input);
        return json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Operacion fallida";
        return json({ success: false, message, platform: platform() }, 500);
    }
}, ["ADMIN"]);
