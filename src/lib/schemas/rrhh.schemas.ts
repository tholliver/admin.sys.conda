/**
 * Zod validation schemas for the RRHH (employees) module.
 * Import these in Astro actions and API routes.
 */

import { z } from "zod";

// ── Re-usable primitives ──────────────────────────────────────────────────────

const ciSchema = z
  .string()
  .min(5, "CI debe tener al menos 5 caracteres")
  .max(20, "CI demasiado largo")
  .regex(/^[0-9A-Za-z\-]+$/, "CI inválido");

const nameSchema = z
  .string()
  .min(2, "Muy corto")
  .max(100, "Demasiado largo")
  .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'\-]+$/, "Solo letras y espacios");

const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato de periodo inválido (YYYY-MM)");

const salarySchema = z
  .number({ message: "Salario requerido" })
  .positive("El salario debe ser mayor a 0")
  .max(999_999.99, "Salario fuera de rango");

// ── Employee ──────────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  ci: ciSchema,
  ciCity: z.string().max(5).optional(),
  fullName: nameSchema,
  phone: z
    .string()
    .max(20)
    .regex(/^[\d\s\+\-\(\)]+$/, "Teléfono inválido")
    .optional(),
  address: z.string().max(200).optional(),
  employeeType: z.enum(["directorio", "planta"], {
    message: "Tipo de personal inválido",
  }),
  chargeTitle: z
    .string()
    .min(2, "Cargo requerido")
    .max(120, "Cargo demasiado largo"),
  sectorId: z.coerce
    .number()
    .int()
    .min(0, "Sector inválido"),
  hireDate: z.coerce.date({ message: "Fecha de ingreso requerida" }),
  baseSalary: z.coerce.number().pipe(salarySchema),
  status: z
    .enum(["activo", "suspendido", "baja", "licencia"])
    .default("activo"),
  notes: z.string().max(1000).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema
  .extend({
    id: z.coerce.number().int().positive(),
    terminationDate: z.coerce.date().optional().nullable(),
  })
  .partial()
  .required({ id: true });

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ── Employee Fee ──────────────────────────────────────────────────────────────

export const createEmployeeFeeSchema = z.object({
  employeeId: z
    .coerce
    .number()
    .int()
    .positive("Miembro del personal requerido"),
  period: periodSchema,
  amount: z.coerce.number().pipe(salarySchema),
  cashboxId: z.string().uuid("Caja inválida"),
  dueDate: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateEmployeeFeeInput = z.infer<typeof createEmployeeFeeSchema>;

/** Bulk-generate fees for all active employees in a given period */
export const bulkGenerateFeesSchema = z.object({
  period: periodSchema,
  sectorId: z.coerce.number().int().positive().optional(), // null = all sectors
  overwrite: z.boolean().default(false),
});

export type BulkGenerateFeesInput = z.infer<typeof bulkGenerateFeesSchema>;

// ── Fee Payment ───────────────────────────────────────────────────────────────

export const payEmployeeFeeSchema = z.object({
  feeId: z.coerce.number().int().positive("Fee requerido"),
  amountPaid: z.coerce.number().pipe(salarySchema),
  paymentMethod: z
    .enum(["efectivo", "transferencia", "cheque"])
    .default("efectivo"),
  cashboxId: z.string().uuid("Caja inválida").optional(),
  receiptNumber: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
  createTransaction: z.boolean().default(true), // auto-create finance.transaction
});

export type PayEmployeeFeeInput = z.infer<typeof payEmployeeFeeSchema>;

// ── Query/filter schemas ──────────────────────────────────────────────────────

export const employeeFiltersSchema = z.object({
  type: z.enum(["directorio", "planta", "all"]).default("all"),
  sectorId: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  status: z
    .enum(["activo", "suspendido", "baja", "licencia", "all"])
    .default("all"),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type EmployeeFilters = z.infer<typeof employeeFiltersSchema>;

export const feeFiltersSchema = z.object({
  period: periodSchema.optional(),
  sectorId: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  status: z
    .enum(["pendiente", "pagado", "parcial", "anulado", "all"])
    .default("all"),
  employeeType: z.enum(["directorio", "planta", "all"]).default("all"),
});

export type FeeFilters = z.infer<typeof feeFiltersSchema>;
