<script lang="ts">
    // src/components/svelte/finance/CoverDebtDialog.svelte
    // Dedicated dialog to cover a cashbox's accumulated debt.
    // Triggered from the cashbox table row when cumulativeDebt > 0.

    import { actions, isInputError } from "astro:actions";
    import { BadgeCheck, CircleAlert, ShieldCheck, TriangleAlert, X } from "@lucide/svelte";
    import Dialog from "@/components/svelte/Dialog.svelte";
    import AmountInput from "@/components/svelte/finance/AmountInput.svelte";
    import { formatBOB } from "@/utils/formatters";
    import { tooltip } from "@/lib/actions/tooltip";

    interface CategoryOption {
        id:   string;
        name: string;
        code: string;
    }

    interface Props {
        cashboxId:        string;
        cashboxName:      string;
        currentBalance:   number;
        cumulativeDebt:   number;
        incomeCategories: CategoryOption[];
    }

    let {
        cashboxId,
        cashboxName,
        currentBalance,
        cumulativeDebt,
        incomeCategories,
    }: Props = $props();

    // ── State ────────────────────────────────────────────────────────────────
    let isOpen       = $state(false);
    let isSubmitting = $state(false);
    let serverError  = $state<string | null>(null);
    let successMsg   = $state<string | null>(null);
    let amount       = $state("");
    let categoryId   = $state(incomeCategories[0]?.id ?? "");
    let notes        = $state("");
    let reference    = $state("");

    // ── Derived ──────────────────────────────────────────────────────────────
    const amountNum     = $derived(parseFloat(amount) || 0);
    const debtCleared   = $derived(Math.min(amountNum, cumulativeDebt));
    const addedToBalance = $derived(Math.max(0, amountNum - cumulativeDebt));
    const remainingDebt  = $derived(Math.max(0, cumulativeDebt - amountNum));
    const fullyCovered   = $derived(amountNum > 0 && amountNum >= cumulativeDebt);
    const canSubmit      = $derived(amountNum > 0 && !!categoryId && !isSubmitting);

    function open() {
        amount      = "";
        categoryId  = incomeCategories[0]?.id ?? "";
        notes       = "";
        reference   = "";
        serverError = null;
        successMsg  = null;
        isOpen      = true;
    }

    function fillFull() {
        amount = cumulativeDebt.toFixed(2);
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (!canSubmit) return;

        serverError  = null;
        isSubmitting = true;

        try {
            const fd = new FormData();
            fd.set("cashboxId",   cashboxId);
            fd.set("categoryId",  categoryId);
            fd.set("amount",      amountNum.toFixed(2));
            fd.set("coverDebt",   "true");
            fd.set("concept",     `Cobertura de deuda — ${cashboxName}`);
            if (notes.trim())     fd.set("notes",     notes.trim());
            if (reference.trim()) fd.set("externalReference", reference.trim());

            const result = await actions.finance.cashboxDeposit(fd);

            if (isInputError(result?.error)) {
                serverError = Object.values(result.error.fields).flat().join(", ");
                return;
            }
            if (result?.error) {
                serverError = result.error.message ?? "Error al procesar.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Deuda cubierta correctamente.";
                setTimeout(() => { isOpen = false; window.location.reload(); }, 1600);
            }
        } catch (err) {
            serverError = err instanceof Error ? err.message : "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }
</script>

<!-- ── Trigger button — amber, visible only when debt exists ── -->
<button
    type="button"
    onclick={open}
    use:tooltip={{ content: `Cubrir deuda acumulada — ${formatBOB(cumulativeDebt)}`, side: "top" }}
    class="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 shadow-sm transition-all hover:bg-amber-100 hover:border-amber-400 active:scale-95 whitespace-nowrap"
>
    <ShieldCheck class="h-3.5 w-3.5 shrink-0" />
    <span>Cubrir deuda</span>
</button>

<!-- ── Dialog ── -->
<Dialog
    bind:isOpen
    size="sm"
    title="Cubrir deuda acumulada"
    description={cashboxName}
    preventCloseOnEscapeKeyDown={false}
    preventCloseOnInteractOutside={false}
    onClose={() => { serverError = null; }}
>
    {#snippet children()}
        {#if successMsg}
            <!-- ── Success state ── -->
            <div class="flex flex-col items-center gap-3 py-8 text-center">
                <div class="rounded-full bg-emerald-100 p-4">
                    <BadgeCheck class="h-10 w-10 text-emerald-600" />
                </div>
                <div>
                    <p class="font-bold text-slate-900">¡Deuda cubierta!</p>
                    <p class="mt-0.5 text-sm text-slate-500">{successMsg}</p>
                </div>
            </div>
        {:else}
            <!-- ── Debt summary header ── -->
            <div class="mb-5 rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
                <div class="flex items-center gap-3 border-b border-amber-200 px-4 py-3">
                    <div class="rounded-lg bg-amber-200 p-2">
                        <TriangleAlert class="h-5 w-5 text-amber-800" />
                    </div>
                    <div class="flex-1">
                        <p class="text-xs font-medium text-amber-700">Deuda acumulada de {cashboxName}</p>
                        <p class="text-xl font-bold tabular-nums text-amber-900">{formatBOB(cumulativeDebt)}</p>
                    </div>
                </div>
                <div class="flex justify-between items-center px-4 py-2.5 text-xs">
                    <span class="text-amber-700">Saldo actual de la caja</span>
                    <span class="font-bold text-amber-900 tabular-nums">{formatBOB(currentBalance)}</span>
                </div>
            </div>

            <!-- ── Server error ── -->
            {#if serverError}
                <div class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-700 flex-1">{serverError}</p>
                    <button type="button" onclick={() => (serverError = null)} class="text-red-400 hover:text-red-600">
                        <X class="h-4 w-4" />
                    </button>
                </div>
            {/if}

            <!-- ── Form ── -->
            <form id="cover-debt-form" class="space-y-4" onsubmit={handleSubmit}>

                <!-- Amount + fill button -->
                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <label class="text-xs font-medium text-slate-600">
                            Monto a cubrir <span class="text-red-500">*</span>
                        </label>
                        <button
                            type="button"
                            onclick={fillFull}
                            class="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200
                                   px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                            Cubrir todo ({formatBOB(cumulativeDebt)})
                        </button>
                    </div>
                    <AmountInput
                        id="cover-amount"
                        name="amount"
                        value={amount}
                        accentColor="green"
                        error={null}
                        onChange={(v) => (amount = v)}
                    />
                </div>

                <!-- Live breakdown — only when amount entered -->
                {#if amountNum > 0}
                    <div class="rounded-xl border overflow-hidden text-xs transition-all
                        {fullyCovered ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50/50'}">

                        {#if debtCleared > 0}
                            <div class="flex justify-between items-center px-4 py-2.5 border-b border-current/10">
                                <span class="text-amber-700">Abona a deuda</span>
                                <span class="font-bold text-amber-800 tabular-nums">−{formatBOB(debtCleared)}</span>
                            </div>
                        {/if}

                        {#if addedToBalance > 0}
                            <div class="flex justify-between items-center px-4 py-2.5 border-b border-emerald-100">
                                <span class="text-emerald-700">Añade al saldo</span>
                                <span class="font-bold text-emerald-700 tabular-nums">+{formatBOB(addedToBalance)}</span>
                            </div>
                        {/if}

                        <div class="flex justify-between items-center px-4 py-2.5">
                            <span class="font-semibold {fullyCovered ? 'text-emerald-800' : 'text-amber-800'}">
                                Deuda restante
                            </span>
                            <span class="font-bold tabular-nums {fullyCovered ? 'text-emerald-700' : 'text-amber-700'}">
                                {fullyCovered ? "✓ Saldada" : formatBOB(remainingDebt)}
                            </span>
                        </div>

                        {#if fullyCovered}
                            <div class="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 border-t border-emerald-200">
                                <BadgeCheck class="h-4 w-4 text-emerald-600 shrink-0" />
                                <span class="font-semibold text-emerald-800">¡Deuda completamente saldada!</span>
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Category -->
                <div>
                    <label for="cover-category" class="block text-xs font-medium text-slate-600 mb-1.5">
                        Categoría de ingreso <span class="text-red-500">*</span>
                    </label>
                    <select
                        id="cover-category"
                        bind:value={categoryId}
                        required
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    >
                        {#each incomeCategories as cat}
                            <option value={cat.id}>{cat.name}</option>
                        {/each}
                    </select>
                </div>

                <!-- Reference (optional) -->
                <div>
                    <label for="cover-reference" class="block text-xs font-medium text-slate-600 mb-1.5">
                        Referencia <span class="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                        id="cover-reference"
                        type="text"
                        bind:value={reference}
                        maxlength="100"
                        placeholder="Nro. recibo, cheque..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                </div>

                <!-- Notes (optional) -->
                <div>
                    <label for="cover-notes" class="block text-xs font-medium text-slate-600 mb-1.5">
                        Notas <span class="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                        id="cover-notes"
                        bind:value={notes}
                        rows="2"
                        maxlength="500"
                        placeholder="Origen del pago, observaciones..."
                        class="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-amber-400"
                    ></textarea>
                </div>
            </form>
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        {#if successMsg}
            <button
                type="button"
                onclick={close}
                class="ml-auto rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
                Cerrar
            </button>
        {:else}
            <button
                type="button"
                onclick={close}
                disabled={isSubmitting}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600
                       hover:bg-slate-50 transition-colors disabled:opacity-50 sm:mr-auto"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="cover-debt-form"
                disabled={!canSubmit}
                class="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white
                       hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       inline-flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                    Procesando...
                {:else}
                    <ShieldCheck class="h-4 w-4" />
                    Cubrir deuda
                {/if}
            </button>
        {/if}
    {/snippet}
</Dialog>
