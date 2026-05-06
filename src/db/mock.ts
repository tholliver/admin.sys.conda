import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/auth";
import { sql, eq } from "drizzle-orm";

const c = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m",
};

const log = {
  info: (msg: string) => console.log(`${c.blue}  ${msg}${c.reset}`),
  ok: (msg: string) => console.log(`${c.green}✔ ${msg}${c.reset}`),
  warn: (msg: string) => console.warn(`${c.yellow}⚠ ${msg}${c.reset}`),
  error: (msg: string) => console.error(`${c.red}✖ ${msg}${c.reset}`),
  section: (msg: string) => console.log(`\n${c.cyan}${c.bold}━━ ${msg} ━━${c.reset}`),
};

// ==================== USERS ====================

export async function seedUsers() {
  log.section("USERS");
  for (const user of SYS_USERS) {
    try {
      const { role, ...body } = user;
      const res = await auth.api.signUpEmail({ body, asResponse: true });
      if (res.ok) {
        const record = await db.execute(sql`SELECT id FROM auth.user WHERE email = ${user.email}`);
        if (record.rows[0]) {
          await db.execute(sql`UPDATE auth.user SET role = ${role} WHERE id = ${record.rows[0].id}`);
          log.ok(`${user.email} → role: ${role}`);
        }
      } else {
        log.warn(`${user.email} already exists or signup failed`);
      }
    } catch (err) {
      log.warn(`Could not create ${user.email}: ${err}`);
    }
  }
}

export async function deleteUsers() {
  log.section("DELETE USERS");
  for (const user of SYS_USERS) {
    try {
      await db.execute(sql`DELETE FROM auth.user WHERE email = ${user.email}`);
      log.ok(`Deleted: ${user.email}`);
    } catch (err) {
      log.warn(`Could not delete ${user.email}: ${err}`);
    }
  }
}

export async function seedCategories() {
  log.section("TRANSACTION CATEGORIES");
  try {
    const categoriesBase = TRANSACTION_CATEGORIES.map(({ invoiceRangeCode: _omit, ...rest }) => rest);
    await db.insert(schema.transactionCategories).values(categoriesBase);
    log.ok(`${TRANSACTION_CATEGORIES.length} categories inserted`);
  } catch {
    log.warn("Categories already exist, skipping");
    return;
  }
}

async function seedInvoiceRanges() {
  log.section("INVOICE RANGES");
  try {
    await db.insert(schema.invoiceRanges).values(INVOICE_RANGES_DATA);
    log.ok(`${INVOICE_RANGES_DATA.length} invoice ranges inserted`);
  } catch {
    log.warn("Invoice ranges already exist, skipping");
  }
}

export async function seedCashbox() {
  log.section("CASHBOX");
  try {
    const existing = await db
      .select({ code: schema.cashboxes.code })
      .from(schema.cashboxes);
    const existingCodes = new Set(existing.map((row) => row.code));

    const toInsert = CASHBOXES_DATA.filter(
      (cashbox) => !existingCodes.has(cashbox.code),
    );

    if (toInsert.length === 0) {
      log.warn("Cashboxes already exist, skipping");
      return;
    }

    await db.insert(schema.cashboxes).values(toInsert);
    log.ok(`${toInsert.length} cashboxes inserted`);
  } catch { log.warn("Cashbox already exists, skipping"); }
}

export const INVOICE_RANGES_DATA = [
  // ── Non-system ranges — used by manual cash desk (ingresos form) ──────────
  { code: "REN", category: "Recibos Generales", prefix: "REC", rangeStart: 1, rangeEnd: 9999, current: 0, isSystem: false, authorizationNumber: "REC-00000001", expirationDate: new Date("2026-12-31"), isActive: true },
];

export const TRANSACTION_CATEGORIES = [
  { code: "INC-001", name: "Ingreso por Orden de Salida",                          type: "income",  icon: "route",             description: "Cobro por orden de salida de vehículos",              sortOrder: 1,   isSystem: false, invoiceRangeCode: "OS"   },
  { code: "INC-002", name: "Ingreso por Servicio de Baño, Ducha y Urinario",       type: "income",  icon: "building-2",        description: "Ingresos por uso de servicios sanitarios",            sortOrder: 4,   isSystem: false, invoiceRangeCode: "SRV"  },
  { code: "INC-003", name: "Ingresos por Ventas (Poleras, Chalecos, Viñetas)",     type: "income",  icon: "shopping-bag",      description: "Venta de indumentaria y accesorios oficiales",        sortOrder: 8,   isSystem: false, invoiceRangeCode: "VTA"  },
  { code: "INC-004", name: "Ingreso por Afiliaciones y Reintegro",                 type: "income",  icon: "handshake",         description: "Pago de afiliaciones y reintegros",                   sortOrder: 9,   isSystem: false, invoiceRangeCode: "AFIM" },
  { code: "INC-005", name: "Ingreso por Alquileres",                               type: "income",  icon: "landmark",          description: "Alquiler de ambientes, espacios o bienes",            sortOrder: 6,   isSystem: false, invoiceRangeCode: "ALQ"  },
  { code: "INC-006", name: "Ingreso por Cambio de Herramienta",                    type: "income",  icon: "wrench",            description: "Pago por cambio o reposición de herramienta",         sortOrder: 10,  isSystem: false, invoiceRangeCode: "VTA"  },
  { code: "INC-007", name: "Ingreso por Licencia Indefinida",                      type: "income",  icon: "id-card",           description: "Pago por licencia indefinida",                        sortOrder: 11,  isSystem: false, invoiceRangeCode: "AFIM" },
  { code: "INC-008", name: "Ingreso por Multas",                                   type: "income",  icon: "alert-triangle",    description: "Multas administrativas",                              sortOrder: 3,   isSystem: false, invoiceRangeCode: "MULT" },
  { code: "INC-009", name: "Ingresos por Lavadero",                                type: "income",  icon: "car-front",         description: "Servicios de lavado de vehículos",                    sortOrder: 7,   isSystem: false, invoiceRangeCode: "SRV"  },
  { code: "INC-010", name: "Ingresos por Coliseo Carrasco",                        type: "income",  icon: "shield",            description: "Uso y alquiler del coliseo",                          sortOrder: 12,  isSystem: false, invoiceRangeCode: "ALQ"  },
  { code: "INC-011", name: "Ingresos por Facturacion",                             type: "income",  icon: "receipt",           description: "Ingresos por emision de facturas",                    sortOrder: 13,  isSystem: false, invoiceRangeCode: "GEN"  },
  { code: "INC-012", name: "Ingresos por Auto Indocumentado",                      type: "income",  icon: "file-text",         description: "Multas por vehículo sin documentación",               sortOrder: 14,  isSystem: false, invoiceRangeCode: "MULT" },
  { code: "INC-013", name: "Ingresos por Certificación",                           type: "income",  icon: "badge-check",       description: "Emisión de certificados",                             sortOrder: 5,   isSystem: false, invoiceRangeCode: "CERT" },
  { code: "INC-014", name: "Ingresos por Retrasos y Licencias a Reuniones",        type: "income",  icon: "calendar-check",    description: "Multas por retrasos o licencias",                     sortOrder: 15,  isSystem: false, invoiceRangeCode: "MULT" },
  { code: "INC-015", name: "Ingreso por Deportes",                                 type: "income",  icon: "ticket",            description: "Actividades deportivas",                              sortOrder: 16,  isSystem: false, invoiceRangeCode: "GEN"  },
  { code: "INC-016", name: "Ingreso por Cuota Mensual",                            type: "income",  icon: "hand-coins",        description: "Pago mensual de afiliados",                           sortOrder: 2,   isSystem: false, invoiceRangeCode: "CMS"  },
  { code: "INC-017", name: "Ingreso por Consumo de Energía Eléctrica",             type: "income",  icon: "banknote",          description: "Cobro por consumo eléctrico",                         sortOrder: 17,  isSystem: false, invoiceRangeCode: "SRV"  },
  { code: "INC-018", name: "Ingresos por Pérdida de Panter y Viñeta",              type: "income",  icon: "badge-dollar-sign", description: "Reposición de panter o viñeta extraviada",            sortOrder: 18,  isSystem: false, invoiceRangeCode: "VTA"  },
  { code: "INC-019", name: "Ingresos Apoyo Parada",                                type: "income",  icon: "users",             description: "Aportes de apoyo a la parada",                        sortOrder: 19,  isSystem: false, invoiceRangeCode: "GEN"  },
  { code: "INC-020", name: "Ingresos por Ayuda Social",                            type: "income",  icon: "handshake",         description: "Aportes y ayudas sociales",                           sortOrder: 20,  isSystem: false, invoiceRangeCode: "GEN"  },
  { code: "INC-021", name: "Otros Ingresos",                                       type: "income",  icon: "circle-dollar-sign",description: "Ingresos no clasificados",                            sortOrder: 21,  isSystem: false, invoiceRangeCode: "GEN"  },
  { code: "OUT-001", name: "Gastos de Funcionamiento (Urbano)",                    type: "outcome", icon: "bus",               description: "Gastos operativos del transporte urbano",             sortOrder: 7,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-002", name: "Gastos de Funcionamiento (Minibuses)",                 type: "outcome", icon: "bus",               description: "Gastos operativos de minibuses",                      sortOrder: 8,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-003", name: "Gastos de Funcionamiento (Buses y Micros)",            type: "outcome", icon: "bus",               description: "Gastos operativos de buses y micros",                 sortOrder: 9,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-004", name: "Gastos de Funcionamiento (Camiones)",                  type: "outcome", icon: "car-front",         description: "Gastos operativos de camiones",                       sortOrder: 10,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-005", name: "Gastos de Funcionamiento (Puerto Villarroel)",         type: "outcome", icon: "map",               description: "Operaciones regionales Puerto Villarroel",             sortOrder: 11,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-006", name: "Gastos de Operación y Funcionamiento (Camiones)",      type: "outcome", icon: "car-front",         description: "Operación general de camiones",                       sortOrder: 12,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-007", name: "Gastos de Operación y Funcionamiento (Chata)",         type: "outcome", icon: "car-front",         description: "Operación de chata",                                  sortOrder: 13,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-008", name: "Gastos de Funcionamiento de Volquetas",                type: "outcome", icon: "car-front",         description: "Funcionamiento de volquetas",                         sortOrder: 14,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-009", name: "Gastos de Operación y Funcionamiento (Moto Censo)",    type: "outcome", icon: "route",             description: "Operación de motos",                                  sortOrder: 15,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-010", name: "Viáticos Directorio",                                  type: "outcome", icon: "wallet",            description: "Viáticos del directorio",                             sortOrder: 2,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-011", name: "Viáticos Fiscalía",                                    type: "outcome", icon: "wallet",            description: "Viáticos de fiscalía",                                sortOrder: 16,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-012", name: "Pasajes y Viáticos Secretario de Transporte",          type: "outcome", icon: "wallet",            description: "Pasajes y viáticos institucionales",                  sortOrder: 17,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-013", name: "Gastos en Refrigerio",                                 type: "outcome", icon: "shopping-bag",      description: "Refrigerios en reuniones y eventos",                  sortOrder: 3,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-014", name: "Gastos Generales de Administración",                   type: "outcome", icon: "clipboard-list",    description: "Gastos administrativos generales",                    sortOrder: 1,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-015", name: "Gastos por Tributos",                                  type: "outcome", icon: "landmark",          description: "Impuestos y tasas",                                   sortOrder: 5,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-016", name: "Material e Insumos de Baño Público",                   type: "outcome", icon: "building-2",        description: "Compra de insumos sanitarios",                        sortOrder: 18,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-017", name: "Gastos del Campeonato",                                type: "outcome", icon: "ticket",            description: "Eventos deportivos",                                  sortOrder: 19,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-018", name: "Compra de Materiales, Herramientas y Equipos",         type: "outcome", icon: "hammer",            description: "Compra de activos y herramientas",                    sortOrder: 4,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-019", name: "Otros Gastos de Operación",                            type: "outcome", icon: "clipboard-list",    description: "Gastos operativos no clasificados",                   sortOrder: 20,  isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-020", name: "Ayudas Sociales",                                      type: "outcome", icon: "handshake",         description: "Ayudas y aportes sociales",                           sortOrder: 6,   isSystem: false, invoiceRangeCode: null   },
  { code: "OUT-021", name: "Otros Gastos",                                         type: "outcome", icon: "credit-card",       description: "Egresos no clasificados",                             sortOrder: 21,  isSystem: false, invoiceRangeCode: null   },
  { code: "TRANSFER",    name: "Transferencias internas",             type: "outcome", icon: "arrow-right-left", description: "Cuenta para transferencias entre cajas y/o salidas",   sortOrder: 0, isSystem: true, invoiceRangeCode: null },
  { code: "TRANSFER_IN", name: "Ingreso por Transferencia Interna",  type: "income",  icon: "arrow-right-left", description: "Fondos recibidos desde otra caja o sector",          sortOrder: 0, isSystem: true, invoiceRangeCode: null },
  { code: "CONTRATISTA", name: "Pago a contratistas",                type: "outcome", icon: "handshake",        description: "Cuenta de sistema para pagos a contratistas",        sortOrder: 0, isSystem: true, invoiceRangeCode: null },
];

export const SYS_USERS = [
  { name: "ADMINISTRACION", email: "admin@carrasco.com", password: "camaleon54ruta", ci: "8888888", role: "ADMIN" },
];

export const CASHBOXES_DATA = [
  // ── GENERAL — no sector linked, used for admin/global ops ────────────
  { name: "Caja General",          code: "GEN", description: "Caja administrativa general sin sector asignado",  balance: "0", creditLimit: "0", status: "activo" as const },

  // ── ONE CASHBOX PER SECTOR ────────────────────────────────────────────
  { name: "Caja Grupos 1-4",       code: "GRP", description: "Caja compartida grupos 1 al 4",                   balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Radio Movil",      code: "RMV", description: "Caja para Radio Movil",                           balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Puerto Villarroel",code: "PVL", description: "Caja para Puerto Villarroel",                     balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Taxis Valle Sacta",code: "TVS", description: "Caja para Taxis Valle Sacta",                     balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Motos Valle Sacta",code: "MVS", description: "Caja para Motos Valle Sacta",                     balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Taxis Ayopaya",    code: "TAY", description: "Caja para Taxis Ayopaya",                         balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Motos Ayopaya",    code: "MAY", description: "Caja para Motos Ayopaya",                         balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Taxi Valle Tunari",code: "TVT", description: "Caja para Taxi Valle Tunari",                     balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Motos Valle Tunari",code:"MVT", description: "Caja para Motos Valle Tunari",                    balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Taxi Senda VI",    code: "TS6", description: "Caja para Taxi Senda VI",                         balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Motos Senda VI",   code: "MS6", description: "Caja para Motos Senda VI",                        balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Taxi Senda V",     code: "TS5", description: "Caja para Taxi Senda V",                          balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Motos Senda V",    code: "MS5", description: "Caja para Motos Senda V",                         balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Taxi Israel",      code: "TIS", description: "Caja para Taxi Israel",                           balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Minibuses",        code: "MIN", description: "Caja para Minibuses",                             balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Taxi Mariposas",   code: "TMA", description: "Caja para Taxi Mariposas",                        balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Motos Mariposas",  code: "MMA", description: "Caja para Motos Mariposas",                       balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Nueva Estrella",   code: "NES", description: "Caja para Nueva Estrella",                        balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Moto Central",     code: "MCT", description: "Caja para Moto Central",                          balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Camionetas",       code: "CMT", description: "Caja para Camionetas",                            balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Micros",           code: "MIC", description: "Caja para Micros",                                balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Buses",            code: "BUS", description: "Caja para Buses",                                 balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Camiones",         code: "CAM", description: "Caja para Camiones",                              balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Volquetas",        code: "VOL", description: "Caja para Volquetas",                             balance: "0", creditLimit: "0", status: "activo" as const },
  { name: "Caja Chata Tolva",      code: "CHT", description: "Caja para Chata Tolva",                           balance: "0", creditLimit: "0", status: "activo" as const },
];

await seedCashbox();
await seedCategories();
await seedInvoiceRanges();  // ranges first — categories link to them
await seedUsers();
