<script lang="ts">
    import { tick } from "svelte";
    import type { SelectCashbox } from "@/db/schema";
    import { Check, ChevronDown, CircleAlert, Search, Vault } from "@lucide/svelte";
    import { formatBOB } from "@/utils/formatters";

    interface Props {
        cashboxes: SelectCashbox[];
        selected: string;
        onSelect: (id: string) => void;
        error?: string;
    }

    let { cashboxes, selected, onSelect, error }: Props = $props();

    let showDropdown = $state(false);
    let searchQuery = $state("");
    let highlightedIndex = $state(0);
    let searchInput = $state<HTMLInputElement | null>(null);

    const genCashbox = $derived(cashboxes.find((b) => b.code === "GEN") ?? null);
    const orderedCashboxes = $derived.by(() => {
        const gen = cashboxes.find((b) => b.code === "GEN");
        const rest = cashboxes.filter((b) => b.code !== "GEN");
        return gen ? [gen, ...rest] : cashboxes;
    });

    const selectedBox = $derived(
        cashboxes.find((b) => b.id === selected) ?? genCashbox ?? cashboxes[0] ?? null,
    );

    const filteredCashboxes = $derived.by(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return orderedCashboxes;

        return orderedCashboxes.filter((box) => {
            const name = box.name.toLowerCase();
            const code = box.code?.toLowerCase() ?? "";
            const description = box.description?.toLowerCase() ?? "";
            return name.includes(q) || code.includes(q) || description.includes(q);
        });
    });

    $effect(() => {
        if (!selected && genCashbox) onSelect(genCashbox.id);
    });

    $effect(() => {
        if (!showDropdown) return;

        highlightedIndex = Math.max(
            0,
            filteredCashboxes.findIndex((box) => box.id === selectedBox?.id),
        );

        tick().then(() => searchInput?.focus());
    });

    function openDropdown() {
        showDropdown = true;
    }

    function toggleDropdown(e: MouseEvent | KeyboardEvent) {
        if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        showDropdown = !showDropdown;
    }

    function pickCashbox(box: SelectCashbox) {
        onSelect(box.id);
        searchQuery = "";
        showDropdown = false;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            showDropdown = false;
            return;
        }

        if (!showDropdown) {
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                openDropdown();
                e.preventDefault();
            }
            return;
        }

        if (filteredCashboxes.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, filteredCashboxes.length - 1);
                break;
            case "ArrowUp":
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                break;
            case "Enter":
                e.preventDefault();
                pickCashbox(filteredCashboxes[highlightedIndex]);
                break;
        }
    }

    function onSearchInput(value: string) {
        searchQuery = value;
        highlightedIndex = 0;
    }
</script>

<svelte:window onclick={() => (showDropdown = false)} />

<div class="relative" data-cashbox-dropdown>
    <label for="cashbox-picker" class="block text-sm font-medium text-slate-700 mb-2">
        Caja <span class="text-red-500">*</span>
    </label>

    <button
        id="cashbox-picker"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
        onclick={toggleDropdown}
        onkeydown={handleKeyDown}
        class="w-full rounded-lg border bg-white px-4 py-2.5 text-left transition
               hover:border-red-300 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100
               {error ? 'border-red-500' : 'border-slate-300'}"
    >
        <span class="flex items-center gap-3">
            <span class="shrink-0 rounded-md bg-red-50 p-2 text-red-600">
                <Vault class="h-4 w-4" />
            </span>

            <span class="flex min-w-0 flex-1 items-center gap-3">
                {#if selectedBox}
                    <span class="flex min-w-0 flex-1 items-center gap-2">
                        <span class="truncate font-medium text-slate-900">{selectedBox.name}</span>
                        {#if selectedBox.code}
                            <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                {selectedBox.code}
                            </span>
                        {/if}
                    </span>
                    <span class="shrink-0 text-xs font-mono text-slate-500">
                        Saldo: <span class="font-semibold text-slate-700">{formatBOB(selectedBox.balance)}</span>
                    </span>
                {:else}
                    <span class="font-medium text-slate-500">Seleccione una caja</span>
                {/if}
            </span>

            <ChevronDown class="h-4 w-4 shrink-0 text-slate-400 transition-transform {showDropdown ? 'rotate-180' : ''}" />
        </span>
    </button>

    {#if showDropdown}
        <div
            class="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div class="border-b border-slate-100 p-2">
                <div class="search-control search-control-buttonless min-h-10">
                    <span class="search-control-icon">
                        <Search class="h-4 w-4" />
                    </span>
                    <input
                        bind:this={searchInput}
                        type="text"
                        value={searchQuery}
                        oninput={(e) => onSearchInput((e.target as HTMLInputElement).value)}
                        onkeydown={handleKeyDown}
                        placeholder="Buscar caja..."
                        class="search-control-input min-h-10 py-2"
                    />
                </div>
            </div>

            {#if filteredCashboxes.length > 0}
                <ul role="listbox" aria-label="Cajas" class="max-h-64 overflow-y-auto py-1">
                    {#each filteredCashboxes as box, idx (box.id)}
                        {@const isSelected = selectedBox?.id === box.id}
                        <li>
                            <button
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onclick={() => pickCashbox(box)}
                                class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition
                                       {idx === highlightedIndex ? 'bg-red-50' : 'hover:bg-red-50'}
                                       {isSelected ? 'text-slate-900' : 'text-slate-600'}"
                            >
                                <span class="shrink-0 rounded-md bg-slate-100 p-1.5 text-slate-500">
                                    <Vault class="h-4 w-4" />
                                </span>

                                <span class="flex min-w-0 flex-1 items-center gap-3">
                                    <span class="flex min-w-0 flex-1 items-center gap-2">
                                        <span class="truncate text-sm font-medium">{box.name}</span>
                                        {#if box.code}
                                            <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                                {box.code}
                                            </span>
                                        {/if}
                                    </span>
                                    <span class="shrink-0 text-[11px] font-mono text-slate-400">
                                        Saldo: {formatBOB(box.balance)}
                                    </span>
                                </span>

                                {#if isSelected}
                                    <Check class="h-4 w-4 shrink-0 text-red-600" />
                                {/if}
                            </button>
                        </li>
                    {/each}
                </ul>
            {:else}
                <div class="px-4 py-6 text-center text-sm text-slate-500">
                    No hay cajas para "{searchQuery}"
                </div>
            {/if}
        </div>
    {/if}

    {#if error}
        <p class="mt-2 flex items-center gap-1 text-sm text-red-600">
            <CircleAlert class="h-4 w-4 shrink-0" />{error}
        </p>
    {/if}
</div>
