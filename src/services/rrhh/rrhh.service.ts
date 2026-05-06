import { db } from "@/db";
import {
  cashboxes,
  employees,
  employeeFees,
  transactionCategories,
  type SelectEmployee,
  transactions,
} from "@/db/schema";
import {
  eq,
  and,
  sql,
  asc,
  ilike,
  inArray,
  count,
  sum,
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
  const { type = "all", status = "all", search, page = 1, pageSize = 20 } = filters;

  const conditions = [];

  if (type !== "all") {
    conditions.push(eq(employees.employeeType, type as any));
  }
  if (status !== "all") {
    conditions.push(eq(employees.status, status as any));
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
        cashboxName: cashboxes.name,
      })
      .from(employees)
      .leftJoin(cashboxes, eq(cashboxes.id, employees.cashboxId))
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
      cashboxName: r.cashboxName ?? "---",
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
      cashboxName: cashboxes.name,
    })
    .from(employees)
    .leftJoin(cashboxes, eq(cashboxes.id, employees.cashboxId))
    .where(eq(employees.id, id))
    .limit(1);

  if (!row[0]) return null;

  return {
    ...row[0].employee,
    fullName: getEmployeeFullName(row[0].employee),
    cashboxName: row[0].cashboxName ?? "Sin caja",
  };
}

/** Count active employees by type – used to enforce capacity limits */
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
    throw new Error(`El directorio ya alcanzó el máximo de ${MAX_DIRECTORIO} miembros activos.`);
  }
  if (data.employeeType === "planta" && counts.planta >= MAX_PLANTA) {
    throw new Error(
      `La planta ya alcanzó el máximo de ${MAX_PLANTA} miembros del personal activos.`
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
  const { period, cashboxId, employeeId, status = "all", employeeType = "all" } = filters;

  const conditions = [];

  if (period) conditions.push(eq(employeeFees.period, period));
  if (status !== "all") conditions.push(eq(employeeFees.status, status as any));
  if (cashboxId) conditions.push(eq(employees.cashboxId, cashboxId));
  if (employeeId) conditions.push(eq(employeeFees.employeeId, employeeId));
  if (employeeType !== "all") {
    conditions.push(
      sql`LOWER(${employees.employeeType}) = ${String(employeeType).toLowerCase()}`
    );
  }

  const rows = await db
    .select({
      fee: employeeFees,
      employee: employees,
      cashboxName: cashboxes.name,
    })
    .from(employeeFees)
    .innerJoin(employees, eq(employees.id, employeeFees.employeeId))
    .leftJoin(cashboxes, eq(cashboxes.id, employees.cashboxId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(employees.fullName), asc(employeeFees.period));

  return rows.map((r) => ({
    ...r.fee,
    employee: {
      ...r.employee,
      fullName: getEmployeeFullName(r.employee),
      cashboxName: r.cashboxName ?? "Sin caja",
      cashboxId: r.employee.cashboxId,
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
      `Ya existe una cuota para este miembro del personal en el período ${data.period}.`
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
   const { period, cashboxId, overwrite } = data;

   const conditions: any[] = [eq(employees.status, "activo")];
   if (cashboxId) conditions.push(eq(employees.cashboxId, cashboxId));

  const activeEmployees = await db
    .select({
      employee: employees,
    })
    .from(employees)
    .where(and(...conditions));

   if (activeEmployees.length === 0) {
     return { created: 0, skippedDuplicate: 0, skippedNoCashbox: 0, noCashboxEmployees: [], errors: [] };
   }

   const withCashbox = activeEmployees.filter((e) => !!e.employee.cashboxId);
   const noCashbox = activeEmployees.filter((e) => !e.employee.cashboxId);
   const noCashboxEmployees = noCashbox.map((e) => e.employee.fullName);

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
     const values = toCreate.map(({ employee }) => ({
       employeeId: employee.id,
       period,
       amount: employee.baseSalary,
       cashboxId: employee.cashboxId!,
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
      employeeCashboxId: employees.cashboxId,
      employeeName: employees.fullName,
    })
    .from(employeeFees)
    .innerJoin(employees, eq(employees.id, employeeFees.employeeId))
    .where(eq(employeeFees.id, data.feeId))
    .limit(1);

  if (!feeRow[0]) throw new Error("Cuota no encontrada.");

  const { fee, employeeCashboxId, employeeName } = feeRow[0];
  if (fee.status === "pagado") throw new Error("Esta cuota ya fue pagada.");

  if (data.createTransaction === false) {
    throw new Error("Para trazabilidad, el pago requiere crear una transaccion.");
  }

  const amountToPay = Number(data.amountPaid);
  const feeAmount = Number(fee.amount);
  if (!Number.isFinite(amountToPay) || amountToPay <= 0) {
    throw new Error("El monto de pago es invalido.");
  }
  if (Math.round(amountToPay * 100) !== Math.round(feeAmount * 100)) {
    throw new Error(`El pago debe ser exacto: Bs ${feeAmount.toFixed(2)}.`);
  }

  const [salaryCategory] = await db
    .select({ id: transactionCategories.id })
    .from(transactionCategories)
    .where(
      and(
        eq(transactionCategories.code, "OUT-014"),
        eq(transactionCategories.type, "outcome"),
        eq(transactionCategories.status, true),
      ),
    )
    .limit(1);

  if (!salaryCategory) {
    throw new Error('No existe la categoria activa "OUT-014" para registrar pago salarial.');
  }

  let resolvedCashbox: { id: string; name: string; balance: string | null; status: string | null };

  if (employeeCashboxId) {
    const linked = await db
      .select({
        id: cashboxes.id,
        name: cashboxes.name,
        balance: cashboxes.balance,
        status: cashboxes.status,
      })
      .from(cashboxes)
      .where(eq(cashboxes.id, employeeCashboxId))
      .limit(1);

    if (!linked[0]) throw new Error(`El empleado "${employeeName}" no tiene una caja vinculada valida.`);
    if (linked[0].status !== "activo") throw new Error(`La caja vinculada al empleado "${employeeName}" esta inactiva.`);
    resolvedCashbox = linked[0];
  } else {
    const general = await db
      .select({ id: cashboxes.id, name: cashboxes.name, balance: cashboxes.balance, status: cashboxes.status })
      .from(cashboxes)
      .where(and(eq(cashboxes.code, "GEN"), eq(cashboxes.status, "activo")))
      .limit(1);

    if (!general[0]) throw new Error('No existe una caja general activa con codigo "GEN".');
    resolvedCashbox = general[0];
  }

  const availableBalance = Number(resolvedCashbox.balance ?? 0);
  if (availableBalance < amountToPay) {
    throw new Error(
      `Saldo insuficiente en "${resolvedCashbox.name}". Disponible: Bs ${availableBalance.toFixed(2)}.`
    );
  }
  const newBalance = (availableBalance - amountToPay).toFixed(2);

  const [payment] = await db.transaction(async (tx) => {
    const [createdPayment] = await tx
      .insert(transactions)
      .values({
        cashboxId: resolvedCashbox.id,
        categoryId: salaryCategory.id,
        type: "withdraw",
        amount: amountToPay.toFixed(2),
        concept: `Pago de salario ${fee.period} - ${employeeName}`,
        description: data.notes?.trim() || null,
        reference: data.receiptNumber?.trim() || null,
        createdByUserId: processedByUserId,
        status: "completado",
        balanceAfter: newBalance,
        linkedEntityType: "employee_fee",
        linkedEntityId: fee.id,
      })
      .returning();

    await tx
      .update(employeeFees)
      .set({
        status: "pagado",
        paymentMethod: data.paymentMethod,
        transactionId: createdPayment.id,
        updatedAt: new Date(),
      })
      .where(eq(employeeFees.id, data.feeId));

    await tx
      .update(cashboxes)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(cashboxes.id, resolvedCashbox.id));

    return [createdPayment];
  });

  return payment;
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
