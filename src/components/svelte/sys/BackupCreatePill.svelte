<script lang="ts">
    import { DatabaseBackup, Loader2, CheckCircle2, AlertCircle } from "@lucide/svelte";

    interface Props {
        pgReady: boolean;
    }

    let { pgReady }: Props = $props();

    type Status = "idle" | "loading" | "success" | "error";
    let running = $state(false);
    let status = $state<Status>("idle");
    let message = $state("");

    function generateFilename() {
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        return `backup_data_${ts}.dump`;
    }

    function timeNow() {
        return new Date().toLocaleTimeString("es-BO", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    async function run() {
        if (!pgReady || running) return;
        running = true;
        status = "loading";
        message = "Guardando copia…";
        try {
            const res = await fetch("/api/database/db-handler.json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "backup", filename: generateFilename() }),
            });
            const data = await res.json();
            if (data.success) {
                status = "success";
                message = `Guardado a las ${timeNow()}.`;
                window.dispatchEvent(new CustomEvent("backup:created"));
            } else {
                status = "error";
                message = data.message ?? "Error desconocido";
            }
        } catch {
            status = "error";
            message = "Error de conexión.";
        } finally {
            running = false;
        }
    }
</script>

<div class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm min-w-0">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
        <DatabaseBackup class="h-4 w-4" />
    </div>

    <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-foreground leading-none">Respaldo manual</p>
        <p class="text-xs mt-0.5 truncate
            {status === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
             status === 'error'   ? 'text-destructive' :
                                    'text-muted-foreground'}">
            {#if status === "loading"}
                <span class="inline-flex items-center gap-1">
                    <Loader2 class="h-3 w-3 animate-spin" />{message}
                </span>
            {:else if status === "success"}
                <span class="inline-flex items-center gap-1">
                    <CheckCircle2 class="h-3 w-3" />{message}
                </span>
            {:else if status === "error"}
                <span class="inline-flex items-center gap-1">
                    <AlertCircle class="h-3 w-3" />{message}
                </span>
            {:else}
                {pgReady ? "PostgreSQL listo" : "PostgreSQL no detectado"}
            {/if}
        </p>
    </div>

    <button
        onclick={run}
        disabled={!pgReady || running}
        class="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground
            hover:opacity-90 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
    >
        {#if running}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
        {:else}
            <DatabaseBackup class="h-3.5 w-3.5" />
        {/if}
        Crear
    </button>
</div>
