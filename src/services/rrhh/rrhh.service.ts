/**
 * RRHH Service
 * -------------------------------------------------------------
 * All DB queries and business logic for the employees module.
 * Keeps pages/actions thin � they only call these functions.
 */

import { db } from "@/db";
import {
  sectors,
  cashboxes,
  employees,
  employeeFees,
  employeePayments,
  type SelectEmployee,
  type SelectEmployeeFee,
  type SectorSalarySummary,
  type EmployeeWithFullName,
} from "@/db/schema";
import {
  eq,
  and,
  sql,
  desc,
  asc,
  ilike,
  inArray,
  count,
  sum,
  ne,
} from "drizzle-orm";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  CreateEmployeeFeeInput,
  PayEmployeeFeeInput,
  EmployeeFilters,
  FeeFilters,
  BulkGenerateFeesInput,
} from "@/lib/schemas/rrhh.schemas";

// --- Constants ----------------------------------------------------------------
export const MAX_DIRECTORIO = 200;
export const MAX_PLANTA = 500;

// --- Helpers ------------------------------------------------------------------

export function getEmployeeFullName(e: Pick<SelectEmployee, "fullName">): string {
  return e.fullName;
}

/** Format period "2025-03" ? "Marzo 2025" */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-BO", { month: "long", year: "numeric" });
}

/** Current period as "YYYY-MM" */
export function currentPeriod(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${m}`;
}

// --- Employee Queries ---------------------------------------------------------

export async function getEmployees(filters: EmployeeFilters = {} as EmployeeFilters) {
  const { type = "all", sectorId, status = "all", search, page = 1, pageSize = 20 } = filters;

  const conditions = [];

  if (type !== "all") {
    conditions.push(eq(employees.employeeType, type as any));
  }
  if (status !== "all") {
    conditions.push(eq(employees.status, status as any));
  }
  if (sectorId) {
    conditions.push(eq(employees.sectorId, sectorId));
  }
  if (search) {
    const term = `%${search}%`;
    conditions.push(
      sql`(${ilike(employees.fullName, term)})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        employee: employees,
        sectorName: sectors.name,
      })
      .from(employees)
      .leftJoin(sectors, eq(sectors.id, employees.sectorId))
      .where(where)
      .orderBy(asc(employees.fullName))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ total: count() })
      .from(employees)
      .where(where),
  ]);

  return {
    data: rows.map((r) => ({
      ...r.employee,
      fullName: getEmployeeFullName(r.employee),
      sectorName: r.sectorName ?? "Sin sector",
    })),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.ceil(Number(total) / pageSize),
  };
}

export async function getEmployeeById(id: number) {
  const row = await db
    .select({
      employee: employees,
      sectorName: sectors.name,
    })
    .from(employees)
    .leftJoin(sectors, eq(sectors.id, employees.sectorId))
    .where(eq(employees.id, id))
    .limit(1);

  if (!row[0]) return null;

  return {
    ...row[0].employee,
    fullName: getEmployeeFullName(row[0].employee),
    sectorName: row[0].sectorName ?? "Sin sector",
  };
}

/** Count active employees by type � used to enforce capacity limits */
export async function getEmployeeCountByType() {
  const rows = await db
    .select({
      type: employees.employeeType,
      total: count(),
    })
    .from(employees)
    .where(eq(employees.status, "activo"))
    .groupBy(employees.employeeType);

  const result = { directorio: 0, planta: 0 };
  for (const r of rows) {
    result[r.type] = Number(r.total);
  }
  return result;
}

export async function createEmployee(data: CreateEmployeeInput, createdByUserId: string) {
  // Enforce capacity
  const counts = await getEmployeeCountByType();
  if (data.employeeType === "directorio" && counts.directorio >= MAX_DIRECTORIO) {
    throw new Error(`El directorio ya alcanz� el m�ximo de ${MAX_DIRECTORIO} miembros activos.`);
  }
  if (data.employeeType === "planta" && counts.planta >= MAX_PLANTA) {
    throw new Error(
      `La planta ya alcanz� el m�ximo de ${MAX_PLANTA} miembros del personal activos.`
    );
  }

  const [created] = await db
    .insert(employees)
    .values({
      ...data,
      createdByUserId,
    })
    .returning();

  return created;
}

export async function updateEmployee(data: UpdateEmployeeInput) {
  const { id, ...rest } = data;
  const [updated] = await db
    .update(employees)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(employees.id, id))
    .returning();

  return updated;
}

// --- Fee Queries --------------------------------------------------------------

export async function getFeesWithEmployees(filters: FeeFilters = {} as FeeFilters) {
  const { period, sectorId, status = "all", employeeType = "all" } = filters;

  const conditions = [];

  if (period) conditions.push(eq(employeeFees.period, period));
  if (status !== "all") conditions.push(eq(employeeFees.status, status as any));
  if (sectorId) conditions.push(eq(employees.sectorId, sectorId));
  if (employeeType !== "all") conditions.push(eq(employees.employeeType, employeeType as any));

  const rows = await db
    .select({
      fee: employeeFees,
      employee: employees,
      sectorName: sectors.name,
    })
    .from(employeeFees)
    .innerJoin(employees, eq(employees.id, employeeFees.employeeId))
    .leftJoin(sectors, eq(sectors.id, employees.sectorId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(employees.fullName), asc(employeeFees.period));

  return rows.map((r) => ({
    ...r.fee,
    employee: {
      ...r.employee,
      fullName: getEmployeeFullName(r.employee),
      sectorName: r.sectorName ?? "Sin sector",
    },
  }));
}

export async function getFeeSummaryByPeriod(period: string) {
  const rows = await db
    .select({
      status: employeeFees.status,
      total: count(),
      totalAmount: sum(employeeFees.amount),
    })
    .from(employeeFees)
    .where(eq(employeeFees.period, period))
    .groupBy(employeeFees.status);

  return rows;
}

export async function createEmployeeFee(data: CreateEmployeeFeeInput) {
  // Prevent duplicate fee for same employee+period
  const existing = await db
    .select({ id: employeeFees.id })
    .from(employeeFees)
    .where(
      and(
        eq(employeeFees.employeeId, data.employeeId),
        eq(employeeFees.period, data.period)
      )
    )
    .limit(1);

  if (existing[0]) {
    throw new Error(
      `Ya existe una cuota para este miembro del personal en el per�odo ${data.period}.`
    );
  }

  const [created] = await db
    .insert(employeeFees)
    .values(data)
    .returning();

  return created;
}

/**
 * Bulk-generate fees for all active employees in a period.
 * Uses each employee's baseSalary as the fee amount.
 * Skips employees that already have a fee for the period (unless overwrite=true).
 */

 export async function bulkGenerateFees(data: BulkGenerateFeesInput) {
   const { period, sectorId, overwrite } = data;

   const conditions: any[] = [eq(employees.status, "activo")];
   if (sectorId) conditions.push(eq(employees.sectorId, sectorId));

  const activeEmployees = await db
    .select({
      employee: employees,
      cashboxId: sectors.cashboxId,
    })
    .from(employees)
    .leftJoin(sectors, eq(sectors.id, employees.sectorId))
    .where(and(...conditions));

   if (activeEmployees.length === 0) {
     return { created: 0, skippedDuplicate: 0, skippedNoCashbox: 0, noCashboxEmployees: [], errors: [] };
   }

   // Split: employees with and without a linked cashbox
   const withCashbox = activeEmployees.filter((e) => !!e.cashboxId);
   const noCashbox = activeEmployees.filter((e) => !e.cashboxId);
   const noCashboxEmployees = noCashbox.map((e) => e.employee.fullName);

   // Find existing fees for this period (only among those with a cashbox)
   const existingIds = overwrite
     ? []
     : (
         await db
           .select({ employeeId: employeeFees.employeeId })
           .from(employeeFees)
           .where(
             and(
               eq(employeeFees.period, period),
               inArray(
                 employeeFees.employeeId,
                 withCashbox.map((e) => e.employee.id)
               )
             )
           )
       ).map((r) => r.employeeId);

   const toCreate = withCashbox.filter((e) => !existingIds.includes(e.employee.id));
   const skippedDuplicate = withCashbox.length - toCreate.length;
   const errors: string[] = [];

   if (toCreate.length > 0) {
     const values = toCreate.map(({ employee, cashboxId }) => ({
       employeeId: employee.id,
       period,
       amount: employee.baseSalary,
       currency: "BOB" as const,
       cashboxId: cashboxId!,
       status: "pendiente" as const,
     }));

     await db.insert(employeeFees).values(values).onConflictDoNothing();
   }

   return {
     created: toCreate.length,
     skippedDuplicate,
     skippedNoCashbox: noCashbox.length,
     noCashboxEmployees,
     errors,
   };
 }

// --- Payment ------------------------------------------------------------------

export async function payEmployeeFee(data: PayEmployeeFeeInput, processedByUserId: string) {
  const feeRow = await db
    .select({
      fee: employeeFees,
      employeeSectorId: employees.sectorId,
      employeeName: employees.fullName,
    })
    .from(employeeFees)
    .innerJoin(employees, eq(employees.id, employeeFees.employeeId))
    .where(eq(employeeFees.id, data.feeId))
    .limit(1);

  if (!feeRow[0]) throw new Error("Cuota no encontrada.");

  const { fee, employeeSectorId, employeeName } = feeRow[0];
  if (fee.status === "pagado") throw new Error("Esta cuota ya fue pagada.");

  const amountToPay = Number(data.amountPaid);
  if (!Number.isFinite(amountToPay) || amountToPay <= 0) {
    throw new Error("El monto de pago es inv�lido.");
  }

  // Resolve cashbox by sector (direct FK on sectors)
  let resolvedCashbox: { id: string; name: string; balance: string | null; status: string | null };

  const linked = await db
    .select({
      id: cashboxes.id,
      name: cashboxes.name,
      balance: cashboxes.balance,
      status: cashboxes.status,
    })
    .from(sectors)
    .innerJoin(cashboxes, eq(cashboxes.id, sectors.cashboxId))
    .where(eq(sectors.id, employeeSectorId))
    .limit(1);

  if (!linked[0]) {
    if (employeeSectorId === 0) {
      const general = await db
        .select({
          id: cashboxes.id,
          name: cashboxes.name,
          balance: cashboxes.balance,
          status: cashboxes.status,
        })
        .from(cashboxes)
        .where(and(eq(cashboxes.code, "GEN"), eq(cashboxes.status, "active")))
        .limit(1);

      if (!general[0]) {
        throw new Error(
          'No existe una caja general activa con c??digo "GEN" para el sector SIN SECTOR.'
        );
      }

      resolvedCashbox = general[0];
    } else {
      throw new Error(
        `El sector del empleado "${employeeName}" no tiene una caja vinculada.`
      );
    }
  } else {
    if (linked[0].status !== "active") {
      throw new Error(
        `La caja vinculada al sector del empleado "${employeeName}" est?? inactiva.`
      );
    }

    resolvedCashbox = linked[0];
  }

  const availableBalance = Number(resolvedCashbox.balance ?? 0);
  if (availableBalance < amountToPay) {
    throw new Error(
      `Saldo insuficiente en "${resolvedCashbox.name}". Disponible: Bs ${availableBalance.toFixed(2)}.`
    );
  }

  const [payment] = await db.transaction(async (tx) => {
    const [createdPayment] = await tx
      .insert(employeePayments)
      .values({
        employeeId: fee.employeeId,
        feeId: data.feeId,
        amountPaid: data.amountPaid,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        cashboxId: resolvedCashbox.id,
        receiptNumber: data.receiptNumber,
        notes: data.notes,
        processedByUserId,
      })
      .returning();

    const paidFully = amountToPay >= Number(fee.amount);
    await tx
      .update(employeeFees)
      .set({
        status: paidFully ? "pagado" : "parcial",
        paidAt: paidFully ? new Date() : null,
        updatedAt: new Date(),
        cashboxId: resolvedCashbox.id,
      })
      .where(eq(employeeFees.id, data.feeId));

    await tx
      .update(cashboxes)
      .set({
        balance: sql`${cashboxes.balance} - ${String(amountToPay)}`,
        updatedAt: new Date(),
      })
      .where(eq(cashboxes.id, resolvedCashbox.id));

    return [createdPayment];
  });

  return payment;
}

// --- Sector Cashbox -----------------------------------------------------------

export async function getSectorCashboxLinks() {
  return db
    .select({
      sectorId: sectors.id,
      sectorName: sectors.name,
      sectorIsActive: sectors.isActive,
      cashboxId: sectors.cashboxId,
      cashboxName: cashboxes.name,
      cashboxBalance: cashboxes.balance,
      cashboxStatus: cashboxes.status,
    })
    .from(sectors)
    .leftJoin(cashboxes, eq(cashboxes.id, sectors.cashboxId))
    .orderBy(asc(sectors.name));
}

export async function getSectorSalarySummary(): Promise<SectorSalarySummary[]> {
  const rows = await db
    .select({
      sectorId: sectors.id,
      sectorName: sectors.name,
      cashboxId: sectors.cashboxId,
      cashboxBalance: cashboxes.balance,
      totalEmployees: count(employees.id),
      totalMonthlySalary: sum(employees.baseSalary),
    })
    .from(sectors)
    .leftJoin(cashboxes, eq(cashboxes.id, sectors.cashboxId))
    .leftJoin(
      employees,
      and(eq(employees.sectorId, sectors.id), eq(employees.status, "activo"))
    )
    .groupBy(
      sectors.id,
      sectors.name,
      sectors.cashboxId,
      cashboxes.balance
    )
    .orderBy(asc(sectors.name));

  // Get pending fees counts per sector
  const pendingRows = await db
    .select({
      sectorId: employees.sectorId,
      pendingFees: count(),
      pendingAmount: sum(employeeFees.amount),
    })
    .from(employeeFees)
    .innerJoin(employees, eq(employees.id, employeeFees.employeeId))
    .where(eq(employeeFees.status, "pendiente"))
    .groupBy(employees.sectorId);

  const pendingMap = new Map(
    pendingRows.map((r) => [
      r.sectorId,
      { count: Number(r.pendingFees), amount: Number(r.pendingAmount ?? 0) },
    ])
  );

  return rows.map((r) => ({
    sectorId: r.sectorId,
    sectorName: r.sectorName,
    cashboxId: r.cashboxId ?? "",
    cashboxBalance: r.cashboxBalance ?? "0",
    totalEmployees: Number(r.totalEmployees),
    totalMonthlySalary: Number(r.totalMonthlySalary ?? 0),
    pendingFees: pendingMap.get(r.sectorId)?.count ?? 0,
    pendingAmount: pendingMap.get(r.sectorId)?.amount ?? 0,
  }));
}

// --- Overdue Fees (past periods with pending status) --------------------------

/**
 * Returns count + total amount of pending fees from periods BEFORE currentPer.
 * Used to surface a cross-period overdue warning on the salary dashboard.
 */
export async function getOverdueFeesSummary(currentPer: string) {
  const rows = await db
    .select({
      count: count(),
      totalAmount: sum(employeeFees.amount),
    })
    .from(employeeFees)
    .where(
      and(
        eq(employeeFees.status, "pendiente"),
        sql`${employeeFees.period} < ${currentPer}`
      )
    );

  return {
    count: Number(rows[0]?.count ?? 0),
    totalAmount: Number(rows[0]?.totalAmount ?? 0),
  };
}
