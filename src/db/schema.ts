import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  numeric,
  timestamp,
  text,
  pgSchema,
  boolean,
  index,
  serial,
  integer,
  uniqueIndex,
  date,
  bigint,
  pgEnum,
  uuid,
  check,
} from "drizzle-orm/pg-core";
import type { Currency } from "@/lib/schemas/currency.schemas";

// =====================================================================
// AUTH SCHEMA  (managed by better-auth — do not touch structure)
// =====================================================================

const authSchema = pgSchema("auth");

export const user = authSchema.table("user", {
  id:                 text("id").primaryKey(),
  name:               text("name").notNull(),
  email:              text("email").notNull().unique(),
  emailVerified:      boolean("email_verified").notNull(),
  image:              text("image"),
  createdAt:          timestamp("created_at").notNull(),
  updatedAt:          timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  role:               text("role"),
  ci:                 varchar("ci", { length: 20 }).notNull().unique(),
  banned:             boolean("banned"),
  banReason:          text("ban_reason"),
  banExpires:         timestamp("ban_expires", { withTimezone: true }),
  mustChangePassword: boolean("must_change_password").default(false),
  passwordResetBy:    text("password_reset_by"),
  passwordResetAt:    timestamp("password_reset_at", { withTimezone: true }),
});

export const passwordResetLog = authSchema.table("password_reset_log", {
  id:           uuid("uuid").primaryKey().defaultRandom().notNull(),
  adminId:      text("admin_id").notNull(),
  targetUserId: text("target_user_id").notNull(),
  timestamp:    timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimit = authSchema.table("rate_limit", {
  id:          text("id").primaryKey(),
  key:         text("key").notNull().unique(),
  count:       integer("count").notNull().default(0),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  window:      integer("window"),
  max:         integer("max"),
});

export const session = authSchema.table("session", {
  id:             text("id").primaryKey(),
  expiresAt:      timestamp("expires_at").notNull(),
  token:          text("token").notNull().unique(),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress:      text("ip_address"),
  userAgent:      text("user_agent"),
  userId:         text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = authSchema.table("account", {
  id:                    text("id").primaryKey(),
  userId:                text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId:             text("account_id").notNull(),
  providerId:            text("provider_id").notNull(),
  accessToken:           text("access_token"),
  refreshToken:          text("refresh_token"),
  accessTokenExpiresAt:  timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope:                 text("scope"),
  idToken:               text("id_token"),
  password:              text("password"),
  createdAt:             timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verification = authSchema.table("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }),
});

// =====================================================================
// ENUMS
// =====================================================================

export const transactionTypeEnum     = pgEnum("transaction_type",      ["deposit", "withdraw"]);
export const categoryTypeEnum        = pgEnum("category_type",         ["income", "outcome"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pendiente", "completado", "fallido", "cancelado"]);
export const cashBoxStatusEnum = pgEnum("cashbox_status", ["activo", "inactivo", "suspendido", "archivado"]);
export const contractorStatusEnum    = pgEnum("contractor_status",     ["activo", "inactivo"]);
export const employeeTypeEnum        = pgEnum("employee_type",         ["directorio", "planta"]);
export const employeeStatusEnum      = pgEnum("employee_status",       ["activo", "suspendido", "baja", "licencia"]);
export const salaryPaymentMethodEnum = pgEnum("salary_payment_method", ["efectivo", "transferencia", "cheque"]);
export const feePaymentStatusEnum    = pgEnum("fee_payment_status",    ["pendiente", "pagado", "parcial", "anulado"]);
export const tenantStatusEnum        = pgEnum("tenant_status",         ["activo", "inactivo", "moroso"]);
export const rentPaymentStatusEnum   = pgEnum("rent_payment_status",   ["pagado", "pendiente", "parcial", "anulado"]);

// linkedEntityId points to the obligation row (employee_fees.id, tenant_payments.id, contractor_payments.id)
// "employee_payment" is gone — replaced by "employee_fee" (direct link, no bridge table)
export const linkedEntityTypeEnum = pgEnum("linked_entity_type", [
  "employee_fee",
  "tenant_payment",
  "contractor_payment",
  "sector",
]);

export type EmployeeType        = (typeof employeeTypeEnum.enumValues)[number];
export type EmployeeStatus      = (typeof employeeStatusEnum.enumValues)[number];
export type SalaryPaymentMethod = (typeof salaryPaymentMethodEnum.enumValues)[number];
export type FeePaymentStatus    = (typeof feePaymentStatusEnum.enumValues)[number];
export type TenantStatus        = (typeof tenantStatusEnum.enumValues)[number];
export type RentPaymentStatus   = (typeof rentPaymentStatusEnum.enumValues)[number];

// =====================================================================
// FINANCE SCHEMA
// Tables declared in dependency order so Drizzle resolves FKs correctly.
// =====================================================================

const financeSchema = pgSchema("finance");

// ── Cashboxes ─────────────────────────────────────────────────────────
export const cashboxes = financeSchema.table("cashboxes", {
  id:          uuid("id").primaryKey().default(sql`uuidv7()`),
  name:        varchar("name", { length: 255 }).notNull(),
  code:        varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  balance:     numeric("balance", { mode: "string", precision: 15, scale: 2 }).default("0").notNull(),
  creditLimit: numeric("credit_limit",  { mode: "string", precision: 15, scale: 2 }).default("0"),
  isQuick:     boolean("is_quick").default(false).notNull(),
  status:      cashBoxStatusEnum("status").default("activo"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt:   timestamp("deleted_at"),
}, (t) => [
  index("idx_cashbox_code").on(t.code),
  check("balance_not_negative", sql`${t.balance} >= 0`),
]);

// ── Invoice ranges (talonarios) ───────────────────────────────────────
export const invoiceRanges = pgTable("invoice_ranges", {
  id:                  uuid("id").primaryKey().default(sql`uuidv7()`),
  category:            varchar("category",            { length: 50 }).notNull().unique(),
  prefix:              varchar("prefix",              { length: 10 }),          // keep — drives label format
  rangeStart:          bigint("range_start",          { mode: "number" }).notNull(),
  rangeEnd:            bigint("range_end",             { mode: "number" }).notNull(),
  current:             bigint("current",              { mode: "number" }).notNull(),
  isSystem:            boolean("is_system").notNull().default(false),
  authorizationNumber: varchar("authorization_number", { length: 50 }).notNull(),
  expirationDate:      timestamp("expiration_date",   { withTimezone: true }).notNull(),
  isActive:            boolean("is_active").notNull().default(true),
  createdAt:           timestamp("created_at",        { withTimezone: true }).defaultNow().notNull(),
  updatedAt:           timestamp("updated_at",        { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Transaction categories (chart of accounts) ────────────────────────
export const transactionCategories = financeSchema.table("transaction_categories", {
  id:                    uuid("id").primaryKey().default(sql`uuidv7()`),
  name:                  varchar("name",             { length: 100 }).notNull(),
  code:                  varchar("code",             { length: 50  }).notNull().unique(),
  type:                  categoryTypeEnum("type").notNull(),
  description:           text("description"),
  invoiceRangeId:        uuid("invoice_range_id").references(() => invoiceRanges.id, { onDelete: "set null" }),
  icon:                  varchar("icon",             { length: 50 }),
  sortOrder:             integer("sort_order").default(999).notNull(),
  parentId:              uuid("parent_id"),
  requiresAuthorization: boolean("requires_authorization").default(false),
  isSystem:              boolean("is_system").default(false),
  status:                boolean("status").default(true).notNull(),
  createdByUserId:       varchar("created_by_user_id", { length: 255 }).notNull().default("system"),
  createdAt:             timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt:             timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("idx_category_type").on(t.type),
  index("idx_category_code").on(t.code),
  index("idx_category_status").on(t.status),
  index("idx_category_parent").on(t.parentId),
]);

// ── Audit log ─────────────────────────────────────────────────────────
export const auditLogs = financeSchema.table("audit_logs", {
  id:        uuid("id").primaryKey().default(sql`uuidv7()`),
  userId:    uuid("user_id"),
  action:    varchar("action",    { length: 100 }).notNull(),
  entity:    varchar("entity",    { length: 100 }).notNull(),
  entityId:  uuid("entity_id"),
  oldValues: text("old_values"),
  newValues: text("new_values"),
  changes:   text("changes"),
  ipAddress: varchar("ip_address", { length: 45  }),
  userAgent: varchar("user_agent", { length: 500 }),
  method:    varchar("method",     { length: 10  }),
  path:      varchar("path",       { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_audit_user").on(t.userId),
  index("idx_audit_action").on(t.action),
  index("idx_audit_entity").on(t.entity),
  index("idx_audit_entity_id").on(t.entity, t.entityId),
  index("idx_audit_created_at").on(t.createdAt),
]);

// ── Sectors (declared before transactions — transactions has a sectorId FK) ──
export const sectors = pgTable("sectors", {
  id:          serial("id").primaryKey(),
  cashboxId:   uuid("cashbox_id").references(() => cashboxes.id, { onDelete: "restrict" }),
  name:        varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_sectors_cashbox").on(t.cashboxId),
]);

// ── Transactions — THE LEDGER ──────────────────────────────────────────
// Every peso in or out lives here. All obligation tables point here via transactionId.
// linkedEntityId is an integer matching the PK of the corresponding obligation table:
//   employee_fee      → employee_fees.id
//   tenant_payment    → tenant_payments.id
//   contractor_payment → contractor_payments.id
export const transactions = financeSchema.table("transactions", {
  id:                  uuid("id").primaryKey().default(sql`uuidv7()`),
  cashboxId:           uuid("affiliation_id").notNull().references(() => cashboxes.id, { onDelete: "restrict" }),
  categoryId:          uuid("category_id").notNull().references(() => transactionCategories.id, { onDelete: "restrict" }),
  sectorId:            integer("sector_id").references(() => sectors.id, { onDelete: "set null" }),
  type:                transactionTypeEnum("type").notNull(),
  amount:              numeric("amount", { mode: "string", precision: 15, scale: 2 }).notNull(),
  concept:             varchar("concept",      { length: 255 }).notNull(),
  notes:               text("notes"),
  reference:           varchar("reference",    { length: 255 }),   // receipt / invoice number
  authorizedBy:        varchar("authorized_by",{ length: 255 }),
  createdByUserId:     varchar("created_by_user_id", { length: 255 }).notNull(),
  status:              transactionStatusEnum("status").notNull().default("pendiente"),
  balanceAfter:        numeric("balance_after", { mode: "string", precision: 15, scale: 2 }),
  metadata:            text("metadata"),                           // void reason, extra JSON
  // Transfer cross-reference: both legs share transferPairId so they can be traced together
  transferToCashboxId: uuid("transfer_to_cashbox_id"),
  transferPairId:      uuid("transfer_pair_id"),
  // Business entity that originated this cash movement (points to the obligation table PK)
  linkedEntityType:    linkedEntityTypeEnum("linked_entity_type"),
  linkedEntityId:      integer("linked_entity_id"),
  createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_tx_cashbox").on(t.cashboxId),
  index("idx_tx_category").on(t.categoryId),
  index("idx_tx_sector").on(t.sectorId),
  index("idx_tx_type").on(t.type),
  index("idx_tx_status").on(t.status),
  index("idx_tx_created_at").on(t.createdAt),
  index("idx_tx_transfer_pair").on(t.transferPairId),
  index("idx_tx_transfer_to_cashbox").on(t.transferToCashboxId),
  index("idx_tx_linked_entity").on(t.linkedEntityType, t.linkedEntityId),
  check("amount_positive", sql`${t.amount} >= 0`),
]);

// =====================================================================
// RRHH
// =====================================================================

// ── Employees ─────────────────────────────────────────────────────────
export const employees = pgTable("employees", {
  id:              serial("id").primaryKey(),
  uuid:            uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
  ci:              varchar("ci",           { length: 20  }).notNull().unique(),
  ciCity:          varchar("ci_city",      { length: 5   }),
  fullName:        varchar("full_name",    { length: 200 }).notNull(),
  phone:           varchar("phone",        { length: 20  }),
  address:         varchar("address",      { length: 200 }),
  employeeType:    employeeTypeEnum("employee_type").notNull(),
  chargeTitle:     varchar("charge_title", { length: 120 }).notNull(),
  sectorId:        integer("sector_id").references(() => sectors.id, { onDelete: "set null" }),
  hireDate:        date("hire_date",        { mode: "date" }).notNull(),
  terminationDate: date("termination_date", { mode: "date" }),
  baseSalary:      numeric("base_salary", { mode: "number", precision: 12, scale: 2 }).notNull(),
  status:          employeeStatusEnum("status").notNull().default("activo"),
  notes:           text("notes"),
  // Soft-delete: fee history survives after removal
  deletedAt:       timestamp("deleted_at",       { withTimezone: true }),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).default("system"),
  createdAt:       timestamp("created_at",       { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at",       { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_employees_ci").on(t.ci),
  index("idx_employees_sector").on(t.sectorId),
  index("idx_employees_type").on(t.employeeType),
  index("idx_employees_status").on(t.status),
  index("idx_employees_uuid").on(t.uuid),
  check("base_salary_positive", sql`${t.baseSalary} >= 0`),
]);

// ── Employee fees (salary obligations) ────────────────────────────────
// One row per employee per period.
// Status is Option A — denormalized for fast pending/overdue queries.
// When paid: status -> 'pagado', transactionId -> finance.transactions row (set atomically).
// employee_payments bridge table is REMOVED — this row is the single source.
export const employeeFees = pgTable("employee_fees", {
  id:            serial("id").primaryKey(),
  uuid:          uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
  // SET NULL: fee history survives even if the employee record is deleted
  employeeId:    integer("employee_id").references(() => employees.id, { onDelete: "set null" }),
  period:        varchar("period", { length: 7 }).notNull(),   // "YYYY-MM"
  amount:        numeric("amount", { mode: "number", precision: 12, scale: 2 }).notNull(),
  status:        feePaymentStatusEnum("status").notNull().default("pendiente"),
  dueDate:       date("due_date", { mode: "date" }),
  // Payment method moved here from the old bridge table
  paymentMethod: salaryPaymentMethodEnum("payment_method").default("efectivo"),
  // Real FK to the ledger. Null while pending, set atomically on payment.
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("uniq_emp_period").on(t.employeeId, t.period),
  index("idx_fees_employee").on(t.employeeId),
  index("idx_fees_status").on(t.status),
  index("idx_fees_period").on(t.period),
  index("idx_fees_tx").on(t.transactionId),
  check("fee_amount_positive", sql`${t.amount} >= 0`),
]);

// =====================================================================
// TENANTS  (inquilinos)
// =====================================================================

export const tenants = pgTable("tenants", {
  id:          serial("id").primaryKey(),
  uuid:        uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
  fullName:    varchar("name",        { length: 150 }).notNull(),
  ci:          varchar("ci",          { length: 20  }),
  phone:       varchar("phone",       { length: 20  }),
  email:       varchar("email",       { length: 150 }),
  roomNumber:  varchar("room_number", { length: 20  }).notNull(),
  floor:       varchar("floor",       { length: 10  }),
  description: text("description"),
  monthlyRent: numeric("monthly_rent", { mode: "number", precision: 12, scale: 2 }).notNull(),
  startDate:   date("start_date", { mode: "date" }).notNull(),
  endDate:     date("end_date",   { mode: "date" }),
  status:      tenantStatusEnum("status").notNull().default("activo"),
  notes:       text("notes"),
  // Soft-delete: payment history survives after removal
  deletedAt:       timestamp("deleted_at",       { withTimezone: true }),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).default("system"),
  createdAt:       timestamp("created_at",       { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at",       { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_tenants_status").on(t.status),
  index("idx_tenants_room").on(t.roomNumber),
  index("idx_tenants_uuid").on(t.uuid),
]);

// ── Tenant payment obligations ─────────────────────────────────────────
// One row per tenant per period.
// REMOVED: paidAt, processedByUserId — both live on the linked transaction.
export const tenantPayments = pgTable("tenant_payments", {
  id:            serial("id").primaryKey(),
  uuid:          uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
  // SET NULL: rent history survives even if the tenant is deleted
  tenantId:      integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  period:        varchar("period", { length: 7 }).notNull(),   // "YYYY-MM"
  amount:        numeric("amount", { mode: "number", precision: 12, scale: 2 }).notNull(),
  status:        rentPaymentStatusEnum("status").notNull().default("pendiente"),
  dueDate:       date("due_date", { mode: "date" }),
  receiptNumber: varchar("receipt_number", { length: 30 }),
  notes:         text("notes"),
  // Real FK to the ledger. Set atomically on payment.
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("uniq_tenant_period").on(t.tenantId, t.period),
  index("idx_tp_tenant").on(t.tenantId),
  index("idx_tp_status").on(t.status),
  index("idx_tp_period").on(t.period),
  index("idx_tp_tx").on(t.transactionId),
]);

// =====================================================================
// CONTRACTORS
// =====================================================================

export const contractors = pgTable("contractors", {
  id:        serial("id").primaryKey(),
  uuid:      uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
  fullName:  varchar("full_name", { length: 200 }).notNull(),
  ci:        varchar("ci",        { length: 20  }),
  ruc:       varchar("ruc",       { length: 20  }),
  phone:     varchar("phone",     { length: 20  }),
  email:     varchar("email",     { length: 150 }),
  address:   varchar("address",   { length: 255 }),
  specialty: varchar("specialty", { length: 120 }),
  status:    contractorStatusEnum("status").notNull().default("activo"),
  notes:     text("notes"),
  // Soft-delete: payment history survives after removal
  deletedAt:       timestamp("deleted_at",       { withTimezone: true }),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).default("system"),
  createdAt:       timestamp("created_at",       { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at",       { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_contractors_status").on(t.status),
  index("idx_contractors_uuid").on(t.uuid),
]);

// ── Contractor payment records ─────────────────────────────────────────
// One row per job payment issued.
// REMOVED: cashboxId, amount, paidAt — all live on the linked transaction.
export const contractorPayments = pgTable("contractor_payments", {
  id:                serial("id").primaryKey(),
  uuid:              uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
  // SET NULL: payment history survives even if contractor is deleted
  contractorId:      integer("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
  // NOT NULL: a payment record must always have a transaction — no orphans
  transactionId:     uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  concept:           varchar("concept",       { length: 255 }).notNull(),
  receiptNumber:     varchar("receipt_number",{ length: 30  }),
  notes:             text("notes"),
  processedByUserId: varchar("processed_by_user_id", { length: 255 }),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_cp_contractor").on(t.contractorId),
  index("idx_cp_tx").on(t.transactionId),
]);

// =====================================================================
// RELATIONS
// =====================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const cashboxesRelations = relations(cashboxes, ({ many }) => ({
  transactions: many(transactions),
  sectors:      many(sectors),
}));

export const sectorsRelations = relations(sectors, ({ one, many }) => ({
  cashbox:   one(cashboxes, { fields: [sectors.cashboxId], references: [cashboxes.id] }),
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  sector: one(sectors, { fields: [employees.sectorId], references: [sectors.id] }),
  fees:   many(employeeFees),
}));

export const employeeFeesRelations = relations(employeeFees, ({ one }) => ({
  employee:    one(employees,    { fields: [employeeFees.employeeId],    references: [employees.id] }),
  transaction: one(transactions, { fields: [employeeFees.transactionId], references: [transactions.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  cashbox:  one(cashboxes,             { fields: [transactions.cashboxId],  references: [cashboxes.id] }),
  category: one(transactionCategories, { fields: [transactions.categoryId], references: [transactionCategories.id] }),
  sector:   one(sectors,               { fields: [transactions.sectorId],   references: [sectors.id] }),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  payments: many(tenantPayments),
}));

export const tenantPaymentsRelations = relations(tenantPayments, ({ one }) => ({
  tenant:      one(tenants,      { fields: [tenantPayments.tenantId],      references: [tenants.id] }),
  transaction: one(transactions, { fields: [tenantPayments.transactionId], references: [transactions.id] }),
}));

export const contractorsRelations = relations(contractors, ({ many }) => ({
  payments: many(contractorPayments),
}));

export const contractorPaymentsRelations = relations(contractorPayments, ({ one }) => ({
  contractor:  one(contractors,  { fields: [contractorPayments.contractorId],  references: [contractors.id] }),
  transaction: one(transactions, { fields: [contractorPayments.transactionId], references: [transactions.id] }),
}));

// =====================================================================
// TYPE EXPORTS
// =====================================================================

export type InvoiceRange    = typeof invoiceRanges.$inferSelect;
export type NewInvoiceRange = typeof invoiceRanges.$inferInsert;

export type SelectCashbox = typeof cashboxes.$inferSelect;
export type InsertCashbox = typeof cashboxes.$inferInsert;

export type SelectTransaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export type SelectTransactionCategories = typeof transactionCategories.$inferSelect;
export type InsertTransactionCategories = typeof transactionCategories.$inferInsert;

export type SelectSector = typeof sectors.$inferSelect;
export type InsertSector = typeof sectors.$inferInsert;

export type SelectEmployee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

export type SelectEmployeeFee = typeof employeeFees.$inferSelect;
export type InsertEmployeeFee = typeof employeeFees.$inferInsert;
// SelectEmployeePayment removed — use SelectEmployeeFee + its linked transaction

export type SelectContractor = typeof contractors.$inferSelect;
export type InsertContractor = typeof contractors.$inferInsert;

export type SelectContractorPayment = typeof contractorPayments.$inferSelect;
export type InsertContractorPayment = typeof contractorPayments.$inferInsert;

export type SelectTenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export type SelectTenantPayment = typeof tenantPayments.$inferSelect;
export type InsertTenantPayment = typeof tenantPayments.$inferInsert;

// ── Composite / helper types ───────────────────────────────────────────

export type EmployeeWithFullName = SelectEmployee & {
  fullName:    string;
  sectorName?: string;
};

export type FeeWithEmployee = SelectEmployeeFee & {
  employee: SelectEmployee;
};

export type SectorSalarySummary = {
  sectorId:           number;
  sectorName:         string;
  cashboxId:          string;
  cashboxBalance:     string;
  totalEmployees:     number;
  totalMonthlySalary: number;
  pendingFees:        number;
  pendingAmount:      number;
};

export type TenantWithPaymentSummary = SelectTenant & {
  pendingMonths:  number;
  lastPaidPeriod: string | null;
};
