<script lang="ts">
    import type { SelectCashbox } from "@/db/schema";
    import { Vault, Plus, ChevronDown, X } from "@lucide/svelte";
    import { tooltip } from "@/lib/actions/tooltip";
    import { formatBOB } from "@/utils/formatters";

    interface Props {
        cashboxes: SelectCashbox[];
        selected: string;
        onSelect: (id: string) => void;
        error?: string;
    }

    let { cashboxes, selected, onSelect, error }: Props = $props();

    let showDropdown = $state(false);

    const genCashbox = $derived(cashboxes.find((b) => b.code === "GEN") ?? null);
    const quickCashboxes = $derived(
        cashboxes.filter((b) => b.isQuick && b.code !== "GEN").slice(0, 4)
    );
    const otherCashboxes = $derived(
        cashboxes.filter((b) => !b.isQuick && b.code !== "GEN")
    );

    const selectedIsOther = $derived(!!otherCashboxes.find((b) => b.id === selected));
    const selectedOther = $derived(otherCashboxes.find((b) => b.id === selected) ?? null);
    const selectedBox = $derived(cashboxes.find((b) => b.id === selected) ?? null);

    function pickOther(id: string) {
        onSelect(id);
        showDropdown = false;
    }

    function toggleDropdown(e: MouseEvent | KeyboardEvent) {
        if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
        e.stopPropagation();
        showDropdown = !showDropdown;
    }

    function balanceTip(box: SelectCashbox) {
        return `Balance · ${formatBOB(box.balance)}`;
    }
</script>

<svelte:window onclick={() => (showDropdown = false)} />

<div>
    <div class="flex items-center justify-between mb-2">
        <p class="text-sm font-medium text-slate-700">
            Caja <span class="text-red-500">*</span>
        </p>
        <!-- Live balance of selected cashbox -->
        {#if selectedBox}
            <span class="text-xs text-slate-400 font-mono">
                Saldo: <span class="font-semibold text-slate-600">{formatBOB(selectedBox.balance)}</span>
            </span>
        {/if}
    </div>

    <div class="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-full">
        <!-- GEN always first -->
        {#if genCashbox}
            {@const isSelected = selected === genCashbox.id}
            <button
                type="button"
                onclick={() => onSelect(genCashbox.id)}
                class="relative flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all
                {isSelected
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}"
            >
                <span class="flex items-center justify-center gap-1.5">
                    <!-- Active dot -->
                    <span class="h-1.5 w-1.5 rounded-full shrink-0
                        {isSelected ? 'bg-emerald-500' : 'bg-emerald-400/40'}">
                    </span>
                    {genCashbox.name}
                </span>
            </button>
        {/if}

        <!-- Quick cashboxes -->
        {#each quickCashboxes as box}
            {@const isSelected = selected === box.id}
            <button
                type="button"
                use:tooltip={balanceTip(box)}
                onclick={() => onSelect(box.id)}
                class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all
                {isSelected
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}"
            >
                {box.name}
            </button>
        {/each}

        <!-- Others dropdown -->
        {#if otherCashboxes.length > 0}
            <div
                class="relative"
                role="none"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
            >
                {#if selectedIsOther && selectedOther}
                    <button
                        type="button"
                        onclick={toggleDropdown}
                        onkeydown={toggleDropdown}
                        class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 transition-all"
                    >
                        {selectedOther.name}
                        <span
                            role="button"
                            tabindex="0"
                            aria-label="Deseleccionar"
                            onclick={(e) => { e.stopPropagation(); onSelect(genCashbox?.id ?? ""); }}
                            onkeydown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSelect(genCashbox?.id ?? ""); } }}
                            class="rounded-full p-0.5 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            <X class="h-3 w-3 text-slate-400 hover:text-slate-700" />
                        </span>
                    </button>
                {:else}
                    <button
                        type="button"
                        onclick={toggleDropdown}
                        onkeydown={toggleDropdown}
                        class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-all text-slate-500 hover:text-slate-700 hover:bg-white/50"
                    >
                        <Plus class="h-3.5 w-3.5" />
                        Otra
                        <ChevronDown class="h-3 w-3 opacity-50 transition-transform {showDropdown ? 'rotate-180' : ''}" />
                    </button>
                {/if}

                {#if showDropdown}
                    <div class="absolute z-20 right-0 top-full mt-1.5 min-w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
                        <p class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Otras cajas
                        </p>
                        <ul class="max-h-52 overflow-y-auto pb-1">
                            {#each otherCashboxes as box}
                                <li>
                                    <button
                                        type="button"
                                        onclick={() => pickOther(box.id)}
                                        class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50
                                        {selected === box.id ? 'font-semibold text-slate-900 bg-slate-50' : 'text-slate-600'}"
                                    >
                                        <Vault class="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                        <div class="flex-1 min-w-0">
                                            <p class="truncate">{box.name}</p>
                                            <p class="text-[10px] text-slate-400 font-mono">{formatBOB(box.balance)}</p>
                                        </div>
                                        {#if box.code}
                                            <span class="rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500">
                                                {box.code}
                                            </span>
                                        {/if}
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    {#if error}
        <p class="mt-1.5 text-xs text-red-600">{error}</p>
    {/if}
</div>
