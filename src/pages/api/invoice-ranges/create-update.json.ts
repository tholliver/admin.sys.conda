import { db } from "@/db";
import { invoiceRanges, type NewInvoiceRange } from "@/db/schema";
import type { APIRoute } from "astro";
import { eq, ne, ilike, and, sql } from "drizzle-orm";
import { z } from "zod/v4";

const createSchema = z
  .object({
    category:            z.string().min(1, "La categoría es obligatoria").max(50).trim(),
    prefix:              z.string().max(10).optional().nullable(),
    rangeStart:          z.number().int().min(1, "El inicio debe ser mayor a 0"),
    rangeEnd:            z.number().int().min(1, "El fin debe ser mayor a 0"),
    authorizationNumber: z.string().min(1, "El número de autorización es obligatorio").max(50).trim(),
    expirationDate:      z.coerce.date({ error: "Fecha de expiración inválida" }),
  })
  .refine((d) => d.rangeEnd > d.rangeStart, { message: "El fin debe ser mayor al inicio", path: ["rangeEnd"] })

const updateSchema = z
  .object({
    id:                  z.uuid("ID inválido"),
    category:            z.string().min(1).max(50).trim().optional(),
    prefix:              z.string().max(10).optional().nullable(),
    rangeStart:          z.number().int().min(1).optional(),
    rangeEnd:            z.number().int().min(1).optional(),
    current:             z.number().int().min(1).optional(),
    authorizationNumber: z.string().min(1).max(50).trim().optional(),
    expirationDate:      z.coerce.date().optional(),
  })
  .refine((d) => d.rangeStart === undefined || d.rangeEnd === undefined || d.rangeEnd > d.rangeStart, { message: "El fin debe ser mayor al inicio", path: ["rangeEnd"] })
  .refine((d) => d.current === undefined || d.rangeStart === undefined || d.rangeEnd === undefined || (d.current >= d.rangeStart && d.current <= d.rangeEnd), { message: "El actual debe estar dentro del rango", path: ["current"] });

async function checkDuplicateCategory(category: string, excludeId?: string) {
  const conditions = [ilike(invoiceRanges.category, category)];
  if (excludeId) conditions.push(ne(invoiceRanges.id, excludeId));
  const existing = await db
    .select({ id: invoiceRanges.id })
    .from(invoiceRanges)
    .where(and(...conditions))
    .limit(1);
  return existing.length > 0;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Validación fallida",
          details: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { category, prefix, rangeStart, rangeEnd, authorizationNumber, expirationDate } = parsed.data;

    if (await checkDuplicateCategory(category)) {
      return new Response(
        JSON.stringify({
          error: "Categoría duplicada",
          message: `Ya existe un rango con la categoría "${category}".`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }

    const [created] = await db
      .insert(invoiceRanges)
      .values({
        category,
        prefix: prefix ?? null,
        rangeStart,
        rangeEnd,
        current: rangeStart - 1,
        authorizationNumber: parsed.data.authorizationNumber,
        expirationDate:      parsed.data.expirationDate,
      })
      .returning();

    return new Response(
      JSON.stringify({ message: "Rango creado correctamente", data: created }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error al crear rango:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor", details: error?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Validación fallida",
          details: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { id, category, prefix, rangeStart, rangeEnd, current, authorizationNumber, expirationDate } = parsed.data;

    const existing = await db
      .select()
      .from(invoiceRanges)
      .where(eq(invoiceRanges.id, id))
      .limit(1);

    if (existing.length === 0) {
      return new Response(
        JSON.stringify({ error: "Rango no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (existing[0].isSystem) {
      return new Response(
        JSON.stringify({ error: "El código de un rango del sistema no puede modificarse" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    if (category) {
      const categoryChanged =
        category.toLowerCase() !== existing[0].category.toLowerCase();
      if (categoryChanged && (await checkDuplicateCategory(category, id))) {
        return new Response(
          JSON.stringify({
            error: "Categoría duplicada",
            message: `Ya existe un rango con la categoría "${category}".`,
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const updateData: Partial<NewInvoiceRange> = {};
    if (category !== undefined) updateData.category = category;
    if (prefix !== undefined) updateData.prefix = prefix ?? null;
    if (rangeStart !== undefined) updateData.rangeStart = rangeStart;
    if (rangeEnd !== undefined) updateData.rangeEnd = rangeEnd;
    if (current !== undefined) updateData.current = current;
    if (authorizationNumber !== undefined) updateData.authorizationNumber = authorizationNumber;
    if (expirationDate !== undefined)      updateData.expirationDate = expirationDate;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay campos para actualizar" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const [updated] = await db
      .update(invoiceRanges)
      .set(updateData)
      .where(eq(invoiceRanges.id, id))
      .returning();

    return new Response(
      JSON.stringify({ message: "Rango actualizado correctamente", data: updated }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error al actualizar rango:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor", details: error?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
