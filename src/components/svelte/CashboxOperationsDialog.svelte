<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import { z } from "zod";
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

    interface CategoryOption {
        id: string;
        name: string;
        code: string;
    }

    interface CashboxOption {
        id: string;
        name: string;
        balance: string | number;
    }

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
    type Mode = "deposit" | "transfer" | "debt";

    const tabs: { id: Mode; label: string; icon: any; color: string; activeClass: string }[] = [
        { id: "deposit",  label: "Depositar",    icon: ArrowDownToLine, color: "emerald", activeClass: "bg-white shadow-sm text-emerald-700 border border-emerald-100" },
        { id: "transfer", label: "Transferir",   icon: ArrowLeftRight,  color: "blue",    activeClass: "bg-white shadow-sm text-blue-700 border border-blue-100" },
        { id: "debt",     label: "Cubrir Deudas", icon: BadgeX,         color: "amber",   activeClass: "bg-white shadow-sm text-amber-700 border border-amber-100" },
    ];

    // ── Schemas ───────────────────────────────────────────────────────────────
    const depositSchema = z.object({
        categoryId: z.string().min(1, "Selecciona una categoría"),
        amount:     z.string().min(1, "Monto requerido").refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
        notes:      z.string().max(500).optional().or(z.literal("")),
        reference:  z.string().max(100).optional().or(z.literal("")),
    });

    const transferSchema = z.object({
        toCashboxId: z.string().min(1, "Selecciona la caja destino"),
        amount:      z.string().min(1, "Monto requerido").refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
        concept:     z.string().min(1, "Concepto requerido").max(255),
        notes:       z.string().max(500).optional().or(z.literal("")),
    });

    const debtSchema = z.object({
        amount:     z.string().min(1, "Monto requerido").refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
        categoryId: z.string().min(1, "Selecciona una categoría"),
        notes:      z.string().max(500).optional().or(z.literal("")),
        reference:  z.string().max(100).optional().or(z.literal("")),
    });

    // ── State ─────────────────────────────────────────────────────────────────
    let isOpen      = $state(false);
    let mode        = $state<Mode>(defaultMode);
    let serverError = $state<string | null>(null);
    let successMsg  = $state<string | null>(null);

    // ── Derived ───────────────────────────────────────────────────────────────
    const isDeposit  = $derived(mode === "deposit");
    const isTransfer = $derived(mode === "transfer");
    const isDebt     = $derived(mode === "debt");

    const otherCashboxes = $derived(allCashboxes.filter((c) => c.id !== cashboxId));

    function defaultCategoryId() {
        return incomeCategories.find((c) => c.code === "TRANSFER_IN")?.id ?? incomeCategories[0]?.id ?? "";
    }

    function categoryName(categoryId: string, list: CategoryOption[]) {
        return list.find((c) => c.id === categoryId)?.name ?? "Movimiento de caja";
    }

    // ── Forms ─────────────────────────────────────────────────────────────────
    const depositForm = new ZodForm({
        schema: depositSchema,
        initialValues: { categoryId: defaultCategoryId(), amount: "", notes: "", reference: "" },
        validateMode: "onBlur",
    });

    const transferForm = new ZodForm({
        schema: transferSchema,
        initialValues: { toCashboxId: "", amount: "", concept: "", notes: "" },
        validateMode: "onBlur",
    });

    const debtForm = new ZodForm({
        schema: debtSchema,
        initialValues: { categoryId: defaultCategoryId(), amount: "", notes: "", reference: "" },
        validateMode: "onBlur",
    });

    // Active form per mode
    const form = $derived(
        isDeposit  ? depositForm  :
        isTransfer ? transferForm :
                     debtForm
    );

    // ── Derived helpers ───────────────────────────────────────────────────────
    const amountNum   = $derived(parseFloat(form.values.amount) || 0);
    const gap         = $derived(Math.max(0, monthlySalary - currentBalance));
    const coveragePct = $derived(monthlySalary > 0 ? Math.min((currentBalance / monthlySalary) * 100, 100) : 100);

    const balanceAfter  = $derived(
        isDeposit || isDebt ? currentBalance + amountNum : currentBalance - amountNum
    );
    const wouldOverdraw = $derived(isTransfer && amountNum > currentBalance);
    const formId        = `cashbox-ops-form-${cashboxId}`;

    const selectedDestCashbox = $derived(
        isTransfer ? otherCashboxes.find((c) => c.id === (transferForm.values as any).toCashboxId) : null
    );

    // ── Helpers ───────────────────────────────────────────────────────────────
    function reset() {
        depositForm.reset({ categoryId: defaultCategoryId(), amount: "", notes: "", reference: "" });
        transferForm.reset({ toCashboxId: "", amount: "", concept: "", notes: "" });
        debtForm.reset({ categoryId: defaultCategoryId(), amount: "", notes: "", reference: "" });
        serverError = null;
        successMsg  = null;
    }

    function open(openMode: Mode) {
        mode = openMode;
        reset();
        isOpen = true;
    }

    function fillGap() {
        if (gap > 0) {
            if (isDeposit) depositForm.setValue("amount", gap.toFixed(2));
            if (isDebt)    debtForm.setValue("amount", gap.toFixed(2));
        }
    }

    function switchTab(t: Mode) {
        mode = t;
        serverError = null;
        successMsg  = null;
    }

    function setFormValue(field: string, value: string, shouldValidate = false) {
        (form as ZodForm<any>).setValue(field, value, { validate: shouldValidate });
    }

    function setTransferValue(field: string, value: string, shouldValidate = false) {
        transferForm.setValue(field as any, value as any, { validate: shouldValidate });
    }

    function setTextValue(field: string, e: Event) {
        setFormValue(field, (e.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value);
    }

    function setTransferTextValue(field: string, e: Event) {
        setTransferValue(field, (e.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value);
    }

    // ── Submit handlers ───────────────────────────────────────────────────────
    const onSubmitDeposit = depositForm.handleSubmit(async (values) => {
        serverError = null;
        const fd = new FormData();
        fd.set("cashboxId",  cashboxId);
        fd.set("categoryId", values.categoryId);
        fd.set("amount",     values.amount);
        fd.set("concept",    categoryName(values.categoryId, incomeCategories));
        if (values.notes?.trim())     fd.set("notes",     values.notes.trim());
        if (values.reference?.trim()) fd.set("reference", values.reference.trim());

        const result = await actions.sector.depositToCashbox(fd);
        if (isInputError(result?.error)) { depositForm.setErrors(result.error.fields as any); return; }
        if (result?.error) { serverError = result.error.message ?? "Error al depositar."; return; }
        if (result?.data?.success) {
            successMsg = result.data.message ?? "Depósito registrado.";
            setTimeout(() => { isOpen = false; reset(); window.location.reload(); }, 1400);
        }
    });

    const onSubmitTransfer = transferForm.handleSubmit(async (values) => {
        serverError = null;
        const fd = new FormData();
        fd.set("fromCashboxId", cashboxId);
        fd.set("toCashboxId",   (values as any).toCashboxId);
        fd.set("amount",        values.amount);
        fd.set("concept",       (values as any).concept.trim());
        if ((values as any).notes?.trim()) fd.set("notes", (values as any).notes.trim());

        const result = await actions.finance.transfer(fd);
        if (isInputError(result?.error)) { transferForm.setErrors(result.error.fields as any); return; }
        if (result?.error) { serverError = result.error.message ?? "Error al transferir."; return; }
        if (result?.data?.success) {
            successMsg = result.data.message ?? "Transferencia registrada.";
            setTimeout(() => { isOpen = false; reset(); window.location.reload(); }, 1400);
        }
    });

    const onSubmitDebt = debtForm.handleSubmit(async (values) => {
        serverError = null;
        const fd = new FormData();
        fd.set("cashboxId",  cashboxId);
        fd.set("categoryId", values.categoryId);
        fd.set("amount",     values.amount);
        fd.set("concept",    `Cobertura deuda salarial - ${categoryName(values.categoryId, incomeCategories)}`);
        fd.set("notes",      `[Cobertura deuda salarial] ${(values.notes ?? "").trim()}`);
        if ((values as any).reference?.trim()) fd.set("reference", (values as any).reference.trim());

        const result = await actions.sector.depositToCashbox(fd);
        if (isInputError(result?.error)) { debtForm.setErrors(result.error.fields as any); return; }
        if (result?.error) { serverError = result.error.message ?? "Error al cubrir deuda."; return; }
        if (result?.data?.success) {
            successMsg = result.data.message ?? "Deuda cubierta correctamente.";
            setTimeout(() => { isOpen = false; reset(); window.location.reload(); }, 1400);
        }
    });

    function handleSubmit(e: SubmitEvent) {
        if (isDeposit)       onSubmitDeposit(e);
        else if (isTransfer) onSubmitTransfer(e);
        else                 onSubmitDebt(e);
    }

    const canSubmit = $derived(
        !form.isSubmitting &&
        !wouldOverdraw &&
        amountNum > 0 &&
        (isTransfer
            ? !!(transferForm.values as any).toCashboxId && !!(transferForm.values as any).concept
            : !!(form.values as any).categoryId)
    );

    // ── Submit button label/color ─────────────────────────────────────────────
    const submitLabel = $derived(
        isDeposit  ? { idle: "Depositar",    busy: "Depositando...",   cls: "bg-emerald-600 hover:bg-emerald-700" } :
        isTransfer ? { idle: "Transferir",   busy: "Transfiriendo...", cls: "bg-blue-600 hover:bg-blue-700" } :
                     { idle: "Cubrir Deuda", busy: "Procesando...",    cls: "bg-amber-600 hover:bg-amber-700" }
    );
</script>

<!-- ── Deposit trigger ─────────────────────────────────────────────────────── -->
<button type="button" title="Depositar en caja" onclick={() => open("deposit")} class={triggerDepositClass}>
    <ArrowDownToLine class="h-4 w-4" />
</button>

<!-- ── Dialog ─────────────────────────────────────────────────────────────── -->
<Dialog
    bind:isOpen
    size="md"
    title={`${cashboxName}`}
    description="Operaciones de caja: depósito, transferencia y cobertura de deudas."
    preventCloseOnEscapeKeyDown={true}
    preventCloseOnInteractOutside={true}
    onClose={reset}
>
    {#snippet children()}
        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-10 text-center">
                <CircleCheck class="h-12 w-12 {isDeposit || isDebt ? 'text-emerald-500' : 'text-blue-500'}" />
                <p class="text-sm font-semibold text-slate-900">{successMsg}</p>
            </div>
        {:else}
            <!-- ── Mode tabs ── -->
            <div class="flex rounded-lg border border-slate-200 p-0.5 mb-4 bg-slate-50 gap-0.5">
                {#each tabs as tab}
                    <button
                        type="button"
                        onclick={() => switchTab(tab.id)}
                        class="flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all
                            {mode === tab.id ? tab.activeClass : 'text-slate-400 hover:text-slate-600'}"
                    >
                        <tab.icon class="h-3 w-3 shrink-0" />
                        <span class="hidden sm:inline">{tab.label}</span>
                    </button>
                {/each}
            </div>

            <!-- ── Balance summary ── -->
            <div class="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2 text-xs">

                {#if isDeposit}
                    <div class="flex justify-between">
                        <span class="text-slate-500">Saldo actual</span>
                        <span class="font-bold text-slate-800 tabular-nums">{formatBOB(currentBalance)}</span>
                    </div>
                {:else}
                    <div class="flex justify-between">
                        <span class="text-slate-500">Saldo actual</span>
                        <span class="font-bold text-slate-800 tabular-nums">{formatBOB(currentBalance)}</span>
                    </div>
                {/if}

                {#if amountNum > 0}
                    <div class="flex justify-between border-t border-slate-200 pt-2">
                        <span class="text-slate-500">Saldo tras operación</span>
                        <span class="font-bold tabular-nums {wouldOverdraw ? 'text-red-600' : (isDeposit || isDebt) ? 'text-emerald-600' : 'text-slate-800'}">
                            {formatBOB(Math.max(balanceAfter, 0))}
                        </span>
                    </div>
                {/if}

                {#if isTransfer && selectedDestCashbox}
                    <div class="flex justify-between border-t border-slate-200 pt-2">
                        <span class="text-slate-500">Destino: {selectedDestCashbox.name}</span>
                        <span class="font-medium text-blue-700 tabular-nums">
                            {formatBOB(Number(selectedDestCashbox.balance))}
                            {#if amountNum > 0}
                                → {formatBOB(Number(selectedDestCashbox.balance) + amountNum)}
                            {/if}
                        </span>
                    </div>
                {/if}

                {#if monthlySalary > 0 && (isDeposit || isDebt)}
                    <div class="flex justify-between">
                        <span class="text-slate-500">Masa salarial</span>
                        <span class="font-medium text-slate-700 tabular-nums">{formatBOB(monthlySalary)}</span>
                    </div>
                    <div>
                        <div class="h-1.5 w-full rounded-full bg-slate-200">
                            <div
                                class="h-1.5 rounded-full transition-all {coveragePct >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}"
                                style="width: {coveragePct}%"
                            ></div>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5 text-right">{Math.round(coveragePct)}% cobertura salarial</p>
                    </div>
                {/if}

                {#if isDebt && gap > 0}
                    <div class="flex justify-between border-t border-slate-200 pt-2">
                        <span class="text-amber-600 font-medium">Deuda salarial pendiente</span>
                        <span class="font-bold text-amber-700 tabular-nums">{formatBOB(gap)}</span>
                    </div>
                {/if}

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
            <form id={formId} class="space-y-3 px-1 pb-1" onsubmit={handleSubmit}>

                <!-- Amount (all modes) -->
                <div>
                    {#if (isDeposit || isDebt) && gap > 0}
                        <div class="flex justify-end mb-1">
                            <button
                                type="button"
                                onclick={fillGap}
                                class="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                            >
                                <Zap class="h-3 w-3" />
                                Cubrir faltante ({formatBOB(gap)})
                            </button>
                        </div>
                    {/if}
                    <AmountInput
                        id="amount-{cashboxId}"
                        name="amount"
                        value={form.values.amount}
                        accentColor={isTransfer ? "red" : "green"}
                        error={wouldOverdraw ? "Monto supera el saldo disponible" : (form.errors.amount ?? null)}
                        onChange={(v) => setFormValue("amount", v)}
                    />
                </div>

                <!-- Transfer: destination cashbox + concept -->
                {#if isTransfer}
                    <div>
                        <label for="dest-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                            Caja destino <span class="text-red-500">*</span>
                        </label>
                        <select
                            id="dest-{cashboxId}"
                            value={(transferForm.values as any).toCashboxId}
                            onchange={(e) => setTransferTextValue("toCashboxId", e)}
                            onblur={() => transferForm.onBlur("toCashboxId")}
                            required
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                                {(transferForm.errors as any).toCashboxId ? 'border-red-400' : ''}"
                        >
                            <option value="">-- Seleccionar caja destino --</option>
                            {#each otherCashboxes as cb}
                                <option value={cb.id}>{cb.name} — {formatBOB(Number(cb.balance))}</option>
                            {/each}
                        </select>
                        {#if (transferForm.errors as any).toCashboxId}
                            <p class="mt-1 text-xs text-red-600">{(transferForm.errors as any).toCashboxId}</p>
                        {/if}
                    </div>

                    <div>
                        <label for="concept-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                            Concepto <span class="text-red-500">*</span>
                        </label>
                        <input
                            id="concept-{cashboxId}"
                            type="text"
                            value={(transferForm.values as any).concept}
                            oninput={(e) => setTransferTextValue("concept", e)}
                            onblur={() => transferForm.onBlur("concept")}
                            maxlength="255"
                            required
                            placeholder="Motivo de la transferencia..."
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                                {(transferForm.errors as any).concept ? 'border-red-400' : ''}"
                        />
                        {#if (transferForm.errors as any).concept}
                            <p class="mt-1 text-xs text-red-600">{(transferForm.errors as any).concept}</p>
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
                            value={(form.values as any).categoryId}
                            onchange={(e) => setTextValue("categoryId", e)}
                            onblur={() => form.onBlur("categoryId")}
                            required
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500
                                {form.errors.categoryId ? 'border-red-400' : ''}"
                        >
                            <option value="">-- Seleccionar --</option>
                            {#each incomeCategories as cat}
                                <option value={cat.id}>{cat.name}</option>
                            {/each}
                        </select>
                        {#if form.errors.categoryId}
                            <p class="mt-1 text-xs text-red-600">{form.errors.categoryId}</p>
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
                        value={(form.values as any).notes}
                        oninput={(e) => setTextValue("notes", e)}
                        onblur={() => form.onBlur("notes")}
                        maxlength="500"
                        rows="2"
                        placeholder={isDebt ? "Origen de los fondos para cubrir la deuda..." : isTransfer ? "Observaciones de la transferencia..." : "Observaciones adicionales..."}
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none
                            {(form.errors as any).notes ? 'border-red-400' : isTransfer ? 'focus:ring-blue-500' : 'focus:ring-emerald-500'}"
                    ></textarea>
                    {#if (form.errors as any).notes}
                        <p class="mt-1 text-xs text-red-600">{(form.errors as any).notes}</p>
                    {/if}
                </div>

                <!-- Reference (deposit / debt only) -->
                {#if !isTransfer}
                    <div>
                        <label for="reference-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                            Referencia <span class="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            id="reference-{cashboxId}"
                            type="text"
                            value={(form.values as any).reference ?? ""}
                            oninput={(e) => setTextValue("reference", e)}
                            onblur={() => form.onBlur("reference")}
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
                disabled={!canSubmit}
                class="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 {submitLabel.cls}"
            >
                {#if form.isSubmitting}
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
