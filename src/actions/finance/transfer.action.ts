// src/actions/finance/transfer.action.ts
// Add this to the `finance` export object in src/actions/finance/index.ts:
//   transfer,
//   payContractor,

import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { cashboxes, transactions, transactionCategories, contractors, contractorPayments } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { formatBOB } from "@/utils/formatters";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getActiveCashbox(id: string) {
  const [box] = await db
    .select()
    .from(cashboxes)
    .where(and(eq(cashboxes.id, id), eq(cashboxes.status, "activo")));
  return box ?? null;
}

// Fetch the system TRANSFER category id once per request (cheap — indexed by code)
const SYSTEM_CATEGORIES = {
  TRANSFER: {
    name: "Transferencias internas",
    type: "outcome" as const,
    description: "Cuenta de sistema para transferencias entre cajas.",
    icon: "arrow-right-left",
  },
  CONTRATISTA: {
    name: "Pago a contratistas",
    type: "outcome" as const,
    description: "Cuenta de sistema para pagos a contratistas.",
    icon: "handshake",
  },
} as const;

async function getSystemCategory(code: "TRANSFER" | "CONTRATISTA") {
  const [existing] = await db
    .select({ id: transactionCategories.id, name: transactionCategories.name })
    .from(transactionCategories)
    .where(and(eq(transactionCategories.code, code), eq(transactionCategories.isSystem, true)))
    .limit(1);
  if (existing) return existing;

  const defaults = SYSTEM_CATEGORIES[code];

  await db
    .insert(transactionCategories)
    .values({
      code,
      name: defaults.name,
      type: defaults.type,
      description: defaults.description,
      icon: defaults.icon,
      sortOrder: 0,
      isSystem: true,
      status: true,
      createdByUserId: "system",
    })
    .onConflictDoNothing();

  const [createdOrExisting] = await db
    .select({ id: transactionCategories.id, name: transactionCategories.name })
    .from(transactionCategories)
    .where(and(eq(transactionCategories.code, code), eq(transactionCategories.isSystem, true)))
    .limit(1);

  return createdOrExisting ?? null;
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
    concept: z.string().max(255).optional(),
    notes: z.string().max(1000).optional(),
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
        message: `Saldo insuficiente en ${from.name}. Disponible: ${formatBOB(String(from.balance ?? "0"))}.`,
      });
    }

    const concept = input.concept?.trim() || "Transferencia interna";

    const transferCategory = await getSystemCategory("TRANSFER");
    if (!transferCategory) {
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: 'No se pudo crear/obtener la cuenta de sistema "TRANSFER".',
      });
    }

    const newFromBalance = DecimalService.subtract(String(from.balance ?? "0"), amount);
    const newToBalance = DecimalService.add(String(to.balance ?? "0"), amount);

    const notes = input.notes?.trim() || null;
    const outConcept = `Transferencia → ${to.name}`;
    const inConcept  = `Transferencia ← ${from.name}`;
    const outDesc    = [concept, notes].filter(Boolean).join(" · ");

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
          notes: outDesc || null,
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
        categoryId: transferCategory.id,
        concept: inConcept,
        notes: outDesc || null,
        cashboxId: to.id,
        createdByUserId: user.id,
        status: "completado",
        balanceAfter: newToBalance,
        transferToCashboxId: from.id,  // ← origin (for traceability)
        transferPairId: pairId,         // ← same pair
      });

      await tx.update(cashboxes).set({ balance: newFromBalance, updatedAt: new Date() }).where(eq(cashboxes.id, from.id));
      await tx.update(cashboxes).set({ balance: newToBalance,   updatedAt: new Date() }).where(eq(cashboxes.id, to.id));

      return { outTx };
    });

    return {
      success: true,
      message: `Transferencia de ${formatBOB(amount)} de "${from.name}" a "${to.name}" completada.`,
      transaction: {
        id: outTx.id,
        amount: formatBOB(amount),
        concept,
        reference: null,
        timestamp: outTx.createdAt.toISOString(),
      },
      from: { id: from.id, name: from.name, newBalance: formatBOB(newFromBalance) },
      to: { id: to.id, name: to.name, newBalance: formatBOB(newToBalance) },
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
    notes: z.string().max(1000).optional(),
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
        message: `Saldo insuficiente en ${cashbox.name}. Disponible: ${formatBOB(String(cashbox.balance ?? "0"))}.`,
      });
    }

    const contractorCategory = await getSystemCategory("CONTRATISTA");
    if (!contractorCategory) {
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: 'Categoría de sistema "CONTRATISTA" no encontrada. Contacta al administrador.',
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
          notes: input.notes?.trim() || null,
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
          notes: input.notes?.trim() || null,
          processedByUserId: user.id,
        })
        .returning();

      return payment;
    });

    return {
      success: true,
      message: `Pago de ${formatBOB(amount)} a "${contractor.fullName}" registrado.`,
      transaction: {
        id: payment.uuid,
        amount: formatBOB(amount),
        concept: `${contractor.fullName} — ${concept}`,
        reference: input.receiptNumber || null,
        timestamp: payment.createdAt.toISOString(),
      },
      newBalance: formatBOB(newBalance),
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
