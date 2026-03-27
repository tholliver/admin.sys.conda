// src/services/finances/report-queries.ts
import { db } from "@/db";
import { cashboxes, transactions, transactionCategories, invoiceRanges } from "@/db/schema";
import { sql, isNull, and, lte, gte, eq, desc, count } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

interface DailyReportSummary {
    date: string;
    totalIncome: string;
    totalOutcome: string;
    netChange: string;
    incomeCount: number;
    outcomeCount: number;
    totalTransactions: number;
    openingBalance: string;
    closingBalance: string;
}

interface WeeklyReportSummary {
    weekStart: string;
    weekEnd: string;
    weekNumber: number;
    totalIncome: string;
    totalOutcome: string;
    netChange: string;
    incomeCount: number;
    outcomeCount: number;
    totalTransactions: number;
    dailyBreakdown: DailyBreakdown[];
}

interface DailyBreakdown {
    date: string;
    dayOfWeek: string;
    totalIncome: string;
    totalOutcome: string;
    netChange: string;
    transactionCount: number;
}

interface CategoryBreakdown {
    categoryId: string;
    categoryName: string;
    categoryCode: string;
    totalAmount: string;
    transactionCount: number;
    avgAmount: string;
    percentage: number;
}

interface DetailedExpenseReport {
    totalExpenses: string;
    expenseCount: number;
    avgExpenseAmount: string;
    categoryBreakdown: CategoryBreakdown[];
    topExpenses: TopExpense[];
    dailyExpenses: DailyExpense[];
}

interface TopExpense {
    id: string;
    concept: string;
    amount: string;
    categoryName: string;
    createdAt: Date;
    reference: string | null;
    authorizedBy: string | null;
}

interface DailyExpense {
    date: string;
    totalAmount: string;
    count: number;
}

interface IncomeAnalysisReport {
    totalIncome: string;
    incomeCount: number;
    avgIncomeAmount: string;
    categoryBreakdown: CategoryBreakdown[];
    topIncome: TopIncome[];
    incomeGrowth: IncomeGrowth[];
    hourlyDistribution: HourlyDistribution[];
}

interface TopIncome {
    id: string;
    concept: string;
    amount: string;
    categoryName: string;
    createdAt: Date;
    reference: string | null;
}

interface IncomeGrowth {
    period: string;
    totalIncome: string;
    count: number;
    growthRate: number;
}

interface HourlyDistribution {
    hour: number;
    totalAmount: string;
    count: number;
}

// ============================================================================
// UTILITY: GET BOLIVIA TIME RANGE
// ============================================================================

function getBoliviaDateRange(date: Date = new Date()) {
    const boliviaFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/La_Paz",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const [{ value: month }, , { value: day }, , { value: year }] =
        boliviaFormatter.formatToParts(date);

    const startOfDay = new Date(`${year}-${month}-${day}T04:00:00Z`);
    const endOfDay = new Date(`${year}-${month}-${day}T03:59:59.999Z`);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return { startOfDay, endOfDay, dateString: `${year}-${month}-${day}` };
}

// ============================================================================
// 1. DAILY REPORT (Reporte Diario)
// ============================================================================

export async function getDailyReport(
    date: Date = new Date()
): Promise<DailyReportSummary> {
    const { startOfDay, endOfDay, dateString } = getBoliviaDateRange(date);

    // Get previous day's closing balance
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    const { endOfDay: previousEndOfDay } = getBoliviaDateRange(previousDay);

    const [previousBalance] = await db
        .select({
            balance: sql<string>`COALESCE(SUM(CAST(${cashboxes.balance} AS NUMERIC)), 0)`,
        })
        .from(cashboxes)
        .where(isNull(cashboxes.deletedAt));

    // Get daily summary
    const [dailySummary] = await db
        .select({
            totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
            totalOutcome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
            incomeCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'deposit' THEN 1 END)`,
            outcomeCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'withdraw' THEN 1 END)`,
            totalTransactions: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(
            and(
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        );

    const netChange =
        parseFloat(dailySummary.totalIncome) - parseFloat(dailySummary.totalOutcome);

    return {
        date: dateString,
        ...dailySummary,
        netChange: netChange.toFixed(2),
        openingBalance: previousBalance.balance,
        closingBalance: (parseFloat(previousBalance.balance) + netChange).toFixed(2),
    };
}

export async function getDailyTransactionsByCategory(date: Date = new Date()) {
    const { startOfDay, endOfDay } = getBoliviaDateRange(date);

    return await db
        .select({
            categoryId: transactions.categoryId,
            categoryName: transactionCategories.name,
            categoryCode: transactionCategories.code,
            type: transactions.type,
            totalAmount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
            transactionCount: sql<number>`COUNT(*)`,
            avgAmount: sql<string>`AVG(CAST(${transactions.amount} AS NUMERIC))`,
        })
        .from(transactions)
        .innerJoin(
            transactionCategories,
            eq(transactions.categoryId, transactionCategories.id)
        )
        .where(
            and(
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .groupBy(
            transactions.categoryId,
            transactions.type,
            transactionCategories.name,
            transactionCategories.code
        )
        .orderBy(desc(sql`SUM(CAST(${transactions.amount} AS NUMERIC))`));
}

export async function getDailyTransactionsList(date: Date = new Date()) {
    const { startOfDay, endOfDay } = getBoliviaDateRange(date);

    return await db
        .select({
            id: transactions.id,
            type: transactions.type,
            amount: transactions.amount,
            concept: transactions.concept,
            description: transactions.description,
            reference: transactions.reference,
            categoryName: transactionCategories.name,
            createdAt: transactions.createdAt,
            authorizedBy: transactions.authorizedBy,
        })
        .from(transactions)
        .innerJoin(
            transactionCategories,
            eq(transactions.categoryId, transactionCategories.id)
        )
        .where(
            and(
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .orderBy(desc(transactions.createdAt));
}

// ============================================================================
// 2. WEEKLY REPORT (Reporte Semanal)
// ============================================================================

export async function getWeeklyReport(
    date: Date = new Date()
): Promise<WeeklyReportSummary> {
    // Get start of week (Monday)
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    // Get end of week (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const { startOfDay: weekStartUTC } = getBoliviaDateRange(weekStart);
    const { endOfDay: weekEndUTC } = getBoliviaDateRange(weekEnd);

    // Get weekly summary
    const [weeklySummary] = await db
        .select({
            totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
            totalOutcome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
            incomeCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'deposit' THEN 1 END)`,
            outcomeCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'withdraw' THEN 1 END)`,
            totalTransactions: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(
            and(
                gte(transactions.createdAt, weekStartUTC),
                lte(transactions.createdAt, weekEndUTC),
                eq(transactions.status, "completed")
            )
        );

    // Get daily breakdown
    const dailyBreakdown = await db
        .select({
            date: sql<string>`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')`,
            dayOfWeek: sql<string>`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'Day')`,
            totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
            totalOutcome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
            transactionCount: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(
            and(
                gte(transactions.createdAt, weekStartUTC),
                lte(transactions.createdAt, weekEndUTC),
                eq(transactions.status, "completed")
            )
        )
        .groupBy(
            sql`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')`,
            sql`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'Day')`
        )
        .orderBy(sql`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')`);

    const netChange =
        parseFloat(weeklySummary.totalIncome) - parseFloat(weeklySummary.totalOutcome);

    const weekNumber = Math.ceil(
        ((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) /
            86400000 +
            1) /
        7
    );

    return {
        weekStart: weekStart.toISOString().split("T")[0],
        weekEnd: weekEnd.toISOString().split("T")[0],
        weekNumber,
        ...weeklySummary,
        netChange: netChange.toFixed(2),
        dailyBreakdown: dailyBreakdown.map((day) => ({
            ...day,
            netChange: (parseFloat(day.totalIncome) - parseFloat(day.totalOutcome)).toFixed(2),
        })),
    };
}

// ============================================================================
// 3. DETAILED EXPENSES (Gastos Detallados)
// ============================================================================

export async function getDetailedExpenseReport(
    startDate: Date,
    endDate: Date
): Promise<DetailedExpenseReport> {
    const { startOfDay } = getBoliviaDateRange(startDate);
    const { endOfDay } = getBoliviaDateRange(endDate);

    // Summary
    const [expenseSummary] = await db
        .select({
            totalExpenses: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
            expenseCount: sql<number>`COUNT(*)`,
            avgExpenseAmount: sql<string>`COALESCE(AVG(CAST(${transactions.amount} AS NUMERIC)), 0)`,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.type, "withdraw"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        );

    // Category breakdown
    const categoryBreakdown = await db
        .select({
            categoryId: transactions.categoryId,
            categoryName: transactionCategories.name,
            categoryCode: transactionCategories.code,
            totalAmount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
            transactionCount: sql<number>`COUNT(*)`,
            avgAmount: sql<string>`AVG(CAST(${transactions.amount} AS NUMERIC))`,
        })
        .from(transactions)
        .innerJoin(
            transactionCategories,
            eq(transactions.categoryId, transactionCategories.id)
        )
        .where(
            and(
                eq(transactions.type, "withdraw"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .groupBy(
            transactions.categoryId,
            transactionCategories.name,
            transactionCategories.code
        )
        .orderBy(desc(sql`SUM(CAST(${transactions.amount} AS NUMERIC))`));

    // Top expenses
    const topExpenses = await db
        .select({
            id: transactions.id,
            concept: transactions.concept,
            amount: transactions.amount,
            categoryName: transactionCategories.name,
            createdAt: transactions.createdAt,
            reference: transactions.reference,
            authorizedBy: transactions.authorizedBy,
        })
        .from(transactions)
        .innerJoin(
            transactionCategories,
            eq(transactions.categoryId, transactionCategories.id)
        )
        .where(
            and(
                eq(transactions.type, "withdraw"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .orderBy(desc(transactions.amount))
        .limit(20);

    // Daily expenses
    const dailyExpenses = await db
        .select({
            date: sql<string>`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')`,
            totalAmount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
            count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.type, "withdraw"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .groupBy(sql`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')`);

    const totalExpenses = parseFloat(expenseSummary.totalExpenses);

    return {
        ...expenseSummary,
        categoryBreakdown: categoryBreakdown.map((cat) => ({
            ...cat,
            percentage: totalExpenses > 0
                ? (parseFloat(cat.totalAmount) / totalExpenses) * 100
                : 0,
        })),
        topExpenses,
        dailyExpenses,
    };
}

// ============================================================================
// 4. INCOME ANALYSIS (Análisis de Ingresos)
// ============================================================================

export async function getIncomeAnalysisReport(
    startDate: Date,
    endDate: Date
): Promise<IncomeAnalysisReport> {
    const { startOfDay } = getBoliviaDateRange(startDate);
    const { endOfDay } = getBoliviaDateRange(endDate);

    // Summary
    const [incomeSummary] = await db
        .select({
            totalIncome: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
            incomeCount: sql<number>`COUNT(*)`,
            avgIncomeAmount: sql<string>`COALESCE(AVG(CAST(${transactions.amount} AS NUMERIC)), 0)`,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.type, "deposit"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        );

    // Category breakdown
    const categoryBreakdown = await db
        .select({
            categoryId: transactions.categoryId,
            categoryName: transactionCategories.name,
            categoryCode: transactionCategories.code,
            totalAmount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
            transactionCount: sql<number>`COUNT(*)`,
            avgAmount: sql<string>`AVG(CAST(${transactions.amount} AS NUMERIC))`,
        })
        .from(transactions)
        .innerJoin(
            transactionCategories,
            eq(transactions.categoryId, transactionCategories.id)
        )
        .where(
            and(
                eq(transactions.type, "deposit"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .groupBy(
            transactions.categoryId,
            transactionCategories.name,
            transactionCategories.code
        )
        .orderBy(desc(sql`SUM(CAST(${transactions.amount} AS NUMERIC))`));

    // Top income transactions
    const topIncome = await db
        .select({
            id: transactions.id,
            concept: transactions.concept,
            amount: transactions.amount,
            categoryName: transactionCategories.name,
            createdAt: transactions.createdAt,
            reference: transactions.reference,
        })
        .from(transactions)
        .innerJoin(
            transactionCategories,
            eq(transactions.categoryId, transactionCategories.id)
        )
        .where(
            and(
                eq(transactions.type, "deposit"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .orderBy(desc(transactions.amount))
        .limit(20);

    // Weekly income growth
    const incomeGrowth = await db
        .select({
            period: sql<string>`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-WW')`,
            totalIncome: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
            count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.type, "deposit"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .groupBy(sql`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-WW')`)
        .orderBy(sql`TO_CHAR(${transactions.createdAt} AT TIME ZONE 'America/La_Paz', 'YYYY-WW')`);

    // Hourly distribution
    const hourlyDistribution = await db
        .select({
            hour: sql<number>`EXTRACT(HOUR FROM ${transactions.createdAt} AT TIME ZONE 'America/La_Paz')::integer`,
            totalAmount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
            count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.type, "deposit"),
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay),
                eq(transactions.status, "completed")
            )
        )
        .groupBy(sql`EXTRACT(HOUR FROM ${transactions.createdAt} AT TIME ZONE 'America/La_Paz')`)
        .orderBy(sql`EXTRACT(HOUR FROM ${transactions.createdAt} AT TIME ZONE 'America/La_Paz')`);

    const totalIncome = parseFloat(incomeSummary.totalIncome);

    return {
        ...incomeSummary,
        categoryBreakdown: categoryBreakdown.map((cat) => ({
            ...cat,
            percentage: totalIncome > 0
                ? (parseFloat(cat.totalAmount) / totalIncome) * 100
                : 0,
        })),
        topIncome,
        incomeGrowth: incomeGrowth.map((week, idx, arr) => {
            const prevWeek = idx > 0 ? parseFloat(arr[idx - 1].totalIncome) : 0;
            const currentWeek = parseFloat(week.totalIncome);
            const growthRate = prevWeek > 0
                ? ((currentWeek - prevWeek) / prevWeek) * 100
                : 0;
            return { ...week, growthRate };
        }),
        hourlyDistribution,
    };
}

// ============================================================================
// 5. DAILY PAYMENTS (Pagos del Día — public schema)
// ============================================================================

// ============================================================================
// 6. ACTIVE INVOICE RANGES (Estado de Talonarios)
// ============================================================================

export async function getActiveInvoiceRanges() {
    return await db
        .select({
            id: invoiceRanges.id,
            code: invoiceRanges.code,
            category: invoiceRanges.category,
            prefix: invoiceRanges.prefix,
            rangeStart: invoiceRanges.rangeStart,
            rangeEnd: invoiceRanges.rangeEnd,
            current: invoiceRanges.current,
            authorizationNumber: invoiceRanges.authorizationNumber,
            expirationDate: invoiceRanges.expirationDate,
            isActive: invoiceRanges.isActive,
        })
        .from(invoiceRanges)
        .orderBy(invoiceRanges.category);
}
