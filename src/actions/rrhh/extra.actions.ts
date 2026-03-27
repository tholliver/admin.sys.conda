/**
 * Astro Actions — RRHH extra + Inquilinos + Finance extras
 * Register in src/actions/index.ts:
 *
 *   export const server = { rrhh, inquilinos, rrhhExtra, finance: { ...finance, createCashbox } }
 */

import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import { employees, cashboxes } from "@/db/schema";
import { tenants, tenantPayments } from "@/db/schema";
import { eq } from "drizzle-orm";

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
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
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
        currency: "BOB",
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
// notes stores the tenant name for FK traceability

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

    await db
      .insert(tenantPayments)
      .values({
        tenantId: input.tenantId,
        period: input.period,
        amount: input.amount,
        currency: "BOB",
        status: "pagado",
        paidAt: new Date(),
        notes: `Pago registrado — ${input.tenantName}`,
        processedByUserId: user.id,
      })
      .onConflictDoUpdate({
        target: [tenantPayments.tenantId, tenantPayments.period],
        set: {
          status: "pagado",
          paidAt: new Date(),
          notes: `Pago registrado — ${input.tenantName}`,
          processedByUserId: user.id,
          updatedAt: new Date(),
        },
      });

    return { success: true, message: `Pago de ${input.tenantName} registrado.` };
  },
});

// ─── Namespace exports ────────────────────────────────────────────────────────

export const inquilinos = {
  createTenant,
  deleteTenant,
  registerRentPayment,
};

export const rrhhExtra = {
  deleteEmployee,
};

// Add createCashbox to your finance actions namespace:
// export const finance = { ...existingFinanceActions, createCashbox }
// export { createCashbox };
