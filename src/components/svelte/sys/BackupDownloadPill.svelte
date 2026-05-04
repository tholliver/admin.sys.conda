<script lang="ts">
    import { Download, Loader2 } from "@lucide/svelte";

    interface Props {
        latestFilename: string | null;
    }

    let { latestFilename }: Props = $props();

    let downloading = $state(false);

    async function download() {
        if (!latestFilename || downloading) return;
        downloading = true;
        try {
            const res = await fetch(
                `/api/database/db-handler.json?download=${encodeURIComponent(latestFilename)}`
            );
            if (!res.ok) throw new Error("Failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = latestFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // silent — browser will surface network errors naturally
        } finally {
            downloading = false;
        }
    }
</script>

<div class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm min-w-0">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
        <Download class="h-4 w-4" />
    </div>

    <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-foreground leading-none">Descargar último</p>
        <p class="text-xs text-muted-foreground mt-0.5 truncate">
            {latestFilename ?? "Sin respaldos disponibles"}
        </p>
    </div>

    <button
        onclick={download}
        disabled={!latestFilename || downloading}
        class="shrink-0 flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground
            hover:bg-muted active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
    >
        {#if downloading}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            Bajando…
        {:else}
            <Download class="h-3.5 w-3.5" />
            Bajar
        {/if}
    </button>
</div>
