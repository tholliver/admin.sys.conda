<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import {
        ArrowDownToLine,
        ArrowLeftRight,
        CircleAlert,
        CircleCheck,
        X,
    } from "@lucide/svelte";
    import { tooltip } from "@/lib/actions/tooltip";
    import { formatBOB } from "@/utils/formatters";
    import AmountInput from "@/components/svelte/finance/AmountInput.svelte";
    import { createCashboxOperationsStore } from "@/lib/stores/cashbox-operations.store.svelte";
    import type { CategoryOption, CashboxOption } from "@/lib/stores/cashbox-operations.store.svelte";

    interface Props {
        cashboxId:        string;
        cashboxName:      string;
        currentBalance:   number;
        monthlySalary?:   number;
        incomeCategories:  CategoryOption[];
        outcomeCategories: CategoryOption[];
        allCashboxes?:    CashboxOption[];
        defaultMode?:     "deposit" | "transfer";
    }

    let {
        cashboxId,
        cashboxName,
        currentBalance,
        monthlySalary    = 0,
        incomeCategories,
        outcomeCategories,
        allCashboxes     = [],
        defaultMode      = "deposit",
    }: Props = $props();

    // ── 2 tabs only ──────────────────────────────────────────────────────────
    type OpMode = "deposit" | "transfer";

    const tabs: { id: OpMode; label: string; icon: any }[] = [
        { id: "deposit",  label: "Depositar",  icon: ArrowDownToLine },
        { id: "transfer", label: "Transferir", icon: ArrowLeftRight  },
    ];

    // ── Store (existing — we only use deposit + transfer paths) ─────────────
    const store = createCashboxOperationsStore(
        cashboxId,
        cashboxName,
        currentBalance,
        monthlySalary,
        incomeCategories,
        outcomeCategories,
        allCashboxes,
        defaultMode,
    );

    // ── Debt coverage toggle state ───────────────────────────────────────────
    const amountNum      = $derived(parseFloat(store.form.values.amount) || 0);

    // ── Submit label ─────────────────────────────────────────────────────────
    const submitLabel = $derived(
        store.isTransfer
            ? { idle: "Transferir",  busy: "Transfiriendo...", cls: "bg-blue-600 hover:bg-blue-700" }
            : { idle: "Depositar",   busy: "Depositando...",   cls: "bg-emerald-600 hover:bg-emerald-700" }
    );
</script>

<!-- ── Trigger ──────────────────────────────────────────────────────────── -->
<button
    type="button"
    use:tooltip={{ content: "Depositar en caja", side: "top" }}
    onclick={() => store.open("deposit")}
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
>
    <ArrowDownToLine class="h-3.5 w-3.5 shrink-0" />
    <span>Depositar</span>
</button>

<!-- ── Dialog ───────────────────────────────────────────────────────────── -->
<Dialog
    bind:isOpen={store.isOpen}
    size="md"
    title={cashboxName}
    description="Movimientos de caja"
    preventCloseOnEscapeKeyDown={true}
    preventCloseOnInteractOutside={true}
    onClose={store.reset}
>
    {#snippet children()}
        {#if store.successMsg}
            <!-- ── Success ── -->
            <div class="flex flex-col items-center gap-3 py-10 text-center">
                <CircleCheck class="h-12 w-12 {store.isTransfer ? 'text-blue-500' : 'text-emerald-500'}" />
                <p class="text-sm font-semibold text-slate-900">{store.successMsg}</p>
            </div>
        {:else}

            <!-- ── Tabs ── -->
            <div class="flex rounded-lg border border-slate-200 p-0.5 mb-4 bg-slate-50 gap-0.5">
                {#each tabs as tab}
                    <button
                        type="button"
                        onclick={() => store.switchTab(tab.id as any)}
                        class="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all
                            {store.mode === tab.id
                                ? tab.id === 'deposit'
                                    ? 'bg-white shadow-sm text-emerald-700 border border-emerald-100'
                                    : 'bg-white shadow-sm text-blue-700 border border-blue-100'
                                : 'text-slate-400 hover:text-slate-600'}"
                    >
                        <tab.icon class="h-3.5 w-3.5 shrink-0" />
                        <span>{tab.label}</span>
                    </button>
                {/each}
            </div>

            <!-- ── Balance + debt summary strip ── -->
            <div class="mb-4 rounded-xl border border-slate-100 bg-slate-50 divide-y divide-slate-100 text-xs overflow-hidden">
                <div class="flex justify-between items-center px-4 py-2.5">
                    <span class="text-slate-500">Saldo actual</span>
                    <span class="font-bold text-slate-800 tabular-nums">{formatBOB(currentBalance)}</span>
                </div>
                {#if amountNum > 0 && store.isDeposit}
                    <div class="flex justify-between items-center px-4 py-2.5 border-t border-slate-100">
                        <span class="text-slate-500">Saldo tras depósito</span>
                        <span class="font-bold text-emerald-600 tabular-nums">{formatBOB(currentBalance + amountNum)}</span>
                    </div>
                {/if}
                {#if store.isTransfer && store.selectedDestCashbox && amountNum > 0}
                    <div class="flex justify-between items-center px-4 py-2.5 border-t border-slate-100">
                        <span class="text-slate-500">Destino: {store.selectedDestCashbox.name}</span>
                        <span class="font-medium text-blue-700 tabular-nums">
                            {formatBOB(Number(store.selectedDestCashbox.balance))}
                            → {formatBOB(Number(store.selectedDestCashbox.balance) + amountNum)}
                        </span>
                    </div>
                {/if}
            </div>

            <!-- ── Server error ── -->
            {#if store.serverError}
                <div class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-700 flex-1">{store.serverError}</p>
                    <button type="button" onclick={() => (store.serverError = null)} class="text-red-400 hover:text-red-600">
                        <X class="h-4 w-4" />
                    </button>
                </div>
            {/if}

            <!-- ── Form ── -->
            <form id={store.formId} class="space-y-3 px-1 pb-1" onsubmit={store.handleSubmit}>

                <!-- Amount -->
                <div>
                    {#if store.isDeposit && store.gap > 0}
                        <div class="flex justify-end mb-1">
                            <button
                                type="button"
                                onclick={store.fillGap}
                                class="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                            >
                                <Zap class="h-3 w-3" />
                                Cubrir faltante ({formatBOB(store.gap)})
                            </button>
                        </div>
                    {/if}
                    <AmountInput
                        id="amount-{cashboxId}"
                        name="amount"
                        value={store.form.values.amount}
                        accentColor={store.isTransfer ? "red" : "green"}
                        error={store.wouldOverdraw
                            ? "Monto supera el saldo disponible"
                            : (store.form.errors.amount ?? null)}
                        onChange={(v) => store.form.setValue("amount", v)}
                    />
                </div>

                <!-- Transfer fields -->
                {#if store.isTransfer}
                    <div>
                        <label for="dest-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                            Caja destino <span class="text-red-500">*</span>
                        </label>
                        <select
                            id="dest-{cashboxId}"
                            value={(store.transferForm.values as any).toCashboxId}
                            onchange={(e) => store.transferForm.setValue("toCashboxId", (e.currentTarget as HTMLSelectElement).value)}
                            onblur={() => store.transferForm.onBlur("toCashboxId")}
                            required
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                                {(store.transferForm.errors as any).toCashboxId ? 'border-red-400' : ''}"
                        >
                            <option value="">-- Seleccionar caja destino --</option>
                            {#each allCashboxes.filter((c) => c.id !== cashboxId) as cb}
                                <option value={cb.id}>{cb.name} — {formatBOB(Number(cb.balance))}</option>
                            {/each}
                        </select>
                        {#if (store.transferForm.errors as any).toCashboxId}
                            <p class="mt-1 text-xs text-red-600">{(store.transferForm.errors as any).toCashboxId}</p>
                        {/if}
                    </div>

                    <div>
                        <label for="concept-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                            Concepto <span class="text-red-500">*</span>
                        </label>
                        <input
                            id="concept-{cashboxId}"
                            type="text"
                            value={(store.transferForm.values as any).concept}
                            oninput={(e) => store.transferForm.setValue("concept", (e.currentTarget as HTMLInputElement).value)}
                            onblur={() => store.transferForm.onBlur("concept")}
                            maxlength="255"
                            placeholder="Motivo de la transferencia..."
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                                {(store.transferForm.errors as any).concept ? 'border-red-400' : ''}"
                        />
                        {#if (store.transferForm.errors as any).concept}
                            <p class="mt-1 text-xs text-red-600">{(store.transferForm.errors as any).concept}</p>
                        {/if}
                    </div>

                <!-- Deposit: category -->
                {:else}
                    <div>
                        <label for="category-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                            Categoría <span class="text-red-500">*</span>
                        </label>
                        <select
                            id="category-{cashboxId}"
                            value={(store.form.values as any).categoryId}
                            onchange={(e) => store.form.setValue("categoryId", (e.currentTarget as HTMLSelectElement).value)}
                            onblur={() => store.form.onBlur("categoryId")}
                            required
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500
                                {store.form.errors.categoryId ? 'border-red-400' : ''}"
                        >
                            <option value="">-- Seleccionar --</option>
                            {#each incomeCategories as cat}
                                <option value={cat.id}>{cat.name}</option>
                            {/each}
                        </select>
                        {#if store.form.errors.categoryId}
                            <p class="mt-1 text-xs text-red-600">{store.form.errors.categoryId}</p>
                        {/if}
                    </div>
                {/if}

                <!-- Notes -->
                <div>
                    <label for="notes-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                        Notas <span class="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                        id="notes-{cashboxId}"
                        value={(store.form.values as any).notes}
                        oninput={(e) => store.form.setValue("notes", (e.currentTarget as HTMLTextAreaElement).value)}
                        onblur={() => store.form.onBlur("notes")}
                        maxlength="500"
                        rows="2"
                        placeholder={store.isTransfer ? "Observaciones..." : "Observaciones adicionales..."}
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none
                            {store.isTransfer ? 'focus:ring-blue-500' : 'focus:ring-emerald-500'}"
                    ></textarea>
                </div>

                <!-- Reference (deposit only) -->
                {#if !store.isTransfer}
                    <div>
                        <label for="reference-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                            Referencia <span class="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            id="reference-{cashboxId}"
                            type="text"
                            value={(store.form.values as any).reference ?? ""}
                            oninput={(e) => store.form.setValue("reference", (e.currentTarget as HTMLInputElement).value)}
                            maxlength="100"
                            placeholder="Nro. recibo, cheque..."
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                {/if}
            </form>
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        {#if !store.successMsg}
            <button
                type="button"
                onclick={() => { store.reset(); close(); }}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:mr-auto"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form={store.formId}
                disabled={!store.canSubmit}
                class="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 {submitLabel.cls}"
            >
                {#if store.form.isSubmitting}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {submitLabel.busy}
                {:else}
                    {submitLabel.idle}
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
