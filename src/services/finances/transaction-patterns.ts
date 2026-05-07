import { sql } from "drizzle-orm";

export const realTransactionFilter = sql`TRUE`;
export const internalTransferLegFilter = sql`FALSE`;

type TransactionLike = {
    type?: string | null;
};

export const isTransferTransaction = (_tx: TransactionLike) => false;

export const getTransactionKindLabel = (tx: TransactionLike) =>
    tx.type === "deposit"
          ? "Ingreso"
          : "Egreso";
