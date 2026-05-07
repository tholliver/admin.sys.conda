<!-- src/lib/components/ReporteWidget.svelte -->
<script lang="ts">
  import { FileText, ChevronDown, Download, ExternalLink, Loader2, CheckCircle2, AlertCircle } from "@lucide/svelte";

  type LoadingKey = "dl-all" | "dl-today" | "dl-invoices" | null;

  let openPanel = $state(false);
  let loading = $state<LoadingKey>(null);
  let status = $state<{ msg: string; ok: boolean } | null>(null);

  const options = [
    {
      key: "dl-all" as LoadingKey,
      scope: "all",
      label: "Estado de cajas",
      desc: "Saldos y deudas de todas las cajas",
    },
    {
      key: "dl-today" as LoadingKey,
      scope: "today",
      label: "Transacciones de hoy",
      desc: "Todas las operaciones del día actual",
    },
    {
      key: "dl-invoices" as LoadingKey,
      scope: "invoices",
      label: "Estado de talonarios",
      desc: "Resumen por rango de facturación",
    },
  ];

  function buildUrl(scope: string) {
    return `/api/reportes/pdf?scope=${encodeURIComponent(scope)}`;
  }

  async function download(scope: string, key: LoadingKey) {
    loading = key;
    status = null;
    try {
      const res = await fetch(buildUrl(scope));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `reporte_${scope}_${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      status = { msg: "PDF descargado.", ok: true };
    } catch (e: any) {
      status = { msg: e.message, ok: false };
    } finally {
      loading = null;
    }
  }

  function preview(scope: string) {
    window.open(buildUrl(scope), "_blank");
  }

  function outsideClick(node: HTMLElement) {
    function handler(e: MouseEvent) {
      if (!node.contains(e.target as Node)) {
        openPanel = false;
        status = null;
      }
    }
    document.addEventListener("click", handler);
    return { destroy() { document.removeEventListener("click", handler); } };
  }
</script>

<div class="relative" use:outsideClick>
  <button
    onclick={() => { openPanel = !openPanel; status = null; }}
    class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    aria-expanded={openPanel}
  >
    <FileText size={15} class="text-[#1E3A5F] dark:text-blue-400" />
    Reportes
    <ChevronDown
      size={13}
      class="text-slate-400 transition-transform duration-200 {openPanel ? 'rotate-180' : ''}"
    />
  </button>

  {#if openPanel}
    <div class="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div class="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Descargar reporte</p>
      </div>

      <div class="divide-y divide-slate-100 dark:divide-slate-700">
        {#each options as opt}
          <div class="flex items-center gap-2 px-3 py-2.5">
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-slate-700 dark:text-slate-200">{opt.label}</p>
              <p class="text-[10px] text-slate-400">{opt.desc}</p>
            </div>
            <button
              disabled={loading === opt.key}
              onclick={() => download(opt.scope, opt.key)}
              class="flex items-center gap-1 rounded-md bg-[#1E3A5F] px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#16304f] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {#if loading === opt.key}
                <Loader2 size={11} class="animate-spin" />
              {:else}
                <Download size={11} />
              {/if}
              PDF
            </button>
            <button
              disabled={!!loading}
              onclick={() => preview(opt.scope)}
              class="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ExternalLink size={11} />
              Ver
            </button>
          </div>
        {/each}
      </div>

      {#if status}
        <div class="flex items-center gap-1.5 border-t border-slate-100 px-4 pb-3 pt-2 text-xs dark:border-slate-700
          {status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}">
          {#if status.ok}
            <CheckCircle2 size={12} />
          {:else}
            <AlertCircle size={12} />
          {/if}
          {status.msg}
        </div>
      {/if}
    </div>
  {/if}
</div>
