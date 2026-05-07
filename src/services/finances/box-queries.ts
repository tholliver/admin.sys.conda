import { db } from "@/db";
import { cashboxes, transactions } from "@/db/schema";
import { sql, isNull, and, lte, gte, eq } from "drizzle-orm";

interface BalanceSummary {
  totalBalance: string;
  activeBoxes: number;
  totalBoxes: number;
}

interface DailySummary {
  totalIncome: number;
  totalOutcome: number;
  incomeCount: number;
  outcomeCount: number;
  totalTransactions: number;
}

interface MonthlySummary {
  totalIncome: string;
  totalOutcome: string;
  netChange: string;
  incomeCount: number;
  outcomeCount: number;
  monthLabel: string;
}

export async function getBalanceSummary(): Promise<BalanceSummary> {
  const [balanceSummary] = await db
    .select({
      totalBalance: sql<string>`COALESCE(SUM(CASE WHEN ${cashboxes.code} = 'GEN' THEN CAST(${cashboxes.balance} AS NUMERIC) ELSE 0 END), 0)`,
      activeBoxes: sql<number>`COUNT(CASE WHEN ${cashboxes.status} = 'activo' THEN 1 END)`,
      totalBoxes: sql<number>`COUNT(*)`,
    })
    .from(cashboxes)
    .where(isNull(cashboxes.deletedAt));

  return balanceSummary;
}

export async function getDailySummary(): Promise<DailySummary> {
  const boliviaFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [{ value: month }, , { value: day }, , { value: year }] =
    boliviaFormatter.formatToParts(new Date());

  const startOfDay = new Date(`${year}-${month}-${day}T04:00:00Z`);
  const endOfDay = new Date(`${year}-${month}-${day}T03:59:59.999Z`);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [dailySummary] = await db
    .select({
      totalIncome: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
      totalOutcome: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
      incomeCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'deposit' THEN 1 END)`,
      outcomeCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'withdraw' THEN 1 END)`,
      totalTransactions: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.createdAt, startOfDay),
        lte(transactions.createdAt, endOfDay),
        eq(transactions.status, "completado"),
      ),
    );

  return dailySummary;
}

export async function getMonthlySummary(): Promise<MonthlySummary> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [summary] = await db
    .select({
      totalIncome: sql<string>`COALESCE(ROUND(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 2)::text, '0.00')`,
      totalOutcome: sql<string>`COALESCE(ROUND(SUM(CASE WHEN ${transactions.type} = 'withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 2)::text, '0.00')`,
      incomeCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'deposit' THEN 1 END)`,
      outcomeCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'withdraw' THEN 1 END)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.createdAt, startOfMonth),
        lte(transactions.createdAt, endOfMonth),
        eq(transactions.status, "completado"),
      ),
    );

  const income = parseFloat(summary.totalIncome ?? "0");
  const outcome = parseFloat(summary.totalOutcome ?? "0");
  const net = (income - outcome).toFixed(2);

  const monthLabel = now.toLocaleDateString("es-BO", { month: "long", year: "numeric" });

  return {
    totalIncome: summary.totalIncome ?? "0.00",
    totalOutcome: summary.totalOutcome ?? "0.00",
    netChange: net,
    incomeCount: summary.incomeCount,
    outcomeCount: summary.outcomeCount,
    monthLabel,
  };
}
