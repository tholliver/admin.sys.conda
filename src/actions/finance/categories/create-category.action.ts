import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactionCategories } from "@/db/schema";
import { eq } from "drizzle-orm";

export const createTransactionCategory = defineAction({
  accept: "form",
  input: z.object({
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
    invoiceRangeId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
      z.uuid("ID de talonario inválido").optional(),
    ),
    parentId: z.preprocess(
      (value) => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
      },
      z.uuid("Cuenta padre invalida").optional(),
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
        throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion para crear cuentas" });
      }

      const normalizedCode = input.code.trim().toUpperCase().replace(/\s+/g, "_");

      const [existingCategory] = await db
        .select({ id: transactionCategories.id })
        .from(transactionCategories)
        .where(eq(transactionCategories.code, normalizedCode))
        .limit(1);

      if (existingCategory) {
        throw new ActionError({ code: "CONFLICT", message: "Ya existe una cuenta con ese codigo" });
      }

      if (input.parentId) {
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

      const [category] = await db
        .insert(transactionCategories)
        .values({
          name: input.name.trim(),
          code: normalizedCode,
          type: input.type,
          description: input.description?.trim() || null,
          icon: input.icon?.trim() || null,
          parentId: input.parentId ?? null,
          requiresAuthorization: input.requiresAuthorization,
          invoiceRangeId: input.invoiceRangeId ?? null,
          isSystem: false,
          status: true,
          createdByUserId: user.id,
        })
        .returning({
          id: transactionCategories.id,
          name: transactionCategories.name,
          code: transactionCategories.code,
          type: transactionCategories.type,
        });

      return { success: true, message: "Cuenta creada correctamente", category };
    } catch (error) {
      if (error instanceof ActionError) throw error;
      console.error("Create transaction category error:", error);
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear la cuenta" });
    }
  },
});
