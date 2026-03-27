<script lang="ts">
  // BACKUP WIDGET FOR MAIN BANNER

  let isRunning = false;
  let status: "idle" | "success" | "error" = "idle";
  let statusMessage = "";

  function generateFilename(): string {
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `backup_data_${ts}.dump`;
  }

  async function runBackup() {
    if (isRunning) return;
    isRunning = true;
    status = "idle";
    statusMessage = "";

    try {
      const res = await fetch("/api/database/db-handler.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backup",
          filename: generateFilename(),
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        status = "success";
        statusMessage = "respaldo creado";
      } else {
        status = "error";
        statusMessage = "fallo al respaldar";
      }
    } catch {
      status = "error";
      statusMessage = "sin conexion";
    } finally {
      isRunning = false;
    }
  }
</script>

<span class="inline-flex items-center gap-2">
  <button
    type="button"
    on:click={runBackup}
    disabled={isRunning}
    class="rounded-md border border-current/30 px-2 py-0.5 text-[11px] font-semibold leading-4 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
    aria-label="Crear respaldo ahora"
  >
    {isRunning ? "Respaldando..." : "Respaldar ahora"}
  </button>

  {#if status !== "idle"}
    <span
      class:text-emerald-700={status === "success"}
      class:text-red-700={status === "error"}
      class="text-[11px] font-semibold"
      aria-live="polite"
    >
      {statusMessage}
    </span>
  {/if}
</span>
