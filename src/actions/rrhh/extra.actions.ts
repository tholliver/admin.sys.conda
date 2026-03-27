/**
 * Astro Actions — RRHH delete + Inquilinos module
 * Register in src/actions/index.ts
 */

import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { tenants, tenantPayments } from "@/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_ROLES = ["ADMIN"] as const;

function requireAdmin(role: string | undefined) {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    throw new ActionError({ code: "FORBIDDEN", message: "Acceso denegado." });
  }
}

// ─── RRHH: Delete Employee ────────────────────────────────────────────────────

export const deleteEmployee = defineAction({
  accept: "form",
  input: z.object({ id: z.coerce.number().int().positive() }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const [existing] = await db
      .select({ id: employees.id, status: employees.status })
      .from(employees)
      .where(eq(employees.id, input.id));

    if (!existing) {
      throw new ActionError({ code: "NOT_FOUND", message: "Empleado no encontrado." });
    }

    // Soft delete: mark as baja
    await db
      .update(employees)
      .set({ status: "baja" })
      .where(eq(employees.id, input.id));

    return { success: true, message: "Empleado dado de baja correctamente." };
  },
});

// ─── Inquilinos: Create Tenant ────────────────────────────────────────────────

const createTenantSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  ci: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  roomNumber: z.string().min(1, "N° de ambiente requerido"),
  floor: z.string().optional(),
  description: z.string().optional(),
  monthlyRent: z.coerce.number().min(0, "Monto inválido"),
  currency: z.enum(["BOB", "USD"]).default("BOB"),
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

    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.roomNumber, input.roomNumber));

    if (existing) {
      throw new ActionError({
        code: "CONFLICT",
        message: `El ambiente ${input.roomNumber} ya está asignado a otro inquilino activo.`,
      });
    }

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: input.name,
        ci: input.ci || null,
        phone: input.phone || null,
        email: input.email || null,
        roomNumber: input.roomNumber,
        floor: input.floor || null,
        description: input.description || null,
        monthlyRent: input.monthlyRent,
        currency: input.currency,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        notes: input.notes || null,
        createdByUserId: user.id,
      })
      .returning();

    return { success: true, message: "Inquilino registrado correctamente.", tenant };
  },
});

// ─── Inquilinos: Delete Tenant ────────────────────────────────────────────────

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

    // Soft delete: mark inactive
    await db.update(tenants).set({ status: "inactivo" }).where(eq(tenants.id, input.id));

    return { success: true, message: "Inquilino eliminado correctamente." };
  },
});

// ─── Inquilinos: Register Rent Payment ────────────────────────────────────────

export const registerRentPayment = defineAction({
  accept: "form",
  input: z.object({
    tenantId: z.coerce.number().int().positive(),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    amount: z.coerce.number().min(0),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    // Upsert payment record
    await db
      .insert(tenantPayments)
      .values({
        tenantId: input.tenantId,
        period: input.period,
        amount: input.amount,
        status: "pagado",
        paidAt: new Date(),
        processedByUserId: user.id,
      })
      .onConflictDoUpdate({
        target: [tenantPayments.tenantId, tenantPayments.period],
        set: { status: "pagado", paidAt: new Date(), processedByUserId: user.id },
      });

    return { success: true, message: "Pago registrado correctamente." };
  },
});

// Export as inquilinos namespace
export const inquilinos = {
  createTenant,
  deleteTenant,
  registerRentPayment,
};

// Export rrhh additions
export const rrhhExtra = {
  deleteEmployee,
};
