// import { PAYMENT_TYPES, type PaymentTypeValue } from "@/types/invoice";
import { formatBOB } from "@/services/finances/helpers";

export const IMAGE_ASSESTS = {
  home: {
    hero: "/carraco-tropical-hero.png",
    icon: "/carrasco_transporte.jpg",
    afiSteps: "/afiliation-steps.png",
  },
};

export const getPageTitle = (title = "", companyName = "Carrasco Tropical") => {
  if (!title) return companyName;
  if (!companyName || title === companyName) return title;
  return `${title} - ${companyName}`;
};

export const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "activo":
      return "bg-green-100 text-green-800 border-green-200";
    case "inactivo":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "suspendido":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "moroso":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "expulsado":
      return "bg-red-100 text-red-800 border-red-200";
    case "en trámite":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "jubilado":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "licencia":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "observado":
      return "bg-pink-100 text-pink-800 border-pink-200";
    default:
      return "bg-zinc-100 text-zinc-800 border-zinc-200";
  }
};

export const getStatusText = (status: string) => {
  switch (status?.toLowerCase()) {
    case "activo":
      return "Activo";
    case "inactivo":
      return "Inactivo";
    case "suspendido":
      return "Suspendido";
    case "moroso":
      return "Moroso";
    case "expulsado":
      return "Expulsado";
    case "en trámite":
      return "En Trámite";
    case "jubilado":
      return "Jubilado";
    case "con licencia":
      return "Con Licencia";
    case "observado":
      return "En Observación";
    default:
      return "Sin Estado";
  }
};

// For Drivers
export function getInitials(name: string) {
  return name
    .trim()
    .split(" ")
    .map((n) => n[0])
    .join("");
}

// export function getPaymentStatusColor(status: string) {
//   switch (status) {
//     case PaymentStatus.Completado:
//       return "bg-primary/10 text-primary border-primary/20";

//     case PaymentStatus.Pendiente:
//       return "bg-muted text-muted-foreground border-border";

//     default:
//       return "bg-muted text-muted-foreground border-border";
//   }
// }

export const getPenaltyStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pagado":
      return "bg-green-100 text-green-800";
    case "pendiente":
      return "bg-yellow-100 text-yellow-800";
    case "exonerado":
      return "bg-blue-100 text-blue-800";
    case "apelado":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// ─── VEHICLE STATUS Helpers ──────────────────────────────────────────────────────────────────
// const VEHICLE_STATUS_COLORS: Record<VehicleAffiliationStatus, string> = {
//   [VehicleAffiliationStatus.ACTIVO]:
//     "bg-green-500/10 text-green-400 border-green-500/20",
//   [VehicleAffiliationStatus.INACTIVO]:
//     "bg-gray-500/10 text-gray-400 border-gray-500/20",
//   [VehicleAffiliationStatus.LICENCIA]:
//     "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
// };

// export const getVehicleStatusColor = (status: VehicleAffiliationStatus) =>
//   VEHICLE_STATUS_COLORS[status] ?? "bg-blue-500/10 text-blue-400 border-blue-500/20";

// const buildKitUrl = (tab: string) => `/panel/afiliados/${id}/kit?tab=${tab}`
export const frontendRoutes = {
  vehicle: (id: string | number) =>
    `/panel/afiliados/${id}/perfil/herramientas/`,
  history: (id: string | number) => `/panel/afiliados/${id}/`,
  penalties: (id: string | number) => `/panel/afiliados/${id}/multas/`,
  penaltiesPayment: (id: string | number) =>
    `/panel/afiliados/${id}/pagos/multas/`,
  perfil: (id: string | number) => `/panel/afiliados/${id}/perfil/`,
  missedEventsPayment: (id: string | number) =>
    `/panel/afiliados/${id}/pagos/faltas/`,
  afiliationPayment: (id: string | number) => `/panel/afiliados/${id}/pagos`,
  kit: (id: string | number) => `/panel/afiliados/${id}/kit/`,
  certificaciones: (id: string | number) =>
    `/panel/afiliados/${id}/certificaciones/`,
};

// For Discounts
// export const formatDiscountValue = (type: string, value: number) => {
//   if (type === DiscountType.Porcentaje) {
//     return `${value}%`;
//   }
//   return formatBOB(value);
// };

export const formatDateTime = (date: Date) => {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).format(date);
};
