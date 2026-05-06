import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import {
  cashboxes,
  transactions,
  transactionCategories,
  employees,
} from "@/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { formatBOB } from "@/utils/formatters";

const ADMIN_ROLES = ["ADMIN", "ADMON"] as const;

function requireAdmin(role: string | undefined) {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    throw new ActionError({ code: "FORBIDDEN", message: "Acceso denegado." });
  }
}


// ─── Deposit to Cashbox ───────────────────────────────────────────────────────
// Deposits directly into a cashbox by cashboxId.
// The cashbox is the wallet — sectors are just groupings of employees within it.

export const depositToCashboxAction = defineAction({
  accept: "form",
  input: z.object({
    cashboxId: z.uuid("Caja inválida"),
    categoryId: z.uuid("Categoría inválida"),
    amount: z.coerce
      .number()
      .min(0.01, "El monto debe ser mayor a 0")
      .max(999_999_999, "Monto fuera de rango"),
    concept: z.string().min(1, "Concepto requerido").max(255),
    reference: z.string().max(100).optional(),
    externalReference: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    // 1. Validate category — must be active income type
    const [category] = await db
      .select({
        id: transactionCategories.id,
        name: transactionCategories.name,
        type: transactionCategories.type,
      })
      .from(transactionCategories)
      .where(
        and(
          eq(transactionCategories.id, input.categoryId),
          eq(transactionCategories.status, true),
        )
      );

    if (!category) {
      throw new ActionError({ code: "NOT_FOUND", message: "Categoría no encontrada." });
    }
    if (category.type !== "income") {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Solo se pueden usar cuentas de ingreso para depositar.",
      });
    }

    // 2. Validate cashbox
    const [cashbox] = await db
      .select({
        id: cashboxes.id,
        name: cashboxes.name,
        balance: cashboxes.balance,
        status: cashboxes.status,
      })
      .from(cashboxes)
      .where(eq(cashboxes.id, input.cashboxId))
      .limit(1);

    if (!cashbox) {
      throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada." });
    }
    if (cashbox.status !== "activo") {
      throw new ActionError({
        code: "PRECONDITION_FAILED",
        message: `La caja "${cashbox.name}" está inactiva.`,
      });
    }

    const amountStr = input.amount.toFixed(2);
    const newBalance = (Number(cashbox.balance ?? 0) + input.amount).toFixed(2);

    // 3. Atomically update balance + insert transaction
    await db.transaction(async (tx) => {
      await tx
        .update(cashboxes)
        .set({
          balance: sql`${cashboxes.balance} + ${amountStr}`,
          updatedAt: new Date(),
        })
        .where(eq(cashboxes.id, cashbox.id));

      await tx.insert(transactions).values({
        cashboxId: cashbox.id,
        categoryId: input.categoryId,
        type: "deposit",
        amount: amountStr,
        concept: input.concept,
        metadata: input.notes?.trim() ? JSON.stringify({ note: input.notes.trim() }) : null,
        externalReference: input.reference?.trim() || input.externalReference?.trim() || null,
        createdByUserId: user.id,
        status: "completado",
        balanceAfter: newBalance,
      });
    });

    return {
      success: true,
      message: `Bs ${formatBOB(input.amount)} depositados en "${cashbox.name}".`,
      cashboxName: cashbox.name,
      newBalance,
    };
  },
});

// ─── Barrel ───────────────────────────────────────────────────────────────────

export const sectorActions = {
  depositToCashbox: depositToCashboxAction,
};
