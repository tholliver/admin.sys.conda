// src/services/rrhh/payEmployeeFeeOverdraft.service.ts
// Extends payEmployeeFee with overdraft support.
// The original payEmployeeFee is UNTOUCHED — this wraps the same logic
// with the balance check replaced by overdraft computation.

import { db } from "@/db";
import {
    cashboxes, employees, employeeFees, sectors,
    transactions, transactionCategories,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { PayEmployeeFeeInput } from "@/lib/schemas/rrhh.schemas";

export interface PayFeeOverdraftResult {
    payment:         typeof transactions.$inferSelect;
    isOverdraft:     boolean;
    overdraftAmount: string; // "0.00" when not overdrawn
    newBalance:      string;
    cashboxName:     string;
}

/**
 * allowOverdraft = false  →  throws on insufficient funds (same as original)
 * allowOverdraft = true   →  records the transaction with overdraftAmount set,
 *                             balance goes negative via raw SQL
 */
export async function payEmployeeFeeWithOverdraft(
    data: PayEmployeeFeeInput & { allowOverdraft?: boolean },
    processedByUserId: string,
): Promise<PayFeeOverdraftResult> {
    const allowOverdraft = data.allowOverdraft ?? false;

    // ── Load fee + employee ──────────────────────────────────────────────────
    const [feeRow] = await db
        .select({
            fee:              employeeFees,
            employeeSectorId: employees.sectorId,
            employeeName:     employees.fullName,
        })
        .from(employeeFees)
        .innerJoin(employees, eq(employees.id, employeeFees.employeeId))
        .where(eq(employeeFees.id, data.feeId))
        .limit(1);

    if (!feeRow) throw new Error("Cuota no encontrada.");
    const { fee, employeeSectorId, employeeName } = feeRow;

    if (fee.status === "pagado") throw new Error("Esta cuota ya fue pagada.");

    const amountToPay = Number(data.amountPaid);
    const feeAmount   = Number(fee.amount);

    if (!Number.isFinite(amountToPay) || amountToPay <= 0)
        throw new Error("El monto de pago es inválido.");
    if (Math.round(amountToPay * 100) !== Math.round(feeAmount * 100))
        throw new Error(`El pago debe ser exacto: Bs ${feeAmount.toFixed(2)}.`);

    // ── Resolve salary category ──────────────────────────────────────────────
    const [salaryCategory] = await db
        .select({ id: transactionCategories.id })
        .from(transactionCategories)
        .where(
            and(
                eq(transactionCategories.code, "OUT-014"),
                eq(transactionCategories.type, "outcome"),
                eq(transactionCategories.status, true),
            ),
        )
        .limit(1);

    if (!salaryCategory)
        throw new Error('No existe la categoría activa "OUT-014" para pago salarial.');

    // ── Resolve cashbox (same logic as original) ─────────────────────────────
    type CashboxRow = { id: string; name: string; balance: string | null; status: string | null };
    let resolvedCashbox: CashboxRow;

    const [linked] = await db
        .select({ id: cashboxes.id, name: cashboxes.name, balance: cashboxes.balance, status: cashboxes.status })
        .from(sectors)
        .innerJoin(cashboxes, eq(cashboxes.id, sectors.cashboxId))
        .where(eq(sectors.id, Number(employeeSectorId)))
        .limit(1);

    if (!linked) {
        if (employeeSectorId == null) {
            const [general] = await db
                .select({ id: cashboxes.id, name: cashboxes.name, balance: cashboxes.balance, status: cashboxes.status })
                .from(cashboxes)
                .where(and(eq(cashboxes.code, "GEN"), eq(cashboxes.status, "activo")))
                .limit(1);
            if (!general) throw new Error('No existe caja general activa con código "GEN".');
            resolvedCashbox = general;
        } else {
            const [fallback] = await db
                .select({ id: cashboxes.id, name: cashboxes.name, balance: cashboxes.balance, status: cashboxes.status })
                .from(sectors)
                .innerJoin(cashboxes, eq(cashboxes.id, sectors.cashboxId))
                .where(eq(sectors.id, employeeSectorId))
                .limit(1);
            if (!fallback) throw new Error(`El sector de "${employeeName}" no tiene caja vinculada.`);
            if (fallback.status !== "activo") throw new Error(`La caja de "${employeeName}" está inactiva.`);
            resolvedCashbox = fallback;
        }
    } else {
        if (linked.status !== "activo")
            throw new Error(`La caja vinculada al sector de "${employeeName}" está inactiva.`);
        resolvedCashbox = linked;
    }

    // ── Balance check ────────────────────────────────────────────────────────
    const available      = Number(resolvedCashbox.balance ?? 0);
    const isOverdraft    = available < amountToPay;
    const overdraftAmt   = isOverdraft ? (amountToPay - available) : 0;

    if (isOverdraft && !allowOverdraft) {
        // Return structured info so the caller (store) can show the debt dialog
        const err = new Error(
            `__INSUFFICIENT_FUNDS__:${available.toFixed(2)}:${amountToPay.toFixed(2)}:${overdraftAmt.toFixed(2)}:${resolvedCashbox.name}`,
        );
        throw err;
    }

    const newBalanceNum = available - amountToPay;
    const newBalance    = newBalanceNum.toFixed(2);
    const overdraftStr  = overdraftAmt.toFixed(2);

    // ── DB transaction ───────────────────────────────────────────────────────
    const [payment] = await db.transaction(async (tx) => {
        const [createdPayment] = await tx
            .insert(transactions)
            .values({
                cashboxId:       resolvedCashbox.id,
                categoryId:      salaryCategory.id,
                sectorId:        employeeSectorId ?? null,
                type:            "withdraw",
                amount:          amountToPay.toFixed(2),
                concept:         `Pago de salario ${fee.period} - ${employeeName}`,
                metadata:        data.notes?.trim() ? JSON.stringify({ justification: data.notes.trim() }) : null,
                externalReference: data.receiptNumber?.trim() || null,
                createdByUserId: processedByUserId,
                status:          "completado",
                balanceAfter:    newBalance,
                overdraftAmount: overdraftStr,
                linkedEntityType: "employee_fee",
                linkedEntityId:   fee.id,
            })
            .returning();

        await tx
            .update(employeeFees)
            .set({
                status:        "pagado",
                paymentMethod: data.paymentMethod,
                transactionId: createdPayment.id,
                updatedAt:     new Date(),
            })
            .where(eq(employeeFees.id, data.feeId));

        // Raw SQL to bypass CHECK constraint on balance >= 0
        await tx.execute(
            sql`UPDATE finance.cashboxes SET balance = ${newBalance}, updated_at = NOW() WHERE id = ${resolvedCashbox.id}`,
        );

        return [createdPayment];
    });

    return {
        payment,
        isOverdraft,
        overdraftAmount: overdraftStr,
        newBalance,
        cashboxName: resolvedCashbox.name,
    };
}
