/**
 * mock.dev.ts — DEV-ONLY extended seed
 *
 * Extends the base mock (cashboxes, sectors, categories, invoice-ranges, users)
 * with rich simulation data for: contractors, tenants, employees,
 * and their payment histories.
 *
 * Usage:
 *   bun run db:mock:dev
 *
 * package.json → add:
 *   "db:mock:dev": "bun run src/db/mock.ts && bun run src/db/mock.dev.ts"
 *
 * The base mock MUST run first (it populates cashboxes & sectors).
 * This file is self-contained and idempotent — safe to run repeatedly.
 */

import { db } from "@/db";
import * as schema from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";

// ─── colour logger ───────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", cyan: "\x1b[36m", blue: "\x1b[34m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", bold: "\x1b[1m",
};
const log = {
  info:    (m: string) => console.log(`${c.blue}  ${m}${c.reset}`),
  ok:      (m: string) => console.log(`${c.green}✔ ${m}${c.reset}`),
  warn:    (m: string) => console.warn(`${c.yellow}⚠ ${m}${c.reset}`),
  error:   (m: string) => console.error(`${c.red}✖ ${m}${c.reset}`),
  section: (m: string) => console.log(`\n${c.cyan}${c.bold}━━ ${m} ━━${c.reset}`),
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Return a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Return a date offset from today by `days` (negative = past). */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Format a Date as "YYYY-MM" period string. */
function toPeriod(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Generate the last `n` calendar months ending at the current month. */
function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(toPeriod(m));
  }
  return months;
}

/** First day of a "YYYY-MM" period as a Date. */
function periodToDate(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(y!, m! - 1, 1);
}

// ─── static data pools ───────────────────────────────────────────────────────

const BOLIVIAN_NAMES = [
  "Carlos Mamani", "Rosa Quispe", "Juan Flores", "María Condori",
  "Pedro Vargas", "Ana Gutierrez", "Luis Apaza", "Elena Choque",
  "Roberto Limachi", "Carla Ticona", "Fidel Machaca", "Sandra Huanca",
  "Gonzalo Marca", "Patricia Mamani", "Víctor Colque", "Nora Quispe",
  "Ernesto Tarqui", "Silvia Poma", "Marcelo Calle", "Lucía Zenteno",
  "Fernando Rojas", "Beatriz Salinas", "Oscar Pedraza", "Claudia Vega",
  "Ramiro Morales", "Estela Paredes", "Hugo Balboa", "Miriam Escobar",
  "Eduardo Roca", "Graciela Soliz", "Alvaro Montes", "Daniela Quiroga",
  "Renato Serrano", "Verónica Bravo", "Sergio Antelo", "Lorena Valdivia",
  "Ignacio Rivero", "Carmen Durán", "Rodrigo Paz", "Natalia Villca",
];

const SPECIALTIES = [
  "Electricista", "Plomero", "Albanil", "Carpintero", "Pintor",
  "Soldador", "Mecánico", "Gasfitero", "Técnico en HVAC",
  "Cerrajero", "Jardinero", "Limpieza industrial",
];

const ROOM_FLOORS: Array<{ room: string; floor: string }> = [
  { room: "101", floor: "1" }, { room: "102", floor: "1" },
  { room: "103", floor: "1" }, { room: "104", floor: "1" },
  { room: "201", floor: "2" }, { room: "202", floor: "2" },
  { room: "203", floor: "2" }, { room: "204", floor: "2" },
  { room: "301", floor: "3" }, { room: "302", floor: "3" },
  { room: "303", floor: "3" }, { room: "304", floor: "3" },
  { room: "LOC-A", floor: "PB" }, { room: "LOC-B", floor: "PB" },
  { room: "LOC-C", floor: "PB" }, { room: "DEP-1", floor: "SS" },
];

const CHARGE_TITLES = [
  "Secretario General", "Secretario de Hacienda", "Secretario de Actas",
  "Vocal", "Fiscal", "Asesor Legal", "Contador", "Aux. Contabilidad",
  "Encargado de Caja", "Portero", "Limpieza", "Chofer", "Vigilante",
];

const CITIES = ["SC", "CB", "LP", "OR", "PT", "TJ", "BE", "PD", "CH"];

const PHONE_PREFIX = ["70", "71", "72", "73", "74", "75", "76", "77", "78"];

function randomPhone() {
  return `${pick(PHONE_PREFIX)}${Math.floor(1000000 + Math.random() * 9000000)}`;
}

function randomCI() {
  return `${Math.floor(1000000 + Math.random() * 8000000)}`;
}

function randomAmount(min: number, max: number, step = 50): number {
  const steps = Math.floor((max - min) / step);
  return min + Math.floor(Math.random() * steps) * step;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTORS
// ─────────────────────────────────────────────────────────────────────────────

const CONTRACTOR_POOL: schema.InsertContractor[] = BOLIVIAN_NAMES.slice(0, 20).map(
  (fullName, i) => ({
    fullName,
    ci: randomCI(),
    ruc: i % 3 === 0 ? `${randomCI()}-1` : undefined,
    phone: randomPhone(),
    email: i % 2 === 0
      ? `${fullName.split(" ")[0]!.toLowerCase()}.${i}@gmail.com`
      : undefined,
    address: `Barrio ${pick(["La Paz", "Centro", "Norte", "Sur", "El Prado"])}, ${pick(["Calle", "Av.", "Pasaje"])} ${Math.floor(Math.random() * 30) + 1}`,
    specialty: pick(SPECIALTIES),
    status: i < 16 ? "activo" : "inactivo",
    notes: i % 4 === 0 ? "Proveedor frecuente, buen historial." : undefined,
    createdByUserId: "system",
  })
);

export async function seedDevContractors(): Promise<number[]> {
  log.section("DEV — CONTRACTORS");
  try {
    const existing = await db
      .select({ id: schema.contractors.id })
      .from(schema.contractors);
    if (existing.length > 0) {
      log.warn(`Contractors already exist (${existing.length}), skipping insert`);
      return existing.map((r) => r.id);
    }
    const inserted = await db
      .insert(schema.contractors)
      .values(CONTRACTOR_POOL)
      .returning({ id: schema.contractors.id });
    log.ok(`${inserted.length} contractors inserted`);
    return inserted.map((r) => r.id);
  } catch (err) {
    log.error(`Contractors seed failed: ${err}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTOR PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevContractorPayments(
  contractorIds: number[],
  cashboxIds: string[],
): Promise<void> {
  log.section("DEV — CONTRACTOR PAYMENTS");
  if (contractorIds.length === 0 || cashboxIds.length === 0) {
    log.warn("No contractors or cashboxes — skipping contractor payments");
    return;
  }

  const existing = await db
    .select({ id: schema.contractorPayments.id })
    .from(schema.contractorPayments);
  if (existing.length > 0) {
    log.warn(`Contractor payments already exist (${existing.length}), skipping`);
    return;
  }

  const concepts = [
    "Reparación eléctrica sala de reuniones",
    "Mantenimiento de plomería baños",
    "Pintura fachada principal",
    "Instalación de cerraduras",
    "Limpieza industrial mensual",
    "Reparación de estructura metálica",
    "Mantenimiento de jardines",
    "Servicio de soldadura puerta principal",
    "Revisión sistema HVAC",
    "Arreglo de piso cerámica",
  ];

  const payments: schema.InsertContractorPayment[] = [];

  // Each active contractor gets 1-4 historical payments
  for (const contractorId of contractorIds) {
    const nPayments = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < nPayments; i++) {
      const daysBack = Math.floor(Math.random() * 365);
      payments.push({
        contractorId,
        cashboxId: pick(cashboxIds),
        amount: randomAmount(500, 8000, 100),
        concept: pick(concepts),
        receiptNumber: `REC-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        paidAt: daysAgo(daysBack),
        processedByUserId: "system",
        notes: Math.random() > 0.6 ? "Pago aprobado por directorio." : undefined,
      });
    }
  }

  try {
    await db.insert(schema.contractorPayments).values(payments);
    log.ok(`${payments.length} contractor payments inserted`);
  } catch (err) {
    log.error(`Contractor payments failed: ${err}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANTS
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_POOL: schema.InsertTenant[] = ROOM_FLOORS.map((rf, i) => {
  const name = BOLIVIAN_NAMES[20 + i] ?? BOLIVIAN_NAMES[i]!;
  // 2 moroso, 2 inactivo, rest activo
  const status: schema.TenantStatus =
    i < 2 ? "moroso" : i < 4 ? "inactivo" : "activo";
  const startMonthsAgo = Math.floor(Math.random() * 24) + 6; // 6–30 months ago
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - startMonthsAgo);

  return {
    fullName: name,
    ci: randomCI(),
    phone: randomPhone(),
    email: i % 3 === 0 ? `inquilino${i}@correo.bo` : undefined,
    roomNumber: rf.room,
    floor: rf.floor,
    description: `Ambiente ${rf.room} piso ${rf.floor}`,
    monthlyRent: randomAmount(800, 3500, 100),
    startDate,
    endDate: status === "inactivo" ? daysAgo(30) : undefined,
    status,
    notes: status === "moroso" ? "Presenta deuda acumulada. Notificado." : undefined,
    createdByUserId: "system",
  };
});

export async function seedDevTenants(): Promise<number[]> {
  log.section("DEV — TENANTS");
  try {
    const existing = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants);
    if (existing.length > 0) {
      log.warn(`Tenants already exist (${existing.length}), skipping insert`);
      return existing.map((r) => r.id);
    }
    const inserted = await db
      .insert(schema.tenants)
      .values(TENANT_POOL)
      .returning({ id: schema.tenants.id });
    log.ok(`${inserted.length} tenants inserted`);
    return inserted.map((r) => r.id);
  } catch (err) {
    log.error(`Tenants seed failed: ${err}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT PAYMENTS (rent history)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevTenantPayments(
  tenantIds: number[],
  cashboxIds: string[],
): Promise<void> {
  log.section("DEV — TENANT PAYMENTS");
  if (tenantIds.length === 0 || cashboxIds.length === 0) {
    log.warn("No tenants or cashboxes — skipping tenant payments");
    return;
  }

  const existing = await db
    .select({ id: schema.tenantPayments.id })
    .from(schema.tenantPayments);
  if (existing.length > 0) {
    log.warn(`Tenant payments already exist (${existing.length}), skipping`);
    return;
  }

  const tenantRows = await db
    .select({ id: schema.tenants.id, monthlyRent: schema.tenants.monthlyRent, status: schema.tenants.status })
    .from(schema.tenants);

  const payments: schema.InsertTenantPayment[] = [];
  const periods = lastNMonths(14); // generate 14 months of history

  for (const tenant of tenantRows) {
    for (let pi = 0; pi < periods.length; pi++) {
      const period = periods[pi]!;
      const dueDate = periodToDate(period);
      dueDate.setDate(5); // due on the 5th of each month

      // moroso tenants: last 2 months pending; inactivo: all pending; activo: mostly paid
      let status: schema.RentPaymentStatus;
      if (tenant.status === "inactivo") {
        status = "anulado";
      } else if (tenant.status === "moroso" && pi >= periods.length - 2) {
        status = "pendiente";
      } else if (tenant.status === "activo" && pi === periods.length - 1) {
        // current month: 50% chance pending
        status = Math.random() > 0.5 ? "pendiente" : "pagado";
      } else {
        // older months: mostly paid, 5% parcial
        status = Math.random() > 0.05 ? "pagado" : "parcial";
      }

      const paidAt =
        status === "pagado" || status === "parcial"
          ? new Date(dueDate.getTime() + Math.random() * 10 * 86400000)
          : undefined;

      payments.push({
        tenantId: tenant.id,
        period,
        amount: Number(tenant.monthlyRent),
        status,
        dueDate,
        paidAt,
        receiptNumber: status === "pagado"
          ? `ALQ-${String(Math.floor(Math.random() * 9000) + 1000)}`
          : undefined,
        processedByUserId: status !== "pendiente" ? "system" : undefined,
        transactionId: undefined,
        notes: status === "parcial" ? "Pago parcial acordado con directorio." : undefined,
      });
    }
  }

  try {
    // Insert in chunks to avoid param limit
    const CHUNK = 200;
    for (let i = 0; i < payments.length; i += CHUNK) {
      await db.insert(schema.tenantPayments).values(payments.slice(i, i + CHUNK));
    }
    log.ok(`${payments.length} tenant payment records inserted`);
  } catch (err) {
    log.error(`Tenant payments failed: ${err}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevEmployees(): Promise<number[]> {
  log.section("DEV — EMPLOYEES");
  try {
    const existingEmployees = await db
      .select({ id: schema.employees.id })
      .from(schema.employees);
    if (existingEmployees.length > 0) {
      log.warn(`Employees already exist (${existingEmployees.length}), skipping insert`);
      return existingEmployees.map((r) => r.id);
    }

    const allSectors = await db
      .select({ id: schema.sectors.id })
      .from(schema.sectors)
      .where(eq(schema.sectors.isActive, true));

    if (allSectors.length === 0) {
      log.warn("No active sectors found — skipping employees");
      return [];
    }

    const employeePool: schema.InsertEmployee[] = BOLIVIAN_NAMES.slice(0, 25).map((fullName, i) => {
      const hiresAgo = Math.floor(Math.random() * 1800) + 90; // 3 months to 5 years
      const hireDate = daysAgo(hiresAgo);

      let status: schema.EmployeeStatus = "activo";
      if (i === 22) status = "suspendido";
      if (i === 23) status = "licencia";
      if (i === 24) status = "baja";

      const type: schema.EmployeeType = i < 5 ? "directorio" : "planta";

      return {
        ci: randomCI(),
        ciCity: pick(CITIES),
        fullName,
        phone: randomPhone(),
        address: `Av. ${pick(["Blanco Galindo", "Uyuni", "Aniceto Arce", "6 de Agosto"])} Km ${Math.floor(Math.random() * 15) + 1}`,
        employeeType: type,
        chargeTitle: pick(CHARGE_TITLES),
        sectorId: pick(allSectors).id,
        hireDate,
        terminationDate: status === "baja" ? daysAgo(15) : undefined,
        baseSalary: type === "directorio"
          ? randomAmount(3000, 8000, 500)
          : randomAmount(1500, 4000, 250),
        status,
        notes: status === "suspendido"
          ? "Suspendido por resolución interna #2025-14."
          : undefined,
        createdByUserId: "system",
      };
    });

    const inserted = await db
      .insert(schema.employees)
      .values(employeePool)
      .returning({ id: schema.employees.id });

    await db.execute(
      sql`SELECT setval('employees_id_seq', COALESCE((SELECT MAX(id)+1 FROM employees), 1), false)`
    );

    log.ok(`${inserted.length} employees inserted`);
    return inserted.map((r) => r.id);
  } catch (err) {
    log.error(`Employees seed failed: ${err}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE FEES (salary periods)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevEmployeeFees(cashboxIds: string[]): Promise<void> {
  log.section("DEV — EMPLOYEE FEES");
  if (cashboxIds.length === 0) {
    log.warn("No cashboxes — skipping employee fees");
    return;
  }

  const existing = await db
    .select({ id: schema.employeeFees.id })
    .from(schema.employeeFees);
  if (existing.length > 0) {
    log.warn(`Employee fees already exist (${existing.length}), skipping`);
    return;
  }

  const activeEmployees = await db
    .select({
      id: schema.employees.id,
      baseSalary: schema.employees.baseSalary,
      status: schema.employees.status,
      sectorId: schema.employees.sectorId,
    })
    .from(schema.employees)
    .where(eq(schema.employees.status, "activo"));

  const periods = lastNMonths(12);
  const fees: schema.InsertEmployeeFee[] = [];

  for (const emp of activeEmployees) {
    for (let pi = 0; pi < periods.length; pi++) {
      const period = periods[pi]!;
      const dueDate = periodToDate(period);
      dueDate.setDate(28); // due end of month

      // Last month: pending; older: mostly paid
      let status: schema.FeePaymentStatus;
      if (pi === periods.length - 1) {
        status = "pendiente";
      } else if (pi === periods.length - 2 && Math.random() > 0.7) {
        status = "parcial";
      } else {
        status = "pagado";
      }

      const paidAt =
        status === "pagado"
          ? new Date(dueDate.getTime() + Math.random() * 5 * 86400000)
          : undefined;

      fees.push({
        employeeId: emp.id,
        period,
        amount: emp.baseSalary,
        cashboxId: pick(cashboxIds),
        status,
        dueDate,
        paidAt,
        notes: status === "parcial" ? "Pago parcial — resto pendiente." : undefined,
      });
    }
  }

  try {
    const CHUNK = 200;
    for (let i = 0; i < fees.length; i += CHUNK) {
      await db.insert(schema.employeeFees).values(fees.slice(i, i + CHUNK));
    }
    await db.execute(
      sql`SELECT setval('employee_fees_id_seq', COALESCE((SELECT MAX(id)+1 FROM employee_fees), 1), false)`
    );
    log.ok(`${fees.length} employee fee records inserted`);
  } catch (err) {
    log.error(`Employee fees failed: ${err}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE PAYMENTS (salary disbursements for paid fees)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevEmployeePayments(cashboxIds: string[]): Promise<void> {
  log.section("DEV — EMPLOYEE PAYMENTS");
  if (cashboxIds.length === 0) {
    log.warn("No cashboxes — skipping employee payments");
    return;
  }

  const existing = await db
    .select({ id: schema.employeePayments.id })
    .from(schema.employeePayments);
  if (existing.length > 0) {
    log.warn(`Employee payments already exist (${existing.length}), skipping`);
    return;
  }

  const paidFees = await db
    .select({
      id: schema.employeeFees.id,
      employeeId: schema.employeeFees.employeeId,
      amount: schema.employeeFees.amount,
      cashboxId: schema.employeeFees.cashboxId,
      paidAt: schema.employeeFees.paidAt,
      status: schema.employeeFees.status,
    })
    .from(schema.employeeFees)
    .where(eq(schema.employeeFees.status, "pagado"));

  const methods: schema.SalaryPaymentMethod[] = ["efectivo", "transferencia", "cheque"];

  const payments: schema.InsertEmployeePayment[] = paidFees.map((fee) => ({
    employeeId: fee.employeeId,
    feeId: fee.id,
    amountPaid: fee.amount,
    paymentMethod: pick(methods),
    cashboxId: fee.cashboxId,
    receiptNumber: `SAL-${String(Math.floor(Math.random() * 90000) + 10000)}`,
    processedByUserId: "system",
    notes: undefined,
  }));

  try {
    const CHUNK = 200;
    for (let i = 0; i < payments.length; i += CHUNK) {
      await db.insert(schema.employeePayments).values(payments.slice(i, i + CHUNK));
    }
    await db.execute(
      sql`SELECT setval('employee_payments_id_seq', COALESCE((SELECT MAX(id)+1 FROM employee_payments), 1), false)`
    );
    log.ok(`${payments.length} employee payment records inserted`);
  } catch (err) {
    log.error(`Employee payments failed: ${err}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${c.cyan}${c.bold}╔══════════════════════════════╗`);
  console.log(`║   DEV MOCK — extended seed   ║`);
  console.log(`╚══════════════════════════════╝${c.reset}\n`);

  // Resolve cashbox IDs (base mock must have run already)
  const cashboxRows = await db
    .select({ id: schema.cashboxes.id })
    .from(schema.cashboxes);
  const cashboxIds = cashboxRows.map((r) => r.id);

  if (cashboxIds.length === 0) {
    log.error("No cashboxes found. Run `bun run db:mock` first.");
    process.exit(1);
  }

  // ── Contractors ──────────────────────────────────────────────────────────
  const contractorIds = await seedDevContractors();
  await seedDevContractorPayments(contractorIds, cashboxIds);

  // ── Tenants ──────────────────────────────────────────────────────────────
  const tenantIds = await seedDevTenants();
  await seedDevTenantPayments(tenantIds, cashboxIds);

  // ── Employees ────────────────────────────────────────────────────────────
  await seedDevEmployees();
  await seedDevEmployeeFees(cashboxIds);
  await seedDevEmployeePayments(cashboxIds);

  console.log(`\n${c.green}${c.bold}✔ DEV mock complete.${c.reset}\n`);
}

await main();
