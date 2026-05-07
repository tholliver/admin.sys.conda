// =============================================================================
// formatters.ts — Unified formatter utility
// Bolivia-first (es-BO, UTC-4, Bs.)
// =============================================================================

import { Currency, type CurrencyType } from "@/lib/schemas/currency.schemas";
import type {
  transactionStatusEnum,
  transactionTypeEnum,
  categoryTypeEnum,
  cashBoxStatusEnum,
} from "@/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NumberInput  = number | string | null | undefined;
export type DateInput    = Date | string | null | undefined;
type DateStyle           = "short" | "medium" | "long" | "full";

type TxStatus     = (typeof transactionStatusEnum.enumValues)[number];
type TxType       = (typeof transactionTypeEnum.enumValues)[number];
type CashBoxStatus = (typeof cashBoxStatusEnum.enumValues)[number];
type CategoryType = (typeof categoryTypeEnum.enumValues)[number];

export interface StatusMeta {
  label: string;
  color: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const toNum = (value: NumberInput): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (value: DateInput): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TZ = "America/La_Paz" as const; // UTC-4, no DST

// =============================================================================
// 1. NUMBER FORMATTERS
// =============================================================================

const _num = new Intl.NumberFormat("es-BO");
const _numWhole = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 });
const _numRate  = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const _numCompact = new Intl.NumberFormat("es",  { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 });

/** 15.800 → "15.800"  (es-BO decimal grouping) */
export const num = (value: NumberInput): string =>
  _num.format(toNum(value));

/** 15800.9 → "15.801" */
export const numWhole = (value: NumberInput): string =>
  _numWhole.format(toNum(value));

/** 1.5 → "1,500"  |  0.123 → "0,123" — for exchange rates */
export const numRate = (value: NumberInput): string =>
  _numRate.format(toNum(value));

/** 15800 → "15,8 mil"  |  1500000 → "1,5 M" */
export const numCompact = (value: NumberInput): string => {
  const formatted = _numCompact.format(toNum(value));
  // Normalize spacing: "15mil" → "15 mil", "1M" → "1 M"
  return formatted.replace(/(\d)(mil|M|B)/, "$1 $2");
};

/** 0.42 → "42 %" */
export const numPercent = (value: NumberInput): string =>
  `${toNum(value).toFixed(1).replace(".", ",")} %`;

/** Derive percentage from part/total safely */
export const calcPercent = (part: NumberInput, total: NumberInput): string => {
  const p = toNum(part), t = toNum(total);
  if (t === 0 || !Number.isFinite(p / t)) return "0,0 %";
  return numPercent((p / t) * 100);
};

// =============================================================================
// 2. CURRENCY FORMATTERS  (Bs. = BOB, $ = USD)
// =============================================================================

const _bob       = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
const _bobWhole  = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 0 });
const _usd       = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const _usdWhole  = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const _currencyMap: Record<CurrencyType, Intl.NumberFormat> = {
  [Currency.BOB]: _bob,
  [Currency.USD]: _usd,
};
const _currencyWholeMap: Record<CurrencyType, Intl.NumberFormat> = {
  [Currency.BOB]: _bobWhole,
  [Currency.USD]: _usdWhole,
};

/** 15800 → "Bs 15.800,00" */
export const bob = (value: NumberInput): string =>
  _bob.format(toNum(value));

/** 15800 → "Bs 15.800" */
export const bobWhole = (value: NumberInput): string =>
  _bobWhole.format(toNum(value));

/** 15800 → "$15,800.00" */
export const usd = (value: NumberInput): string =>
  _usd.format(toNum(value));

/** Any currency with decimals */
export const currency = (value: NumberInput, curr: CurrencyType): string =>
  _currencyMap[curr].format(toNum(value));

/** Any currency, no decimals — for cards/summaries */
export const currencyWhole = (value: NumberInput, curr: CurrencyType = Currency.BOB): string =>
  _currencyWholeMap[curr].format(toNum(value));

/**
 * Smart BOB: full precision for small amounts, compact for large.
 *
 * < 10.000  → "Bs 9.850,00"
 * ≥ 10.000  → "Bs. 15,8 mil" | "Bs. 2,3 M"
 */
export const bobSmart = (value: NumberInput): string => {
  const n = toNum(value);
  if (Math.abs(n) >= 10_000) return `Bs. ${numCompact(n)}`;
  return bob(n);
};

/** +Bs 500,00  /  -Bs 200,00  — for transaction ledger rows */
export const bobSigned = (value: NumberInput, type: "deposit" | "withdraw"): string =>
  `${type === "deposit" ? "+" : "-"}${bob(value)}`;

// =============================================================================
// 3. DATE / TIME FORMATTERS  (America/La_Paz)
// =============================================================================

const _dateFormatters: Record<DateStyle, Intl.DateTimeFormat> = {
  /** 24/05/2025, 14:30 */
  short: new Intl.DateTimeFormat("es-BO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: TZ,
  }),
  /** 24 may. 2025 */
  medium: new Intl.DateTimeFormat("es-BO", {
    day: "numeric", month: "short", year: "numeric",
    timeZone: TZ,
  }),
  /** 24 de mayo de 2025 */
  long: new Intl.DateTimeFormat("es-BO", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: TZ,
  }),
  /** 24 de mayo de 2025, 14:30 */
  full: new Intl.DateTimeFormat("es-BO", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: TZ,
  }),
};

/**
 * @param style  "short" | "medium" | "long" | "full"  (default: "short")
 * @example date("2025-05-24")          → "24/05/2025, 14:30"
 * @example date("2025-05-24", "long")  → "24 de mayo de 2025"
 */
export const date = (value: DateInput, style: DateStyle = "short"): string => {
  const d = toDate(value);
  return d ? _dateFormatters[style].format(d) : "—";
};

/**
 * Relative time in Spanish.
 * @example timeAgo("2025-05-20") → "hace 4 días"
 */
export const timeAgo = (value: DateInput): string => {
  const d = toDate(value);
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const future  = diffMs < 0;
  const abs     = Math.abs(diffMs);
  const secs    = Math.floor(abs / 1000);
  const mins    = Math.floor(secs / 60);
  const hours   = Math.floor(mins / 60);
  const days    = Math.floor(hours / 24);
  const months  = Math.floor(days / 30.44);
  const years   = Math.floor(days / 365.25);

  const fmt = (n: number, unit: string, plural: string) =>
    future ? `en ${n} ${n === 1 ? unit : plural}` : `hace ${n} ${n === 1 ? unit : plural}`;

  if (years  > 0) return fmt(years,  "año",     "años");
  if (months > 0) return fmt(months, "mes",     "meses");
  if (days   > 0) return fmt(days,   "día",     "días");
  if (hours  > 0) return fmt(hours,  "hora",    "horas");
  if (mins   > 0) return fmt(mins,   "minuto",  "minutos");
  return future ? "en unos segundos" : "hace unos segundos";
};

/**
 * "YYYY-MM" → "mayo 2025"
 * @example period("2025-05") → "mayo 2025"
 */
export const period = (value: string): string => {
  const [y, m] = value.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("es-BO", { month: "long", year: "numeric" });
};

/** Current period as "YYYY-MM" */
export const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// =============================================================================
// 4. UTILITY
// =============================================================================

/** Bytes → human-readable.  1536 → "1.50 KB" */
export const fileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${units[i]}`;
};

// =============================================================================
// 5. ENUM → LABEL + COLOR  (for UI badges / chips)
// =============================================================================

const UNKNOWN: StatusMeta = Object.freeze({ label: "Desconocido", color: "text-gray-500" });

const TX_STATUS = Object.freeze({
  pendiente:  { label: "Pendiente",  color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  completado: { label: "Completado", color: "bg-blue-50   text-blue-700   border-blue-200"   },
  fallido:    { label: "Fallido",    color: "bg-red-50    text-red-700    border-red-200"     },
  cancelado:  { label: "Cancelado",  color: "bg-slate-100 text-slate-700  border-slate-200"  },
} as const);

const TX_TYPE = Object.freeze({
  deposit:  { label: "Depósito", color: "text-emerald-600" },
  withdraw: { label: "Retiro",   color: "text-rose-600"    },
} as const);

const CASHBOX_STATUS = Object.freeze({
  activo:     { label: "Activo",     color: "text-green-600"  },
  inactivo:   { label: "Inactivo",   color: "text-gray-500"   },
  suspendido: { label: "Suspendido", color: "text-orange-600" },
  archivado:  { label: "Archivado",  color: "text-slate-400"  },
} as const);

const CATEGORY_TYPE = Object.freeze({
  income:  { label: "Ingreso", color: "text-emerald-600" },
  outcome: { label: "Egreso",  color: "text-rose-600"    },
} as const);

export const txStatus     = (v: string | TxStatus):      StatusMeta => TX_STATUS[v      as TxStatus]      ?? UNKNOWN;
export const txType       = (v: string | TxType):        StatusMeta => TX_TYPE[v        as TxType]        ?? UNKNOWN;
export const cashboxStatus = (v: string | CashBoxStatus): StatusMeta => CASHBOX_STATUS[v as CashBoxStatus] ?? UNKNOWN;
export const categoryType = (v: string | CategoryType):  StatusMeta => CATEGORY_TYPE[v  as CategoryType]  ?? UNKNOWN;

// =============================================================================
// LEGACY ALIASES  — keeps existing imports working without a mass rename
// Remove once codebase is migrated.
// =============================================================================

/** @deprecated use `bob` */        export const formatBOB                = bob;
/** @deprecated use `usd` */        export const formatUSD                = usd;
/** @deprecated use `num` */        export const formatNumber              = num;
/** @deprecated use `numWhole` */   export const formatWholeNumber        = numWhole;
/** @deprecated use `numRate` */    export const formatRateNumber         = numRate;
/** @deprecated use `numCompact` */ export const formatCompact            = numCompact;
/** @deprecated use `bobSmart` */   export const formatSmartBOB           = bobSmart;
/** @deprecated use `numCompact` */ export const formatCompactBOB         = (v: NumberInput) => `Bs. ${numCompact(v)}`;
/** @deprecated use `numCompact` */ export const formatCompactUSD         = (v: NumberInput) => `$${numCompact(v)}`;
/** @deprecated use `currency` */   export const formatCurrency           = currency;
/** @deprecated use `currencyWhole` */ export const formatCurrencyNoDecimals = currencyWhole;
/** @deprecated use `bobSigned` */  export const formatTransactionCurrency = bobSigned;
/** @deprecated use `txStatus` */   export const formatTransactionStatus  = txStatus;
/** @deprecated use `txType` */     export const formatTransactionType    = txType;
/** @deprecated use `cashboxStatus` */ export const formatCashBoxStatus   = cashboxStatus;
/** @deprecated use `categoryType` */ export const formatCategoryType     = categoryType;
/** @deprecated use `date` */       export const formatDate               = date;
/** @deprecated use `period` */     export const formatPeriod             = period;
/** @deprecated use `fileSize` */   export const formatBytes              = fileSize;
