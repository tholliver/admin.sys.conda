// src/pages/api/reportes/excel.ts
import type { APIRoute } from "astro";
import {
  generateLibroMayor,
  generateGastosPorCaja,
  generateGastosPorSector,
} from "@/services/finances/excel-reports.service";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  const url    = new URL(request.url);
  const tipo   = url.searchParams.get("tipo");         // "libro_mayor" | "por_caja" | "por_sector"
  const from   = url.searchParams.get("from");
  const to     = url.searchParams.get("to");
  const extra  = url.searchParams.get("id");            // cashboxId or sectorId

  if (!tipo || !from || !to) {
    return new Response(JSON.stringify({ error: "Parámetros incompletos: tipo, from y to son requeridos" }), {
      status: 400,
    });
  }

  // Bolivia timezone boundaries
  const fromDate = new Date(`${from}T00:00:00-04:00`);
  const toDate   = new Date(`${to}T23:59:59-04:00`);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return new Response(JSON.stringify({ error: "Fechas inválidas" }), { status: 400 });
  }

  try {
    let buffer: ExcelJS.Buffer;
    let filename: string;

    const slug = `${from}_${to}`;

    if (tipo === "libro_mayor") {
      buffer   = await generateLibroMayor(fromDate, toDate, extra ?? undefined);
      filename = `libro_mayor_${slug}.xlsx`;

    } else if (tipo === "por_caja") {
      buffer   = await generateGastosPorCaja(fromDate, toDate);
      filename = `gastos_por_caja_${slug}.xlsx`;

    } else if (tipo === "por_sector") {
      const sectorId = extra ? parseInt(extra, 10) : undefined;
      buffer   = await generateGastosPorSector(fromDate, toDate, sectorId);
      filename = `gastos_por_sector_${slug}.xlsx`;

    } else {
      return new Response(JSON.stringify({ error: "Tipo de reporte inválido" }), { status: 400 });
    }

    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });

  } catch (err) {
    console.error("[Report Error]", err);
    return new Response(JSON.stringify({ error: "Error al generar el reporte" }), { status: 500 });
  }
};

// Need this import for the type — ExcelJS buffer is ArrayBuffer compatible
import type ExcelJS from "exceljs";
