// src/services/finances/cashbox-transfers.service.ts
// All queries related to inter-cashbox transfers — movements between GEN and other cashboxes.
// No new schema needed: everything lives in finance.transactions via transferPairId + transferToCashboxId.

import { db } from "@/db";
import { cashboxes, transactions, transactionCategories } from "@/db/schema";
import { eq, and, sql, isNull, isNotNull, desc, gte, lte } from "drizzle-orm";
import { GEN_CASHBOX_CODE } from "@/db/finance.types";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CashboxTransferSummary {
  cashboxId:    string;
  cashboxName:  string;
  cashboxCode:  string;
  cashboxBalance: string;
  /** Total sent FROM GEN to this cashbox (all time) */
  totalReceived: string;
  /** Total sent FROM this cashbox back TO GEN (all time) */
  totalReturned: string;
  /** Net = totalReceived - totalReturned — how much of GEN's money is "inside" this cashbox */
  netAdvance:   string;
  transferCount: number;
}

export interface TransferLeg {
  id:          string;
  concept:     string;
  amount:      string;
  notes:       string | null;
  createdAt:   Date;
  createdByUserId: string;
  fromCashboxId:   string;
  fromCashboxName: string;
  toCashboxId:     string;
  toCashboxName:   string;
  transferPairId:  string;
  balanceAfter:    string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getGenId(): Promise<string | null> {
  const [gen] = await db
    .select({ id: cashboxes.id })
    .from(cashboxes)
    .where(and(eq(cashboxes.code, GEN_CASHBOX_CODE), isNull(cashboxes.deletedAt)));
  return gen?.id ?? null;
}

// ── Summary: how much GEN has advanced to each cashbox (net) ──────────────────

/**
 * For every non-GEN cashbox: sum of funds received from GEN minus sum returned.
 * Only counts completed transfer pairs (withdraw leg where cashboxId = GEN).
 */
export async function getGenAdvanceSummary(): Promise<CashboxTransferSummary[]> {
  const genId = await getGenId();
  if (!genId) return [];

  // Funds pushed FROM GEN → each cashbox (withdraw legs originating at GEN)
  const outRows = await db
    .select({
      cashboxId:     transactions.transferToCashboxId,
      totalReceived: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)::text`,
      count:         sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.cashboxId, genId),
        eq(transactions.type, "withdraw"),
        eq(transactions.status, "completado"),
        isNotNull(transactions.transferPairId),
        isNotNull(transactions.transferToCashboxId),
      ),
    )
    .groupBy(transactions.transferToCashboxId);

  // Funds returned FROM each cashbox → GEN (withdraw legs originating at other cashboxes)
  const inRows = await db
    .select({
      cashboxId:     transactions.cashboxId,
      totalReturned: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.transferToCashboxId, genId),
        eq(transactions.type, "withdraw"),
        eq(transactions.status, "completado"),
        isNotNull(transactions.transferPairId),
      ),
    )
    .groupBy(transactions.cashboxId);

  const returnMap = new Map(inRows.map((r) => [r.cashboxId, r.totalReturned]));

  // Fetch cashbox details for all involved cashbox IDs
  const cashboxIds = outRows
    .map((r) => r.cashboxId)
    .filter((id): id is string => id != null);

  if (cashboxIds.length === 0) return [];

  const boxes = await db
    .select({ id: cashboxes.id, name: cashboxes.name, code: cashboxes.code, balance: cashboxes.balance })
    .from(cashboxes)
    .where(isNull(cashboxes.deletedAt));

  const boxMap = new Map(boxes.map((b) => [b.id, b]));

  return outRows
    .filter((r) => r.cashboxId != null && r.cashboxId !== genId)
    .map((r) => {
      const box         = boxMap.get(r.cashboxId!);
      const received    = parseFloat(r.totalReceived);
      const returned    = parseFloat(returnMap.get(r.cashboxId!) ?? "0");
      const net         = received - returned;
      return {
        cashboxId:      r.cashboxId!,
        cashboxName:    box?.name ?? "Desconocida",
        cashboxCode:    box?.code ?? "?",
        cashboxBalance: box?.balance ?? "0",
        totalReceived:  received.toFixed(2),
        totalReturned:  returned.toFixed(2),
        netAdvance:     net.toFixed(2),
        transferCount:  Number(r.count),
      };
    })
    .sort((a, b) => parseFloat(b.netAdvance) - parseFloat(a.netAdvance));
}

/** Single scalar: total net advances from GEN outstanding across all cashboxes */
export async function getTotalNetAdvanceFromGen(): Promise<string> {
  const summary = await getGenAdvanceSummary();
  const total = summary.reduce((s, r) => s + parseFloat(r.netAdvance), 0);
  return total.toFixed(2);
}

// ── Transfer history between GEN and a specific cashbox ───────────────────────

export interface TransferHistoryOptions {
  genId:        string;
  cashboxId:    string;
  /** ISO date string "YYYY-MM-DD" */
  from?:        string;
  to?:          string;
  limit?:       number;
}

/**
 * Returns all transfer legs (both directions) between GEN and a given cashbox.
 * Each row represents the WITHDRAW leg (the "sending" side) for clean directionality.
 */
export async function getTransfersBetween(opts: TransferHistoryOptions): Promise<TransferLeg[]> {
  const { genId, cashboxId, from, to, limit = 100 } = opts;

  const conditions = [
    eq(transactions.status, "completado"),
    isNotNull(transactions.transferPairId),
    // Either direction: GEN→box or box→GEN, only withdraw legs to avoid duplicates
    eq(transactions.type, "withdraw"),
    sql`(
      (${transactions.cashboxId} = ${genId} AND ${transactions.transferToCashboxId} = ${cashboxId})
      OR
      (${transactions.cashboxId} = ${cashboxId} AND ${transactions.transferToCashboxId} = ${genId})
    )`,
  ];

  if (from) conditions.push(gte(transactions.createdAt, new Date(`${from}T04:00:00Z`)));
  if (to)   conditions.push(lte(transactions.createdAt, new Date(`${to}T03:59:59Z`)));

  // We need cashbox names — use aliased sub-selects via raw sql
  const rows = await db
    .select({
      id:              transactions.id,
      concept:         transactions.concept,
      amount:          transactions.amount,
      notes:           transactions.notes,
      createdAt:       transactions.createdAt,
      createdByUserId: transactions.createdByUserId,
      fromCashboxId:   transactions.cashboxId,
      toCashboxId:     transactions.transferToCashboxId,
      transferPairId:  transactions.transferPairId,
      balanceAfter:    transactions.balanceAfter,
    })
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);

  // Resolve cashbox names in one query
  const boxes = await db
    .select({ id: cashboxes.id, name: cashboxes.name })
    .from(cashboxes);
  const nameMap = new Map(boxes.map((b) => [b.id, b.name]));

  return rows.map((r) => ({
    id:              r.id,
    concept:         r.concept,
    amount:          r.amount,
    notes:           r.notes,
    createdAt:       r.createdAt,
    createdByUserId: r.createdByUserId,
    fromCashboxId:   r.fromCashboxId,
    fromCashboxName: nameMap.get(r.fromCashboxId) ?? "?",
    toCashboxId:     r.toCashboxId ?? "",
    toCashboxName:   nameMap.get(r.toCashboxId ?? "") ?? "?",
    transferPairId:  r.transferPairId ?? "",
    balanceAfter:    r.balanceAfter,
  }));
}

// ── All inter-cashbox transfers (for /transferencias overview) ─────────────────

export interface AllTransfersOptions {
  from?:     string;
  to?:       string;
  cashboxId?: string; // filter to/from a specific cashbox
  limit?:    number;
}

export async function getAllInterCashboxTransfers(opts: AllTransfersOptions = {}) {
  const { from, to, cashboxId, limit = 50 } = opts;

  const conditions = [
    eq(transactions.status, "completado"),
    isNotNull(transactions.transferPairId),
    eq(transactions.type, "withdraw"), // only withdraw legs to avoid duplication
  ];

  if (from) conditions.push(gte(transactions.createdAt, new Date(`${from}T04:00:00Z`)));
  if (to)   conditions.push(lte(transactions.createdAt, new Date(`${to}T03:59:59Z`)));
  if (cashboxId) {
    conditions.push(
      sql`(${transactions.cashboxId} = ${cashboxId} OR ${transactions.transferToCashboxId} = ${cashboxId})`,
    );
  }

  const rows = await db
    .select({
      id:             transactions.id,
      concept:        transactions.concept,
      amount:         transactions.amount,
      notes:          transactions.notes,
      createdAt:      transactions.createdAt,
      fromCashboxId:  transactions.cashboxId,
      toCashboxId:    transactions.transferToCashboxId,
      transferPairId: transactions.transferPairId,
      balanceAfter:   transactions.balanceAfter,
    })
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);

  const boxes = await db.select({ id: cashboxes.id, name: cashboxes.name, code: cashboxes.code }).from(cashboxes);
  const nameMap = new Map(boxes.map((b) => [b.id, { name: b.name, code: b.code }]));

  return rows.map((r) => ({
    ...r,
    toCashboxId:     r.toCashboxId ?? "",
    fromCashboxName: nameMap.get(r.fromCashboxId)?.name ?? "?",
    fromCashboxCode: nameMap.get(r.fromCashboxId)?.code ?? "?",
    toCashboxName:   nameMap.get(r.toCashboxId ?? "")?.name ?? "?",
    toCashboxCode:   nameMap.get(r.toCashboxId ?? "")?.code ?? "?",
  }));
}

// ── Period-scoped summary (for salary page) ────────────────────────────────────

/**
 * For a given cashbox: how much has it received from GEN this period.
 * Used on salarios page to show "available advance" vs salary need.
 */
export async function getCashboxAdvanceForPeriod(cashboxId: string, period: string): Promise<string> {
  const genId = await getGenId();
  if (!genId) return "0.00";

  const [y, m] = period.split("-").map(Number);
  const periodStart = new Date(y, m - 1, 1);
  const periodEnd   = new Date(y, m, 0, 23, 59, 59, 999);

  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.cashboxId, genId),
        eq(transactions.transferToCashboxId, cashboxId),
        eq(transactions.type, "withdraw"),
        eq(transactions.status, "completado"),
        isNotNull(transactions.transferPairId),
        gte(transactions.createdAt, periodStart),
        lte(transactions.createdAt, periodEnd),
      ),
    );

  return row?.total ?? "0.00";
}
