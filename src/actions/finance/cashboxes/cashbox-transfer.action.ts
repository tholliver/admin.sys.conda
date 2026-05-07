// src/actions/finance/cashboxes/cashbox-transfer.action.ts
//
// Transfers funds between two cashboxes.
// Rules:
//   - From GEN → any sector: always allowed (GEN is the real wallet)
//   - From sector → GEN: allowed only if sector has enough balance (repayment flow)
//   - From sector → sector: allowed only if source has enough balance
//
// Transfer does NOT touch cumulativeDebt — it moves real balance.
// If a sector wants to "repay" GEN, they use this action (sector → GEN).
// GEN covering a sector is done via cashboxWithdraw on the sector directly,
// not a transfer (since the sector is conceptual, no physical cash moves).

import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import { cashboxes, transactions, transactionCategories } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { formatBOB } from "@/utils/formatters";
import { formatter } from "@/utils/timex";

const GEN_CODE = "GEN";

async function getActiveCashbox(id: string) {
    const [box] = await db
        .select()
        .from(cashboxes)
        .where(and(eq(cashboxes.id, id), eq(cashboxes.status, "activo")));
    return box ?? null;
}

export const cashboxTransfer = defineAction({
    accept: "form",
    input: z.object({
        fromCashboxId: z.uuid("Caja origen inválida"),
        toCashboxId:   z.uuid("Caja destino inválida"),
        amount:        z
            .string()
            .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
            .refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
        concept:       z.string().min(1, "Concepto requerido").max(255),
        notes:         z.string().max(500).optional(),
    }),

    async handler(input, { locals }) {
        const user = locals.user;
        if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

        if (input.fromCashboxId === input.toCashboxId) {
            throw new ActionError({ code: "BAD_REQUEST", message: "La caja origen y destino no pueden ser la misma." });
        }

        const amount = DecimalService.normalize(input.amount);

        const [from, to] = await Promise.all([
            getActiveCashbox(input.fromCashboxId),
            getActiveCashbox(input.toCashboxId),
        ]);

        if (!from) throw new ActionError({ code: "NOT_FOUND", message: "Caja origen no encontrada o inactiva." });
        if (!to)   throw new ActionError({ code: "NOT_FOUND", message: "Caja destino no encontrada o inactiva." });

        const fromBalance = DecimalService.normalize(String(from.balance ?? "0"));
        const isFromGEN   = from.code === GEN_CODE;

        // GEN can always transfer out (it's the real wallet).
        // Sector cashboxes need enough balance.
        if (!isFromGEN && !DecimalService.isGreaterOrEqual(fromBalance, amount)) {
            throw new ActionError({
                code: "BAD_REQUEST",
                message: `Saldo insuficiente en ${from.name}. Disponible: ${formatBOB(fromBalance)}.`,
            });
        }

        // ── Resolve system categories ────────────────────────────────────────
        const [[transferOutCat], [transferInCat]] = await Promise.all([
            db.select({ id: transactionCategories.id, name: transactionCategories.name })
                .from(transactionCategories)
                .where(and(eq(transactionCategories.code, "TRANSFER"), eq(transactionCategories.isSystem, true)))
                .limit(1),
            db.select({ id: transactionCategories.id, name: transactionCategories.name })
                .from(transactionCategories)
                .where(and(eq(transactionCategories.code, "TRANSFER_IN"), eq(transactionCategories.isSystem, true)))
                .limit(1),
        ]);

        if (!transferOutCat || !transferInCat) {
            throw new ActionError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Categorías TRANSFER/TRANSFER_IN no encontradas. Ejecuta el seed.",
            });
        }

        // ── New balances ─────────────────────────────────────────────────────
        const newFromBalance = isFromGEN
            ? DecimalService.subtract(fromBalance, amount) // GEN can go lower, its real
            : DecimalService.subtract(fromBalance, amount);

        const newToBalance = DecimalService.add(
            DecimalService.normalize(String(to.balance ?? "0")),
            amount,
        );

        const concept      = input.concept.trim();
        const outConcept   = `Transferencia → ${to.name}: ${concept}`;
        const inConcept    = `Transferencia ← ${from.name}: ${concept}`;
        const metaNotes    = input.notes?.trim()
            ? JSON.stringify({ notes: input.notes.trim() })
            : null;

        // ── Atomic DB transaction ────────────────────────────────────────────
        const { outTx } = await db.transaction(async (tx) => {
            const result = await tx.execute<{ pairId: string }>(sql`select uuidv7() as "pairId"`);
            const pairId = (result.rows[0] as { pairId: string }).pairId;

            const [outTx] = await tx
                .insert(transactions)
                .values({
                    type:               "withdraw",
                    amount,
                    categoryId:         transferOutCat.id,
                    concept:            outConcept,
                    cashboxId:          from.id,
                    createdByUserId:    user.id,
                    status:             "completado",
                    balanceAfter:       newFromBalance,
                    transferToCashboxId: to.id,
                    transferPairId:     pairId,
                    metadata:           metaNotes,
                })
                .returning();

            await tx.insert(transactions).values({
                type:               "deposit",
                amount,
                categoryId:         transferInCat.id,
                concept:            inConcept,
                cashboxId:          to.id,
                createdByUserId:    user.id,
                status:             "completado",
                balanceAfter:       newToBalance,
                transferToCashboxId: from.id,
                transferPairId:     pairId,
                metadata:           metaNotes,
            });

            await tx
                .update(cashboxes)
                .set({ balance: newFromBalance, updatedAt: new Date() })
                .where(eq(cashboxes.id, from.id));

            await tx
                .update(cashboxes)
                .set({ balance: newToBalance, updatedAt: new Date() })
                .where(eq(cashboxes.id, to.id));

            return { outTx };
        });

        return {
            success: true,
            message: `Transferencia de ${formatBOB(amount)} de "${from.name}" a "${to.name}" completada.`,
            transaction: {
                id:        outTx.id,
                amount:    formatBOB(amount),
                concept,
                timestamp: formatter.format(outTx.createdAt),
                reference: null,
            },
            from: { id: from.id, name: from.name, newBalance: formatBOB(newFromBalance) },
            to:   { id: to.id,   name: to.name,   newBalance: formatBOB(newToBalance)   },
        };
    },
});
