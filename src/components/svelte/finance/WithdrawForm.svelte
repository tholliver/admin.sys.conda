<script lang="ts">
    import { fade } from "svelte/transition";
    import {
        CircleAlert,
        CircleCheck,
        Minus,
        TriangleAlert,
        X,
    } from "@lucide/svelte";
    import { noWheel } from "@/lib/form/utils";
    import { formatBOB } from "@/services/finances/helpers";
    import type { SelectTransactionCategories } from "@/db/schema";
    import {
        createWithdrawStore,
        type Cashbox,
    } from "@/lib/stores/withdraw.store.svelte";
    import QuickAmountActions from "./QuickAmountActions.svelte";
    import TransactionSuccess from "./TransactionSuccess.svelte";
    import CashboxPicker from "./withdraw/CashboxPicker.svelte";
    import ConceptPicker from "./withdraw/ConceptPicker.svelte";

    interface Props {
        concepts: SelectTransactionCategories[];
        cashboxes: Cashbox[];
    }

    let { concepts, cashboxes }: Props = $props();

    const w = createWithdrawStore(cashboxes, concepts);
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
        <div
            class="mb-6 flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-200"
            data-testid="withdraw-error-alert"
        >
            <CircleAlert class="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div class="flex-1">
                <h3 class="font-semibold text-red-900">Error</h3>
                <p class="text-sm text-red-700">{w.serverError}</p>
            </div>
            <button
                type="button"
                onclick={() => (w.serverError = null)}
                class="text-red-600 hover:text-red-800 shrink-0"
            >
                <X class="h-4 w-4" />
            </button>
        </div>
    {/if}

    <!-- Confirm dialog -->
    {#if w.showConfirmDialog}
        <div
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            data-testid="confirm-dialog-overlay"
        >
            <div
                class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
                data-testid="confirm-dialog"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.key === "Escape" && w.cancelConfirm()}
                role="dialog"
                aria-modal="true"
                tabindex="0"
            >
                <div class="flex items-start gap-3">
                    <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100"
                    >
                        <TriangleAlert class="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-slate-900">
                            Confirmar Egreso
                        </h3>
                        <p class="text-sm text-slate-600 mt-1">
                            Revise los detalles antes de confirmar
                        </p>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-lg p-4 space-y-2.5">
                    <div class="flex justify-between items-start">
                        <span class="text-sm text-slate-600">Caja:</span>
                        <span class="text-sm font-medium text-slate-900"
                            >{w.selectedCashbox?.name}</span
                        >
                    </div>
                    <div class="flex justify-between items-start">
                        <span class="text-sm text-slate-600">Cuenta:</span>
                        <div class="text-right">
                            <p
                                class="text-sm font-medium text-slate-900"
                                data-testid="confirm-concept"
                            >
                                {w.selectedConcept?.name}
                            </p>
                            {#if w.selectedConcept?.description}
                                <p class="text-xs text-slate-500">
                                    {w.selectedConcept.description}
                                </p>
                            {/if}
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-slate-600">Monto:</span>
                        <span
                            class="text-lg font-bold text-red-600"
                            data-testid="confirm-amount"
                            >{formatBOB(w.amount)}</span
                        >
                    </div>
                    {#if w.reference}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600"
                                >Referencia:</span
                            >
                            <span
                                class="text-sm font-medium text-slate-900"
                                data-testid="confirm-reference"
                                >{w.reference}</span
                            >
                        </div>
                    {/if}
                    {#if w.authorizedBy}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600"
                                >Autorizado por:</span
                            >
                            <span
                                class="text-sm font-medium text-slate-900"
                                data-testid="confirm-authorized-by"
                                >{w.authorizedBy}</span
                            >
                        </div>
                    {/if}
                </div>

                <div class="flex gap-3 pt-2">
                    <button
                        type="button"
                        onclick={w.cancelConfirm}
                        disabled={w.isSubmitting}
                        data-testid="cancel-confirm-button"
                        class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={w.confirmWithdraw}
                        disabled={w.isSubmitting}
                        data-testid="confirm-withdraw-button"
                        class="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {#if w.isSubmitting}
                            <div
                                class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                            ></div>
                            Procesando...
                        {:else}
                            Confirmar Egreso
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <form
        method="POST"
        data-testid="withdraw-form"
        onsubmit={w.handleInitialSubmit}
        class="space-y-5"
    >
        <!-- Cashbox -->
        <CashboxPicker
            {cashboxes}
            selected={w.cashboxId}
            onSelect={(id) => (w.cashboxId = id)}
            error={w.inputErrors.cashboxId}
        />

        <!-- Concept -->
        <ConceptPicker
            {concepts}
            quickConcepts={w.quickConcepts}
            filteredConcepts={w.filteredConcepts}
            selected={w.selectedConcept}
            searchQuery={w.searchQuery}
            showDropdown={w.showDropdown}
            highlightedIndex={w.highlightedIndex}
            error={w.inputErrors.concept}
            onSelect={w.selectConcept}
            onClear={w.clearConcept}
            onSearchInput={(v) => {
                w.searchQuery = v;
                w.showDropdown = true;
            }}
            onFocus={() => (w.showDropdown = true)}
            onKeyDown={w.handleKeyDown}
        />

        <!-- Amount -->
        <div>
            <label
                for="amount"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Monto (Bs.)
            </label>
            <div class="relative">
                <span class="absolute left-4 top-2 text-slate-500 font-medium"
                    >Bs</span
                >
                <input
                    id="amount"
                    bind:value={w.amount}
                    use:noWheel
                    type="number"
                    step="0.01"
                    data-testid="withdraw-amount-input"
                    placeholder="0.00"
                    class="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition
                    {w.inputErrors.amount
                        ? 'border-red-500 ring-2 ring-red-100'
                        : ''}"
                />
            </div>

            <QuickAmountActions
                amount={w.amount}
                onSelectAmount={(v) => (w.amount = v)}
                activeClass="bg-red-600 border-red-600 text-white shadow-sm"
                inactiveClass="bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 active:bg-red-100"
            />

            {#if w.amount && parseFloat(w.amount) > 0 && !w.inputErrors.amount}
                <div
                    in:fade={{ duration: 200 }}
                    data-testid="amount-confirmation-badge"
                    class="mt-2 w-full flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg"
                >
                    <div class="flex items-center gap-2">
                        <CircleCheck class="w-4 h-4 text-red-600 shrink-0" />
                        <span class="text-sm font-medium text-red-900"
                            >Monto ingresado</span
                        >
                    </div>
                    <span class="text-base font-bold text-red-900"
                        >{formatBOB(w.amount)}</span
                    >
                </div>
            {/if}

            {#if w.inputErrors.amount}
                <p
                    data-testid="amount-input-error"
                    class="mt-2 text-sm text-red-600 flex items-center gap-1"
                >
                    <CircleAlert class="h-4 w-4" />{w.inputErrors.amount}
                </p>
            {/if}
        </div>

        <!-- Reference -->
        <div>
            <label
                for="reference"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Referencia <span class="text-slate-500 text-xs">(Opcional)</span
                >
            </label>
            <input
                id="reference"
                bind:value={w.reference}
                type="text"
                data-testid="withdraw-reference-input"
                placeholder="Ej: Número de comprobante, talonario"
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition"
            />
        </div>

        <button
            type="submit"
            disabled={!w.canSubmit}
            data-testid="withdraw-submit-button"
            class="w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700 active:bg-red-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <Minus class="h-5 w-5" />
            {w.isSubmitting ? "Procesando..." : "Registrar Egreso"}
        </button>
    </form>
{/if}
