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
        triggerLabel?: string;
        triggerClass?: string;
    }

    let {
        sectorId,
        initialName,
        initialDescription = null,
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

    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function reset() {
        name = initialName;
        description = initialDescription ?? "";
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
    description="Actualice la configuracion del sector."
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
                        Desactivar "{initialName}"?
                    </p>
                    <p class="text-xs text-amber-700">
                        El sector quedara inactivo. El personal asignado seguira
                        existiendo pero no podra vincularse a una caja ni
                        generar cuotas. Esta accion puede revertirse editando el
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
                        for="name"
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
                    <label
                        for="description"
                        class="block text-xs font-medium text-slate-600 mb-1"
                        >Descripcion</label
                    >
                    <input
                        type="text"
                        bind:value={description}
                        maxlength="500"
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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


