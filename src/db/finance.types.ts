import type { cashBoxStatusEnum, categoryTypeEnum, transactionStatusEnum, transactionTypeEnum } from "./schema";

export const TRANSACTION_TYPE = {
  DEPOSIT: "deposit",
  WITHDRAW: "withdraw",
} as const satisfies Record<string, typeof transactionTypeEnum.enumValues[number]>

export const TRANSACTION_STATUS = {
  PENDING: "pendiente",
  COMPLETED: "completado",
  FAILED: "fallido",
  CANCELLED: "cancelado",
} as const satisfies Record<string, typeof transactionStatusEnum.enumValues[number]>

export const CASHBOX_STATUS = {
  ACTIVE: "activo",
  INACTIVE: "inactivo",
  SUSPENDED: "suspendido",
  ARCHIVED: "archivado",
} as const satisfies Record<string, typeof cashBoxStatusEnum.enumValues[number]>

export const CATEGORY_TYPE = {
  INCOME: "income",
  OUTCOME: "outcome",
} as const satisfies Record<string, typeof categoryTypeEnum.enumValues[number]>
