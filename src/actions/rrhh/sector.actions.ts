import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import {
  sectors,
  cashboxes,
  transactions,
  transactionCategories,
  employees,
} from "@/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { formatBOB } from "@/utils/formatters";

const ADMIN_ROLES = ["ADMIN", "ADMON"] as const;

function requireAdmin(role: string | undefined) {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    throw new ActionError({ code: "FORBIDDEN", message: "Acceso denegado." });
  }
}

const sectorBodySchema = z.object({
  name: z.string().min(2, "Nombre requerido").max(100),
  description: z.string().max(500).optional(),
  cashboxId: z.string().uuid("Caja inválida").optional(),
});

// ─── Create Sector ────────────────────────────────────────────────────────────

export const createSectorAction = defineAction({
  accept: "form",
  input: sectorBodySchema,
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [existing] = await db
      .select({ id: sectors.id })
      .from(sectors)
      .where(eq(sectors.name, input.name));

    if (existing) {
      throw new ActionError({
        code: "CONFLICT",
        message: `Ya existe un sector con el nombre "${input.name}".`,
      });
    }

    let targetCashboxId: string | null = null;
    if (input.cashboxId) {
      const [cashbox] = await db
        .select({ id: cashboxes.id, status: cashboxes.status })
        .from(cashboxes)
        .where(eq(cashboxes.id, input.cashboxId))
        .limit(1);

      if (!cashbox) throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada." });
      if (cashbox.status !== "activo") {
        throw new ActionError({ code: "PRECONDITION_FAILED", message: "La caja seleccionada está inactiva." });
      }
      targetCashboxId = cashbox.id;
    } else {
      const [defaultCashbox] = await db
        .select({ id: cashboxes.id })
        .from(cashboxes)
        .where(and(eq(cashboxes.code, "GEN"), eq(cashboxes.status, "activo")))
        .limit(1);

      if (!defaultCashbox) {
        throw new ActionError({
          code: "PRECONDITION_FAILED",
          message: "No existe una caja general activa para crear sectores.",
        });
      }
      targetCashboxId = defaultCashbox.id;
    }

    const [created] = await db
      .insert(sectors)
      .values({
        cashboxId: targetCashboxId,
        name: input.name,
        description: input.description ?? null,
        isActive: true,
      })
      .returning();

    return { success: true, message: "Sector creado correctamente.", sector: created };
  },
});

// ─── Update Sector ────────────────────────────────────────────────────────────

export const updateSectorAction = defineAction({
  accept: "form",
  input: sectorBodySchema.extend({
    id: z.coerce.number().int().positive("ID requerido"),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const { id, cashboxId, name, description } = input;

    const [existing] = await db
      .select({ id: sectors.id })
      .from(sectors)
      .where(eq(sectors.id, id));

    if (!existing) throw new ActionError({ code: "NOT_FOUND", message: "Sector no encontrado." });

    if (cashboxId) {
      const [cashbox] = await db
        .select({ id: cashboxes.id, status: cashboxes.status })
        .from(cashboxes)
        .where(eq(cashboxes.id, cashboxId))
        .limit(1);

      if (!cashbox) throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada." });
      if (cashbox.status !== "activo") {
        throw new ActionError({ code: "PRECONDITION_FAILED", message: "La caja seleccionada está inactiva." });
      }
    }

    const payload: Record<string, any> = {
      name,
      description: description ?? null,
      updatedAt: new Date(),
    };
    if (cashboxId) payload.cashboxId = cashboxId;

    const [updated] = await db
      .update(sectors)
      .set(payload)
      .where(eq(sectors.id, id))
      .returning();

    return { success: true, message: "Sector actualizado.", sector: updated };
  },
});

// ─── Link Sector -> Cashbox ───────────────────────────────────────────────────

export const linkSectorCashboxAction = defineAction({
  accept: "form",
  input: z.object({
    sectorId: z.coerce.number().int().positive("Sector requerido"),
    cashboxId: z.string().uuid("Caja inválida"),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [sector] = await db
      .select({ id: sectors.id, name: sectors.name })
      .from(sectors)
      .where(eq(sectors.id, input.sectorId))
      .limit(1);

    if (!sector) throw new ActionError({ code: "NOT_FOUND", message: "Sector no encontrado." });

    const [cashbox] = await db
      .select({ id: cashboxes.id, name: cashboxes.name, status: cashboxes.status })
      .from(cashboxes)
      .where(eq(cashboxes.id, input.cashboxId))
      .limit(1);

    if (!cashbox) throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada." });
    if (cashbox.status !== "activo") {
      throw new ActionError({ code: "PRECONDITION_FAILED", message: "La caja seleccionada está inactiva." });
    }

    const [updated] = await db
      .update(sectors)
      .set({ cashboxId: cashbox.id, updatedAt: new Date() })
      .where(eq(sectors.id, sector.id))
      .returning();

    return {
      success: true,
      message: `Caja "${cashbox.name}" asignada a "${sector.name}".`,
      sector: updated,
    };
  },
});

export const unlinkSectorCashboxAction = defineAction({
  accept: "form",
  input: z.object({
    sectorId: z.coerce.number().int().positive("Sector requerido"),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [sector] = await db
      .select({ id: sectors.id, name: sectors.name })
      .from(sectors)
      .where(eq(sectors.id, input.sectorId))
      .limit(1);

    if (!sector) {
      throw new ActionError({ code: "NOT_FOUND", message: "Sector no encontrado." });
    }

    const [updated] = await db
      .update(sectors)
      .set({ cashboxId: null, updatedAt: new Date() })
      .where(eq(sectors.id, sector.id))
      .returning();

    return {
      success: true,
      message: `Sector "${sector.name}" desvinculado de su caja.`,
      sector: updated,
    };
  },
});

export const deleteSectorAction = defineAction({
  accept: "form",
  input: z.object({ id: z.coerce.number().int().positive() }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    // Guard: refuse if employees are still assigned
    const [empCheck] = await db
      .select({ count: count(employees.id) })
      .from(employees)
      .where(eq(employees.sectorId, input.id));

    if (Number(empCheck?.count ?? 0) > 0) {
      throw new ActionError({
        code: "CONFLICT",
        message: "Reasigne el personal antes de eliminar el sector.",
      });
    }

    const [deleted] = await db
      .delete(sectors)
      .where(eq(sectors.id, input.id))
      .returning({ name: sectors.name });

    if (!deleted) throw new ActionError({ code: "NOT_FOUND", message: "Sector no encontrado." });

    return { success: true, message: `Sector "${deleted.name}" eliminado.` };
  },
});

// ─── Deactivate Sector ────────────────────────────────────────────────────────

export const deactivateSectorAction = defineAction({
  accept: "form",
  input: z.object({ id: z.coerce.number().int().positive() }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [existing] = await db
      .select({ id: sectors.id, name: sectors.name })
      .from(sectors)
      .where(eq(sectors.id, input.id));

    if (!existing) throw new ActionError({ code: "NOT_FOUND", message: "Sector no encontrado." });

    await db
      .update(sectors)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(sectors.id, input.id));

    return { success: true, message: `Sector "${existing.name}" desactivado.` };
  },
});

// ─── Deposit to Cashbox ───────────────────────────────────────────────────────
// Deposits directly into a cashbox by cashboxId.
// The cashbox is the wallet — sectors are just groupings of employees within it.

export const depositToCashboxAction = defineAction({
  accept: "form",
  input: z.object({
    cashboxId: z.uuid("Caja inválida"),
    categoryId: z.uuid("Categoría inválida"),
    amount: z.coerce
      .number()
      .min(0.01, "El monto debe ser mayor a 0")
      .max(999_999_999, "Monto fuera de rango"),
    concept: z.string().min(1, "Concepto requerido").max(255),
    reference: z.string().max(100).optional(),
    externalReference: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    // 1. Validate category — must be active income type
    const [category] = await db
      .select({
        id: transactionCategories.id,
        name: transactionCategories.name,
        type: transactionCategories.type,
      })
      .from(transactionCategories)
      .where(
        and(
          eq(transactionCategories.id, input.categoryId),
          eq(transactionCategories.status, true),
        )
      );

    if (!category) {
      throw new ActionError({ code: "NOT_FOUND", message: "Categoría no encontrada." });
    }
    if (category.type !== "income") {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Solo se pueden usar cuentas de ingreso para depositar.",
      });
    }

    // 2. Validate cashbox
    const [cashbox] = await db
      .select({
        id: cashboxes.id,
        name: cashboxes.name,
        balance: cashboxes.balance,
        status: cashboxes.status,
      })
      .from(cashboxes)
      .where(eq(cashboxes.id, input.cashboxId))
      .limit(1);

    if (!cashbox) {
      throw new ActionError({ code: "NOT_FOUND", message: "Caja no encontrada." });
    }
    if (cashbox.status !== "activo") {
      throw new ActionError({
        code: "PRECONDITION_FAILED",
        message: `La caja "${cashbox.name}" está inactiva.`,
      });
    }

    const amountStr = input.amount.toFixed(2);
    const newBalance = (Number(cashbox.balance ?? 0) + input.amount).toFixed(2);

    // 3. Atomically update balance + insert transaction
    await db.transaction(async (tx) => {
      await tx
        .update(cashboxes)
        .set({
          balance: sql`${cashboxes.balance} + ${amountStr}`,
          updatedAt: new Date(),
        })
        .where(eq(cashboxes.id, cashbox.id));

      await tx.insert(transactions).values({
        cashboxId: cashbox.id,
        categoryId: input.categoryId,
        type: "deposit",
        amount: amountStr,
        concept: input.concept,
        metadata: input.notes?.trim() ? JSON.stringify({ note: input.notes.trim() }) : null,
        externalReference: input.reference?.trim() || input.externalReference?.trim() || null,
        createdByUserId: user.id,
        status: "completado",
        balanceAfter: newBalance,
      });
    });

    return {
      success: true,
      message: `Bs ${formatBOB(input.amount)} depositados en "${cashbox.name}".`,
      cashboxName: cashbox.name,
      newBalance,
    };
  },
});

// ─── Barrel ───────────────────────────────────────────────────────────────────

export const sectorActions = {
  createSector: createSectorAction,
  updateSector: updateSectorAction,
  linkSectorCashbox: linkSectorCashboxAction,
  unlinkSectorCashbox: unlinkSectorCashboxAction,
  deactivateSector: deactivateSectorAction,
  deleteSector:     deleteSectorAction,
  depositToCashbox: depositToCashboxAction,
};
