<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import type { InvoiceRange } from "@/db/schema";
    import { api } from "@/utils/routes";
    import { navigate } from "astro:transitions/client";
    import { Trash2 } from "@lucide/svelte";
    import { toast } from "@/lib/toast";

    interface Props {
        range: InvoiceRange;
    }

    let { range }: Props = $props();

    let isOpen = $state(false);
    let isDeleting = $state(false);

    async function handleDelete() {
        isDeleting = true;
        try {
            const res = await fetch(
                api.invoiceRanges.delete(range.id),
                {
                    method: "DELETE",
                },
            );
            const result = await res.json();
            if (!res.ok)
                throw new Error(
                    result?.error ?? result?.message ?? "Error desconocido",
                );
            toast.success("Eliminado", {
                description: `Rango "${range.category}" eliminado correctamente`,
            });
            isOpen = false;
            navigate("/talonarios");
        } catch (err: any) {
            toast.error("Error al eliminar", {
                description: err?.message ?? "Error desconocido",
            });
        } finally {
            isDeleting = false;
        }
    }
</script>

{#if !range.isSystem}
    <button
        data-testid={`ir-delete-open-${range.id}`}
        type="button"
        onclick={() => (isOpen = true)}
        class="inline-flex items-center justify-center size-9 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
        aria-label="Eliminar talonario"
        title="Eliminar talonario"
    >
        <Trash2 class="h-4 w-4" />
    </button>

    <Dialog
        bind:isOpen
        onClose={() => (isOpen = false)}
        size="sm"
        testId={`ir-delete-dialog-${range.id}`}
    >
        {#snippet children()}
            <div class="space-y-4">
                <div class="flex items-start gap-3">
                    <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100"
                    >
                        <Trash2 class="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h2 class="text-base font-semibold text-slate-900">
                            Eliminar talonario
                        </h2>
                        <p class="text-sm text-slate-500 mt-0.5">
                            Esta accion no se puede deshacer.
                        </p>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1.5"
                >
                    <div class="flex justify-between">
                        <span class="text-slate-500">Cuenta</span>
                        <span class="font-medium text-slate-900 capitalize"
                            >{range.category}</span
                        >
                    </div>
                    <!-- <div class="flex justify-between">
                        <span class="text-slate-500">Codigo</span>
                        <span class="font-mono text-slate-700"
                            >{range.code}</span
                        >
                    </div> -->
                    <div class="flex justify-between">
                        <span class="text-slate-500">Rango</span>
                        <span class="font-mono text-slate-700">
                            {Number(range.rangeStart).toLocaleString("es-BO")} - {Number(
                                range.rangeEnd,
                            ).toLocaleString("es-BO")}
                        </span>
                    </div>
                </div>

                <p class="text-sm text-slate-600">
                    Confirmas que deseas eliminar el rango
                    <span class="font-semibold text-slate-900"
                        >"{range.category}"</span
                    >?
                </p>

                <div class="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onclick={() => (isOpen = false)}
                        disabled={isDeleting}
                        class="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={handleDelete}
                        disabled={isDeleting}
                        class="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                        {#if isDeleting}
                            <span
                                class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                            ></span>
                            Eliminando...
                        {:else}
                            <Trash2 class="h-4 w-4" />
                            Eliminar
                        {/if}
                    </button>
                </div>
            </div>
        {/snippet}
    </Dialog>
{/if}
