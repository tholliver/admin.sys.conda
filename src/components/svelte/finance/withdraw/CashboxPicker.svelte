<script lang="ts">
    import { Vault } from "@lucide/svelte";
    import type { Cashbox } from "@/lib/stores/withdraw.store.svelte";

    interface Props {
        cashboxes: Cashbox[];
        selected: string;
        onSelect: (id: string) => void;
        error?: string;
    }

    let { cashboxes, selected, onSelect, error }: Props = $props();
</script>

<div>
    <p class="block text-sm font-medium text-slate-700 mb-2">
        Caja <span class="text-red-500">*</span>
    </p>
    <div class="flex flex-wrap gap-2">
        {#each cashboxes as box}
            <button
                type="button"
                onclick={() => onSelect(box.id)}
                class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors
                {selected === box.id
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50'}"
            >
                <Vault class="h-3.5 w-3.5" />
                {box.name}
                {#if box.code === "GEN"}
                    <span
                        class="ml-1 rounded px-1 text-[10px] font-semibold
                        {selected === box.id
                            ? 'bg-emerald-400/30 text-emerald-300'
                            : 'bg-emerald-500/20 text-emerald-700'}">GEN</span
                    >
                {/if}
            </button>
        {/each}
    </div>
    {#if error}
        <p class="mt-1 text-xs text-red-600">{error}</p>
    {/if}
</div>
