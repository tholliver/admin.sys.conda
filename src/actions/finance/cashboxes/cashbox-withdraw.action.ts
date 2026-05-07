// src/actions/finance/cashboxes/cashbox-withdraw.action.ts
//
// Withdraws from ANY cashbox. No separate "overdraft" flow needed.
// If the cashbox cannot cover the amount, the deficit is added to cumulativeDebt
// automatically — no second confirmation step in the action itself.
// The UI can still show a warning before calling this, but the action
// always processes and records the debt cleanly.
//
// Scenarios:
//   A) Cashbox has enough balance   → normal withdraw, debt unchanged
//   B) Cashbox partially covers     → balance zeroed, deficit added to cumulativeDebt
//   C) Cashbox has zero balance     → full amount added to cumulativeDebt

import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import { cashboxes, transactions, transactionCategories, invoiceRanges } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { formatBOB } from "@/utils/formatters";
import { formatter } from "@/utils/timex";
import { resolveInvoiceReference } from "@/lib/finance/resolve-invoice";
import { ENV } from "@/config/env";

export const cashboxWithdraw = defineAction({
    accept: "form",
    input: z.object({
        cashboxId:         z.uuid("ID de caja inválido"),
        categoryId:        z.uuid("ID de cuenta inválido"),
        amount:            z
            .string()
            .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
            .refine(
                (v) => parseFloat(v) > 0 && parseFloat(v) <= ENV.TRANSACTION_LIMITS.WITHDRAWAL_MAX,
                "Monto fuera de rango permitido",
            ),
        concept:           z.string().min(1).max(255).optional(),
        authorizedBy:      z.string().min(1).max(255).optional(),
        externalReference: z.string().max(255).optional(),
        invoiceRangeId:    z.uuid().optional(),
        justification:     z.string().max(1000).optional(),
        // If true, caller already confirmed the overdraft in the UI.
        // Action proceeds either way — flag only enriches metadata.
        overdraftConfirmed: z.coerce.boolean().optional().default(false),
    }),

    async handler(input, { locals }) {
        const user = locals.user;
        if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

        const { cashboxId, categoryId, amount, authorizedBy, externalReference, invoiceRangeId, justification, overdraftConfirmed } = input;

        DecimalService.validateAmount(amount);
        const normalizedAmount = DecimalService.normalize(amount);

        // ── Validate category ────────────────────────────────────────────────
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

        // ── Overdraft calculation ────────────────────────────────────────────
        const currentBalance    = DecimalService.normalize(String(cashbox.balance      ?? "0"));
        const currentDebt       = DecimalService.normalize(String(cashbox.cumulativeDebt ?? "0"));
        const isOverdraft       = !DecimalService.isGreaterOrEqual(currentBalance, normalizedAmount);

        let newBalance   = currentBalance;
        let newDebt      = currentDebt;
        let overdraftAmt = "0.00";

        if (isOverdraft) {
            overdraftAmt = DecimalService.subtract(normalizedAmount, currentBalance);
            newBalance   = "0.00";
            newDebt      = DecimalService.add(currentDebt, overdraftAmt);
        } else {
            newBalance = DecimalService.subtract(currentBalance, normalizedAmount);
        }

        // ── Invoice reference ────────────────────────────────────────────────
        const { reference: resolvedReference, invoiceNumber, resolvedRangeId } =
            await resolveInvoiceReference(category, { manualReference: externalReference, invoiceRangeId });

        const conceptLabel = input.concept?.trim() || category.name;

        // ── Atomic DB transaction ────────────────────────────────────────────
        const txn = await db.transaction(async (tx) => {
            const [inserted] = await tx
                .insert(transactions)
                .values({
                    type:              "withdraw",
                    amount:            normalizedAmount,
                    categoryId,
                    concept:           conceptLabel,
                    cashboxId:         cashbox.id,
                    invoiceRangeId:    resolvedRangeId,
                    invoiceNumber,
                    externalReference: resolvedReference ?? externalReference ?? null,
                    authorizedBy:      authorizedBy ?? null,
                    overdraftAmount:   overdraftAmt,
                    createdByUserId:   user.id,
                    status:            "completado",
                    balanceAfter:      newBalance,
                    metadata: JSON.stringify({
                        ...(justification?.trim()  ? { justification: justification.trim() } : {}),
                        ...(isOverdraft             ? { overdraftConfirmed }                  : {}),
                    }) || null,
                })
                .returning();

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

        const overdraftMsg = isOverdraft
            ? ` — deuda acumulada: ${formatBOB(overdraftAmt)}`
            : "";

        return {
            success:         true,
            isOverdraft,
            overdraftAmount: overdraftAmt,
            totalDebt:       newDebt,
            message:         `Egreso de ${formatBOB(normalizedAmount)} registrado${overdraftMsg}.`,
            transaction: {
                id:          txn.id,
                amount:      formatBOB(normalizedAmount),
                concept:     conceptLabel,
                authorizedBy: authorizedBy ?? undefined,
                timestamp:   formatter.format(txn.createdAt),
                reference:   invoiceNumber ? `#${invoiceNumber}` : txn.externalReference ?? null,
            },
            newBalance:  formatBOB(newBalance),
        };
    },
});
