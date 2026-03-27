<script lang="ts">
    import {
        Plus,
        Search,
        X,
        CircleCheck,
        ArrowLeft,
        Eye,
        CircleAlert,
        CircleDollarSign,
        HandCoins,
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
        TriangleAlert,
        Building2,
        Handshake,
    } from "@lucide/svelte";
    import { fade, scale, fly } from "svelte/transition";
    import { backOut } from "svelte/easing";
    import { actions, isInputError } from "astro:actions";
    import { noWheel } from "@/lib/form/utils";
    import type { SelectTransactionCategories } from "@/db/schema";
    import QuickAmountActions from "./QuickAmountActions.svelte";
    import { formatBOB } from "@/services/finances/helpers";
    import TransactionSuccess from "./TransactionSuccess.svelte";

    interface Props {
        concepts: SelectTransactionCategories[];
    }

    interface DepositResponse {
        success: boolean;
        message: string;
        transaction: {
            id: string;
            amount: string;
            concept: string;
            reference: string | null;
            timestamp: string;
        };
        newBalance: string;
    }

    let { concepts }: Props = $props();
    let inputErrors = $state<Record<string, string>>({});
    let serverError = $state<string | null>(null);
    let successMessage = $state<DepositResponse | null>(null);
    let isSubmitting = $state(false);

    // Form state
    let searchQuery = $state("");
    let selectedConcept = $state<SelectTransactionCategories | null>(null);
    let amount = $state("");
    let reference = $state("");
    let showDropdown = $state(false);
    let invoicePreview = $derived.by(() => {
        if (!selectedConcept) return null;
        const c = selectedConcept as any;
        if (!c.invoiceRangeId || !c.invoiceRangeIsActive) return null;
        const next = Number(c.invoiceRangeCurrent) + 1;
        if (next > Number(c.invoiceRangeEnd)) return null; // exhausted
        const label = c.invoiceRangePrefix
            ? `${c.invoiceRangePrefix}-${next}`
            : String(next);
        return { rangeId: c.invoiceRangeId, nextNumber: next, label };
    });

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
        "alert-triangle": TriangleAlert,
        "building-2": Building2,
        handshake: Handshake,
    } as const;

    // Computed values
    let filteredOptions = $derived.by(() => {
        if (!searchQuery.trim()) return concepts;
        const query = searchQuery.toLowerCase();
        return concepts.filter(
            (opt) =>
                opt.name.toLowerCase().includes(query) ||
                opt.description?.toLowerCase().includes(query),
        );
    });

    let quickConcepts = $derived.by(() => {
        const items = concepts.slice(0, 6);
        if (items.length >= 6) return items;
        return [
            ...items,
            ...(Array.from({ length: 5 - items.length }, (_, idx) => ({
                id: `placeholder-${idx}`,
                name: "Sin cuenta",
                description: null,
                icon: null,
                type: "income",
            })) as SelectTransactionCategories[]),
        ];
    });

    function selectConcept(option: SelectTransactionCategories) {
        selectedConcept = option;
        searchQuery = "";
        showDropdown = false;
    }

    function clearConcept() {
        selectedConcept = null;
        searchQuery = "";
    }

    function resetForm() {
        selectedConcept = null;
        amount = "";
        reference = "";
        searchQuery = "";
        inputErrors = {};
        serverError = null;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;
        successMessage = null;

        if (!selectedConcept) {
            inputErrors.concept = "Debe seleccionar una cuenta";
            return;
        }

        const formData = new FormData();
        formData.append("categoryId", selectedConcept.id);
        formData.append("amount", amount);
        formData.append(
            "reference",
            invoicePreview ? invoicePreview.label : reference,
        );
        if (invoicePreview)
            formData.append("invoiceRangeId", invoicePreview.rangeId);

        isSubmitting = true;
        try {
            const result = await actions.finance.deposit(formData);
            if (isInputError(result?.error)) {
                const fieldErrors = result.error.fields;
                for (const [field, errors] of Object.entries(fieldErrors)) {
                    inputErrors[field] = Array.isArray(errors)
                        ? errors.join(", ")
                        : String(errors);
                }
                return;
            }

            if (result?.error) {
                serverError =
                    result.error.message || "Error al procesar el depósito";
                return;
            }

            if (result?.data) {
                const data = result.data as DepositResponse;
                if (data.success) {
                    successMessage = data;
                }
            }
        } catch (error) {
            serverError =
                error instanceof Error ? error.message : "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    function onClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-dropdown-container]")) {
            showDropdown = false;
        }
    }
</script>

<svelte:window onclick={onClickOutside} />

{#if successMessage}
    <TransactionSuccess
        amount={successMessage.transaction.amount}
        concept={successMessage.transaction.concept}
        reference={successMessage.transaction.reference}
        transactionId={successMessage.transaction.id}
        newBalance={successMessage.newBalance}
        color="blue"
        registerAnotherHref="/ingresos"
        printBack="/ingresos"
    />
{:else}
    {#if serverError}
        <div
            class="mb-6 flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-200"
            data-testid="deposit-error-alert"
        >
            <CircleAlert class="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div class="flex-1">
                <h3 class="font-semibold text-red-900">Error</h3>
                <p class="text-sm text-red-700">{serverError}</p>
            </div>
            <button
                type="button"
                onclick={() => (serverError = null)}
                data-testid="close-error-button"
                class="text-red-600 hover:text-red-800 transition-colors shrink-0"
            >
                <X class="h-4 w-4" />
            </button>
        </div>
    {/if}

    <form onsubmit={handleSubmit} data-testid="deposit-form" class="space-y-5">
        <div class="relative" data-dropdown-container>
            <label
                for="concept"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Cuenta
            </label>

            {#if !selectedConcept && quickConcepts.length > 0}
                <div class="mb-3 grid grid-cols-3 gap-2">
                    {#each quickConcepts as quick}
                        {@const isPlaceholder =
                            quick.id.startsWith("placeholder-")}
                        {@const iconKey =
                            quick.icon && quick.icon in iconMap
                                ? (quick.icon as keyof typeof iconMap)
                                : null}
                        {@const Icon = iconKey
                            ? iconMap[iconKey]
                            : CircleDollarSign}
                        {@const hasRange =
                            !isPlaceholder && !!(quick as any).invoiceRangeId}
                        {@const isExhausted =
                            hasRange &&
                            Number((quick as any).invoiceRangeCurrent) + 1 >
                                Number((quick as any).invoiceRangeEnd)}
                        <button
                            type="button"
                            onclick={() =>
                                !isPlaceholder && selectConcept(quick)}
                            disabled={isPlaceholder}
                            class="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-green-300 hover:bg-green-50 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-slate-50 disabled:text-slate-400"
                            title={isPlaceholder ? "Sin cuenta" : quick.name}
                        >
                            {#if hasRange}
                                <span
                                    class="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-white {isExhausted
                                        ? 'bg-red-400'
                                        : 'bg-emerald-400'}"
                                ></span>
                            {/if}
                            <span
                                class="shrink-0 rounded-md bg-slate-100 p-1.5 text-slate-600"
                            >
                                <Icon class="h-4 w-4" />
                            </span>
                            <span class="truncate">
                                {isPlaceholder ? "—" : quick.name}
                            </span>
                        </button>
                    {/each}
                </div>
            {/if}

            {#if selectedConcept}
                {@const iconKey =
                    selectedConcept.icon && selectedConcept.icon in iconMap
                        ? (selectedConcept.icon as keyof typeof iconMap)
                        : null}
                {@const SelectedIcon = iconKey
                    ? iconMap[iconKey]
                    : CircleDollarSign}
                <div
                    data-testid="selected-concept-display"
                    class="w-full rounded-lg border bg-white px-4 py-2 flex items-center gap-3 transition
            {(selectedConcept as any).invoiceRangeId && !invoicePreview
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-300 hover:border-green-400'}"
                >
                    <span
                        class="shrink-0 rounded-md bg-green-50 p-2 text-green-600"
                    >
                        <SelectedIcon class="h-4 w-4" />
                    </span>
                    <div class="flex-1 min-w-0">
                        <p
                            class="text-slate-900 font-medium"
                            data-testid="selected-concept-name"
                        >
                            {selectedConcept.name}
                        </p>
                        {#if (selectedConcept as any).invoiceRangeId && !invoicePreview}
                            <p
                                class="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5"
                            >
                                <TriangleAlert class="h-3 w-3" />
                                Talonario agotado — la referencia debe ingresarse
                                manualmente
                            </p>
                        {:else if selectedConcept.description}
                            <p
                                class="text-xs text-slate-500"
                                data-testid="selected-concept-description"
                            >
                                {selectedConcept.description}
                            </p>
                        {/if}
                    </div>
                    <button
                        type="button"
                        onclick={clearConcept}
                        data-testid="clear-concept-button"
                        class="p-1 hover:bg-slate-100 rounded transition-colors shrink-0"
                    >
                        <X class="h-4 w-4 text-slate-500" />
                    </button>
                </div>
            {:else}
                <div class="relative">
                    <Search
                        class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    />
                    <input
                        id="concept"
                        type="text"
                        bind:value={searchQuery}
                        onfocus={() => (showDropdown = true)}
                        placeholder="Buscar cuenta..."
                        data-testid="concept-search-input"
                        class="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-slate-900 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition {inputErrors.concept
                            ? 'border-red-500'
                            : ''}"
                    />
                </div>

                {#if showDropdown}
                    <div
                        data-testid="concept-dropdown"
                        class="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden"
                    >
                        {#if filteredOptions.length > 0}
                            <ul class="max-h-60 overflow-y-auto">
                                {#each filteredOptions as option (option.id)}
                                    {@const hasRange = !!(option as any)
                                        .invoiceRangeId}
                                    <li>
                                        <button
                                            type="button"
                                            onclick={() =>
                                                selectConcept(option)}
                                            data-testid="concept-option-{option.id}"
                                            class="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors flex items-center justify-between gap-3"
                                        >
                                            <div>
                                                <p
                                                    class="font-medium text-slate-900"
                                                >
                                                    {option.name}
                                                </p>
                                                {#if option.description}
                                                    <p
                                                        class="text-xs text-slate-500"
                                                    >
                                                        {option.description}
                                                    </p>
                                                {/if}
                                            </div>
                                            {#if hasRange}
                                                <span
                                                    class="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                                                >
                                                    <span
                                                        class="h-1.5 w-1.5 rounded-full bg-emerald-400"
                                                    ></span>
                                                    Talonario
                                                </span>
                                            {/if}
                                        </button>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <div
                                class="px-4 py-6 text-center text-slate-500 text-sm"
                                data-testid="no-concepts-message"
                            >
                                No hay cuentas para "{searchQuery}"
                            </div>
                        {/if}
                    </div>
                {/if}
            {/if}
            {#if inputErrors.categoryId}
                <p
                    data-testid="concept-input-error"
                    class="mt-2 text-sm text-red-600 flex items-center gap-1"
                >
                    <CircleAlert class="h-4 w-4" />
                    {inputErrors.categoryId}
                </p>
            {/if}
        </div>

        <div>
            <label
                for="amount"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Monto (Bs.)
            </label>
            <div class="relative">
                <span
                    class="absolute left-4 top-2.5 text-slate-500 font-medium pointer-events-none"
                    >Bs</span
                >
                <input
                    id="amount"
                    bind:value={amount}
                    use:noWheel
                    type="number"
                    step="0.01"
                    max="500000"
                    placeholder="0.00"
                    data-testid="deposit-amount-input"
                    class="w-full rounded-lg border pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all duration-200 {inputErrors.amount
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : amount && parseFloat(amount) > 0
                          ? 'border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-100'
                          : 'border-slate-300 focus:border-green-500 focus:ring-2 focus:ring-green-100'}"
                />
            </div>

            {#if amount && parseFloat(amount) > 0 && !inputErrors.amount}
                {@const formattedAmount = formatBOB(String(amount))}
                <div
                    in:fade={{ duration: 200 }}
                    data-testid="amount-confirmation-badge"
                    class="mt-2 w-full flex items-center justify-between px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg"
                >
                    <div class="flex items-center gap-2">
                        <CircleCheck class="w-4 h-4 text-green-600 shrink-0" />
                        <span class="text-sm font-medium text-green-900">
                            Monto ingresado
                        </span>
                    </div>
                    <span class="text-base font-bold text-green-900">
                        {formattedAmount}
                    </span>
                </div>
            {/if}

            <QuickAmountActions
                {amount}
                onSelectAmount={(value) => (amount = value)}
                activeClass="bg-green-600 border-green-600 text-white shadow-sm"
                inactiveClass="bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700 hover:bg-green-50 active:bg-green-100"
            />

            {#if inputErrors.amount}
                <p
                    data-testid="amount-input-error"
                    class="mt-2 text-sm text-red-600 flex items-center gap-1"
                >
                    <CircleAlert class="h-4 w-4" />
                    {inputErrors.amount}
                </p>
            {/if}
        </div>

        <div>
            <label
                for="reference"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Referencia <span class="text-slate-500 text-xs">(Opcional)</span
                >
            </label>
            <input
                id="reference"
                bind:value={reference}
                type="text"
                placeholder={invoicePreview
                    ? invoicePreview.label
                    : "Ej: Número de recibo"}
                disabled={!!invoicePreview}
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            />
            {#if inputErrors.reference}
                <p
                    data-testid="reference-input-error"
                    class="mt-2 text-sm text-red-600 flex items-center gap-1"
                >
                    <CircleAlert class="h-4 w-4" />
                    {inputErrors.reference}
                </p>
            {/if}
        </div>

        {#if invoicePreview}
            <div
                class="mt-2 flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm"
            >
                <CircleCheck class="h-4 w-4 text-green-600 shrink-0" />
                <span class="text-green-800">
                    Nro. de talonario: <strong class="font-mono"
                        >{invoicePreview.label}</strong
                    >
                </span>
            </div>
        {/if}

        {#if selectedConcept && (selectedConcept as any).invoiceRangeId && !invoicePreview}
            <div
                class="mt-2 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm"
            >
                <TriangleAlert class="h-4 w-4 text-amber-600 shrink-0" />
                <span class="text-amber-800">
                    Talonario agotado. Ingresar referencia manualmente.
                    <a
                        title="Ampliar rango"
                        href="/talonarios"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="underline font-semibold hover:opacity-80"
                    >
                        Ampliar rango →
                    </a>
                </span>
            </div>
        {/if}

        <button
            type="submit"
            disabled={isSubmitting || !selectedConcept || !amount}
            data-testid="deposit-submit-button"
            class="w-full rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 active:bg-green-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {#if isSubmitting}
                <div
                    class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                ></div>
                Registrando...
            {:else}
                <Plus class="h-5 w-5" />
                Registrar Ingreso
            {/if}
        </button>
    </form>
{/if}
