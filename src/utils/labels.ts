import type { transactionStatusEnum, transactionTypeEnum, categoryTypeEnum, cashBoxStatusEnum } from "@/db/schema";

type TxStatus      = (typeof transactionStatusEnum.enumValues)[number];
type TxType        = (typeof transactionTypeEnum.enumValues)[number];
type CashBoxStatus = (typeof cashBoxStatusEnum.enumValues)[number];
type CategoryType  = (typeof categoryTypeEnum.enumValues)[number];

export type StatusMeta = { label: string; color: string };
const UNKNOWN: StatusMeta = { label: "Desconocido", color: "text-gray-500" };

export const txStatus = (v: string): StatusMeta => ({
  pendiente:  { label: "Pendiente",  color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  completado: { label: "Completado", color: "bg-blue-50 text-blue-700 border-blue-200"       },
  fallido:    { label: "Fallido",    color: "bg-red-50 text-red-700 border-red-200"           },
  cancelado:  { label: "Cancelado",  color: "bg-slate-100 text-slate-700 border-slate-200"   },
}[v] ?? UNKNOWN);

export const txType = (v: string): StatusMeta => ({
  deposit:  { label: "Depósito", color: "text-emerald-600" },
  withdraw: { label: "Retiro",   color: "text-rose-600"    },
}[v] ?? UNKNOWN);

export const cashboxStatus = (v: string): StatusMeta => ({
  activo:     { label: "Activo",     color: "text-green-600"  },
  inactivo:   { label: "Inactivo",   color: "text-gray-500"   },
  suspendido: { label: "Suspendido", color: "text-orange-600" },
  archivado:  { label: "Archivado",  color: "text-slate-400"  },
}[v] ?? UNKNOWN);

export const categoryType = (v: string): StatusMeta => ({
  income:  { label: "Ingreso", color: "text-emerald-600" },
  outcome: { label: "Egreso",  color: "text-rose-600"    },
}[v] ?? UNKNOWN);
