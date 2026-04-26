<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { Building2, CircleAlert, CircleCheck, Link2, X } from "@lucide/svelte";

    interface CashboxOption {
        id: string;
        name: string;
        code: string;
        balance: string | null;
    }

    interface Props {
        /** Pre-selected cashbox when opened from a specific caja row */
        cashboxId?: string;
        allCashboxes?: CashboxOption[];
        triggerLabel?: string;
        triggerClass?: string;
    }

    let {
        cashboxId = undefined,
        allCashboxes = [],
        triggerLabel = "Nuevo sector",
        triggerClass = "inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors",
    }: Props = $props();

    let isOpen       = $state(false);
    let isSubmitting = $state(false);
    let inputErrors  = $state<Record<string, string | string[]>>({});
    let serverError  = $state<string | null>(null);
    let successMsg   = $state<string | null>(null);

    let name          = $state("");
    let description   = $state("");
    let selectedCashboxId = $state(cashboxId ?? (allCashboxes[0]?.id ?? ""));

    const formId = "create-sector-form";

    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function reset() {
        name = "";
        description = "";
        selectedCashboxId = cashboxId ?? (allCashboxes[0]?.id ?? "");
        inputErrors  = {};
        serverError  = null;
        successMsg   = null;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        const fd = new FormData();
        fd.set("name", name.trim());
        if (description.trim()) fd.set("description", description.trim());
        if (selectedCashboxId) fd.set("cashboxId", selectedCashboxId);

        isSubmitting = true;
        try {
            const result = await actions.sector.createSector(fd);

            if (isInputError(result?.error)) {
                inputErrors = result.error.fields as any;
                return;
            }
            if (result?.error) {
                serverError = result.error.message ?? "Error al crear el sector.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Sector creado.";
                setTimeout(() => {
                    isOpen = false;
                    reset();
                    window.location.reload();
                }, 1000);
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
    title="Nuevo Sector"
    description="Configure el nombre y la descripción del sector."
    preventCloseOnEscapeKeyDown={true}
    preventCloseOnInteractOutside={true}
    onClose={reset}
>
    {#snippet trigger({ open })}
        <button
            type="button"
            onclick={() => { reset(); open(); }}
            class={triggerClass}
        >
            <Building2 class="h-3.5 w-3.5" />
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
            {#if serverError}
                <div class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-700 flex-1">{serverError}</p>
                    <button type="button" onclick={() => (serverError = null)} class="text-red-400 hover:text-red-600">
                        <X class="h-4 w-4" />
                    </button>
                </div>
            {/if}

            <form id={formId} class="space-y-4 px-1 pt-1 pb-1" onsubmit={handleSubmit}>
                <!-- Nombre -->
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">
                        Nombre <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        bind:value={name}
                        required
                        maxlength="100"
                        placeholder="Ej: Sector Norte, Directivo..."
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {fieldError('name') ? 'border-red-400' : 'border-slate-200'}"
                    />
                    {#if fieldError("name")}
                        <p class="mt-1 text-xs text-red-600">{fieldError("name")}</p>
                    {/if}
                </div>

                <!-- Descripcion -->
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">
                        Descripción <span class="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                        type="text"
                        bind:value={description}
                        maxlength="500"
                        placeholder="Descripción del sector..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <!-- Caja vinculada (only shown when allCashboxes provided) -->
                {#if allCashboxes.length > 0}
                    <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">
                            <span class="inline-flex items-center gap-1">
                                <Link2 class="h-3 w-3" />
                                Caja vinculada <span class="text-red-500">*</span>
                            </span>
                        </label>
                        <select
                            bind:value={selectedCashboxId}
                            required
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            {#each allCashboxes as cb (cb.id)}
                                <option value={cb.id}>
                                    {cb.name} ({cb.code}) — Bs {parseFloat(cb.balance ?? "0").toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                                    {cb.id === cashboxId ? " · esta caja" : ""}
                                </option>
                            {/each}
                        </select>
                        {#if fieldError("cashboxId")}
                            <p class="mt-1 text-xs text-red-600">{fieldError("cashboxId")}</p>
                        {/if}
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
                disabled={isSubmitting || !name.trim() || (!selectedCashboxId && allCashboxes.length > 0)}
                class="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creando...
                {:else}
                    <Building2 class="h-4 w-4" />
                    Crear Sector
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
