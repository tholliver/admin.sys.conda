import { actions, isInputError } from "astro:actions";
import type { SelectCashbox, SelectTransactionCategories } from "@/db/schema";

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

// Extended type that includes the joined invoice-range fields that the
// page query selects alongside the category columns.
type ConceptWithRange = SelectTransactionCategories & {
    invoiceRangeId?: string | null;
    invoiceRangePrefix?: string | null;
    invoiceRangeCurrent?: number | null;
    invoiceRangeEnd?: number | null;
    invoiceRangeIsActive?: boolean | null;
};

export function createWithdrawStore(
    cashboxes: SelectCashbox[],
    concepts: SelectTransactionCategories[],
) {
    // ── State ────────────────────────────────────────────────────────────────
    let cashboxId = $state<string>(
        cashboxes.find((c) => c.code === "GEN")?.id ?? cashboxes[0]?.id ?? "",
    );
    let selectedConcept = $state<ConceptWithRange | null>(null);
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

    /**
     * Derives the next invoice number that will be used when the selected
     * concept has an active, non-exhausted talonario range attached to it.
     * Returns null when no range applies (manual reference entry).
     */
    let invoicePreview = $derived.by(() => {
        if (!selectedConcept) return null;
        const c = selectedConcept as ConceptWithRange;
        if (!c.invoiceRangeId || !c.invoiceRangeIsActive) return null;
        const next = Number(c.invoiceRangeCurrent) + 1;
        if (next > Number(c.invoiceRangeEnd)) return null; // exhausted
        const label = c.invoiceRangePrefix
            ? `${c.invoiceRangePrefix}-${next}`
            : String(next);
        return { rangeId: c.invoiceRangeId, nextNumber: next, label };
    });

    let canSubmit = $derived(
        !!selectedConcept && !!amount && parseFloat(amount) > 0 && !isSubmitting,
    );

    // ── Concept actions ──────────────────────────────────────────────────────
    function selectConcept(option: SelectTransactionCategories) {
        selectedConcept = option as ConceptWithRange;
        // Reset manual reference whenever the concept changes so it does not
        // carry over a stale value from the previous selection.
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

        // Build notes from concept name and optional reference.
        const trimmedReference = reference.trim();
        const generatedNotes = selectedConcept
            ? `Egreso: ${selectedConcept.name}${trimmedReference ? ` (${trimmedReference})` : ""}`
            : "Egreso";
        fd.append("notes", generatedNotes);

        if (authorizedBy.trim()) fd.append("authorizedBy", authorizedBy.trim());

        // ── Invoice range handling ────────────────────────────────────────
        // If the concept has an active range, delegate numbering to the
        // server action (which increments atomically within a DB transaction).
        // Only fall back to manual reference when there is no active range.
        if (invoicePreview) {
            fd.append("invoiceRangeId", invoicePreview.rangeId);
            // Do NOT append reference — the server resolves it from the range.
        } else if (trimmedReference) {
            fd.append("reference", trimmedReference);
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
        // state (getters + setters via $state ref passthrough)
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
