// src/lib/stores/withdrawOverdraft.store.svelte.ts
// Wraps createWithdrawStore — adds user-editable notes.
// WithdrawForm stays UNTOUCHED. Use WithdrawOverdraftForm.svelte instead.

import { actions, isInputError } from "astro:actions";
import type { SelectCashbox, SelectTransactionCategories } from "@/db/schema";
import { createWithdrawStore } from "./withdraw.store.svelte";

export function createWithdrawOverdraftStore(
    cashboxes: SelectCashbox[],
    concepts:  SelectTransactionCategories[],
) {
    // Base store — all original logic lives here
    const base = createWithdrawStore(cashboxes, concepts);

    let isSubmitting = $state(false);
    let notes        = $state("");    // user-editable notes with employee autocomplete

    // ── Helpers ───────────────────────────────────────────────────────────────
    function buildNotes(prefix: string, conceptName: string, trimmedRef: string): string {
        const userNotes = notes.trim();
        if (userNotes) return userNotes;
        return `${prefix}: ${conceptName}${trimmedRef ? ` (${trimmedRef})` : ""}`;
    }

    // ── Override confirmWithdraw ──────────────────────────────────────────────
    async function confirmWithdraw() {
        const fd = new FormData();
        fd.append("cashboxId",  base.cashboxId);
        fd.append("categoryId", base.selectedConcept!.id);
        fd.append("amount",     base.amount);

        const trimmedRef = base.reference.trim();
        fd.append("justification", buildNotes("Egreso", base.selectedConcept?.name ?? "Egreso", trimmedRef));

        if (base.authorizedBy.trim()) fd.append("authorizedBy", base.authorizedBy.trim());

        if (base.invoicePreview && base.showInvoiceField) {
            fd.append("invoiceRangeId", base.invoicePreview.rangeId);
        } else if (trimmedRef) {
            fd.append("externalReference", trimmedRef);
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
                const msg = result.error.message ?? "";
                if (msg.startsWith("__INSUFFICIENT_FUNDS__")) {
                    const [, available, requested, deficit, cashboxName] = msg.split(":");
                    base.serverError = `Saldo insuficiente en ${cashboxName}. Disponible: Bs ${available}. Requerido: Bs ${requested}. Déficit: Bs ${deficit}.`;
                } else {
                    base.serverError = msg;
                }
                return;
            }

            if (result?.data?.success) {
                // @ts-ignore
                base.successMessage = result.data as any;
            }
        } catch (err) {
            base.serverError = err instanceof Error ? err.message : "Error inesperado.";
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
        set successMessage(v)  { base.successMessage = v; },
        get showConfirmDialog(){ return base.showConfirmDialog; },
        get filteredConcepts() { return base.filteredConcepts; },
        get quickConcepts()    { return base.quickConcepts; },
        get selectedCashbox()  { return base.selectedCashbox; },
        get invoicePreview()   { return base.invoicePreview; },
        get showInvoiceField() { return base.showInvoiceField; },
        get talonarioBanner()  { return base.talonarioBanner; },
        get canSubmit()        { return base.canSubmit; },
        // ── Notes (employee autocomplete) ────────────────────────────────────
        get notes()            { return notes; },
        set notes(v)           { notes = v; },
        get isSubmitting()     { return isSubmitting; },
        // ── Actions ──────────────────────────────────────────────────────────
        selectConcept:        base.selectConcept,
        clearConcept:         base.clearConcept,
        handleKeyDown:        base.handleKeyDown,
        onClickOutside:       base.onClickOutside,
        handleInitialSubmit:  base.handleInitialSubmit,
        confirmWithdraw,
        cancelConfirm:        base.cancelConfirm,
        resetForm:            base.resetForm,
    };
}
