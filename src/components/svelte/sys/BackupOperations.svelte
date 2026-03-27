<script lang="ts">
  interface Props {
    systemInfo: {
      platform: string
      architecture: string
      isWindows: boolean
      isLinux: boolean
      postgresInstalled: boolean
      pgDumpCommand: string
      pgRestoreCommand: string
      customPathUsed: boolean
    }
  }

  let { systemInfo }: Props = $props()

  type StatusType = 'idle' | 'loading' | 'success' | 'error'

  let isRunning = $state(false)
  let statusType = $state<StatusType>('idle')
  let statusMessage = $state('')
  const pgReady = $derived(systemInfo.postgresInstalled)
  const canBackup = $derived(pgReady && !isRunning)

  function friendlyTimeNow() {
    return new Date().toLocaleTimeString('es-BO', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  function generateFilename() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    return `backup_data_${ts}.dump`
  }

  async function runBackup() {
    if (!canBackup) return
    isRunning = true
    statusType = 'loading'
    statusMessage = 'Guardando copia de datos, por favor espera…'

    try {
      const res = await fetch('/api/database/db-handler.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backup',
          filename: generateFilename(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        statusType = 'success'
        statusMessage = `Copia guardada exitosamente hoy a las ${friendlyTimeNow()}. Tu información está protegida.`
        // Dispatch event so BackupTable can refresh
        window.dispatchEvent(new CustomEvent('backup:created'))
      } else {
        statusType = 'error'
        statusMessage = `No se pudo guardar la copia: ${data.message ?? 'Error desconocido'}`
      }
    } catch {
      statusType = 'error'
      statusMessage = 'Error de conexión al guardar la copia.'
    } finally {
      isRunning = false
    }
  }
</script>

<!-- ── BACKUP CREATION CARD ─────────────────────────────────────────────── -->
<div
  class="group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md"
>
  <div class="pointer-events-none absolute right-0 top-0 p-4 opacity-[0.05]">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-20 w-20 text-primary"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  </div>

  <h3 class="text-lg font-bold text-foreground">Respaldo Manual</h3>
  <p class="mt-2 text-sm text-muted-foreground leading-relaxed">
    Inicia un respaldo inmediatamente. Crea una instantánea de todos los
    conductores, vehículos, asistencias y penalidades.
  </p>

  <div class="mt-6 space-y-3">
    <button
      onclick={() => runBackup()}
      disabled={!canBackup}
      class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground
        transition-all hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50"
    >
      {#if isRunning}
        <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        Procesando…
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Crear Respaldo Manual
      {/if}
    </button>
  </div>
</div>

<!-- ── STATUS FEEDBACK ────────────────────────────────────────────────────── -->
{#if statusType !== 'idle'}
  <div
    class="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-all
    {statusType === 'success'
      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
      : ''}
    {statusType === 'error'
      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
      : ''}
    {statusType === 'loading'
      ? 'border-border bg-muted/50 text-muted-foreground'
      : ''}"
  >
    {#if statusType === 'loading'}
      <svg
        class="h-4 w-4 animate-spin shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
        />
      </svg>
    {:else if statusType === 'success'}
      <svg
        class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    {:else}
      <svg
        class="h-4 w-4 shrink-0 mt-0.5 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
    {/if}
    <span>{statusMessage}</span>
  </div>
{/if}
