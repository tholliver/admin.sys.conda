<script lang="ts">
    import {
        Handshake,
        CircleAlert,
        CircleCheck,
        TriangleAlert,
        X,
        Search,
        Wallet,
    } from "@lucide/svelte";
    import { fade } from "svelte/transition";
    import { actions, isInputError } from "astro:actions";
    import { noWheel } from "@/lib/form/utils";
    import { formatBOB } from "@/services/finances/helpers";
    import TransactionSuccess from "./TransactionSuccess.svelte";
    import QuickAmountActions from "./QuickAmountActions.svelte";

    interface Cashbox {
        id: string;
        name: string;
        code: string;
        balance: string | null;
    }

    interface Contractor {
        id: number;
        uuid: string;
        fullName: string;
        specialty: string | null;
        phone: string | null;
        status: "activo" | "inactivo";
    }

    interface PayResponse {
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

    interface Props {
        cashboxes: Cashbox[];
        contractors: Contractor[];
    }

    let { cashboxes, contractors }: Props = $props();

    let inputErrors = $state<Record<string, string>>({});
    let serverError = $state<string | null>(null);
    let successData = $state<PayResponse | null>(null);
    let isSubmitting = $state(false);
    let showConfirmDialog = $state(false);

    // Form state
    let cashboxId = $state("");
    let contractorId = $state<number | "">("");
    let amount = $state("");
    let concept = $state("");
    let receiptNumber = $state("");
    let notes = $state("");

    // Search
    let search = $state("");
    let showDropdown = $state(false);
    let highlightedIndex = $state(0);

    let selectedContractor = $state<Contractor | null>(null);
    let selectedCashbox = $derived(
        cashboxes.find((c) => c.id === cashboxId) ?? null,
    );
    let cashboxBalance = $derived(parseFloat(selectedCashbox?.balance ?? "0"));
    let hasEnough = $derived(
        selectedCashbox && amount && parseFloat(amount) > 0
            ? cashboxBalance >= parseFloat(amount)
            : true,
    );

    let filteredContractors = $derived.by(() => {
        const q = search.toLowerCase().trim();
        if (!q) return contractors;
        return contractors.filter(
            (c) =>
                c.fullName.toLowerCase().includes(q) ||
                c.specialty?.toLowerCase().includes(q),
        );
    });

    function selectContractor(c: Contractor) {
        selectedContractor = c;
        contractorId = c.id;
        search = "";
        showDropdown = false;
        highlightedIndex = 0;
    }

    function clearContractor() {
        selectedContractor = null;
        contractorId = "";
        search = "";
        highlightedIndex = 0;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (!showDropdown || filteredContractors.length === 0) return;
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                highlightedIndex = Math.min(
                    highlightedIndex + 1,
                    filteredContractors.length - 1,
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                break;
            case "Enter":
            case "Tab":
                e.preventDefault();
                if (filteredContractors[highlightedIndex]) {
                    selectContractor(filteredContractors[highlightedIndex]);
                }
                break;
            case "Escape":
                showDropdown = false;
                break;
        }
    }

    function onClickOutside(e: MouseEvent) {
        if (!(e.target as HTMLElement).closest("[data-contractor-dropdown]")) {
            showDropdown = false;
        }
    }

    function handleInitialSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        if (!selectedContractor) {
            inputErrors.contractor = "Seleccione un contratista";
            return;
        }
        if (!cashboxId) {
            inputErrors.cashboxId = "Seleccione la caja";
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            inputErrors.amount = "Monto debe ser mayor a 0";
            return;
        }
        if (!hasEnough) {
            inputErrors.amount = `Saldo insuficiente. Disponible: ${formatBOB(cashboxBalance)}`;
            return;
        }
        if (!concept.trim()) {
            inputErrors.concept = "Concepto requerido";
            return;
        }

        showConfirmDialog = true;
    }

    async function confirmPayment() {
        showConfirmDialog = false;
        const formData = new FormData();
        formData.append("contractorId", String(contractorId));
        formData.append("cashboxId", cashboxId);
        formData.append("amount", amount);
        formData.append("concept", concept.trim());
        if (receiptNumber.trim())
            formData.append("receiptNumber", receiptNumber.trim());
        if (notes.trim()) formData.append("notes", notes.trim());

        isSubmitting = true;
        try {
            const result = await actions.finance.payContractor(formData);

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
                    result.error.message || "Error al procesar el pago";
                return;
            }

            if (result?.data?.success) {
                successData = result.data as PayResponse;
            }
        } catch (err) {
            serverError =
                err instanceof Error
                    ? err.message
                    : "Error inesperado. Intente nuevamente.";
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:window onclick={onClickOutside} />

{#if successData}
    <TransactionSuccess
        amount={successData.transaction.amount}
        concept={successData.transaction.concept}
        reference={successData.transaction.reference}
        transactionId={successData.transaction.id}
        newBalance={successData.newBalance}
        color="red"
        registerAnotherHref="/contratistas"
        printBack="/contratistas"
    />
{:else}
    {#if serverError}
        <div
            class="mb-6 flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-200"
        >
            <CircleAlert class="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div class="flex-1">
                <h3 class="font-semibold text-red-900">Error</h3>
                <p class="text-sm text-red-700">{serverError}</p>
            </div>
            <button
                type="button"
                onclick={() => (serverError = null)}
                class="text-red-600 hover:text-red-800 shrink-0"
            >
                <X class="h-4 w-4" />
            </button>
        </div>
    {/if}

    <!-- CONFIRM DIALOG -->
    {#if showConfirmDialog}
        <div
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
            <div
                class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) =>
                    e.key === "Escape" && (showConfirmDialog = false)}
                role="dialog"
                aria-modal="true"
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
                            Confirmar Pago a Contratista
                        </h3>
                        <p class="text-sm text-slate-600 mt-1">
                            Revise los detalles antes de confirmar
                        </p>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-lg p-4 space-y-2.5">
                    <div class="flex justify-between items-start">
                        <span class="text-sm text-slate-600">Contratista:</span>
                        <div class="text-right">
                            <p class="text-sm font-medium text-slate-900">
                                {selectedContractor?.fullName}
                            </p>
                            {#if selectedContractor?.specialty}
                                <p class="text-xs text-slate-500">
                                    {selectedContractor.specialty}
                                </p>
                            {/if}
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-slate-600">Caja:</span>
                        <span class="text-sm font-medium text-slate-900"
                            >{selectedCashbox?.name}</span
                        >
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-slate-600">Monto:</span>
                        <span class="text-lg font-bold text-red-600"
                            >{formatBOB(amount)}</span
                        >
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-slate-600">Concepto:</span>
                        <span
                            class="text-sm font-medium text-slate-900 text-right max-w-[60%] truncate"
                            >{concept}</span
                        >
                    </div>
                    {#if receiptNumber}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600">Recibo:</span>
                            <span class="text-sm font-mono text-slate-900"
                                >{receiptNumber}</span
                            >
                        </div>
                    {/if}
                </div>

                <div class="flex gap-3 pt-2">
                    <button
                        type="button"
                        onclick={() => (showConfirmDialog = false)}
                        disabled={isSubmitting}
                        class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={confirmPayment}
                        disabled={isSubmitting}
                        class="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {#if isSubmitting}
                            <div
                                class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                            ></div>
                            <span>Procesando...</span>
                        {:else}
                            <span>Confirmar Pago</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <form method="POST" onsubmit={handleInitialSubmit} class="space-y-5">
        <!-- CONTRACTOR PICKER -->
        <div class="relative" data-contractor-dropdown>
            <label class="block text-sm font-medium text-slate-700 mb-2"
                >Contratista</label
            >

            {#if selectedContractor}
                <div
                    class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 flex items-center gap-3 hover:border-red-400 transition"
                >
                    <span
                        class="shrink-0 rounded-md bg-red-50 p-2 text-red-600"
                    >
                        <Handshake class="h-4 w-4" />
                    </span>
                    <div class="flex-1 min-w-0">
                        <p class="text-slate-900 font-medium">
                            {selectedContractor.fullName}
                        </p>
                        {#if selectedContractor.specialty}
                            <p class="text-xs text-slate-500">
                                {selectedContractor.specialty}
                            </p>
                        {/if}
                    </div>
                    <button
                        type="button"
                        onclick={clearContractor}
                        class="p-1 hover:bg-slate-100 rounded transition-colors shrink-0"
                        aria-label="Limpiar"
                    >
                        <X class="h-4 w-4 text-slate-500" />
                    </button>
                </div>
            {:else}
                <div class="relative">
                    <div
                        class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                        <Search class="h-4 w-4" />
                    </div>
                    <input
                        type="text"
                        bind:value={search}
                        onkeydown={handleKeyDown}
                        onfocus={() => (showDropdown = true)}
                        placeholder="Buscar contratista..."
                        class="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition {inputErrors.contractor
                            ? 'border-red-500'
                            : ''}"
                    />
                </div>

                {#if showDropdown && filteredContractors.length > 0}
                    <div
                        class="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg"
                    >
                        <ul class="max-h-56 overflow-y-auto">
                            {#each filteredContractors as c, idx (c.id)}
                                <li>
                                    <button
                                        type="button"
                                        onclick={() => selectContractor(c)}
                                        class="w-full text-left px-4 py-3 hover:bg-red-50 transition {idx ===
                                        highlightedIndex
                                            ? 'bg-red-100'
                                            : ''}"
                                    >
                                        <p class="font-medium text-slate-900">
                                            {c.fullName}
                                        </p>
                                        {#if c.specialty}
                                            <p class="text-xs text-slate-500">
                                                {c.specialty}
                                            </p>
                                        {/if}
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {:else if showDropdown && search.trim() && filteredContractors.length === 0}
                    <div
                        class="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg px-4 py-6 text-center text-slate-500 text-sm"
                    >
                        No hay contratistas que coincidan con "{search}"
                    </div>
                {/if}
            {/if}

            {#if inputErrors.contractor}
                <p class="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{inputErrors.contractor}
                </p>
            {/if}
        </div>

        <!-- CASHBOX -->
        <div>
            <label
                for="cashboxId"
                class="block text-sm font-medium text-slate-700 mb-2"
                >Caja</label
            >
            <select
                id="cashboxId"
                bind:value={cashboxId}
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition {inputErrors.cashboxId
                    ? 'border-red-500'
                    : ''}"
            >
                <option value="">— Seleccionar caja —</option>
                {#each cashboxes as box}
                    <option value={box.id}
                        >{box.name} ({box.code}) — {formatBOB(
                            box.balance ?? "0",
                        )}</option
                    >
                {/each}
            </select>
            {#if selectedCashbox}
                <div
                    in:fade={{ duration: 150 }}
                    class="mt-2 flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                    <div class="flex items-center gap-2 text-slate-600">
                        <Wallet class="h-4 w-4" />
                        <span>Saldo disponible</span>
                    </div>
                    <span class="font-semibold text-slate-900"
                        >{formatBOB(selectedCashbox.balance ?? "0")}</span
                    >
                </div>
            {/if}
            {#if inputErrors.cashboxId}
                <p class="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{inputErrors.cashboxId}
                </p>
            {/if}
        </div>

        <!-- AMOUNT -->
        <div>
            <label
                for="amount"
                class="block text-sm font-medium text-slate-700 mb-2"
                >Monto (Bs.)</label
            >
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
                    min="0.01"
                    placeholder="0.00"
                    class="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition {inputErrors.amount ||
                    !hasEnough
                        ? 'border-red-500 ring-2 ring-red-100'
                        : ''}"
                />
            </div>

            <QuickAmountActions
                {amount}
                onSelectAmount={(v) => (amount = v)}
                activeClass="bg-red-600 border-red-600 text-white shadow-sm"
                inactiveClass="bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 active:bg-red-100"
            />

            {#if amount && parseFloat(amount) > 0 && hasEnough && !inputErrors.amount}
                <div
                    in:fade={{ duration: 200 }}
                    class="mt-2 w-full flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg"
                >
                    <div class="flex items-center gap-2">
                        <CircleCheck class="w-4 h-4 text-red-600 shrink-0" />
                        <span class="text-sm font-medium text-red-900"
                            >Monto ingresado</span
                        >
                    </div>
                    <span class="text-base font-bold text-red-900"
                        >{formatBOB(amount)}</span
                    >
                </div>
            {/if}
            {#if !hasEnough && amount && parseFloat(amount) > 0}
                <div
                    in:fade={{ duration: 150 }}
                    class="mt-2 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg"
                >
                    <TriangleAlert class="h-4 w-4 text-red-600 shrink-0" />
                    <span class="text-sm text-red-700"
                        >Saldo insuficiente. Disponible: {formatBOB(
                            cashboxBalance,
                        )}</span
                    >
                </div>
            {/if}
            {#if inputErrors.amount}
                <p class="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{inputErrors.amount}
                </p>
            {/if}
        </div>

        <!-- CONCEPT -->
        <div>
            <label
                for="concept"
                class="block text-sm font-medium text-slate-700 mb-2"
                >Concepto del Servicio</label
            >
            <input
                id="concept"
                bind:value={concept}
                type="text"
                maxlength="255"
                placeholder="Ej: Reparación de techo, Instalación eléctrica"
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition {inputErrors.concept
                    ? 'border-red-500'
                    : ''}"
            />
            {#if inputErrors.concept}
                <p class="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-4 w-4" />{inputErrors.concept}
                </p>
            {/if}
        </div>

        <!-- RECEIPT -->
        <div>
            <label
                for="receiptNumber"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                N° Recibo <span class="text-slate-500 text-xs">(Opcional)</span>
            </label>
            <input
                id="receiptNumber"
                bind:value={receiptNumber}
                type="text"
                maxlength="30"
                placeholder="Ej: REC-001"
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition"
            />
        </div>

        <!-- NOTES -->
        <div>
            <label
                for="notes"
                class="block text-sm font-medium text-slate-700 mb-2"
            >
                Notas <span class="text-slate-500 text-xs">(Opcional)</span>
            </label>
            <textarea
                id="notes"
                bind:value={notes}
                rows="2"
                maxlength="1000"
                placeholder="Observaciones o detalles adicionales..."
                class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 transition resize-none"
            ></textarea>
        </div>

        <button
            type="submit"
            disabled={isSubmitting ||
                !selectedContractor ||
                !cashboxId ||
                !amount ||
                !concept.trim() ||
                !hasEnough}
            class="w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700 active:bg-red-800 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <Handshake class="h-5 w-5" />
            {isSubmitting ? "Procesando..." : "Registrar Pago a Contratista"}
        </button>
    </form>
{/if}
