import { Currency, type CurrencyType } from "@/lib/schemas/currency.schemas";

export type NumberInput = number | string | null | undefined;

const toNumber = (value: NumberInput) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const NUMBER_FORMATTER = new Intl.NumberFormat("es-BO");
const WHOLE_NUMBER_FORMATTER = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const RATE_NUMBER_FORMATTER = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

const CURRENCY_FORMATTERS: Record<CurrencyType, Intl.NumberFormat> = {
  [Currency.BOB]: new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: Currency.BOB,
  }),
  [Currency.USD]: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: Currency.USD,
  }),
};

const CURRENCY_FORMATTERS_WHOLE: Record<CurrencyType, Intl.NumberFormat> = {
  [Currency.BOB]: new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: Currency.BOB,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  [Currency.USD]: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: Currency.USD,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
};

export const formatNumber = (value: NumberInput) =>
  NUMBER_FORMATTER.format(toNumber(value));

export const formatWholeNumber = (value: NumberInput) =>
  WHOLE_NUMBER_FORMATTER.format(toNumber(value));

export const formatRateNumber = (value: NumberInput) =>
  RATE_NUMBER_FORMATTER.format(toNumber(value));

export const formatCurrency = (value: NumberInput, currency: CurrencyType) =>
  CURRENCY_FORMATTERS[currency].format(toNumber(value));

export const formatCurrencyNoDecimals = (
  value: NumberInput,
  currency: CurrencyType = Currency.BOB,
) => CURRENCY_FORMATTERS_WHOLE[currency].format(toNumber(value));

export const formatBOB = (value: NumberInput) =>
  CURRENCY_FORMATTERS[Currency.BOB].format(toNumber(value));

export const formatUSD = (value: NumberInput) =>
  CURRENCY_FORMATTERS[Currency.USD].format(toNumber(value));

export const formatTransactionCurrency = (
  amount: NumberInput,
  type: "deposit" | "withdraw",
) => `${type === "deposit" ? "+" : "-"}${formatBOB(amount)}`;


// -------------------------- UI -------------------------------------
//
//
/* FOR FINANCE UI SECTIONS */

import type {
  transactionStatusEnum,
  transactionTypeEnum,
  categoryTypeEnum,
  cashBoxStatusEnum,
} from "@/db/schema";

// translations.ts - Spanish mappings
export const transactionTypeLabels: Record<
  (typeof transactionTypeEnum.enumValues)[number],
  string
> = {
  deposit: "Depósito",
  withdraw: "Retiro",
};

export const transactionStatusLabels: Record<
  (typeof transactionStatusEnum.enumValues)[number],
  string
> = {
  pending: "Pendiente",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

export const cashBoxStatusLabels: Record<
  (typeof cashBoxStatusEnum.enumValues)[number],
  string
> = {
  active: "Activo",
  inactive: "Inactivo",
  suspended: "Suspendido",
  archived: "Archivado",
};

export const categoryTypeLabels: Record<
  (typeof categoryTypeEnum.enumValues)[number],
  string
> = {
  income: "Ingreso",
  outcome: "Egreso",
};

const TX_STATUS_MAP = Object.freeze({
  pending: { label: "Pendiente", color: "bg-yellow-50 text-yellow-700" },
  completed: { label: "Completado", color: "bg-blue-50 text-blue-700" },
  failed: { label: "Fallido", color: "bg-red-50 text-red-700" },
  cancelled: { label: "Cancelado", color: "bg-slate-100 text-slate-700" },
} as const);

const TX_TYPE_MAP = Object.freeze({
  deposit: { label: "Depósito", color: "text-emerald-600" },
  withdraw: { label: "Retiro", color: "text-rose-600" },
} as const);

const CASHBOX_STATUS_MAP = Object.freeze({
  active: { label: "Activo", color: "text-green-600" },
  inactive: { label: "Inactivo", color: "text-gray-500" },
  suspended: { label: "Suspendido", color: "text-orange-600" },
  archived: { label: "Archivado", color: "text-slate-400" },
} as const);

const CATEGORY_TYPE_MAP = Object.freeze({
  income: { label: "Ingreso", color: "text-emerald-600" },
  outcome: { label: "Egreso", color: "text-rose-600" },
} as const);

type TxStatus = (typeof transactionStatusEnum.enumValues)[number];
type TxType = (typeof transactionTypeEnum.enumValues)[number];
type CashBoxStatus = (typeof cashBoxStatusEnum.enumValues)[number];
type CategoryType = (typeof categoryTypeEnum.enumValues)[number];
const UNKNOWN = Object.freeze({ label: "Desconocido", color: "text-gray-600" });

// Optimized formatters (single lookup, no object creation)
export const formatTransactionStatus = (status: string | TxStatus) =>
  TX_STATUS_MAP[status as TxStatus] ?? UNKNOWN;

export const formatTransactionType = (type: string | TxType) =>
  TX_TYPE_MAP[type as TxType] ?? UNKNOWN;

export const formatCashBoxStatus = (status: string | CashBoxStatus) =>
  CASHBOX_STATUS_MAP[status as CashBoxStatus] ?? UNKNOWN;

export const formatCategoryType = (type: string | CategoryType) =>
  CATEGORY_TYPE_MAP[type as CategoryType] ?? UNKNOWN;
