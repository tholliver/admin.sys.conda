import { transactions } from "@/db/schema";
import { isNotNull, isNull } from "drizzle-orm";

export const realTransactionFilter = isNull(transactions.transferPairId);
export const internalTransferLegFilter = isNotNull(transactions.transferPairId);

type TransactionLike = {
    transferPairId?: string | null;
    type?: string | null;
};

export const isTransferTransaction = (tx: TransactionLike) =>
    !!tx.transferPairId;

export const getTransactionKindLabel = (tx: TransactionLike) =>
    isTransferTransaction(tx)
        ? "Traslado"
        : tx.type === "deposit"
          ? "Ingreso"
          : "Egreso";
