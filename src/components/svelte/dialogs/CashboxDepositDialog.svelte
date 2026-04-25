<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import { z } from "zod";
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
        incomeCategories: CategoryOption[];
        outcomeCategories: CategoryOption[];
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

    // ── Schemas ──────────────────────────────────────────────────────────────
    const depositSchema = z.object({
        categoryId: z.string().min(1, "Selecciona una categoría"),
        amount: z
            .string()
            .min(1, "Monto requerido")
            .refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
        notes: z.string().max(500).optional().or(z.literal("")),
        reference: z.string().max(100).optional().or(z.literal("")),
    });

    const withdrawSchema = z.object({
        categoryId: z.string().min(1, "Selecciona una categoría"),
        amount: z
            .string()
            .min(1, "Monto requerido")
            .refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
        notes: z.string().min(1, "Justificación requerida").max(500),
        reference: z.string().max(100).optional().or(z.literal("")),
        authorizedBy: z.string().max(255).optional().or(z.literal("")),
    });

    // ── State ────────────────────────────────────────────────────────────────
    let isOpen = $state(false);
    let mode = $state<"deposit" | "withdraw">(defaultMode);
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    const isDeposit = $derived(mode === "deposit");
    const categories = $derived(isDeposit ? incomeCategories : outcomeCategories);

    // Default categoryId to TRANSFER_IN (deposit) or TRANSFER (withdraw)
    function defaultCategoryId(m: "deposit" | "withdraw") {
        const code = m === "deposit" ? "TRANSFER_IN" : "TRANSFER";
        const list = m === "deposit" ? incomeCategories : outcomeCategories;
        return list.find((c) => c.code === code)?.id ?? list[0]?.id ?? "";
    }

    const depositForm = new ZodForm({
        schema: depositSchema,
        initialValues: {
            categoryId: defaultCategoryId("deposit"),
            amount: "",
            notes: "",
            reference: "",
        },
        validateMode: "onBlur",
    });

    const withdrawForm = new ZodForm({
        schema: withdrawSchema,
        initialValues: {
            categoryId: defaultCategoryId("withdraw"),
            amount: "",
            notes: "",
            reference: "",
            authorizedBy: "",
        },
        validateMode: "onBlur",
    });

    const form = $derived(isDeposit ? depositForm : withdrawForm);

    // ── Derived helpers ───────────────────────────────────────────────────────
    const amountNum = $derived(parseFloat(form.values.amount) || 0);
    const gap = $derived(Math.max(0, monthlySalary - currentBalance));
    const coveragePct = $derived(
        monthlySalary > 0 ? Math.min((currentBalance / monthlySalary) * 100, 100) : 100,
    );
    const balanceAfter = $derived(
        isDeposit ? currentBalance + amountNum : currentBalance - amountNum,
    );
    const wouldOverdraw = $derived(!isDeposit && amountNum > currentBalance);

    const formId = `cashbox-txn-form-${cashboxId}`;

    // ── Helpers ───────────────────────────────────────────────────────────────
    function reset() {
        depositForm.reset({
            categoryId: defaultCategoryId("deposit"),
            amount: "",
            notes: "",
            reference: "",
        });
        withdrawForm.reset({
            categoryId: defaultCategoryId("withdraw"),
            amount: "",
            notes: "",
            reference: "",
            authorizedBy: "",
        });
        serverError = null;
        successMsg = null;
    }

    function open(openMode: "deposit" | "withdraw") {
        mode = openMode;
        reset();
        isOpen = true;
    }

    function fillGap() {
        if (gap > 0) depositForm.setValue("amount", gap.toFixed(2));
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    const onSubmitDeposit = depositForm.handleSubmit(async (values) => {
        serverError = null;
        const fd = new FormData();
        fd.set("cashboxId", cashboxId);
        fd.set("categoryId", values.categoryId);
        fd.set("amount", values.amount);
        if (values.notes?.trim()) fd.set("notes", values.notes.trim());
        if (values.reference?.trim()) fd.set("reference", values.reference.trim());

        const result = await actions.sector.depositToCashbox(fd);

        if (isInputError(result?.error)) {
            depositForm.setErrors(result.error.fields as any);
            return;
        }
        if (result?.error) {
            serverError = result.error.message ?? "Error al depositar.";
            return;
        }
        if (result?.data?.success) {
            successMsg = result.data.message ?? "Depósito registrado.";
            setTimeout(() => { isOpen = false; reset(); window.location.reload(); }, 1400);
        }
    });

    const onSubmitWithdraw = withdrawForm.handleSubmit(async (values) => {
        serverError = null;
        const fd = new FormData();
        fd.set("cashboxId", cashboxId);
        fd.set("categoryId", values.categoryId);
        fd.set("amount", values.amount);
        fd.set("notes", values.notes.trim());
        if (values.reference?.trim()) fd.set("reference", values.reference.trim());
        if (values.authorizedBy?.trim()) fd.set("authorizedBy", values.authorizedBy.trim());

        const result = await actions.finance.withdraw(fd);

        if (isInputError(result?.error)) {
            withdrawForm.setErrors(result.error.fields as any);
            return;
        }
        if (result?.error) {
            serverError = result.error.message ?? "Error al retirar.";
            return;
        }
        if (result?.data?.success) {
            successMsg = result.data.message ?? "Egreso registrado.";
            setTimeout(() => { isOpen = false; reset(); window.location.reload(); }, 1400);
        }
    });

    function handleSubmit(e: SubmitEvent) {
        if (isDeposit) onSubmitDeposit(e);
        else onSubmitWithdraw(e);
    }

    const canSubmit = $derived(
        !form.isSubmitting &&
        !wouldOverdraw &&
        parseFloat(form.values.amount) > 0 &&
        !!form.values.categoryId,
    );
</script>

<!-- ── Deposit trigger ────────────────────────────────────────────────────── -->
<button type="button" title="Depositar en caja" onclick={() => open("deposit")} class={triggerDepositClass}>
    <ArrowDownToLine class="h-4 w-4" />
</button>

<!-- ── Withdraw trigger ───────────────────────────────────────────────────── -->
<button type="button" title="Retirar de caja" onclick={() => open("withdraw")} class={triggerWithdrawClass}>
    <ArrowUpFromLine class="h-4 w-4" />
</button>

<!-- ── Dialog ─────────────────────────────────────────────────────────────── -->
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
                        {isDeposit ? 'bg-white shadow-sm text-emerald-700 border border-emerald-100' : 'text-slate-500 hover:text-slate-700'}"
                >
                    <ArrowDownToLine class="h-3.5 w-3.5" /> Depositar
                </button>
                <button
                    type="button"
                    onclick={() => { mode = "withdraw"; reset(); }}
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
                        {!isDeposit ? 'bg-white shadow-sm text-red-700 border border-red-100' : 'text-slate-500 hover:text-slate-700'}"
                >
                    <ArrowUpFromLine class="h-3.5 w-3.5" /> Retirar
                </button>
            </div>

            <!-- Balance summary -->
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
                    <p class="text-[11px] text-red-600 font-medium pt-1">⚠ Monto supera el saldo disponible</p>
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
                            value={form.values.amount}
                            oninput={(e) => form.setValue("amount", (e.target as HTMLInputElement).value)}
                            onblur={() => form.onBlur("amount")}
                            required
                            placeholder="0.00"
                            class="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2
                                {wouldOverdraw || form.errors.amount ? 'border-red-400 focus:ring-red-400' : isDeposit ? 'border-slate-200 focus:ring-emerald-500' : 'border-slate-200 focus:ring-red-400'}"
                        />
                    </div>
                    {#if form.errors.amount}
                        <p class="mt-1 text-xs text-red-600">{form.errors.amount}</p>
                    {/if}
                </div>

                <!-- Category -->
                <div>
                    <label for="category-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                        Categoría <span class="text-red-500">*</span>
                    </label>
                    <select
                        id="category-{cashboxId}"
                        value={form.values.categoryId}
                        onchange={(e) => form.setValue("categoryId", (e.target as HTMLSelectElement).value)}
                        onblur={() => form.onBlur("categoryId")}
                        required
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2
                            {form.errors.categoryId ? 'border-red-400' : isDeposit ? 'focus:ring-emerald-500' : 'focus:ring-red-400'}"
                    >
                        <option value="">-- Seleccionar --</option>
                        {#each categories as cat}
                            <option value={cat.id}>{cat.name} ({cat.code})</option>
                        {/each}
                    </select>
                    {#if form.errors.categoryId}
                        <p class="mt-1 text-xs text-red-600">{form.errors.categoryId}</p>
                    {/if}
                </div>

                <!-- Notes -->
                <div>
                    <label for="notes-{cashboxId}" class="block text-xs font-medium text-slate-600 mb-1">
                        {isDeposit ? "Notas" : "Justificación"}
                        {#if !isDeposit}
                            <span class="text-red-500">*</span>
                        {:else}
                            <span class="text-slate-400 font-normal">(opcional)</span>
                        {/if}
                    </label>
                    <textarea
                        id="notes-{cashboxId}"
                        value={form.values.notes}
                        oninput={(e) => form.setValue("notes", (e.target as HTMLTextAreaElement).value)}
                        onblur={() => form.onBlur("notes")}
                        maxlength="500"
                        rows="2"
                        required={!isDeposit}
                        placeholder={isDeposit ? "Observaciones adicionales..." : "Motivo del retiro..."}
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none
                            {form.errors.notes ? 'border-red-400' : isDeposit ? 'focus:ring-emerald-500' : 'focus:ring-red-400'}"
                    ></textarea>
                    {#if form.errors.notes}
                        <p class="mt-1 text-xs text-red-600">{form.errors.notes}</p>
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
                        value={form.values.reference}
                        oninput={(e) => form.setValue("reference", (e.target as HTMLInputElement).value)}
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
                            value={(form.values as any).authorizedBy ?? ""}
                            oninput={(e) => (form as any).setValue("authorizedBy", (e.target as HTMLInputElement).value)}
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
                disabled={!canSubmit}
                class="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2
                    {isDeposit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}"
            >
                {#if form.isSubmitting}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {isDeposit ? "Depositando..." : "Retirando..."}
                {:else if isDeposit}
                    <ArrowDownToLine class="h-4 w-4" /> Depositar
                {:else}
                    <ArrowUpFromLine class="h-4 w-4" /> Retirar
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
