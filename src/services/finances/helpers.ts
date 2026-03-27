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
