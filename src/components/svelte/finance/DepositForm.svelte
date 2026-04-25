<script lang="ts">
    /**
     * DepositForm.svelte
     *
     * Thin orchestrator — all state and logic lives in deposit.store.svelte.ts,
     * mirroring the WithdrawForm pattern.
     */
    import { Plus, CircleAlert, CircleCheck, X } from "@lucide/svelte";
    import type { SelectTransactionCategories } from "@/db/schema";
    import AmountInput from "./AmountInput.svelte";
    import { createDepositStore } from "@/lib/stores/deposit.store.svelte";
    import ConceptPicker from "./withdraw/ConceptPicker.svelte";
    import InvoiceRangeField from "./InvoiceRangeField.svelte";
    import InvoiceBookBanner from "@/components/svelte/finance/InvoiceBookBanner.svelte";
    import TransactionSuccess from "./TransactionSuccess.svelte";

    interface Props {
        concepts: SelectTransactionCategories[];
    }

    let { concepts }: Props = $props();

    const d = createDepositStore(concepts);
</script>

<svelte:window onclick={d.onClickOutside} />

{#if d.successMessage}
    <TransactionSuccess
        amount={d.successMessage.transaction.amount}
        concept={d.successMessage.transaction.concept}
        reference={d.successMessage.transaction.reference}
        transactionId={d.successMessage.transaction.id}
        newBalance={d.successMessage.newBalance}
        color="blue"
        registerAnotherHref="/ingresos"
        printBack="/ingresos"
    />
{:else}
    <!-- ── Server error banner ────────────────────────────────────────────── -->
    {#if d.serverError}
        <div
            class="mb-4 flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-200"
            data-testid="deposit-error-alert"
        >
            <CircleAlert class="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div class="flex-1">
                <h3 class="font-semibold text-red-900">Error</h3>
                <p class="text-sm text-red-700">{d.serverError}</p>
            </div>
            <button
                type="button"
                onclick={() => (d.serverError = null)}
                data-testid="close-error-button"
                class="text-red-600 hover:text-red-800 transition-colors shrink-0"
            >
                <X class="h-4 w-4" />
            </button>
        </div>
    {/if}

    <!-- ── Talonario server error banner ─────────────────────────────────── -->
    {#if d.talonarioError && d.showInvoiceField}
        <div class="mb-4">
            <InvoiceBookBanner
                type={d.talonarioError.type === "TALONARIO_EXHAUSTED" ? "exhausted" : "missing"}
                categoryName={d.talonarioError.categoryName}
                rangeEnd={d.talonarioError.rangeEnd}
                onDismiss={() => (d.talonarioError = null)}
            />
        </div>
    {/if}

    <form onsubmit={d.handleSubmit} data-testid="deposit-form" class="space-y-5">
        <!-- ── Concept picker ─────────────────────────────────────────────── -->
        <ConceptPicker
            {concepts}
            quickConcepts={d.quickConcepts}
            filteredConcepts={d.filteredConcepts}
            selected={d.selectedConcept}
            invoicePreview={d.invoicePreview}
            searchQuery={d.searchQuery}
            showDropdown={d.showDropdown}
            highlightedIndex={d.highlightedIndex}
            error={d.inputErrors.concept ?? d.inputErrors.categoryId}
            accentColor="green"
            onSelect={d.selectConcept}
            onClear={d.clearConcept}
            onSearchInput={(v) => {
                d.searchQuery = v;
                d.showDropdown = true;
            }}
            onFocus={() => (d.showDropdown = true)}
            onKeyDown={d.handleKeyDown}
        />

        <!-- ── Amount ─────────────────────────────────────────────────────── -->
        <div>
            <AmountInput
                bind:value={d.amount}
                accentColor="green"
                id="amount"
                name="amount"
                error={d.inputErrors.amount}
                testid="deposit-amount-input"
            />

            {#if d.inputErrors.amount}
                <p data-testid="amount-input-error" class="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{d.inputErrors.amount}
                </p>
            {/if}
        </div>

        <!-- ── Reference / Talonario field ───────────────────────────────── -->
        {#if d.showInvoiceField}
            <InvoiceRangeField
                value={d.reference}
                onInput={(v) => (d.reference = v)}
                invoicePreview={d.invoicePreview}
                selectedConcept={d.selectedConcept}
                error={d.inputErrors.reference}
                accentColor="green"
            />
        {/if}

        <!-- ── Submit ─────────────────────────────────────────────────────── -->
        <button
            type="submit"
            disabled={!d.canSubmit}
            data-testid="deposit-submit-button"
            class="w-full rounded-lg bg-green-600 py-3 font-semibold text-white
                   hover:bg-green-700 active:bg-green-800 transition-all
                   flex items-center justify-center gap-2
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {#if d.isSubmitting}
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Registrando...
            {:else}
                <Plus class="h-5 w-5" />
                Registrar Ingreso
            {/if}
        </button>
    </form>
{/if}
