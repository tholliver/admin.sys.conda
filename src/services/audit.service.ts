/**
 * audit.service.ts
 * Detects missing payment periods for active employees and tenants.
 *
 * A "missing" period = the person was active that month but no fee/payment
 * row exists in the DB at all (not even a pending one).
 * A "pending" period = row exists but status is "pendiente" or "parcial".
 */

import { db } from "@/db";
import {
  employees,
  employeeFees,
  tenants,
  tenantPayments,
} from "@/db/schema";
import { and, eq, gte, isNull, lte, inArray } from "drizzle-orm";

// ── Helpers ────────────────────────────────────────────────────────────

/** Returns "YYYY-MM" for a given year + 1-based month */
function periodOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Returns all "YYYY-MM" periods from startPeriod up to (and including) endPeriod */
function periodRange(start: string, end: string): string[] {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const periods: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    periods.push(periodOf(y, m));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return periods;
}

/** Today's period as "YYYY-MM" */
export function currentPeriod(): string {
  const now = new Date();
  return periodOf(now.getFullYear(), now.getMonth() + 1);
}

// ── Types ──────────────────────────────────────────────────────────────

export interface MissingFeeRow {
  employeeId: number;
  fullName: string;
  chargeTitle: string;
  period: string;
  expectedAmount: number;
  kind: "missing"; // row never created
}

export interface PendingFeeRow {
  feeId: number;
  employeeId: number;
  fullName: string;
  chargeTitle: string;
  period: string;
  amount: number;
  status: "pendiente" | "parcial";
  kind: "pending";
}

export type EmployeeGap = MissingFeeRow | PendingFeeRow;

export interface MissingRentRow {
  tenantId: number;
  fullName: string;
  roomNumber: string;
  period: string;
  expectedAmount: number;
  kind: "missing";
}

export interface PendingRentRow {
  paymentId: number;
  tenantId: number;
  fullName: string;
  roomNumber: string;
  period: string;
  amount: number;
  status: "pendiente" | "parcial";
  kind: "pending";
}

export type TenantGap = MissingRentRow | PendingRentRow;

export interface AuditSummary {
  employeeGaps: EmployeeGap[];
  tenantGaps: TenantGap[];
  totalMissingEmployeeFees: number;
  totalPendingEmployeeAmount: number;
  totalMissingTenantPeriods: number;
  totalPendingTenantAmount: number;
}

// ── Employee audit ─────────────────────────────────────────────────────

export async function auditEmployeeFees(upToPeriod: string): Promise<EmployeeGap[]> {
  // 1. Load all non-deleted, active/suspended employees (baja excluded)
  const activeEmployees = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      chargeTitle: employees.chargeTitle,
      baseSalary: employees.baseSalary,
      hireDate: employees.hireDate,
      terminationDate: employees.terminationDate,
      status: employees.status,
    })
    .from(employees)
    .where(
      and(
        isNull(employees.deletedAt),
        // Include activo + suspendido + licencia — skip only "baja"
        inArray(employees.status, ["activo", "suspendido", "licencia"])
      )
    );

  if (activeEmployees.length === 0) return [];

  const employeeIds = activeEmployees.map((e) => e.id);

  // 2. Load all existing fees for these employees up to upToPeriod
  const existingFees = await db
    .select({
      id: employeeFees.id,
      employeeId: employeeFees.employeeId,
      period: employeeFees.period,
      amount: employeeFees.amount,
      status: employeeFees.status,
    })
    .from(employeeFees)
    .where(
      and(
        inArray(employeeFees.employeeId, employeeIds),
        lte(employeeFees.period, upToPeriod)
      )
    );

  // Map: employeeId -> Map<period, fee>
  const feeMap = new Map<number, Map<string, typeof existingFees[number]>>();
  for (const fee of existingFees) {
    if (!fee.employeeId) continue;
    if (!feeMap.has(fee.employeeId)) feeMap.set(fee.employeeId, new Map());
    feeMap.get(fee.employeeId)!.set(fee.period, fee);
  }

  const gaps: EmployeeGap[] = [];

  for (const emp of activeEmployees) {
    // Determine range: from hire month to min(termination month, upToPeriod)
    const hireMonth = periodOf(
      emp.hireDate.getFullYear(),
      emp.hireDate.getMonth() + 1
    );
    let endMonth = upToPeriod;
    if (emp.terminationDate) {
      const termMonth = periodOf(
        emp.terminationDate.getFullYear(),
        emp.terminationDate.getMonth() + 1
      );
      if (termMonth < endMonth) endMonth = termMonth;
    }

    const expectedPeriods = periodRange(hireMonth, endMonth);
    const empFees = feeMap.get(emp.id) ?? new Map();

    for (const period of expectedPeriods) {
      const fee = empFees.get(period);
      if (!fee) {
        // Completely missing row
        gaps.push({
          employeeId: emp.id,
          fullName: emp.fullName,
          chargeTitle: emp.chargeTitle,
          period,
          expectedAmount: Number(emp.baseSalary),
          kind: "missing",
        });
      } else if (fee.status === "pendiente" || fee.status === "parcial") {
        gaps.push({
          feeId: fee.id,
          employeeId: emp.id,
          fullName: emp.fullName,
          chargeTitle: emp.chargeTitle,
          period,
          amount: Number(fee.amount),
          status: fee.status,
          kind: "pending",
        });
      }
      // pagado / anulado → no gap
    }
  }

  // Sort: oldest period first, then by name
  gaps.sort((a, b) => a.period.localeCompare(b.period) || a.fullName.localeCompare(b.fullName));
  return gaps;
}

// ── Tenant audit ───────────────────────────────────────────────────────

export async function auditTenantPayments(upToPeriod: string): Promise<TenantGap[]> {
  // 1. Load all non-deleted active/moroso tenants
  const activeTenants = await db
    .select({
      id: tenants.id,
      fullName: tenants.fullName,
      roomNumber: tenants.roomNumber,
      monthlyRent: tenants.monthlyRent,
      startDate: tenants.startDate,
      endDate: tenants.endDate,
      status: tenants.status,
    })
    .from(tenants)
    .where(
      and(
        isNull(tenants.deletedAt),
        inArray(tenants.status, ["activo", "moroso"])
      )
    );

  if (activeTenants.length === 0) return [];

  const tenantIds = activeTenants.map((t) => t.id);

  // 2. Load all existing payments up to upToPeriod
  const existingPayments = await db
    .select({
      id: tenantPayments.id,
      tenantId: tenantPayments.tenantId,
      period: tenantPayments.period,
      amount: tenantPayments.amount,
      status: tenantPayments.status,
    })
    .from(tenantPayments)
    .where(
      and(
        inArray(tenantPayments.tenantId, tenantIds),
        lte(tenantPayments.period, upToPeriod)
      )
    );

  // Map: tenantId -> Map<period, payment>
  const payMap = new Map<number, Map<string, typeof existingPayments[number]>>();
  for (const pay of existingPayments) {
    if (!pay.tenantId) continue;
    if (!payMap.has(pay.tenantId)) payMap.set(pay.tenantId, new Map());
    payMap.get(pay.tenantId)!.set(pay.period, pay);
  }

  const gaps: TenantGap[] = [];

  for (const tenant of activeTenants) {
    const startMonth = periodOf(
      tenant.startDate.getFullYear(),
      tenant.startDate.getMonth() + 1
    );
    let endMonth = upToPeriod;
    if (tenant.endDate) {
      const contractEnd = periodOf(
        tenant.endDate.getFullYear(),
        tenant.endDate.getMonth() + 1
      );
      if (contractEnd < endMonth) endMonth = contractEnd;
    }

    const expectedPeriods = periodRange(startMonth, endMonth);
    const tenantPays = payMap.get(tenant.id) ?? new Map();

    for (const period of expectedPeriods) {
      const pay = tenantPays.get(period);
      if (!pay) {
        gaps.push({
          tenantId: tenant.id,
          fullName: tenant.fullName,
          roomNumber: tenant.roomNumber,
          period,
          expectedAmount: Number(tenant.monthlyRent),
          kind: "missing",
        });
      } else if (pay.status === "pendiente" || pay.status === "parcial") {
        gaps.push({
          paymentId: pay.id,
          tenantId: tenant.id,
          fullName: tenant.fullName,
          roomNumber: tenant.roomNumber,
          period,
          amount: Number(pay.amount),
          status: pay.status,
          kind: "pending",
        });
      }
    }
  }

  gaps.sort((a, b) => a.period.localeCompare(b.period) || a.fullName.localeCompare(b.fullName));
  return gaps;
}

// ── Full audit ─────────────────────────────────────────────────────────

export async function getFullAudit(): Promise<AuditSummary> {
  const today = currentPeriod();
  const [employeeGaps, tenantGaps] = await Promise.all([
    auditEmployeeFees(today),
    auditTenantPayments(today),
  ]);

  const totalMissingEmployeeFees = employeeGaps.filter((g) => g.kind === "missing").length;
  const totalPendingEmployeeAmount = employeeGaps.reduce(
    (s, g) => s + (g.kind === "pending" ? g.amount : g.expectedAmount),
    0
  );

  const totalMissingTenantPeriods = tenantGaps.filter((g) => g.kind === "missing").length;
  const totalPendingTenantAmount = tenantGaps.reduce(
    (s, g) => s + (g.kind === "pending" ? g.amount : g.expectedAmount),
    0
  );

  return {
    employeeGaps,
    tenantGaps,
    totalMissingEmployeeFees,
    totalPendingEmployeeAmount,
    totalMissingTenantPeriods,
    totalPendingTenantAmount,
  };
}
