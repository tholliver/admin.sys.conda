import type { APIContext, APIRoute } from "astro";
import type { UserRole } from "@/auth/types";

export function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * Wraps an APIRoute with session auth + optional role guard.
 *
 * @example
 * // Any authenticated user
 * export const GET = withAuth(({ locals }) => {
 *   return json({ user: locals.user });
 * });
 *
 * @example
 * // Only ADMIN or ADMON
 * export const POST = withAuth(({ request, locals }) => {
 *   ...
 * }, ["ADMIN", "ADMON"]);
 */
export function withAuth(
    handler: (ctx: APIContext) => Response | Promise<Response>,
    roles?: UserRole[],
): APIRoute {
    return async (ctx: APIContext) => {
        const { user } = ctx.locals;

        if (!user) {
            return json({ success: false, message: "No autenticado" }, 401);
        }

        if (roles && roles.length > 0 && !roles.includes(user.role)) {
            return json({ success: false, message: "Sin permisos para esta operación" }, 403);
        }

        return handler(ctx);
    };
}
