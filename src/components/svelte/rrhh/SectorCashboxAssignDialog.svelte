<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { CircleAlert, CircleCheck, Link2, X } from "@lucide/svelte";

    interface SectorOption {
        id: number;
        name: string;
    }

    interface CashboxOption {
        id: string;
        name: string;
        code: string;
        balance: string | null;
    }

    interface Props {
        sectors: SectorOption[];
        cashboxes: CashboxOption[];
        initialSectorId?: number | null;
        initialCashboxId?: string | null;
        lockSector?: boolean;
        triggerLabel?: string;
        triggerClass?: string;
        title?: string;
        description?: string;
    }

    let {
        sectors,
        cashboxes,
        initialSectorId = null,
        initialCashboxId = null,
        lockSector = false,
        triggerLabel = "Vincular",
        triggerClass = "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors",
        title = "Vincular sector a caja",
        description = "Seleccione el sector y la caja para guardar la asignacion",
    }: Props = $props();

    let isOpen = $state(false);
    let isSubmitting = $state(false);
    let inputErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);
    const formId = `sector-cashbox-link-form-${Math.random().toString(36).slice(2)}`;

    let sectorId = $state(initialSectorId ? String(initialSectorId) : "");
    let cashboxId = $state(initialCashboxId ?? "");
    const selectedSectorName = $derived(
        sectors.find((s) => String(s.id) === sectorId)?.name ??
            "Sector no encontrado",
    );

    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function resetState() {
        inputErrors = {};
        serverError = null;
        successMsg = null;
        sectorId = initialSectorId ? String(initialSectorId) : "";
        cashboxId = initialCashboxId ?? "";
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        const fd = new FormData();
        fd.set("sectorId", sectorId);
        fd.set("cashboxId", cashboxId);

        isSubmitting = true;
        try {
            const result = await actions.sector.linkSectorCashbox(fd);

            if (isInputError(result?.error)) {
                inputErrors = result.error.fields as any;
                return;
            }
            if (result?.error) {
                serverError =
                    result.error.message ??
                    "No se pudo guardar la vinculacion.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Vinculacion guardada.";
                setTimeout(() => {
                    isOpen = false;
                    resetState();
                    window.location.reload();
                }, 900);
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
    size="sm"
    {title}
    {description}
    preventCloseOnEscapeKeyDown={true}
    preventCloseOnInteractOutside={true}
    onClose={resetState}
>
    {#snippet trigger({ open })}
        <button
            type="button"
            onclick={() => {
                resetState();
                open();
            }}
            class={triggerClass}
        >
            {triggerLabel}
        </button>
    {/snippet}

    {#snippet children()}
        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-7 text-center">
                <CircleCheck class="h-10 w-10 text-emerald-500" />
                <p class="text-sm font-semibold text-slate-900">{successMsg}</p>
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
                        Sector <span class="text-red-500">*</span>
                    </label>
                    {#if lockSector}
                        <div
                            class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                        >
                            {selectedSectorName}
                        </div>
                    {:else}
                        <select
                            bind:value={sectorId}
                            required
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- Seleccionar --</option>
                            {#each sectors as s}
                                <option value={s.id}>{s.name}</option>
                            {/each}
                        </select>
                    {/if}
                    {#if fieldError("sectorId")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("sectorId")}
                        </p>
                    {/if}
                </div>

                <div>
                    <label
                        class="block text-xs font-medium text-slate-600 mb-1"
                    >
                        Caja / Cuenta <span class="text-red-500">*</span>
                    </label>
                    <select
                        bind:value={cashboxId}
                        required
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- Seleccionar caja --</option>
                        {#each cashboxes as c}
                            <option value={c.id}>
                                {c.name} ({c.code}) . Bs {parseFloat(
                                    c.balance ?? "0",
                                ).toLocaleString("es-BO")}
                            </option>
                        {/each}
                    </select>
                    {#if fieldError("cashboxId")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("cashboxId")}
                        </p>
                    {/if}
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
                form={formId}
                disabled={isSubmitting || !sectorId || !cashboxId}
                class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Guardando...
                {:else}
                    <Link2 class="h-4 w-4" />
                    Guardar
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
