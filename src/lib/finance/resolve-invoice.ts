/**
 * resolve-invoice.ts
 *
 * Single source of truth for invoice-range resolution on the server.
 * Called by both deposit and withdraw actions.
 *
 * Gate: category.invoiceRangeId === null → skip all invoice logic.
 *
 * This correctly handles:
 *   INC-* with range assigned  → validates + increments range
 *   INC-* with no range        → throws TALONARIO_MISSING
 *   OUT-*, TRANSFER*, CONT...  → invoiceRangeId always null → passes through
 */

import { ActionError } from "astro:actions";
import { db } from "@/db";
import { invoiceRanges } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface Category {
    name: string;
    code: string;
    type: string;
    invoiceRangeId: string | null;
}

interface ResolveOptions {
    manualReference?: string | null;
    invoiceRangeId?: string | null;
}

interface ResolveResult {
    reference: string | null;
    rangeIdToIncrement: string | null;
}

/**
 * Server-side mirror of the client needsInvoice() rule.
 * Must stay in sync with invoice-range.utils.ts.
 */
function categoryNeedsInvoice(category: Category): boolean {
    return category.type === "income" && category.code !== "TRANSFER_IN";
}

export async function resolveInvoiceReference(
    category: Category,
    options: ResolveOptions,
): Promise<ResolveResult> {
    const { manualReference, invoiceRangeId } = options;

    // ── Pass-through: outcome categories, TRANSFER_IN, CONTRATISTA ──────────
    if (!categoryNeedsInvoice(category)) {
        return { reference: manualReference?.trim() || null, rangeIdToIncrement: null };
    }

    // ── Income category with no range assigned ───────────────────────────────
    if (!category.invoiceRangeId) {
        throw new ActionError({
            code: "BAD_REQUEST",
            message: JSON.stringify({
                type: "TALONARIO_MISSING",
                categoryName: category.name,
                talonarioHref: "/talonarios",
            }),
        });
    }

    // ── Validate client-supplied rangeId matches the category ────────────────
    if (invoiceRangeId && category.invoiceRangeId !== invoiceRangeId) {
        throw new ActionError({
            code: "BAD_REQUEST",
            message: "El talonario no corresponde a la cuenta seleccionada.",
        });
    }

    const rangeId = invoiceRangeId ?? category.invoiceRangeId;

    const [range] = await db
        .select()
        .from(invoiceRanges)
        .where(and(eq(invoiceRanges.id, rangeId), eq(invoiceRanges.isActive, true)));

    if (!range) {
        throw new ActionError({
            code: invoiceRangeId ? "NOT_FOUND" : "BAD_REQUEST",
            message: invoiceRangeId
                ? "El talonario seleccionado no existe o está inactivo."
                : `El talonario asignado a "${category.name}" no está activo. Active el talonario o asigne uno nuevo.`,
        });
    }

    const next = range.current + 1;
    if (next > range.rangeEnd) {
        throw new ActionError({
            code: "BAD_REQUEST",
            message: JSON.stringify({
                type: "TALONARIO_EXHAUSTED",
                categoryName: category.name,
                rangeEnd: range.rangeEnd,
                talonarioHref: "/talonarios",
            }),
        });
    }

    const reference = range.prefix ? `${range.prefix}-${next}` : String(next);
    return { reference, rangeIdToIncrement: rangeId };
}
