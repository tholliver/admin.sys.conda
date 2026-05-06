<script lang="ts">
    import { Download, Loader2 } from "@lucide/svelte";

    interface Props {
        filename: string;
    }

    let { filename }: Props = $props();

    let downloading = $state(false);

    async function download() {
        if (downloading) return;
        downloading = true;
        try {
            const res = await fetch(
                `/api/database/db-handler.json?download=${encodeURIComponent(filename)}`
            );
            if (!res.ok) throw new Error("Failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
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

<button
    onclick={download}
    disabled={downloading}
    class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground
        hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-40"
>
    {#if downloading}
        <Loader2 class="h-3.5 w-3.5 animate-spin" />
        Bajando…
    {:else}
        <Download class="h-3.5 w-3.5" />
        Descargar
    {/if}
</button>
