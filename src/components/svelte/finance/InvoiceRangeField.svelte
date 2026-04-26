<script lang="ts">
    /**
     * InvoiceRangeField.svelte
     *
     * The "Referencia" field for deposit and withdraw forms.
     * Handles three states based on the selected concept's range:
     *
     * 1. Active range   → input disabled, preview chip shows next number
     * 2. Exhausted range → input enabled, compact TalonarioBanner shown
     * 3. No range        → input enabled, plain manual entry
     *
     * Props mirror what DepositForm and WithdrawForm need so both can use it.
     */
    import { CircleAlert, CircleCheck, Receipt } from "@lucide/svelte";
    import InvoiceBookBanner from "./InvoiceBookBanner.svelte";
    import type { InvoicePreview } from "@/lib/finance/invoice-range.utils";
    import type { ConceptWithRange } from "@/lib/finance/invoice-range.utils";
    import { isTalonarioExhausted } from "@/lib/finance/invoice-range.utils";

    interface Props {
        value: string;
        onInput: (v: string) => void;
        invoicePreview: InvoicePreview | null;
        selectedConcept: ConceptWithRange | null;
        error?: string;
        accentColor?: "green" | "red"; // matches form color theme
    }

    let {
        value,
        onInput,
        invoicePreview,
        selectedConcept,
        error,
        accentColor = "green",
    }: Props = $props();

    const exhausted = $derived(isTalonarioExhausted(selectedConcept));

    const focusRing = $derived(
        accentColor === "green"
            ? "focus:border-green-500 focus:ring-green-100"
            : "focus:border-red-500 focus:ring-red-100",
    );
</script>

<div class="space-y-2">
    <label for="reference" class="block text-sm font-medium text-slate-700">
        Referencia
        <span class="text-slate-400 text-xs font-normal ml-1">(Opcional)</span>
    </label>

    <!-- Input -->
    <input
        id="reference"
        type="text"
        value={invoicePreview ? invoicePreview.label : value}
        oninput={(e) => onInput((e.target as HTMLInputElement).value)}
        disabled={!!invoicePreview}
        placeholder={invoicePreview
            ? invoicePreview.label
            : exhausted
              ? "Ingrese referencia manualmente"
              : "Ej: Número de recibo"}
        class="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900
               focus:outline-none focus:ring-2 transition
               disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
               {focusRing}
               {error ? 'border-red-500' : ''}"
    />

    <!-- State chips -->
    {#if invoicePreview}
        <!-- Active range preview -->
        <div
            class="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm"
        >
            <CircleCheck class="h-4 w-4 text-emerald-600 shrink-0" />
            <span class="text-emerald-800">
                Nro. de talonario:
                <strong class="font-mono">{invoicePreview.label}</strong>
                — se asignará automáticamente
            </span>
        </div>
    {:else if exhausted && selectedConcept}
        <!-- Exhausted range: compact banner -->
        <InvoiceBookBanner
            type="exhausted"
            categoryName={selectedConcept.name}
            rangeEnd={selectedConcept.invoiceRangeEnd ?? undefined}
        />
    {/if}

    {#if error}
        <p class="text-sm text-red-600 flex items-center gap-1">
            <CircleAlert class="h-4 w-4 shrink-0" />
            {error}
        </p>
    {/if}
</div>
