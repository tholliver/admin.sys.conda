<script lang="ts">
    import { tick } from "svelte";
    import { Check, ChevronDown, CircleAlert, Crown, Search, TriangleAlert, Vault } from "@lucide/svelte";
    import { formatBOB } from "@/utils/formatters";

    // Extend to carry cumulativeDebt so the picker can surface it
    interface CashboxItem {
        id:             string;
        name:           string;
        code:           string | null;
        balance:        string | number | null;
        cumulativeDebt?: string | number | null;
        description?:   string | null;
    }

    interface Props {
        cashboxes: CashboxItem[];
        selected:  string;
        onSelect:  (id: string) => void;
        error?:    string;
    }

    let { cashboxes, selected, onSelect, error }: Props = $props();

    let showDropdown     = $state(false);
    let searchQuery      = $state("");
    let highlightedIndex = $state(0);
    let searchInput      = $state<HTMLInputElement | null>(null);

    const isGEN = (box: CashboxItem) => box.code === "GEN";

    const debtOf = (box: CashboxItem) =>
        parseFloat(String(box.cumulativeDebt ?? "0"));

    const orderedCashboxes = $derived.by(() => {
        const gen  = cashboxes.find(isGEN);
        const rest = cashboxes.filter((b) => !isGEN(b));
        return gen ? [gen, ...rest] : cashboxes;
    });

    const genCashbox  = $derived(cashboxes.find(isGEN) ?? null);
    const selectedBox = $derived(
        cashboxes.find((b) => b.id === selected) ?? genCashbox ?? cashboxes[0] ?? null,
    );

    const filteredCashboxes = $derived.by(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return orderedCashboxes;
        return orderedCashboxes.filter((b) =>
            b.name.toLowerCase().includes(q) ||
            (b.code?.toLowerCase() ?? "").includes(q) ||
            (b.description?.toLowerCase() ?? "").includes(q),
        );
    });

    const selectedIsGEN  = $derived(selectedBox ? isGEN(selectedBox) : false);
    const selectedDebt   = $derived(selectedBox ? debtOf(selectedBox) : 0);
    const selectedHasDebt = $derived(selectedDebt > 0);

    $effect(() => {
        if (!selected && genCashbox) onSelect(genCashbox.id);
    });

    $effect(() => {
        if (!showDropdown) return;
        highlightedIndex = Math.max(
            0,
            filteredCashboxes.findIndex((b) => b.id === selectedBox?.id),
        );
        tick().then(() => searchInput?.focus());
    });

    function toggleDropdown(e: MouseEvent | KeyboardEvent) {
        if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        showDropdown = !showDropdown;
    }

    function pickCashbox(box: CashboxItem) {
        onSelect(box.id);
        searchQuery = "";
        showDropdown = false;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") { showDropdown = false; return; }
        if (!showDropdown) {
            if (["ArrowDown", "Enter", " "].includes(e.key)) {
                showDropdown = true;
                e.preventDefault();
            }
            return;
        }
        if (filteredCashboxes.length === 0) return;
        switch (e.key) {
            case "ArrowDown": e.preventDefault(); highlightedIndex = Math.min(highlightedIndex + 1, filteredCashboxes.length - 1); break;
            case "ArrowUp":   e.preventDefault(); highlightedIndex = Math.max(highlightedIndex - 1, 0); break;
            case "Enter":     e.preventDefault(); pickCashbox(filteredCashboxes[highlightedIndex]); break;
        }
    }
</script>

<svelte:window onclick={() => (showDropdown = false)} />

<div class="relative" data-cashbox-dropdown>
    <label for="cashbox-picker" class="block text-sm font-medium text-slate-700 mb-2">
        Caja <span class="text-red-500">*</span>
    </label>

    <!-- ── Trigger button ── -->
    <button
        id="cashbox-picker"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
        onclick={toggleDropdown}
        onkeydown={handleKeyDown}
        class="w-full rounded-lg border text-left transition focus:outline-none focus:ring-2
               {error            ? 'border-red-500 focus:ring-red-100' :
                selectedIsGEN    ? 'border-violet-300 bg-violet-50 focus:border-violet-500 focus:ring-violet-100 hover:border-violet-400' :
                selectedHasDebt  ? 'border-amber-300 bg-amber-50  focus:border-amber-500  focus:ring-amber-100  hover:border-amber-400' :
                                   'border-slate-300 bg-white      focus:border-red-500    focus:ring-red-100    hover:border-red-300'}"
    >
        <span class="flex items-center gap-3 px-3 py-2.5">

            <!-- Icon -->
            <span class="shrink-0 rounded-md p-2
                {selectedIsGEN   ? 'bg-violet-100 text-violet-700' :
                 selectedHasDebt ? 'bg-amber-100  text-amber-700'  :
                                   'bg-red-50     text-red-600'}">
                {#if selectedIsGEN}
                    <Crown class="h-4 w-4" />
                {:else}
                    <Vault class="h-4 w-4" />
                {/if}
            </span>

            <!-- Name + balance -->
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                {#if selectedBox}
                    <span class="flex items-center gap-2">
                        <span class="truncate font-semibold
                            {selectedIsGEN   ? 'text-violet-900' :
                             selectedHasDebt ? 'text-amber-900'  :
                                              'text-slate-900'}">
                            {selectedBox.name}
                        </span>
                        {#if selectedIsGEN}
                            <span class="shrink-0 rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                                Principal
                            </span>
                        {:else if selectedBox.code}
                            <span class="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                {selectedBox.code}
                            </span>
                        {/if}
                    </span>
                    <span class="flex items-center gap-3 text-[11px] font-mono">
                        <span class="{selectedIsGEN ? 'text-violet-700' : 'text-slate-500'}">
                            Saldo: <span class="font-semibold">{formatBOB(String(selectedBox.balance ?? "0"))}</span>
                        </span>
                        {#if selectedHasDebt}
                            <span class="flex items-center gap-1 font-sans text-[11px] font-semibold text-amber-700">
                                <TriangleAlert class="h-3 w-3" />
                                Deuda: {formatBOB(String(selectedDebt))}
                            </span>
                        {/if}
                    </span>
                {:else}
                    <span class="font-medium text-slate-500">Seleccione una caja</span>
                {/if}
            </span>

            <ChevronDown class="h-4 w-4 shrink-0 text-slate-400 transition-transform {showDropdown ? 'rotate-180' : ''}" />
        </span>
    </button>

    <!-- ── Dropdown ── -->
    {#if showDropdown}
        <div
            class="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <!-- Search -->
            <div class="border-b border-slate-100 p-2">
                <div class="search-control search-control-buttonless min-h-10">
                    <span class="search-control-icon"><Search class="h-4 w-4" /></span>
                    <input
                        bind:this={searchInput}
                        type="text"
                        value={searchQuery}
                        oninput={(e) => { searchQuery = (e.target as HTMLInputElement).value; highlightedIndex = 0; }}
                        onkeydown={handleKeyDown}
                        placeholder="Buscar caja..."
                        class="search-control-input min-h-10 py-2"
                    />
                </div>
            </div>

            {#if filteredCashboxes.length > 0}
                <ul role="listbox" aria-label="Cajas" class="max-h-72 overflow-y-auto py-1">
                    {#each filteredCashboxes as box, idx (box.id)}
                        {@const isSelected  = selectedBox?.id === box.id}
                        {@const boxIsGEN    = isGEN(box)}
                        {@const boxDebt     = debtOf(box)}
                        {@const boxHasDebt  = boxDebt > 0}

                        <li>
                            <!-- GEN gets its own prominent slot -->
                            {#if boxIsGEN}
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onclick={() => pickCashbox(box)}
                                    class="flex w-full items-center gap-3 px-3 py-3 text-left transition border-b border-violet-100
                                           {idx === highlightedIndex ? 'bg-violet-100' : 'bg-violet-50 hover:bg-violet-100'}"
                                >
                                    <span class="shrink-0 rounded-md bg-violet-200 p-1.5 text-violet-700">
                                        <Crown class="h-4 w-4" />
                                    </span>
                                    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span class="flex items-center gap-2">
                                            <span class="text-sm font-bold text-violet-900">{box.name}</span>
                                            <span class="rounded-full bg-violet-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
                                                Principal
                                            </span>
                                        </span>
                                        <span class="font-mono text-[11px] text-violet-700">
                                            Saldo: <span class="font-semibold">{formatBOB(String(box.balance ?? "0"))}</span>
                                        </span>
                                    </span>
                                    {#if isSelected}
                                        <Check class="h-4 w-4 shrink-0 text-violet-600" />
                                    {/if}
                                </button>

                            <!-- Sector cashboxes -->
                            {:else}
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onclick={() => pickCashbox(box)}
                                    class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition
                                           {idx === highlightedIndex
                                               ? boxHasDebt ? 'bg-amber-50' : 'bg-red-50'
                                               : boxHasDebt ? 'hover:bg-amber-50' : 'hover:bg-red-50'}"
                                >
                                    <span class="shrink-0 rounded-md p-1.5
                                        {boxHasDebt ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}">
                                        <Vault class="h-4 w-4" />
                                    </span>

                                    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span class="flex items-center gap-2">
                                            <span class="truncate text-sm font-medium
                                                {boxHasDebt ? 'text-amber-900' : 'text-slate-800'}">
                                                {box.name}
                                            </span>
                                            {#if box.code}
                                                <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                                    {box.code}
                                                </span>
                                            {/if}
                                        </span>
                                        <span class="flex items-center gap-3 font-mono text-[11px]">
                                            <span class="text-slate-400">
                                                Saldo: <span class="font-semibold text-slate-600">{formatBOB(String(box.balance ?? "0"))}</span>
                                            </span>
                                            {#if boxHasDebt}
                                                <span class="flex items-center gap-1 font-sans text-[11px] font-semibold text-amber-600">
                                                    <TriangleAlert class="h-3 w-3" />
                                                    Deuda: {formatBOB(String(boxDebt))}
                                                </span>
                                            {/if}
                                        </span>
                                    </span>

                                    {#if isSelected}
                                        <Check class="h-4 w-4 shrink-0 text-red-600" />
                                    {/if}
                                </button>
                            {/if}
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
