import { db } from "@/db";
import { invoiceRanges } from "@/db/schema";
import { ApiResponseHandler } from "@/core/api-handler";
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return ApiResponseHandler.unauthorized();

  const { id } = params;
  if (!id) return ApiResponseHandler.validationError(["ID requerido"]);

  try {
    const [existing] = await db
      .select({ id: invoiceRanges.id, category: invoiceRanges.category, isSystem: invoiceRanges.isSystem })
      .from(invoiceRanges)
      .where(eq(invoiceRanges.id, id))
      .limit(1);

    if (!existing) return ApiResponseHandler.notFound("Rango de facturación");

    if (existing.isSystem) {
      return ApiResponseHandler.forbidden("Los rangos del sistema no pueden eliminarse");
    }

    const [deleted] = await db
      .delete(invoiceRanges)
      .where(eq(invoiceRanges.id, id))
      .returning();

    return new Response(
      JSON.stringify({ message: "Rango eliminado correctamente", data: deleted }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error al eliminar talonario:", error);
    return ApiResponseHandler.error("Error interno del servidor");
  }
};
