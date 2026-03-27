type TimeUnit = "years" | "months" | "days" | "hours" | "minutes" | "seconds";

export function timeAgo(date: string | Date, unit?: TimeUnit): string | number {
  const parsedDate = typeof date === "string" ? new Date(date) : date;

  // Convert both dates to Bolivia/La Paz timezone (UTC-4)
  const nowUTC = new Date();
  const parsedUTC = parsedDate;

  // Get Bolivia time by subtracting 4 hours from UTC
  const nowBolivia = new Date(nowUTC.getTime() - 4 * 60 * 60 * 1000);
  const parsedBolivia = new Date(parsedUTC.getTime() - 4 * 60 * 60 * 1000);

  const isFuture = parsedBolivia.getTime() > nowBolivia.getTime();

  const diff = Math.abs(nowBolivia.getTime() - parsedBolivia.getTime());
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const months = Math.floor(days / 30.44);
  const years = Math.floor(days / 365.25);

  const units = {
    years,
    months,
    days,
    hours,
    minutes,
    seconds,
  };

  if (unit) {
    return isFuture ? -units[unit] : units[unit];
  }

  if (isFuture) {
    if (years > 0) return `en ${years} año${years > 1 ? "s" : ""}`;
    if (months > 0) return `en ${months} mes${months > 1 ? "es" : ""}`;
    if (days > 0) return `en ${days} día${days > 1 ? "s" : ""}`;
    if (hours > 0) return `en ${hours} hora${hours > 1 ? "s" : ""}`;
    if (minutes > 0) return `en ${minutes} minuto${minutes > 1 ? "s" : ""}`;
    return "en unos segundos";
  }

  if (years > 0) return `hace ${years} año${years > 1 ? "s" : ""}`;
  if (months > 0) return `hace ${months} mes${months > 1 ? "es" : ""}`;
  if (days > 0) return `hace ${days} día${days > 1 ? "s" : ""}`;
  if (hours > 0) return `hace ${hours} hora${hours > 1 ? "s" : ""}`;
  if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? "s" : ""}`;
  return "hace unos segundos";
}

export function timeLeft(validTo: Date | string): string {
   const now = new Date();
   const end = new Date(validTo);
   const diff = end.getTime() - now.getTime();
   if (diff <= 0) return "vencida";
   const days = Math.floor(diff / (1000 * 60 * 60 * 24));
   const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
   if (days > 0) return `${days}d`;
   if (hours > 0) return `${hours}h`;
   return "hoy";
 }

// --------------------- Ban Times ----------------

//  Ban time
export const getBanDuration = (memorandumCount: number): number => {
  switch (memorandumCount) {
    case 1:
      return 1; // Warning only
    case 2:
      return 24; // 24 hours
    case 3:
      return 48; // 48 hours
    case 4:
      return 72; // 72 hours
    case 5:
      return 0; // Ultimatum - no ban time
    default:
      return 0; // 6+ is permanent removal
  }
};

// FOR MEMOS
export const getBanType = (
  count: number,
): "warning" | "temporary" | "ultimatum" | "definitive" => {
  if (count === 1) return "warning";
  if (count === 5) return "ultimatum";
  if (count >= 6) return "definitive";
  return "temporary";
};

export const formatter = new Intl.DateTimeFormat("es-BO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "America/La_Paz",
});

type DateFormatType = "short" | "medium" | "long" | "full";

const dateFormatters = {
  short: new Intl.DateTimeFormat("es-BO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/La_Paz",
  }),
  medium: new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/La_Paz",
  }),
  long: new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/La_Paz",
  }),
  full: new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/La_Paz",
  }),
};

export const formatDate = (
  date: Date | string,
  formatType: DateFormatType = "short",
): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFormatters[formatType].format(dateObj);
};

export const addDays = (date: Date | string, days: number): Date => {
  const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
  dateObj.setDate(dateObj.getDate() + days);
  return dateObj;
};

// Usage examples:
// formatDate(new Date('2026-01-04'), 'short')           // "04/01/2026"
// formatDate('2026-01-04', 'medium')                    // "4 ene 2026"
// formatDate(new Date(), 'long')                        // "4 enero 2026"
// formatDate(new Date('2026-01-04T14:30:00'), 'full')  // "4 enero 2026, 14:30"
