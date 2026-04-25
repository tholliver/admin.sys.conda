<script lang="ts">
  import Dialog from "@/components/svelte/Dialog.svelte";
  import { actions, isInputError } from "astro:actions";
  import { BookOpen, X, CircleAlert, CircleCheck, Link2, RefreshCw } from "@lucide/svelte";

  interface CategoryItem {
    id:             string;
    name:           string;
    type:           string;
    invoiceRangeId: string | null;
  }

  interface Props {
    rangeId:    string;
    rangeLabel: string;
    prefix:     string | null;
    current:    number;
    rangeEnd:   number;
    triggerClass?: string;
  }

  let {
    rangeId,
    rangeLabel,
    prefix,
    current,
    rangeEnd,
    triggerClass = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors",
  }: Props = $props();

  type Status = "idle" | "loading" | "error" | "submitting";
  type Tab    = "income" | "outcome";

  let isOpen      = $state(false);
  let status      = $state<Status>("idle");
  let categories  = $state<CategoryItem[]>([]);
  let fetchError  = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let successMsg  = $state<string | null>(null);
  let activeTab   = $state<Tab>("income");
  let successTimer: ReturnType<typeof setTimeout>;
  let abortController: AbortController | null = null;

  const assigned      = $derived(categories.filter(c => c.invoiceRangeId === rangeId));
  const availableTab  = $derived(
    categories.filter(c => c.invoiceRangeId == null && c.type === activeTab)
  );
  const inUseTab      = $derived(
    categories.filter(c => c.invoiceRangeId != null && c.invoiceRangeId !== rangeId && c.type === activeTab)
  );
  const incomeCount   = $derived(categories.filter(c => c.invoiceRangeId == null && c.type === "income").length);
  const outcomeCount  = $derived(categories.filter(c => c.invoiceRangeId == null && c.type === "outcome").length);
  const isBusy        = $derived(status === "loading" || status === "submitting");
  const exhausted     = $derived(current >= rangeEnd);

  async function load() {
    abortController?.abort();
    abortController = new AbortController();
    status     = "loading";
    fetchError = null;
    try {
      const res = await fetch("/api/categories.json", { signal: abortController.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      categories = await res.json();
      status     = "idle";
    } catch (err: any) {
      if (err.name === "AbortError") return;
      fetchError = err.message ?? "Error al cargar cuentas.";
      status     = "error";
    }
  }

  function showSuccess(msg: string) {
    clearTimeout(successTimer);
    successMsg   = msg;
    successTimer = setTimeout(() => (successMsg = null), 2500);
  }

  function reset() {
    abortController?.abort();
    status      = "idle";
    categories  = [];
    fetchError  = null;
    actionError = null;
    successMsg  = null;
    activeTab   = "income";
    clearTimeout(successTimer);
  }

  async function handleAssign(categoryId: string) {
    actionError = null;
    status      = "submitting";
    try {
      const fd = new FormData();
      fd.set("rangeId",    rangeId);
      fd.set("categoryId", categoryId);
      const result = await actions.finance.assignCategoryRange(fd);
      if (isInputError(result?.error)) {
        actionError = Object.values(result.error.fields ?? {}).flat()[0] as string ?? "Error de validación.";
        return;
      }
      if (result?.error) { actionError = result.error.message; return; }
      if (result?.data?.success) { showSuccess(result.data.message ?? "Asignado."); await load(); }
    } catch (e: any) {
      actionError = e?.message ?? "Error inesperado.";
    } finally {
      if (status === "submitting") status = "idle";
    }
  }

  async function handleUnassign(categoryId: string) {
    actionError = null;
    status      = "submitting";
    try {
      const fd = new FormData();
      fd.set("categoryId", categoryId);
      const result = await actions.finance.unassignCategoryRange(fd);
      if (isInputError(result?.error)) {
        actionError = Object.values(result.error.fields ?? {}).flat()[0] as string ?? "Error de validación.";
        return;
      }
      if (result?.error) { actionError = result.error.message; return; }
      if (result?.data?.success) { showSuccess(result.data.message ?? "Desvinculado."); await load(); }
    } catch (e: any) {
      actionError = e?.message ?? "Error inesperado.";
    } finally {
      if (status === "submitting") status = "idle";
    }
  }
</script>

<Dialog
  bind:isOpen
  size="md"
  preventCloseOnEscapeKeyDown={true}
  preventCloseOnInteractOutside={true}
  title="Cuentas: {rangeLabel}"
  description="Asigna o desvincula cuentas a este talonario."
  onClose={reset}
>
  {#snippet trigger({ open })}
    <button
      type="button"
      onclick={() => { reset(); load(); open(); }}
      class={triggerClass}
      disabled={isBusy}
    >
      <BookOpen class="w-3.5 h-3.5" />
      Cuentas
    </button>
  {/snippet}

  {#snippet children()}
    <!-- Progress bar -->
    <div class="mb-4 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
      <span class="text-slate-500">Progreso</span>
      <span class="font-mono font-medium {exhausted ? 'text-red-600' : 'text-slate-700'}">
        {current} / {rangeEnd}
        {#if prefix}<span class="ml-1 text-slate-400">({prefix}-…)</span>{/if}
        {#if exhausted}<span class="ml-2 font-semibold text-red-600">Agotado</span>{/if}
      </span>
    </div>

    <!-- Feedback -->
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

    {#if status === "loading"}
      <div class="flex items-center justify-center gap-2 py-10 text-slate-400">
        <RefreshCw class="h-4 w-4 animate-spin" />
        <span class="text-xs">Cargando cuentas...</span>
      </div>

    {:else if status === "error"}
      <div class="flex flex-col items-center gap-3 py-10">
        <p class="text-xs text-red-500">{fetchError}</p>
        <button type="button" onclick={load}
          class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <RefreshCw class="h-3.5 w-3.5" /> Reintentar
        </button>
      </div>

    {:else}
      <!-- Assigned — mixed, no tabs needed -->
      <div class="mb-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Asignadas
          <span class="ml-1 font-normal normal-case text-slate-300">({assigned.length})</span>
        </p>
        <div class="flex flex-wrap gap-1.5 min-h-7">
          {#if assigned.length === 0}
            <span class="text-xs text-slate-400 italic">Sin cuentas asignadas.</span>
          {:else}
            {#each assigned as cat (cat.id)}
              <span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium
                {cat.type === 'income'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-orange-200 bg-orange-50 text-orange-700'}">
                <span class="h-1.5 w-1.5 rounded-full shrink-0
                  {cat.type === 'income' ? 'bg-emerald-400' : 'bg-orange-400'}"></span>
                {cat.name}
                <button
                  type="button"
                  onclick={() => handleUnassign(cat.id)}
                  disabled={isBusy}
                  aria-label="Desvincular {cat.name}"
                  class="ml-0.5 rounded-full p-0.5 transition-colors disabled:opacity-40
                    {cat.type === 'income'
                      ? 'hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700'
                      : 'hover:bg-orange-100 text-orange-400 hover:text-orange-700'}"
                >
                  <X class="h-3 w-3" />
                </button>
              </span>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-slate-100 mb-4"></div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-3 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onclick={() => (activeTab = "income")}
          class="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
            {activeTab === 'income'
              ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
              : 'text-slate-500 hover:text-slate-700'}"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          Ingresos
          <span class="ml-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
            {incomeCount}
          </span>
        </button>
        <button
          type="button"
          onclick={() => (activeTab = "outcome")}
          class="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
            {activeTab === 'outcome'
              ? 'bg-white text-orange-700 shadow-sm border border-orange-200'
              : 'text-slate-500 hover:text-slate-700'}"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-orange-400"></span>
          Egresos
          <span class="ml-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
            {outcomeCount}
          </span>
        </button>
      </div>

      <!-- Tab content grid -->
      <div class="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
        {#if availableTab.length === 0 && inUseTab.length === 0}
          <p class="col-span-2 text-xs text-slate-400 italic py-2">
            No hay cuentas de {activeTab === 'income' ? 'ingreso' : 'egreso'} disponibles.
          </p>
        {:else}
          {#each availableTab as cat (cat.id)}
            <button
              type="button"
              onclick={() => handleAssign(cat.id)}
              disabled={isBusy || exhausted}
              class="group flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed
                {activeTab === 'income'
                  ? 'hover:border-emerald-300 hover:bg-emerald-50'
                  : 'hover:border-orange-300 hover:bg-orange-50'}"
            >
              <span class="h-1.5 w-1.5 rounded-full shrink-0
                {activeTab === 'income' ? 'bg-emerald-400' : 'bg-orange-400'}"></span>
              <span class="text-xs text-slate-700 font-medium truncate flex-1">{cat.name}</span>
              <Link2 class="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity
                {activeTab === 'income' ? 'text-emerald-500' : 'text-orange-500'}" />
            </button>
          {/each}
          {#each inUseTab as cat (cat.id)}
            <div class="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              <span class="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"></span>
              <span class="text-xs text-red-600 font-medium truncate flex-1">{cat.name}</span>
              <span class="text-[10px] text-red-300 shrink-0">En uso</span>
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet footer({ close })}
    <button type="button" onclick={load} disabled={isBusy}
      class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40">
      <RefreshCw class="h-3.5 w-3.5" /> Actualizar
    </button>
    <button type="button" onclick={() => { close(); window.location.reload(); }}
      class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
      Cerrar
    </button>
  {/snippet}
</Dialog>
