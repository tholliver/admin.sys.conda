/**
 * Astro Actions — RRHH module
 * ──────────────────────────────────────────────────────────────────────────────
 * Register these inside your main src/actions/index.ts:
 *
 *   import { rrhh } from './rrhh'
 *   export const server = { ..., rrhh }
 */

import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import {
  createEmployee,
  updateEmployee,
  createEmployeeFee,
  bulkGenerateFees,
  payEmployeeFee,
} from "@/services/rrhh/rrhh.service";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  createEmployeeFeeSchema,
  bulkGenerateFeesSchema,
  payEmployeeFeeSchema,
} from "@/lib/schemas/rrhh.schemas";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_ROLES = ["ADMIN", "ADMON"] as const;

function requireAdmin(role: string | undefined) {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    throw new ActionError({ code: "FORBIDDEN", message: "Acceso denegado." });
  }
}

// ─── Employee CRUD ────────────────────────────────────────────────────────────

export const createEmployeeAction = defineAction({
  accept: "form",
  input: createEmployeeSchema,
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    try {
      const employee = await createEmployee(input, user.id);
      return {
        success: true,
        message: "Miembro del personal registrado.",
        employee,
      };
    } catch (err: any) {
      throw new ActionError({ code: "CONFLICT", message: err.message });
    }
  },
});

export const updateEmployeeAction = defineAction({
  accept: "form",
  input: updateEmployeeSchema,
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    try {
      const employee = await updateEmployee(input);
      return {
        success: true,
        message: "Miembro del personal actualizado.",
        employee,
      };
    } catch (err: any) {
      throw new ActionError({ code: "CONFLICT", message: err.message });
    }
  },
});

export const terminateEmployeeAction = defineAction({
  accept: "form",
  input: z.object({
    id: z.coerce.number().int().positive(),
    terminationDate: z.coerce.date(),
    notes: z.string().max(500).optional(),
  }),
  handler: async ({ id, terminationDate, notes }, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    await db
      .update(employees)
      .set({ status: "baja", terminationDate, notes, updatedAt: new Date() })
      .where(eq(employees.id, id));

    return { success: true, message: "Miembro del personal dado de baja." };
  },
});

// ─── Fee Actions ──────────────────────────────────────────────────────────────

export const createEmployeeFeeAction = defineAction({
  accept: "form",
  input: createEmployeeFeeSchema,
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    try {
      const fee = await createEmployeeFee(input);
      return { success: true, message: "Cuota creada.", fee };
    } catch (err: any) {
      throw new ActionError({ code: "CONFLICT", message: err.message });
    }
  },
});

export const bulkGenerateFeesAction = defineAction({
  accept: "form",
  input: bulkGenerateFeesSchema,
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const result = await bulkGenerateFees(input);
    const skipped =
      (result.skippedDuplicate ?? 0) + (result.skippedNoCashbox ?? 0);
    return {
      success: true,
      message: `${result.created} cuotas generadas. ${skipped} omitidas.`,
      ...result,
    };
  },
});

export const payEmployeeFeeAction = defineAction({
  accept: "form",
  input: payEmployeeFeeSchema,
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    try {
      const payment = await payEmployeeFee(input, user.id);
      return { success: true, message: "Pago registrado.", payment };
    } catch (err: any) {
      throw new ActionError({ code: "CONFLICT", message: err.message });
    }
  },
});

export const voidEmployeeFeeAction = defineAction({
  accept: "form",
  input: z.object({
    feeId: z.coerce.number().int().positive(),
    reason: z.string().max(300).optional(),
  }),
  handler: async ({ feeId, reason }, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
    requireAdmin(user.role);

    const { employeeFees } = await import("@/db/schema");

    await db
      .update(employeeFees)
      .set({ status: "anulado", notes: reason, updatedAt: new Date() })
      .where(eq(employeeFees.id, feeId));

    return { success: true, message: "Cuota anulada." };
  },
});

// ─── Barrel export for src/actions/index.ts ───────────────────────────────────

export const rrhh = {
  createEmployee: createEmployeeAction,
  updateEmployee: updateEmployeeAction,
  terminateEmployee: terminateEmployeeAction,
  createEmployeeFee: createEmployeeFeeAction,
  bulkGenerateFees: bulkGenerateFeesAction,
  payEmployeeFee: payEmployeeFeeAction,
  voidEmployeeFee: voidEmployeeFeeAction,
};
