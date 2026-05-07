<script lang="ts">
    import { Ban, CircleAlert } from "@lucide/svelte";
    import { actions, isInputError } from "astro:actions";
    import Dialog from "@/components/svelte/Dialog.svelte";

    interface Props {
        transactionId: string;
        concept: string;
        amount: string;
    }

    let {
        transactionId,
        concept,
        amount,
    }: Props = $props();

    let isOpen = $state(false);
    let reason = $state("");
    let isSubmitting = $state(false);
    let errorMessage = $state<string | null>(null);

    const formattedAmount = $derived(
        `Bs ${parseFloat(amount).toFixed(2)}`
    );

    function handleClose() {
        isOpen = false;
        reason = "";
        errorMessage = null;
    }

    async function handleConfirm(close: () => void) {
        if (isSubmitting) return;
        errorMessage = null;

        const trimmedReason = reason.trim();
        if (trimmedReason.length < 5) {
            errorMessage = "El motivo debe tener al menos 5 caracteres.";
            return;
        }

        const formData = new FormData();
        formData.append("transactionId", transactionId);
        formData.append("reason", trimmedReason);

        isSubmitting = true;
        try {
            const result = await actions.finance.voidTransaction(formData);

            if (isInputError(result?.error)) {
                const fieldErrors = result.error.fields;
                const reasonError = fieldErrors.reason;
                errorMessage = Array.isArray(reasonError)
                    ? reasonError.join(", ")
                    : reasonError
                    ? String(reasonError)
                    : null;
                if (errorMessage) return;
            }

            if (result?.error) {
                errorMessage = result.error.message || "No se pudo anular la transacción.";
                return;
            }

            close();
            window.location.reload();
        } catch (error) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Error inesperado al anular la transacción.";
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Dialog
    bind:isOpen
    onClose={handleClose}
    size="sm"
    title="Anular Transacción"
    description="Esta acción es irreversible. El saldo de GEN será revertido."
    testId={`void-dialog-${transactionId}`}
>
    {#snippet trigger({ open })}
        <button
            type="button"
            data-testid={`void-transaction-open-${transactionId}`}
            class="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
            onclick={open}
        >
            <Ban class="h-3 w-3" />
            Anular
        </button>
    {/snippet}

    <div class="space-y-4">
        <!-- Error banner -->
        {#if errorMessage}
            <div
                class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                data-testid={`void-dialog-error-${transactionId}`}
            >
                <CircleAlert class="mt-0.5 h-4 w-4 shrink-0" />
                <p>{errorMessage}</p>
            </div>
        {/if}

        <!-- Transaction summary -->
        <div
            class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-1"
            data-testid={`void-dialog-summary-${transactionId}`}
        >
            <p class="text-sm font-semibold text-amber-900 truncate">{concept}</p>
            <p class="text-base font-bold text-amber-700">{formattedAmount}</p>
        </div>

        <!-- Reason input -->
        <div>
            <label
                for={`void-reason-${transactionId}`}
                class="mb-1 block text-sm font-medium text-slate-700"
            >
                Motivo de anulación <span class="text-red-600">*</span>
            </label>
            <textarea
                id={`void-reason-${transactionId}`}
                bind:value={reason}
                rows="3"
                required
                minlength="5"
                maxlength="500"
                placeholder="Ej: Error en el monto registrado, operación duplicada..."
                class="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                data-testid={`void-dialog-reason-${transactionId}`}
            ></textarea>
            <p class="mt-1 text-xs text-slate-400">{reason.trim().length}/500 caracteres</p>
        </div>
    </div>

    {#snippet footer({ close })}
        <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            onclick={close}
            disabled={isSubmitting}
        >
            Cancelar
        </button>
        <button
            type="button"
            class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            onclick={() => handleConfirm(close)}
            disabled={isSubmitting || reason.trim().length < 5}
            data-testid={`void-dialog-submit-${transactionId}`}
        >
            {#if isSubmitting}
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Anulando...</span>
            {:else}
                <Ban class="h-4 w-4" />
                <span>Confirmar Anulación</span>
            {/if}
        </button>
    {/snippet}
</Dialog>
