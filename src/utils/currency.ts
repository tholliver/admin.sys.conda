import { Currency, type CurrencyType } from "@/lib/schemas/currency.schemas";

type NumberInput = number | string | null | undefined;
const toNum = (v: NumberInput) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const _bob     = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
const _bobInt  = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 0 });
const _compact = new Intl.NumberFormat("es",    { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 });
const _num     = new Intl.NumberFormat("es-BO");
const _whole   = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 });

export const bob        = (v: NumberInput) => _bob.format(toNum(v));
export const bobInt     = (v: NumberInput) => _bobInt.format(toNum(v));
export const bobSmart   = (v: NumberInput) => { const n = toNum(v); return Math.abs(n) >= 10_000 ? `Bs. ${_compact.format(n)}` : bob(n); };
export const bobTx      = (v: NumberInput, type: "deposit" | "withdraw") => `${type === "deposit" ? "+" : "-"}${bob(v)}`;
export const currency   = (v: NumberInput, curr: CurrencyType = Currency.BOB) =>
  new Intl.NumberFormat(curr === Currency.USD ? "en-US" : "es-BO", { style: "currency", currency: curr }).format(toNum(v));
export const num        = (v: NumberInput) => _num.format(toNum(v));
export const whole      = (v: NumberInput) => _whole.format(toNum(v));
export const percent    = (v: NumberInput) => `${toNum(v).toFixed(1).replace(".", ",")} %`;
export const pct        = (part: NumberInput, total: NumberInput) => { const p = toNum(part), t = toNum(total); return t === 0 ? "0,0 %" : percent((p / t) * 100); };
