// src/lib/stores/withdrawOverdraft.store.svelte.ts
// Wraps createWithdrawStore — adds debt-confirm state.
// WithdrawForm stays UNTOUCHED. Use WithdrawOverdraftForm.svelte instead.

import { actions, isInputError } from "astro:actions";
import type { SelectCashbox, SelectTransactionCategories } from "@/db/schema";
import { createWithdrawStore } from "./withdraw.store.svelte";

export interface DebtConfirmState {
    available:   number;
    requested:   number;
    deficit:     number;
    cashboxName: string;
}

// Sentinel prefix the action embeds in the error message
const INSUFFICIENT_PREFIX = "__INSUFFICIENT_FUNDS__";

function parseInsufficientFundsMessage(msg: string): DebtConfirmState | null {
    if (!msg.startsWith(INSUFFICIENT_PREFIX)) return null;
    const [, available, requested, deficit, cashboxName] = msg.split(":");
    return {
        available:   parseFloat(available),
        requested:   parseFloat(requested),
        deficit:     parseFloat(deficit),
        cashboxName: cashboxName ?? "Caja",
    };
}

export function createWithdrawOverdraftStore(
    cashboxes: SelectCashbox[],
    concepts:  SelectTransactionCategories[],
) {
    // Base store — all original logic lives here
    const base = createWithdrawStore(cashboxes, concepts);

    // ── Additional overdraft state ────────────────────────────────────────────
    let debtConfirm    = $state<DebtConfirmState | null>(null);
    let isSubmitting   = $state(false); // shadow — we need our own for overdraft path

    // ── Override confirmWithdraw ──────────────────────────────────────────────
    // First attempt uses the normal `withdraw` action.
    // If insufficient → parse the error → show debt dialog instead of error banner.
    async function confirmWithdraw() {
        // Let base handle the normal path first
        // We monkey-patch by calling the normal action ourselves here
        // so we can intercept before base sets serverError.

        const fd = new FormData();
        fd.append("cashboxId",  base.cashboxId);
        fd.append("categoryId", base.selectedConcept!.id);
        fd.append("amount",     base.amount);

        const trimmedRef    = base.reference.trim();
        const generatedNotes = base.selectedConcept
            ? `Egreso: ${base.selectedConcept.name}${trimmedRef ? ` (${trimmedRef})` : ""}`
            : "Egreso";
        fd.append("notes", generatedNotes);

        if (base.authorizedBy.trim()) fd.append("authorizedBy", base.authorizedBy.trim());

        if (base.invoicePreview && base.showInvoiceField) {
            fd.append("invoiceRangeId", base.invoicePreview.rangeId);
        } else if (trimmedRef) {
            fd.append("reference", trimmedRef);
        }

        // Close the normal confirm dialog, enter our submitting state
        base.cancelConfirm();
        isSubmitting = true;
        base.serverError = null;

        try {
            const result = await actions.finance.withdraw(fd);

            if (isInputError(result?.error)) {
                const fieldErrors = result.error.fields;
                for (const [field, errs] of Object.entries(fieldErrors)) {
                    // @ts-ignore
                    base.inputErrors[field] = Array.isArray(errs) ? errs.join(", ") : String(errs);
                }
                return;
            }

            if (result?.error) {
                const parsed = parseInsufficientFundsMessage(result.error.message ?? "");
                if (parsed) {
                    // Show debt dialog instead of error banner
                    debtConfirm = parsed;
                    return;
                }
                base.serverError = result.error.message ?? "Error al procesar el egreso.";
                return;
            }

            if (result?.data?.success) {
                // @ts-ignore — successMessage setter is internal to base store
                // We re-use the base success shape
                base.successMessage = result.data as any;
            }
        } catch (err) {
            base.serverError = err instanceof Error ? err.message : "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    // ── Debt dialog actions ───────────────────────────────────────────────────
    function cancelDebt() {
        debtConfirm = null;
    }

    async function confirmDebt() {
        if (!debtConfirm || !base.selectedConcept) return;

        const fd = new FormData();
        fd.append("cashboxId",  base.cashboxId);
        fd.append("categoryId", base.selectedConcept.id);
        fd.append("amount",     base.amount);

        const trimmedRef     = base.reference.trim();
        const generatedNotes = `Egreso (con deuda): ${base.selectedConcept.name}${trimmedRef ? ` (${trimmedRef})` : ""}`;
        fd.append("notes", generatedNotes);

        if (base.authorizedBy.trim()) fd.append("authorizedBy", base.authorizedBy.trim());

        if (base.invoicePreview && base.showInvoiceField) {
            fd.append("invoiceRangeId", base.invoicePreview.rangeId);
        } else if (trimmedRef) {
            fd.append("reference", trimmedRef);
        }

        isSubmitting = true;
        base.serverError = null;

        try {
            const result = await actions.finance.withdrawOverdraft(fd);

            if (result?.error) {
                debtConfirm  = null;
                base.serverError = result.error.message ?? "Error al registrar la deuda.";
                return;
            }

            if (result?.data?.success) {
                debtConfirm = null;
                base.successMessage = result.data as any;
            }
            // AFTER
        } catch (err: any) {
            const msg = err?.message ?? "";
            const parsed = parseInsufficientFundsMessage(msg);
            if (parsed) {
                debtConfirm = parsed;
            } else {
                base.serverError = msg || "Error inesperado.";
            }
        } finally {
            isSubmitting = false;
        }
    }

    return {
        // ── Spread base store ────────────────────────────────────────────────
        get cashboxId()        { return base.cashboxId; },
        set cashboxId(v)       { base.cashboxId = v; },
        get selectedConcept()  { return base.selectedConcept; },
        get amount()           { return base.amount; },
        set amount(v)          { base.amount = v; },
        get authorizedBy()     { return base.authorizedBy; },
        set authorizedBy(v)    { base.authorizedBy = v; },
        get reference()        { return base.reference; },
        set reference(v)       { base.reference = v; },
        get searchQuery()      { return base.searchQuery; },
        set searchQuery(v)     { base.searchQuery = v; },
        get showDropdown()     { return base.showDropdown; },
        set showDropdown(v)    { base.showDropdown = v; },
        get highlightedIndex() { return base.highlightedIndex; },
        get inputErrors()      { return base.inputErrors; },
        get serverError()      { return base.serverError; },
        set serverError(v)     { base.serverError = v; },
        get successMessage()   { return base.successMessage; },
        get showConfirmDialog(){ return base.showConfirmDialog; },
        get filteredConcepts() { return base.filteredConcepts; },
        get quickConcepts()    { return base.quickConcepts; },
        get selectedCashbox()  { return base.selectedCashbox; },
        get invoicePreview()   { return base.invoicePreview; },
        get showInvoiceField() { return base.showInvoiceField; },
        get talonarioBanner()  { return base.talonarioBanner; },
        get canSubmit()        { return base.canSubmit; },
        // ── Overdraft-only ───────────────────────────────────────────────────
        get debtConfirm()      { return debtConfirm; },
        get isSubmitting()     { return isSubmitting; },
        // ── Actions ──────────────────────────────────────────────────────────
        selectConcept:        base.selectConcept,
        clearConcept:         base.clearConcept,
        handleKeyDown:        base.handleKeyDown,
        onClickOutside:       base.onClickOutside,
        handleInitialSubmit:  base.handleInitialSubmit,
        // override confirm:
        confirmWithdraw,
        cancelConfirm:        base.cancelConfirm,
        cancelDebt,
        confirmDebt,
        resetForm:            base.resetForm,
    };
}
