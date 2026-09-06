/**
 * mock.audit-scenarios.ts
 *
 * Seeds concrete, named scenarios so the audit page (/auditoria)
 * and topbar alert show realistic, readable data during development.
 *
 * Run AFTER base mock (which seeds cashboxes, sectors, categories):
 *   bun run db:mock           ← base seed
 *   bun run db:mock:audit     ← this file
 *
 * Add to package.json scripts:
 *   "db:mock:audit": "bun src/db/mock.audit-scenarios.ts"
 *
 * Scenarios seeded:
 *
 * EMPLOYEES
 *   A. Fully paid employee          — 6 months, all pagado        → no gap
 *   B. Missing last 2 months        — rows never created           → 2 "Sin registro" (red)
 *   C. Generated but unpaid         — rows exist, status pendiente → 1 "Pendiente" (amber)
 *   D. Mixed: old gap + recent paid — 1 missing old, rest paid     → 1 "Sin registro"
 *   E. New hire (2 months ago)      — only 1 paid, current missing → 1 gap
 *
 * TENANTS
 *   F. Perfect tenant               — 6 months all paid            → no gap
 *   G. Deadbeat (moroso)            — 3 months missing entirely    → 3 "Sin registro" (red)
 *   H. Registered but uncollected   — row exists pending           → 1 "Pendiente" (amber)
 *   I. Inactive tenant              — excluded from audit          → no gap
 */

import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── Colours ──────────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", cyan: "\x1b[36m", blue: "\x1b[34m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", bold: "\x1b[1m",
};
const log = {
  info:    (m: string) => console.log(`${c.blue}  ${m}${c.reset}`),
  ok:      (m: string) => console.log(`${c.green}✔ ${m}${c.reset}`),
  warn:    (m: string) => console.warn(`${c.yellow}⚠ ${m}${c.reset}`),
  section: (m: string) => console.log(`\n${c.cyan}${c.bold}━━ ${m} ━━${c.reset}`),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Returns last N months as "YYYY-MM", oldest first, NOT including current month */
function lastNMonths(n: number): string[] {
  const now = new Date();
  const periods: string[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(periodOf(d.getFullYear(), d.getMonth() + 1));
  }
  return periods;
}

function currentPeriod(): string {
  const now = new Date();
  return periodOf(now.getFullYear(), now.getMonth() + 1);
}

function dueDate(period: string, day = 5): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(y!, m! - 1, day);
}

function toDecimal(n: number): string {
  return n.toFixed(2);
}

// ─── Get required foreign keys ────────────────────────────────────────────────

async function getFirstCashboxId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.cashboxes.id })
    .from(schema.cashboxes)
    .where(eq(schema.cashboxes.status, "activo"))
    .limit(1);
  if (!row) throw new Error("No active cashbox found. Run base mock first.");
  return row.id;
}

// async function getFirstSectorId(): Promise<number> {
//   const [row] = await db
//     .select({ id: schema.sectors.id })
//     .from(schema.sectors)
//     .where(eq(schema.sectors.isActive, true))
//     .limit(1);
//   if (!row) throw new Error("No active sector found. Run base mock first.");
//   return row.id;
// }

async function getSalaryCategoryId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.transactionCategories.id })
    .from(schema.transactionCategories)
    .where(eq(schema.transactionCategories.code, "SALARIO"));
  if (row) return row.id;
  // Create if base mock didn't include it
  const [created] = await db
    .insert(schema.transactionCategories)
    .values({ code: "SALARIO", name: "Pago de salarios", type: "outcome", sortOrder: 0, isSystem: true, status: true, createdByUserId: "system" })
    .returning({ id: schema.transactionCategories.id });
  return created!.id;
}

async function getRentCategoryId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.transactionCategories.id })
    .from(schema.transactionCategories)
    .where(eq(schema.transactionCategories.code, "INC-005"));
  if (row) return row.id;
  const [created] = await db
    .insert(schema.transactionCategories)
    .values({ code: "INC-005", name: "Ingreso por Alquileres", type: "income", sortOrder: 6, isSystem: true, status: true, createdByUserId: "system" })
    .returning({ id: schema.transactionCategories.id });
  return created!.id;
}

// ─── Create a paid fee (with transaction) ────────────────────────────────────

async function createPaidFee(
  employeeId: number,
  period: string,
  amount: number,
  cashboxId: string,
  salaryCatId: string,
) {
  await db.transaction(async (tx) => {
    const [financeTx] = await tx
      .insert(schema.transactions)
      .values({
        type: "withdraw",
        amount: toDecimal(amount),
        categoryId: salaryCatId,
        concept: `Salario ${period} — escenario auditoría`,
        cashboxId,
        createdByUserId: "system",
        status: "completado",
        linkedEntityType: "employee_fee",
      })
      .returning({ id: schema.transactions.id });

    await tx.insert(schema.employeeFees).values({
      employeeId,
      period,
      amount,
      status: "pagado",
      dueDate: dueDate(period, 28),
      paymentMethod: "efectivo",
      transactionId: financeTx!.id,
    });
  });
}

// ─── Create a paid rent (with transaction) ───────────────────────────────────

async function createPaidRent(
  tenantId: number,
  period: string,
  amount: number,
  cashboxId: string,
  rentCatId: string,
) {
  await db.transaction(async (tx) => {
    const [financeTx] = await tx
      .insert(schema.transactions)
      .values({
        type: "deposit",
        amount: toDecimal(amount),
        categoryId: rentCatId,
        concept: `Alquiler ${period} — escenario auditoría`,
        cashboxId,
        createdByUserId: "system",
        status: "completado",
        linkedEntityType: "tenant_payment",
      })
      .returning({ id: schema.transactions.id });

    await tx.insert(schema.tenantPayments).values({
      tenantId,
      period,
      amount,
      status: "pagado",
      dueDate: dueDate(period),
      receiptNumber: `ALQ-DEMO-${period.replace("-", "")}`,
      transactionId: financeTx!.id,
    });
  });
}

// ─── GUARD: skip if already seeded ───────────────────────────────────────────

async function alreadySeeded(): Promise<boolean> {
  const rows = await db
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .where(eq(schema.employees.createdByUserId, "audit-scenario-seed"))
    .limit(1);
  return rows.length > 0;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${c.cyan}${c.bold}╔════════════════════════════════════════╗`);
  console.log(`║   AUDIT SCENARIO SEED                  ║`);
  console.log(`╚════════════════════════════════════════╝${c.reset}\n`);

  if (await alreadySeeded()) {
    log.warn("Audit scenarios already seeded. Delete employees with createdByUserId='audit-scenario-seed' to re-run.");
    process.exit(0);
  }

  const cashboxId   = await getFirstCashboxId();
  // const sectorId    = await getFirstSectorId();
  const salaryCatId = await getSalaryCategoryId();
  const rentCatId   = await getRentCategoryId();

  const past6  = lastNMonths(6);   // 6 months ago → 1 month ago
  const past3  = lastNMonths(3);
  const past2  = lastNMonths(2);
  const past1  = lastNMonths(1);
  const now    = currentPeriod();

  // ══════════════════════════════════════════════════════════════════════════
  // EMPLOYEE SCENARIOS
  // ══════════════════════════════════════════════════════════════════════════

  log.section("EMPLOYEE SCENARIOS");

  // ── A. Fully paid — no gaps ───────────────────────────────────────────────
  {
    log.info("A: Carlos Condori — fully paid (no gaps expected)");
    const [emp] = await db.insert(schema.employees).values({
      ci: "10000001", fullName: "Carlos Condori Mamani",
      chargeTitle: "Secretario General", employeeType: "directorio",
      sectorId, hireDate: new Date(new Date().setMonth(new Date().getMonth() - 7)),
      baseSalary: 5000, status: "activo", createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.employees.id });

    for (const period of [...past6, now]) {
      await createPaidFee(emp!.id, period, 5000, cashboxId, salaryCatId);
    }
    log.ok("A done — 0 gaps");
  }

  // ── B. Missing last 2 months (rows never created) ────────────────────────
  {
    log.info("B: Rosa Quispe Flores — missing last 2 months (rows never created)");
    const [emp] = await db.insert(schema.employees).values({
      ci: "10000002", fullName: "Rosa Quispe Flores",
      chargeTitle: "Secretaria de Actas", employeeType: "planta",
      // sectorId, hireDate: new Date(new Date().setMonth(new Date().getMonth() - 7)),
      baseSalary: 2800, status: "activo", createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.employees.id });

    // Pay everything EXCEPT last 2 months and current
    const paid = past6.slice(0, 4); // oldest 4 of last 6
    for (const period of paid) {
      await createPaidFee(emp!.id, period, 2800, cashboxId, salaryCatId);
    }
    // past6[4], past6[5], and now → NO ROWS CREATED → "Sin registro"
    log.ok("B done — 3 gaps expected (2 past + current)");
  }

  // ── C. Row generated but unpaid (pendiente) ───────────────────────────────
  {
    log.info("C: Juan Apaza Lima — current month generated but not paid");
    const [emp] = await db.insert(schema.employees).values({
      ci: "10000003", fullName: "Juan Apaza Lima",
      chargeTitle: "Encargado de Caja", employeeType: "planta",
      sectorId, hireDate: new Date(new Date().setMonth(new Date().getMonth() - 7)),
      baseSalary: 3200, status: "activo", createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.employees.id });

    for (const period of past6) {
      await createPaidFee(emp!.id, period, 3200, cashboxId, salaryCatId);
    }
    // Current month: row exists but pending → "Pendiente" amber
    await db.insert(schema.employeeFees).values({
      employeeId: emp!.id, period: now, amount: 3200,
      status: "pendiente", dueDate: dueDate(now, 28), paymentMethod: "efectivo",
    });
    log.ok("C done — 1 pending gap (amber)");
  }

  // ── D. One old missing month, rest paid ───────────────────────────────────
  {
    log.info("D: María Choque Vela — skipped payment 3 months ago");
    const [emp] = await db.insert(schema.employees).values({
      ci: "10000004", fullName: "María Choque Vela",
      chargeTitle: "Aux. Contabilidad", employeeType: "planta",
      sectorId, hireDate: new Date(new Date().setMonth(new Date().getMonth() - 7)),
      baseSalary: 2500, status: "activo", createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.employees.id });

    // Pay all EXCEPT 3 months ago (past6[3] = 3 months ago)
    for (let i = 0; i < past6.length; i++) {
      if (i === 3) continue; // this one is "forgotten" — no row
      await createPaidFee(emp!.id, past6[i]!, 2500, cashboxId, salaryCatId);
    }
    await createPaidFee(emp!.id, now, 2500, cashboxId, salaryCatId);
    log.ok("D done — 1 missing gap (red, old period)");
  }

  // ── E. New hire, current month missing ────────────────────────────────────
  {
    log.info("E: Pedro Vargas Ticona — hired 2 months ago, current not generated");
    const hireDate = new Date(new Date().setMonth(new Date().getMonth() - 2));
    const [emp] = await db.insert(schema.employees).values({
      ci: "10000005", fullName: "Pedro Vargas Ticona",
      chargeTitle: "Portero", employeeType: "planta",
      sectorId, hireDate,
      baseSalary: 1800, status: "activo", createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.employees.id });

    // Only pay the month they were hired (1 month ago, past1[0])
    await createPaidFee(emp!.id, past1[0]!, 1800, cashboxId, salaryCatId);
    // Current month → no row → "Sin registro"
    log.ok("E done — 1 missing gap (current month, new hire)");
  }

  // ── F. Overdue salary — 2 months generated but never paid ────────────────
  {
    log.info("F: Ana Gutierrez Poma — 2 old pending fees (overdue)");
    const [emp] = await db.insert(schema.employees).values({
      ci: "10000006", fullName: "Ana Gutierrez Poma",
      chargeTitle: "Fiscal", employeeType: "directorio",
      sectorId, hireDate: new Date(new Date().setMonth(new Date().getMonth() - 7)),
      baseSalary: 4000, status: "activo", createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.employees.id });

    // Paid oldest 4
    for (const period of past6.slice(0, 4)) {
      await createPaidFee(emp!.id, period, 4000, cashboxId, salaryCatId);
    }
    // Last 2 past months: rows exist but pending (overdue)
    for (const period of past6.slice(4)) {
      await db.insert(schema.employeeFees).values({
        employeeId: emp!.id, period, amount: 4000,
        status: "pendiente", dueDate: dueDate(period, 28), paymentMethod: "transferencia",
      });
    }
    // Current also pending
    await db.insert(schema.employeeFees).values({
      employeeId: emp!.id, period: now, amount: 4000,
      status: "pendiente", dueDate: dueDate(now, 28), paymentMethod: "transferencia",
    });
    log.ok("F done — 3 pending gaps (2 overdue + current, all amber)");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TENANT SCENARIOS
  // ══════════════════════════════════════════════════════════════════════════

  log.section("TENANT SCENARIOS");

  // ── G. Perfect tenant — no gaps ───────────────────────────────────────────
  {
    log.info("G: Lucía Zenteno — perfect payment history (no gaps)");
    const startDate = new Date(new Date().setMonth(new Date().getMonth() - 7));
    const [ten] = await db.insert(schema.tenants).values({
      fullName: "Lucía Zenteno Arce", ci: "20000001",
      phone: "76123456", roomNumber: "201", floor: "2",
      monthlyRent: 1200, startDate, status: "activo",
      createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.tenants.id });

    for (const period of [...past6, now]) {
      await createPaidRent(ten!.id, period, 1200, cashboxId, rentCatId);
    }
    log.ok("G done — 0 gaps");
  }

  // ── H. Moroso — 3 months missing entirely (never registered) ─────────────
  {
    log.info("H: Roberto Limachi — moroso, 3 months never registered");
    const startDate = new Date(new Date().setMonth(new Date().getMonth() - 7));
    const [ten] = await db.insert(schema.tenants).values({
      fullName: "Roberto Limachi Choque", ci: "20000002",
      phone: "71987654", roomNumber: "302", floor: "3",
      monthlyRent: 900, startDate, status: "moroso",
      notes: "Notificado 3 veces. No responde.",
      createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.tenants.id });

    // Paid first 3 months
    for (const period of past6.slice(0, 3)) {
      await createPaidRent(ten!.id, period, 900, cashboxId, rentCatId);
    }
    // Last 3 past months + current = 4 months with NO ROWS → "Sin registro"
    log.ok("H done — 4 missing gaps (red)");
  }

  // ── I. Registered but uncollected (pending row exists) ───────────────────
  {
    log.info("I: Carla Ticona — current month registered but not collected");
    const startDate = new Date(new Date().setMonth(new Date().getMonth() - 7));
    const [ten] = await db.insert(schema.tenants).values({
      fullName: "Carla Ticona Vargas", ci: "20000003",
      phone: "70456789", roomNumber: "103", floor: "1",
      monthlyRent: 1500, startDate, status: "activo",
      createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.tenants.id });

    for (const period of past6) {
      await createPaidRent(ten!.id, period, 1500, cashboxId, rentCatId);
    }
    // Current month: row exists, pending → "Pendiente" amber
    await db.insert(schema.tenantPayments).values({
      tenantId: ten!.id, period: now, amount: 1500,
      status: "pendiente", dueDate: dueDate(now),
      notes: "Inquilino prometió pagar el viernes.",
    });
    log.ok("I done — 1 pending gap (amber)");
  }

  // ── J. Inactive tenant — should NOT appear in audit ───────────────────────
  {
    log.info("J: Fidel Machaca — inactive tenant (excluded from audit)");
    const startDate = new Date(new Date().setMonth(new Date().getMonth() - 10));
    const endDate   = new Date(new Date().setMonth(new Date().getMonth() - 1));
    await db.insert(schema.tenants).values({
      fullName: "Fidel Machaca Salinas", ci: "20000004",
      phone: "72345678", roomNumber: "LOC-A", floor: "PB",
      monthlyRent: 2000, startDate, endDate, status: "inactivo",
      notes: "Contrato finalizado.",
      createdByUserId: "audit-scenario-seed",
    });
    log.ok("J done — not in audit (inactivo)");
  }

  // ── K. Old missing + recent gap combo (tenant) ────────────────────────────
  {
    log.info("K: Sandra Huanca — skipped month 4 months ago AND current missing");
    const startDate = new Date(new Date().setMonth(new Date().getMonth() - 7));
    const [ten] = await db.insert(schema.tenants).values({
      fullName: "Sandra Huanca Mamani", ci: "20000005",
      phone: "73654321", roomNumber: "204", floor: "2",
      monthlyRent: 1100, startDate, status: "activo",
      createdByUserId: "audit-scenario-seed",
    }).returning({ id: schema.tenants.id });

    for (let i = 0; i < past6.length; i++) {
      if (i === 2) continue; // skip month 4 months ago (past6[2])
      await createPaidRent(ten!.id, past6[i]!, 1100, cashboxId, rentCatId);
    }
    // Current month → no row → "Sin registro"
    log.ok("K done — 2 missing gaps (1 old red, 1 current red)");
  }

  // ── Fix sequences ─────────────────────────────────────────────────────────
  await db.execute(sql`SELECT setval('employees_id_seq',   COALESCE((SELECT MAX(id)+1 FROM employees),   1), false)`);
  await db.execute(sql`SELECT setval('employee_fees_id_seq', COALESCE((SELECT MAX(id)+1 FROM employee_fees), 1), false)`);
  await db.execute(sql`SELECT setval('tenants_id_seq',     COALESCE((SELECT MAX(id)+1 FROM tenants),     1), false)`);
  await db.execute(sql`SELECT setval('tenant_payments_id_seq', COALESCE((SELECT MAX(id)+1 FROM tenant_payments), 1), false)`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${c.cyan}${c.bold}━━ EXPECTED AUDIT RESULTS ━━${c.reset}`);
  console.log(`${c.yellow}  EMPLOYEES (6 people seeded):`);
  console.log(`    A. Carlos Condori    → ✅ no gaps`);
  console.log(`    B. Rosa Quispe       → 🔴 3 sin registro  (2 past + current)`);
  console.log(`    C. Juan Apaza        → 🟡 1 pendiente     (current, amber)`);
  console.log(`    D. María Choque      → 🔴 1 sin registro  (old period)`);
  console.log(`    E. Pedro Vargas      → 🔴 1 sin registro  (current, new hire)`);
  console.log(`    F. Ana Gutierrez     → 🟡 3 pendientes    (2 overdue + current)`);
  console.log(`\n  TENANTS (5 active seeded):`);
  console.log(`    G. Lucía Zenteno     → ✅ no gaps`);
  console.log(`    H. Roberto Limachi   → 🔴 4 sin registro  (moroso, 3 past + current)`);
  console.log(`    I. Carla Ticona      → 🟡 1 pendiente     (current, amber)`);
  console.log(`    J. Fidel Machaca     → ✅ excluded         (inactivo)`);
  console.log(`    K. Sandra Huanca     → 🔴 2 sin registro  (1 old + current)`);
  console.log(`\n  TOPBAR BADGE should show: ~15 gaps`);
  console.log(`${c.reset}`);

  console.log(`\n${c.green}${c.bold}✔ Audit scenario seed complete.${c.reset}\n`);
}

await main();
