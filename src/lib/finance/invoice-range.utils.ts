/**
 * invoice-range.utils.ts
 *
 * Pure helpers for talonario (invoice range) logic.
 * Shared between DepositForm, WithdrawForm, and any future form
 * that needs to resolve or display invoice range state.
 */

import type { SelectTransactionCategories } from "@/db/schema";

// ─── Shared extended type ────────────────────────────────────────────────────
// The page queries join invoice_ranges alongside transaction_categories.
// Both forms receive this shape; we centralise it here so there's one
// place to update when the schema changes.

export type ConceptWithRange = SelectTransactionCategories & {
    invoiceRangeId?: string | null;
    invoiceRangePrefix?: string | null;
    invoiceRangeCurrent?: number | null;
    invoiceRangeEnd?: number | null;
    invoiceRangeIsActive?: boolean | null;
};

// ─── Invoice preview ─────────────────────────────────────────────────────────

export interface InvoicePreview {
    rangeId: string;
    nextNumber: number;
    label: string;
}

/**
 * Returns the next invoice label for a concept that has an active,
 * non-exhausted range.  Returns null in every other case so callers
 * can fall back to manual reference entry.
 */
export function getInvoicePreview(
    concept: ConceptWithRange | null,
): InvoicePreview | null {
    if (!concept) return null;
    if (!concept.invoiceRangeId || !concept.invoiceRangeIsActive) return null;

    const next = Number(concept.invoiceRangeCurrent) + 1;
    if (next > Number(concept.invoiceRangeEnd)) return null; // exhausted

    const label = concept.invoiceRangePrefix
        ? `${concept.invoiceRangePrefix}-${next}`
        : String(next);

    return { rangeId: concept.invoiceRangeId, nextNumber: next, label };
}

/**
 * Returns true when a concept has a range assigned but it is fully used up.
 * Used to show the amber "Talonario agotado" warning in the UI.
 */
export function isTalonarioExhausted(concept: ConceptWithRange | null): boolean {
    if (!concept?.invoiceRangeId) return false;
    if (!concept.invoiceRangeIsActive) return true; // inactive === treat as exhausted
    const next = Number(concept.invoiceRangeCurrent) + 1;
    return next > Number(concept.invoiceRangeEnd);
}

// ─── Talonario error (from server ActionError) ───────────────────────────────

export type TalonarioErrorType = "TALONARIO_EXHAUSTED" | "TALONARIO_MISSING";

export interface TalonarioError {
    type: TalonarioErrorType;
    categoryName: string;
    rangeEnd?: number;
    talonarioHref: string;
}

/**
 * Attempts to parse a structured talonario error out of an ActionError message.
 * Returns null when the message is not a talonario error, letting the caller
 * fall through to generic error display.
 *
 * Server must throw:
 *   throw new ActionError({
 *     code: "BAD_REQUEST",
 *     message: JSON.stringify({
 *       type: "TALONARIO_EXHAUSTED" | "TALONARIO_MISSING",
 *       categoryName: string,
 *       rangeEnd?: number,
 *       talonarioHref: "/talonarios",
 *     }),
 *   });
 */
export function parseTalonarioError(message: string | undefined | null): TalonarioError | null {
    if (!message) return null;
    try {
        const parsed = JSON.parse(message);
        if (
            parsed &&
            (parsed.type === "TALONARIO_EXHAUSTED" || parsed.type === "TALONARIO_MISSING") &&
            typeof parsed.categoryName === "string"
        ) {
            return parsed as TalonarioError;
        }
    } catch {
        // not JSON
    }
    return null;
}
