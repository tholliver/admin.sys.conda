<script lang="ts">
    /**
     * TalonarioBanner.svelte
     *
     * Reusable banner shown when a talonario (invoice range) is exhausted
     * or not assigned to a category.  Used in two contexts:
     *
     * 1. Inline — when the selected concept has a range state issue before
     *    the user even submits (driven by local `isTalonarioExhausted`).
     * 2. Post-submit — when the server returns a structured TALONARIO_* error.
     *
     * Props:
     *   type         — "exhausted" | "missing"
     *   categoryName — shown in the description
     *   rangeEnd     — optional, shown for exhausted ranges
     *   onDismiss    — optional callback to clear the banner
     *   compact      — if true, renders a smaller inline chip instead of a card
     */
    import { TriangleAlert, X, BookOpen, ExternalLink } from "@lucide/svelte";

    interface Props {
        type: "exhausted" | "missing";
        categoryName?: string;
        rangeEnd?: number;
        onDismiss?: () => void;
        compact?: boolean;
    }

    let {
        type,
        categoryName,
        rangeEnd,
        onDismiss,
        compact = false,
    }: Props = $props();

    const TALONARIOS_HREF = "/talonarios";

    const title = $derived(
        type === "exhausted" ? "Talonario agotado" : "Sin talonario asignado",
    );

    const description = $derived(() => {
        if (type === "missing") {
            return `La cuenta "${categoryName}" no tiene un talonario asignado. Asigne uno antes de continuar.`;
        }
        return rangeEnd
            ? `El talonario de "${categoryName}" está agotado (hasta ${rangeEnd}). Amplíe el rango o asigne uno nuevo.`
            : `El talonario de "${categoryName}" está agotado. Amplíe el rango o asigne uno nuevo.`;
    });
</script>

{#if compact}
    <!-- ── Compact inline chip ──────────────────────────────────────────── -->
    <div
        class="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm"
    >
        <TriangleAlert class="h-4 w-4 text-amber-600 shrink-0" />
        <span class="text-amber-800 flex-1">
            {title}.
            <a
                href={TALONARIOS_HREF}
                target="_blank"
                rel="noopener noreferrer"
                class="underline font-semibold hover:opacity-80 inline-flex items-center gap-0.5"
            >
                Gestionar →
            </a>
        </span>
    </div>
{:else}
    <!-- ── Full card banner ─────────────────────────────────────────────── -->
    <div
        class="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-300 p-4"
        role="alert"
    >
        <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100"
        >
            <TriangleAlert class="h-4 w-4 text-amber-700" />
        </div>

        <div class="flex-1 min-w-0">
            <p class="font-semibold text-amber-900 text-sm">{title}</p>
            <p class="text-xs text-amber-700 mt-0.5 leading-relaxed">
                {description()}
            </p>

            <div class="mt-3 flex flex-wrap gap-2">
                <a
                    href={TALONARIOS_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 active:bg-amber-800 transition"
                >
                    <BookOpen class="h-3.5 w-3.5" />
                    {type === "exhausted" ? "Ampliar rango" : "Asignar talonario"}
                    <ExternalLink class="h-3 w-3 opacity-70" />
                </a>

                {#if onDismiss}
                    <button
                        type="button"
                        onclick={onDismiss}
                        class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 transition"
                    >
                        Reintentar
                    </button>
                {/if}
            </div>
        </div>

        {#if onDismiss}
            <button
                type="button"
                onclick={onDismiss}
                class="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800 transition"
                aria-label="Cerrar"
            >
                <X class="h-4 w-4" />
            </button>
        {/if}
    </div>
{/if}
