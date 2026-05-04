// src/services/finances/excel-reports.service.ts
import ExcelJS from "exceljs";
import { db } from "@/db";
import {
  transactions,
  cashboxes,
  sectors,
  transactionCategories,
} from "@/db/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { realTransactionFilter } from "@/services/finances/transaction-patterns";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOB = (v: string | number) =>
  `Bs. ${Number(v).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/La_Paz",
  });

const fmtDateTime = (d: Date) =>
  d.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/La_Paz",
  });

// ─── Shared styles ────────────────────────────────────────────────────────────

const COLORS = {
  headerBg:    "1E3A5F",   // dark navy — Bolivia professional
  headerFg:    "FFFFFF",
  subHeaderBg: "2E6DA4",
  subHeaderFg: "FFFFFF",
  incomeRow:   "EBF5EB",   // soft green
  expenseRow:  "FDF2F2",   // soft red
  totalBg:     "F0F4FA",
  borderColor: "BFBFBF",
  altRow:      "F7F9FC",
};

function applyHeaderStyle(
  cell: ExcelJS.Cell,
  bg = COLORS.headerBg,
  fg = COLORS.headerFg,
  fontSize = 11,
) {
  cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.font   = { bold: true, color: { argb: fg }, size: fontSize, name: "Arial" };
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.borderColor } },
    bottom: { style: "thin", color: { argb: COLORS.borderColor } },
    left: { style: "thin", color: { argb: COLORS.borderColor } },
    right: { style: "thin", color: { argb: COLORS.borderColor } },
  };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

function applyDataBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top:    { style: "hair", color: { argb: COLORS.borderColor } },
    bottom: { style: "hair", color: { argb: COLORS.borderColor } },
    left:   { style: "thin", color: { argb: COLORS.borderColor } },
    right:  { style: "thin", color: { argb: COLORS.borderColor } },
  };
  cell.font = { name: "Arial", size: 10 };
}

function addReportHeader(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  from: Date,
  to: Date,
  colSpan: number,
) {
  // Row 1 – entity name
  ws.mergeCells(1, 1, 1, colSpan);
  const r1 = ws.getCell(1, 1);
  r1.value = "SISTEMA ADMINISTRATIVO CONDA";
  applyHeaderStyle(r1, COLORS.headerBg, COLORS.headerFg, 13);

  // Row 2 – report title
  ws.mergeCells(2, 1, 2, colSpan);
  const r2 = ws.getCell(2, 1);
  r2.value = title.toUpperCase();
  applyHeaderStyle(r2, COLORS.subHeaderBg, COLORS.subHeaderFg, 12);

  // Row 3 – subtitle / period
  ws.mergeCells(3, 1, 3, colSpan);
  const r3 = ws.getCell(3, 1);
  r3.value = `${subtitle}  |  Período: ${fmtDate(from)} al ${fmtDate(to)}`;
  r3.font  = { italic: true, size: 10, name: "Arial" };
  r3.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "DDEEFF" } };
  r3.alignment = { horizontal: "center", vertical: "middle" };

  ws.getRow(1).height = 24;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 18;

  // Blank separator
  ws.addRow([]);
}

// ─── Report 1: Libro Mayor (Running Ledger) ───────────────────────────────────

export async function generateLibroMayor(
  from: Date,
  to: Date,
  cashboxId?: string,
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Sistema CONDA";
  wb.created  = new Date();

  const ws = wb.addWorksheet("Libro Mayor");

  // ── Query ──
  const where = and(
    gte(transactions.createdAt, from),
    lte(transactions.createdAt, to),
    eq(transactions.status, "completado"),
    realTransactionFilter,
    cashboxId ? eq(transactions.cashboxId, cashboxId) : undefined,
  );

  const rows = await db
    .select({
      id:           transactions.id,
      createdAt:    transactions.createdAt,
      concept:      transactions.concept,
      externalReference: transactions.externalReference,
      invoiceNumber:     transactions.invoiceNumber,
      type:         transactions.type,
      amount:       transactions.amount,
      balanceAfter: transactions.balanceAfter,
      categoryName: transactionCategories.name,
      cashboxName:  cashboxes.name,
      authorizedBy: transactions.authorizedBy,
    })
    .from(transactions)
    .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
    .leftJoin(cashboxes, eq(transactions.cashboxId, cashboxes.id))
    .where(where)
    .orderBy(transactions.createdAt);

  // ── Sheet setup ──
  const COL_COUNT = 9;
  ws.columns = [
    { key: "date",      width: 18 },
    { key: "concept",   width: 32 },
    { key: "ref",       width: 18 },
    { key: "category",  width: 22 },
    { key: "cashbox",   width: 18 },
    { key: "must",      width: 16 }, // Debe
    { key: "haber",     width: 16 }, // Haber
    { key: "balance",   width: 18 },
    { key: "auth",      width: 20 },
  ];

  addReportHeader(ws, "Libro Mayor", cashboxId ? "Por Caja" : "General", from, to, COL_COUNT);

  // ── Column headers ──
  const headerRow = ws.addRow([
    "Fecha y Hora",
    "Concepto",
    "Referencia",
    "Cuenta",
    "Caja",
    "Debe (Bs.)",
    "Haber (Bs.)",
    "Saldo (Bs.)",
    "Autorizado por",
  ]);
  headerRow.height = 20;
  headerRow.eachCell((cell) => applyHeaderStyle(cell, COLORS.subHeaderBg));

  // ── Data rows ──
  let totalDebe  = 0;
  let totalHaber = 0;

  rows.forEach((r, i) => {
    const isDebe  = r.type === "withdraw";
    const amount  = Number(r.amount);
    const balance = Number(r.balanceAfter ?? 0);

    if (isDebe) totalDebe  += amount;
    else        totalHaber += amount;

    const row = ws.addRow([
      r.createdAt ? fmtDateTime(new Date(r.createdAt)) : "",
      r.concept,
      r.invoiceNumber ? `#${r.invoiceNumber}` : r.externalReference ?? "",
      r.categoryName ?? "",
      r.cashboxName ?? "",
      isDebe  ? amount : "",
      !isDebe ? amount : "",
      balance,
      r.authorizedBy ?? "",
    ]);

    const bg = isDebe ? COLORS.expenseRow : COLORS.incomeRow;
    row.eachCell((cell, col) => {
      applyDataBorder(cell);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      // Number format for amount/balance cols
      if (col >= 6 && col <= 8) {
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  // ── Totals row ──
  const dataStart = 6; // row where data begins (after 4 header rows + 1 col header)
  const dataEnd   = ws.rowCount;
  const totalRow  = ws.addRow([
    "", "TOTALES", "", "", "",
    `=SUM(F${dataStart}:F${dataEnd})`,
    `=SUM(G${dataStart}:G${dataEnd})`,
    "", "",
  ]);
  totalRow.height = 18;
  totalRow.eachCell((cell, col) => {
    cell.font = { bold: true, name: "Arial", size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalBg } };
    applyDataBorder(cell);
    if (col >= 6 && col <= 8) {
      cell.numFmt = '#,##0.00;(#,##0.00);"-"';
      cell.alignment = { horizontal: "right" };
    }
  });

  // ── Footer ──
  ws.addRow([]);
  const footerRow = ws.addRow([`Generado el ${fmtDateTime(new Date())}  |  Total movimientos: ${rows.length}`]);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, COL_COUNT);
  footerRow.getCell(1).font = { italic: true, size: 9, name: "Arial", color: { argb: "888888" } };

  ws.views = [{ state: "frozen", ySplit: 5 }];

  return wb.xlsx.writeBuffer();
}

// ─── Report 2: Gastos por Caja ────────────────────────────────────────────────

export async function generateGastosPorCaja(
  from: Date,
  to: Date,
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema CONDA";

  // ── Summary sheet ──
  const wsSummary = wb.addWorksheet("Resumen por Caja");

  const summary = await db
    .select({
      cashboxId:   cashboxes.id,
      cashboxName: cashboxes.name,
      cashboxCode: cashboxes.code,
      totalGastos: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type}='withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
      totalIngresos: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type}='deposit' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
      countGastos: sql<number>`COUNT(CASE WHEN ${transactions.type}='withdraw' THEN 1 END)`,
      countIngresos: sql<number>`COUNT(CASE WHEN ${transactions.type}='deposit' THEN 1 END)`,
      balanceActual: cashboxes.balance,
    })
    .from(cashboxes)
    .leftJoin(
      transactions,
      and(
        eq(transactions.cashboxId, cashboxes.id),
        gte(transactions.createdAt, from),
        lte(transactions.createdAt, to),
        eq(transactions.status, "completado"),
        realTransactionFilter,
      ),
    )
    .where(isNull(cashboxes.deletedAt))
    .groupBy(cashboxes.id, cashboxes.name, cashboxes.code, cashboxes.balance)
    .orderBy(cashboxes.name);

  const COL_COUNT = 7;
  wsSummary.columns = [
    { key: "code",       width: 12 },
    { key: "name",       width: 28 },
    { key: "ingresos",   width: 18 },
    { key: "gastos",     width: 18 },
    { key: "neto",       width: 18 },
    { key: "txCount",    width: 14 },
    { key: "balance",    width: 20 },
  ];

  addReportHeader(wsSummary, "Gastos por Caja", "Resumen General", from, to, COL_COUNT);

  const hRow = wsSummary.addRow(["Código", "Caja", "Ingresos (Bs.)", "Gastos (Bs.)", "Neto (Bs.)", "Nro. Mov.", "Saldo Actual (Bs.)"]);
  hRow.height = 20;
  hRow.eachCell((c) => applyHeaderStyle(c, COLORS.subHeaderBg));

  const dataStart = wsSummary.rowCount + 1;

  summary.forEach((s, i) => {
    const row = wsSummary.addRow([
      s.cashboxCode,
      s.cashboxName,
      Number(s.totalIngresos),
      Number(s.totalGastos),
      `=C${wsSummary.rowCount + 1}-D${wsSummary.rowCount + 1}`,
      (Number(s.countIngresos) + Number(s.countGastos)),
      Number(s.balanceActual ?? 0),
    ]);
    const bg = i % 2 === 0 ? "FFFFFF" : COLORS.altRow;
    row.eachCell((cell, col) => {
      applyDataBorder(cell);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      if (col >= 3) {
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  const dataEnd = wsSummary.rowCount;
  const totRow = wsSummary.addRow([
    "", "TOTAL",
    `=SUM(C${dataStart}:C${dataEnd})`,
    `=SUM(D${dataStart}:D${dataEnd})`,
    `=SUM(E${dataStart}:E${dataEnd})`,
    `=SUM(F${dataStart}:F${dataEnd})`,
    `=SUM(G${dataStart}:G${dataEnd})`,
  ]);
  totRow.height = 18;
  totRow.eachCell((cell, col) => {
    cell.font = { bold: true, name: "Arial", size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalBg } };
    applyDataBorder(cell);
    if (col >= 3) {
      cell.numFmt = '#,##0.00;(#,##0.00);"-"';
      cell.alignment = { horizontal: "right" };
    }
  });

  // ── Detail sheet: one row per transaction, grouped by cashbox ──
  const wsDetail = wb.addWorksheet("Detalle Movimientos");
  const COL_DET = 8;
  wsDetail.columns = [
    { key: "cashbox",  width: 22 },
    { key: "date",     width: 18 },
    { key: "concept",  width: 32 },
    { key: "ref",      width: 16 },
    { key: "category", width: 22 },
    { key: "type",     width: 12 },
    { key: "debe",     width: 16 },
    { key: "haber",    width: 16 },
  ];

  addReportHeader(wsDetail, "Gastos por Caja", "Detalle de Movimientos", from, to, COL_DET);
  const dhRow = wsDetail.addRow(["Caja", "Fecha", "Concepto", "Referencia", "Cuenta", "Tipo", "Debe (Bs.)", "Haber (Bs.)"]);
  dhRow.height = 20;
  dhRow.eachCell((c) => applyHeaderStyle(c, COLORS.subHeaderBg));

  const details = await db
    .select({
      cashboxName:  cashboxes.name,
      createdAt:    transactions.createdAt,
      concept:      transactions.concept,
      externalReference: transactions.externalReference,
      invoiceNumber:     transactions.invoiceNumber,
      categoryName: transactionCategories.name,
      type:         transactions.type,
      amount:       transactions.amount,
    })
    .from(transactions)
    .leftJoin(cashboxes,             eq(transactions.cashboxId, cashboxes.id))
    .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
    .where(and(
      gte(transactions.createdAt, from),
      lte(transactions.createdAt, to),
      eq(transactions.status, "completado"),
      realTransactionFilter,
    ))
    .orderBy(cashboxes.name, transactions.createdAt);

  details.forEach((d, i) => {
    const isDebe = d.type === "withdraw";
    const amount = Number(d.amount);
    const row = wsDetail.addRow([
      d.cashboxName ?? "",
      d.createdAt ? fmtDateTime(new Date(d.createdAt)) : "",
      d.concept,
      d.invoiceNumber ? `#${d.invoiceNumber}` : d.externalReference ?? "",
      d.categoryName ?? "",
      isDebe ? "Egreso" : "Ingreso",
      isDebe ? amount : "",
      !isDebe ? amount : "",
    ]);
    const bg = isDebe ? COLORS.expenseRow : COLORS.incomeRow;
    row.eachCell((cell, col) => {
      applyDataBorder(cell);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      if (col === 7 || col === 8) {
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  wsDetail.views = [{ state: "frozen", ySplit: 5 }];
  wsSummary.views = [{ state: "frozen", ySplit: 5 }];

  return wb.xlsx.writeBuffer();
}

// ─── Report 3: Gastos por Sector ──────────────────────────────────────────────

export async function generateGastosPorSector(
  from: Date,
  to: Date,
  sectorId?: number,
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema CONDA";

  // ── Summary sheet ──
  const wsSummary = wb.addWorksheet("Resumen por Sector");
  const COL_COUNT = 6;
  wsSummary.columns = [
    { key: "sector",    width: 28 },
    { key: "cashbox",   width: 22 },
    { key: "ingresos",  width: 18 },
    { key: "gastos",    width: 18 },
    { key: "neto",      width: 18 },
    { key: "count",     width: 14 },
  ];

  addReportHeader(wsSummary, "Gastos por Sector", sectorId ? "Sector Específico" : "Todos los Sectores", from, to, COL_COUNT);

  const hRow = wsSummary.addRow(["Sector", "Caja Asignada", "Ingresos (Bs.)", "Gastos (Bs.)", "Neto (Bs.)", "Nro. Mov."]);
  hRow.height = 20;
  hRow.eachCell((c) => applyHeaderStyle(c, COLORS.subHeaderBg));

  const summary = await db
    .select({
      sectorId:      sectors.id,
      sectorName:    sectors.name,
      cashboxName:   cashboxes.name,
      totalGastos:   sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type}='withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
      totalIngresos: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type}='deposit'  THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
      countTotal:    sql<number>`COUNT(${transactions.id})`,
    })
    .from(sectors)
    .leftJoin(cashboxes,    eq(sectors.cashboxId, cashboxes.id))
    .leftJoin(transactions, and(
      eq(transactions.sectorId, sectors.id),
      gte(transactions.createdAt, from),
      lte(transactions.createdAt, to),
      eq(transactions.status, "completado"),
      realTransactionFilter,
    ))
    .where(and(
      eq(sectors.isActive, true),
      sectorId ? eq(sectors.id, sectorId) : undefined,
    ))
    .groupBy(sectors.id, sectors.name, cashboxes.name)
    .orderBy(sectors.name);

  // Also get "Sin Sector" row
  const [noSector] = await db
    .select({
      totalGastos:   sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type}='withdraw' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
      totalIngresos: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type}='deposit'  THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END),0)`,
      countTotal:    sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(
      isNull(transactions.sectorId),
      gte(transactions.createdAt, from),
      lte(transactions.createdAt, to),
      eq(transactions.status, "completado"),
      realTransactionFilter,
    ));

  const dataStart = wsSummary.rowCount + 1;

  [...summary].forEach((s, i) => {
    const rowNum = wsSummary.rowCount + 1;
    const row = wsSummary.addRow([
      s.sectorName,
      s.cashboxName ?? "—",
      Number(s.totalIngresos),
      Number(s.totalGastos),
      `=C${rowNum}-D${rowNum}`,
      Number(s.countTotal),
    ]);
    const bg = i % 2 === 0 ? "FFFFFF" : COLORS.altRow;
    row.eachCell((cell, col) => {
      applyDataBorder(cell);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      if (col >= 3 && col <= 5) {
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        cell.alignment = { horizontal: "right" };
      }
      if (col === 6) cell.alignment = { horizontal: "center" };
    });
  });

  // Sin sector row
  if (!sectorId && noSector) {
    const rowNum = wsSummary.rowCount + 1;
    const row = wsSummary.addRow([
      "(Sin Sector asignado)",
      "—",
      Number(noSector.totalIngresos),
      Number(noSector.totalGastos),
      `=C${rowNum}-D${rowNum}`,
      Number(noSector.countTotal),
    ]);
    row.eachCell((cell, col) => {
      applyDataBorder(cell);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8E7" } };
      cell.font = { italic: true, name: "Arial", size: 10 };
      if (col >= 3 && col <= 5) {
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        cell.alignment = { horizontal: "right" };
      }
    });
  }

  const dataEnd = wsSummary.rowCount;
  const totRow = wsSummary.addRow([
    "TOTAL", "",
    `=SUM(C${dataStart}:C${dataEnd})`,
    `=SUM(D${dataStart}:D${dataEnd})`,
    `=SUM(E${dataStart}:E${dataEnd})`,
    `=SUM(F${dataStart}:F${dataEnd})`,
  ]);
  totRow.height = 18;
  totRow.eachCell((cell, col) => {
    cell.font = { bold: true, name: "Arial", size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalBg } };
    applyDataBorder(cell);
    if (col >= 3 && col <= 5) {
      cell.numFmt = '#,##0.00;(#,##0.00);"-"';
      cell.alignment = { horizontal: "right" };
    }
  });

  // ── Detail sheet ──
  const wsDetail = wb.addWorksheet("Detalle por Sector");
  const COL_DET = 8;
  wsDetail.columns = [
    { key: "sector",    width: 22 },
    { key: "date",      width: 18 },
    { key: "concept",   width: 32 },
    { key: "ref",       width: 16 },
    { key: "category",  width: 22 },
    { key: "cashbox",   width: 18 },
    { key: "debe",      width: 16 },
    { key: "haber",     width: 16 },
  ];

  addReportHeader(wsDetail, "Gastos por Sector", "Detalle de Movimientos", from, to, COL_DET);
  const dhRow = wsDetail.addRow(["Sector", "Fecha", "Concepto", "Referencia", "Cuenta", "Caja", "Debe (Bs.)", "Haber (Bs.)"]);
  dhRow.height = 20;
  dhRow.eachCell((c) => applyHeaderStyle(c, COLORS.subHeaderBg));

  const details = await db
    .select({
      sectorName:   sectors.name,
      cashboxName:  cashboxes.name,
      createdAt:    transactions.createdAt,
      concept:      transactions.concept,
      externalReference: transactions.externalReference,
      invoiceNumber:     transactions.invoiceNumber,
      categoryName: transactionCategories.name,
      type:         transactions.type,
      amount:       transactions.amount,
    })
    .from(transactions)
    .leftJoin(sectors,               eq(transactions.sectorId,  sectors.id))
    .leftJoin(cashboxes,             eq(transactions.cashboxId, cashboxes.id))
    .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
    .where(and(
      gte(transactions.createdAt, from),
      lte(transactions.createdAt, to),
      eq(transactions.status, "completado"),
      realTransactionFilter,
      sectorId ? eq(transactions.sectorId, sectorId) : undefined,
    ))
    .orderBy(sectors.name, transactions.createdAt);

  details.forEach((d) => {
    const isDebe = d.type === "withdraw";
    const amount = Number(d.amount);
    const row = wsDetail.addRow([
      d.sectorName ?? "(Sin Sector)",
      d.createdAt ? fmtDateTime(new Date(d.createdAt)) : "",
      d.concept,
      d.invoiceNumber ? `#${d.invoiceNumber}` : d.externalReference ?? "",
      d.categoryName ?? "",
      d.cashboxName ?? "",
      isDebe ? amount : "",
      !isDebe ? amount : "",
    ]);
    const bg = isDebe ? COLORS.expenseRow : COLORS.incomeRow;
    row.eachCell((cell, col) => {
      applyDataBorder(cell);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      if (col === 7 || col === 8) {
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  wsSummary.views = [{ state: "frozen", ySplit: 5 }];
  wsDetail.views  = [{ state: "frozen", ySplit: 5 }];

  return wb.xlsx.writeBuffer();
}
