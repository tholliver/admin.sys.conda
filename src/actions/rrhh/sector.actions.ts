/**
 * Sector CRUD + Cashbox Deposit Actions
 * ─────────────────────────────────────────────────────────────
 * PR: feat/sector-economy-management
 *
 * New actions:
 *  createSector             — create sector with fee config
 *  updateSector             — edit name / description / fee amounts
 *  deactivateSector         — soft-disable (isActive = false)
 *  depositToSectorCashbox   — deposit into the linked sector cashbox,
 *                             records a finance.transaction for full audit trail
 *
 * Register in src/actions/index.ts:
 *   import { sectorActions } from "@/actions/rrhh/sector.actions";
 *   export const server = { finance, inquilinos, rrhh, rrhhExtra, sector: sectorActions };
 */

import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import {
  sectors,
  cashboxes,
  sectorCashboxLink,
  transactions,
  transactionCategories,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { Currency } from "@/lib/schemas/currency.schemas";

const ADMIN_ROLES = ["ADMIN", "ADMON"] as const;

function requireAdmin(role: string | undefined) {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    throw new ActionError({ code: "FORBIDDEN", message: "Acceso denegado." });
  }
}

// ─── Shared schema ────────────────────────────────────────────────────────────

const feeAmountSchema = z.coerce
  .number()
  .min(0, "El monto no puede ser negativo")
  .max(999_999_999, "Monto fuera de rango");

const sectorBodySchema = z.object({
  name: z.string().min(2, "Nombre requerido").max(100),
  description: z.string().max(500).optional(),
  feeAmount: feeAmountSchema,
  feeCurrency: z.enum(Currency).default(Currency.BOB),
  monthlyFeeAmount: feeAmountSchema,
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

    const [created] = await db
      .insert(sectors)
      .values({
        name: input.name,
        description: input.description ?? null,
        feeAmount: input.feeAmount,
        feeCurrency: input.feeCurrency,
        monthlyFeeAmount: input.monthlyFeeAmount,
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

    const { id, ...rest } = input;

    const [existing] = await db
      .select({ id: sectors.id })
      .from(sectors)
      .where(eq(sectors.id, id));

    if (!existing) {
      throw new ActionError({ code: "NOT_FOUND", message: "Sector no encontrado." });
    }

    const [updated] = await db
      .update(sectors)
      .set({ ...rest })
      .where(eq(sectors.id, id))
      .returning();

    return { success: true, message: "Sector actualizado.", sector: updated };
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

    if (!existing) {
      throw new ActionError({ code: "NOT_FOUND", message: "Sector no encontrado." });
    }

    await db
      .update(sectors)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(sectors.id, input.id));

    return { success: true, message: `Sector "${existing.name}" desactivado.` };
  },
});

// ─── Deposit to Sector Cashbox ────────────────────────────────────────────────
/**
 * Missing flow on /rrhh/sectores:
 *
 * The page showed salary coverage going red when balance < monthlySalary,
 * but there was no way to top up the sector cashbox from that context.
 * Admins had to navigate to /cuentas, find the right cashbox manually, and
 * deposit from there — error-prone and slow.
 *
 * This action wires a direct deposit from the sector card, and records
 * a proper finance.transaction entry for the full audit trail, matching
 * the existing deposit action pattern in src/actions/finance/index.ts.
 *
 * NOTE: `linkedEntityType: "sector"` requires that value exists in the
 * `linked_entity_type` enum. If it doesn't, add it in a migration:
 *   ALTER TYPE linked_entity_type ADD VALUE 'sector';
 * Or omit the linkedEntityType/Id fields if you skip the polymorphic link.
 */

export const depositToSectorCashboxAction = defineAction({
  accept: "form",
  input: z.object({
    sectorId: z.coerce.number().int().positive("Sector requerido"),
    categoryId: z.string().uuid("Categoría inválida"),
    amount: z.coerce
      .number()
      .min(0.01, "El monto debe ser mayor a 0")
      .max(999_999_999, "Monto fuera de rango"),
    currency: z.enum(["BOB", "USD"]).default("BOB"),
    concept: z.string().min(1, "Concepto requerido").max(255),
    reference: z.string().max(100).optional(),
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
        message: "Solo se pueden usar categorías de ingreso para depositar.",
      });
    }

    // 2. Resolve sector → sectorCashboxLink → cashbox
    const [link] = await db
      .select({
        cashboxId: sectorCashboxLink.cashboxId,
        cashboxName: cashboxes.name,
        cashboxBalance: cashboxes.balance,
        cashboxStatus: cashboxes.status,
        linkActive: sectorCashboxLink.isActive,
        sectorName: sectors.name,
      })
      .from(sectorCashboxLink)
      .innerJoin(cashboxes, eq(cashboxes.id, sectorCashboxLink.cashboxId))
      .innerJoin(sectors, eq(sectors.id, sectorCashboxLink.sectorId))
      .where(eq(sectorCashboxLink.sectorId, input.sectorId));

    if (!link) {
      throw new ActionError({
        code: "NOT_FOUND",
        message: "Este sector no tiene una caja vinculada.",
      });
    }

    if (!link.linkActive || link.cashboxStatus !== "active") {
      throw new ActionError({
        code: "PRECONDITION_FAILED",
        message: `La caja vinculada al sector "${link.sectorName}" está inactiva.`,
      });
    }

    const amountStr = input.amount.toFixed(2);
    const newBalance = (Number(link.cashboxBalance ?? 0) + input.amount).toFixed(2);

    // 3. Atomically update balance + insert transaction record
    await db.transaction(async (tx) => {
      await tx
        .update(cashboxes)
        .set({
          balance: sql`${cashboxes.balance} + ${amountStr}`,
          updatedAt: new Date(),
        })
        .where(eq(cashboxes.id, link.cashboxId));

      await tx.insert(transactions).values({
        cashboxId: link.cashboxId,
        categoryId: input.categoryId,
        type: "deposit",
        amount: amountStr,
        concept: input.concept,
        description: input.notes?.trim() || null,
        reference: input.reference?.trim() || null,
        createdByUserId: user.id,
        status: "completed",
        balanceAfter: newBalance,
        linkedEntityType: "sector",
        linkedEntityId: input.sectorId,
      });
    });

    return {
      success: true,
      message: `Bs ${input.amount.toLocaleString("es-BO", { minimumFractionDigits: 2 })} depositados en "${link.cashboxName}".`,
      cashboxName: link.cashboxName,
      newBalance,
    };
  },
});

// ─── Barrel ───────────────────────────────────────────────────────────────────

export const sectorActions = {
  createSector: createSectorAction,
  updateSector: updateSectorAction,
  deactivateSector: deactivateSectorAction,
  depositToSectorCashbox: depositToSectorCashboxAction,
};
