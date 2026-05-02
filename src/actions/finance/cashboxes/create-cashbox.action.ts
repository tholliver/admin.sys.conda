import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { cashboxes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const createCashbox = defineAction({
  accept: "form",
  input: z.object({
    name: z.string().min(2, "Nombre requerido").max(255),
    code: z.string().min(2, "Código requerido").max(50)
      .regex(/^[A-Z0-9_\-]+$/i, "Código inválido — solo letras, números, _ y -"),
    description: z.string().max(500).optional(),
    balance: z.coerce.number().min(0).default(0),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

    const [existing] = await db
      .select({ id: cashboxes.id })
      .from(cashboxes)
      .where(eq(cashboxes.code, input.code.toUpperCase()));

    if (existing) {
      throw new ActionError({
        code: "CONFLICT",
        message: `El código "${input.code}" ya está en uso.`,
      });
    }

    const [cashbox] = await db
      .insert(cashboxes)
      .values({
        name: input.name,
        code: input.code.toUpperCase(),
        description: input.description ?? null,
        balance: String(input.balance),
        status: "activo",
      })
      .returning();

    return { success: true, message: "Caja creada correctamente.", cashbox };
  },
});
