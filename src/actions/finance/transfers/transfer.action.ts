// src/actions/finance/transfer.action.ts

import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { cashboxes, transactions, transactionCategories, contractors, contractorPayments } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { bob } from "@/utils/currency";


// ─── Helpers ────────────────────────────────────────────────────────────────

async function getActiveCashbox(id: string) {
  const [box] = await db
    .select()
    .from(cashboxes)
    .where(and(eq(cashboxes.id, id), eq(cashboxes.status, "activo")));
  return box ?? null;
}

// ============================================================================
// TRANSFER — move funds between two cashboxes atomically
// ============================================================================

export const transfer = defineAction({
  accept: "form",
  input: z.object({
    fromCashboxId: z.uuid("Caja origen inválida"),
    toCashboxId: z.uuid("Caja destino inválida"),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
      .refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    description: z.string().max(1000).optional(),
  }),
  async handler(input, { locals }) {
    const user = locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

    if (input.fromCashboxId === input.toCashboxId) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "La caja origen y destino no pueden ser la misma.",
      });
    }

    const amount = DecimalService.normalize(input.amount);

    const [from, to] = await Promise.all([
      getActiveCashbox(input.fromCashboxId),
      getActiveCashbox(input.toCashboxId),
    ]);

    if (!from)
      throw new ActionError({ code: "NOT_FOUND", message: "Caja origen no encontrada o inactiva." });
    if (!to)
      throw new ActionError({ code: "NOT_FOUND", message: "Caja destino no encontrada o inactiva." });

    if (!DecimalService.isGreaterOrEqual(String(from.balance ?? "0"), amount)) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: `Saldo insuficiente en ${from.name}. Disponible: ${bob(String(from.balance ?? "0"))}.`,
      });
    }

    // Replace the single category fetch with both:
    const [[transferCategory], [transferInCategory]] = await Promise.all([
      db.select({ id: transactionCategories.id, name: transactionCategories.name })
        .from(transactionCategories)
        .where(and(eq(transactionCategories.code, "TRANSFER"), eq(transactionCategories.isSystem, true)))
        .limit(1),
      db.select({ id: transactionCategories.id, name: transactionCategories.name })
        .from(transactionCategories)
        .where(and(eq(transactionCategories.code, "TRANSFER_IN"), eq(transactionCategories.isSystem, true)))
        .limit(1),
    ]);

    if (!transferCategory || !transferInCategory) {
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Categorías TRANSFER/TRANSFER_IN no encontradas. Ejecuta el seed." });
    }

    const newFromBalance = DecimalService.subtract(String(from.balance ?? "0"), amount);
    const newToBalance = DecimalService.add(String(to.balance ?? "0"), amount);

    const outDesc = input.description?.trim() || null;
    const outConcept = `Transferencia → ${to.name}`;
    const inConcept = `Transferencia ← ${from.name}`;

    const { outTx } = await db.transaction(async (tx) => {
      // Generate a shared pair ID so both legs are traceable together
      const result = await tx.execute<{ pairId: string }>(sql`select uuidv7() as "pairId"`);
      const pairId = (result.rows[0] as { pairId: string }).pairId;

      const [outTx] = await tx
        .insert(transactions)
        .values({
          type: "withdraw",
          amount,
          categoryId: transferCategory.id,
          concept: outConcept,
          metadata: outDesc ? JSON.stringify({ description: outDesc }) : null,
          cashboxId: from.id,
          createdByUserId: user.id,
          status: "completado",
          balanceAfter: newFromBalance,
          transferToCashboxId: to.id,   // ← where the money went
          transferPairId: pairId,        // ← links both legs
        })
        .returning();

      await tx.insert(transactions).values({
        type: "deposit",
        amount,
        categoryId: transferInCategory.id, // ← was transferCategory.id
        concept: inConcept,
        metadata: outDesc ? JSON.stringify({ description: outDesc }) : null,
        cashboxId: to.id,
        createdByUserId: user.id,
        status: "completado",
        balanceAfter: newToBalance,
        transferToCashboxId: from.id,
        transferPairId: pairId,
      });

      await tx.update(cashboxes).set({ balance: newFromBalance, updatedAt: new Date() }).where(eq(cashboxes.id, from.id));
      await tx.update(cashboxes).set({ balance: newToBalance,   updatedAt: new Date() }).where(eq(cashboxes.id, to.id));

      return { outTx };
    });

    return {
      success: true,
      message: `Transferencia de ${bob(amount)} de "${from.name}" a "${to.name}" completada.`,
      transaction: {
        id: outTx.id,
        amount: bob(amount),
        reference: null,
        timestamp: outTx.createdAt.toISOString(),
      },
      from: { id: from.id, name: from.name, newBalance: bob(newFromBalance) },
      to: { id: to.id, name: to.name, newBalance: bob(newToBalance) },
    };
  },
});

// ============================================================================
// PAY CONTRACTOR — withdraw from a cashbox and record a contractor payment
// ============================================================================

export const payContractor = defineAction({
  accept: "form",
  input: z.object({
    contractorId: z.coerce.number().int().positive("Contratista requerido"),
    cashboxId: z.uuid("Caja inválida"),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
      .refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    concept: z.string().min(1, "Concepto requerido").max(255),
    receiptNumber: z.string().max(30).optional(),
    description: z.string().max(1000).optional(),
  }),
  async handler(input, { locals }) {
    const user = locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

    const amount = DecimalService.normalize(input.amount);
    const concept = input.concept.trim();

    const [contractor] = await db
      .select()
      .from(contractors)
      .where(and(eq(contractors.id, input.contractorId), eq(contractors.status, "activo")));

    if (!contractor)
      throw new ActionError({ code: "NOT_FOUND", message: "Contratista no encontrado o inactivo." });

    const cashbox = await getActiveCashbox(input.cashboxId);
    if (!cashbox)
      throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada o inactiva." });

    if (!DecimalService.isGreaterOrEqual(String(cashbox.balance ?? "0"), amount)) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: `Saldo insuficiente en ${cashbox.name}. Disponible: ${bob(String(cashbox.balance ?? "0"))}.`,
      });
    }

    const [contractorCategory] = await db
      .select({ id: transactionCategories.id, name: transactionCategories.name })
      .from(transactionCategories)
      .where(and(eq(transactionCategories.code, "CONTRATISTA"), eq(transactionCategories.isSystem, true)))
      .limit(1);

    if (!contractorCategory) {
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: 'Categoría CONTRATISTA no encontrada. Ejecuta el seed.',
      });
    }

    const newBalance = DecimalService.subtract(String(cashbox.balance ?? "0"), amount);

    const payment = await db.transaction(async (tx) => {
      // Finance transaction for full audit trail
      const [financeTx] = await tx
        .insert(transactions)
        .values({
          type: "withdraw",
          amount,
          categoryId: contractorCategory.id,
          concept: `Pago contratista: ${contractor.fullName} — ${concept}`,
          cashboxId: cashbox.id,
          metadata: input.description?.trim() ? JSON.stringify({ note: input.description.trim() }) : null,
          createdByUserId: user.id,
          status: "completado",
          balanceAfter: newBalance,
        })
        .returning();

      // Deduct cashbox balance
      await tx
        .update(cashboxes)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(cashboxes.id, cashbox.id));

      // Record contractor payment
      const [payment] = await tx
        .insert(contractorPayments)
        .values({
          contractorId: input.contractorId,
          transactionId: financeTx.id,
          concept,
          receiptNumber: input.receiptNumber?.trim() || null,
          notes: input.description?.trim() || null,
          processedByUserId: user.id,
        })
        .returning();

      return payment;
    });

    return {
      success: true,
      message: `Pago de ${bob(amount)} a "${contractor.fullName}" registrado.`,
      transaction: {
        id: payment.uuid,
        amount: bob(amount),
        concept: `${contractor.fullName} — ${concept}`,
        reference: input.receiptNumber || null,
        timestamp: payment.createdAt.toISOString(),
      },
      newBalance: bob(newBalance),
    };
  },
});

// ============================================================================
// CONTRACTOR CRUD
// ============================================================================

export const createContractor = defineAction({
  accept: "form",
  input: z.object({
    fullName: z.string().min(2, "Nombre requerido").max(200),
    ci: z.string().max(20).optional(),
    ruc: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    email: z.email("Email inválido").max(150).optional(),
    address: z.string().max(255).optional(),
    specialty: z.string().max(120).optional(),
    notes: z.string().max(1000).optional(),
  }),
  async handler(input, { locals }) {
    const user = locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

    const [contractor] = await db
      .insert(contractors)
      .values({
        fullName: input.fullName.trim(),
        ci: input.ci?.trim() || null,
        ruc: input.ruc?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        specialty: input.specialty?.trim() || null,
        notes: input.notes?.trim() || null,
        status: "activo",
        createdByUserId: user.id,
      })
      .returning();

    return { success: true, message: `Contratista "${contractor.fullName}" registrado.`, contractor };
  },
});

export const updateContractorStatus = defineAction({
  accept: "form",
  input: z.object({
    id: z.coerce.number().int().positive(),
    status: z.enum(["activo", "inactivo"]),
  }),
  async handler(input, { locals }) {
    if (!locals.user) throw new ActionError({ code: "UNAUTHORIZED" });

    await db
      .update(contractors)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(contractors.id, input.id));

    return { success: true, message: `Estado actualizado.` };
  },
});
