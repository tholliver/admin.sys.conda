// src/utils/ui.ts

export const IMAGE_ASSETS = {
  home: {
    hero: "/carraco-tropical-hero.png",
    icon: "/carrasco_transporte.jpg",
    afiSteps: "/afiliation-steps.png",
  },
};

export const getPageTitle = (title = "", company = "Carrasco Tropical") =>
  !title ? company : title === company ? title : `${title} - ${company}`;

export const getInitials = (name: string) =>
  name.trim().split(" ").map(n => n[0]).join("");

export const getStatusColor = (status: string): string => ({
  activo:      "bg-green-100 text-green-800 border-green-200",
  inactivo:    "bg-gray-100 text-gray-800 border-gray-200",
  suspendido:  "bg-yellow-100 text-yellow-800 border-yellow-200",
  moroso:      "bg-orange-100 text-orange-800 border-orange-200",
  expulsado:   "bg-red-100 text-red-800 border-red-200",
  "en trámite":"bg-blue-100 text-blue-800 border-blue-200",
  jubilado:    "bg-purple-100 text-purple-800 border-purple-200",
  licencia:    "bg-indigo-100 text-indigo-800 border-indigo-200",
  observado:   "bg-pink-100 text-pink-800 border-pink-200",
}[status.toLowerCase()] ?? "bg-zinc-100 text-zinc-800 border-zinc-200");

export const getStatusText = (status: string): string => ({
  activo:       "Activo",
  inactivo:     "Inactivo",
  suspendido:   "Suspendido",
  moroso:       "Moroso",
  expulsado:    "Expulsado",
  "en trámite": "En Trámite",
  jubilado:     "Jubilado",
  "con licencia":"Con Licencia",
  observado:    "En Observación",
}[status?.toLowerCase()] ?? "Sin Estado");

export const getPenaltyStatusColor = (status: string): string => ({
  pagado:     "bg-green-100 text-green-800",
  pendiente:  "bg-yellow-100 text-yellow-800",
  exonerado:  "bg-blue-100 text-blue-800",
  apelado:    "bg-purple-100 text-purple-800",
}[status?.toLowerCase()] ?? "bg-gray-100 text-gray-800");

export const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).format(d);
