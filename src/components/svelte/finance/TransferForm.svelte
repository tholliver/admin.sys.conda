<script lang="ts">
    import {
        ArrowLeftRight,
        CircleAlert,
        CircleCheck,
        TriangleAlert,
        X,
        Wallet,
        MoveRight,
    } from "@lucide/svelte";
    import { fade } from "svelte/transition";
    import { actions, isInputError } from "astro:actions";
    import { noWheel } from "@/lib/form/utils";
    import { formatBOB } from "@/utils/formatters";
    import TransactionSuccess from "./TransactionSuccess.svelte";
    import QuickAmountActions from "./QuickAmountActions.svelte";

    interface Cashbox {
        id: string;
        name: string;
        code: string;
        balance: string | null;
    }

    interface TransferResponse {
        success: boolean;
        message: string;
        transaction: {
            id: string;
            amount: string;
            concept: string;
            reference: string | null;
            timestamp: string;
        };
        from: { id: string; name: string; newBalance: string };
        to: { id: string; name: string; newBalance: string };
    }

    interface Props {
        cashboxes: Cashbox[];
    }

    let { cashboxes }: Props = $props();

    let inputErrors = $state<Record<string, string>>({});
    let serverError = $state<string | null>(null);
    let successData = $state<TransferResponse | null>(null);
    let isSubmitting = $state(false);
    let showConfirmDialog = $state(false);

    // Form state
    let fromCashboxId = $state("");
    let toCashboxId = $state("");
    let amount = $state("");
    let notes = $state("");

    let fromCashbox = $derived(
        cashboxes.find((c) => c.id === fromCashboxId) ?? null,
    );
    let toCashbox = $derived(
        cashboxes.find((c) => c.id === toCashboxId) ?? null,
    );
    let availableTo = $derived(cashboxes.filter((c) => c.id !== fromCashboxId));
    let availableFrom = $derived(cashboxes.filter((c) => c.id !== toCashboxId));

    let fromBalance = $derived(parseFloat(fromCashbox?.balance ?? "0"));
    let hasEnough = $derived(
        fromCashbox && amount && parseFloat(amount) > 0
            ? fromBalance >= parseFloat(amount)
            : true,
    );

    function resetForm() {
        fromCashboxId = "";
        toCashboxId = "";
        amount = "";
        notes = "";
        inputErrors = {};
        serverError = null;
    }

    function handleInitialSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        if (!fromCashboxId) {
            inputErrors.fromCashboxId = "Seleccione la caja origen";
            return;
        }
        if (!toCashboxId) {
            inputErrors.toCashboxId = "Seleccione la caja destino";
            return;
        }
        if (fromCashboxId === toCashboxId) {
            inputErrors.toCashboxId =
                "La caja destino debe ser diferente a la origen";
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            inputErrors.amount = "Monto debe ser mayor a 0";
            return;
        }
        if (!hasEnough) {
            inputErrors.amount = `Saldo insuficiente. Disponible: ${formatBOB(fromBalance)}`;
            return;
        }
        showConfirmDialog = true;
    }

    async function confirmTransfer() {
        showConfirmDialog = false;
        const formData = new FormData();
        formData.append("fromCashboxId", fromCashboxId);
        formData.append("toCashboxId", toCashboxId);
        formData.append("amount", amount);
        if (notes.trim()) formData.append("notes", notes.trim());

        isSubmitting = true;
        try {
            const result = await actions.finance.transfer(formData);

            if (isInputError(result?.error)) {
                const fieldErrors = result.error.fields;
                for (const [field, errors] of Object.entries(fieldErrors)) {
                    inputErrors[field] = Array.isArray(errors)
                        ? errors.join(", ")
                        : String(errors);
                }
                return;
            }

            if (result?.error) {
                serverError =
                    result.error.message ||
                    "Error al procesar la transferencia";
                return;
            }

            if (result?.data?.success) {
                successData = result.data as TransferResponse;
            }
        } catch (err) {
            serverError =
                err instanceof Error
                    ? err.message
                    : "Error inesperado. Intente nuevamente.";
        } finally {
            isSubmitting = false;
        }
    }
</script>

{#if successData}
    <!-- SUCCESS VIEW -->
    <div class="rounded-xl border border-slate-200 overflow-hidden">
        <div class="bg-violet-700 px-5 py-4 flex items-center gap-4">
            <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15"
            >
                <CircleCheck class="h-5 w-5 text-white" />
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-white font-semibold text-sm">
                    Transferencia completada
                </p>
                <p class="text-violet-200 text-xs mt-0.5 truncate">
                    {successData.transaction.concept}
                </p>
            </div>
        </div>

        <div class="bg-white divide-y divide-slate-100">
            <div class="flex justify-between items-center px-5 py-3">
                <span class="text-sm text-slate-500">Monto</span>
                <span class="text-base font-semibold text-violet-700"
                    >{successData.transaction.amount}</span
                >
            </div>
            <div class="flex justify-between items-center px-5 py-3">
                <span class="text-sm text-slate-500">De</span>
                <div class="text-right">
                    <p class="text-sm font-medium text-slate-900">
                        {successData.from.name}
                    </p>
                    <p class="text-xs text-slate-500">
                        Nuevo saldo: {successData.from.newBalance}
                    </p>
                </div>
            </div>
            <div class="flex justify-between items-center px-5 py-3">
                <span class="text-sm text-slate-500">A</span>
                <div class="text-right">
                    <p class="text-sm font-medium text-slate-900">
                        {successData.to.name}
                    </p>
                    <p class="text-xs text-slate-500">
                        Nuevo saldo: {successData.to.newBalance}
                    </p>
                </div>
            </div>
        </div>

        <div class="bg-slate-50 border-t border-slate-200 px-5 py-3 space-y-2">
            <div class="flex gap-2">
                <a
                    href="/transferencias"
                    class="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <ArrowLeftRight class="h-4 w-4" />
                    Nueva transferencia
                </a>
                <a
                    href="/historial"
                    class="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    Ver historial
                </a>
            </div>
            <a
                href="/"
                class="flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors pt-1"
            >
                Volver al inicio
            </a>
        </div>
    </div>
{:else}
    <!-- ERROR BANNER -->
    {#if serverError}
        <div
            class="mb-6 flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-200"
        >
            <CircleAlert class="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div class="flex-1">
                <h3 class="font-semibold text-red-900">Error</h3>
                <p class="text-sm text-red-700">{serverError}</p>
            </div>
            <button
                type="button"
                onclick={() => (serverError = null)}
                class="text-red-600 hover:text-red-800 shrink-0"
            >
                <X class="h-4 w-4" />
            </button>
        </div>
    {/if}

    <!-- CONFIRM DIALOG -->
    {#if showConfirmDialog}
        <div
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
            <div
                class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) =>
                    e.key === "Escape" && (showConfirmDialog = false)}
                role="dialog"
                aria-modal="true"
                tabindex="0"
            >
                <div class="flex items-start gap-3">
                    <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100"
                    >
                        <ArrowLeftRight class="h-5 w-5 text-violet-600" />
                    </div>
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-slate-900">
                            Confirmar Transferencia
                        </h3>
                        <p class="text-sm text-slate-600 mt-1">
                            Revise los detalles antes de confirmar
                        </p>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-lg p-4 space-y-2.5">
                    <div class="flex items-center gap-3 text-sm">
                        <div class="flex-1 text-center">
                            <p class="font-medium text-slate-900">
                                {fromCashbox?.name}
                            </p>
                            <p class="text-xs text-slate-500">
                                {formatBOB(fromCashbox?.balance ?? "0")}
                            </p>
                        </div>
                        <MoveRight class="h-4 w-4 text-violet-500 shrink-0" />
                        <div class="flex-1 text-center">
                            <p class="font-medium text-slate-900">
                                {toCashbox?.name}
                            </p>
                            <p class="text-xs text-slate-500">
                                {formatBOB(toCashbox?.balance ?? "0")}
                            </p>
                        </div>
                    </div>
                    <div
                        class="flex justify-between items-center border-t border-slate-200 pt-2.5"
                    >
                        <span class="text-sm text-slate-600">Monto:</span>
                        <span class="text-lg font-bold text-violet-700"
                            >{formatBOB(amount)}</span
                        >
                    </div>
                </div>

                <div class="flex gap-3 pt-2">
                    <button
                        type="button"
                        onclick={() => (showConfirmDialog = false)}
                        disabled={isSubmitting}
                        class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={confirmTransfer}
                        disabled={isSubmitting}
                        class="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {#if isSubmitting}
                            <div
                                class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                            ></div>
                            <span>Procesando...</span>
                        {:else}
                            <span>Confirmar</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- FORM -->
    <form method="POST" onsubmit={handleInitialSubmit} class="space-y-5">
        <!-- FROM cashbox -->
        <div>
            <label
                for="fromCashboxId"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Caja Origen
            </label>
            <select
                id="fromCashboxId"
                bind:value={fromCashboxId}
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 transition {inputErrors.fromCashboxId
                    ? 'border-red-500'
                    : ''}"
            >
                <option value="">— Seleccionar caja origen —</option>
                {#each availableFrom as box}
                    <option value={box.id}>
                        {box.name} ({box.code}) — {formatBOB(
                            box.balance ?? "0",
                        )}
                    </option>
                {/each}
            </select>
            {#if inputErrors.fromCashboxId}
                <p class="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{inputErrors.fromCashboxId}
                </p>
            {/if}
            {#if fromCashbox}
                <div
                    in:fade={{ duration: 150 }}
                    class="mt-2 flex items-center justify-between px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg text-sm"
                >
                    <div class="flex items-center gap-2 text-violet-700">
                        <Wallet class="h-4 w-4" />
                        <span>Saldo disponible</span>
                    </div>
                    <span class="font-semibold text-violet-900"
                        >{formatBOB(fromCashbox.balance ?? "0")}</span
                    >
                </div>
            {/if}
        </div>

        <!-- TO cashbox -->
        <div>
            <label
                for="toCashboxId"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Caja Destino
            </label>
            <select
                id="toCashboxId"
                bind:value={toCashboxId}
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 transition {inputErrors.toCashboxId
                    ? 'border-red-500'
                    : ''}"
            >
                <option value="">— Seleccionar caja destino —</option>
                {#each availableTo as box}
                    <option value={box.id}>
                        {box.name} ({box.code}) — {formatBOB(
                            box.balance ?? "0",
                        )}
                    </option>
                {/each}
            </select>
            {#if inputErrors.toCashboxId}
                <p class="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{inputErrors.toCashboxId}
                </p>
            {/if}
        </div>

        <!-- AMOUNT -->
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
                    bind:value={amount}
                    use:noWheel
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    class="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 transition {inputErrors.amount ||
                    !hasEnough
                        ? 'border-red-500 ring-2 ring-red-100'
                        : ''}"
                />
            </div>

            <QuickAmountActions
                {amount}
                onSelectAmount={(v) => (amount = v)}
                activeClass="bg-violet-600 border-violet-600 text-white shadow-sm"
                inactiveClass="bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 active:bg-violet-100"
            />

            {#if amount && parseFloat(amount) > 0 && hasEnough && !inputErrors.amount}
                <div
                    in:fade={{ duration: 200 }}
                    class="mt-2 w-full flex items-center justify-between px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-lg"
                >
                    <div class="flex items-center gap-2">
                        <CircleCheck class="w-4 h-4 text-violet-600 shrink-0" />
                        <span class="text-sm font-medium text-violet-900"
                            >Monto ingresado</span
                        >
                    </div>
                    <span class="text-base font-bold text-violet-900"
                        >{formatBOB(amount)}</span
                    >
                </div>
            {/if}
            {#if !hasEnough && amount && parseFloat(amount) > 0}
                <div
                    in:fade={{ duration: 150 }}
                    class="mt-2 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg"
                >
                    <TriangleAlert class="h-4 w-4 text-red-600 shrink-0" />
                    <span class="text-sm text-red-700"
                        >Saldo insuficiente. Disponible: {formatBOB(
                            fromBalance,
                        )}</span
                    >
                </div>
            {/if}
            {#if inputErrors.amount}
                <p class="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{inputErrors.amount}
                </p>
            {/if}
        </div>

        <!-- NOTES (optional) -->
        <div>
            <label
                for="notes"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Notas <span class="text-slate-500 text-xs">(Opcional)</span>
            </label>
            <textarea
                id="notes"
                bind:value={notes}
                rows="2"
                maxlength="1000"
                placeholder="Observaciones adicionales..."
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 transition resize-none"
            ></textarea>
        </div>

        <button
            type="submit"
            disabled={isSubmitting ||
                !fromCashboxId ||
                !toCashboxId ||
                !amount ||
                !hasEnough}
            class="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-700 active:bg-violet-800 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <ArrowLeftRight class="h-5 w-5" />
            {isSubmitting ? "Procesando..." : "Registrar Transferencia"}
        </button>
    </form>
{/if}
