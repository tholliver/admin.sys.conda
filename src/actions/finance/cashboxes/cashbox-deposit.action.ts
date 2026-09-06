// src/actions/finance/cashboxes/cashbox-deposit.action.ts
//
// Deposits money into ANY cashbox (GEN or sector).
// If the cashbox has cumulativeDebt, the deposit reduces it first,
// then adds the remainder to balance.
//
// Scenarios:
//   A) Plain deposit — cashbox has no debt          → balance += amount
//   B) Partial coverage — deposit < cumulativeDebt  → debt reduced, balance stays 0
//   C) Full coverage   — deposit >= cumulativeDebt  → debt zeroed, balance += surplus

import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import { cashboxes, transactions, transactionCategories, invoiceRanges } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { bob, date } from "@/utils";
import { resolveInvoiceReference } from "@/lib/finance/resolve-invoice";
import { ENV } from "@/config/env";

export const cashboxDeposit = defineAction({
    accept: "form",
    input: z.object({
        cashboxId:         z.uuid("ID de caja inválido"),
        categoryId:        z.uuid("ID de cuenta inválido"),
        amount:            z
            .string()
            .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
            .refine(
                (v) => parseFloat(v) > 0 && parseFloat(v) <= ENV.TRANSACTION_LIMITS.DEPOSIT_MAX,
                "Monto fuera de rango permitido",
            ),
        concept:           z.string().min(1).max(255).optional(),
        externalReference: z.string().max(255).optional(),
        invoiceRangeId:    z.uuid().optional(),
        notes:             z.string().max(500).optional(),
        // If true, this deposit is explicitly meant to cover accumulated debt.
        // Does not change logic — just enriches metadata for reporting.
        coverDebt:         z.coerce.boolean().optional().default(false),
    }),

    async handler(input, { locals }) {
        const user = locals.user;
        if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

        const { cashboxId, categoryId, amount, externalReference, invoiceRangeId, notes, coverDebt } = input;

        DecimalService.validateAmount(amount);
        const normalizedAmount = DecimalService.normalize(amount);

        // ── Validate category ────────────────────────────────────────────────
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
            throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada o inactiva." });
        }

        // ── Validate cashbox ─────────────────────────────────────────────────
        const [cashbox] = await db
            .select()
            .from(cashboxes)
            .where(eq(cashboxes.id, cashboxId));

        if (!cashbox) {
            throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada." });
        }
        if (cashbox.status !== "activo") {
            throw new ActionError({ code: "BAD_REQUEST", message: `La caja ${cashbox.name} está inactiva.` });
        }

        // ── Debt coverage calculation ────────────────────────────────────────
        const currentBalance    = DecimalService.normalize(String(cashbox.balance      ?? "0"));
        const currentDebt       = DecimalService.normalize(String(cashbox.cumulativeDebt ?? "0"));
        const hasDebt           = DecimalService.isGreater(currentDebt, "0.00");

        let debtReduced   = "0.00"; // how much debt this deposit covers
        let newDebt       = currentDebt;
        let addToBalance  = normalizedAmount;

        if (hasDebt) {
            if (DecimalService.isLessOrEqual(normalizedAmount, currentDebt)) {
                // Scenario B: deposit <= debt — entirely absorbed by debt
                debtReduced  = normalizedAmount;
                newDebt      = DecimalService.subtract(currentDebt, normalizedAmount);
                addToBalance = "0.00";
            } else {
                // Scenario C: deposit > debt — zeros out debt, surplus goes to balance
                debtReduced  = currentDebt;
                newDebt      = "0.00";
                addToBalance = DecimalService.subtract(normalizedAmount, currentDebt);
            }
        }

        const newBalance = DecimalService.add(currentBalance, addToBalance);

        // ── Invoice reference ────────────────────────────────────────────────
        const { reference: resolvedReference, invoiceNumber, resolvedRangeId } =
            await resolveInvoiceReference(category, { manualReference: externalReference, invoiceRangeId });

        const conceptLabel = input.concept?.trim() || category.name;

        // ── Atomic DB transaction ────────────────────────────────────────────
        const txn = await db.transaction(async (tx) => {
            const [inserted] = await tx
                .insert(transactions)
                .values({
                    type:              "deposit",
                    amount:            normalizedAmount,
                    categoryId,
                    concept:           conceptLabel,
                    cashboxId:         cashbox.id,
                    invoiceRangeId:    resolvedRangeId,
                    invoiceNumber,
                    externalReference: resolvedReference ?? externalReference ?? null,
                    createdByUserId:   user.id,
                    status:            "completado",
                    balanceAfter:      newBalance,
                    metadata: JSON.stringify({
                        ...(notes?.trim()   ? { notes: notes.trim() }         : {}),
                        ...(hasDebt         ? { debtCovered: debtReduced }    : {}),
                        ...(coverDebt       ? { coverDebtIntent: true }       : {}),
                    }) || null,
                })
                .returning();

            // Update balance + cumulativeDebt atomically
            await tx
                .update(cashboxes)
                .set({
                    balance:        newBalance,
                    cumulativeDebt: newDebt,
                    updatedAt:      new Date(),
                })
                .where(eq(cashboxes.id, cashbox.id));

            if (resolvedRangeId && invoiceNumber) {
                await tx
                    .update(invoiceRanges)
                    .set({ current: sql`${invoiceRanges.current} + 1` })
                    .where(and(eq(invoiceRanges.id, resolvedRangeId), eq(invoiceRanges.isSystem, false)));
            }

            return inserted;
        });

        const coveredMsg = hasDebt && DecimalService.isGreater(debtReduced, "0.00")
            ? ` — cubre ${bob(debtReduced)} de deuda acumulada`
            : "";

        return {
            success:      true,
            message:      `Depósito de ${bob(normalizedAmount)} registrado${coveredMsg}.`,
            debtCovered:  debtReduced,
            remainingDebt: newDebt,
            transaction: {
                id:          txn.id,
                amount:      bob(normalizedAmount),
                concept:     conceptLabel,
                timestamp:   date(txn.createdAt),
                reference:   invoiceNumber ? `#${invoiceNumber}` : txn.externalReference ?? null,
            },
            newBalance: bob(newBalance),
        };
    },
});
