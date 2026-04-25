<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import {
        ArrowDownToLine,
        ArrowUpFromLine,
        CircleAlert,
        CircleCheck,
        X,
        Zap,
    } from "@lucide/svelte";
    import { formatBOB } from "@/utils/formatters";
    import { noWheel } from "@/lib/form/utils";

    interface CategoryOption {
        id: string;
        name: string;
        code: string;
    }

    interface Props {
        cashboxId: string;
        cashboxName: string;
        currentBalance: number;
        monthlySalary?: number;
        /** income categories for deposit, outcome categories for withdraw */
        incomeCategories: CategoryOption[];
        outcomeCategories: CategoryOption[];
        /** Controls which tab opens by default when trigger is clicked */
        defaultMode?: "deposit" | "withdraw";
        triggerDepositClass?: string;
        triggerWithdrawClass?: string;
    }

    let {
        cashboxId,
        cashboxName,
        currentBalance,
        monthlySalary = 0,
        incomeCategories,
        outcomeCategories,
        defaultMode = "deposit",
        triggerDepositClass = "inline-flex items-center justify-center w-7 h-7 rounded border border-transparent text-slate-400 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors",
        triggerWithdrawClass = "inline-flex items-center justify-center w-7 h-7 rounded border border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors",
    }: Props = $props();

    // ── State ────────────────────────────────────────────────────────────────
    let isOpen = $state(false);
    let mode = $state<"deposit" | "withdraw">(defaultMode);
    let isSubmitting = $state(false);
    let inputErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    // Form fields
    let amount = $state("");
    let categoryId = $state("");
    let concept = $state("");
    let reference = $state("");
    let notes = $state("");
    let authorizedBy = $state("");

    // ── Derived ──────────────────────────────────────────────────────────────
    const isDeposit = $derived(mode === "deposit");
    const categories = $derived(isDeposit ? incomeCategories : outcomeCategories);

    const gap = $derived(Math.max(0, monthlySalary - currentBalance));
    const coveragePct = $derived(
        monthlySalary > 0 ? Math.min((currentBalance / monthlySalary) * 100, 100) : 100,
    );
    const amountNum = $derived(parseFloat(amount) || 0);
    const balanceAfter = $derived(
        isDeposit ? currentBalance + amountNum : currentBalance - amountNum,
    );
    const wouldOverdraw = $derived(!isDeposit && amountNum > currentBalance);

    const formId = `cashbox-txn-form-${cashboxId}`;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function reset() {
        amount = "";
        categoryId = categories[0]?.id ?? "";
        concept = isDeposit ? `Depósito ${cashboxName}` : `Egreso ${cashboxName}`;
        reference = notes = authorizedBy = "";
        inputErrors = {};
        serverError = null;
        successMsg = null;
    }

    function open(openMode: "deposit" | "withdraw") {
        mode = openMode;
        reset();
        isOpen = true;
    }

    function fillGap() {
        if (gap > 0) amount = gap.toFixed(2);
    }

    // ── Submit ───────────────────────────────────────────────────────────────
    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        const fd = new FormData();

        isSubmitting = true;
        try {
            if (isDeposit) {
                fd.set("cashboxId", cashboxId);
                fd.set("categoryId", categoryId);
                fd.set("amount", amount);
                fd.set("concept", concept.trim());
                if (reference.trim()) fd.set("reference", reference.trim());
                if (notes.trim()) fd.set("notes", notes.trim());

                const result = await actions.sector.depositToCashbox(fd);

                if (isInputError(result?.error)) {
                    inputErrors = result.error.fields as any;
                    return;
                }
                if (result?.error) {
                    serverError = result.error.message ?? "Error al depositar.";
                    return;
                }
                if (result?.data?.success) {
                    successMsg = result.data.message ?? "Depósito registrado.";
                }
            } else {
                fd.set("cashboxId", cashboxId);
                fd.set("categoryId", categoryId);
                fd.set("amount", amount);
                fd.set("notes", notes.trim() || concept.trim()); // withdraw requires notes
                if (reference.trim()) fd.set("reference", reference.trim());
                if (authorizedBy.trim()) fd.set("authorizedBy", authorizedBy.trim());

                const result = await actions.finance.withdraw(fd);

                if (isInputError(result?.error)) {
                    inputErrors = result.error.fields as any;
                    return;
                }
                if (result?.error) {
                    serverError = result.error.message ?? "Error al retirar.";
                    return;
                }
                if (result?.data?.success) {
                    successMsg = result.data.message ?? "Egreso registrado.";
                }
            }

            if (successMsg) {
                setTimeout(() => {
                    isOpen = false;
                    reset();
                    window.location.reload();
                }, 1400);
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }
</script>

<!-- ── Deposit trigger ──────────────────────────────────────────────────────── -->
<button
    type="button"
    title="Depositar en caja"
    onclick={() => open("deposit")}
    class={triggerDepositClass}
>
    <ArrowDownToLine class="h-4 w-4" />
</button>

<!-- ── Withdraw trigger ─────────────────────────────────────────────────────── -->
<button
    type="button"
    title="Retirar de caja"
    onclick={() => open("withdraw")}
    class={triggerWithdrawClass}
>
    <ArrowUpFromLine class="h-4 w-4" />
</button>

<!-- ── Dialog ───────────────────────────────────────────────────────────────── -->
<Dialog
    bind:isOpen
    size="md"
    title={isDeposit ? `Depositar → ${cashboxName}` : `Retirar ← ${cashboxName}`}
    description={isDeposit ? "Acreditar fondos en esta caja." : "Retirar fondos de esta caja."}
    preventCloseOnEscapeKeyDown={true}
    preventCloseOnInteractOutside={true}
    onClose={reset}
>
    {#snippet children()}
        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-8 text-center">
                <CircleCheck class="h-10 w-10 {isDeposit ? 'text-emerald-500' : 'text-blue-500'}" />
                <p class="text-sm font-semibold text-slate-900">{successMsg}</p>
            </div>
        {:else}
            <!-- Mode tabs -->
            <div class="flex rounded-lg border border-slate-200 p-0.5 mb-4 bg-slate-50">
                <button
                    type="button"
                    onclick={() => { mode = "deposit"; reset(); }}
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
                        {isDeposit
                            ? 'bg-white shadow-sm text-emerald-700 border border-emerald-100'
                            : 'text-slate-500 hover:text-slate-700'}"
                >
                    <ArrowDownToLine class="h-3.5 w-3.5" />
                    Depositar
                </button>
                <button
                    type="button"
                    onclick={() => { mode = "withdraw"; reset(); }}
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
                        {!isDeposit
                            ? 'bg-white shadow-sm text-red-700 border border-red-100'
                            : 'text-slate-500 hover:text-slate-700'}"
                >
                    <ArrowUpFromLine class="h-3.5 w-3.5" />
                    Retirar
                </button>
            </div>

            <!-- Balance summary card -->
            <div class="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                <div class="flex justify-between text-xs">
                    <span class="text-slate-500">Caja</span>
                    <span class="font-medium text-slate-800">{cashboxName}</span>
                </div>
                <div class="flex justify-between text-xs">
                    <span class="text-slate-500">Saldo actual</span>
                    <span class="font-bold text-slate-800 tabular-nums">{formatBOB(currentBalance)}</span>
                </div>
                {#if amountNum > 0}
                    <div class="flex justify-between text-xs border-t border-slate-200 pt-2">
                        <span class="text-slate-500">Saldo tras operación</span>
                        <span class="font-bold tabular-nums {wouldOverdraw ? 'text-red-600' : isDeposit ? 'text-emerald-600' : 'text-slate-800'}">
                            {formatBOB(Math.max(balanceAfter, 0))}
                        </span>
                    </div>
                {/if}
                {#if monthlySalary > 0 && isDeposit}
                    <div class="flex justify-between text-xs">
                        <span class="text-slate-500">Masa salarial</span>
                        <span class="font-medium text-slate-700 tabular-nums">{formatBOB(monthlySalary)}</span>
                    </div>
                    <div>
                        <div class="h-1.5 w-full rounded-full bg-slate-200 mt-1">
                            <div
                                class="h-1.5 rounded-full transition-all {coveragePct >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}"
                                style="width: {coveragePct}%"
                            ></div>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5 text-right">
                            {Math.round(coveragePct)}% cobertura salarial
                        </p>
                    </div>
                {/if}
                {#if wouldOverdraw}
                    <p class="text-[11px] text-red-600 font-medium pt-1">
                        ⚠ Monto supera el saldo disponible
                    </p>
                {/if}
            </div>

            <!-- Server error -->
            {#if serverError}
                <div class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-700 flex-1">{serverError}</p>
                    <button type="button" onclick={() => (serverError = null)} class="text-red-400 hover:text-red-600">
                        <X class="h-4 w-4" />
                    </button>
                </div>
            {/if}

            <!-- Form -->
            <form id={formId} class="space-y-3 px-1 pb-1" onsubmit={handleSubmit}>

                <!-- Amount -->
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label for="amount-{cashboxId}" class="text-xs font-medium text-slate-600">
                            Monto (Bs) <span class="text-red-500">*</span>
                        </label>
                        {#if isDeposit && gap > 0}
                            <button
                                type="button"
                                onclick={fillGap}
                                class="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                            >
                                <Zap class="h-3 w-3" />
                                Cubrir faltante ({formatBOB(gap)})
                            </button>
                        {/if}
                    </div>
                    <div class="relative">
                        <span class="absolute left-3 top-2.5 text-slate-400 text-sm pointer-events-none">Bs</span>
                        <input
                            id="amount-{cashboxId}"
                            type="number"
                            use:noWheel
                            bind:value={amount}
                            required
                            placeholder="0.00"
                            class="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2
                                {wouldOverdraw ? 'border-red-400 focus:ring-red-400' : fieldError('amount') ? 'border-red-400 focus:ring-red-400' : isDeposit ? 'border-slate-200 focus:ring-emerald-500' : 'border-slate-200 focus:ring-red-400'}"
                        />
                    </div>
                    {#if fieldError("amount")}
                        <p class="mt-1 text-xs text-red-600">{fieldError("amount")}</p>
                    {/if}
                </div>

                <!-- Category -->
                <div>
                    <label for="category-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                        Categoría <span class="text-red-500">*</span>
                    </label>
                    <select
                        id="category-{cashboxId}"
                        bind:value={categoryId}
                        required
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2
                            {fieldError('categoryId') ? 'border-red-400' : isDeposit ? 'focus:ring-emerald-500' : 'focus:ring-red-400'}"
                    >
                        <option value="">-- Seleccionar --</option>
                        {#each categories as cat}
                            <option value={cat.id}>{cat.name} ({cat.code})</option>
                        {/each}
                    </select>
                    {#if fieldError("categoryId")}
                        <p class="mt-1 text-xs text-red-600">{fieldError("categoryId")}</p>
                    {/if}
                </div>

                <!-- Concept -->
                <div>
                    <label for="concept-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                        Concepto <span class="text-red-500">*</span>
                    </label>
                    <input
                        id="concept-{cashboxId}"
                        type="text"
                        bind:value={concept}
                        required
                        maxlength="255"
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2
                            {fieldError('concept') ? 'border-red-400' : isDeposit ? 'focus:ring-emerald-500' : 'focus:ring-red-400'}"
                    />
                    {#if fieldError("concept")}
                        <p class="mt-1 text-xs text-red-600">{fieldError("concept")}</p>
                    {/if}
                </div>

                <!-- Notes (required for withdraw, optional for deposit) -->
                <div>
                    <label for="notes-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                        {isDeposit ? "Notas" : "Justificación"}
                        {#if !isDeposit}<span class="text-red-500">*</span>{:else}<span class="text-slate-400 font-normal">(opcional)</span>{/if}
                    </label>
                    <textarea
                        id="notes-{cashboxId}"
                        bind:value={notes}
                        maxlength="500"
                        rows="2"
                        required={!isDeposit}
                        placeholder={isDeposit ? "Observaciones adicionales..." : "Motivo del retiro..."}
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none
                            {fieldError('notes') ? 'border-red-400' : isDeposit ? 'focus:ring-emerald-500' : 'focus:ring-red-400'}"
                    ></textarea>
                    {#if fieldError("notes")}
                        <p class="mt-1 text-xs text-red-600">{fieldError("notes")}</p>
                    {/if}
                </div>

                <!-- Reference -->
                <div>
                    <label for="reference-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                        Referencia <span class="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                        id="reference-{cashboxId}"
                        type="text"
                        bind:value={reference}
                        maxlength="100"
                        placeholder="Nro. recibo, cheque..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2
                            {isDeposit ? 'focus:ring-emerald-500' : 'focus:ring-red-400'}"
                    />
                </div>

                <!-- Authorized by (withdraw only) -->
                {#if !isDeposit}
                    <div>
                        <label for="auth-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                            Autorizado por <span class="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            id="auth-{cashboxId}"
                            type="text"
                            bind:value={authorizedBy}
                            maxlength="255"
                            placeholder="Nombre del autorizante..."
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                    </div>
                {/if}
            </form>
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        {#if !successMsg}
            <button
                type="button"
                onclick={() => { reset(); close(); }}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:mr-auto"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form={formId}
                disabled={isSubmitting || !amount || !categoryId || !concept.trim() || wouldOverdraw || (!isDeposit && !notes.trim())}
                class="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2
                    {isDeposit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}"
            >
                {#if isSubmitting}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {isDeposit ? "Depositando..." : "Retirando..."}
                {:else if isDeposit}
                    <ArrowDownToLine class="h-4 w-4" />
                    Depositar
                {:else}
                    <ArrowUpFromLine class="h-4 w-4" />
                    Retirar
                {/if}
            </button>
        {:else}
            <button
                type="button"
                onclick={close}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:ml-auto"
            >
                Cerrar
            </button>
        {/if}
    {/snippet}
</Dialog>
