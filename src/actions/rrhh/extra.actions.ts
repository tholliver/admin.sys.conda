import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import { tenants, tenantPayments, transactions, transactionCategories, cashboxes, employees } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const ADMIN_ROLES = ["ADMIN", "ADMON"] as const;

function requireAdmin(role: string | undefined) {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    throw new ActionError({ code: "FORBIDDEN", message: "Acceso denegado." });
  }
}

// ─── RRHH: Soft-delete Employee ───────────────────────────────────────────────

export const deleteEmployee = defineAction({
  accept: "form",
  input: z.object({ id: z.coerce.number().int().positive() }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [existing] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, input.id));

    if (!existing) {
      throw new ActionError({
        code: "NOT_FOUND",
        message: "Miembro del personal no encontrado.",
      });
    }

    await db
      .update(employees)
      .set({ status: "baja", updatedAt: new Date() })
      .where(eq(employees.id, input.id));

    return {
      success: true,
      message: "Miembro del personal dado de baja correctamente.",
    };
  },
});

// ─── Inquilinos: Create Tenant (no currency — always BOB) ────────────────────

const createTenantSchema = z.object({
  fullName: z.string().min(2, "Nombre requerido"),
  ci: z.string().optional(),
  phone: z.string().optional(),
  email: z.email("Correo inválido").optional().or(z.literal("")),
  roomNumber: z.string().min(1, "N° de ambiente requerido"),
  floor: z.string().optional(),
  description: z.string().optional(),
  monthlyRent: z.coerce.number().min(1, "Monto debe ser mayor a 0"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const createTenant = defineAction({
  accept: "form",
  input: createTenantSchema,
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    // Check room not already occupied by active tenant
    const [existing] = await db
      .select({ id: tenants.id, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.roomNumber, input.roomNumber));

    if (existing && existing.status === "activo") {
      throw new ActionError({
        code: "CONFLICT",
        message: `El ambiente ${input.roomNumber} ya está ocupado por un inquilino activo.`,
      });
    }

    const [tenant] = await db
      .insert(tenants)
      .values({
        fullName: input.fullName,
        ci: input.ci || null,
        phone: input.phone || null,
        email: input.email || null,
        roomNumber: input.roomNumber,
        floor: input.floor || null,
        description: input.description || null,
        monthlyRent: input.monthlyRent,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        notes: input.notes || null,
        createdByUserId: user.id,
      })
      .returning();

    return { success: true, message: "Inquilino registrado correctamente.", tenant };
  },
});

// ─── Inquilinos: Delete Tenant (soft) ────────────────────────────────────────

export const deleteTenant = defineAction({
  accept: "form",
  input: z.object({ id: z.coerce.number().int().positive() }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, input.id));

    if (!existing) {
      throw new ActionError({ code: "NOT_FOUND", message: "Inquilino no encontrado." });
    }

    await db
      .update(tenants)
      .set({ status: "inactivo", updatedAt: new Date() })
      .where(eq(tenants.id, input.id));

    return { success: true, message: "Inquilino desactivado correctamente." };
  },
});

// ─── Inquilinos: Register Rent Payment ───────────────────────────────────────

export const registerRentPayment = defineAction({
  accept: "form",
  input: z.object({
    tenantId: z.coerce.number().int().positive(),
    tenantName: z.string().min(1),
    period: z.string().regex(/^\d{4}-\d{2}$/, "Período inválido"),
    amount: z.coerce.number().min(0),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [rentCategory] = await db
      .select({ id: transactionCategories.id })
      .from(transactionCategories)
      .where(eq(transactionCategories.code, "INC-005"));

    if (!rentCategory) {
      throw new ActionError({
        code: "NOT_FOUND",
        message: "Categoría INC-005 no encontrada.",
      });
    }

    const [genCashbox] = await db
      .select({ id: cashboxes.id, balance: cashboxes.balance })
      .from(cashboxes)
      .where(eq(cashboxes.code, "GEN"));

    if (!genCashbox) {
      throw new ActionError({
        code: "NOT_FOUND",
        message: "Caja GEN no encontrada.",
      });
    }

    const amountStr = input.amount.toFixed(2);
    const newBalance = (Number(genCashbox.balance) + input.amount).toFixed(2);

    await db.transaction(async (tx) => {
      const [financeTx] = await tx
        .insert(transactions)
        .values({
          cashboxId: genCashbox.id,
          categoryId: rentCategory.id,
          type: "deposit",
          amount: amountStr,
          concept: `Alquiler ${input.period} — ${input.tenantName}`,
          description: `Pago de alquiler período ${input.period}`,
          createdByUserId: user.id,
          status: "completado",
          balanceAfter: newBalance,
          linkedEntityType: "tenant_payment",
          linkedEntityId: input.tenantId,
        })
        .returning({ id: transactions.id });

      await tx
        .update(cashboxes)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(cashboxes.id, genCashbox.id));

      await tx
        .insert(tenantPayments)
        .values({
          tenantId: input.tenantId,
          period: input.period,
          amount: input.amount,
          status: "pagado",
          notes: `Pago registrado — ${input.tenantName}`,
          transactionId: financeTx.id,
        })
        .onConflictDoUpdate({
          target: [tenantPayments.tenantId, tenantPayments.period],
          set: {
            status: "pagado",
            notes: `Pago registrado — ${input.tenantName}`,
            transactionId: financeTx.id,
            updatedAt: new Date(),
          },
        });
    });

    return { success: true, message: `Pago de ${input.tenantName} registrado.` };
  },
});

// ─── Inquilinos: Create pending rent obligation (no payment yet) ──────────────
// Used by the audit page to register a missing month debt without paying it.

export const createPendingRent = defineAction({
  accept: "form",
  input: z.object({
    tenantId: z.coerce.number().int().positive(),
    period: z.string().regex(/^\d{4}-\d{2}$/, "Período inválido"),
    amount: z.coerce.number().min(0),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [existing] = await db
      .select({ id: tenantPayments.id })
      .from(tenantPayments)
      .where(
      and(
        eq(tenantPayments.tenantId, input.tenantId),
        eq(tenantPayments.period, input.period)
      )
      );

    if (existing) {
      throw new ActionError({
        code: "CONFLICT",
        message: `Ya existe un registro para este inquilino en ${input.period}.`,
      });
    }

    await db.insert(tenantPayments).values({
      tenantId: input.tenantId,
      period: input.period,
      amount: input.amount,
      status: "pendiente",
    });

    return { success: true, message: `Deuda de alquiler ${input.period} registrada como pendiente.` };
  },
});

// ─── Namespace exports ────────────────────────────────────────────────────────

export const inquilinos = {
  createTenant,
  deleteTenant,
  registerRentPayment,
  createPendingRent,
};

export const rrhhExtra = {
  deleteEmployee,
};

// Add createCashbox to your finance actions namespace:
// export const finance = { ...existingFinanceActions, createCashbox }
// export { createCashbox };
