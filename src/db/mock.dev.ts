/**
 * mock.dev.ts — DEV-ONLY extended seed
 */

import { db } from "@/db";
import * as schema from "@/db/schema";
import { sql, eq } from "drizzle-orm";

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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function daysAgo(days: number): Date {
  const d = new Date(); d.setDate(d.getDate() - days); return d;
}
function toPeriod(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    months.push(toPeriod(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return months;
}
function periodToDate(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(y!, m! - 1, 1);
}
function randomPhone() {
  const prefixes = ["70","71","72","73","74","75","76","77","78"];
  return `${pick(prefixes)}${Math.floor(1000000 + Math.random() * 9000000)}`;
}
function randomCI() {
  return `${Math.floor(1000000 + Math.random() * 8000000)}`;
}
function randomAmount(min: number, max: number, step = 50): number {
  return min + Math.floor(Math.random() * Math.floor((max - min) / step)) * step;
}
function toDecimal(n: number): string {
  return n.toFixed(2);
}

const BOLIVIAN_NAMES = [
  "Carlos Mamani","Rosa Quispe","Juan Flores","María Condori","Pedro Vargas",
  "Ana Gutierrez","Luis Apaza","Elena Choque","Roberto Limachi","Carla Ticona",
  "Fidel Machaca","Sandra Huanca","Gonzalo Marca","Patricia Mamani","Víctor Colque",
  "Nora Quispe","Ernesto Tarqui","Silvia Poma","Marcelo Calle","Lucía Zenteno",
  "Fernando Rojas","Beatriz Salinas","Oscar Pedraza","Claudia Vega","Ramiro Morales",
  "Estela Paredes","Hugo Balboa","Miriam Escobar","Eduardo Roca","Graciela Soliz",
  "Alvaro Montes","Daniela Quiroga","Renato Serrano","Verónica Bravo","Sergio Antelo",
  "Lorena Valdivia","Ignacio Rivero","Carmen Durán","Rodrigo Paz","Natalia Villca",
];
const SPECIALTIES = [
  "Electricista","Plomero","Albanil","Carpintero","Pintor","Soldador",
  "Mecánico","Gasfitero","Técnico en HVAC","Cerrajero","Jardinero","Limpieza industrial",
];
const ROOM_FLOORS: Array<{ room: string; floor: string }> = [
  { room: "101", floor: "1" },{ room: "102", floor: "1" },
  { room: "103", floor: "1" },{ room: "104", floor: "1" },
  { room: "201", floor: "2" },{ room: "202", floor: "2" },
  { room: "203", floor: "2" },{ room: "204", floor: "2" },
  { room: "301", floor: "3" },{ room: "302", floor: "3" },
  { room: "303", floor: "3" },{ room: "304", floor: "3" },
  { room: "LOC-A", floor: "PB" },{ room: "LOC-B", floor: "PB" },
  { room: "LOC-C", floor: "PB" },{ room: "DEP-1", floor: "SS" },
];
const CHARGE_TITLES = [
  "Secretario General","Secretario de Hacienda","Secretario de Actas","Vocal","Fiscal",
  "Asesor Legal","Contador","Aux. Contabilidad","Encargado de Caja","Portero",
  "Limpieza","Chofer","Vigilante",
];
const CITIES = ["SC","CB","LP","OR","PT","TJ","BE","PD","CH"];

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM CATEGORY — get or create
// ─────────────────────────────────────────────────────────────────────────────

async function getOrCreateSystemCategory(
  code: string,
  name: string,
  type: "income" | "outcome",
): Promise<string> {
  const [existing] = await db
    .select({ id: schema.transactionCategories.id })
    .from(schema.transactionCategories)
    .where(eq(schema.transactionCategories.code, code))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(schema.transactionCategories)
    .values({ code, name, type, sortOrder: 0, isSystem: true, status: true, createdByUserId: "system" })
    .returning({ id: schema.transactionCategories.id });
  return created!.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTORS
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevContractors(): Promise<number[]> {
  log.section("DEV — CONTRACTORS");
  try {
    const existing = await db.select({ id: schema.contractors.id }).from(schema.contractors);
    if (existing.length > 0) {
      log.warn(`Contractors already exist (${existing.length}), skipping`);
      return existing.map((r) => r.id);
    }
    const pool: schema.InsertContractor[] = BOLIVIAN_NAMES.slice(0, 20).map((fullName, i) => ({
      fullName,
      ci: randomCI(),
      ruc: i % 3 === 0 ? `${randomCI()}-1` : undefined,
      phone: randomPhone(),
      email: i % 2 === 0 ? `${fullName.split(" ")[0]!.toLowerCase()}.${i}@gmail.com` : undefined,
      address: `Barrio ${pick(["La Paz","Centro","Norte","Sur","El Prado"])}, Calle ${Math.floor(Math.random() * 30) + 1}`,
      specialty: pick(SPECIALTIES),
      status: i < 16 ? "activo" : "inactivo",
      notes: i % 4 === 0 ? "Proveedor frecuente, buen historial." : undefined,
      createdByUserId: "system",
    }));
    const inserted = await db.insert(schema.contractors).values(pool).returning({ id: schema.contractors.id });
    log.ok(`${inserted.length} contractors inserted`);
    return inserted.map((r) => r.id);
  } catch (err) {
    log.error(`Contractors seed failed: ${err}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTOR PAYMENTS
// Each payment requires a finance.transaction row first — then contractorPayments links to it.
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevContractorPayments(
  contractorIds: number[],
  cashboxIds: string[],
): Promise<void> {
  log.section("DEV — CONTRACTOR PAYMENTS");
  if (contractorIds.length === 0 || cashboxIds.length === 0) {
    log.warn("No contractors or cashboxes — skipping");
    return;
  }
  const existing = await db.select({ id: schema.contractorPayments.id }).from(schema.contractorPayments);
  if (existing.length > 0) {
    log.warn(`Contractor payments already exist (${existing.length}), skipping`);
    return;
  }

  const categoryId = await getOrCreateSystemCategory("CONTRATISTA", "Pago a contratistas", "outcome");

  const concepts = [
    "Reparación eléctrica sala de reuniones","Mantenimiento de plomería baños",
    "Pintura fachada principal","Instalación de cerraduras","Limpieza industrial mensual",
    "Reparación de estructura metálica","Mantenimiento de jardines",
    "Servicio de soldadura puerta principal","Revisión sistema HVAC","Arreglo de piso cerámica",
  ];

  // Fetch cashbox balances so we can compute balanceAfter
  const cashboxRows = await db
    .select({ id: schema.cashboxes.id, balance: schema.cashboxes.balance })
    .from(schema.cashboxes);
  const balanceMap = new Map(cashboxRows.map((r) => [r.id, parseFloat(r.balance ?? "0")]));

  for (const contractorId of contractorIds) {
    const nPayments = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < nPayments; i++) {
      const amount = randomAmount(500, 8000, 100);
      const cashboxId = pick(cashboxIds);
      const concept = pick(concepts);
      const createdAt = daysAgo(Math.floor(Math.random() * 365));

      const currentBalance = balanceMap.get(cashboxId) ?? 0;
      const newBalance = Math.max(0, currentBalance - amount);
      balanceMap.set(cashboxId, newBalance);

      await db.transaction(async (tx) => {
        const [financeTx] = await tx
          .insert(schema.transactions)
          .values({
            type: "withdraw",
            amount: toDecimal(amount),
            categoryId,
            concept: `Pago contratista — ${concept}`,
            cashboxId,
            createdByUserId: "system",
            status: "completado",
            balanceAfter: toDecimal(newBalance),
            linkedEntityType: "contractor_payment",
            createdAt,
          })
          .returning({ id: schema.transactions.id });

        await tx.insert(schema.contractorPayments).values({
          contractorId,
          transactionId: financeTx!.id,
          concept,
          receiptNumber: `REC-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          notes: Math.random() > 0.6 ? "Pago aprobado por directorio." : undefined,
          processedByUserId: "system",
        });
      });
    }
  }
  log.ok(`Contractor payments inserted`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANTS
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevTenants(): Promise<number[]> {
  log.section("DEV — TENANTS");
  try {
    const existing = await db.select({ id: schema.tenants.id }).from(schema.tenants);
    if (existing.length > 0) {
      log.warn(`Tenants already exist (${existing.length}), skipping`);
      return existing.map((r) => r.id);
    }
    const pool: schema.InsertTenant[] = ROOM_FLOORS.map((rf, i) => {
      const name = BOLIVIAN_NAMES[20 + i] ?? BOLIVIAN_NAMES[i]!;
      const status: schema.TenantStatus = i < 2 ? "moroso" : i < 4 ? "inactivo" : "activo";
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - (Math.floor(Math.random() * 24) + 6));
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
    const inserted = await db.insert(schema.tenants).values(pool).returning({ id: schema.tenants.id });
    log.ok(`${inserted.length} tenants inserted`);
    return inserted.map((r) => r.id);
  } catch (err) {
    log.error(`Tenants seed failed: ${err}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT PAYMENTS
// Paid rows get a transaction first; pending/anulado rows have no transaction.
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevTenantPayments(
  tenantIds: number[],
  cashboxIds: string[],
): Promise<void> {
  log.section("DEV — TENANT PAYMENTS");
  if (tenantIds.length === 0 || cashboxIds.length === 0) {
    log.warn("No tenants or cashboxes — skipping");
    return;
  }
  const existing = await db.select({ id: schema.tenantPayments.id }).from(schema.tenantPayments);
  if (existing.length > 0) {
    log.warn(`Tenant payments already exist (${existing.length}), skipping`);
    return;
  }

  const categoryId = await getOrCreateSystemCategory("ALQUILER", "Cobro de alquiler", "income");

  const tenantRows = await db
    .select({ id: schema.tenants.id, monthlyRent: schema.tenants.monthlyRent, status: schema.tenants.status })
    .from(schema.tenants);

  const periods = lastNMonths(14);

  // Pending/anulado rows — batch insert (no transaction needed)
  const pendingRows: schema.InsertTenantPayment[] = [];

  for (const tenant of tenantRows) {
    for (let pi = 0; pi < periods.length; pi++) {
      const period = periods[pi]!;
      const dueDate = periodToDate(period);
      dueDate.setDate(5);
      const amount = Number(tenant.monthlyRent);

      let status: schema.RentPaymentStatus;
      if (tenant.status === "inactivo") {
        status = "anulado";
      } else if (tenant.status === "moroso" && pi >= periods.length - 2) {
        status = "pendiente";
      } else if (tenant.status === "activo" && pi === periods.length - 1) {
        status = Math.random() > 0.5 ? "pendiente" : "pagado";
      } else {
        status = Math.random() > 0.05 ? "pagado" : "parcial";
      }

      if (status === "pendiente" || status === "anulado") {
        pendingRows.push({
          tenantId: tenant.id,
          period,
          amount,
          status,
          dueDate,
        });
      } else {
        // Paid/parcial — need a transaction row
        const cashboxId = pick(cashboxIds);
        const createdAt = new Date(dueDate.getTime() + Math.random() * 10 * 86400000);

        await db.transaction(async (tx) => {
          const [financeTx] = await tx
            .insert(schema.transactions)
            .values({
              type: "deposit",
              amount: toDecimal(amount),
              categoryId,
              concept: `Alquiler ${period} — Amb. ${tenant.id}`,
              cashboxId,
              createdByUserId: "system",
              status: "completado",
              linkedEntityType: "tenant_payment",
              createdAt,
            })
            .returning({ id: schema.transactions.id });

          await tx.insert(schema.tenantPayments).values({
            tenantId: tenant.id,
            period,
            amount,
            status,
            dueDate,
            receiptNumber: status === "pagado"
              ? `ALQ-${String(Math.floor(Math.random() * 9000) + 1000)}`
              : undefined,
            notes: status === "parcial" ? "Pago parcial acordado con directorio." : undefined,
            transactionId: financeTx!.id,
          });
        });
      }
    }
  }

  // Batch insert pending/anulado rows
  if (pendingRows.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < pendingRows.length; i += CHUNK) {
      await db.insert(schema.tenantPayments).values(pendingRows.slice(i, i + CHUNK));
    }
  }

  log.ok(`Tenant payment records inserted`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevEmployees(): Promise<number[]> {
  log.section("DEV — EMPLOYEES");
  try {
    const existing = await db.select({ id: schema.employees.id }).from(schema.employees);
    if (existing.length > 0) {
      log.warn(`Employees already exist (${existing.length}), skipping`);
      return existing.map((r) => r.id);
    }
    const allSectors = await db
      .select({ id: schema.sectors.id })
      .from(schema.sectors)
      .where(eq(schema.sectors.isActive, true));
    if (allSectors.length === 0) {
      log.warn("No active sectors — skipping employees");
      return [];
    }
    const pool: schema.InsertEmployee[] = BOLIVIAN_NAMES.slice(0, 25).map((fullName, i) => {
      const hiresAgo = Math.floor(Math.random() * 1800) + 90;
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
        address: `Av. ${pick(["Blanco Galindo","Uyuni","Aniceto Arce","6 de Agosto"])} Km ${Math.floor(Math.random() * 15) + 1}`,
        employeeType: type,
        chargeTitle: pick(CHARGE_TITLES),
        sectorId: pick(allSectors).id,
        hireDate: daysAgo(hiresAgo),
        terminationDate: status === "baja" ? daysAgo(15) : undefined,
        baseSalary: type === "directorio" ? randomAmount(3000, 8000, 500) : randomAmount(1500, 4000, 250),
        status,
        notes: status === "suspendido" ? "Suspendido por resolución interna #2025-14." : undefined,
        createdByUserId: "system",
      };
    });
    const inserted = await db.insert(schema.employees).values(pool).returning({ id: schema.employees.id });
    await db.execute(sql`SELECT setval('employees_id_seq', COALESCE((SELECT MAX(id)+1 FROM employees), 1), false)`);
    log.ok(`${inserted.length} employees inserted`);
    return inserted.map((r) => r.id);
  } catch (err) {
    log.error(`Employees seed failed: ${err}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE FEES
// Paid fees get a transaction row; transactionId is set on the fee directly.
// seedDevEmployeePayments is REMOVED — bridge table no longer exists.
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDevEmployeeFees(cashboxIds: string[]): Promise<void> {
  log.section("DEV — EMPLOYEE FEES");
  if (cashboxIds.length === 0) {
    log.warn("No cashboxes — skipping employee fees");
    return;
  }
  const existing = await db.select({ id: schema.employeeFees.id }).from(schema.employeeFees);
  if (existing.length > 0) {
    log.warn(`Employee fees already exist (${existing.length}), skipping`);
    return;
  }

  const categoryId = await getOrCreateSystemCategory("SALARIO", "Pago de salarios", "outcome");

  const activeEmployees = await db
    .select({ id: schema.employees.id, baseSalary: schema.employees.baseSalary })
    .from(schema.employees)
    .where(eq(schema.employees.status, "activo"));

  const periods = lastNMonths(12);
  const pendingFees: schema.InsertEmployeeFee[] = [];

  for (const emp of activeEmployees) {
    for (let pi = 0; pi < periods.length; pi++) {
      const period = periods[pi]!;
      const dueDate = periodToDate(period);
      dueDate.setDate(28);
      const amount = Number(emp.baseSalary);

      let status: schema.FeePaymentStatus;
      if (pi === periods.length - 1) {
        status = "pendiente";
      } else if (pi === periods.length - 2 && Math.random() > 0.7) {
        status = "parcial";
      } else {
        status = "pagado";
      }

      if (status === "pendiente" || status === "parcial") {
        pendingFees.push({
          employeeId: emp.id,
          period,
          amount,
          status,
          dueDate,
          paymentMethod: "efectivo",
        });
      } else {
        // Paid — create transaction first, then fee with transactionId
        const cashboxId = pick(cashboxIds);
        const createdAt = new Date(dueDate.getTime() + Math.random() * 5 * 86400000);

        await db.transaction(async (tx) => {
          const [financeTx] = await tx
            .insert(schema.transactions)
            .values({
              type: "withdraw",
              amount: toDecimal(amount),
              categoryId,
              concept: `Salario ${period} — Empleado #${emp.id}`,
              cashboxId,
              createdByUserId: "system",
              status: "completado",
              linkedEntityType: "employee_fee",
              createdAt,
            })
            .returning({ id: schema.transactions.id });

          await tx.insert(schema.employeeFees).values({
            employeeId: emp.id,
            period,
            amount,
            status,
            dueDate,
            paymentMethod: pick(["efectivo", "transferencia", "cheque"] as schema.SalaryPaymentMethod[]),
            transactionId: financeTx!.id,
          });
        });
      }
    }
  }

  // Batch insert pending/parcial fees
  if (pendingFees.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < pendingFees.length; i += CHUNK) {
      await db.insert(schema.employeeFees).values(pendingFees.slice(i, i + CHUNK));
    }
  }

  await db.execute(sql`SELECT setval('employee_fees_id_seq', COALESCE((SELECT MAX(id)+1 FROM employee_fees), 1), false)`);
  log.ok(`Employee fee records inserted`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${c.cyan}${c.bold}╔══════════════════════════════╗`);
  console.log(`║   DEV MOCK — extended seed   ║`);
  console.log(`╚══════════════════════════════╝${c.reset}\n`);

  const cashboxRows = await db.select({ id: schema.cashboxes.id }).from(schema.cashboxes);
  const cashboxIds = cashboxRows.map((r) => r.id);
  if (cashboxIds.length === 0) {
    log.error("No cashboxes found. Run `bun run db:mock` first.");
    process.exit(1);
  }

  const contractorIds = await seedDevContractors();
  await seedDevContractorPayments(contractorIds, cashboxIds);

  const tenantIds = await seedDevTenants();
  await seedDevTenantPayments(tenantIds, cashboxIds);

  await seedDevEmployees();
  await seedDevEmployeeFees(cashboxIds);
  // seedDevEmployeePayments — REMOVED, bridge table deleted from schema

  console.log(`\n${c.green}${c.bold}✔ DEV mock complete.${c.reset}\n`);
}

await main();
