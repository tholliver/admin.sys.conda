<script lang="ts">
    import { TriangleAlert, BookOpen, ExternalLink, X } from "@lucide/svelte";

    interface Props {
        type: "exhausted" | "missing";
        categoryName?: string;
        rangeEnd?: number;
        onDismiss?: () => void;
    }

    let { type, categoryName, rangeEnd, onDismiss }: Props = $props();

    const TALONARIOS_HREF = "/talonarios";

    const title = $derived(type === "exhausted" ? "Talonario agotado" : "Sin talonario asignado");

    const description = $derived(
        type === "missing"
            ? `La cuenta "${categoryName}" no tiene un talonario asignado.`
            : rangeEnd
              ? `El talonario de "${categoryName}" está agotado (hasta ${rangeEnd}).`
              : `El talonario de "${categoryName}" está agotado.`,
    );

    const actionLabel = $derived(type === "exhausted" ? "Ampliar rango" : "Asignar talonario");
</script>

<div
    class="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3"
    role="alert"
>
    <div class="flex items-start gap-2.5 min-w-0">
        <TriangleAlert class="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="min-w-0">
            <p class="text-sm font-semibold text-amber-900 leading-tight">{title}</p>
            <p class="text-xs text-amber-700 leading-snug truncate">{description}</p>
        </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
        <a
            href={TALONARIOS_HREF}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 active:bg-amber-800 transition whitespace-nowrap"
        >
            <BookOpen class="h-3.5 w-3.5" />
            {actionLabel}
            <ExternalLink class="h-3 w-3 opacity-70" />
        </a>

        {#if onDismiss}
            <button
                type="button"
                onclick={onDismiss}
                class="rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800 transition"
                aria-label="Cerrar"
            >
                <X class="h-4 w-4" />
            </button>
        {/if}
    </div>
</div>
