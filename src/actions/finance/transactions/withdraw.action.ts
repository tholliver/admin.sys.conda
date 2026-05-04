import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactions, cashboxes, transactionCategories, invoiceRanges } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { formatter } from "@/utils/timex";
import { ENV } from "@/config/env";
import { formatBOB } from "@/utils/formatters";
import { resolveInvoiceReference } from "@/lib/finance/resolve-invoice";

export const withdraw = defineAction({
  accept: "form",
  input: z.object({
    cashboxId: z.uuid("ID de caja inválido"),
    categoryId: z.uuid("ID de cuenta inválido"),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
      .refine((val) => {
        const num = parseFloat(val);
        return num > 0 && num <= ENV.TRANSACTION_LIMITS.WITHDRAWAL_MAX;
      }, `Monto debe ser entre 0.01 y ${formatBOB(String(ENV.TRANSACTION_LIMITS.WITHDRAWAL_MAX))}`),
    authorizedBy: z
      .string()
      .min(1, "Nombre de autorización requerido")
      .max(255)
      .optional(),
    externalReference: z.string().max(255).optional(),
    justification: z.string().min(1, "Debe justificar el egreso").max(1000),
    invoiceRangeId: z.uuid().optional(),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;
      if (!user) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesion para registrar un egreso.",
        });
      }

      const { categoryId, amount, authorizedBy, externalReference, justification, invoiceRangeId } = input;

      try {
        DecimalService.validateAmount(amount);
      } catch (err) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Monto invalido",
        });
      }

      const normalizedAmount = DecimalService.normalize(amount);

      const [category] = await db
        .select()
        .from(transactionCategories)
        .where(
          and(
            eq(transactionCategories.id, categoryId),
            eq(transactionCategories.type, "outcome"),
            eq(transactionCategories.status, true),
          ),
        );

      if (!category) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "La cuenta seleccionada no existe o esta inactiva.",
        });
      }

      const [cashbox] = await db.select().from(cashboxes).where(eq(cashboxes.id, input.cashboxId));

      if (!cashbox) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "No se encontro la caja seleccionada. Contacta al administrador.",
        });
      }

      if (cashbox.status !== "activo") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `La caja ${cashbox.name} esta inactiva. Contacta al administrador.`,
        });
      }

      const currentBalance = String(cashbox.balance || "0");
      const deficit = DecimalService.subtract(normalizedAmount, currentBalance);

      if (!DecimalService.isGreaterOrEqual(currentBalance, normalizedAmount)) {
        throw new ActionError({
            code: "BAD_REQUEST",
            message: `__INSUFFICIENT_FUNDS__:${currentBalance}:${normalizedAmount}:${deficit}:${cashbox.name}`,
        });
      }

      const newBalance = DecimalService.subtract(currentBalance, normalizedAmount);

      const { reference: resolvedReference, invoiceNumber, resolvedRangeId } =
        await resolveInvoiceReference(category, { manualReference: externalReference, invoiceRangeId });

      const transaction = await db.transaction(async (tx) => {
        const [txn] = await tx
          .insert(transactions)
          .values({
            type: "withdraw",
            amount: normalizedAmount,
            categoryId,
            concept: category.name,
            authorizedBy: authorizedBy || null,
            invoiceRangeId: resolvedRangeId,
            invoiceNumber:  invoiceNumber,
            cashboxId: cashbox.id,
            externalReference: resolvedReference ?? externalReference ?? null,
            metadata: justification?.trim() ? JSON.stringify({ justification: justification.trim() }) : null,
            createdByUserId: user.id,
            status: "completado",
            balanceAfter: newBalance,
          })
          .returning();

        await tx
          .update(cashboxes)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(cashboxes.id, cashbox.id));

        if (resolvedRangeId && invoiceNumber) {
          await tx
            .update(invoiceRanges)
            .set({ current: invoiceNumber + 1 })
            .where(and(eq(invoiceRanges.id, resolvedRangeId), eq(invoiceRanges.isSystem, false)));
        }

        return txn;
      });

      return {
        success: true,
        message: `Egreso de ${formatBOB(normalizedAmount)} registrado correctamente.`,
        transaction: {
          id: transaction.id,
          amount: formatBOB(normalizedAmount),
          concept: category.name,
          authorizedBy: authorizedBy || undefined,
          timestamp: formatter.format(transaction.createdAt),
          reference: invoiceNumber ? `#${invoiceNumber}` : transaction.externalReference ?? null,
        },
        newBalance: formatBOB(newBalance),
      };
    } catch (error) {
      console.error("Withdraw error:", error);
      if (error instanceof ActionError) {
        throw error;
      }

      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No se pudo procesar el egreso.",
      });
    }
  },
});
