import type { APIRoute } from "astro";
import { platform } from "os";
import { requireBackupAccess } from "@/lib/server/backup-access";
import {
    executeBackupAction,
    listBackupFiles,
    type ExecuteBackupActionInput,
} from "@/lib/server/backup.service";

function badRequest(message: string) {
    return new Response(JSON.stringify({ success: false, message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
    });
}

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

export const GET: APIRoute = async ({ url, request }) => {
    const authError = await requireBackupAccess(request);
    if (authError) return authError;

    if (!url.searchParams.get("list")) {
        return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const files = await listBackupFiles();
        return new Response(JSON.stringify({ files }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error listando respaldos";
        return new Response(JSON.stringify({ files: [], error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    const authError = await requireBackupAccess(request);
    if (authError) return authError;

    let input: ExecuteBackupActionInput;
    try {
        input = parseBody(await request.json());
    } catch (error) {
        const message = error instanceof Error ? error.message : "Solicitud invalida";
        return badRequest(message);
    }

    try {
        const result = await executeBackupAction(input);
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Operacion fallida";
        return new Response(
            JSON.stringify({ success: false, message, platform: platform() }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};
