// src/actions/finance/index.ts
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactions, cashboxes, transactionCategories, invoiceRanges } from "@/db/schema";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";
import { DecimalService } from "@/services/finances/decimal.service";
import { formatter } from "@/utils/timex";
import { ENV } from "@/config/env";
import { formatBOB } from "@/utils/formatters";
import { voidTransaction } from "./void-transaction.action";
import { transfer, payContractor, createContractor, updateContractorStatus } from "./transfer.action";
import { toggleQuickCashbox } from "./toggle-quick-cashbox.action";
import { toggleCashboxStatus } from "./toggle-cashbox-status.action";

export const deposit = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.uuid("ID de cuenta inválido"),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
      .refine((val) => {
        const num = parseFloat(val);
        return num > 0 && num <= ENV.TRANSACTION_HARD_LIMITS.DEPOSIT_MAX;
      }, `Monto debe ser entre 0.01 y ${formatBOB(String(ENV.TRANSACTION_HARD_LIMITS.DEPOSIT_MAX))}`),
    notes: z.string().max(1000).optional(),
    // Bug 2 fix: accept an optional manual reference for cases where there is
    // no active invoice range assigned to the category.
    reference: z.string().max(255).optional(),
    invoiceRangeId: z.uuid().optional(),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;

      if (!user) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesion para registrar un deposito.",
        });
      }

      const { categoryId, amount, notes, reference, invoiceRangeId } = input;

      // Validate category
      const [category] = await db
        .select()
        .from(transactionCategories)
        .where(
          and(
            eq(transactionCategories.id, categoryId),
            eq(transactionCategories.type, "income"),
            eq(transactionCategories.status, true),
          ),
        );

      if (!category) {
        throw new ActionError({ code: "NOT_FOUND", message: "La cuenta seleccionada no existe o esta inactiva." });
      }

      // Get cashbox
      const [cashAccount] = await db
        .select()
        .from(cashboxes)
        .where(eq(cashboxes.code, "GEN"));

      if (!cashAccount) {
        throw new ActionError({ code: "NOT_FOUND", message: "No se encontro la caja principal de operaciones. Contacta al administrador." });
      }

      if (cashAccount.status !== "activo") {
        throw new ActionError({ code: "BAD_REQUEST", message: "La caja principal esta inactiva. Contacta al administrador." });
      }

      // Resolve invoice number from range if provided.
      // Bug 3 fix: verify that the submitted invoiceRangeId actually belongs
      // to the selected category so no range can be burned against a foreign account.
      let resolvedReference: string | null = reference?.trim() || null;
      if (invoiceRangeId) {
        if (category.invoiceRangeId !== invoiceRangeId) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "El talonario no corresponde a la cuenta seleccionada.",
          });
        }

        const [range] = await db
          .select()
          .from(invoiceRanges)
          .where(and(eq(invoiceRanges.id, invoiceRangeId), eq(invoiceRanges.isActive, true)));

        if (!range) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "El talonario seleccionado no existe o está inactivo.",
          });
        }

        const next = range.current + 1;
        if (next > range.rangeEnd) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "El talonario está agotado. Amplíe el rango antes de continuar.",
          });
        }

        resolvedReference = range.prefix ? `${range.prefix}-${next}` : String(next);
      }

      // Wrap balance update + insert + range bump in one transaction
      const { transaction, newBalance } = await db.transaction(async (tx) => {
        const [updatedCashbox] = await tx
          .update(cashboxes)
          .set({ balance: sql`${cashboxes.balance}::numeric + ${amount}::numeric` })
          .where(eq(cashboxes.id, cashAccount.id))
          .returning();

        const nb = updatedCashbox.balance?.toString() ?? "0.00";

        const [txn] = await tx
          .insert(transactions)
          .values({
            type: "deposit",
            amount,
            categoryId,
            concept: category.name,
            cashboxId: cashAccount.id,
            reference: resolvedReference,
            notes: notes?.trim() || null,
            createdByUserId: user.id || "system",
            status: "completado",
            balanceAfter: nb,
          })
          .returning();

        if (invoiceRangeId && resolvedReference) {
          await tx
            .update(invoiceRanges)
            .set({ current: sql`${invoiceRanges.current} + 1` })
            .where(and(eq(invoiceRanges.id, invoiceRangeId), eq(invoiceRanges.isSystem, false)));
        }

        return { transaction: txn, newBalance: nb };
      });

      return {
        success: true,
        message: `Deposito de ${formatBOB(amount)} registrado correctamente.`,
        transaction: {
          id: transaction.id,
          amount: formatBOB(amount),
          concept: transaction.concept,
          timestamp: transaction.createdAt.toISOString(),
          reference: transaction.reference ?? null,
        },
        newBalance: formatBOB(newBalance),
      };
    } catch (error) {
      console.error("Deposit error:", error);

      if (error instanceof ActionError) {
        throw error;
      }

      if (error instanceof Error) {
        const isDev = process.env.NODE_ENV === "development";
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: isDev
            ? `Error: ${error.message}`
            : "No se pudo procesar el deposito.. Intente nuevamente.",
        });
      }

      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No se pudo procesar el deposito.",
      });
    }
  },
});

// ============================================================================
// WITHDRAW ACTION
// ============================================================================

export const withdraw = defineAction({
  accept: "form",
  input: z.object({
    cashboxId: z.uuid("ID de caja inválido"),
    categoryId: z.uuid("ID de cuenta inválido"),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Monto debe ser un número válido")
      .refine((val) => {
        const num = parseFloat(val);
        return num > 0 && num <= ENV.TRANSACTION_HARD_LIMITS.WITHDRAWAL_MAX;
      }, `Monto debe ser entre 0.01 y ${formatBOB(String(ENV.TRANSACTION_HARD_LIMITS.WITHDRAWAL_MAX))}`),
    authorizedBy: z
      .string()
      .min(1, "Nombre de autorización requerido")
      .max(255)
      .optional(),
    reference: z.string().max(255).optional(),
    notes: z.string().min(1, "Debe justificar el egreso").max(1000),
    invoiceRangeId: z.uuid().optional(),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;
      if (!user) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesion para registrar un egreso.",
        });
      }

      const { categoryId, amount, authorizedBy, reference, notes, invoiceRangeId } = input;

      // Validate and normalize amount
      try {
        DecimalService.validateAmount(amount);
      } catch (err) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Monto invalido",
        });
      }

      const normalizedAmount = DecimalService.normalize(amount);

      // Validate category
      const [category] = await db
        .select()
        .from(transactionCategories)
        .where(
          and(
            eq(transactionCategories.id, categoryId),
            eq(transactionCategories.type, "outcome"),
            eq(transactionCategories.status, true),
          ),
        );

      if (!category) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "La cuenta seleccionada no existe o esta inactiva.",
        });
      }

      // Check if category requires authorization
      if (category.requiresAuthorization && !authorizedBy) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Esta cuenta requiere autorizacion.",
        });
      }

      const [cashbox] = await db.select().from(cashboxes).where(eq(cashboxes.id, input.cashboxId));

      if (!cashbox) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "No se encontro la caja seleccionada. Contacta al administrador.",
        });
      }

      if (cashbox.status !== "activo") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `La caja ${cashbox.name} esta inactiva. Contacta al administrador.`,
        });
      }

      const currentBalance = String(cashbox.balance || "0");

      if (!DecimalService.isGreaterOrEqual(currentBalance, normalizedAmount)) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `Saldo insuficiente en ${cashbox.name}. Disponible: ${formatBOB(currentBalance)}.`,
        });
      }

      // Calculate new balance
      const newBalance = DecimalService.subtract(currentBalance, normalizedAmount);

      // Resolve invoice number from range if provided.
      // Bug 3 fix: verify that the submitted invoiceRangeId actually belongs
      // to the selected category so no range can be burned against a foreign account.
      let resolvedReference = reference?.trim() || null;
      if (invoiceRangeId) {
        if (category.invoiceRangeId !== invoiceRangeId) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "El talonario no corresponde a la cuenta seleccionada.",
          });
        }

        const [range] = await db
          .select()
          .from(invoiceRanges)
          .where(and(eq(invoiceRanges.id, invoiceRangeId), eq(invoiceRanges.isActive, true)));

        if (!range) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "El talonario seleccionado no existe o está inactivo.",
          });
        }

        const next = range.current + 1;
        if (next > range.rangeEnd) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "El talonario está agotado. Amplíe el rango antes de continuar.",
          });
        }

        resolvedReference = range.prefix ? `${range.prefix}-${next}` : String(next);
      }

      // Wrap insert + balance update + range bump in one transaction
      const transaction = await db.transaction(async (tx) => {
        const [txn] = await tx
          .insert(transactions)
          .values({
            type: "withdraw",
            amount: normalizedAmount,
            categoryId,
            concept: category.name,
            authorizedBy: authorizedBy || null,
            reference: resolvedReference,
            cashboxId: cashbox.id,
            description: notes?.trim() || null,
            createdByUserId: user.id,
            status: "completado",
            balanceAfter: newBalance,
          })
          .returning();

        await tx
          .update(cashboxes)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(cashboxes.id, cashbox.id));

        if (invoiceRangeId && resolvedReference) {
          await tx
            .update(invoiceRanges)
            .set({ current: sql`${invoiceRanges.current} + 1` })
            .where(and(eq(invoiceRanges.id, invoiceRangeId), eq(invoiceRanges.isSystem, false)));
        }

        return txn;
      });

      return {
        success: true,
        message: `Egreso de ${formatBOB(normalizedAmount)} registrado correctamente.`,
        transaction: {
          id: transaction.id,
          amount: formatBOB(normalizedAmount),
          concept: category.name,
          authorizedBy: authorizedBy || undefined,
          timestamp: formatter.format(transaction.createdAt),
          reference: transaction.reference ?? null,
        },
        newBalance: formatBOB(newBalance),
      };
    } catch (error) {
      console.error("Withdraw error:", error);
      if (error instanceof ActionError) {
        throw error;
      }

      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No se pudo procesar el egreso.",
      });
    }
  },
});

// ============================================================================
// GET BALANCE ACTION
// ============================================================================

export const getBalance = defineAction({
  accept: "json",
  input: z.object({
    affiliationId: z.uuid("ID de afiliación inválido"),
  }),
  async handler(input, { locals }) {
    try {
      if (!locals.user?.id) {
        return {
          success: false,
          error: "No autenticado",
          code: "UNAUTHORIZED",
        };
      }

      const affiliation = await db
        .select()
        .from(cashboxes)
        .where(eq(cashboxes.id, input.affiliationId))
        .then((rows) => rows[0]);

      if (!affiliation) {
        return {
          success: true,
          balance: "0.00",
          status: "inactive",
          transactions: [],
        };
      }

      const recentTransactions = await db
        .select()
        .from(transactions)
        .where(sql`${transactions.cashboxId} = ${input.affiliationId}`)
        .orderBy(desc(transactions.createdAt))
        .limit(50);

      return {
        success: true,
        balance: affiliation.balance,
        status: affiliation.status,
        transactions: recentTransactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          concept: tx.concept,
          reference: tx.reference,
          authorizedBy: tx.authorizedBy,
          timestamp: tx.createdAt.toISOString(),
          status: tx.status,
        })),
      };
    } catch (error) {
      console.error("Get balance error:", error);
      return {
        success: false,
        error: "Error al obtener balance",
        code: "GET_BALANCE_ERROR",
      };
    }
  },
});

// ============================================================================
// GET TRANSACTIONS ACTION
// ============================================================================

export const getTransactions = defineAction({
  accept: "json",
  input: z.object({
    affiliationId: z.uuid("ID de afiliación inválido"),
    limit: z.number().int().positive().max(100).default(20),
    type: z.enum(["deposit", "withdraw", "all"]).default("all"),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
  }),
  async handler(input, { locals }) {
    try {
      if (!locals.user?.id) {
        return {
          success: false,
          error: "No autenticado",
          code: "UNAUTHORIZED",
        };
      }

      const conditions: any[] = [
        sql`${transactions.cashboxId} = ${input.affiliationId}`,
      ];

      if (input.type !== "all") {
        conditions.push(sql`${transactions.type} = ${input.type}`);
      }

      if (input.startDate) {
        conditions.push(gte(transactions.createdAt, new Date(input.startDate)));
      }
      if (input.endDate) {
        conditions.push(lt(transactions.createdAt, new Date(input.endDate)));
      }

      const results = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit);

      return {
        success: true,
        total: results.length,
        transactions: results.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          concept: tx.concept,
          reference: tx.reference,
          authorizedBy: tx.authorizedBy,
          timestamp: tx.createdAt.toISOString(),
          status: tx.status,
        })),
      };
    } catch (error) {
      console.error("Get transactions error:", error);
      return {
        success: false,
        error: "Error al obtener transacciones",
        code: "GET_TRANSACTIONS_ERROR",
      };
    }
  },
});

// ============================================================================
// GET DAILY SUMMARY ACTION
// ============================================================================

export const getDailySummary = defineAction({
  accept: "json",
  input: z.object({
    affiliationId: z.uuid("ID de afiliación inválido"),
    date: z.iso.datetime().optional(),
  }),
  async handler(input, { locals }) {
    try {
      if (!locals.user?.id) {
        return {
          success: false,
          error: "No autenticado",
          code: "UNAUTHORIZED",
        };
      }

      const targetDate = input.date ? new Date(input.date) : new Date();
      const startOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        0, 0, 0, 0,
      );
      const endOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        23, 59, 59, 999,
      );

      const dailyTxs = await db
        .select()
        .from(transactions)
        .where(
          and(
            sql`${transactions.cashboxId} = ${input.affiliationId}`,
            gte(transactions.createdAt, startOfDay),
            lt(transactions.createdAt, endOfDay),
          ),
        );

      const totalDeposits = dailyTxs
        .filter((tx) => tx.type === "deposit")
        .reduce((sum, tx) => sum + parseFloat(tx.amount as any), 0)
        .toFixed(2);

      const totalWithdraws = dailyTxs
        .filter((tx) => tx.type === "withdraw")
        .reduce((sum, tx) => sum + parseFloat(tx.amount as any), 0)
        .toFixed(2);

      const depositCount = dailyTxs.filter((tx) => tx.type === "deposit").length;
      const withdrawCount = dailyTxs.filter((tx) => tx.type === "withdraw").length;
      const netChange = (parseFloat(totalDeposits) - parseFloat(totalWithdraws)).toFixed(2);

      return {
        success: true,
        summary: {
          date: startOfDay.toISOString(),
          totalDeposits,
          totalWithdraws,
          depositCount,
          withdrawCount,
          netChange,
          transactionCount: dailyTxs.length,
        },
      };
    } catch (error) {
      console.error("Get daily summary error:", error);
      return {
        success: false,
        error: "Error al obtener resumen diario",
        code: "GET_SUMMARY_ERROR",
      };
    }
  },
});

// ============================================================================
// CREATE AFFILIATION ACTION
// ============================================================================

export const createAffiliation = defineAction({
  accept: "form",
  input: z.object({
    name: z.string().min(1, "Nombre requerido").max(255),
    code: z.string().min(1, "Código requerido").max(50),
    description: z.string().max(500).optional(),
  }),
  async handler(input, { locals }) {
    try {
      if (!locals.user?.id) {
        return { success: false, error: "No autenticado", code: "UNAUTHORIZED" };
      }

      const { name, code, description } = input;

      const [newCashBox] = await db
        .insert(cashboxes)
        .values({
          name,
          code,
          description: description || null,
          balance: "0.00",
          status: "activo",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        success: true,
        message: `Caja ${name} creada exitosamente`,
        cashBox: newCashBox,
      };
    } catch (error) {
      console.error("Create affiliation error:", error);
      return { success: false, error: "Error al crear afiliación", code: "CREATE_AFFILIATION_ERROR" };
    }
  },
});

// ─── Finance: Create Cashbox ──────────────────────────────────────────────────

export const createCashbox = defineAction({
  accept: "form",
  input: z.object({
    name: z.string().min(2, "Nombre requerido").max(255),
    code: z.string().min(2, "Código requerido").max(50)
      .regex(/^[A-Z0-9_\-]+$/i, "Código inválido — solo letras, números, _ y -"),
    description: z.string().max(500).optional(),
    balance: z.coerce.number().min(0).default(0),
  }),
  handler: async (input, ctx) => {
    const user = ctx.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

    const [existing] = await db
      .select({ id: cashboxes.id })
      .from(cashboxes)
      .where(eq(cashboxes.code, input.code.toUpperCase()));

    if (existing) {
      throw new ActionError({
        code: "CONFLICT",
        message: `El código "${input.code}" ya está en uso.`,
      });
    }

    const [cashbox] = await db
      .insert(cashboxes)
      .values({
        name: input.name,
        code: input.code.toUpperCase(),
        description: input.description ?? null,
        balance: String(input.balance),
        status: "activo",
      })
      .returning();

    return { success: true, message: "Caja creada correctamente.", cashbox };
  },
});

// ============================================================================
// TRANSACTION CATEGORY ACTIONS
// ============================================================================

export const createTransactionCategory = defineAction({
  accept: "form",
  input: z.object({
    name: z.string().trim().min(1, "Nombre requerido").max(100, "Nombre demasiado largo"),
    code: z.string().trim().min(1, "Codigo requerido").max(50, "Codigo demasiado largo"),
    type: z.enum(["income", "outcome"]),
    description: z.string().trim().max(500, "Descripcion demasiado larga").optional(),
    icon: z.preprocess(
      (value) => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
      },
      z.string().max(50, "Icono demasiado largo").optional(),
    ),
    invoiceRangeId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
      z.uuid("ID de talonario inválido").optional(),
    ),
    parentId: z.preprocess(
      (value) => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
      },
      z.uuid("Cuenta padre invalida").optional(),
    ),
    requiresAuthorization: z.preprocess(
      (value) => value === "on" || value === true,
      z.boolean(),
    ),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;
      if (!user?.id) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion para crear cuentas" });
      }

      const normalizedCode = input.code.trim().toUpperCase().replace(/\s+/g, "_");

      const [existingCategory] = await db
        .select({ id: transactionCategories.id })
        .from(transactionCategories)
        .where(eq(transactionCategories.code, normalizedCode))
        .limit(1);

      if (existingCategory) {
        throw new ActionError({ code: "CONFLICT", message: "Ya existe una cuenta con ese codigo" });
      }

      if (input.parentId) {
        const [parent] = await db
          .select({ id: transactionCategories.id, type: transactionCategories.type, status: transactionCategories.status })
          .from(transactionCategories)
          .where(eq(transactionCategories.id, input.parentId))
          .limit(1);

        if (!parent || !parent.status) {
          throw new ActionError({ code: "NOT_FOUND", message: "La cuenta padre no existe o esta inactiva" });
        }

        if (parent.type !== input.type) {
          throw new ActionError({ code: "BAD_REQUEST", message: "La cuenta padre debe ser del mismo tipo" });
        }
      }

      const [category] = await db
        .insert(transactionCategories)
        .values({
          name: input.name.trim(),
          code: normalizedCode,
          type: input.type,
          description: input.description?.trim() || null,
          icon: input.icon?.trim() || null,
          parentId: input.parentId ?? null,
          requiresAuthorization: input.requiresAuthorization,
          invoiceRangeId: input.invoiceRangeId ?? null,
          isSystem: false,
          status: true,
          createdByUserId: user.id,
        })
        .returning({
          id: transactionCategories.id,
          name: transactionCategories.name,
          code: transactionCategories.code,
          type: transactionCategories.type,
        });

      return { success: true, message: "Cuenta creada correctamente", category };
    } catch (error) {
      if (error instanceof ActionError) throw error;
      console.error("Create transaction category error:", error);
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear la cuenta" });
    }
  },
});

export const updateTransactionCategory = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.uuid("ID de cuenta invalido"),
    name: z.string().trim().min(1, "Nombre requerido").max(100, "Nombre demasiado largo"),
    code: z.string().trim().min(1, "Codigo requerido").max(50, "Codigo demasiado largo"),
    type: z.enum(["income", "outcome"]),
    description: z.string().trim().max(500, "Descripcion demasiado larga").optional(),
    icon: z.preprocess(
      (value) => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
      },
      z.string().max(50, "Icono demasiado largo").optional(),
    ),
    parentId: z.preprocess(
      (value) => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
      },
      z.uuid("Cuenta padre invalida").optional(),
    ),
    invoiceRangeId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
      z.uuid("ID de talonario inválido").optional(),
    ),
    requiresAuthorization: z.preprocess(
      (value) => value === "on" || value === true,
      z.boolean(),
    ),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;
      if (!user?.id) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion para actualizar cuentas" });
      }

      const normalizedCode = input.code.trim().toUpperCase().replace(/\s+/g, "_");

      const [existingCategory] = await db
        .select({ id: transactionCategories.id, code: transactionCategories.code })
        .from(transactionCategories)
        .where(eq(transactionCategories.id, input.categoryId))
        .limit(1);

      if (!existingCategory) {
        throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      if (existingCategory.code !== normalizedCode) {
        const [duplicate] = await db
          .select({ id: transactionCategories.id })
          .from(transactionCategories)
          .where(eq(transactionCategories.code, normalizedCode))
          .limit(1);

        if (duplicate) {
          throw new ActionError({ code: "CONFLICT", message: "Ya existe una cuenta con ese codigo" });
        }
      }

      if (input.parentId) {
        if (input.parentId === input.categoryId) {
          throw new ActionError({ code: "BAD_REQUEST", message: "La cuenta padre no puede ser la misma" });
        }

        const [parent] = await db
          .select({ id: transactionCategories.id, type: transactionCategories.type, status: transactionCategories.status })
          .from(transactionCategories)
          .where(eq(transactionCategories.id, input.parentId))
          .limit(1);

        if (!parent || !parent.status) {
          throw new ActionError({ code: "NOT_FOUND", message: "La cuenta padre no existe o esta inactiva" });
        }

        if (parent.type !== input.type) {
          throw new ActionError({ code: "BAD_REQUEST", message: "La cuenta padre debe ser del mismo tipo" });
        }
      }

      await db
        .update(transactionCategories)
        .set({
          name: input.name.trim(),
          code: normalizedCode,
          type: input.type,
          description: input.description?.trim() || null,
          icon: input.icon?.trim() || null,
          parentId: input.parentId ?? null,
          invoiceRangeId: input.invoiceRangeId ?? null,
          requiresAuthorization: input.requiresAuthorization,
          updatedAt: new Date(),
        })
        .where(eq(transactionCategories.id, input.categoryId));

      return { success: true, message: "Cuenta actualizada correctamente", categoryId: input.categoryId };
    } catch (error) {
      if (error instanceof ActionError) throw error;
      console.error("Update transaction category error:", error);
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo actualizar la cuenta" });
    }
  },
});

export const disableTransactionCategory = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.uuid("ID de cuenta invalido"),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;
      if (!user?.id) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion para desactivar cuentas" });
      }

      const [category] = await db
        .select({ id: transactionCategories.id, name: transactionCategories.name, status: transactionCategories.status, isSystem: transactionCategories.isSystem })
        .from(transactionCategories)
        .where(eq(transactionCategories.id, input.categoryId))
        .limit(1);

      if (!category) {
        throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      if (!category.status) {
        return { success: true, message: "La cuenta ya estaba desactivada", categoryId: category.id };
      }

      if (category.isSystem) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Las cuentas del sistema no se pueden desactivar" });
      }

      await db
        .update(transactionCategories)
        .set({ status: false, deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(transactionCategories.id, input.categoryId));

      return { success: true, message: `Cuenta "${category.name}" desactivada`, categoryId: category.id };
    } catch (error) {
      if (error instanceof ActionError) throw error;
      console.error("Disable transaction category error:", error);
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo desactivar la cuenta" });
    }
  },
});

export const activateTransactionCategory = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.uuid("ID de cuenta invalido"),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;
      if (!user?.id) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion para activar cuentas" });
      }

      const [category] = await db
        .select({ id: transactionCategories.id, name: transactionCategories.name, status: transactionCategories.status })
        .from(transactionCategories)
        .where(eq(transactionCategories.id, input.categoryId))
        .limit(1);

      if (!category) {
        throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      if (category.status) {
        return { success: true, message: "La cuenta ya estaba activa", categoryId: category.id };
      }

      await db
        .update(transactionCategories)
        .set({ status: true, deletedAt: null, updatedAt: new Date() })
        .where(eq(transactionCategories.id, input.categoryId));

      return { success: true, message: `Cuenta "${category.name}" activada`, categoryId: category.id };
    } catch (error) {
      if (error instanceof ActionError) throw error;
      console.error("Activate transaction category error:", error);
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo activar la cuenta" });
    }
  },
});

export const setCategorySortOrder = defineAction({
  accept: "form",
  input: z.object({
    categoryId: z.uuid("ID de cuenta invalido"),
    sortOrder: z.coerce.number().int().min(1).max(999),
  }),
  async handler(input, { locals }) {
    try {
      const user = locals.user;
      if (!user?.id) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Debe iniciar sesion" });
      }

      const [category] = await db
        .select({ id: transactionCategories.id, name: transactionCategories.name })
        .from(transactionCategories)
        .where(eq(transactionCategories.id, input.categoryId))
        .limit(1);

      if (!category) {
        throw new ActionError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      await db
        .update(transactionCategories)
        .set({ sortOrder: input.sortOrder, updatedAt: new Date() })
        .where(eq(transactionCategories.id, input.categoryId));

      return { success: true, message: `Orden actualizado para "${category.name}"`, categoryId: category.id };
    } catch (error) {
      if (error instanceof ActionError) throw error;
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo actualizar el orden" });
    }
  },
});

export const finance = {
  deposit,
  withdraw,
  getTransactions,
  getDailySummary,
  createCashbox,
  createTransactionCategory,
  updateTransactionCategory,
  disableTransactionCategory,
  activateTransactionCategory,
  setCategorySortOrder,
  voidTransaction,
  transfer,
  payContractor,
  createContractor,
  updateContractorStatus,
  toggleQuickCashbox,
  toggleCashboxStatus,
};
