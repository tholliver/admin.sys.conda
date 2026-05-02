// api/finance/analytics.json.ts
import type { APIRoute } from "astro";
import ExcelJS from "exceljs";
import { db } from "@/db";
import {
  transactions,
  cashboxes,
  transactionCategories,
} from "@/db/schema";
import { eq, and, gte, lte, isNull, sql, desc } from "drizzle-orm";
import { realTransactionFilter } from "@/services/finances/transaction-patterns";

// Helper: date formatting (es-BO)
const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

export const GET: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user;
  if (!user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  const url = new URL(request.url);
  const reportType = url.searchParams.get("reportType");
  const startParam = url.searchParams.get("startDate");
  const endParam = url.searchParams.get("endDate");
  const extra = url.searchParams.get("id"); // optional, for future refinements

  if (!reportType) {
    return new Response(JSON.stringify({ error: "Parámetro 'reportType' requerido" }), {
      status: 400,
    });
  }

  // Default month window for certain reports
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema CONDA";
  wb.created = new Date();

  try {
    if (reportType === "monthly_summary") {
      // Period: current month by default or user-provided
      const from = startParam ? new Date(startParam) : currentMonthStart;
      const to = endParam ? new Date(endParam) : currentMonthEnd;

      const totals = await db
        .select({
          income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
          expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
        })
        .from(transactions)
        .where(and(
          gte(transactions.createdAt, from),
          lte(transactions.createdAt, to),
          eq(transactions.status, "completado"),
          realTransactionFilter,
        ));

      const income = Number(totals?.income ?? 0);
      const expense = Number(totals?.expense ?? 0);

      const ws = wb.addWorksheet("Resumen Mensual");
      ws.columns = [
        { header: "Concepto", key: "c", width: 40 },
        { header: "Valor (Bs.)", key: "v", width: 20 },
      ];
      ws.addRow([`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`, ""]);
      ws.addRow(["Ingresos (Depositos)", income]);
      ws.addRow(["Gastos (Retiros)", expense]);
      ws.addRow(["Balance", income - expense]);
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((c) => (c.alignment = { vertical: "middle", horizontal: "left" }));

    } else if (reportType === "top_income" || reportType === "top_outcome") {
      const from = startParam ? new Date(startParam) : currentMonthStart;
      const to = endParam ? new Date(endParam) : currentMonthEnd;
      const isIncome = reportType === "top_income";
      const kind = isIncome ? "deposit" : "withdraw";

      const rows = await db
        .select({
          categoryName: transactionCategories.name,
          total: sql<string>`COALESCE(SUM(${transactions.amount}),0)`,
          count: sql<number>`COUNT(${transactions.id})`,
        })
        .from(transactions)
        .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
        .where(and(
          gte(transactions.createdAt, from),
          lte(transactions.createdAt, to),
          eq(transactions.status, "completado"),
          eq(transactions.type, kind),
          realTransactionFilter,
        ))
        .groupBy(transactionCategories.name)
        .orderBy(desc(sql<string>`SUM(${transactions.amount})`));

      const ws = wb.addWorksheet(isIncome ? "Top Ingresos" : "Top Egresos");
      ws.columns = [
        { header: "Categoría", key: "cat", width: 40 },
        { header: "Total (Bs.)", key: "total", width: 20 },
        { header: "Movimientos", key: "cnt", width: 14 },
      ];
      ws.addRow(["Categoría", "Total", "Nro de Movimientos"]);
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => {
        ws.addRow([r.categoryName ?? "—", Number(r.total ?? 0), r.count ?? 0]);
      });

    } else if (reportType === "monthly_trend") {
      const today = new Date();
      const months: { label: string; net: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const dtFrom = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const dtTo = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
        const netRow = await db
          .select({
            income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type}='deposit' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
            expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type}='withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
          })
          .from(transactions)
          .where(and(
            gte(transactions.createdAt, dtFrom),
            lte(transactions.createdAt, dtTo),
            eq(transactions.status, "completado"),
            realTransactionFilter,
          ));
        const income = Number(netRow?.income ?? 0);
        const expense = Number(netRow?.expense ?? 0);
        const label = dtFrom.toLocaleString("default", { month: "short" }) + " " + dtFrom.getFullYear();
        months.push({ label, net: income - expense });
      }

      const ws = wb.addWorksheet("Tendencia 6 Meses");
      ws.columns = [
        { header: "Mes", key: "m", width: 20 },
        { header: "Neto (Bs.)", key: "n", width: 18 },
      ];
      ws.getRow(1).font = { bold: true };
      months.forEach((m) => ws.addRow([m.label, m.net]));

    } else if (reportType === "all_transactions") {
      if (!startParam || !endParam) {
        return new Response(JSON.stringify({ error: "Parámetros startDate y endDate son requeridos" }), {
          status: 400,
        });
      }
      const from = new Date(startParam);
      const to = new Date(endParam);
      const rows = await db
        .select({
          date: transactions.createdAt,
          concept: transactions.concept,
          reference: transactions.reference,
          categoryName: transactionCategories.name,
          cashboxName: cashboxes.name,
          type: transactions.type,
          amount: transactions.amount,
        })
        .from(transactions)
        .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
        .leftJoin(cashboxes, eq(transactions.cashboxId, cashboxes.id))
        .where(and(
          gte(transactions.createdAt, from),
          lte(transactions.createdAt, to),
          eq(transactions.status, "completado"),
          realTransactionFilter,
        ))
        .orderBy(transactions.createdAt);

      const ws = wb.addWorksheet("Todas las Transacciones");
      ws.columns = [
        { header: "Fecha", key: "date", width: 20 },
        { header: "Concepto", key: "concept", width: 32 },
        { header: "Referencia", key: "reference", width: 16 },
        { header: "Categoría", key: "category", width: 20 },
        { header: "Caja", key: "cashbox", width: 20 },
        { header: "Tipo", key: "type", width: 12 },
        { header: "Monto (Bs.)", key: "amount", width: 16 },
      ];
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => {
        ws.addRow([
          r.date ? new Date(r.date).toISOString() : "",
          r.concept,
          r.reference ?? "",
          r.category ?? "",
          r.cashbox ?? "",
          r.type ?? "",
          Number(r.amount ?? 0),
        ]);
      });
    } else {
      return new Response(JSON.stringify({ error: "Tipo de reporte inválido" }), { status: 400 });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="analytics_report.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[Analytics Error]", err);
    return new Response(JSON.stringify({ error: "Error al generar el reporte" }), { status: 500 });
  }
};
