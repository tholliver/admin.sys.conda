<script lang="ts">
    /**
     * ConceptPicker.svelte
     *
     * Shared concept (account) selector used by both DepositForm and WithdrawForm.
     * Renders a quick 3-column grid of top concepts, a search input, and a
     * keyboard-navigable dropdown.
     *
     * Color theming via `accentColor` prop ("green" | "red") so each form
     * keeps its visual identity.
     */
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
        TriangleAlert,
    } from "@lucide/svelte";
    import type { SelectTransactionCategories } from "@/db/schema";
    import type { InvoicePreview } from "@/lib/finance/invoice-range.utils";
    import { isTalonarioExhausted } from "@/lib/finance/invoice-range.utils";

    interface Props {
        concepts?: SelectTransactionCategories[];
        quickConcepts: SelectTransactionCategories[];
        filteredConcepts: SelectTransactionCategories[];
        selected: SelectTransactionCategories | null;
        invoicePreview?: InvoicePreview | null;
        searchQuery: string;
        showDropdown: boolean;
        highlightedIndex: number;
        error?: string;
        accentColor?: "green" | "red";
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
        invoicePreview,
        searchQuery,
        showDropdown,
        highlightedIndex,
        error,
        accentColor = "green",
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

    function getIcon(icon: string | null | undefined) {
        return icon && icon in iconMap
            ? iconMap[icon as keyof typeof iconMap]
            : HandCoins;
    }

    const accent = $derived({
        selectedBorder: accentColor === "green" ? "hover:border-green-400" : "hover:border-red-400",
        selectedIconBg: accentColor === "green" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600",
        quickHover: accentColor === "green"
            ? "hover:border-green-300 hover:bg-green-50"
            : "hover:border-red-300 hover:bg-red-50",
        searchFocus: accentColor === "green"
            ? "focus:border-green-500 focus:ring-green-100"
            : "focus:border-red-500 focus:ring-red-100",
        dropdownHover: accentColor === "green" ? "hover:bg-green-50" : "hover:bg-red-50",
        dropdownHighlight: accentColor === "green" ? "bg-green-100" : "bg-red-100",
    });
</script>

<div class="relative" data-dropdown-container>
    <label for="concept" class="block text-sm font-medium text-slate-700 mb-2">
        Cuenta <span class="text-red-500">*</span>
    </label>

    {#if selected}
        {@const Icon = getIcon(selected.icon)}
        {@const exhausted = isTalonarioExhausted(selected as any)}
        <div
            data-testid="selected-concept-display"
            class="w-full rounded-lg border bg-white px-4 py-2.5 flex items-center gap-3 transition
                   {exhausted
                ? 'border-amber-300 bg-amber-50'
                : `border-slate-300 ${accent.selectedBorder}`}"
        >
            <span class="shrink-0 rounded-md p-2 {accent.selectedIconBg}">
                <Icon class="h-4 w-4" />
            </span>

            <div class="flex-1 min-w-0">
                <p class="text-slate-900 font-medium" data-testid="selected-concept-name">
                    {selected.name}
                </p>
                {#if exhausted}
                    <p class="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                        <TriangleAlert class="h-3 w-3" />
                        Talonario agotado — ingrese referencia manualmente
                    </p>
                {:else if invoicePreview}
                    <p class="text-xs text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                        <Receipt class="h-3 w-3" />
                        Próx. talonario: <span class="font-mono">{invoicePreview.label}</span>
                    </p>
                {:else if selected.description}
                    <p class="text-xs text-slate-500" data-testid="selected-concept-description">
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
        <div class="mb-3 grid grid-cols-3 gap-2">
            {#each quickConcepts as quick}
                {@const isPlaceholder = quick.id.startsWith("placeholder-")}
                {@const Icon = getIcon(quick.icon)}
                {@const hasRange = !isPlaceholder && !!(quick as any).invoiceRangeId}
                {@const isExhausted =
                    hasRange &&
                    Number((quick as any).invoiceRangeCurrent) >
                        Number((quick as any).invoiceRangeEnd)}

                <button
                    type="button"
                    onclick={() => !isPlaceholder && onSelect(quick)}
                    disabled={isPlaceholder}
                    title={isPlaceholder ? "Sin cuenta" : quick.name}
                    class="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white
                           px-3 py-2 text-left text-xs font-medium text-slate-700 transition
                           {accent.quickHover}
                           disabled:cursor-not-allowed disabled:border-dashed disabled:bg-slate-50 disabled:text-slate-400"
                >
                    {#if hasRange}
                        <span
                            class="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-white
                                   {isExhausted ? 'bg-red-400' : 'bg-emerald-400'}"
                            title={isExhausted ? "Talonario agotado" : "Talonario activo"}
                        ></span>
                    {/if}
                    <span class="shrink-0 rounded-md bg-slate-100 p-1.5 text-slate-600">
                        <Icon class="h-4 w-4" />
                    </span>
                    <span class="truncate">{isPlaceholder ? "—" : quick.name}</span>
                </button>
            {/each}
        </div>

        <div class="relative">
            <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
                id="concept"
                type="text"
                value={searchQuery}
                oninput={(e) => onSearchInput((e.target as HTMLInputElement).value)}
                onkeydown={onKeyDown}
                onfocus={onFocus}
                data-testid="concept-search-input"
                placeholder="Buscar cuenta..."
                class="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2
                       text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition
                       {accent.searchFocus}
                       {error ? 'border-red-500' : ''}"
            />
        </div>

        {#if showDropdown && filteredConcepts.length > 0}
            <div
                data-testid="concept-dropdown"
                class="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
            >
                <ul class="max-h-60 overflow-y-auto">
                    {#each filteredConcepts as option, idx (option.id)}
                        {@const hasRange = !!(option as any).invoiceRangeId}
                        {@const isExhausted =
                            hasRange &&
                            Number((option as any).invoiceRangeCurrent) >
                                Number((option as any).invoiceRangeEnd)}
                        <li>
                            <button
                                type="button"
                                onclick={() => onSelect(option)}
                                data-testid="concept-option-{option.id}"
                                class="w-full text-left px-4 py-3 transition flex items-center justify-between gap-3
                                       {idx === highlightedIndex ? accent.dropdownHighlight : accent.dropdownHover}"
                            >
                                <div class="min-w-0">
                                    <p class="font-medium text-slate-900 truncate">{option.name}</p>
                                    {#if option.description}
                                        <p class="text-xs text-slate-500 truncate">{option.description}</p>
                                    {/if}
                                </div>
                                {#if hasRange}
                                    <span
                                        class="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5
                                               text-[10px] font-semibold border
                                               {isExhausted
                                            ? 'bg-red-50 border-red-200 text-red-700'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'}"
                                    >
                                        <span class="h-1.5 w-1.5 rounded-full {isExhausted ? 'bg-red-400' : 'bg-emerald-400'}"></span>
                                        {isExhausted ? "Agotado" : "Talonario"}
                                    </span>
                                {/if}
                            </button>
                        </li>
                    {/each}
                </ul>
            </div>
        {:else if showDropdown && searchQuery.trim()}
            <div
                data-testid="no-concepts-message"
                class="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg
                       px-4 py-6 text-center text-sm text-slate-500"
            >
                No hay cuentas para "{searchQuery}"
            </div>
        {/if}
    {/if}

    {#if error}
        <p data-testid="concept-input-error" class="mt-2 text-sm text-red-600 flex items-center gap-1">
            <CircleAlert class="h-4 w-4 shrink-0" />{error}
        </p>
    {/if}
</div>
