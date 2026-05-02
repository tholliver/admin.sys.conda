import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactionCategories } from "@/db/schema";
import { eq } from "drizzle-orm";

export const updateTransactionCategory = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.uuid("ID de cuenta invalido"),
    name: z.string().trim().min(1, "Nombre requerido").max(100, "Nombre demasiado largo"),
    code: z.string().trim().min(1, "Codigo requerido").max(50, "Codigo demasiado largo"),
    type: z.enum(["income", "outcome"]),
    description: z.string().trim().max(500, "Descripcion demasiado larga").optional(),
    icon: z.preprocess(
      (value) => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
      },
      z.string().max(50, "Icono demasiado largo").optional(),
    ),
    parentId: z.preprocess(
      (value) => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
      },
      z.uuid("Cuenta padre invalida").optional(),
    ),
    invoiceRangeId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
      z.uuid("ID de talonario inválido").optional(),
    ),
    requiresAuthorization: z.preprocess(
      (value) => value === "on" || value === true,
      z.boolean(),
    ),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;
      if (!user?.id) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion para actualizar cuentas" });
      }

      const normalizedCode = input.code.trim().toUpperCase().replace(/\s+/g, "_");

      const [existingCategory] = await db
        .select({ id: transactionCategories.id, code: transactionCategories.code })
        .from(transactionCategories)
        .where(eq(transactionCategories.id, input.categoryId))
        .limit(1);

      if (!existingCategory) {
        throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      if (existingCategory.code !== normalizedCode) {
        const [duplicate] = await db
          .select({ id: transactionCategories.id })
          .from(transactionCategories)
          .where(eq(transactionCategories.code, normalizedCode))
          .limit(1);

        if (duplicate) {
          throw new ActionError({ code: "CONFLICT", message: "Ya existe una cuenta con ese codigo" });
        }
      }

      if (input.parentId) {
        if (input.parentId === input.categoryId) {
          throw new ActionError({ code: "BAD_REQUEST", message: "La cuenta padre no puede ser la misma" });
        }

        const [parent] = await db
          .select({ id: transactionCategories.id, type: transactionCategories.type, status: transactionCategories.status })
          .from(transactionCategories)
          .where(eq(transactionCategories.id, input.parentId))
          .limit(1);

        if (!parent || !parent.status) {
          throw new ActionError({ code: "NOT_FOUND", message: "La cuenta padre no existe o esta inactiva" });
        }

        if (parent.type !== input.type) {
          throw new ActionError({ code: "BAD_REQUEST", message: "La cuenta padre debe ser del mismo tipo" });
        }
      }

      await db
        .update(transactionCategories)
        .set({
          name: input.name.trim(),
          code: normalizedCode,
          type: input.type,
          description: input.description?.trim() || null,
          icon: input.icon?.trim() || null,
          parentId: input.parentId ?? null,
          invoiceRangeId: input.invoiceRangeId ?? null,
          requiresAuthorization: input.requiresAuthorization,
          updatedAt: new Date(),
        })
        .where(eq(transactionCategories.id, input.categoryId));

      return { success: true, message: "Cuenta actualizada correctamente", categoryId: input.categoryId };
    } catch (error) {
      if (error instanceof ActionError) throw error;
      console.error("Update transaction category error:", error);
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo actualizar la cuenta" });
    }
  },
});
