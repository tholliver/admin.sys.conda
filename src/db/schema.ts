import { relations, sql, eq, type SQL } from "drizzle-orm";
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

// ===================== TABLE SCHEMAS =====================

// ---------------------- AUTH SCHEMAS ----------------------

const authSchema = pgSchema("auth");

export const user = authSchema.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  role: text("role"),
  ci: varchar("ci", { length: 20 }).notNull().unique(),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  mustChangePassword: boolean("must_change_password").default(false),
  passwordResetBy: text("password_reset_by"),
  passwordResetAt: timestamp("password_reset_at", { withTimezone: true }),
});

export const passwordResetLog = authSchema.table("password_reset_log", {
  id: uuid("uuid").primaryKey().defaultRandom().notNull(),
  adminId: text("admin_id").notNull(),
  targetUserId: text("target_user_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rateLimit = authSchema.table("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(0),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  window: integer("window"),
  max: integer("max"),
});

export const session = authSchema.table("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = authSchema.table("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verification = authSchema.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ---------------------- AUTH RELATIONS -----------------

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// ============================== FINANCE ============================================

export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdraw",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "completed",
  "failed",
  "cancelled",
]);

export const cashBoxStatusEnum = pgEnum("cashbox_status", [
  "active",
  "inactive",
  "suspended",
  "archived",
]);

export const categoryTypeEnum = pgEnum("category_type", ["income", "outcome"]);

const financeSchema = pgSchema("finance");

export const cashboxes = financeSchema.table(
  "cashboxes",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    description: text("description"),
    balance: numeric("balance", { mode: "string", precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    creditLimit: numeric("credit_limit", {
      mode: "string",
      precision: 15,
      scale: 2,
    }).default("0"),
    managerId: varchar("manager_id", { length: 255 }),
    status: cashBoxStatusEnum("status").default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_affiliation_code").on(table.code),
    check("balance_not_negative", sql`${table.balance} >= 0`),
  ],
);

export const invoiceRanges = pgTable("invoice_ranges", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  code: varchar("code", { length: 10 }).notNull().unique(),
  category: varchar("category", { length: 50 }).notNull().unique(),
  prefix: varchar("prefix", { length: 10 }),
  rangeStart: bigint("range_start", { mode: "number" }).notNull(),
  rangeEnd: bigint("range_end", { mode: "number" }).notNull(),
  current: bigint("current", { mode: "number" }).notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  authorizationNumber: varchar("authorization_number", { length: 50 }).notNull(),
  expirationDate: timestamp("expiration_date", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const transactionCategories = financeSchema.table(
  "transaction_categories",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: varchar("name", { length: 100 }).notNull(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    type: categoryTypeEnum("type").notNull(),
    description: text("description"),
    invoiceRangeId: uuid("invoice_range_id").references(() => invoiceRanges.id, { onDelete: "set null" }),
    icon: varchar("icon", { length: 50 }),
    sortOrder: integer("sort_order").default(999).notNull(),
    parentId: uuid("parent_id"),
    requiresAuthorization: boolean("requires_authorization").default(false),
    isSystem: boolean("is_system").default(false),
    status: boolean("status").default(true).notNull(),
    createdByUserId: varchar("created_by_user_id", { length: 255 })
      .notNull()
      .default("system"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_category_type").on(table.type),
    index("idx_category_code").on(table.code),
    index("idx_category_status").on(table.status),
    index("idx_category_parent").on(table.parentId),
  ],
);

export const transactions = financeSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    cashboxId: uuid("affiliation_id")
      .notNull()
      .references(() => cashboxes.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => transactionCategories.id, { onDelete: "restrict" }),
    type: transactionTypeEnum("type").notNull(),
    amount: numeric("amount", {
      mode: "string",
      precision: 15,
      scale: 2,
    }).notNull(),
    concept: varchar("concept", { length: 255 }).notNull(),
    description: text("description"),
    reference: varchar("reference", { length: 255 }),
    authorizedBy: varchar("authorized_by", { length: 255 }),
    createdByUserId: varchar("created_by_user_id", { length: 255 }).notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),
    balanceAfter: numeric("balance_after", {
      mode: "string",
      precision: 15,
      scale: 2,
    }),
    metadata: text("metadata"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_tx_cashbox").on(table.cashboxId),
    index("idx_tx_category").on(table.categoryId),
    index("idx_tx_type").on(table.type),
    index("idx_tx_status").on(table.status),
    index("idx_tx_created_at").on(table.createdAt),
    check("amount_positive", sql`${table.amount} >= 0`),
  ],
);

export const auditLogs = financeSchema.table(
  "audit_logs",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    userId: uuid("user_id"),
    action: varchar("action", { length: 100 }).notNull(),
    entity: varchar("entity", { length: 100 }).notNull(),
    entityId: uuid("entity_id"),
    oldValues: text("old_values"),
    newValues: text("new_values"),
    changes: text("changes"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    method: varchar("method", { length: 10 }),
    path: varchar("path", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_audit_user").on(table.userId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_entity").on(table.entity),
    index("idx_audit_entity_id").on(table.entity, table.entityId),
    index("idx_audit_created_at").on(table.createdAt),
  ],
);

// ============================== RRHH ============================================

export const employeeTypeEnum = pgEnum("employee_type", [
  "directorio",
  "planta",
]);

export type EmployeeType = (typeof employeeTypeEnum.enumValues)[number];

export const employeeStatusEnum = pgEnum("employee_status", [
  "activo",
  "suspendido",
  "baja",
  "licencia",
]);

export type EmployeeStatus = (typeof employeeStatusEnum.enumValues)[number];

export const salaryPaymentMethodEnum = pgEnum("salary_payment_method", [
  "efectivo",
  "transferencia",
  "cheque",
]);
export type SalaryPaymentMethod = (typeof salaryPaymentMethodEnum.enumValues)[number];

export const feePaymentStatusEnum = pgEnum("fee_payment_status", [
  "pendiente",
  "pagado",
  "parcial",
  "anulado",
]);

export type FeePaymentStatus = (typeof feePaymentStatusEnum.enumValues)[number];

export const sectors = pgTable("sectors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  feeAmount: numeric("fee_amount", { mode: "number" }).notNull(),
  feeCurrency: varchar("fee_currency", { length: 3 }).$type<Currency>().notNull(),
  monthlyFeeAmount: numeric("monthly_fee_amount", { mode: "number" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const employees = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
    ci: varchar("ci", { length: 20 }).notNull().unique(),
    ciCity: varchar("ci_city", { length: 5 }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    address: varchar("address", { length: 200 }),
    employeeType: employeeTypeEnum("employee_type").notNull(),
    chargeTitle: varchar("charge_title", { length: 120 }).notNull(),
    sectorId: integer("sector_id").notNull(),
    hireDate: date("hire_date", { mode: "date" }).notNull(),
    terminationDate: date("termination_date", { mode: "date" }),
    baseSalary: numeric("base_salary", {
      mode: "number",
      precision: 12,
      scale: 2,
    }).notNull(),
    status: employeeStatusEnum("status").notNull().default("activo"),
    notes: text("notes"),
    createdByUserId: varchar("created_by_user_id", { length: 255 }).default("system"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_employees_ci").on(table.ci),
    index("idx_employees_sector").on(table.sectorId),
    index("idx_employees_type").on(table.employeeType),
    index("idx_employees_status").on(table.status),
    index("idx_employees_uuid").on(table.uuid),
    check("base_salary_positive", sql`${table.baseSalary} >= 0`),
  ],
);

export const employeeFees = pgTable(
  "employee_fees",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    period: varchar("period", { length: 7 }).notNull(),
    amount: numeric("amount", {
      mode: "number",
      precision: 12,
      scale: 2,
    }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("BOB"),
    cashboxId: uuid("cashbox_id").notNull(),
    status: feePaymentStatusEnum("status").notNull().default("pendiente"),
    dueDate: date("due_date", { mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_employee_period").on(table.employeeId, table.period),
    index("idx_employee_fees_employee").on(table.employeeId),
    index("idx_employee_fees_status").on(table.status),
    index("idx_employee_fees_period").on(table.period),
    index("idx_employee_fees_cashbox").on(table.cashboxId),
    check("fee_amount_positive", sql`${table.amount} >= 0`),
  ],
);

export const employeePayments = pgTable(
  "employee_payments",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").default(sql`uuidv7()`).unique().notNull(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    feeId: integer("fee_id")
      .notNull()
      .references(() => employeeFees.id, { onDelete: "restrict" }),
    amountPaid: numeric("amount_paid", {
      mode: "number",
      precision: 12,
      scale: 2,
    }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("BOB"),
    paymentMethod: salaryPaymentMethodEnum("payment_method")
      .notNull()
      .default("efectivo"),
    cashboxId: uuid("cashbox_id").notNull(),
    transactionId: uuid("transaction_id"),
    receiptNumber: varchar("receipt_number", { length: 30 }),
    notes: text("notes"),
    processedByUserId: varchar("processed_by_user_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_emp_payments_employee").on(table.employeeId),
    index("idx_emp_payments_fee").on(table.feeId),
    index("idx_emp_payments_cashbox").on(table.cashboxId),
    check("amount_paid_positive", sql`${table.amountPaid} > 0`),
  ],
);

export const sectorCashboxLink = pgTable(
  "sector_cashbox_link",
  {
    id: serial("id").primaryKey(),
    sectorId: integer("sector_id").notNull(),
    cashboxId: uuid("cashbox_id").notNull(),
    label: varchar("label", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("unique_sector_cashbox").on(table.sectorId),
    index("idx_sector_cashbox_cashbox").on(table.cashboxId),
  ],
);

// ============================== RELATIONS ============================================

export const employeesRelations = relations(employees, ({ many }) => ({
  fees: many(employeeFees),
  payments: many(employeePayments),
}));

export const employeeFeesRelations = relations(employeeFees, ({ one, many }) => ({
  employee: one(employees, {
    fields: [employeeFees.employeeId],
    references: [employees.id],
  }),
  payments: many(employeePayments),
}));

export const employeePaymentsRelations = relations(employeePayments, ({ one }) => ({
  employee: one(employees, {
    fields: [employeePayments.employeeId],
    references: [employees.id],
  }),
  fee: one(employeeFees, {
    fields: [employeePayments.feeId],
    references: [employeeFees.id],
  }),
}));

// ------------------------------ tenants ----------------------------------
// ============================================================
// ENUMS
// ============================================================

export const tenantStatusEnum = pgEnum("tenant_status", [
  "activo",
  "inactivo",
  "moroso",
]);

export type TenantStatus = (typeof tenantStatusEnum.enumValues)[number];

export const rentPaymentStatusEnum = pgEnum("rent_payment_status", [
  "pagado",
  "pendiente",
  "parcial",
  "anulado",
]);

export type RentPaymentStatus = (typeof rentPaymentStatusEnum.enumValues)[number];

// ============================================================
// TENANTS
// ============================================================

export const tenants = pgTable(
  "tenants",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").default(sql`uuidv7()`).unique().notNull(),

    // Identity
    name: varchar("name", { length: 150 }).notNull(),
    ci: varchar("ci", { length: 20 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 150 }),

    // Room / unit info
    roomNumber: varchar("room_number", { length: 20 }).notNull(),
    floor: varchar("floor", { length: 10 }),
    description: text("description"),

    // Rent
    monthlyRent: numeric("monthly_rent", {
      mode: "number",
      precision: 12,
      scale: 2,
    }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("BOB"),

    // Contract
    startDate: date("start_date", { mode: "date" }).notNull(),
    endDate: date("end_date", { mode: "date" }),

    status: tenantStatusEnum("status").notNull().default("activo"),
    notes: text("notes"),

    createdByUserId: varchar("created_by_user_id", { length: 255 }).default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_tenants_status").on(table.status),
    index("idx_tenants_room").on(table.roomNumber),
    index("idx_tenants_uuid").on(table.uuid),
  ]
);

// ============================================================
// TENANT PAYMENTS  (monthly rent records)
// ============================================================

export const tenantPayments = pgTable(
  "tenant_payments",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").default(sql`uuidv7()`).unique().notNull(),

    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),

    /** ISO period e.g. "2025-03" */
    period: varchar("period", { length: 7 }).notNull(),

    amount: numeric("amount", {
      mode: "number",
      precision: 12,
      scale: 2,
    }).notNull(),

    currency: varchar("currency", { length: 3 }).notNull().default("BOB"),

    status: rentPaymentStatusEnum("status").notNull().default("pendiente"),

    dueDate: date("due_date", { mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    receiptNumber: varchar("receipt_number", { length: 30 }),
    notes: text("notes"),

    processedByUserId: varchar("processed_by_user_id", { length: 255 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("unique_tenant_period").on(table.tenantId, table.period),
    index("idx_tenant_payments_tenant").on(table.tenantId),
    index("idx_tenant_payments_status").on(table.status),
    index("idx_tenant_payments_period").on(table.period),
  ]
);

// ============================================================
// RELATIONS
// ============================================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  payments: many(tenantPayments),
}));

export const tenantPaymentsRelations = relations(tenantPayments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantPayments.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================================
// TYPE EXPORTS
// ============================================================

export type SelectTenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export type SelectTenantPayment = typeof tenantPayments.$inferSelect;
export type InsertTenantPayment = typeof tenantPayments.$inferInsert;

export type TenantWithPaymentSummary = SelectTenant & {
  pendingMonths: number;
  lastPaidPeriod: string | null;
};

// ============================== TYPE EXPORTS ============================================

export type InvoiceRange = typeof invoiceRanges.$inferSelect;
export type NewInvoiceRange = typeof invoiceRanges.$inferInsert;

export type SelectTransaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export type SelectCashbox = typeof cashboxes.$inferSelect;
export type InsertCashbox = typeof cashboxes.$inferInsert;

export type SelectTransactionCategories = typeof transactionCategories.$inferSelect;
export type InsertTransactionCategories = typeof transactionCategories.$inferInsert;

export type SelectEmployee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

export type SelectEmployeeFee = typeof employeeFees.$inferSelect;
export type InsertEmployeeFee = typeof employeeFees.$inferInsert;

export type SelectEmployeePayment = typeof employeePayments.$inferSelect;
export type InsertEmployeePayment = typeof employeePayments.$inferInsert;

export type SelectSectorCashboxLink = typeof sectorCashboxLink.$inferSelect;
export type InsertSectorCashboxLink = typeof sectorCashboxLink.$inferInsert;

export type EmployeeWithFullName = SelectEmployee & {
  fullName: string;
  sectorName?: string;
};

export type FeeWithEmployee = SelectEmployeeFee & {
  employee: SelectEmployee;
};

export type SectorSalarySummary = {
  sectorId: number;
  sectorName: string;
  cashboxId: string;
  cashboxBalance: string;
  totalEmployees: number;
  totalMonthlySalary: number;
  pendingFees: number;
  pendingAmount: number;
};
