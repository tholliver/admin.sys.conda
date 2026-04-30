<script lang="ts">
    import { fade } from "svelte/transition";
    import type { SelectCashbox, SelectTransactionCategories } from "@/db/schema";
    import { CircleAlert, CircleCheck, Minus, TriangleAlert, X } from "@lucide/svelte";
    import Dialog from "@/components/svelte/Dialog.svelte";
    import AmountInput from "./AmountInput.svelte";
    import { formatBOB } from "@/utils/formatters";
    import { createWithdrawOverdraftStore } from "@/lib/stores/withdrawOverdraft.store.svelte";
    import TransactionSuccess from "./TransactionSuccess.svelte";
    import CashboxPicker     from "./withdraw/CashboxPicker.svelte";
    import ConceptPicker     from "./withdraw/ConceptPicker.svelte";
    import InvoiceBookBanner from "./InvoiceBookBanner.svelte";
    import OverdraftConfirmDialog from "./OverdraftConfirmDialog.svelte";

    interface Props {
        concepts:  SelectTransactionCategories[];
        cashboxes: SelectCashbox[];
    }

    let { concepts, cashboxes }: Props = $props();

    const w = createWithdrawOverdraftStore(cashboxes, concepts);
</script>

<svelte:window onclick={w.onClickOutside} />

{#if w.successMessage}
    <TransactionSuccess
        amount={w.successMessage.transaction.amount}
        concept={w.successMessage.transaction.concept}
        reference={w.successMessage.transaction.reference}
        transactionId={w.successMessage.transaction.id}
        newBalance={w.successMessage.newBalance}
        authorizedBy={w.successMessage.transaction.authorizedBy}
        color="red"
        registerAnotherHref="/egresos"
        printBack="/egresos"
    />
{:else}
    <!-- Server error banner -->
    {#if w.serverError}
        <div class="mb-6 flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-200">
            <CircleAlert class="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div class="flex-1">
                <h3 class="font-semibold text-red-900">Error</h3>
                <p class="text-sm text-red-700">{w.serverError}</p>
            </div>
            <button type="button" onclick={() => (w.serverError = null)} class="text-red-600 hover:text-red-800">
                <X class="h-4 w-4" />
            </button>
        </div>
    {/if}

    <!-- ── Normal confirm dialog (unchanged) ──────────────────────────────── -->
    {#if w.showConfirmDialog}
        <Dialog
            isOpen={true}
            onClose={w.cancelConfirm}
            size="md"
            showCloseButton={false}
            testId="withdraw-confirm-dialog"
        >
            {#snippet header()}
                <div class="flex items-start gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                        <TriangleAlert class="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900">Confirmar Egreso</h2>
                        <p class="text-sm text-slate-600 mt-1">Revise los detalles antes de confirmar</p>
                    </div>
                </div>
            {/snippet}

            <div class="space-y-4">
                <div class="bg-slate-50 rounded-lg p-4 space-y-2.5">
                    <div class="flex justify-between items-start">
                        <span class="text-sm text-slate-600">Caja:</span>
                        <span class="text-sm font-medium text-slate-900">{w.selectedCashbox?.name}</span>
                    </div>
                    <div class="flex justify-between items-start">
                        <span class="text-sm text-slate-600">Cuenta:</span>
                        <div class="text-right">
                            <p class="text-sm font-medium text-slate-900">{w.selectedConcept?.name}</p>
                            {#if w.selectedConcept?.description}
                                <p class="text-xs text-slate-500">{w.selectedConcept.description}</p>
                            {/if}
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-slate-600">Monto:</span>
                        <span class="text-lg font-bold text-red-600">{formatBOB(w.amount)}</span>
                    </div>
                    {#if w.reference}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600">Referencia:</span>
                            <span class="text-sm font-medium text-slate-900">{w.reference}</span>
                        </div>
                    {/if}
                    {#if w.authorizedBy}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600">Autorizado por:</span>
                            <span class="text-sm font-medium text-slate-900">{w.authorizedBy}</span>
                        </div>
                    {/if}
                </div>
            </div>

            {#snippet footer()}
                <button
                    type="button"
                    onclick={w.cancelConfirm}
                    disabled={w.isSubmitting}
                    class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onclick={w.confirmWithdraw}
                    disabled={w.isSubmitting}
                    class="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {#if w.isSubmitting}
                        <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Procesando...
                    {:else}
                        Confirmar Egreso
                    {/if}
                </button>
            {/snippet}
        </Dialog>
    {/if}

    <!-- ── Debt confirm dialog ─────────────────────────────────────────────── -->
    {#if w.debtConfirm}
        <OverdraftConfirmDialog
            cashboxName={w.debtConfirm.cashboxName}
            concept={w.selectedConcept?.name ?? "Egreso"}
            available={w.debtConfirm.available}
            requested={w.debtConfirm.requested}
            deficit={w.debtConfirm.deficit}
            isSubmitting={w.isSubmitting}
            onConfirm={w.confirmDebt}
            onCancel={w.cancelDebt}
        />
    {/if}

    <!-- ── Form (identical to WithdrawForm) ───────────────────────────────── -->
    <form method="POST" onsubmit={w.handleInitialSubmit} class="space-y-5">
        <CashboxPicker
            {cashboxes}
            selected={w.cashboxId}
            onSelect={(id) => (w.cashboxId = id)}
            error={w.inputErrors.cashboxId}
        />

        <ConceptPicker
            {concepts}
            quickConcepts={w.quickConcepts}
            filteredConcepts={w.filteredConcepts}
            selected={w.selectedConcept}
            invoicePreview={w.invoicePreview}
            searchQuery={w.searchQuery}
            showDropdown={w.showDropdown}
            highlightedIndex={w.highlightedIndex}
            error={w.inputErrors.concept}
            onSelect={w.selectConcept}
            onClear={w.clearConcept}
            onSearchInput={(v) => { w.searchQuery = v; w.showDropdown = true; }}
            onFocus={() => (w.showDropdown = true)}
            onKeyDown={w.handleKeyDown}
        />

        {#if w.talonarioBanner}
            <InvoiceBookBanner
                type={w.talonarioBanner.type}
                categoryName={w.talonarioBanner.categoryName}
                rangeEnd={w.talonarioBanner.rangeEnd}
            />
        {/if}

        <div>
            <AmountInput
                bind:value={w.amount}
                accentColor="red"
                id="amount"
                name="amount"
                error={w.inputErrors.amount}
            />

            <!-- Proactive balance warning -->
            {#if w.selectedCashbox && w.amount && parseFloat(w.amount) > parseFloat(String(w.selectedCashbox.balance ?? "0"))}
                <div in:fade={{ duration: 150 }} class="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <TriangleAlert class="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p class="text-xs text-amber-800">
                        El monto supera el saldo disponible
                        (<span class="font-semibold">{formatBOB(String(w.selectedCashbox.balance ?? "0"))}</span>).
                        Se te pedirá confirmar la deuda.
                    </p>
                </div>
            {/if}

            {#if w.inputErrors.amount}
                <p class="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{w.inputErrors.amount}
                </p>
            {/if}
        </div>

        {#if !w.showInvoiceField || !w.invoicePreview}
            <div>
                <label for="reference" class="block text-sm font-medium text-slate-700 mb-2">
                    Referencia <span class="text-slate-500 text-xs">(Opcional)</span>
                </label>
                <input
                    id="reference"
                    bind:value={w.reference}
                    type="text"
                    placeholder="Ej: Número de comprobante, talonario"
                    class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition"
                />
            </div>
        {/if}

        <button
            type="submit"
            disabled={!w.canSubmit}
            class="w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700 active:bg-red-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <Minus class="h-5 w-5" />
            {w.isSubmitting ? "Procesando..." : "Registrar Egreso"}
        </button>
    </form>
{/if}
