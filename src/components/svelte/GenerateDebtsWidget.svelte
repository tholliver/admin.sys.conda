<script lang="ts">
  /**
   * GenerateDebtsWidget.svelte
   * Topbar dropdown — pending payments, backup action, and quick nav links.
   */
  import { actions } from "astro:actions";
  import { tooltip } from "@/lib/actions/tooltip";

  // ── Debt props ─────────────────────────────────────────────────────────
  export let missingEmp:    number = 0;
  export let missingTen:    number = 0;
  export let unpaidEmp:     number = 0;
  export let unpaidTen:     number = 0;
  export let currentPeriod: string = "";

  // ── Backup props ───────────────────────────────────────────────────────
  export let backupLevel: "warning" | "critical" | null = null;
  export let backupLabel: string = "";

  // ── Derived ────────────────────────────────────────────────────────────
  $: totalEmpPending = missingEmp + unpaidEmp;
  $: totalTenPending = missingTen + unpaidTen;
  $: totalGaps       = totalEmpPending + totalTenPending;

  $: periodLabel = (() => {
    if (!currentPeriod) return "";
    const [y, m] = currentPeriod.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-BO", { month: "long" });
  })();
  $: periodCapitalized = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  // ── Dropdown state ─────────────────────────────────────────────────────
  let open = false;
  function toggle() { open = !open; }
  function close()  { open = false; }

  // ── Debt generation state ──────────────────────────────────────────────
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

  // ── Backup state ───────────────────────────────────────────────────────
  let backupRunning = false;
  let backupStatus: "idle" | "success" | "error" = "idle";
  let backupMsg = "";

  function generateFilename(): string {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `backup_data_${ts}.dump`;
  }

  async function runBackup() {
    if (backupRunning) return;
    backupRunning = true;
    backupStatus = "idle";
    backupMsg = "";
    try {
      const res = await fetch("/api/database/db-handler.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup", filename: generateFilename() }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        backupStatus = "success";
        backupMsg = "Respaldo creado";
      } else {
        backupStatus = "error";
        backupMsg = "Fallo al respaldar";
      }
    } catch {
      backupStatus = "error";
      backupMsg = "Sin conexión";
    } finally {
      backupRunning = false;
    }
  }
</script>

<!-- Click-outside to close -->
<svelte:window onclick={(e) => { if (open && !(e.target as Element)?.closest(".gdw-root")) close(); }} />

<div class="gdw-root">

  <!-- ── Quick nav: Egresos ── -->
    <a
      href="/egresos"
      class="nav-link nav-link--egreso"
      use:tooltip={{ content: `Ir a Egresos` }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
      <!-- <span class="nav-badge">{pendingEgresos > 99 ? "99+" : pendingEgresos}</span> -->
    </a>

  <!-- ── Quick nav: Ingresos ── -->
    <a
      href="/ingresos"
      class="nav-link nav-link--ingreso"
      use:tooltip={{ content: `Ir a Ingresos` }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M19 12l-7 7-7-7"/>
      </svg>
    </a>

  <!-- ── Bell trigger (hidden when 0 pending) ── -->
  {#if totalGaps > 0}
    <button
      use:tooltip={{ content: triggerTooltip }}
      onclick={toggle}
      class="trigger-btn"
      class:is-open={open}
      aria-expanded={open}
      aria-label="Ver resumen de pagos pendientes"
    >
      <svg class="trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span class="trigger-badge">{totalGaps > 99 ? "99+" : totalGaps}</span>
    </button>
  {/if}

  <!-- ── Backup trigger (hidden when no alert) ── -->
  {#if backupLevel}
    <button
      use:tooltip={{ content: backupLabel }}
      onclick={toggle}
      class="trigger-btn trigger-btn--backup"
      class:trigger-btn--critical={backupLevel === "critical"}
      class:trigger-btn--warning={backupLevel === "warning"}
      class:is-open={open}
      aria-expanded={open}
      aria-label="Estado del respaldo"
    >
      <svg class="trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
      </svg>
    </button>
  {/if}

  <!-- ── Dropdown panel ── -->
  {#if open}
    <div class="panel" role="dialog" aria-label="Resumen de pagos y respaldo">

      <!-- Header -->
      <div class="panel-header">
        <span class="panel-title">{periodCapitalized || "Alertas"}</span>
        {#if totalGaps > 0}
          <span class="panel-sub">{totalGaps} situación{totalGaps !== 1 ? "es" : ""} por resolver</span>
        {:else}
          <span class="panel-sub panel-sub--ok">Sin pendientes</span>
        {/if}
      </div>

      <!-- Debt rows -->
      {#if totalGaps > 0}
        <div class="panel-body">

          <!-- Employee row -->
          {#if totalEmpPending > 0 || empState === "done"}
            <div class="row" class:row--done={empState === "done"}>
              <div class="row-icon row-icon--emp">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </div>
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
              <div class="row-icon row-icon--ten">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
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

        </div>
      {/if}

      <!-- Backup section -->
      {#if backupLevel}
        <div class="backup-section" class:backup-section--critical={backupLevel === "critical"} class:backup-section--warning={backupLevel === "warning"}>
          <div class="backup-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="backup-icon">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
            </svg>
            <span class="backup-label">{backupLabel}</span>
          </div>
          <div class="backup-actions">
            <button
              class="backup-btn"
              onclick={runBackup}
              disabled={backupRunning}
            >
              {backupRunning ? "Respaldando…" : "Respaldar ahora"}
            </button>
            {#if backupStatus !== "idle"}
              <span class="backup-status" class:backup-status--ok={backupStatus === "success"} class:backup-status--err={backupStatus === "error"} aria-live="polite">
                {backupMsg}
              </span>
            {/if}
          </div>
        </div>
      {/if}

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
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  /* ── Quick nav links ─────────────────────────────────────────────────── */
  .nav-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.4rem;
    border: 1px solid transparent;
    text-decoration: none;
    transition: background 140ms, border-color 140ms;
    flex-shrink: 0;
  }

  .nav-link svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .nav-link--egreso {
    background: oklch(0.96 0.05 25);
    border-color: oklch(0.87 0.1 25);
    color: oklch(0.52 0.2 25);
  }
  .nav-link--egreso:hover { background: oklch(0.92 0.08 25); }

  .nav-link--ingreso {
    background: oklch(0.96 0.05 150);
    border-color: oklch(0.87 0.1 150);
    color: oklch(0.45 0.18 150);
  }
  .nav-link--ingreso:hover { background: oklch(0.92 0.08 150); }

  .nav-badge {
    position: absolute;
    top: -0.3rem;
    right: -0.3rem;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.2rem;
    border-radius: 9999px;
    background: currentColor;
    color: white;
    font-size: 0.55rem;
    font-weight: 700;
    line-height: 1.1rem;
    text-align: center;
    pointer-events: none;
    border: 1.5px solid white;
  }

  .nav-link--egreso .nav-badge { background: oklch(0.52 0.2 25); }
  .nav-link--ingreso .nav-badge { background: oklch(0.45 0.18 150); }

  /* ── Trigger buttons ─────────────────────────────────────────────────── */
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
  .trigger-btn.is-open { background: oklch(0.92 0.08 25); }

  /* Backup trigger colours */
  .trigger-btn--warning {
    background: oklch(0.97 0.05 85);
    border-color: oklch(0.88 0.1 85);
    color: oklch(0.55 0.18 75);
  }
  .trigger-btn--warning:hover,
  .trigger-btn--warning.is-open { background: oklch(0.93 0.08 85); }

  .trigger-btn--critical {
    background: oklch(0.96 0.05 25);
    border-color: oklch(0.87 0.1 25);
    color: oklch(0.52 0.2 25);
  }
  .trigger-btn--critical:hover,
  .trigger-btn--critical.is-open { background: oklch(0.92 0.08 25); }

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

  /* ── Panel ───────────────────────────────────────────────────────────── */
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

  .panel-sub--ok { color: oklch(0.45 0.18 150); }

  /* ── Rows ────────────────────────────────────────────────────────────── */
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

  .row-icon--emp { background: oklch(0.93 0.05 280); color: oklch(0.45 0.18 280); }
  .row-icon--ten { background: oklch(0.93 0.05 200); color: oklch(0.42 0.16 200); }

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

  /* ── Backup section ──────────────────────────────────────────────────── */
  .backup-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.55rem 0.9rem;
    border-top: 1px solid oklch(0.93 0 0);
  }

  .backup-section--warning { background: oklch(0.98 0.04 85); }
  .backup-section--critical { background: oklch(0.98 0.04 25); }

  .backup-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .backup-icon {
    flex-shrink: 0;
    color: oklch(0.52 0.18 50);
  }

  .backup-label {
    font-size: 0.72rem;
    color: oklch(0.4 0 0);
    font-weight: 500;
  }

  .backup-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .backup-btn {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.22rem 0.6rem;
    border-radius: 0.3rem;
    border: 1px solid oklch(0.82 0.1 50);
    background: oklch(0.93 0.07 50);
    color: oklch(0.38 0.16 50);
    cursor: pointer;
    transition: background 120ms;
    white-space: nowrap;
  }
  .backup-btn:hover:not(:disabled) { background: oklch(0.87 0.1 50); }
  .backup-btn:disabled { opacity: 0.6; cursor: default; }

  .backup-status {
    font-size: 0.68rem;
    font-weight: 600;
  }
  .backup-status--ok  { color: oklch(0.45 0.18 150); }
  .backup-status--err { color: oklch(0.52 0.2 25); }

  /* ── Footer ──────────────────────────────────────────────────────────── */
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
