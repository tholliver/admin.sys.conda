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
    // Insert categories without invoiceRangeId first (column may not exist yet if migration pending)
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

export async function seedSectors() {
  log.section("SECTORS");
  try {
    const allCashboxes = await db
      .select({ id: schema.cashboxes.id, code: schema.cashboxes.code })
      .from(schema.cashboxes);

    if (allCashboxes.length === 0) {
      log.warn("No cashboxes found, skipping sectors");
      return;
    }

    const sortedCashboxes = allCashboxes.sort((a, b) =>
      a.code.localeCompare(b.code),
    );

    const sectorsToInsert = SECTORS_DATA.map((sector, index) => ({
      ...sector,
      cashboxId: sortedCashboxes[index % sortedCashboxes.length]!.id,
    }));

    await db.insert(schema.sectors).values(sectorsToInsert);
    await db.execute(sql`SELECT setval('sectors_id_seq', COALESCE((SELECT MAX(id)+1 FROM sectors), 1), false)`);
    log.ok(`${SECTORS_DATA.length} sectors inserted`);
  } catch (error) { log.warn(`Sectors already exist, skipping, ${error}`); }
}

export const INVOICE_RANGES_DATA = [
  // ── Non-system ranges — used by manual cash desk (ingresos form) ──────────
  {
    // Certificaciones y documentos — INC-013
    code: "CERT",
    category: "Recibos de Certificacion",
    prefix: "CERT",
    rangeStart: 1,
    rangeEnd: 9999,
    current: 0,
    isSystem: false,
    authorizationNumber: "CERT-00000001",
    expirationDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    // Orden de salida — INC-001
    code: "OS",
    category: "Recibos de Orden de Salida",
    prefix: "OS",
    rangeStart: 1,
    rangeEnd: 99999,
    current: 0,
    isSystem: false,
    authorizationNumber: "OS-00000001",
    expirationDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    // Alquileres — INC-005, INC-010
    code: "ALQ",
    category: "Recibos de Alquiler",
    prefix: "ALQ",
    rangeStart: 1,
    rangeEnd: 9999,
    current: 0,
    isSystem: false,
    authorizationNumber: "ALQ-00000001",
    expirationDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    // Servicios de instalaciones — INC-002, INC-009, INC-017
    code: "SRV",
    category: "Recibos de Servicios",
    prefix: "SRV",
    rangeStart: 1,
    rangeEnd: 99999,
    current: 0,
    isSystem: false,
    authorizationNumber: "SRV-00000001",
    expirationDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    // Cuota mensual — INC-016
    code: "CMS",
    category: "Recibos de Cuota Mensual",
    prefix: "CMS",
    rangeStart: 1,
    rangeEnd: 999999,
    current: 0,
    isSystem: false,
    authorizationNumber: "CMS-00000001",
    expirationDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    // Ventas manuales en caja — INC-003, INC-006, INC-018
    code: "VTA",
    category: "Recibos de Venta",
    prefix: "VTA",
    rangeStart: 1,
    rangeEnd: 99999,
    current: 0,
    isSystem: false,
    authorizationNumber: "VTA-00000001",
    expirationDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    // Afiliaciones manuales en caja — INC-004, INC-007
    code: "AFIM",
    category: "Recibos de Afiliacion",
    prefix: "AFIM",
    rangeStart: 1,
    rangeEnd: 99999,
    current: 0,
    isSystem: false,
    authorizationNumber: "AFIM-00000001",
    expirationDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    // Ingresos generales — INC-011, INC-015, INC-019, INC-020, INC-021
    code: "GEN",
    category: "Recibos Generales",
    prefix: "GEN",
    rangeStart: 1,
    rangeEnd: 99999,
    current: 0,
    isSystem: false,
    authorizationNumber: "GEN-00000001",
    expirationDate: new Date("2026-12-31"),
    isActive: true,
  },
];

export const TRANSACTION_CATEGORIES = [
  { code: "INC-001", name: "Ingreso por Orden de Salida",                          type: "income",  icon: "route",             description: "Cobro por orden de salida de vehículos",              sortOrder: 1,   isSystem: true, invoiceRangeCode: "OS"   },
  { code: "INC-002", name: "Ingreso por Servicio de Baño, Ducha y Urinario",       type: "income",  icon: "building-2",        description: "Ingresos por uso de servicios sanitarios",            sortOrder: 4,   isSystem: true, invoiceRangeCode: "SRV"  },
  { code: "INC-003", name: "Ingresos por Ventas (Poleras, Chalecos, Viñetas)",     type: "income",  icon: "shopping-bag",      description: "Venta de indumentaria y accesorios oficiales",        sortOrder: 8,   isSystem: true, invoiceRangeCode: "VTA"  },
  { code: "INC-004", name: "Ingreso por Afiliaciones y Reintegro",                 type: "income",  icon: "handshake",         description: "Pago de afiliaciones y reintegros",                   sortOrder: 9,   isSystem: true, invoiceRangeCode: "AFIM" },
  { code: "INC-005", name: "Ingreso por Alquileres",                               type: "income",  icon: "landmark",          description: "Alquiler de ambientes, espacios o bienes",            sortOrder: 6,   isSystem: true, invoiceRangeCode: "ALQ"  },
  { code: "INC-006", name: "Ingreso por Cambio de Herramienta",                    type: "income",  icon: "wrench",            description: "Pago por cambio o reposición de herramienta",         sortOrder: 10,   isSystem: true, invoiceRangeCode: "VTA"  },
  { code: "INC-007", name: "Ingreso por Licencia Indefinida",                      type: "income",  icon: "id-card",           description: "Pago por licencia indefinida",                        sortOrder: 11,   isSystem: true, invoiceRangeCode: "AFIM" },
  { code: "INC-008", name: "Ingreso por Multas",                                   type: "income",  icon: "alert-triangle",    description: "Multas administrativas",                              sortOrder: 3,   isSystem: true, invoiceRangeCode: "MULT" },
  { code: "INC-009", name: "Ingresos por Lavadero",                                type: "income",  icon: "car-front",         description: "Servicios de lavado de vehículos",                    sortOrder: 7,   isSystem: true, invoiceRangeCode: "SRV"  },
  { code: "INC-010", name: "Ingresos por Coliseo Carrasco",                        type: "income",  icon: "shield",            description: "Uso y alquiler del coliseo",                          sortOrder: 12,   isSystem: true, invoiceRangeCode: "ALQ"  },
  { code: "INC-011", name: "Ingresos por Facturacion",                             type: "income",  icon: "receipt",           description: "Ingresos por emision de facturas",                    sortOrder: 13,   isSystem: true, invoiceRangeCode: "GEN"  },
  { code: "INC-012", name: "Ingresos por Auto Indocumentado",                      type: "income",  icon: "file-text",         description: "Multas por vehículo sin documentación",               sortOrder: 14,   isSystem: true, invoiceRangeCode: "MULT" },
  { code: "INC-013", name: "Ingresos por Certificación",                           type: "income",  icon: "badge-check",       description: "Emisión de certificados",                             sortOrder: 5,   isSystem: true, invoiceRangeCode: "CERT" },
  { code: "INC-014", name: "Ingresos por Retrasos y Licencias a Reuniones",        type: "income",  icon: "calendar-check",    description: "Multas por retrasos o licencias",                     sortOrder: 15,   isSystem: true, invoiceRangeCode: "MULT" },
  { code: "INC-015", name: "Ingreso por Deportes",                                 type: "income",  icon: "ticket",            description: "Actividades deportivas",                              sortOrder: 16,   isSystem: true, invoiceRangeCode: "GEN"  },
  { code: "INC-016", name: "Ingreso por Cuota Mensual",                            type: "income",  icon: "hand-coins",        description: "Pago mensual de afiliados",                           sortOrder: 2,   isSystem: true, invoiceRangeCode: "CMS"  },
  { code: "INC-017", name: "Ingreso por Consumo de Energía Eléctrica",             type: "income",  icon: "banknote",          description: "Cobro por consumo eléctrico",                         sortOrder: 17,   isSystem: true, invoiceRangeCode: "SRV"  },
  { code: "INC-018", name: "Ingresos por Pérdida de Panter y Viñeta",              type: "income",  icon: "badge-dollar-sign", description: "Reposición de panter o viñeta extraviada",            sortOrder: 18,   isSystem: true, invoiceRangeCode: "VTA"  },
  { code: "INC-019", name: "Ingresos Apoyo Parada",                                type: "income",  icon: "users",             description: "Aportes de apoyo a la parada",                        sortOrder: 19,   isSystem: true, invoiceRangeCode: "GEN"  },
  { code: "INC-020", name: "Ingresos por Ayuda Social",                            type: "income",  icon: "handshake",         description: "Aportes y ayudas sociales",                           sortOrder: 20,   isSystem: true, invoiceRangeCode: "GEN"  },
  { code: "INC-021", name: "Otros Ingresos",                                       type: "income",  icon: "circle-dollar-sign",description: "Ingresos no clasificados",                            sortOrder: 21,   isSystem: true, invoiceRangeCode: "GEN"  },
  { code: "OUT-001", name: "Gastos de Funcionamiento (Urbano)",                    type: "outcome", icon: "bus",               description: "Gastos operativos del transporte urbano",             sortOrder: 7,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-002", name: "Gastos de Funcionamiento (Minibuses)",                 type: "outcome", icon: "bus",               description: "Gastos operativos de minibuses",                      sortOrder: 8,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-003", name: "Gastos de Funcionamiento (Buses y Micros)",            type: "outcome", icon: "bus",               description: "Gastos operativos de buses y micros",                 sortOrder: 9,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-004", name: "Gastos de Funcionamiento (Camiones)",                  type: "outcome", icon: "car-front",         description: "Gastos operativos de camiones",                       sortOrder: 10,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-005", name: "Gastos de Funcionamiento (Puerto Villarroel)",         type: "outcome", icon: "map",               description: "Operaciones regionales Puerto Villarroel",             sortOrder: 11,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-006", name: "Gastos de Operación y Funcionamiento (Camiones)",      type: "outcome", icon: "car-front",         description: "Operación general de camiones",                       sortOrder: 12,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-007", name: "Gastos de Operación y Funcionamiento (Chata)",         type: "outcome", icon: "car-front",         description: "Operación de chata",                                  sortOrder: 13,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-008", name: "Gastos de Funcionamiento de Volquetas",                type: "outcome", icon: "car-front",         description: "Funcionamiento de volquetas",                         sortOrder: 14,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-009", name: "Gastos de Operación y Funcionamiento (Moto Censo)",    type: "outcome", icon: "route",             description: "Operación de motos",                                  sortOrder: 15,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-010", name: "Viáticos Directorio",                                  type: "outcome", icon: "wallet",            description: "Viáticos del directorio",                             sortOrder: 2,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-011", name: "Viáticos Fiscalía",                                    type: "outcome", icon: "wallet",            description: "Viáticos de fiscalía",                                sortOrder: 16,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-012", name: "Pasajes y Viáticos Secretario de Transporte",          type: "outcome", icon: "wallet",            description: "Pasajes y viáticos institucionales",                  sortOrder: 17,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-013", name: "Gastos en Refrigerio",                                 type: "outcome", icon: "shopping-bag",      description: "Refrigerios en reuniones y eventos",                  sortOrder: 3,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-014", name: "Gastos Generales de Administración",                   type: "outcome", icon: "clipboard-list",    description: "Gastos administrativos generales",                    sortOrder: 1,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-015", name: "Gastos por Tributos",                                  type: "outcome", icon: "landmark",          description: "Impuestos y tasas",                                   sortOrder: 5,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-016", name: "Material e Insumos de Baño Público",                   type: "outcome", icon: "building-2",        description: "Compra de insumos sanitarios",                        sortOrder: 18,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-017", name: "Gastos del Campeonato",                                type: "outcome", icon: "ticket",            description: "Eventos deportivos",                                  sortOrder: 19,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-018", name: "Compra de Materiales, Herramientas y Equipos",         type: "outcome", icon: "hammer",            description: "Compra de activos y herramientas",                    sortOrder: 4,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-019", name: "Otros Gastos de Operación",                            type: "outcome", icon: "clipboard-list",    description: "Gastos operativos no clasificados",                   sortOrder: 20,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-020", name: "Ayudas Sociales",                                      type: "outcome", icon: "handshake",         description: "Ayudas y aportes sociales",                           sortOrder: 6,   isSystem: true, invoiceRangeCode: null   },
  { code: "OUT-021", name: "Otros Gastos", type: "outcome", icon: "credit-card", description: "Egresos no clasificados", sortOrder: 21, isSystem: true, invoiceRangeCode: null },
  { code: "TRANSFER",    name: "Transferencias internas",  type: "outcome", icon: "arrow-right-left", description: "Cuenta de sistema para transferencias entre cajas.",   sortOrder: 0, isSystem: true, invoiceRangeCode: null },
  { code: "TRANSFER_IN", name: "Ingreso por Transferencia Interna", type: "income", icon: "arrow-right-left", description: "Fondos recibidos desde otra caja o sector.", sortOrder: 0, isSystem: true, invoiceRangeCode: null },
  { code: "CONTRATISTA", name: "Pago a contratistas", type: "outcome", icon: "handshake", description: "Cuenta de sistema para pagos a contratistas.", sortOrder: 0, isSystem: true, invoiceRangeCode: null },
];

export const SYS_USERS = [
  { name: "ADMIN SISTEMA", email: "admin@carrasco.com", password: "camaleon54ruta", ci: "8888888", role: "ADMIN" },
];

export const CASHBOXES_DATA = [
  // ── CORE ─────────────────────────────────────
  {
    name: "Caja General",
    code: "GEN",
    description: "Caja principal de operacion general",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },

  // ── TRANSPORTE BASE ───────────────────────────
  {
    name: "Caja Taxis",
    code: "TAX",
    description: "Caja para sectores de taxis",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Motos",
    code: "MOT",
    description: "Caja para sectores de motos",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Minibuses",
    code: "MIN",
    description: "Caja para operaciones de minibuses",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Buses",
    code: "BUS",
    description: "Caja para operaciones de buses y micros",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Camiones",
    code: "CAM",
    description: "Caja para operaciones de camiones y volquetas",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  // ── AGRUPACIONES GEOGRÁFICAS ──────────────────
  {
    name: "Caja Valle Sacta",
    code: "VSA",
    description: "Operaciones de transporte en Valle Sacta (taxis y motos)",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Ayopaya",
    code: "AYO",
    description: "Operaciones de transporte en zona Ayopaya",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Valle Tunari",
    code: "VTU",
    description: "Operaciones de transporte en Valle Tunari",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Senda",
    code: "SEN",
    description: "Operaciones de transporte en Senda V y VI",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Mariposas",
    code: "MAR",
    description: "Operaciones de transporte en sector Mariposas",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
  {
    name: "Caja Puerto Villarroel",
    code: "PVL",
    description: "Operaciones regionales en Puerto Villarroel",
    balance: "0",
    creditLimit: "0",
    status: "activo" as const,
  },
];

export const SECTORS_DATA = [
  { id: 1, name: "1ER GRUPO", description: "......", isActive: true },
  { id: 2, name: "2DO GRUPO", description: "......", isActive: true },
  { id: 3, name: "3ER GRUPO", description: "......", isActive: true },
  { id: 4, name: "4TO GRUPO", description: "......", isActive: true },
  { id: 5, name: "RADIO MOVIL", description: "......", isActive: true },
  { id: 6, name: "PUERTO VILLARROEL", description: "......", isActive: true },
  { id: 7, name: "TAXIS VALLE SACTA", description: "......", isActive: true },
  { id: 8, name: "MOTOS VALLE SACTA", description: "......", isActive: true },
  { id: 9, name: "TAXIS AYOPAYA", description: "......", isActive: true },
  { id: 10, name: "MOTO AYOPAYA", description: "......", isActive: true },
  { id: 11, name: "TAXI VALLE TUNARI", description: "......", isActive: true },
  { id: 12, name: "MOTOS VALLE TUNARI", description: "......", isActive: true },
  { id: 13, name: "TAXI SENDA VI", description: "......", isActive: true },
  { id: 14, name: "MOTOS SENDA VI", description: "......", isActive: true },
  { id: 15, name: "TAXI SENDA V", description: "......", isActive: true },
  { id: 16, name: "MOTO SENDA V", description: "......", isActive: true },
  { id: 17, name: "TAXI ISRAEL", description: "......", isActive: true },
  { id: 18, name: "MINIBUSES", description: "......", isActive: true },
  { id: 19, name: "TAXI MARIPOSAS", description: "......", isActive: true },
  { id: 20, name: "MOTO MARIPOSAS", description: "......", isActive: true },
  { id: 21, name: "NUEVA ESTRELLA", description: "......", isActive: true },
  { id: 22, name: "MOTO CENTRAL", description: "......", isActive: true },
  { id: 23, name: "CAMIONETAS", description: "......", isActive: true },
  { id: 24, name: "MICROS", description: "......", isActive: true },
  { id: 25, name: "BUSES", description: "......", isActive: true },
  { id: 26, name: "CAMIONES", description: "......", isActive: true },
  { id: 27, name: "VOLQUETAS", description: "......", isActive: true },
  { id: 28, name: "CHATA TOLVA", description: "......", isActive: true },
];

await seedCashbox();
await seedSectors();
await seedCategories();
await seedInvoiceRanges();  // ranges first — categories link to them
await seedUsers();
