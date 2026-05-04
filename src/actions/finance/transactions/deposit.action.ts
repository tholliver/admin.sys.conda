import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactions, cashboxes, transactionCategories, invoiceRanges } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ENV } from "@/config/env";
import { formatBOB } from "@/utils/formatters";
import { resolveInvoiceReference } from "@/lib/finance/resolve-invoice";

export const deposit = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.uuid("ID de cuenta inválido"),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
      .refine((val) => {
        const num = parseFloat(val);
        return num > 0 && num <= ENV.TRANSACTION_LIMITS.DEPOSIT_MAX;
      }, `Monto debe ser entre 0.01 y ${formatBOB(String(ENV.TRANSACTION_LIMITS.DEPOSIT_MAX))}`),
    externalReference: z.string().max(255).optional(),
    invoiceRangeId: z.uuid().optional(),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;

      if (!user) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesion para registrar un deposito.",
        });
      }

      const { categoryId, amount, externalReference, invoiceRangeId } = input;

      const [category] = await db
        .select()
        .from(transactionCategories)
        .where(
          and(
            eq(transactionCategories.id, categoryId),
            eq(transactionCategories.type, "income"),
            eq(transactionCategories.status, true),
          ),
        );

      if (!category) {
        throw new ActionError({ code: "NOT_FOUND", message: "La cuenta seleccionada no existe o esta inactiva." });
      }

      const [cashAccount] = await db
        .select()
        .from(cashboxes)
        .where(eq(cashboxes.code, "GEN"));

      if (!cashAccount) {
        throw new ActionError({ code: "NOT_FOUND", message: "No se encontro la caja principal de operaciones. Contacta al administrador." });
      }

      if (cashAccount.status !== "activo") {
        throw new ActionError({ code: "BAD_REQUEST", message: "La caja principal esta inactiva. Contacta al administrador." });
      }

      const { reference: resolvedReference, invoiceNumber, resolvedRangeId } =
        await resolveInvoiceReference(category, { manualReference: externalReference, invoiceRangeId });

      const { transaction, newBalance } = await db.transaction(async (tx) => {
        const [updatedCashbox] = await tx
          .update(cashboxes)
          .set({ balance: sql`${cashboxes.balance}::numeric + ${amount}::numeric` })
          .where(eq(cashboxes.id, cashAccount.id))
          .returning();

        const nb = updatedCashbox.balance?.toString() ?? "0.00";

        const [txn] = await tx
          .insert(transactions)
          .values({
            type: "deposit",
            amount,
            categoryId,
            concept: category.name,
            cashboxId: cashAccount.id,
            invoiceRangeId: resolvedRangeId,
            invoiceNumber:  invoiceNumber,
            externalReference: resolvedReference ?? externalReference ?? null,
            metadata: null,
            createdByUserId: user.id || "system",
            status: "completado",
            balanceAfter: nb,
          })
          .returning();

        if (resolvedRangeId && invoiceNumber) {
          await tx
            .update(invoiceRanges)
            .set({ current: invoiceNumber + 1 })
            .where(and(eq(invoiceRanges.id, resolvedRangeId), eq(invoiceRanges.isSystem, false)));
        }

        return { transaction: txn, newBalance: nb };
      });

      return {
        success: true,
        message: `Deposito de ${formatBOB(amount)} registrado correctamente.`,
        transaction: {
          id: transaction.id,
          amount: formatBOB(amount),
          concept: transaction.concept,
          timestamp: transaction.createdAt.toISOString(),
          reference: invoiceNumber ? `#${invoiceNumber}` : transaction.externalReference ?? null,
        },
        newBalance: formatBOB(newBalance),
      };
    } catch (error) {
      console.error("Deposit error:", error);

      if (error instanceof ActionError) {
        throw error;
      }

      if (error instanceof Error) {
        const isDev = process.env.NODE_ENV === "development";
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: isDev
            ? `Error: ${error.message}`
            : "No se pudo procesar el deposito.. Intente nuevamente.",
        });
      }

      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No se pudo procesar el deposito.",
      });
    }
  },
});
