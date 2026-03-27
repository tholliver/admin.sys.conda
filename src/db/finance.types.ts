import type { cashBoxStatusEnum, categoryTypeEnum, transactionStatusEnum, transactionTypeEnum } from "./schema";

export const TRANSACTION_TYPE = {
  DEPOSIT: "deposit",
  WITHDRAW: "withdraw",
} as const satisfies Record<string, typeof transactionTypeEnum.enumValues[number]>

export const TRANSACTION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const satisfies Record<string, typeof transactionStatusEnum.enumValues[number]>

export const CASHBOX_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  ARCHIVED: "archived",
} as const satisfies Record<string, typeof cashBoxStatusEnum.enumValues[number]>

export const CATEGORY_TYPE = {
  INCOME: "income",
  OUTCOME: "outcome",
} as const satisfies Record<string, typeof categoryTypeEnum.enumValues[number]>
