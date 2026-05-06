<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import {
        ArrowDownToLine,
        ArrowLeftRight,
        CircleAlert,
        CircleCheck,
        X,
        Zap,
        BadgeX,
    } from "@lucide/svelte";
    import { formatBOB } from "@/utils/formatters";
    import AmountInput from "@/components/svelte/finance/AmountInput.svelte";
    import { createCashboxOperationsStore } from "@/lib/stores/cashbox-operations.store.svelte";
    import type { CategoryOption, CashboxOption } from "@/lib/stores/cashbox-operations.store.svelte";

    interface Props {
        cashboxId: string;
        cashboxName: string;
        currentBalance: number;
        monthlySalary?: number;
        incomeCategories: CategoryOption[];
        outcomeCategories: CategoryOption[];
        allCashboxes?: CashboxOption[];
        defaultMode?: "deposit" | "transfer" | "debt";
        triggerDepositClass?: string;
    }

    let {
        cashboxId,
        cashboxName,
        currentBalance,
        monthlySalary = 0,
        incomeCategories,
        outcomeCategories,
        allCashboxes = [],
        defaultMode = "deposit",
        triggerDepositClass = "inline-flex items-center justify-center w-7 h-7 rounded border border-transparent text-slate-400 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors",
    }: Props = $props();

    // ── Mode tabs ─────────────────────────────────────────────────────────────
    const tabs: { id: "deposit" | "transfer" | "debt"; label: string; icon: any; color: string; activeClass: string }[] = [
        { id: "deposit",  label: "Depositar",     icon: ArrowDownToLine, color: "emerald", activeClass: "bg-white shadow-sm text-emerald-700 border border-emerald-100" },
        { id: "transfer", label: "Transferir",    icon: ArrowLeftRight,  color: "blue",    activeClass: "bg-white shadow-sm text-blue-700 border border-blue-100" },
        { id: "debt",     label: "Cubrir Deudas", icon: BadgeX,         color: "amber",   activeClass: "bg-white shadow-sm text-amber-700 border border-amber-100" },
    ];

    // ── Store ──────────────────────────────────────────────────────────────────
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

    // ── Submit button label/color ──────────────────────────────────────────────
    const submitLabel = $derived(
        store.isDeposit  ? { idle: "Depositar",    busy: "Depositando...",   cls: "bg-emerald-600 hover:bg-emerald-700" } :
        store.isTransfer ? { idle: "Transferir",   busy: "Transfiriendo...", cls: "bg-blue-600 hover:bg-blue-700" } :
                           { idle: "Cubrir Deuda", busy: "Procesando...",    cls: "bg-amber-600 hover:bg-amber-700" }
    );
</script>

<!-- ── Deposit trigger ─────────────────────────────────────────────────────── -->
<button type="button" title="Depositar en caja" onclick={() => store.open("deposit")} class={triggerDepositClass}>
    <ArrowDownToLine class="h-4 w-4" />
</button>

<!-- ── Dialog ─────────────────────────────────────────────────────────────── -->
<Dialog
    bind:isOpen={store.isOpen}
    size="md"
    title={`${cashboxName}`}
    description="Operaciones de caja: depósito, transferencia y cobertura de deudas."
    preventCloseOnEscapeKeyDown={true}
    preventCloseOnInteractOutside={true}
    onClose={store.reset}
>
    {#snippet children()}
        {#if store.successMsg}
            <div class="flex flex-col items-center gap-3 py-10 text-center">
                <CircleCheck class="h-12 w-12 {store.isDeposit || store.isDebt ? 'text-emerald-500' : 'text-blue-500'}" />
                <p class="text-sm font-semibold text-slate-900">{store.successMsg}</p>
            </div>
        {:else}
            <!-- ── Mode tabs ── -->
            <div class="flex rounded-lg border border-slate-200 p-0.5 mb-4 bg-slate-50 gap-0.5">
                {#each tabs as tab}
                    <button
                        type="button"
                        onclick={() => store.switchTab(tab.id)}
                        class="flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all
                            {store.mode === tab.id ? tab.activeClass : 'text-slate-400 hover:text-slate-600'}"
                    >
                        <tab.icon class="h-3 w-3 shrink-0" />
                        <span class="hidden sm:inline">{tab.label}</span>
                    </button>
                {/each}
            </div>

            <!-- ── Balance summary ── -->
            <div class="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2 text-xs">

                <div class="flex justify-between">
                    <span class="text-slate-500">Saldo actual</span>
                    <span class="font-bold text-slate-800 tabular-nums">{formatBOB(currentBalance)}</span>
                </div>

                {#if store.amountNum > 0}
                    <div class="flex justify-between border-t border-slate-200 pt-2">
                        <span class="text-slate-500">Saldo tras operación</span>
                        <span class="font-bold tabular-nums {store.wouldOverdraw ? 'text-red-600' : (store.isDeposit || store.isDebt) ? 'text-emerald-600' : 'text-slate-800'}">
                            {formatBOB(Math.max(store.balanceAfter, 0))}
                        </span>
                    </div>
                {/if}

                {#if store.isTransfer && store.selectedDestCashbox}
                    <div class="flex justify-between border-t border-slate-200 pt-2">
                        <span class="text-slate-500">Destino: {store.selectedDestCashbox.name}</span>
                        <span class="font-medium text-blue-700 tabular-nums">
                            {formatBOB(Number(store.selectedDestCashbox.balance))}
                            {#if store.amountNum > 0}
                                → {formatBOB(Number(store.selectedDestCashbox.balance) + store.amountNum)}
                            {/if}
                        </span>
                    </div>
                {/if}

                {#if monthlySalary > 0 && (store.isDeposit || store.isDebt)}
                    <div class="flex justify-between">
                        <span class="text-slate-500">Masa salarial</span>
                        <span class="font-medium text-slate-700 tabular-nums">{formatBOB(monthlySalary)}</span>
                    </div>
                    <div>
                        <div class="h-1.5 w-full rounded-full bg-slate-200">
                            <div
                                class="h-1.5 rounded-full transition-all {store.coveragePct >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}"
                                style="width: {store.coveragePct}%"
                            ></div>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5 text-right">{Math.round(store.coveragePct)}% cobertura salarial</p>
                    </div>
                {/if}

                {#if store.isDebt && store.gap > 0}
                    <div class="flex justify-between border-t border-slate-200 pt-2">
                        <span class="text-amber-600 font-medium">Deuda salarial pendiente</span>
                        <span class="font-bold text-amber-700 tabular-nums">{formatBOB(store.gap)}</span>
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

                <!-- Amount (all modes) -->
                <div>
                    {#if (store.isDeposit || store.isDebt) && store.gap > 0}
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
                        error={store.wouldOverdraw ? "Monto supera el saldo disponible" : (store.form.errors.amount ?? null)}
                        onChange={(v) => store.form.setValue("amount", v)}
                    />
                </div>

                <!-- Transfer: destination cashbox + concept -->
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
                            required
                            placeholder="Motivo de la transferencia..."
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                                {(store.transferForm.errors as any).concept ? 'border-red-400' : ''}"
                        />
                        {#if (store.transferForm.errors as any).concept}
                            <p class="mt-1 text-xs text-red-600">{(store.transferForm.errors as any).concept}</p>
                        {/if}
                    </div>

                <!-- Deposit / Debt: income category -->
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
                        placeholder={store.isDebt ? "Origen de los fondos para cubrir la deuda..." : store.isTransfer ? "Observaciones de la transferencia..." : "Observaciones adicionales..."}
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none
                            {(store.form.errors as any).notes ? 'border-red-400' : store.isTransfer ? 'focus:ring-blue-500' : 'focus:ring-emerald-500'}"
                    ></textarea>
                    {#if (store.form.errors as any).notes}
                        <p class="mt-1 text-xs text-red-600">{(store.form.errors as any).notes}</p>
                    {/if}
                </div>

                <!-- Reference (deposit / debt only) -->
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
                            onblur={() => store.form.onBlur("reference")}
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
