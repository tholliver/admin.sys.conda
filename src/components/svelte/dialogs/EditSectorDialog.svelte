<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import {
        Pencil,
        CircleAlert,
        CircleCheck,
        X,
        Trash2,
    } from "@lucide/svelte";

    interface Props {
        sectorId: number;
        initialName: string;
        initialDescription?: string | null;
        initialFeeAmount: number;
        initialFeeCurrency: string;
        initialMonthlyFeeAmount: number;
        triggerLabel?: string;
        triggerClass?: string;
    }

    let {
        sectorId,
        initialName,
        initialDescription = null,
        initialFeeAmount,
        initialFeeCurrency,
        initialMonthlyFeeAmount,
        triggerLabel = "Configurar",
        triggerClass = "rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors",
    }: Props = $props();

    let isOpen = $state(false);
    let isSubmitting = $state(false);
    let isDeactivating = $state(false);
    let inputErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);
    let showDeactivateConfirm = $state(false);
    const formId = `edit-sector-form-${sectorId}`;

    let name = $state(initialName);
    let description = $state(initialDescription ?? "");
    let feeAmount = $state(String(initialFeeAmount));
    let feeCurrency = $state(initialFeeCurrency);
    let monthlyFeeAmount = $state(String(initialMonthlyFeeAmount));

    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function reset() {
        name = initialName;
        description = initialDescription ?? "";
        feeAmount = String(initialFeeAmount);
        feeCurrency = initialFeeCurrency;
        monthlyFeeAmount = String(initialMonthlyFeeAmount);
        inputErrors = {};
        serverError = null;
        successMsg = null;
        showDeactivateConfirm = false;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        const fd = new FormData();
        fd.set("id", String(sectorId));
        fd.set("name", name.trim());
        if (description.trim()) fd.set("description", description.trim());
        fd.set("feeAmount", feeAmount);
        fd.set("feeCurrency", feeCurrency);
        fd.set("monthlyFeeAmount", monthlyFeeAmount);

        isSubmitting = true;
        try {
            const result = await actions.sector.updateSector(fd);

            if (isInputError(result?.error)) {
                inputErrors = result.error.fields as any;
                return;
            }
            if (result?.error) {
                serverError =
                    result.error.message ?? "Error al actualizar el sector.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Sector actualizado.";
                setTimeout(() => {
                    isOpen = false;
                    reset();
                    window.location.reload();
                }, 900);
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    async function handleDeactivate() {
        serverError = null;
        isDeactivating = true;
        try {
            const fd = new FormData();
            fd.set("id", String(sectorId));
            const result = await actions.sector.deactivateSector(fd);

            if (result?.error) {
                serverError = result.error.message ?? "Error al desactivar.";
                showDeactivateConfirm = false;
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Sector desactivado.";
                setTimeout(() => {
                    isOpen = false;
                    reset();
                    window.location.reload();
                }, 900);
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isDeactivating = false;
        }
    }
</script>

<Dialog
    bind:isOpen
    size="md"
    title="Editar Sector"
    description="Actualice la configuración del sector y sus cuotas."
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
            <Pencil class="h-3 w-3 inline -mt-0.5 mr-1" />
            {triggerLabel}
        </button>
    {/snippet}

    {#snippet children()}
        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-8 text-center">
                <CircleCheck class="h-10 w-10 text-emerald-500" />
                <p class="text-sm font-semibold text-slate-900">{successMsg}</p>
            </div>
        {:else if showDeactivateConfirm}
            <div class="space-y-4 py-2">
                <div
                    class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
                >
                    <p class="font-semibold mb-1">
                        ¿Desactivar "{initialName}"?
                    </p>
                    <p class="text-xs text-amber-700">
                        El sector quedará inactivo. El personal asignado seguirá
                        existiendo pero no podrá vincularse a una caja ni
                        generar cuotas. Esta acción puede revertirse editando el
                        sector directamente en la BD.
                    </p>
                </div>
                <div class="flex gap-2 justify-end">
                    <button
                        type="button"
                        onclick={() => (showDeactivateConfirm = false)}
                        class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={handleDeactivate}
                        disabled={isDeactivating}
                        class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {#if isDeactivating}
                            <div
                                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                            ></div>
                        {:else}
                            <Trash2 class="h-4 w-4" />
                        {/if}
                        Desactivar
                    </button>
                </div>
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
                id={formId}
                class="space-y-4 px-1 pt-1 pb-1"
                onsubmit={handleSubmit}
            >
                <div>
                    <label
                        class="block text-xs font-medium text-slate-600 mb-1"
                    >
                        Nombre <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        bind:value={name}
                        required
                        maxlength="100"
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {fieldError('name')
                            ? 'border-red-400'
                            : 'border-slate-200'}"
                    />
                    {#if fieldError("name")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("name")}
                        </p>
                    {/if}
                </div>

                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1"
                        >Descripción</label
                    >
                    <input
                        type="text"
                        bind:value={description}
                        maxlength="500"
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div
                    class="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3"
                >
                    <p
                        class="text-xs font-semibold text-slate-600 uppercase tracking-wide"
                    >
                        Cuotas
                    </p>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label
                                class="block text-xs font-medium text-slate-600 mb-1"
                            >
                                Cuota de ingreso <span class="text-red-500"
                                    >*</span
                                >
                            </label>
                            <div class="relative">
                                <span
                                    class="absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none"
                                    >Bs</span
                                >
                                <input
                                    type="number"
                                    bind:value={feeAmount}
                                    min="0"
                                    step="0.01"
                                    required
                                    class="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                                        {fieldError('feeAmount')
                                        ? 'border-red-400'
                                        : ''}"
                                />
                            </div>
                            {#if fieldError("feeAmount")}
                                <p class="mt-1 text-xs text-red-600">
                                    {fieldError("feeAmount")}
                                </p>
                            {/if}
                        </div>

                        <div>
                            <label
                                class="block text-xs font-medium text-slate-600 mb-1"
                            >
                                Cuota mensual <span class="text-red-500">*</span
                                >
                            </label>
                            <div class="relative">
                                <span
                                    class="absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none"
                                    >Bs</span
                                >
                                <input
                                    type="number"
                                    bind:value={monthlyFeeAmount}
                                    min="0"
                                    step="0.01"
                                    required
                                    class="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                                        {fieldError('monthlyFeeAmount')
                                        ? 'border-red-400'
                                        : ''}"
                                />
                            </div>
                            {#if fieldError("monthlyFeeAmount")}
                                <p class="mt-1 text-xs text-red-600">
                                    {fieldError("monthlyFeeAmount")}
                                </p>
                            {/if}
                        </div>
                    </div>

                    <div>
                        <label
                            class="block text-xs font-medium text-slate-600 mb-1"
                            >Moneda</label
                        >
                        <select
                            bind:value={feeCurrency}
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="BOB">BOB — Boliviano</option>
                            <option value="USD">USD — Dólar</option>
                        </select>
                    </div>
                </div>
            </form>
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        {#if !successMsg && !showDeactivateConfirm}
            <button
                type="button"
                onclick={() => (showDeactivateConfirm = true)}
                class="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors sm:mr-auto inline-flex items-center gap-1.5"
            >
                <Trash2 class="h-3.5 w-3.5" />
                Desactivar sector
            </button>
            <button
                type="button"
                onclick={() => {
                    reset();
                    close();
                }}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form={formId}
                disabled={isSubmitting || !name.trim()}
                class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Guardando...
                {:else}
                    <Pencil class="h-4 w-4" />
                    Guardar
                {/if}
            </button>
        {:else if !successMsg && showDeactivateConfirm}
            <!-- deactivate confirm buttons are rendered inside children -->
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
