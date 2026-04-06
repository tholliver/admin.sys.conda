<script lang="ts">
  /**
   * GenerateDebtsWidget.svelte
   * Topbar dropdown that shows a per-entity breakdown of missing/overdue
   * payments and lets the user generate or navigate with one click.
   */
  import { actions } from "astro:actions";
  import { tooltip } from "@/lib/actions/tooltip";

  export let missingEmp: number  = 0;
  export let missingTen: number  = 0;
  export let unpaidEmp:  number  = 0;  // replaces overdueEmp
  export let unpaidTen:  number  = 0;  // replaces overdueTen
  export let currentPeriod: string = "";

  // Total pending is simply: not generated + generated but unpaid
  $: totalEmpPending = missingEmp + unpaidEmp;
  $: totalTenPending = missingTen + unpaidTen;
  $: totalGaps       = totalEmpPending + totalTenPending;

  $: periodLabel = (() => {
      if (!currentPeriod) return "";
      const [y, m] = currentPeriod.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("es-BO", { month: "long" });
  })();
  $: periodCapitalized = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  let open = false;
  function toggle() { open = !open; }
  function close()  { open = false; }

  type GenState = "idle" | "loading" | "done" | "error";
  let empState: GenState = "idle";
  let tenState: GenState = "idle";
  let empCreated = 0;
  let tenCreated = 0;

  async function generateEmp() {
      if (empState === "loading" || empState === "done") return;
      empState = "loading";
      try {
          const fd = new FormData();
          fd.set("period", currentPeriod);
          const res = await actions.rrhh.bulkGenerateFees(fd);
          if (res?.error) throw new Error(res.error.message ?? "Error al generar salarios");
          empCreated = res.data?.created ?? 0;
          empState = "done";
          missingEmp = 0;
          if (tenState === "done" || missingTen === 0) scheduleReload();
      } catch { empState = "error"; setTimeout(() => { empState = "idle"; }, 3000); }
  }

  async function generateTen() {
      if (tenState === "loading" || tenState === "done") return;
      tenState = "loading";
      try {
          const fd = new FormData();
          fd.set("period", currentPeriod);
          const res = await actions.inquilinos.bulkGenerateRents(fd);
          if (res?.error) throw new Error(res.error.message ?? "Error al generar alquileres");
          tenCreated = res.data?.created ?? 0;
          tenState = "done";
          missingTen = 0;
          if (empState === "done" || missingEmp === 0) scheduleReload();
      } catch { tenState = "error"; setTimeout(() => { tenState = "idle"; }, 3000); }
  }

  async function generateAll() {
      await Promise.all([
          missingEmp > 0 ? generateEmp() : Promise.resolve(),
          missingTen > 0 ? generateTen() : Promise.resolve(),
      ]);
  }

  function scheduleReload() { setTimeout(() => window.location.reload(), 1200); }

  $: triggerTooltip = open
      ? ""
      : `${periodCapitalized} · ${totalGaps} pendiente${totalGaps !== 1 ? "s" : ""}`;
</script>

<!-- Click-outside to close -->
<svelte:window onclick={(e) => { if (open && !(e.target as Element)?.closest(".gdw-root")) close(); }} />

<div class="gdw-root">

  <!-- Trigger button -->
  <button
    use:tooltip={{ content: triggerTooltip }}
    onclick={toggle}
    class="trigger-btn"
    class:is-open={open}
    aria-expanded={open}
    aria-label="Ver resumen de pagos pendientes"
  >
    <!-- Bell icon -->
    <svg class="trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    <span class="trigger-badge">{totalGaps > 99 ? "99+" : totalGaps}</span>
  </button>

  <!-- Dropdown panel -->
  {#if open}
    <div class="panel" role="dialog" aria-label="Resumen de pagos pendientes">

      <!-- Header -->
      <div class="panel-header">
        <span class="panel-title">{periodCapitalized}</span>
        <span class="panel-sub">{totalGaps} situación{totalGaps !== 1 ? "es" : ""} por resolver</span>
      </div>

      <!-- Rows -->
      <div class="panel-body">

        <!-- Missing employee fees -->
        <!-- Employee row — shows if anything is pending (missing OR unpaid) -->
        {#if totalEmpPending > 0 || empState === "done"}
          <div class="row" class:row--done={empState === "done"}>
            <div class="row-icon row-icon--emp"><!-- same svg --></div>
            <div class="row-text">
              <span class="row-label">
                {#if empState === "done"}
                  {empCreated} salario{empCreated !== 1 ? "s" : ""} generado{empCreated !== 1 ? "s" : ""}
                {:else}
                  {totalEmpPending} salario{totalEmpPending !== 1 ? "s" : ""} pendiente{totalEmpPending !== 1 ? "s" : ""}
                {/if}
              </span>
              <span class="row-sub">
                {#if missingEmp > 0 && unpaidEmp > 0}
                  {missingEmp} sin generar · {unpaidEmp} sin pagar
                {:else if missingEmp > 0}
                  Sin generar · {periodCapitalized}
                {:else}
                  Sin pagar · períodos anteriores incluidos
                {/if}
              </span>
            </div>
            {#if missingEmp > 0 && empState === "idle"}
              <button class="row-action row-action--generate" onclick={generateEmp}>Generar</button>
            {:else if unpaidEmp > 0 && missingEmp === 0 && empState === "idle"}
              <a class="row-action row-action--pay" href="/rrhh/salarios?status=pendiente" onclick={close}>Ver</a>
            {:else if empState === "loading"}
              <span class="row-spinner"></span>
            {:else if empState === "done"}
              <svg class="row-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {:else if empState === "error"}
              <span class="row-error-dot" title="Error al generar"></span>
            {/if}
          </div>
        {/if}

        <!-- Tenant row -->
        {#if totalTenPending > 0 || tenState === "done"}
          <div class="row" class:row--done={tenState === "done"}>
            <div class="row-icon row-icon--ten"><!-- same svg --></div>
            <div class="row-text">
              <span class="row-label">
                {#if tenState === "done"}
                  {tenCreated} alquiler{tenCreated !== 1 ? "es" : ""} generado{tenCreated !== 1 ? "s" : ""}
                {:else}
                  {totalTenPending} alquiler{totalTenPending !== 1 ? "es" : ""} pendiente{totalTenPending !== 1 ? "s" : ""}
                {/if}
              </span>
              <span class="row-sub">
                {#if missingTen > 0 && unpaidTen > 0}
                  {missingTen} sin generar · {unpaidTen} sin cobrar
                {:else if missingTen > 0}
                  Sin generar · {periodCapitalized}
                {:else}
                  Sin cobrar · períodos anteriores incluidos
                {/if}
              </span>
            </div>
            {#if missingTen > 0 && tenState === "idle"}
              <button class="row-action row-action--generate" onclick={generateTen}>Generar</button>
            {:else if unpaidTen > 0 && missingTen === 0 && tenState === "idle"}
              <a class="row-action row-action--pay" href="/inquilinos" onclick={close}>Ver</a>
            {:else if tenState === "loading"}
              <span class="row-spinner"></span>
            {:else if tenState === "done"}
              <svg class="row-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {:else if tenState === "error"}
              <span class="row-error-dot" title="Error al generar"></span>
            {/if}
          </div>
        {/if}

        <!-- Missing tenant rents -->
        {#if missingTen > 0 || tenState === "done"}
          <div class="row" class:row--done={tenState === "done"}>
            <div class="row-icon row-icon--ten">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div class="row-text">
              <span class="row-label">
                {#if tenState === "done"}
                  {tenCreated} alquiler{tenCreated !== 1 ? "es" : ""} generado{tenCreated !== 1 ? "s" : ""}
                {:else}
                  {missingTen} alquiler{missingTen !== 1 ? "es" : ""} sin generar
                {/if}
              </span>
              <span class="row-sub">Inquilinos activos · {periodCapitalized}</span>
            </div>
            {#if tenState === "idle"}
              <button class="row-action row-action--generate" onclick={generateTen}>
                Generar
              </button>
            {:else if tenState === "loading"}
              <span class="row-spinner"></span>
            {:else if tenState === "done"}
              <svg class="row-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {:else}
              <span class="row-error-dot" title="Error al generar"></span>
            {/if}
          </div>
        {/if}

        <!-- Overdue employee fees -->
        {#if overdueEmp > 0}
          <div class="row">
            <div class="row-icon row-icon--overdue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div class="row-text">
              <span class="row-label">{overdueEmp} salario{overdueEmp !== 1 ? "s" : ""} atrasado{overdueEmp !== 1 ? "s" : ""}</span>
              <span class="row-sub">Períodos anteriores sin pagar</span>
            </div>
            <a class="row-action row-action--pay" href="/rrhh/salarios?status=pendiente" onclick={close}>
              Ver
            </a>
          </div>
        {/if}

        <!-- Overdue tenant rents -->
        {#if overdueTen > 0}
          <div class="row">
            <div class="row-icon row-icon--overdue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div class="row-text">
              <span class="row-label">{overdueTen} alquiler{overdueTen !== 1 ? "es" : ""} atrasado{overdueTen !== 1 ? "s" : ""}</span>
              <span class="row-sub">Períodos anteriores sin cobrar</span>
            </div>
            <a class="row-action row-action--pay" href="/inquilinos" onclick={close}>
              Ver
            </a>
          </div>
        {/if}

      </div>

      <!-- Footer -->
      <div class="panel-footer">
        {#if missingEmp > 0 || missingTen > 0}
          <button
            class="footer-btn footer-btn--primary"
            onclick={generateAll}
            disabled={empState === "loading" || tenState === "loading"}
          >
            {#if empState === "loading" || tenState === "loading"}
              <span class="footer-spinner"></span> Generando…
            {:else}
              Generar todo · {missingEmp + missingTen}
            {/if}
          </button>
        {/if}
        <a class="footer-btn footer-btn--ghost" href="/auditoria" onclick={close}>
          Ver auditoría completa
        </a>
      </div>

    </div>
  {/if}

</div>

<style>
  .gdw-root {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
  }

  /* ── Trigger ──────────────────────────────────────────── */
  .trigger-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.4rem;
    border: 1px solid oklch(0.87 0.1 25);
    background: oklch(0.96 0.05 25);
    color: oklch(0.52 0.2 25);
    cursor: pointer;
    transition: background 140ms, border-color 140ms;
    flex-shrink: 0;
  }

  .trigger-btn:hover,
  .trigger-btn.is-open {
    background: oklch(0.92 0.08 25);
  }

  .trigger-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .trigger-badge {
    position: absolute;
    top: -0.3rem;
    right: -0.3rem;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.2rem;
    border-radius: 9999px;
    background: oklch(0.52 0.2 25);
    color: white;
    font-size: 0.55rem;
    font-weight: 700;
    line-height: 1.1rem;
    text-align: center;
    pointer-events: none;
    border: 1.5px solid white;
  }

  /* ── Panel ────────────────────────────────────────────── */
  .panel {
    position: absolute;
    top: calc(100% + 0.6rem);
    right: 0;
    width: 18rem;
    background: white;
    border: 1px solid oklch(0.9 0 0);
    border-radius: 0.6rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.10);
    z-index: 200;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0.7rem 0.9rem 0.5rem;
    border-bottom: 1px solid oklch(0.93 0 0);
  }

  .panel-title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: oklch(0.2 0 0);
  }

  .panel-sub {
    font-size: 0.7rem;
    color: oklch(0.55 0 0);
  }

  /* ── Rows ─────────────────────────────────────────────── */
  .panel-body {
    display: flex;
    flex-direction: column;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.9rem;
    border-bottom: 1px solid oklch(0.95 0 0);
    transition: background 120ms;
  }

  .row:last-child { border-bottom: none; }
  .row:hover { background: oklch(0.98 0 0); }
  .row--done { opacity: 0.6; }

  .row-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 0.35rem;
    flex-shrink: 0;
  }

  .row-icon svg { width: 0.85rem; height: 0.85rem; }

  .row-icon--emp    { background: oklch(0.93 0.05 280); color: oklch(0.45 0.18 280); }
  .row-icon--ten    { background: oklch(0.93 0.05 200); color: oklch(0.42 0.16 200); }
  .row-icon--overdue { background: oklch(0.95 0.05 50);  color: oklch(0.5 0.18 50);  }

  .row-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .row-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: oklch(0.2 0 0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-sub {
    font-size: 0.68rem;
    color: oklch(0.55 0 0);
  }

  .row-action {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 0.3rem;
    border: 1px solid transparent;
    cursor: pointer;
    text-decoration: none;
    transition: background 120ms;
    white-space: nowrap;
  }

  .row-action--generate {
    background: oklch(0.92 0.07 150);
    border-color: oklch(0.8 0.12 150);
    color: oklch(0.35 0.16 150);
  }
  .row-action--generate:hover { background: oklch(0.86 0.1 150); }

  .row-action--pay {
    background: oklch(0.95 0.04 50);
    border-color: oklch(0.85 0.08 50);
    color: oklch(0.45 0.15 50);
    display: inline-flex;
    align-items: center;
  }
  .row-action--pay:hover { background: oklch(0.9 0.07 50); }

  .row-spinner {
    display: inline-block;
    width: 0.9rem;
    height: 0.9rem;
    border: 2px solid oklch(0.85 0.1 150);
    border-top-color: oklch(0.45 0.18 150);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .row-check {
    width: 0.9rem;
    height: 0.9rem;
    color: oklch(0.45 0.18 150);
    flex-shrink: 0;
  }

  .row-error-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: oklch(0.52 0.2 25);
    flex-shrink: 0;
  }

  /* ── Footer ───────────────────────────────────────────── */
  .panel-footer {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem 0.9rem;
    background: oklch(0.98 0 0);
    border-top: 1px solid oklch(0.93 0 0);
  }

  .footer-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    width: 100%;
    padding: 0.45rem 0.75rem;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: background 120ms;
    border: 1px solid transparent;
  }

  .footer-btn--primary {
    background: oklch(0.3 0.12 150);
    color: white;
  }
  .footer-btn--primary:hover:not(:disabled) { background: oklch(0.25 0.14 150); }
  .footer-btn--primary:disabled { opacity: 0.6; cursor: default; }

  .footer-btn--ghost {
    background: transparent;
    border-color: oklch(0.88 0 0);
    color: oklch(0.45 0 0);
  }
  .footer-btn--ghost:hover { background: oklch(0.95 0 0); }

  .footer-spinner {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
