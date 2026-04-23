<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { LayoutGrid, X, CircleAlert, CircleCheck, Link2, RefreshCw } from "@lucide/svelte";

    interface SectorItem {
        id: number;
        name: string;
        cashboxId: string | null;
    }

    interface CashboxOption {
        id: string;
        name: string;
    }

    interface Props {
        cashboxId: string;
        cashboxName: string;
        allCashboxes: CashboxOption[];
        triggerLabel?: string;
        triggerClass?: string;
    }

    let {
        cashboxId,
        cashboxName,
        allCashboxes,
        triggerLabel = "Gestionar",
        triggerClass = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors",
    }: Props = $props();

    // ── UI state ──────────────────────────────────────────────────────────
    type Status = "idle" | "loading" | "error" | "submitting";

    let isOpen      = $state(false);
    let status      = $state<Status>("idle");
    let sectors     = $state<SectorItem[]>([]);
    let fetchError  = $state<string | null>(null);
    let actionError = $state<string | null>(null);
    let successMsg  = $state<string | null>(null);
    let successTimer: ReturnType<typeof setTimeout>;
    let abortController: AbortController | null = null;

    const linked    = $derived(sectors.filter((s) => s.cashboxId === cashboxId));
    const available = $derived(sectors.filter((s) => s.cashboxId == null));
    const isBusy    = $derived(status === "loading" || status === "submitting");

    // ── Fetch ─────────────────────────────────────────────────────────────
    async function load() {
        abortController?.abort();
        abortController = new AbortController();
        status     = "loading";
        fetchError = null;
        try {
            const res = await fetch("/api/sectors.json", { signal: abortController.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            sectors = await res.json();
            status  = "idle";
        } catch (err: any) {
            if (err.name === "AbortError") return;
            fetchError = err.message ?? "Error al cargar sectores.";
            status     = "error";
        }
    }

    // ── Feedback helpers ──────────────────────────────────────────────────
    function showSuccess(msg: string) {
        clearTimeout(successTimer);
        successMsg   = msg;
        successTimer = setTimeout(() => (successMsg = null), 2500);
    }

    function reset() {
        abortController?.abort();
        status      = "idle";
        sectors     = [];
        fetchError  = null;
        actionError = null;
        successMsg  = null;
        clearTimeout(successTimer);
    }

    // ── Actions ───────────────────────────────────────────────────────────
    async function handleLink(sectorId: number) {
        actionError = null;
        status      = "submitting";
        try {
            const fd = new FormData();
            fd.set("sectorId", String(sectorId));
            fd.set("cashboxId", cashboxId);

            const result = await actions.sector.linkSectorCashbox(fd);

            if (isInputError(result?.error)) {
                actionError = Object.values(result.error.fields ?? {}).flat()[0] as string ?? "Error de validación.";
                return;
            }
            if (result?.error) {
                actionError = result.error.message ?? "No se pudo vincular.";
                return;
            }
            if (result?.data?.success) {
                showSuccess(result.data.message ?? "Sector vinculado.");
                await load(); // always refetch — no optimistic guessing
            }
        } catch (err: any) {
            actionError = err?.message ?? "Error inesperado.";
        } finally {
            if (status === "submitting") status = "idle";
        }
    }

    async function handleUnlink(sectorId: number) {
        actionError = null;
        status      = "submitting";
        try {
            const fd = new FormData();
            fd.set("sectorId", String(sectorId));
            const result = await actions.sector.unlinkSectorCashbox(fd);

            if (isInputError(result?.error)) {
                actionError = Object.values(result.error.fields ?? {}).flat()[0] as string ?? "Error de validación.";
                return;
            }
            if (result?.error) {
                actionError = result.error.message ?? "No se pudo desvincular.";
                return;
            }
            if (result?.data?.success) {
                showSuccess(result.data.message ?? "Sector desvinculado.");
                await load();
            }
        } catch (err: any) {
            actionError = err?.message ?? "Error inesperado.";
        } finally {
            if (status === "submitting") status = "idle";
        }
    }
</script>

<Dialog
    bind:isOpen={isOpen}
    size="md"
    title="Gestionar: {cashboxName}"
    description="Vincula o desvincula sectores a esta caja."
    preventCloseOnInteractOutside={false}
    preventCloseOnEscapeKeyDown={false}
    onClose={reset}
>
    {#snippet trigger({ open })}
        <button
            type="button"
            onclick={() => { reset(); load(); open(); }}
            class={triggerClass}
            disabled={isBusy}
        >
            <LayoutGrid class="w-3.5 h-3.5" />
            {triggerLabel}
        </button>
    {/snippet}

    {#snippet children()}
        <!-- Action feedback -->
        {#if actionError}
            <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-3">
                <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p class="text-sm text-red-700 flex-1">{actionError}</p>
                <button type="button" onclick={() => (actionError = null)} class="text-red-400 hover:text-red-600">
                    <X class="h-4 w-4" />
                </button>
            </div>
        {/if}

        {#if successMsg}
            <div class="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 mb-3">
                <CircleCheck class="h-4 w-4 text-emerald-600 shrink-0" />
                <p class="text-sm text-emerald-700">{successMsg}</p>
            </div>
        {/if}

        <!-- Loading -->
        {#if status === "loading"}
            <div class="flex items-center justify-center gap-2 py-10 text-slate-400">
                <RefreshCw class="h-4 w-4 animate-spin" />
                <span class="text-xs">Cargando sectores...</span>
            </div>

        <!-- Fetch error -->
        {:else if status === "error"}
            <div class="flex flex-col items-center gap-3 py-10">
                <p class="text-xs text-red-500">{fetchError}</p>
                <button
                    type="button"
                    onclick={load}
                    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw class="h-3.5 w-3.5" />
                    Reintentar
                </button>
            </div>

        <!-- Data -->
        {:else}
            <!-- Linked -->
            <div class="mb-5">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Sectores vinculados
                    <span class="ml-1 text-slate-300 font-normal normal-case">({linked.length})</span>
                </p>
                <div class="flex flex-wrap gap-2 min-h-8">
                    {#if linked.length === 0}
                        <span class="text-xs text-slate-400 italic">Sin sectores vinculados.</span>
                    {:else}
                        {#each linked as sector (sector.id)}
                            <span class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                {sector.name}
                                <button
                                    type="button"
                                    onclick={() => handleUnlink(sector.id)}
                                    disabled={isBusy}
                                    aria-label="Desvincular {sector.name}"
                                    class="ml-0.5 rounded-full p-0.5 hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors disabled:opacity-40"
                                >
                                    <X class="h-3 w-3" />
                                </button>
                            </span>
                        {/each}
                    {/if}
                </div>
            </div>

            <!-- Available -->
            <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Disponibles para vincular
                    <span class="ml-1 text-slate-300 font-normal normal-case">({available.length})</span>
                </p>
                <div class="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {#if available.length === 0}
                        <p class="text-xs text-slate-400 italic">No hay sectores sin caja para vincular.</p>
                    {:else}
                        {#each available as sector (sector.id)}
                            <button
                                type="button"
                                onclick={() => handleLink(sector.id)}
                                disabled={isBusy}
                                class="group w-full flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span class="text-sm text-slate-700 font-medium truncate">{sector.name}</span>
                                <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                    <Link2 class="h-3 w-3" />
                                    Vincular
                                </span>
                            </button>
                        {/each}
                    {/if}
                </div>
            </div>
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        <button
            type="button"
            onclick={load}
            disabled={isBusy}
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
            <RefreshCw class="h-3.5 w-3.5" />
            Actualizar
        </button>
        <button
            type="button"
            onclick={() => { close(); window.location.reload(); }}
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
            Cerrar
        </button>
    {/snippet}
</Dialog>

