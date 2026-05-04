import { actions, isInputError } from "astro:actions";
import type { SelectCashbox, SelectTransactionCategories } from "@/db/schema";
import {
    needsInvoice,
    getInvoicePreview,
    isTalonarioExhausted,
    type ConceptWithRange,
} from "@/lib/finance/invoice-range.utils.ts";

export interface WithdrawResponse {
    success: boolean;
    message: string;
    transaction: {
        id: string;
        amount: string;
        concept: string;
        reference: string | null;
        authorizedBy?: string;
        timestamp: string;
    };
    newBalance: string;
}

export interface TalonarioBannerState {
    type: "exhausted" | "missing";
    categoryName: string;
    rangeEnd?: number;
}

export function createWithdrawStore(cashboxes: SelectCashbox[], concepts: SelectTransactionCategories[], defaultCategoryCode = "TRANSFER") {
    // ── State ────────────────────────────────────────────────────────────────
    let selectedConcept = $state<ConceptWithRange | null>(null);
    let cashboxId = $state<string>(
        cashboxes.find((c) => c.code === "GEN")?.id ?? cashboxes[0]?.id ?? "",
    );
    let amount = $state("");
    let authorizedBy = $state("");
    let reference = $state("");
    let searchQuery = $state("");
    let showDropdown = $state(false);
    let highlightedIndex = $state(0);
    let inputErrors = $state<Record<string, string>>({});
    let serverError = $state<string | null>(null);
    let successMessage = $state<WithdrawResponse | null>(null);
    let isSubmitting = $state(false);
    let showConfirmDialog = $state(false);

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
                type: "outcome",
            })) as SelectTransactionCategories[],
        ];
    });

    let selectedCashbox = $derived(
        cashboxes.find((c) => c.id === cashboxId) ?? null,
    );

    let invoicePreview = $derived(getInvoicePreview(selectedConcept as ConceptWithRange));

    let showInvoiceField = $derived(needsInvoice(selectedConcept as ConceptWithRange));

    /**
     * Proactive banner: shown immediately after concept selection
     * when the concept needs a talonario but it is missing or exhausted.
     * Does NOT wait for submit — surfaces the issue right away.
     */
    let talonarioBanner = $derived.by((): TalonarioBannerState | null => {
        if (!selectedConcept || !needsInvoice(selectedConcept as ConceptWithRange)) return null;
        if (!selectedConcept.invoiceRangeId) {
            return { type: "missing", categoryName: selectedConcept.name };
        }
        if (isTalonarioExhausted(selectedConcept as ConceptWithRange)) {
            return {
                type: "exhausted",
                categoryName: selectedConcept.name,
                rangeEnd: selectedConcept.invoiceRangeEnd ?? undefined,
            };
        }
        return null;
    });

    let canSubmit = $derived(
        !!selectedConcept && !!amount && parseFloat(amount) > 0 && !isSubmitting,
    );

    // ── Concept actions ──────────────────────────────────────────────────────
    function selectConcept(option: SelectTransactionCategories) {
        selectedConcept = option as ConceptWithRange;
        reference = "";
        searchQuery = "";
        showDropdown = false;
        highlightedIndex = 0;
    }

    function clearConcept() {
        selectedConcept = null;
        reference = "";
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

    // ── Form submit flow ─────────────────────────────────────────────────────
    function handleInitialSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;
        if (!cashboxId) { inputErrors.cashboxId = "Seleccione una caja"; return; }
        if (!selectedConcept) { inputErrors.concept = "Debe seleccionar una cuenta"; return; }
        if (!amount || parseFloat(amount) <= 0) { inputErrors.amount = "Monto debe ser mayor a 0"; return; }
        showConfirmDialog = true;
    }

    async function confirmWithdraw() {
        showConfirmDialog = false;
        isSubmitting = true;
        serverError = null;

        const fd = new FormData();
        fd.append("cashboxId", cashboxId);
        fd.append("categoryId", selectedConcept!.id);
        fd.append("amount", amount);

        const trimmedReference = reference.trim();
        const generatedNotes = selectedConcept
            ? `Egreso: ${selectedConcept.name}${trimmedReference ? ` (${trimmedReference})` : ""}`
            : "Egreso";
        fd.append("justification", generatedNotes);

        if (authorizedBy.trim()) fd.append("authorizedBy", authorizedBy.trim());

        if (invoicePreview && showInvoiceField) {
            fd.append("invoiceRangeId", invoicePreview.rangeId);
        } else if (trimmedReference) {
            fd.append("externalReference", trimmedReference);
        }

        try {
            const result = await actions.finance.withdraw(fd);

            if (isInputError(result?.error)) {
                const fieldErrors = result.error.fields;
                for (const [field, errs] of Object.entries(fieldErrors)) {
                    inputErrors[field] = Array.isArray(errs) ? errs.join(", ") : String(errs);
                }
                return;
            }
            if (result?.error) {
                serverError = result.error.message || "Error al procesar el retiro";
                return;
            }
            if (result?.data?.success) {
                successMessage = result.data as WithdrawResponse;
            }
        } catch (err) {
            serverError = err instanceof Error ? err.message : "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    function cancelConfirm() { showConfirmDialog = false; }

    function resetForm() {
        selectedConcept = null;
        amount = "";
        authorizedBy = "";
        reference = "";
        searchQuery = "";
        highlightedIndex = 0;
        inputErrors = {};
        serverError = null;
        cashboxId = cashboxes.find((c) => c.code === "GEN")?.id ?? cashboxes[0]?.id ?? "";
    }

    return {
        get cashboxId() { return cashboxId; },
        set cashboxId(v) { cashboxId = v; },
        get selectedConcept() { return selectedConcept; },
        get amount() { return amount; },
        set amount(v) { amount = v; },
        get authorizedBy() { return authorizedBy; },
        set authorizedBy(v) { authorizedBy = v; },
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
        get successMessage() { return successMessage; },
        get isSubmitting() { return isSubmitting; },
        get showConfirmDialog() { return showConfirmDialog; },
        // derived
        get filteredConcepts() { return filteredConcepts; },
        get quickConcepts() { return quickConcepts; },
        get selectedCashbox() { return selectedCashbox; },
        get invoicePreview() { return invoicePreview; },
        get showInvoiceField() { return showInvoiceField; },
        get talonarioBanner() { return talonarioBanner; },
        get canSubmit() { return canSubmit; },
        // actions
        selectConcept,
        clearConcept,
        handleKeyDown,
        onClickOutside,
        handleInitialSubmit,
        confirmWithdraw,
        cancelConfirm,
        resetForm,
    };
}
