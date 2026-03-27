import { db } from "@/db";
import type { transactionStatusEnum } from "./schema";

export type DrizzleTransaction = Parameters<
  Parameters<(typeof db)["transaction"]>[0]
>[0];

export type TransactionStatus = typeof transactionStatusEnum.enumValues[number];
