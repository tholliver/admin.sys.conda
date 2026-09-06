// src/pages/api/reportes/pdf.ts
import type { APIRoute } from "astro";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/db";
import {
  cashboxes,
  transactions,
  transactionCategories,
  invoiceRanges,
  employeeFees,
  employees,
  tenantPayments,
  tenants,
} from "@/db/schema";
import { sql, isNull, and, gte, lte, eq, desc, between } from "drizzle-orm";
import { withAuth, json } from "@/lib/server/with-auth";
import { readFileSync } from "fs";
import { join } from "path";
import { realTransactionFilter } from "@/services/finances/transaction-patterns";

// ─── Bolivia helpers ──────────────────────────────────────────────────────────

const TZ = "America/La_Paz";

function nowBO(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

function boDateRange(date: Date = nowBO()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [{ value: m }, , { value: d }, , { value: y }] = fmt.formatToParts(date);
  const start = new Date(`${y}-${m}-${d}T04:00:00Z`);
  const end   = new Date(`${y}-${m}-${d}T03:59:59.999Z`);
  end.setDate(end.getDate() + 1);
  return { start, end, label: `${d}/${m}/${y}` };
}

const fmtBOB = (n: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(n);

const fmtNum = (n: number) =>
  new Intl.NumberFormat("es-BO").format(n);

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("es-BO", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  navy:       rgb(0.118, 0.227, 0.373),   // #1E3A5F
  navyLight:  rgb(0.22,  0.35,  0.53),
  white:      rgb(1,     1,     1),
  offWhite:   rgb(0.972, 0.976, 0.984),   // #F8FAFC slate-50
  slate200:   rgb(0.882, 0.902, 0.922),   // #E2E8F0
  slate500:   rgb(0.55,  0.65,  0.75),    // pastel gray
  slate700:   rgb(0.4,   0.5,   0.65),    // pastel blue-gray
  emerald:    rgb(0.0,   0.55,  0.25),    // strong green
  emeraldBg:  rgb(0.863, 0.988, 0.914),   // #DCFCE7
  red:        rgb(0.85,  0.15,  0.15),    // strong red
  redBg:      rgb(0.996, 0.886, 0.886),   // #FEE2E2
  amber:      rgb(0.75,  0.5,   0.15),    // strong amber
  amberBg:    rgb(0.996, 0.973, 0.765),   // #FEF9C3
  blue:       rgb(0.1,   0.3,   0.85),    // strong blue
  blueBg:     rgb(0.937, 0.965, 1.0),     // #EFF6FF
  moneyGreen: rgb(0.0,   0.45,  0.18),    // dark green for income
  moneyRed:   rgb(0.7,   0.0,   0.0),     // dark red for expenses
  moneyBold:  rgb(0.05,  0.15,  0.5),     // strong navy for totals
};

const PAGE_W  = 595;   // A4
const PAGE_H  = 842;
const MARGIN  = 36;
const COL_W   = PAGE_W - MARGIN * 2;

// ─── Drawing primitives ───────────────────────────────────────────────────────

interface Ctx {
  page: PDFPage;
  bold: PDFFont;
  reg:  PDFFont;
  y:    number;
}

function rect(
  ctx: Ctx,
  x: number, y: number, w: number, h: number,
  fill: ReturnType<typeof rgb>,
) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color: fill });
}

function text(
  ctx: Ctx,
  str: string,
  x: number, y: number,
  opts: {
    font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>;
    align?: "left" | "right" | "center"; maxWidth?: number;
  } = {},
) {
  const { font = ctx.reg, size = 8, color = C.slate700, align = "left", maxWidth } = opts;
  let drawX = x;
  if (align === "right")  drawX = x - font.widthOfTextAtSize(str, size);
  if (align === "center") drawX = x - font.widthOfTextAtSize(str, size) / 2;
  ctx.page.drawText(str, { x: drawX, y, size, font, color, maxWidth });
}

function hline(ctx: Ctx, x: number, y: number, w: number, thickness = 0.5, color = C.slate200) {
  ctx.page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color });
}

// ─── Header (logo + title) ────────────────────────────────────────────────────

async function drawHeader(pdfDoc: PDFDocument, ctx: Ctx, subtitle: string) {
  const headerH = 64;
  const topY    = PAGE_H - MARGIN;

  // White banner background
  rect(ctx, MARGIN, topY - headerH, COL_W, headerH, C.white);

  // Logo
  try {
    const logoPath = join(process.cwd(), "public", "carrasco_logo.jpg");
    const logoBytes = readFileSync(logoPath);
    const logoImg   = await pdfDoc.embedJpg(logoBytes);
    const logoDim   = logoImg.scaleToFit(50, 50);
    ctx.page.drawImage(logoImg, {
      x: MARGIN + 10,
      y: topY - headerH + (headerH - logoDim.height) / 2,
      width:  logoDim.width,
      height: logoDim.height,
    });
  } catch { /* logo not found — skip silently */ }

  // Title text
  const centerX = MARGIN + COL_W / 2;
  text(ctx, "TRANS CARRASCO TROPICAL",
    centerX, topY - 20, { font: ctx.bold, size: 9, color: C.navy, align: "center" });
  text(ctx, subtitle,
    centerX, topY - 34, { font: ctx.bold, size: 11, color: C.navy, align: "center" });
  text(ctx, `Generado: ${fmtDateShort(nowBO())}`,
    centerX, topY - 48, { size: 7, color: C.slate500, align: "center" });

  ctx.y = topY - headerH - 12;
}

// ─── Section banner ───────────────────────────────────────────────────────────

function sectionBanner(ctx: Ctx, label: string, bg = C.navyLight, fg = C.white) {
  rect(ctx, MARGIN, ctx.y - 16, COL_W, 18, bg);
  text(ctx, label, MARGIN + 6, ctx.y - 12, { font: ctx.bold, size: 8.5, color: fg });
  ctx.y -= 24;
}

// ─── Table row ────────────────────────────────────────────────────────────────

interface ColDef {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
  isNum?: boolean;
}

function tableHeader(ctx: Ctx, cols: ColDef[]) {
  rect(ctx, MARGIN, ctx.y - 14, COL_W, 16, C.navy);
  let x = MARGIN + 4;
  for (const col of cols) {
    text(ctx, col.label, col.align === "right" ? x + col.width - 4 : x,
      ctx.y - 10, { font: ctx.bold, size: 7, color: C.white, align: col.align ?? "left" });
    x += col.width;
  }
  ctx.y -= 18;
}

function tableRow(
  ctx: Ctx,
  cells: string[],
  cols: ColDef[],
  odd: boolean,
  rowBg?: ReturnType<typeof rgb>,
  numColor?: ReturnType<typeof rgb>,
) {
  const h   = 14;
  const bg  = rowBg ?? (odd ? C.offWhite : C.white);
  rect(ctx, MARGIN, ctx.y - h + 2, COL_W, h, bg);
  let x = MARGIN + 4;
  for (let i = 0; i < cols.length; i++) {
    const col  = cols[i];
    const cell = cells[i] ?? "";
    const fg   = col.isNum ? (numColor ?? C.moneyBold) : C.slate700;
    text(ctx, cell, col.align === "right" ? x + col.width - 4 : x,
      ctx.y - 9, { size: 7.5, color: fg, align: col.align ?? "left", maxWidth: col.width - 6 });
    x += col.width;
  }
  ctx.y -= h;
}

function totalsRow(ctx: Ctx, cells: string[], cols: ColDef[]) {
  const h = 16;
  rect(ctx, MARGIN, ctx.y - h + 2, COL_W, h, C.blueBg);
  let x = MARGIN + 4;
  for (let i = 0; i < cols.length; i++) {
    const col  = cols[i];
    const cell = cells[i] ?? "";
    const fg   = col.isNum ? C.moneyBold : C.navy;
    text(ctx, cell, col.align === "right" ? x + col.width - 4 : x,
      ctx.y - 10, { font: ctx.bold, size: 7.5, color: fg, align: col.align ?? "left" });
    x += col.width;
  }
  ctx.y -= h + 6;
}

// Ensures we have room; if not, caller must add new page
function needsSpace(ctx: Ctx, needed: number): boolean {
  return ctx.y - needed < MARGIN + 20;
}

// ─── QUERY LAYER ─────────────────────────────────────────────────────────────

async function queryGlobal() {
  // Cashboxes with status
  const boxes = await db
    .select({
      id:             cashboxes.id,
      name:           cashboxes.name,
      code:           cashboxes.code,
      balance:        cashboxes.balance,
      isQuick:        cashboxes.isQuick,
      status:         cashboxes.status,
    })
    .from(cashboxes)
    .where(isNull(cashboxes.deletedAt))
    .orderBy(desc(cashboxes.isQuick), cashboxes.name);

  // Total spending (withdrawals) per cashbox
  const spending = await db
    .select({
      cashboxId: transactions.cashboxId,
      total:     sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.type, "withdraw"),
      eq(transactions.status, "completado"),
      realTransactionFilter,
    ))
    .groupBy(transactions.cashboxId);

  const spendingMap = new Map(spending.map(s => [s.cashboxId, s.total]));

  // Invoice ranges summary  (N transactions, M amount) per range
  const invoiceSummary = await db
    .select({
      rangeId:    invoiceRanges.id,
      category:   invoiceRanges.category,
      prefix:     invoiceRanges.prefix,
      rangeStart: invoiceRanges.rangeStart,
      rangeEnd:   invoiceRanges.rangeEnd,
      current:    invoiceRanges.current,
      isActive:   invoiceRanges.isActive,
      expiresAt:  invoiceRanges.expirationDate,
      txCount:    sql<number>`COUNT(${transactions.id})`,
      txAmount:   sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
    })
    .from(invoiceRanges)
    .leftJoin(transactions, and(
      eq(transactions.invoiceRangeId, invoiceRanges.id),
      eq(transactions.status, "completado"),
    ))
    .groupBy(
      invoiceRanges.id, invoiceRanges.category, invoiceRanges.prefix,
      invoiceRanges.rangeStart, invoiceRanges.rangeEnd, invoiceRanges.current,
      invoiceRanges.isActive, invoiceRanges.expirationDate,
    )
    .orderBy(invoiceRanges.category);

  // Today transactions
  const { start, end, label: todayLabel } = boDateRange();
  const todayTx = await db
    .select({
      id:           transactions.id,
      type:         transactions.type,
      amount:       transactions.amount,
      concept:      transactions.concept,
      invoiceNum:   transactions.invoiceNumber,
      extRef:       transactions.externalReference,
      status:       transactions.status,
      catName:      transactionCategories.name,
      cashboxName:  cashboxes.name,
      cashboxCode:  cashboxes.code,
      createdAt:    transactions.createdAt,
    })
    .from(transactions)
    .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
    .leftJoin(cashboxes,             eq(transactions.cashboxId, cashboxes.id))
    .where(and(
      gte(transactions.createdAt, start),
      lte(transactions.createdAt, end),
      eq(transactions.status, "completado"),
      realTransactionFilter,
    ))
    .orderBy(desc(transactions.createdAt));

  return { boxes, invoiceSummary, todayTx, todayLabel, spendingMap };
}

async function queryCashboxDetail(cashboxId: string) {
  // Pending employee fees
  const fees = await db
    .select({
      name:   employees.fullName,
      period: employeeFees.period,
      amount: employeeFees.amount,
    })
    .from(employeeFees)
    .leftJoin(employees, eq(employeeFees.employeeId, employees.id))
    .where(and(
      eq(employeeFees.status, "pendiente"),
      eq(employees.cashboxId, cashboxId),
    ))
    .orderBy(employees.fullName, employeeFees.period);

  // Pending tenant payments (not cashbox-scoped but included globally)
  const rents = await db
    .select({
      name:   tenants.fullName,
      period: tenantPayments.period,
      amount: tenantPayments.amount,
    })
    .from(tenantPayments)
    .leftJoin(tenants, eq(tenantPayments.tenantId, tenants.id))
    .where(eq(tenantPayments.status, "pendiente"))
    .orderBy(tenants.fullName, tenantPayments.period);

  return { fees, rents };
}

// ─── SECTION BUILDERS ────────────────────────────────────────────────────────

async function buildCashboxSection(
  pdfDoc: PDFDocument,
  ctx: Ctx,
  boxes: Awaited<ReturnType<typeof queryGlobal>>["boxes"],
  scope: "all" | string,  // "all" or cashboxId
  spendingMap: Map<string, string>,
) {
  const filtered = scope === "all" ? boxes : boxes.filter(b => b.id === scope);
  if (!filtered.length) return;

  sectionBanner(ctx, scope === "all" ? "ESTADO DE CAJAS" : `CAJA: ${filtered[0].name.toUpperCase()}`);

  const cols: ColDef[] = [
    { label: "Código",  width: 55 },
    { label: "Nombre",  width: 140 },
    { label: "Estado",  width: 65 },
    { label: "Saldo",   width: 90, align: "right", isNum: true },
    { label: "Gastos",  width: 130, align: "right", isNum: true },
  ];

  tableHeader(ctx, cols);
  let totalBalance = 0, totalSpending = 0;

  for (let i = 0; i < filtered.length; i++) {
    const b   = filtered[i];
    const bal = parseFloat(b.balance ?? "0");
    const spd = parseFloat(spendingMap.get(b.id) ?? "0");
    totalBalance += bal;
    totalSpending += spd;

    const statusLabel: Record<string, string> = {
      activo: "Activo", inactivo: "Inactivo",
      suspendido: "Suspendido", archivado: "Archivado",
    };
    const statusColor: Record<string, ReturnType<typeof rgb>> = {
      activo: C.emeraldBg, inactivo: C.offWhite,
      suspendido: C.amberBg, archivado: C.offWhite,
    };
    const rowBg = b.isQuick ? rgb(0.937, 0.965, 1.0) : statusColor[b.status ?? "activo"];

    tableRow(ctx, [
      b.code,
      b.name + (b.isQuick ? " ★" : ""),
      statusLabel[b.status ?? ""] ?? b.status ?? "—",
      fmtBOB(bal),
      spd > 0 ? fmtBOB(spd) : "—",
    ], cols, i % 2 === 0, rowBg);

    if (needsSpace(ctx, 20)) {
      const newPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      ctx.page = newPage;
      ctx.y    = PAGE_H - MARGIN - 10;
      tableHeader(ctx, cols);
    }
  }

  totalsRow(ctx, ["", `${filtered.length} cajas`, "", fmtBOB(totalBalance), fmtBOB(totalSpending)], cols);

  // If scoped: show salary + rent debts
  if (scope !== "all") {
    const { fees, rents } = await queryCashboxDetail(scope);

    if (fees.length > 0) {
      ctx.y -= 6;
      sectionBanner(ctx, "SUELDOS PENDIENTES", C.redBg, C.red);
      const feeCols: ColDef[] = [
        { label: "Empleado", width: 200 },
        { label: "Período",  width: 100 },
        { label: "Monto",    width: 100, align: "right", isNum: true },
        { label: "",         width: 123 },
      ];
      tableHeader(ctx, feeCols);
      let feeTotal = 0;
      fees.forEach((f, i) => {
        feeTotal += f.amount ?? 0;
        tableRow(ctx, [f.name ?? "—", f.period, fmtBOB(f.amount ?? 0), ""], feeCols, i % 2 === 0);
      });
      totalsRow(ctx, ["Total Sueldos por Pagar", "", fmtBOB(feeTotal), ""], feeCols);
    }

    if (rents.length > 0) {
      ctx.y -= 6;
      sectionBanner(ctx, "ALQUILERES PENDIENTES", C.amberBg, C.amber);
      const rentCols: ColDef[] = [
        { label: "Inquilino", width: 200 },
        { label: "Período",   width: 100 },
        { label: "Monto",     width: 100, align: "right", isNum: true },
        { label: "",          width: 123 },
      ];
      tableHeader(ctx, rentCols);
      let rentTotal = 0;
      rents.forEach((r, i) => {
        rentTotal += r.amount ?? 0;
        tableRow(ctx, [r.name ?? "—", r.period, fmtBOB(r.amount ?? 0), ""], rentCols, i % 2 === 0);
      });
      totalsRow(ctx, ["Total Alquileres Pendientes", "", fmtBOB(rentTotal), ""], rentCols);
    }
  }
}

function buildInvoiceSection(
  ctx: Ctx,
  invoiceSummary: Awaited<ReturnType<typeof queryGlobal>>["invoiceSummary"],
) {
  ctx.y -= 10;
  sectionBanner(ctx, "RESUMEN POR TALONARIO (RANGO DE FACTURACIÓN)");

  const cols: ColDef[] = [
    { label: "Categoría",  width: 130 },
    { label: "Prefijo",    width: 45 },
    { label: "Rango",      width: 80 },
    { label: "Usado",      width: 40, align: "right" },
    { label: "N° Trans.",  width: 65, align: "right", isNum: true },
    { label: "Monto Total", width: 110, align: "right", isNum: true },
  ];
  tableHeader(ctx, cols);

  let grandTxCount = 0, grandAmount = 0;

  invoiceSummary.forEach((inv, i) => {
    const used       = inv.current - inv.rangeStart;
    const total      = inv.rangeEnd - inv.rangeStart;
    const usedPct    = total > 0 ? Math.round((used / total) * 100) : 0;
    const amount     = parseFloat(inv.txAmount ?? "0");

    grandTxCount += inv.txCount ?? 0;
    grandAmount  += amount;

    tableRow(ctx, [
      inv.category,
      inv.prefix ?? "—",
      `${inv.rangeStart} – ${inv.rangeEnd}`,
      `${usedPct}%`,
      fmtNum(inv.txCount ?? 0),
      fmtBOB(amount),
    ], cols, i % 2 === 0);
  });

  totalsRow(ctx, ["", "", "", "", fmtNum(grandTxCount), fmtBOB(grandAmount)], cols);
}

function buildTodaySection(
  ctx: Ctx,
  todayTx: Awaited<ReturnType<typeof queryGlobal>>["todayTx"],
  todayLabel: string,
) {
  ctx.y -= 10;
  sectionBanner(ctx, `TRANSACCIONES DE HOY — ${todayLabel}`);

  if (!todayTx.length) {
    text(ctx, "Sin transacciones hoy.", MARGIN + 6, ctx.y - 10, { size: 8, color: C.slate500 });
    ctx.y -= 20;
    return;
  }

  const cols: ColDef[] = [
    { label: "Hora",      width: 46 },
    { label: "Caja",      width: 70 },
    { label: "Categoría", width: 110 },
    { label: "Concepto",  width: 130 },
    { label: "Ref/Fact.", width: 60 },
    { label: "Tipo",      width: 40 },
    { label: "Monto",     width: 63, align: "right", isNum: true },
  ];
  tableHeader(ctx, cols);

  let totalIn = 0, totalOut = 0;

  todayTx.forEach((tx, i) => {
    const isIn   = tx.type === "deposit";
    const amount = parseFloat(tx.amount ?? "0");
    if (isIn) totalIn += amount; else totalOut += amount;

    const hora = tx.createdAt
      ? new Date(tx.createdAt).toLocaleTimeString("es-BO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
      : "—";
    const ref = tx.invoiceNum ? `#${tx.invoiceNum}` : tx.extRef ?? "—";
    const rowBg = isIn ? C.emeraldBg : (i % 2 === 0 ? C.white : C.offWhite);
    const amountColor = isIn ? C.moneyGreen : C.moneyRed;

    tableRow(ctx, [
      hora,
      `[${tx.cashboxCode ?? ""}] ${tx.cashboxName ?? ""}`,
      tx.catName ?? "—",
      tx.concept ?? "—",
      ref,
      isIn ? "ING" : "EGR",
      fmtBOB(amount),
    ], cols, i % 2 === 0, rowBg, amountColor);
  });

  const net = totalIn - totalOut;
  totalsRow(ctx, [
    "", `${todayTx.length} ops`,
    "",
    `Ing: ${fmtBOB(totalIn)}`,
    `Egr: ${fmtBOB(totalOut)}`,
    "",
    `Neto: ${fmtBOB(net)}`,
  ], cols);
}

// ─── MAIN BUILDER ────────────────────────────────────────────────────────────

async function buildPDF(scope: "all" | string): Promise<Uint8Array> {
  const { boxes, invoiceSummary, todayTx, todayLabel, spendingMap } = await queryGlobal();
  const pdfDoc = await PDFDocument.create();

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { page, bold, reg, y: PAGE_H - MARGIN };

  // Title subtitle
  const subtitle = scope === "all"
    ? "REPORTE FINANCIERO GENERAL"
    : `REPORTE — CAJA: ${(boxes.find(b => b.id === scope)?.name ?? scope).toUpperCase()}`;

  await drawHeader(pdfDoc, ctx, subtitle);
  ctx.y -= 8;

  // 1. Cashbox states
  await buildCashboxSection(pdfDoc, ctx, boxes, scope, spendingMap);

  // New page for invoice ranges
  if (needsSpace(ctx, 80)) {
    ctx.page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    ctx.y    = PAGE_H - MARGIN - 10;
  }

  // 2. Invoice range summary (always shown)
  buildInvoiceSection(ctx, invoiceSummary);

  // New page for today's transactions
  if (needsSpace(ctx, 80)) {
    ctx.page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    ctx.y    = PAGE_H - MARGIN - 10;
  }

  // 3. Today's transactions
  buildTodaySection(ctx, todayTx, todayLabel);

  // Footer on every page
  const pages = pdfDoc.getPages();
  pages.forEach((pg, idx) => {
    pg.drawText(
      `Página ${idx + 1} de ${pages.length}  —  Sistema CONDA · Carrasco`,
      {
        x: MARGIN, y: 18,
        size: 7, font: reg, color: C.slate500,
      },
    );
  });

  return pdfDoc.save();
}

// ─── API Route ────────────────────────────────────────────────────────────────

export const GET: APIRoute = withAuth(async ({ request }) => {
  const url   = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "all"; // "all" | cashboxId

  try {
    const pdfBytes = await buildPDF(scope);
    const dateStr  = nowBO().toISOString().split("T")[0];
    const filename = scope === "all"
      ? `reporte_general_${dateStr}.pdf`
      : `reporte_caja_${scope}_${dateStr}.pdf`;

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("[PDF Report]", err);
    return json({ error: "Error al generar el reporte PDF" }, 500);
  }
});
