// src/pages/api/reportes/excel.ts
import type { APIRoute } from "astro";
import ExcelJS from "exceljs";
import { db } from "@/db";
import {
  transactions, cashboxes, transactionCategories,
  employeeFees, employees, tenantPayments, tenants,
} from "@/db/schema";
import { and, between, eq, isNull, or, inArray, sum, sql } from "drizzle-orm";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  headerBg:     "1E3A5F",   // deep navy
  headerFg:     "FFFFFF",
  incomeBg:     "DCFCE7",   // soft green
  incomeFg:     "15803D",
  outcomeBg:    "FEE2E2",   // soft red
  outcomeFg:    "DC2626",
  totalBg:      "EFF6FF",   // light blue
  totalFg:      "1D4ED8",
  subHeaderBg:  "F1F5F9",
  subHeaderFg:  "334155",
  border:       "CBD5E1",
  altRow:       "F8FAFC",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const bsFormat = '#,##0.00" Bs."';
const dateStr  = (d: Date) => d.toLocaleDateString("es-BO", { timeZone: "America/La_Paz", day: "2-digit", month: "2-digit", year: "numeric" });
const nowBo    = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/La_Paz" }));

function headerStyle(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.font  = { name: "Arial", bold: true, color: { argb: C.headerFg }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder();
  }
  r.height = 22;
}

function thinBorder(): ExcelJS.Borders {
  const s = { style: "thin" as const, color: { argb: C.border } };
  return { top: s, left: s, bottom: s, right: s, diagonal: s };
}

function subHeader(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.subHeaderBg } };
    cell.font  = { name: "Arial", bold: true, color: { argb: C.subHeaderFg }, size: 9 };
    cell.border = thinBorder();
  }
}

function setWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

function addTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols);
  const t = ws.getCell("A1");
  t.value = "TRANS CARRASCO TROPICAL";
  t.font  = { name: "Arial", bold: true, size: 13, color: { argb: C.headerBg } };
  t.alignment = { horizontal: "center" };

  ws.mergeCells(2, 1, 2, cols);
  const t2 = ws.getCell("A2");
  t2.value = title;
  t2.font  = { name: "Arial", bold: true, size: 11, color: { argb: C.headerBg } };
  t2.alignment = { horizontal: "center" };

  ws.mergeCells(3, 1, 3, cols);
  const t3 = ws.getCell("A3");
  t3.value = subtitle;
  t3.font  = { name: "Arial", size: 9, color: { argb: "64748B" } };
  t3.alignment = { horizontal: "center" };

  ws.getRow(1).height = 24;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 16;
}

// ─── Query helpers ────────────────────────────────────────────────────────────
async function fetchTransactions(from: string, to: string, cashboxId?: string) {
  const fromDate = new Date(`${from}T00:00:00-04:00`);
  const toDate   = new Date(`${to}T23:59:59-04:00`);

  const conditions = [between(transactions.createdAt, fromDate, toDate)];
  if (cashboxId) conditions.push(eq(transactions.cashboxId, cashboxId));

  return db
    .select({
      id:           transactions.id,
      createdAt:    transactions.createdAt,
      type:         transactions.type,
      amount:       transactions.amount,
      concept:      transactions.concept,
      externalReference: transactions.externalReference,
      invoiceNumber:     transactions.invoiceNumber,
      balanceAfter: transactions.balanceAfter,
      status:       transactions.status,
      cashboxName:  cashboxes.name,
      cashboxCode:  cashboxes.code,
      categoryName: transactionCategories.name,
      categoryCode: transactionCategories.code,
      categoryType: transactionCategories.type,
    })
    .from(transactions)
    .leftJoin(cashboxes,             eq(transactions.cashboxId,  cashboxes.id))
    .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
    .where(and(...conditions))
    .orderBy(transactions.createdAt);
}

// ─── 1. LIBRO MAYOR ───────────────────────────────────────────────────────────
async function buildLibroMayor(wb: ExcelJS.Workbook, from: string, to: string, cashboxId?: string) {
  const rows = await fetchTransactions(from, to, cashboxId);
  const ws   = wb.addWorksheet("Libro Mayor");
  const COLS = 8;

  setWidths(ws, [12, 38, 28, 22, 16, 16, 16, 20]);
  addTitle(ws, "LIBRO MAYOR", `Período: ${from} al ${to}  |  Generado: ${dateStr(nowBo())}`, COLS);

  // Column headers — row 5
  ws.getRow(5).values = ["", "Fecha", "Concepto / Categoría", "Caja", "Referencia", "Debe (Bs.)", "Haber (Bs.)", "Saldo (Bs.)"];
  headerStyle(ws, 5, COLS);

  let totalDebe = 0, totalHaber = 0;
  let rowIdx = 6;

  rows.forEach((tx, i) => {
    const isIncome  = tx.type === "deposit";
    const amount    = parseFloat(tx.amount ?? "0");
    const balance   = parseFloat(tx.balanceAfter ?? "0");
    const debe      = isIncome ? 0 : amount;
    const haber     = isIncome ? amount : 0;
    totalDebe  += debe;
    totalHaber += haber;

    const r = ws.getRow(rowIdx);
    r.values = [
      i + 1,
      dateStr(new Date(tx.createdAt)),
      `${tx.categoryName ?? "—"}  ${tx.concept ? `· ${tx.concept}` : ""}`.trim(),
      `[${tx.cashboxCode ?? ""}] ${tx.cashboxName ?? ""}`,
      tx.invoiceNumber ? `#${tx.invoiceNumber}` : tx.externalReference ?? "—",
      debe  || null,
      haber || null,
      balance,
    ];

    // Zebra
    const bg = i % 2 === 0 ? "FFFFFF" : C.altRow;
    for (let c = 1; c <= COLS; c++) {
      const cell = r.getCell(c);
      cell.font   = { name: "Arial", size: 9 };
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: isIncome ? C.incomeBg : bg } };
      cell.border = thinBorder();
      if (c >= 6) {
        cell.numFmt    = bsFormat;
        cell.alignment = { horizontal: "right" };
        cell.font = { name: "Arial", size: 9, color: { argb: c === 6 ? C.outcomeFg : c === 7 ? C.incomeFg : C.headerBg } };
      }
    }
    rowIdx++;
  });

  // Totals row
  const tot = ws.getRow(rowIdx);
  tot.values = ["", "", "", "", "TOTALES", totalDebe, totalHaber, totalDebe - totalHaber];
  for (let c = 1; c <= COLS; c++) {
    const cell = tot.getCell(c);
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalBg } };
    cell.font   = { name: "Arial", bold: true, size: 9, color: { argb: C.totalFg } };
    cell.border = thinBorder();
    if (c >= 6) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
  }
  tot.height = 20;

  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: COLS } };
}

// ─── 2. POR CAJA ──────────────────────────────────────────────────────────────
async function buildPorCaja(wb: ExcelJS.Workbook, from: string, to: string) {
  const allTx = await fetchTransactions(from, to);

  // Group by cashbox
  const byBox = new Map<string, typeof allTx>();
  for (const tx of allTx) {
    const key = tx.cashboxCode ?? "SIN_CAJA";
    if (!byBox.has(key)) byBox.set(key, []);
    byBox.get(key)!.push(tx);
  }

  // Summary sheet
  const summary = wb.addWorksheet("Resumen por Caja");
  const SC = 5;
  setWidths(summary, [10, 36, 20, 20, 20]);
  addTitle(summary, "RESUMEN POR CAJA", `Período: ${from} al ${to}`, SC);
  summary.getRow(5).values = ["", "Caja", "Total Ingresos (Bs.)", "Total Egresos (Bs.)", "Resultado (Bs.)"];
  headerStyle(summary, 5, SC);

  let sRow = 6;
  let grandIn = 0, grandOut = 0;

  for (const [code, txs] of byBox) {
    const income  = txs.filter(t => t.type === "deposit").reduce((s, t)  => s + parseFloat(t.amount ?? "0"), 0);
    const outcome = txs.filter(t => t.type === "withdraw").reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0);
    grandIn  += income;
    grandOut += outcome;

    const name = txs[0]?.cashboxName ?? code;
    const r = summary.getRow(sRow);
    r.values = ["", `[${code}] ${name}`, income, outcome, income - outcome];
    for (let c = 1; c <= SC; c++) {
      const cell = r.getCell(c);
      cell.font   = { name: "Arial", size: 9 };
      cell.border = thinBorder();
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: sRow % 2 === 0 ? "FFFFFF" : C.altRow } };
      if (c >= 3) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
    }
    sRow++;
  }

  // Grand total
  const gt = summary.getRow(sRow);
  gt.values = ["", "TOTAL GENERAL", grandIn, grandOut, grandIn - grandOut];
  for (let c = 1; c <= SC; c++) {
    const cell = gt.getCell(c);
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalBg } };
    cell.font   = { name: "Arial", bold: true, size: 9, color: { argb: C.totalFg } };
    cell.border = thinBorder();
    if (c >= 3) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
  }

  // Detail sheet per cashbox
  for (const [code, txs] of byBox) {
    const name = txs[0]?.cashboxName ?? code;
    const ws   = wb.addWorksheet(`Caja ${code}`);
    const COLS = 7;
    setWidths(ws, [12, 32, 22, 14, 16, 16, 16]);
    addTitle(ws, `DETALLE CAJA: [${code}] ${name}`, `Período: ${from} al ${to}`, COLS);
    ws.getRow(5).values = ["", "Fecha", "Concepto / Categoría", "Referencia", "Tipo", "Importe (Bs.)", "Saldo (Bs.)"];
    headerStyle(ws, 5, COLS);

    let dRow = 6;
    txs.forEach((tx, i) => {
      const amount  = parseFloat(tx.amount ?? "0");
      const balance = parseFloat(tx.balanceAfter ?? "0");
      const isIn    = tx.type === "deposit";
      const r = ws.getRow(dRow);
      r.values = [
        i + 1,
        dateStr(new Date(tx.createdAt)),
        `${tx.categoryName ?? "—"}${tx.concept ? ` · ${tx.concept}` : ""}`,
        tx.invoiceNumber ? `#${tx.invoiceNumber}` : tx.externalReference ?? "—",
        isIn ? "INGRESO" : "EGRESO",
        amount,
        balance,
      ];
      for (let c = 1; c <= COLS; c++) {
        const cell = r.getCell(c);
        cell.font   = { name: "Arial", size: 9 };
        cell.border = thinBorder();
        cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: isIn ? C.incomeBg : (i % 2 === 0 ? "FFFFFF" : C.altRow) } };
        if (c === 5) cell.font = { name: "Arial", size: 9, bold: true, color: { argb: isIn ? C.incomeFg : C.outcomeFg } };
        if (c >= 6) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
      }
      dRow++;
    });

    ws.views = [{ state: "frozen", ySplit: 5 }];
  }
}

// ─── 3. ESTADO DE RESULTADOS (P&L) ────────────────────────────────────────────
async function buildEstadoResultados(wb: ExcelJS.Workbook, from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00-04:00`);
  const toDate   = new Date(`${to}T23:59:59-04:00`);

  const rows = await db
    .select({
      categoryName: transactionCategories.name,
      categoryType: transactionCategories.type,
      total:        sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
    .where(and(
      between(transactions.createdAt, fromDate, toDate),
      eq(transactions.status, "completado"),
    ))
    .groupBy(transactionCategories.name, transactionCategories.type)
    .orderBy(transactionCategories.type, transactionCategories.name);

  const incomeRows   = rows.filter(r => r.categoryType === "income");
  const outcomeRows  = rows.filter(r => r.categoryType === "outcome");
  const totalIncome  = incomeRows.reduce((s, r)  => s + parseFloat(r.total), 0);
  const totalOutcome = outcomeRows.reduce((s, r) => s + parseFloat(r.total), 0);
  const resultado    = totalIncome - totalOutcome;

  // 3 columns: A=Descripción (wide), B=spacer, C=Importe
  const ws   = wb.addWorksheet("Estado de Resultados");
  const COLS = 3;
  ws.getColumn(1).width = 52;
  ws.getColumn(2).width = 6;
  ws.getColumn(3).width = 22;
  addTitle(ws, "ESTADO DE RESULTADOS", `Período: ${from} al ${to}  |  Generado: ${dateStr(nowBo())}`, COLS);

  let r = 5;

  const writeSectionER = (label: string, sectionRows: typeof rows, bgArgb: string, fgArgb: string) => {
    // Section banner — full width
    ws.mergeCells(r, 1, r, COLS);
    const hc = ws.getCell(r, 1);
    hc.value = label;
    hc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    hc.font  = { name: "Arial", bold: true, size: 10, color: { argb: fgArgb } };
    hc.alignment = { horizontal: "left", indent: 1 };
    ws.getRow(r).height = 20;
    r++;

    // Sub-header
    ws.getRow(r).values = ["Descripción", "", "Importe (Bs.)"];
    const sh = ws.getRow(r);
    for (let c = 1; c <= COLS; c++) {
      const cell = sh.getCell(c);
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.subHeaderBg } };
      cell.font  = { name: "Arial", bold: true, size: 9, color: { argb: C.subHeaderFg } };
      cell.border = thinBorder();
      if (c === COLS) cell.alignment = { horizontal: "right" };
    }
    sh.height = 16;
    r++;

    sectionRows.forEach((row, i) => {
      const wr = ws.getRow(r);
      wr.values = [row.categoryName ?? "—", "", parseFloat(row.total)];
      for (let c = 1; c <= COLS; c++) {
        const cell = wr.getCell(c);
        cell.font   = { name: "Arial", size: 9 };
        cell.border = thinBorder();
        cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFFFF" : C.altRow } };
        if (c === COLS) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
        if (c === 1) cell.alignment = { horizontal: "left", indent: 2 };
      }
      r++;
    });
  };

  const writeTotalER = (label: string, amount: number, bgArgb: string, fgArgb: string) => {
    ws.mergeCells(r, 1, r, 2);
    const tr = ws.getRow(r);
    tr.getCell(1).value = label;
    tr.getCell(3).value = amount;
    for (let c = 1; c <= COLS; c++) {
      const cell = tr.getCell(c);
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      cell.font   = { name: "Arial", bold: true, size: 10, color: { argb: fgArgb } };
      cell.border = thinBorder();
      if (c === COLS) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
      if (c === 1) cell.alignment = { horizontal: "left", indent: 1 };
    }
    tr.height = 20;
    r += 2;
  };

  writeSectionER("INGRESOS",  incomeRows,  "DCFCE7", C.incomeFg);
  writeTotalER("TOTAL INGRESOS",  totalIncome,  "BBF7D0", C.incomeFg);

  writeSectionER("EGRESOS", outcomeRows, "FEE2E2", C.outcomeFg);
  writeTotalER("TOTAL EGRESOS", totalOutcome, "FECACA", C.outcomeFg);

  // Resultado neto
  const isPositive = resultado >= 0;
  ws.mergeCells(r, 1, r, 2);
  const rt = ws.getRow(r);
  rt.getCell(1).value = isPositive ? "RESULTADO DEL PERÍODO (SUPERÁVIT)" : "RESULTADO DEL PERÍODO (DÉFICIT)";
  rt.getCell(3).value = resultado;
  for (let c = 1; c <= COLS; c++) {
    const cell = rt.getCell(c);
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: isPositive ? C.totalBg : "FEE2E2" } };
    cell.font   = { name: "Arial", bold: true, size: 11, color: { argb: isPositive ? C.totalFg : C.outcomeFg } };
    cell.border = thinBorder();
    if (c === COLS) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
    if (c === 1) cell.alignment = { horizontal: "left", indent: 1 };
  }
  rt.height = 26;

  ws.views = [{ state: "frozen", ySplit: 4 }];
}

// ─── 5. BALANCE GENERAL (Activo / Pasivo / Patrimonio) ───────────────────────
async function buildBalanceGeneral(wb: ExcelJS.Workbook, from: string, to: string) {
  const [genCashbox] = await db
    .select({ name: cashboxes.name, balance: cashboxes.balance })
    .from(cashboxes)
    .where(eq(cashboxes.code, "GEN"));

  const totalActivo = parseFloat(genCashbox?.balance ?? "0");

  const pendingFees = await db
    .select({ employeeName: employees.fullName, period: employeeFees.period, amount: employeeFees.amount })
    .from(employeeFees)
    .leftJoin(employees, eq(employeeFees.employeeId, employees.id))
    .where(eq(employeeFees.status, "pendiente"))
    .orderBy(employees.fullName, employeeFees.period);

  const totalFees = pendingFees.reduce((s, f) => s + (f.amount ?? 0), 0);

  const pendingRents = await db
    .select({ tenantName: tenants.fullName, period: tenantPayments.period, amount: tenantPayments.amount })
    .from(tenantPayments)
    .leftJoin(tenants, eq(tenantPayments.tenantId, tenants.id))
    .where(eq(tenantPayments.status, "pendiente"))
    .orderBy(tenants.fullName, tenantPayments.period);

  const totalRents      = pendingRents.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalPasivo     = totalFees + totalRents;
  const totalPatrimonio = totalActivo - totalPasivo;

  // 3 columns: A=Descripción (wide), B=spacer, C=Saldo
  const ws   = wb.addWorksheet("Balance General");
  const COLS = 3;
  ws.getColumn(1).width = 52;
  ws.getColumn(2).width = 6;
  ws.getColumn(3).width = 22;
  addTitle(ws, "BALANCE GENERAL", `Al: ${to}  |  Generado: ${dateStr(nowBo())}`, COLS);

  let r = 5;

  const writeBanner = (label: string, bgArgb: string, fgArgb: string) => {
    ws.mergeCells(r, 1, r, COLS);
    const hc = ws.getCell(r, 1);
    hc.value = label;
    hc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    hc.font  = { name: "Arial", bold: true, size: 10, color: { argb: fgArgb } };
    hc.alignment = { horizontal: "left", indent: 1 };
    ws.getRow(r).height = 20;
    r++;
  };

  const writeSubHeader = (col3Label: string) => {
    ws.getRow(r).values = ["Descripción", "", col3Label];
    for (let c = 1; c <= COLS; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.subHeaderBg } };
      cell.font  = { name: "Arial", bold: true, size: 9, color: { argb: C.subHeaderFg } };
      cell.border = thinBorder();
      if (c === COLS) cell.alignment = { horizontal: "right" };
    }
    ws.getRow(r).height = 16;
    r++;
  };

  const writeDataRow = (label: string, amount: number, i: number) => {
    const wr = ws.getRow(r);
    wr.values = [label, "", amount];
    for (let c = 1; c <= COLS; c++) {
      const cell = wr.getCell(c);
      cell.font   = { name: "Arial", size: 9 };
      cell.border = thinBorder();
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFFFF" : C.altRow } };
      if (c === COLS) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
      if (c === 1) cell.alignment = { horizontal: "left", indent: 2 };
    }
    r++;
  };

  const writeTotalBG = (label: string, amount: number, bgArgb: string, fgArgb: string, gap = 1) => {
    ws.mergeCells(r, 1, r, 2);
    const tr = ws.getRow(r);
    tr.getCell(1).value = label;
    tr.getCell(3).value = amount;
    for (let c = 1; c <= COLS; c++) {
      const cell = tr.getCell(c);
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      cell.font   = { name: "Arial", bold: true, size: 10, color: { argb: fgArgb } };
      cell.border = thinBorder();
      if (c === COLS) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
      if (c === 1) cell.alignment = { horizontal: "left", indent: 1 };
    }
    tr.height = 20;
    r += gap + 1;
  };

  // ── ACTIVO ──
  writeBanner("ACTIVO — Efectivo en Cajas", "DCFCE7", C.incomeFg);
  writeSubHeader("Saldo (Bs.)");
  writeDataRow(genCashbox?.name ?? "Caja General", totalActivo, 0);
  writeTotalBG("TOTAL ACTIVO", totalActivo, "BBF7D0", C.incomeFg, 1);

  // ── PASIVO — Sueldos ──
  writeBanner("PASIVO — Sueldos por Pagar", "FEE2E2", C.outcomeFg);
  writeSubHeader("Importe (Bs.)");
  pendingFees.forEach((f, i) => writeDataRow(`${f.employeeName ?? "—"} (${f.period})`, f.amount ?? 0, i));
  writeTotalBG("SUBTOTAL Sueldos por Pagar", totalFees, "FECACA", C.outcomeFg, 0);

  // ── PASIVO — Alquileres ──
  writeBanner("PASIVO — Alquileres Pendientes", "FEF9C3", "A16207");
  writeSubHeader("Importe (Bs.)");
  pendingRents.forEach((rn, i) => writeDataRow(`${rn.tenantName ?? "—"} (${rn.period})`, rn.amount ?? 0, i));
  writeTotalBG("SUBTOTAL Alquileres Pendientes", totalRents, "FEF08A", "A16207", 0);

  writeTotalBG("TOTAL PASIVO", totalPasivo, "FEE2E2", C.outcomeFg, 1);

  // ── PATRIMONIO ──
  const isPos = totalPatrimonio >= 0;
  ws.mergeCells(r, 1, r, 2);
  const pt = ws.getRow(r);
  pt.getCell(1).value = isPos ? "PATRIMONIO NETO (Activo − Pasivo)" : "DÉFICIT PATRIMONIAL";
  pt.getCell(3).value = totalPatrimonio;
  for (let c = 1; c <= COLS; c++) {
    const cell = pt.getCell(c);
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: isPos ? C.totalBg : "FEE2E2" } };
    cell.font   = { name: "Arial", bold: true, size: 12, color: { argb: isPos ? C.totalFg : C.outcomeFg } };
    cell.border = thinBorder();
    if (c === COLS) { cell.numFmt = bsFormat; cell.alignment = { horizontal: "right" }; }
    if (c === 1) cell.alignment = { horizontal: "left", indent: 1 };
  }
  pt.height = 28;

  ws.views = [{ state: "frozen", ySplit: 4 }];
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });

  const url   = new URL(request.url);
  const tipo  = url.searchParams.get("tipo") ?? "";
  const from  = url.searchParams.get("from") ?? "";
  const to    = url.searchParams.get("to")   ?? "";
  const id    = url.searchParams.get("id")   ?? "";

  if (!tipo || !from || !to) {
    return new Response(JSON.stringify({ error: "Parámetros incompletos" }), { status: 400 });
  }

  try {
    const wb       = new ExcelJS.Workbook();
    wb.creator     = "Sistema Carrasco";
    wb.created     = nowBo();
    wb.modified    = nowBo();

    let filename = `reporte_${tipo}_${from}_${to}.xlsx`;

    if (tipo === "libro_mayor") {
      await buildLibroMayor(wb, from, to, id || undefined);
      filename = `libro_mayor_${from}_${to}.xlsx`;
    } else if (tipo === "por_caja") {
      await buildPorCaja(wb, from, to);
      filename = `gastos_por_caja_${from}_${to}.xlsx`;
    } else if (tipo === "balance_general") {
      await buildBalanceGeneral(wb, from, to);
      await buildEstadoResultados(wb, from, to);
      filename = `balance_general_${from}_${to}.xlsx`;
    } else {
      return new Response(JSON.stringify({ error: "Tipo de reporte no válido" }), { status: 400 });
    }

    const buffer = await wb.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("[excel report]", err);
    return new Response(JSON.stringify({ error: "Error generando el reporte" }), { status: 500 });
  }
};
