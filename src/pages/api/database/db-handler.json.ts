import type { APIRoute } from "astro";
import { platform } from "os";
import {
    executeBackupAction,
    listBackupFiles,
    type ExecuteBackupActionInput,
} from "@/lib/server/backup.service";
import { withAuth, json } from "@/lib/server/with-auth";

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
}, ["ADMIN", "ADMON"]);

export const POST: APIRoute = withAuth(async ({ request }) => {
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
}, ["ADMIN", "ADMON"]);
