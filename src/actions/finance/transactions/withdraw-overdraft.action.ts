// src/actions/finance/transactions/withdraw-overdraft.action.ts
import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import { cashboxes, transactions, transactionCategories, invoiceRanges } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { bob, date } from "@/utils";
import { resolveInvoiceReference } from "@/lib/finance/resolve-invoice";
import { ENV } from "@/config/env";

export const withdrawOverdraft = defineAction({
    accept: "form",
    input: z.object({
        cashboxId:       z.uuid("ID de caja inválido"),
        categoryId:      z.uuid("ID de cuenta inválido"),
        amount: z
            .string()
            .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
            .refine(
                (val) => {
                    const num = parseFloat(val);
                    return num > 0 && num <= ENV.TRANSACTION_LIMITS.WITHDRAWAL_MAX;
                },
                `Monto fuera de rango permitido`,
            ),
        authorizedBy:    z.string().min(1).max(255).optional(),
        externalReference: z.string().max(255).optional(),
        justification:     z.string().min(1, "Debe justificar el egreso").max(1000),
        invoiceRangeId:  z.uuid().optional(),
    }),

    async handler(input, { locals }) {
        const user = locals.user;
        if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

        const { cashboxId, categoryId, amount, authorizedBy, externalReference, justification, invoiceRangeId } = input;

        DecimalService.validateAmount(amount);
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

        if (!category) throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada o inactiva." });

        const [cashbox] = await db.select().from(cashboxes).where(eq(cashboxes.id, cashboxId));

        if (!cashbox) throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada." });
        if (cashbox.status !== "activo") throw new ActionError({ code: "BAD_REQUEST", message: `La caja ${cashbox.name} está inactiva.` });

        const available      = DecimalService.normalize(String(cashbox.balance ?? "0"));
        const isOverdraft    = !DecimalService.isGreaterOrEqual(available, normalizedAmount);
        const overdraftAmount = isOverdraft
            ? DecimalService.normalize(DecimalService.subtract(normalizedAmount, available))
            : "0.00";

        const newBalance = DecimalService.subtract(available, normalizedAmount);

        const { reference: resolvedReference, invoiceNumber, resolvedRangeId } =
            await resolveInvoiceReference(category, { manualReference: externalReference, invoiceRangeId });

        const transaction = await db.transaction(async (tx) => {
            const [txn] = await tx
                .insert(transactions)
                .values({
                    type:            "withdraw",
                    amount:          normalizedAmount,
                    categoryId,
                    concept:         category.name,
                    authorizedBy:    authorizedBy ?? null,
                    invoiceRangeId:    resolvedRangeId,
                    invoiceNumber:     invoiceNumber,
                    cashboxId:       cashbox.id,
                    externalReference: resolvedReference ?? externalReference ?? null,
                    metadata:          JSON.stringify({ justification: justification.trim() }),
                    createdByUserId: user.id,
                    status:          "completado",
                    balanceAfter:    newBalance,
                    overdraftAmount: isOverdraft ? overdraftAmount : "0.00",
                })
                .returning();

            await tx.execute(
                sql`UPDATE finance.cashboxes
                    SET balance = ${newBalance},
                        cumulative_debt = cumulative_debt + ${isOverdraft ? overdraftAmount : "0.00"}
                    WHERE id = ${cashbox.id}`,
            );

            if (resolvedRangeId && invoiceNumber) {
                await tx
                    .update(invoiceRanges)
                    .set({ current: sql`${invoiceRanges.current} + 1` })
                    .where(and(eq(invoiceRanges.id, resolvedRangeId), eq(invoiceRanges.isSystem, false)));
            }

            return txn;
        });

        return {
            success:       true,
            isOverdraft,
            overdraftAmount: bob(overdraftAmount),
            message:       `Egreso de ${bob(normalizedAmount)} registrado${isOverdraft ? ` — deuda de ${bob(overdraftAmount)}` : ""}.`,
            transaction: {
                id:          transaction.id,
                amount:      bob(normalizedAmount),
                concept:     category.name,
                authorizedBy: authorizedBy ?? undefined,
                timestamp:   formatter.format(transaction.createdAt),
                reference:   invoiceNumber ? `#${invoiceNumber}` : transaction.externalReference ?? null,
            },
            newBalance: bob(newBalance),
        };
    },
});
