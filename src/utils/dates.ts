// src/utils/dates.ts
// Bolivia-first (America/La_Paz, UTC-4, no DST)

type DateInput = Date | string | null | undefined;
type DateStyle = "short" | "medium" | "long" | "full";

const TZ = "America/La_Paz" as const;

const toDate = (v: DateInput): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const _fmts: Record<DateStyle, Intl.DateTimeFormat> = {
  short:  new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }),
  medium: new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short",   year: "numeric", timeZone: TZ }),
  long:   new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "long",    year: "numeric", timeZone: TZ }),
  full:   new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "long",    year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }),
};

/** 24/05/2025, 14:30 | 24 may. 2025 | 24 de mayo de 2025 | full with time */
export const date = (v: DateInput, style: DateStyle = "short"): string =>
  toDate(v) ? _fmts[style].format(toDate(v)!) : "—";

/** hace 4 días / en 2 horas */
export const timeAgo = (v: DateInput): string => {
  const d = toDate(v); if (!d) return "—";
  const diff = Date.now() - d.getTime(), future = diff < 0, abs = Math.abs(diff);
  const s = Math.floor(abs / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60),
        dy = Math.floor(h / 24), mo = Math.floor(dy / 30.44), yr = Math.floor(dy / 365.25);
  const f = (n: number, u: string, p: string) => future ? `en ${n} ${n === 1 ? u : p}` : `hace ${n} ${n === 1 ? u : p}`;
  if (yr > 0) return f(yr, "año",    "años");
  if (mo > 0) return f(mo, "mes",    "meses");
  if (dy > 0) return f(dy, "día",    "días");
  if (h  > 0) return f(h,  "hora",   "horas");
  if (m  > 0) return f(m,  "minuto", "minutos");
  return future ? "en unos segundos" : "hace unos segundos";
};

/** How long until expiry: "3d" | "5h" | "hoy" | "vencida" */
export const timeLeft = (v: Date | string): string => {
  const diff = new Date(v).getTime() - Date.now();
  if (diff <= 0) return "vencida";
  const d = Math.floor(diff / 86_400_000), h = Math.floor((diff % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return "hoy";
};

/** "2025-05" → "mayo 2025" */
export const period = (v: string): string => {
  const [y, m] = v.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-BO", { month: "long", year: "numeric" });
};

/** Current period as "YYYY-MM" */
export const nowPeriod = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};

export const addDays = (v: Date | string, days: number): Date => {
  const d = new Date(v); d.setDate(d.getDate() + days); return d;
};

// ─── Ban logic (from timex.ts) ────────────────────────────────────────────────

/** Hours banned per memorandum count */
export const banDuration = (count: number): number =>
  ({ 1: 1, 2: 24, 3: 48, 4: 72, 5: 0 }[count] ?? 0);

export const banType = (count: number): "warning" | "temporary" | "ultimatum" | "definitive" => {
  if (count === 1) return "warning";
  if (count === 5) return "ultimatum";
  if (count >= 6) return "definitive";
  return "temporary";
};

// ─── Legacy shims ─────────────────────────────────────────────────────────────
export const formatter   = _fmts.short;         // timex.ts: formatter.format(date)
export const formatDate  = date;                 // timex.ts: formatDate(date, style)
export const getBanDuration = banDuration;
export const getBanType     = banType;
