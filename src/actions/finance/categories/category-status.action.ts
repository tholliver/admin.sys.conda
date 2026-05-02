// src/actions/finance/categories/category-status.action.ts
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactionCategories, transactions } from "@/db/schema";
import { eq, count } from "drizzle-orm";

const categoryIdInput = z.object({
  categoryId: z.string().uuid("ID de cuenta inválido"),
});

// ── Disable (soft) ────────────────────────────────────────────────────────────
export const disableTransactionCategory = defineAction({
  accept: "form",
  input: categoryIdInput,
  async handler({ categoryId }, { locals }) {
    const user = locals.user;
    if (!user?.id)
      throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesión" });

    const [cat] = await db
      .select({ id: transactionCategories.id, name: transactionCategories.name, status: transactionCategories.status, isSystem: transactionCategories.isSystem })
      .from(transactionCategories)
      .where(eq(transactionCategories.id, categoryId))
      .limit(1);

    if (!cat) throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
    if (cat.isSystem) throw new ActionError({ code: "BAD_REQUEST", message: "Las cuentas del sistema no se pueden desactivar" });
    if (!cat.status) return { success: true, message: "La cuenta ya estaba desactivada", categoryId: cat.id };

    await db
      .update(transactionCategories)
      .set({ status: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(transactionCategories.id, categoryId));

    return { success: true, message: `Cuenta "${cat.name}" desactivada`, categoryId: cat.id };
  },
});

// ── Activate (soft restore) ───────────────────────────────────────────────────
export const activateTransactionCategory = defineAction({
  accept: "form",
  input: categoryIdInput,
  async handler({ categoryId }, { locals }) {
    const user = locals.user;
    if (!user?.id)
      throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesión" });

    const [cat] = await db
      .select({ id: transactionCategories.id, name: transactionCategories.name, status: transactionCategories.status })
      .from(transactionCategories)
      .where(eq(transactionCategories.id, categoryId))
      .limit(1);

    if (!cat) throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
    if (cat.status) return { success: true, message: "La cuenta ya estaba activa", categoryId: cat.id };

    await db
      .update(transactionCategories)
      .set({ status: true, deletedAt: null, updatedAt: new Date() })
      .where(eq(transactionCategories.id, categoryId));

    return { success: true, message: `Cuenta "${cat.name}" activada`, categoryId: cat.id };
  },
});

// ── Set sort order (quick-access pin/unpin) ───────────────────────────────────
export const setCategorySortOrder = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.string().uuid("ID de cuenta inválido"),
    sortOrder:  z.coerce.number().int().min(1).max(999),
  }),
  async handler({ categoryId, sortOrder }, { locals }) {
    const user = locals.user;
    if (!user?.id)
      throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesión" });

    const [cat] = await db
      .select({ id: transactionCategories.id, name: transactionCategories.name })
      .from(transactionCategories)
      .where(eq(transactionCategories.id, categoryId))
      .limit(1);

    if (!cat) throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });

    await db
      .update(transactionCategories)
      .set({ sortOrder, updatedAt: new Date() })
      .where(eq(transactionCategories.id, categoryId));

    const label = sortOrder === 999 ? "quitada del acceso rápido" : `fijada en posición ${sortOrder}`;
    return { success: true, message: `Cuenta "${cat.name}" ${label}`, categoryId: cat.id };
  },
});

// ── Hard delete ───────────────────────────────────────────────────────────────
export const deleteTransactionCategory = defineAction({
  accept: "form",
  input: categoryIdInput,
  async handler({ categoryId }, { locals }) {
    const user = locals.user;
    if (!user?.id)
      throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesión" });

    const [cat] = await db
      .select({ id: transactionCategories.id, name: transactionCategories.name, isSystem: transactionCategories.isSystem })
      .from(transactionCategories)
      .where(eq(transactionCategories.id, categoryId))
      .limit(1);

    if (!cat) throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
    if (cat.isSystem) throw new ActionError({ code: "BAD_REQUEST", message: "Las cuentas del sistema no se pueden eliminar" });

    // Guard: check for linked transactions before hitting the FK restrict
    const [{ total }] = await db
      .select({ total: count() })
      .from(transactions)
      .where(eq(transactions.categoryId, categoryId));

    if (total > 0)
      throw new ActionError({
        code: "BAD_REQUEST",
        message: `No se puede eliminar "${cat.name}": tiene ${total} transacción${total === 1 ? "" : "es"} asociada${total === 1 ? "" : "s"}. Desactívela en su lugar.`,
      });

    await db
      .delete(transactionCategories)
      .where(eq(transactionCategories.id, categoryId));

    return { success: true, message: `Cuenta "${cat.name}" eliminada permanentemente`, categoryId: cat.id };
  },
});
