/**
 * deposit.store.svelte.ts
 *
 * Svelte 5 runes store for the deposit form — mirrors the pattern established
 * by withdraw.store.svelte.ts so both forms are consistent.
 *
 * Extracted from DepositForm.svelte so the component becomes a thin template
 * that delegates all logic here.
 */

import { actions, isInputError } from "astro:actions";
import type { SelectTransactionCategories } from "@/db/schema";
import {
    getInvoicePreview,
    needsInvoice,
    parseTalonarioError,
    type ConceptWithRange,
    type InvoicePreview,
    type TalonarioError,
} from "@/lib/finance/invoice-range.utils.ts";

export interface DepositResponse {
    success: boolean;
    message: string;
    transaction: {
        id: string;
        amount: string;
        concept: string;
        reference: string | null;
        timestamp: string;
    };
    newBalance: string;
}

export function createDepositStore(concepts: SelectTransactionCategories[], defaultCategoryCode = "TRANSFER_IN") {
    let selectedConcept = $state<ConceptWithRange | null>(null);
    let amount = $state("");
    let reference = $state("");
    let searchQuery = $state("");
    let showDropdown = $state(false);
    let highlightedIndex = $state(0);
    let inputErrors = $state<Record<string, string>>({});
    let serverError = $state<string | null>(null);
    let talonarioError = $state<TalonarioError | null>(null);
    let successMessage = $state<DepositResponse | null>(null);
    let isSubmitting = $state(false);

    // ── Derived ──────────────────────────────────────────────────────────────
    let filteredConcepts = $derived.by(() => {
        if (!searchQuery.trim()) return concepts;
        const q = searchQuery.toLowerCase();
        return concepts.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.description?.toLowerCase().includes(q),
        );
    });

    let quickConcepts = $derived.by(() => {
        const items = concepts.slice(0, 6);
        if (items.length >= 6) return items;
        return [
            ...items,
            ...Array.from({ length: 6 - items.length }, (_, i) => ({
                id: `placeholder-${i}`,
                name: "Sin cuenta",
                description: null,
                icon: null,
                type: "income",
            })) as SelectTransactionCategories[],
        ];
    });

    let invoicePreview = $derived<InvoicePreview | null>(
        getInvoicePreview(selectedConcept),
    );

    let showInvoiceField = $derived(needsInvoice(selectedConcept));

    let canSubmit = $derived(
        !!selectedConcept && !!amount && parseFloat(amount) > 0 && !isSubmitting,
    );

    // ── Concept actions ──────────────────────────────────────────────────────
    function selectConcept(option: SelectTransactionCategories) {
        selectedConcept = option as ConceptWithRange;
        reference = "";
        talonarioError = null;
        searchQuery = "";
        showDropdown = false;
        highlightedIndex = 0;
    }

    function clearConcept() {
        selectedConcept = null;
        reference = "";
        talonarioError = null;
        searchQuery = "";
        highlightedIndex = 0;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (!showDropdown || filteredConcepts.length === 0) {
            if ((e.key === "Enter" || e.key === "Tab") && !selectedConcept) {
                e.preventDefault();
                if (filteredConcepts.length > 0) selectConcept(filteredConcepts[0]);
            }
            return;
        }
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, filteredConcepts.length - 1);
                break;
            case "ArrowUp":
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                break;
            case "Enter":
                e.preventDefault();
                if (filteredConcepts[highlightedIndex]) selectConcept(filteredConcepts[highlightedIndex]);
                break;
            case "Tab":
                e.preventDefault();
                if (filteredConcepts.length > 0) selectConcept(filteredConcepts[highlightedIndex]);
                else showDropdown = false;
                break;
            case "Escape":
                e.preventDefault();
                showDropdown = false;
                break;
        }
    }

    function onClickOutside(e: MouseEvent) {
        if (!(e.target as HTMLElement).closest("[data-dropdown-container]")) {
            showDropdown = false;
        }
    }

    // ── Form submit ──────────────────────────────────────────────────────────
    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;
        talonarioError = null;

        if (!selectedConcept) {
            inputErrors.concept = "Debe seleccionar una cuenta";
            return;
        }

        const fd = new FormData();
        fd.append("categoryId", selectedConcept.id);
        fd.append("amount", amount);

        if (invoicePreview && needsInvoice(selectedConcept)) {
            // Active range — server resolves atomically, do NOT also send reference
            fd.append("invoiceRangeId", invoicePreview.rangeId);
        } else if (reference.trim()) {
            fd.append("reference", reference.trim());
        }

        isSubmitting = true;
        try {
            const result = await actions.finance.deposit(fd);

            if (isInputError(result?.error)) {
                const fieldErrors = result.error.fields;
                for (const [field, errs] of Object.entries(fieldErrors)) {
                    inputErrors[field] = Array.isArray(errs)
                        ? errs.join(", ")
                        : String(errs);
                }
                return;
            }

            if (result?.error) {
                // Try to parse a structured talonario error first
                const tErr = parseTalonarioError(result.error.message);
                if (tErr) {
                    talonarioError = tErr;
                    return;
                }
                serverError = result.error.message || "Error al procesar el depósito";
                return;
            }

            if (result?.data?.success) {
                successMessage = result.data as DepositResponse;
            }
        } catch (err) {
            serverError = err instanceof Error ? err.message : "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    function resetForm() {
        selectedConcept = null;
        amount = "";
        reference = "";
        searchQuery = "";
        highlightedIndex = 0;
        inputErrors = {};
        serverError = null;
        talonarioError = null;
    }

    return {
        // state
        get selectedConcept() { return selectedConcept; },
        get amount() { return amount; },
        set amount(v) { amount = v; },
        get reference() { return reference; },
        set reference(v) { reference = v; },
        get searchQuery() { return searchQuery; },
        set searchQuery(v) { searchQuery = v; },
        get showDropdown() { return showDropdown; },
        set showDropdown(v) { showDropdown = v; },
        get highlightedIndex() { return highlightedIndex; },
        get inputErrors() { return inputErrors; },
        get serverError() { return serverError; },
        set serverError(v) { serverError = v; },
        get talonarioError() { return talonarioError; },
        set talonarioError(v) { talonarioError = v; },
        get successMessage() { return successMessage; },
        get isSubmitting() { return isSubmitting; },
        // derived
        get filteredConcepts() { return filteredConcepts; },
        get quickConcepts() { return quickConcepts; },
        get invoicePreview() { return invoicePreview; },
        get showInvoiceField() { return showInvoiceField; },
        get canSubmit() { return canSubmit; },
        // actions
        selectConcept,
        clearConcept,
        handleKeyDown,
        onClickOutside,
        handleSubmit,
        resetForm,
    };
}
