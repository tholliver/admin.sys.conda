import { z } from "astro/zod";
import { db } from "@/db";
import { ActionError, defineAction } from "astro:actions";
import { invoiceRanges, transactionCategories } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const assignCategoryRange = defineAction({
  accept: "form",
  input: z.object({
    rangeId:    z.uuid("ID de talonario inválido"),
    categoryId: z.string().optional(), // uuid or empty = unassign
  }),
  async handler(input, { locals }) {
    const user = locals.user;
    if (!user?.id) throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion" });

    const [range] = await db
      .select({ id: invoiceRanges.id, category: invoiceRanges.category })
      .from(invoiceRanges)
      .where(and(eq(invoiceRanges.id, input.rangeId), eq(invoiceRanges.isActive, true)))
      .limit(1);

    if (!range) throw new ActionError({ code: "NOT_FOUND", message: "Talonario no encontrado o inactivo" });

    const newRangeId = input.categoryId?.trim() ? input.rangeId : null;
    const targetCatId = input.categoryId?.trim() || null;

    if (targetCatId) {
      const [cat] = await db
        .select({ id: transactionCategories.id, status: transactionCategories.status })
        .from(transactionCategories)
        .where(eq(transactionCategories.id, targetCatId))
        .limit(1);

      if (!cat || !cat.status) throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada o inactiva" });

      await db
        .update(transactionCategories)
        .set({ invoiceRangeId: input.rangeId, updatedAt: new Date() })
        .where(eq(transactionCategories.id, targetCatId));

      return { success: true, message: "Talonario asignado correctamente" };
    }

    // unassign: categoryId empty means caller passes the categoryId to unassign
    throw new ActionError({ code: "BAD_REQUEST", message: "categoryId requerido" });
  },
});

export const unassignCategoryRange = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.uuid("ID de cuenta inválido"),
  }),
  async handler(input, { locals }) {
    const user = locals.user;
    if (!user?.id) throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion" });

    const [cat] = await db
      .select({ id: transactionCategories.id, name: transactionCategories.name })
      .from(transactionCategories)
      .where(eq(transactionCategories.id, input.categoryId))
      .limit(1);

    if (!cat) throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });

    await db
      .update(transactionCategories)
      .set({ invoiceRangeId: null, updatedAt: new Date() })
      .where(eq(transactionCategories.id, input.categoryId));

    return { success: true, message: `Talonario desvinculado de "${cat.name}"` };
  },
});
