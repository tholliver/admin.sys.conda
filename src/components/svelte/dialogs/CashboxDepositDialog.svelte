<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import {
        ArrowDownToLine,
        CircleAlert,
        CircleCheck,
        X,
        Zap,
    } from "@lucide/svelte";
    import { formatBOB } from "@/utils/formatters";

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
        categories: CategoryOption[];
        triggerLabel?: string;
        triggerClass?: string;
    }

    let {
        cashboxId,
        cashboxName,
        currentBalance,
        monthlySalary = 0,
        categories,
        triggerLabel = "Depositar",
        triggerClass = "rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors",
    }: Props = $props();

    let isOpen = $state(false);
    let isSubmitting = $state(false);
    let inputErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);
    const formId = `cashbox-deposit-form-${cashboxId}`;

    let amount = $state("");
    let categoryId = $state(categories[0]?.id ?? "");
    let concept = $state(`Depósito ${cashboxName}`);
    let reference = $state("");
    let notes = $state("");

    const gap = $derived(Math.max(0, monthlySalary - currentBalance));
    const coveragePct = $derived(
        monthlySalary > 0
            ? Math.min((currentBalance / monthlySalary) * 100, 100)
            : 100,
    );

    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function reset() {
        amount = "";
        categoryId = categories[0]?.id ?? "";
        concept = `Depósito ${cashboxName}`;
        reference = notes = "";
        inputErrors = {};
        serverError = null;
        successMsg = null;
    }

    function fillGap() {
        if (gap > 0) amount = gap.toFixed(2);
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        const fd = new FormData();
        fd.set("cashboxId", cashboxId);
        fd.set("categoryId", categoryId);
        fd.set("amount", amount);
        fd.set("concept", concept.trim());
        if (reference.trim()) fd.set("reference", reference.trim());
        if (notes.trim()) fd.set("notes", notes.trim());

        isSubmitting = true;
        try {
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
                setTimeout(() => {
                    isOpen = false;
                    reset();
                    window.location.reload();
                }, 1200);
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Dialog
    bind:isOpen
    size="md"
    title={`Depositar a ${cashboxName}`}
    description="Acreditar fondos en esta caja."
    preventCloseOnEscapeKeyDown={true}
    preventCloseOnInteractOutside={true}
    onClose={reset}
>
    {#snippet trigger({ open })}
        <button
            type="button"
            onclick={() => {
                reset();
                open();
            }}
            class={triggerClass}
        >
            <ArrowDownToLine class="h-3 w-3 inline -mt-0.5 mr-1" />
            {triggerLabel}
        </button>
    {/snippet}

    {#snippet children()}
        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-8 text-center">
                <CircleCheck class="h-10 w-10 text-emerald-500" />
                <p class="text-sm font-semibold text-slate-900">{successMsg}</p>
            </div>
        {:else}
            <div
                class="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2"
            >
                <div class="flex justify-between text-xs">
                    <span class="text-slate-500">Caja</span>
                    <span class="font-medium text-slate-800">{cashboxName}</span>
                </div>
                <div class="flex justify-between text-xs">
                    <span class="text-slate-500">Saldo actual</span>
                    <span class="font-bold text-slate-800 tabular-nums">
                        {formatBOB(currentBalance)}
                    </span>
                </div>
                {#if monthlySalary > 0}
                    <div class="flex justify-between text-xs">
                        <span class="text-slate-500">Masa salarial</span>
                        <span class="font-medium text-slate-700 tabular-nums">
                        {formatBOB(monthlySalary)}
                        </span>
                    </div>
                    <div>
                        <div
                            class="h-1.5 w-full rounded-full bg-slate-200 mt-1"
                        >
                            <div
                                class="h-1.5 rounded-full transition-all {coveragePct >=
                                100
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-400'}"
                                style="width: {coveragePct}%"
                            ></div>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5 text-right">
                            {Math.round(coveragePct)}% cobertura salarial
                        </p>
                    </div>
                {/if}
            </div>

            {#if serverError}
                <div
                    class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                >
                    <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-700 flex-1">{serverError}</p>
                    <button
                        type="button"
                        onclick={() => (serverError = null)}
                        class="text-red-400 hover:text-red-600"
                    >
                        <X class="h-4 w-4" />
                    </button>
                </div>
            {/if}

            <form
                id={formId}
                class="space-y-4 px-1 pb-1"
                onsubmit={handleSubmit}
            >
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label for="amount-{cashboxId}" class="text-xs font-medium text-slate-600">
                            Ingresar monto (Bs) <span class="text-red-500">*</span>
                        </label>
                        {#if gap > 0}
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
                        <span
                            class="absolute left-3 top-2.5 text-slate-400 text-sm pointer-events-none"
                            >Bs</span
                        >
                        <input
                            id="amount-{cashboxId}"
                            type="number"
                            bind:value={amount}
                            min="0.01"
                            step="0.01"
                            required
                            placeholder="0.00"
                            class="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500
                {fieldError('amount') ? 'border-red-400' : 'border-slate-200'}"
                        />
                    </div>
                    {#if fieldError("amount")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("amount")}
                        </p>
                    {/if}
                </div>

                <div>
                    <label
                        for="category-{cashboxId}"
                        class="block text-xs font-medium text-slate-600 mb-1"
                    >
                        Seleccionar categoría <span class="text-red-500">*</span>
                    </label>
                    <select
                        id="category-{cashboxId}"
                        bind:value={categoryId}
                        required
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500
              {fieldError('categoryId') ? 'border-red-400' : ''}"
                    >
                        <option value="">-- Seleccionar --</option>
                        {#each categories as cat}
                            <option value={cat.id}
                                >{cat.name} ({cat.code})</option
                            >
                        {/each}
                    </select>
                    {#if fieldError("categoryId")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("categoryId")}
                        </p>
                    {/if}
                </div>

                <div>
                    <label
                        for="concept-{cashboxId}"
                        class="block text-xs font-medium text-slate-600 mb-1"
                    >
                        Ingresar concepto <span class="text-red-500">*</span>
                    </label>
                    <input
                        id="concept-{cashboxId}"
                        type="text"
                        bind:value={concept}
                        required
                        maxlength="255"
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500
              {fieldError('concept') ? 'border-red-400' : ''}"
                    />
                    {#if fieldError("concept")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("concept")}
                        </p>
                    {/if}
                </div>

                <div>
                    <label
                        for="reference-{cashboxId}"
                        class="block text-xs font-medium text-slate-600 mb-1"
                    >
                        Ingresar referencia <span class="text-slate-400 font-normal"
                            >(opcional)</span
                        >
                    </label>
                    <input
                        id="reference-{cashboxId}"
                        type="text"
                        bind:value={reference}
                        maxlength="100"
                        placeholder="Nro. recibo, cheque, transferencia..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                <div>
                    <label
                        for="notes-{cashboxId}"
                        class="block text-xs font-medium text-slate-600 mb-1"
                    >
                        Ingresar notas <span class="text-slate-400 font-normal"
                            >(opcional)</span
                        >
                    </label>
                    <textarea
                        id="notes-{cashboxId}"
                        bind:value={notes}
                        maxlength="500"
                        rows="2"
                        placeholder="Observaciones adicionales..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    ></textarea>
                </div>
            </form>
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        {#if !successMsg}
            <button
                type="button"
                onclick={() => {
                    reset();
                    close();
                }}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:mr-auto"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form={formId}
                disabled={isSubmitting ||
                    !amount ||
                    !categoryId ||
                    !concept.trim()}
                class="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Depositando...
                {:else}
                    <ArrowDownToLine class="h-4 w-4" />
                    Depositar
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
