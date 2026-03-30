import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { cashboxes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const toggleQuickCashbox = defineAction({
    accept: "form",
    input: z.object({
        cashboxId: z.uuid(),
        isQuick: z.enum(["true", "false"]).transform((v) => v === "true"),
    }),
    async handler(input, { locals }) {
        if (!["ADMIN", "ADMON"].includes(locals.user?.role ?? "")) {
            throw new ActionError({ code: "FORBIDDEN", message: "Sin permisos." });
        }

        // enforce max 3 quick cashboxes
        if (input.isQuick) {
            const [{ count }] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(cashboxes)
                .where(eq(cashboxes.isQuick, true));

            if (count >= 3) {
                throw new ActionError({
                    code: "BAD_REQUEST",
                    message: "Máximo 3 cajas de acceso rápido permitidas.",
                });
            }
        }

        await db
            .update(cashboxes)
            .set({ isQuick: input.isQuick, updatedAt: new Date() })
            .where(eq(cashboxes.id, input.cashboxId));

        return { success: true };
    },
});
