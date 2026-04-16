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
      throw new ActionError({ code: "NOT_FOUND", message: "Transacción no encontrada." });
    }

    if (tx.status === "cancelado") {
      throw new ActionError({ code: "BAD_REQUEST", message: "Esta transacción ya fue anulada." });
    }

    if (tx.status !== "completado") {
      throw new ActionError({ code: "BAD_REQUEST", message: "Solo se pueden anular transacciones completadas." });
    }

    // ── TRANSFER: void both legs atomically ──────────────────────────────────
    // A transfer creates two linked transactions (withdraw + deposit) sharing a
    // transferPairId. We MUST reverse both in a single DB transaction or the
    // total money across all cashboxes will be wrong.
    if (tx.transferPairId) {
      const pairLegs = await db
        .select()
        .from(transactions)
        .where(eq(transactions.transferPairId, tx.transferPairId));

      if (pairLegs.length !== 2) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se encontraron ambas partes de la transferencia. Contacta al administrador.",
        });
      }

      if (pairLegs.some((leg) => leg.status === "cancelado")) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Esta transferencia ya fue anulada.",
        });
      }

      const debitLeg = pairLegs.find((leg) => leg.type === "withdraw")!;

      await db.transaction(async (dbTx) => {
        for (const leg of pairLegs) {
          const [legBox] = await dbTx
            .select()
            .from(cashboxes)
            .where(eq(cashboxes.id, leg.cashboxId))
            .limit(1);

          if (!legBox) {
            throw new ActionError({
              code: "NOT_FOUND",
              message: `Caja de la transacción "${leg.concept}" no encontrada.`,
            });
          }

          const currentBalance = String(legBox.balance ?? "0");
          let reversedBalance: string;

          if (leg.type === "deposit") {
            // Deposit leg → subtract back
            if (!DecimalService.isGreaterOrEqual(currentBalance, leg.amount)) {
              throw new ActionError({
                code: "BAD_REQUEST",
                message: `No se puede anular: el saldo actual de "${legBox.name}" (${formatBOB(currentBalance)}) es menor al monto acreditado (${formatBOB(leg.amount)}).`,
              });
            }
            reversedBalance = DecimalService.subtract(currentBalance, leg.amount);
          } else {
            // Withdraw leg → add back
            reversedBalance = DecimalService.add(currentBalance, leg.amount);
          }

          const voidMeta = JSON.stringify({
            voidedBy: user.id,
            voidedAt: new Date().toISOString(),
            reason: input.reason,
            previousStatus: leg.status,
            balanceBeforeVoid: currentBalance,
            transferPairVoid: true,
          });

          await dbTx
            .update(transactions)
            .set({ status: "cancelado", metadata: voidMeta, updatedAt: new Date() })
            .where(eq(transactions.id, leg.id));

          await dbTx
            .update(cashboxes)
            .set({ balance: reversedBalance, updatedAt: new Date() })
            .where(eq(cashboxes.id, legBox.id));
        }
      });

      return {
        success: true,
        isTransfer: true,
        message: `Transferencia de ${formatBOB(debitLeg.amount)} anulada. Ambas cajas fueron revertidas correctamente.`,
        newBalance: null,
      };
    }

    // ── REGULAR TRANSACTION: single leg void ─────────────────────────────────
    const [cashbox] = await db
      .select()
      .from(cashboxes)
      .where(eq(cashboxes.id, tx.cashboxId))
      .limit(1);

    if (!cashbox) {
      throw new ActionError({ code: "NOT_FOUND", message: "Caja de la transacción no encontrada." });
    }

    const currentBalance = String(cashbox.balance || "0");
    let newBalance: string;

    if (tx.type === "deposit") {
      if (!DecimalService.isGreaterOrEqual(currentBalance, tx.amount)) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `No se puede anular: el saldo actual (${formatBOB(currentBalance)}) es menor al monto del depósito (${formatBOB(tx.amount)}).`,
        });
      }
      newBalance = DecimalService.subtract(currentBalance, tx.amount);
    } else {
      newBalance = DecimalService.add(currentBalance, tx.amount);
    }

    const voidMeta = JSON.stringify({
      voidedBy: user.id,
      voidedAt: new Date().toISOString(),
      reason: input.reason,
      previousStatus: tx.status,
      balanceBeforeVoid: currentBalance,
    });

    await db.transaction(async (dbTx) => {
      await dbTx
        .update(transactions)
        .set({ status: "cancelado", metadata: voidMeta, updatedAt: new Date() })
        .where(eq(transactions.id, tx.id));

      await dbTx
        .update(cashboxes)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(cashboxes.id, cashbox.id));
    });

    return {
      success: true,
      isTransfer: false,
      message: `Transacción de ${formatBOB(tx.amount)} anulada correctamente. Nuevo saldo: ${formatBOB(newBalance)}.`,
      newBalance,
    };
  },
});
