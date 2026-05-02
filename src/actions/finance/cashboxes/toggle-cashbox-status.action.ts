import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { cashboxes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const toggleCashboxStatus = defineAction({
  accept: "form",
  input: z.object({
    cashboxId: z.uuid(),
    status: z.enum(["activo", "inactivo", "suspendido", "archivado"]),
  }),
  async handler(input, { locals }) {
    if (!["ADMIN"].includes(locals.user?.role ?? "")) {
      throw new ActionError({ code: "FORBIDDEN", message: "Sin permisos." });
    }

    const [cashbox] = await db
      .select({ id: cashboxes.id, name: cashboxes.name, code: cashboxes.code })
      .from(cashboxes)
      .where(eq(cashboxes.id, input.cashboxId))
      .limit(1);

    if (!cashbox) {
      throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada." });
    }

    if (cashbox.code === "GEN" && input.status !== "activo") {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "La caja general (GEN) no puede desactivarse.",
      });
    }

    await db
      .update(cashboxes)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(cashboxes.id, input.cashboxId));

    return {
      success: true,
      message: `Caja "${cashbox.name}" actualizada a "${input.status}".`,
    };
  },
});
