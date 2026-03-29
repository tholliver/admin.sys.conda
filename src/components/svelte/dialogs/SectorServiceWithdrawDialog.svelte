<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import {
        ArrowDownCircle,
        CircleAlert,
        CircleCheck,
        X,
        Building2,
    } from "@lucide/svelte";

    // ── Props ─────────────────────────────────────────────────────────────────
    // Pass these from the Astro page that renders this dialog.
    // sectors: array of { id: number; name: string; cashboxId: string; cashboxName: string }
    // outcomeCategories: array of { id: string; name: string; code: string }
    interface Sector {
        id: number;
        name: string;
        cashboxId: string;
        cashboxName: string;
    }

    interface Category {
        id: string;
        name: string;
        code: string;
    }

    interface Props {
        sectors: Sector[];
        outcomeCategories: Category[];
    }

    let { sectors, outcomeCategories }: Props = $props();

    // ── State ─────────────────────────────────────────────────────────────────
    let isOpen = $state(false);
    let submitting = $state(false);
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    // form fields
    let sectorId = $state<number | "">("");
    let categoryId = $state<string>("");
    let period = $state<string>(currentPeriod());
    let amount = $state<string>("");
    let concept = $state<string>("");
    let notes = $state<string>("");

    // field errors
    let errors = $state<Record<string, string>>({});

    // ── Derived ───────────────────────────────────────────────────────────────
    // Auto-resolve cashbox from selected sector
    let resolvedSector = $derived(
        sectors.find((s) => s.id === Number(sectorId)) ?? null,
    );

    // ── Helpers ───────────────────────────────────────────────────────────────
    function currentPeriod(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    function resetState() {
        serverError = null;
        successMsg = null;
        errors = {};
        sectorId = "";
        categoryId = "";
        period = currentPeriod();
        amount = "";
        concept = "";
        notes = "";
    }

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!sectorId) e.sectorId = "Seleccione un sector";
        if (!categoryId) e.categoryId = "Seleccione una categoría";
        if (!period.match(/^\d{4}-\d{2}$/))
            e.period = "Formato inválido (YYYY-MM)";
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0)
            e.amount = "Ingrese un monto válido mayor a 0";
        if (!concept.trim()) e.concept = "Ingrese el concepto del gasto";
        errors = e;
        return Object.keys(e).length === 0;
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    async function onSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (!validate()) return;

        submitting = true;
        serverError = null;

        try {
            const fd = new FormData();
            fd.set("cashboxId", resolvedSector!.cashboxId);
            fd.set("sectorId", String(sectorId));
            fd.set("categoryId", categoryId);
            fd.set("period", period);
            fd.set("amount", amount);
            fd.set("concept", concept.trim());
            if (notes.trim()) fd.set("description", notes.trim());

            // Reuses your existing withdraw action — same as WithdrawForm.svelte
            const result = await actions.finance.withdraw(fd);

            if (isInputError(result?.error)) {
                const mapped: Record<string, string> = {};
                for (const [key, val] of Object.entries(result.error.fields)) {
                    mapped[key] = Array.isArray(val) ? val[0] : String(val);
                }
                errors = mapped;
                return;
            }

            if (result?.error) {
                serverError =
                    result.error.message ?? "Error al registrar el gasto.";
                return;
            }

            if (result?.data?.success) {
                successMsg = `Gasto registrado — ${resolvedSector!.cashboxName}`;
                setTimeout(() => {
                    isOpen = false;
                    resetState();
                    window.location.reload();
                }, 900);
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            submitting = false;
        }
    }
</script>

<Dialog
    bind:isOpen
    size="md"
    title="Registrar Gasto de Sector"
    description="Egreso mensual por servicio — la caja se resuelve automáticamente del sector"
    preventCloseOnInteractOutside={true}
    preventCloseOnEscapeKeyDown={true}
    onClose={resetState}
>
    {#snippet trigger({ open })}
        <button
            onclick={() => {
                resetState();
                open();
            }}
            class="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
            <ArrowDownCircle class="h-4 w-4" />
            Gasto de Sector
        </button>
    {/snippet}

    {#snippet children()}
        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-10 text-center">
                <CircleCheck class="h-12 w-12 text-emerald-500" />
                <p class="font-semibold text-slate-900">{successMsg}</p>
                <p class="text-sm text-slate-500">Cerrando...</p>
            </div>
        {:else}
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
                id="sector-service-withdraw-form"
                class="space-y-4 p-4"
                onsubmit={onSubmit}
            >
                <!-- ── Sector (drives cashbox) ─────────────────────────── -->
                <div>
                    <label
                        for="sector-select"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Sector <span class="text-red-500">*</span>
                    </label>
                    <select
                        bind:value={sectorId}
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white
                        {errors.sectorId
                            ? 'border-red-400'
                            : 'border-slate-200'}"
                    >
                        <option value="">— Seleccionar sector —</option>
                        {#each sectors as s}
                            <option value={s.id}>{s.name}</option>
                        {/each}
                    </select>
                    {#if errors.sectorId}
                        <p class="mt-1 text-xs text-red-600">
                            {errors.sectorId}
                        </p>
                    {/if}
                </div>

                <!-- ── Cashbox resolved (read-only feedback) ──────────── -->
                {#if resolvedSector}
                    <div
                        class="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
                    >
                        <Building2 class="h-4 w-4 text-slate-400 shrink-0" />
                        <span class="text-sm text-slate-500">Caja:</span>
                        <span class="text-sm font-medium text-slate-800"
                            >{resolvedSector.cashboxName}</span
                        >
                    </div>
                {/if}

                <!-- ── Category + Period ──────────────────────────────── -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            for="category-select"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Categoría <span class="text-red-500">*</span>
                        </label>
                        <select
                            bind:value={categoryId}
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white
                            {errors.categoryId
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        >
                            <option value="">— Categoría —</option>
                            {#each outcomeCategories as cat}
                                <option value={cat.id}>{cat.name}</option>
                            {/each}
                        </select>
                        {#if errors.categoryId}
                            <p class="mt-1 text-xs text-red-600">
                                {errors.categoryId}
                            </p>
                        {/if}
                    </div>

                    <div>
                        <label
                            for="period-select"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Período <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="month"
                            bind:value={period}
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {errors.period
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if errors.period}
                            <p class="mt-1 text-xs text-red-600">
                                {errors.period}
                            </p>
                        {/if}
                    </div>
                </div>

                <!-- ── Concept + Amount ───────────────────────────────── -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            for="concept-input"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Concepto <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            bind:value={concept}
                            placeholder="Ej: Luz eléctrica oficina"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {errors.concept
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if errors.concept}
                            <p class="mt-1 text-xs text-red-600">
                                {errors.concept}
                            </p>
                        {/if}
                    </div>

                    <div>
                        <label
                            for="amount-input"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Monto (BOB) <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            bind:value={amount}
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {errors.amount
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if errors.amount}
                            <p class="mt-1 text-xs text-red-600">
                                {errors.amount}
                            </p>
                        {/if}
                    </div>
                </div>

                <!-- ── Notes (optional) ───────────────────────────────── -->
                <div>
                    <label
                        for="notes-input"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Notas <span class="text-slate-400 font-normal text-xs"
                            >(opcional)</span
                        >
                    </label>
                    <textarea
                        rows="2"
                        bind:value={notes}
                        placeholder="Detalles adicionales del gasto..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                    resetState();
                    close();
                }}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:mr-auto"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="sector-service-withdraw-form"
                disabled={submitting}
                class="rounded-lg bg-rose-600 px-6 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {#if submitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Registrando...
                {:else}
                    <ArrowDownCircle class="h-4 w-4" />
                    Registrar gasto
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
