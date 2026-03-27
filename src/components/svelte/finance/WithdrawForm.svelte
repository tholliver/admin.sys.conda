<script lang="ts">
    import {
        CircleAlert,
        Minus,
        X,
        CircleCheck,
        Search,
        TriangleAlert,
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
    } from "@lucide/svelte";
    import { fade } from "svelte/transition";
    import { actions, isInputError } from "astro:actions";
    import { noWheel } from "@/lib/form/utils";
    import type { SelectTransactionCategories } from "@/db/schema";
    import QuickAmountActions from "./QuickAmountActions.svelte";
    import { formatBOB } from "@/services/finances/helpers";
    import TransactionSuccess from "./TransactionSuccess.svelte";

    interface WithdrawResponse {
        success: boolean;
        message: string;
        transaction: {
            id: string;
            amount: string;
            concept: string;
            reference: string | null;
            authorizedBy?: string;
            timestamp: string;
        };
        newBalance: string;
    }

    interface Props {
        concepts: SelectTransactionCategories[];
    }

    let { concepts }: Props = $props();

    let inputErrors = $state<Record<string, string>>({});
    let serverError = $state<string | null>(null);
    let successMessage = $state<WithdrawResponse | null>(null);
    let isSubmitting = $state(false);
    let showConfirmDialog = $state(false);

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

    // Form state
    let searchQuery = $state("");
    let selectedConcept = $state<SelectTransactionCategories | null>(null);
    let amount = $state("");
    let authorizedBy = $state("");
    let reference = $state("");
    let showDropdown = $state(false);
    let highlightedIndex = $state(0);

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
            ...(Array.from({ length: 6 - items.length }, (_, idx) => ({
                id: `placeholder-${idx}`,
                name: "Sin cuenta",
                description: null,
                icon: null,
                type: "outcome",
            })) as SelectTransactionCategories[]),
        ];
    });

    function selectConcept(option: SelectTransactionCategories) {
        selectedConcept = option;
        searchQuery = "";
        showDropdown = false;
        highlightedIndex = 0;
    }

    function selectHighlighted() {
        if (
            filteredOptions.length > 0 &&
            highlightedIndex < filteredOptions.length
        ) {
            selectConcept(filteredOptions[highlightedIndex]);
        }
    }

    function clearConcept() {
        selectedConcept = null;
        searchQuery = "";
        highlightedIndex = 0;
    }

    function resetForm() {
        selectedConcept = null;
        amount = "";
        authorizedBy = "";
        reference = "";
        searchQuery = "";
        highlightedIndex = 0;
        inputErrors = {};
        serverError = null;
    }

    // function handleAddAnother(e: MouseEvent) {
    //     // e.preventDefault();
    //     // successMessage = null;
    //     // resetForm();
    //     navigate("/egresos");
    // }

    function handleKeyDown(e: KeyboardEvent) {
        if (!showDropdown || filteredOptions.length === 0) {
            if ((e.key === "Enter" || e.key === "Tab") && !selectedConcept) {
                e.preventDefault();
                searchQuery = searchQuery.trim();
                if (filteredOptions.length > 0) {
                    selectConcept(filteredOptions[0]);
                }
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                highlightedIndex = Math.min(
                    highlightedIndex + 1,
                    filteredOptions.length - 1,
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                break;
            case "Enter":
                e.preventDefault();
                selectHighlighted();
                break;
            case "Tab":
                e.preventDefault();
                if (filteredOptions.length > 0) {
                    selectHighlighted();
                } else if (searchQuery.trim()) {
                    showDropdown = false;
                    highlightedIndex = 0;
                }
                break;
            case "Escape":
                e.preventDefault();
                showDropdown = false;
                break;
        }
    }

    function onClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-dropdown-container]")) {
            showDropdown = false;
        }
    }

    function handleInitialSubmit(e: SubmitEvent) {
        e.preventDefault();

        inputErrors = {};
        serverError = null;

        // Client-side validation
        if (!selectedConcept) {
            inputErrors.concept = "Debe seleccionar una cuenta";
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            inputErrors.amount = "Monto debe ser mayor a 0";
            return;
        }

        // Show confirmation dialog
        showConfirmDialog = true;
    }

    async function confirmWithdraw() {
        showConfirmDialog = false;
        successMessage = null;

        const formData = new FormData();
        formData.append("categoryId", selectedConcept!.id);
        formData.append("amount", amount);
        if (authorizedBy.trim()) {
            formData.append("authorizedBy", authorizedBy.trim());
        }
        if (reference.trim()) {
            formData.append("reference", reference.trim());
        }

        isSubmitting = true;
        try {
            const result = await actions.finance.withdraw(formData);

            // Handle validation errors from server
            if (isInputError(result?.error)) {
                const fieldErrors = result.error.fields;
                for (const [field, errors] of Object.entries(fieldErrors)) {
                    inputErrors[field] = Array.isArray(errors)
                        ? errors.join(", ")
                        : String(errors);
                }
                return;
            }

            // Handle non-validation server errors
            if (result?.error) {
                serverError =
                    result.error.message || "Error al procesar el retiro";
                return;
            }

            // Handle successful response
            if (result?.data) {
                const data = result.data as WithdrawResponse;
                if (data.success) {
                    successMessage = data;
                }
            }
        } catch (error) {
            console.error("Submit error:", error);
            serverError =
                error instanceof Error
                    ? error.message
                    : "Error inesperado. Intente nuevamente.";
        } finally {
            isSubmitting = false;
        }
    }

    function cancelConfirm() {
        showConfirmDialog = false;
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
        authorizedBy={successMessage.transaction.authorizedBy}
        color="red"
        registerAnotherHref="/egresos"
        printBack="/egresos"
    />
{:else}
    <!-- NORMAL FORM VIEW -->
    {#if serverError}
        <div
            class="mb-6 flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-200"
            data-testid="withdraw-error-alert"
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
                aria-label="Cerrar"
            >
                <X class="h-4 w-4" />
            </button>
        </div>
    {/if}

    <!-- Confirmation Dialog -->
    {#if showConfirmDialog}
        <div
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            data-testid="confirm-dialog-overlay"
        >
            <div
                class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
                data-testid="confirm-dialog"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.key === "Escape" && cancelConfirm()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                tabindex="0"
            >
                <div class="flex items-start gap-3">
                    <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100"
                    >
                        <TriangleAlert class="h-5 w-5 text-red-600" />
                    </div>
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-slate-900">
                            Confirmar Egreso
                        </h3>
                        <p class="text-sm text-slate-600 mt-1">
                            Revise los detalles antes de confirmar esta
                            operación
                        </p>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-lg p-4 space-y-2.5">
                    <div class="flex justify-between items-start">
                        <span class="text-sm text-slate-600">Cuenta:</span>
                        <div class="text-right">
                            <p
                                class="text-sm font-medium text-slate-900"
                                data-testid="confirm-concept"
                            >
                                {selectedConcept?.name}
                            </p>
                            {#if selectedConcept?.description}
                                <p class="text-xs text-slate-500">
                                    {selectedConcept.description}
                                </p>
                            {/if}
                        </div>
                    </div>

                    <div class="flex justify-between items-center">
                        <span class="text-sm text-slate-600">Monto:</span>
                        <span
                            class="text-lg font-bold text-red-600"
                            data-testid="confirm-amount"
                        >
                            {formatBOB(amount.toString())}
                        </span>
                    </div>

                    {#if reference}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600"
                                >Referencia:</span
                            >
                            <span
                                class="text-sm font-medium text-slate-900"
                                data-testid="confirm-reference"
                            >
                                {reference}
                            </span>
                        </div>
                    {/if}

                    {#if authorizedBy}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600"
                                >Autorizado por:</span
                            >
                            <span
                                class="text-sm font-medium text-slate-900"
                                data-testid="confirm-authorized-by"
                            >
                                {authorizedBy}
                            </span>
                        </div>
                    {/if}
                </div>

                <div class="flex gap-3 pt-2">
                    <button
                        type="button"
                        onclick={cancelConfirm}
                        disabled={isSubmitting}
                        data-testid="cancel-confirm-button"
                        class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={confirmWithdraw}
                        disabled={isSubmitting}
                        data-testid="confirm-withdraw-button"
                        class="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {#if isSubmitting}
                            <div
                                class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                            ></div>
                            <span>Procesando...</span>
                        {:else}
                            <span>Confirmar Egreso</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <form
        method="POST"
        data-testid="withdraw-form"
        onsubmit={handleInitialSubmit}
        class="space-y-5"
    >
        <div class="relative" data-dropdown-container>
            <label
                for="concept"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Cuenta
            </label>

            {#if selectedConcept}
                {@const iconKey =
                    selectedConcept.icon && selectedConcept.icon in iconMap
                        ? (selectedConcept.icon as keyof typeof iconMap)
                        : null}
                {@const SelectedIcon = iconKey ? iconMap[iconKey] : HandCoins}
                <div
                    data-testid="selected-concept-display"
                    class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 flex items-center gap-3 hover:border-red-400 transition"
                >
                    <span
                        class="shrink-0 rounded-md bg-red-50 p-2 text-red-600"
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
                        {#if selectedConcept.description}
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
                        aria-label="Limpiar cuenta"
                    >
                        <X class="h-4 w-4 text-slate-500" />
                    </button>
                </div>
            {:else}
                {#if quickConcepts.length > 0}
                    <div class="mb-3 grid grid-cols-3 gap-2">
                        {#each quickConcepts as quick}
                            {@const isPlaceholder =
                                quick.id.startsWith("placeholder-")}
                            {@const qIconKey =
                                quick.icon && quick.icon in iconMap
                                    ? (quick.icon as keyof typeof iconMap)
                                    : null}
                            {@const QIcon = qIconKey
                                ? iconMap[qIconKey]
                                : HandCoins}
                            {@const hasRange =
                                !isPlaceholder &&
                                !!(quick as any).invoiceRangeId}
                            <button
                                type="button"
                                onclick={() =>
                                    !isPlaceholder && selectConcept(quick)}
                                disabled={isPlaceholder}
                                title={isPlaceholder
                                    ? "Sin cuenta"
                                    : quick.name}
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
                                    <QIcon class="h-4 w-4" />
                                </span>
                                <span class="truncate"
                                    >{isPlaceholder ? "—" : quick.name}</span
                                >
                            </button>
                        {/each}
                    </div>
                {/if}
                <div class="relative">
                    <div
                        class="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
                    >
                        <Search class="h-4 w-4" />
                    </div>
                    <input
                        id="concept"
                        type="text"
                        bind:value={searchQuery}
                        onkeydown={handleKeyDown}
                        onfocus={() => (showDropdown = true)}
                        data-testid="concept-search-input"
                        placeholder="Buscar cuenta o escribir una..."
                        class="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition {inputErrors.concept
                            ? 'border-red-500'
                            : ''}"
                    />
                </div>

                {#if showDropdown && filteredOptions.length > 0}
                    <div
                        data-testid="concept-dropdown"
                        class="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg"
                    >
                        <ul class="max-h-60 overflow-y-auto">
                            {#each filteredOptions as option, idx (option.id)}
                                <li>
                                    <button
                                        type="button"
                                        onclick={() => selectConcept(option)}
                                        data-testid="concept-option-{option.id}"
                                        class="w-full text-left px-4 py-3 hover:bg-red-50 focus:bg-red-50 focus:outline-none transition {idx ===
                                        highlightedIndex
                                            ? 'bg-red-100'
                                            : ''}"
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
                {:else if showDropdown && filteredOptions.length === 0 && searchQuery.trim()}
                    <div
                        data-testid="no-concepts-message"
                        class="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg px-4 py-6 text-center text-slate-500"
                    >
                        <p class="text-sm mb-3">
                            No hay cuentas que coincidan con "{searchQuery}"
                        </p>
                    </div>
                {/if}
            {/if}

            {#if inputErrors.concept}
                <p
                    data-testid="concept-input-error"
                    class="mt-2 text-sm text-red-600 flex items-center gap-1"
                >
                    <CircleAlert class="h-4 w-4" />
                    {inputErrors.concept}
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
                <span class="absolute left-4 top-2 text-slate-500 font-medium"
                    >Bs</span
                >
                <input
                    id="amount"
                    bind:value={amount}
                    use:noWheel
                    type="number"
                    step="0.01"
                    data-testid="withdraw-amount-input"
                    placeholder="0.00"
                    class="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition {inputErrors.amount
                        ? 'border-red-500 ring-2 ring-red-100'
                        : ''}"
                />
            </div>

            <QuickAmountActions
                {amount}
                onSelectAmount={(value) => (amount = value)}
                activeClass="bg-red-600 border-red-600 text-white shadow-sm"
                inactiveClass="bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 active:bg-red-100"
            />

            {#if amount && parseFloat(amount) > 0 && !inputErrors.amount}
                <div
                    in:fade={{ duration: 200 }}
                    data-testid="amount-confirmation-badge"
                    class="mt-2 w-full flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg"
                >
                    <div class="flex items-center gap-2">
                        <CircleCheck class="w-4 h-4 text-red-600 shrink-0" />
                        <span class="text-sm font-medium text-red-900">
                            Monto ingresado
                        </span>
                    </div>
                    <span class="text-base font-bold text-red-900">
                        {formatBOB(String(amount))}
                    </span>
                </div>
            {/if}
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
                data-testid="withdraw-reference-input"
                placeholder="Ej: Número de comprobante, talonario"
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition {inputErrors.amount
                    ? 'border-red-500 ring-2 ring-red-100'
                    : ''}"
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

        <button
            type="submit"
            disabled={isSubmitting || !selectedConcept || !amount}
            data-testid="withdraw-submit-button"
            class="w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700 active:bg-red-800 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <Minus class="h-5 w-5" />
            {isSubmitting ? "Procesando..." : "Registrar Egreso"}
        </button>
    </form>
{/if}
