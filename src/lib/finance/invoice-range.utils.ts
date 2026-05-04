/**
 * invoice-range.utils.ts
 *
 * Pure client-side helpers for talonario (invoice range) logic.
 * Shared between DepositForm, WithdrawForm, and any future form.
 *
 * Single rule: invoiceRangeId !== null is the gate.
 *   - INC-* with a range assigned  → needs invoice
 *   - INC-* with no range assigned → needs invoice but is MISSING (show banner)
 *   - OUT-*, TRANSFER, TRANSFER_IN → invoiceRangeId always null → skip invoice
 *
 * No requiresInvoice column, no isSystem check — the FK alone is the truth.
 */

import type { SelectTransactionCategories } from "@/db/schema";

// ─── Extended type ────────────────────────────────────────────────────────────
// Page queries join invoice_ranges alongside transaction_categories.
// Both forms receive this shape.

export type ConceptWithRange = SelectTransactionCategories & {
    invoiceRangeId?: string | null;
    invoiceRangePrefix?: string | null;
    invoiceRangeCurrent?: number | null;
    invoiceRangeEnd?: number | null;
    invoiceRangeIsActive?: boolean | null;
};

// ─── Core gate ────────────────────────────────────────────────────────────────

/**
 * Returns true when the concept is an income category that is meant to use
 * invoice ranges (i.e. its invoiceRangeCode was non-null at seed time).
 *
 * On the client we can't read invoiceRangeCode (seed-only), so we use the
 * category type as the discriminator: only "income" categories ever get
 * ranges assigned. OUT-*, TRANSFER, TRANSFER_IN, CONTRATISTA are all
 * "outcome" or have invoiceRangeId permanently null.
 *
 * More precisely: a concept needs invoice handling if it is type "income"
 * AND it is NOT one of the system pass-through codes (TRANSFER_IN).
 * The cleanest proxy without a DB column: invoiceRangeId is set OR the
 * category type is "income" and code doesn't start with a known bypass prefix.
 *
 * Simplest correct rule that matches your data:
 *   type === "income" && code !== "TRANSFER_IN"
 *
 * This correctly handles:
 *   INC-001 … INC-021  → true  (have ranges or need them)
 *   TRANSFER_IN         → false (income but system pass-through, no range ever)
 *   OUT-001 … OUT-021  → false (outcome, never needs range)
 *   TRANSFER            → false (outcome)
 *   CONTRATISTA         → false (outcome)
 */
export function needsInvoice(concept: ConceptWithRange | null): boolean {
    if (!concept) return false;
    return !!concept.invoiceRangeId;
}

// ─── Invoice preview ──────────────────────────────────────────────────────────

export interface InvoicePreview {
    rangeId: string;
    nextNumber: number;
    label: string;
}

/**
 * Returns the next invoice label when the concept has an active, non-exhausted
 * range assigned. Returns null when:
 *   - concept doesn't need an invoice (OUT-*, TRANSFER_IN, etc.)
 *   - no range assigned yet (shows the TALONARIO_MISSING banner)
 *   - range is inactive or exhausted
 */
export function getInvoicePreview(
    concept: ConceptWithRange | null,
): InvoicePreview | null {
    if (!needsInvoice(concept)) return null;
    if (!concept!.invoiceRangeId || !concept!.invoiceRangeIsActive) return null;

    const next = Number(concept!.invoiceRangeCurrent) + 1;
    if (next > Number(concept!.invoiceRangeEnd)) return null; // exhausted

    const label = concept!.invoiceRangePrefix
        ? `${concept!.invoiceRangePrefix}-${next}`
        : String(next);

    return { rangeId: concept!.invoiceRangeId, nextNumber: next, label };
}

/**
 * Returns true when a concept needs an invoice but its range is fully used up.
 * Used to show the amber "Talonario agotado" warning in the UI.
 */
export function isTalonarioExhausted(concept: ConceptWithRange | null): boolean {
    if (!needsInvoice(concept)) return false;
    if (!concept!.invoiceRangeId) return false;
    if (!concept!.invoiceRangeIsActive) return true;
    const next = Number(concept!.invoiceRangeCurrent) + 1;
    return next > Number(concept!.invoiceRangeEnd);
}

// ─── Talonario error (from server ActionError) ────────────────────────────────

export type TalonarioErrorType = "TALONARIO_EXHAUSTED" | "TALONARIO_MISSING";

export interface TalonarioError {
    type: TalonarioErrorType;
    categoryName: string;
    rangeEnd?: number;
    talonarioHref: string;
}

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
