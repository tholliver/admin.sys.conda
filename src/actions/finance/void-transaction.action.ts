import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactions, cashboxes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { formatBOB } from "@/utils/formatters";

export const voidTransaction = defineAction({
  accept: "form",
  input: z.object({
    transactionId: z.uuid("ID de transacción inválido"),
    reason: z
      .string()
      .trim()
      .min(5, "El motivo debe tener al menos 5 caracteres")
      .max(500, "El motivo es demasiado largo"),
  }),
  async handler(input, { locals }) {
    const user = locals.user;
    if (!user) {
      throw new ActionError({
        code: "UNAUTHORIZED",
        message: "Debes iniciar sesión para anular una transacción.",
      });
    }

    // Only ADMIN and ADMON can void transactions
    const allowedRoles = ["ADMIN", "ADMON"];
    if (!allowedRoles.includes(user.role)) {
      throw new ActionError({
        code: "FORBIDDEN",
        message: "No tienes permisos para anular transacciones.",
      });
    }

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, input.transactionId))
      .limit(1);

    if (!tx) {
      throw new ActionError({
        code: "NOT_FOUND",
        message: "Transacción no encontrada.",
      });
    }

    if (tx.status === "cancelado") {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Esta transacción ya fue anulada.",
      });
    }

    if (tx.status !== "completado") {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Solo se pueden anular transacciones completadas.",
      });
    }

    // Get the cashbox to reverse the balance
    const [cashbox] = await db
      .select()
      .from(cashboxes)
      .where(eq(cashboxes.id, tx.cashboxId))
      .limit(1);

    if (!cashbox) {
      throw new ActionError({
        code: "NOT_FOUND",
        message: "Caja de la transacción no encontrada.",
      });
    }

    const currentBalance = String(cashbox.balance || "0");
    let newBalance: string;

    if (tx.type === "deposit") {
      // Reversing a deposit: subtract the amount back
      if (!DecimalService.isGreaterOrEqual(currentBalance, tx.amount)) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `No se puede anular: el saldo actual (${formatBOB(currentBalance)}) es menor al monto del depósito (${formatBOB(tx.amount)}).`,
        });
      }
      newBalance = DecimalService.subtract(currentBalance, tx.amount);
    } else {
      // Reversing a withdrawal: add the amount back
      newBalance = DecimalService.add(currentBalance, tx.amount);
    }

    // Update transaction to cancelled and store void reason in metadata
    const voidMeta = JSON.stringify({
      voidedBy: user.id,
      voidedAt: new Date().toISOString(),
      reason: input.reason,
      previousStatus: tx.status,
      balanceBeforeVoid: currentBalance,
    });

    await db
      .update(transactions)
      .set({
        status: "cancelado",
        metadata: voidMeta,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    // Reverse cashbox balance
    await db
      .update(cashboxes)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(cashboxes.id, cashbox.id));

    return {
      success: true,
      message: `Transacción de ${formatBOB(tx.amount)} anulada correctamente. Nuevo saldo: ${formatBOB(newBalance)}.`,
      newBalance,
    };
  },
});
