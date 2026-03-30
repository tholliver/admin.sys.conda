<script lang="ts">
    import {
        Search,
        X,
        HandCoins,
        CircleDollarSign,
        Wallet,
        Banknote,
        CreditCard,
        Receipt,
        PiggyBank,
        BadgeDollarSign,
        ShoppingBag,
        Wrench,
        Bus,
        CarFront,
        Route,
        Map as MapIcon,
        Landmark,
        Ticket,
        Users,
        IdCard,
        Fuel,
        Shield,
        BadgeCheck,
        FileText,
        ClipboardList,
        CalendarCheck,
        Hammer,
        AlertTriangle,
        Building2,
        Handshake,
        CircleAlert,
    } from "@lucide/svelte";
    import type { SelectTransactionCategories } from "@/db/schema";

    interface Props {
        concepts: SelectTransactionCategories[];
        quickConcepts: SelectTransactionCategories[];
        filteredConcepts: SelectTransactionCategories[];
        selected: SelectTransactionCategories | null;
        searchQuery: string;
        showDropdown: boolean;
        highlightedIndex: number;
        error?: string;
        onSelect: (c: SelectTransactionCategories) => void;
        onClear: () => void;
        onSearchInput: (v: string) => void;
        onFocus: () => void;
        onKeyDown: (e: KeyboardEvent) => void;
    }

    let {
        quickConcepts,
        filteredConcepts,
        selected,
        searchQuery,
        showDropdown,
        highlightedIndex,
        error,
        onSelect,
        onClear,
        onSearchInput,
        onFocus,
        onKeyDown,
    }: Props = $props();

    const iconMap = {
        "circle-dollar-sign": CircleDollarSign,
        "hand-coins": HandCoins,
        wallet: Wallet,
        banknote: Banknote,
        "credit-card": CreditCard,
        receipt: Receipt,
        "piggy-bank": PiggyBank,
        "badge-dollar-sign": BadgeDollarSign,
        "shopping-bag": ShoppingBag,
        wrench: Wrench,
        bus: Bus,
        "car-front": CarFront,
        route: Route,
        map: MapIcon,
        landmark: Landmark,
        ticket: Ticket,
        users: Users,
        "id-card": IdCard,
        fuel: Fuel,
        shield: Shield,
        "badge-check": BadgeCheck,
        "file-text": FileText,
        "clipboard-list": ClipboardList,
        "calendar-check": CalendarCheck,
        hammer: Hammer,
        "alert-triangle": AlertTriangle,
        "building-2": Building2,
        handshake: Handshake,
    } as const;

    function getIcon(icon: string | null) {
        return icon && icon in iconMap
            ? iconMap[icon as keyof typeof iconMap]
            : HandCoins;
    }
</script>

<div class="relative" data-dropdown-container>
    <label for="concept" class="block text-sm font-medium text-slate-700 mb-2">
        Cuenta <span class="text-red-500">*</span>
    </label>

    {#if selected}
        {@const Icon = getIcon(selected.icon)}
        <div
            data-testid="selected-concept-display"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 flex items-center gap-3 hover:border-red-400 transition"
        >
            <span class="shrink-0 rounded-md bg-red-50 p-2 text-red-600">
                <Icon class="h-4 w-4" />
            </span>
            <div class="flex-1 min-w-0">
                <p
                    class="text-slate-900 font-medium"
                    data-testid="selected-concept-name"
                >
                    {selected.name}
                </p>
                {#if selected.description}
                    <p
                        class="text-xs text-slate-500"
                        data-testid="selected-concept-description"
                    >
                        {selected.description}
                    </p>
                {/if}
            </div>
            <button
                type="button"
                onclick={onClear}
                data-testid="clear-concept-button"
                class="p-1 hover:bg-slate-100 rounded transition-colors shrink-0"
                aria-label="Limpiar cuenta"
            >
                <X class="h-4 w-4 text-slate-500" />
            </button>
        </div>
    {:else}
        <!-- Quick grid -->
        <div class="mb-3 grid grid-cols-3 gap-2">
            {#each quickConcepts as quick}
                {@const isPlaceholder = quick.id.startsWith("placeholder-")}
                {@const Icon = getIcon(quick.icon)}
                {@const hasRange =
                    !isPlaceholder && !!(quick as any).invoiceRangeId}
                <button
                    type="button"
                    onclick={() => !isPlaceholder && onSelect(quick)}
                    disabled={isPlaceholder}
                    title={isPlaceholder ? "Sin cuenta" : quick.name}
                    class="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-slate-50 disabled:text-slate-400"
                >
                    {#if hasRange}
                        <span
                            class="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white"
                        ></span>
                    {/if}
                    <span
                        class="shrink-0 rounded-md bg-slate-100 p-1.5 text-slate-600"
                    >
                        <Icon class="h-4 w-4" />
                    </span>
                    <span class="truncate"
                        >{isPlaceholder ? "—" : quick.name}</span
                    >
                </button>
            {/each}
        </div>

        <!-- Search input -->
        <div class="relative">
            <div
                class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            >
                <Search class="h-4 w-4" />
            </div>
            <input
                id="concept"
                type="text"
                value={searchQuery}
                oninput={(e) =>
                    onSearchInput((e.target as HTMLInputElement).value)}
                onkeydown={onKeyDown}
                onfocus={onFocus}
                data-testid="concept-search-input"
                placeholder="Buscar cuenta..."
                class="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition
                {error ? 'border-red-500' : ''}"
            />
        </div>

        <!-- Dropdown -->
        {#if showDropdown && filteredConcepts.length > 0}
            <div
                data-testid="concept-dropdown"
                class="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg"
            >
                <ul class="max-h-60 overflow-y-auto">
                    {#each filteredConcepts as option, idx (option.id)}
                        <li>
                            <button
                                type="button"
                                onclick={() => onSelect(option)}
                                data-testid="concept-option-{option.id}"
                                class="w-full text-left px-4 py-3 hover:bg-red-50 transition
                                {idx === highlightedIndex ? 'bg-red-100' : ''}"
                            >
                                <p class="font-medium text-slate-900">
                                    {option.name}
                                </p>
                                {#if option.description}
                                    <p class="text-xs text-slate-500">
                                        {option.description}
                                    </p>
                                {/if}
                            </button>
                        </li>
                    {/each}
                </ul>
            </div>
        {:else if showDropdown && searchQuery.trim()}
            <div
                data-testid="no-concepts-message"
                class="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg px-4 py-6 text-center text-sm text-slate-500"
            >
                No hay cuentas que coincidan con "{searchQuery}"
            </div>
        {/if}
    {/if}

    {#if error}
        <p
            data-testid="concept-input-error"
            class="mt-2 text-sm text-red-600 flex items-center gap-1"
        >
            <CircleAlert class="h-4 w-4" />{error}
        </p>
    {/if}
</div>
