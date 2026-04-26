<script lang="ts">
    // src/components/svelte/finance/OverdraftConfirmDialog.svelte
    // Pure UI — receives debt info, emits confirm/cancel.
    // Used by WithdrawForm and PayFeeDialog independently.

    import { TriangleAlert, Wallet, ArrowDown } from "@lucide/svelte";
    import { formatBOB } from "@/utils/formatters";

    interface Props {
        cashboxName: string;
        concept:     string;
        available:   number;
        requested:   number;
        deficit:     number;
        isSubmitting?: boolean;
        onConfirm:   () => void;
        onCancel:    () => void;
    }

    let {
        cashboxName,
        concept,
        available,
        requested,
        deficit,
        isSubmitting = false,
        onConfirm,
        onCancel,
    }: Props = $props();
</script>

<!-- Full-screen overlay, same z-index pattern as WithdrawForm confirm dialog -->
<div
    class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onCancel()}
    tabindex="-1"
>
    <div
        class="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden"
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Header -->
        <div class="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-start gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <TriangleAlert class="h-5 w-5 text-amber-600" />
            </div>
            <div>
                <h3 class="text-base font-bold text-amber-900">Fondos insuficientes</h3>
                <p class="text-xs text-amber-700 mt-0.5">
                    ¿Registrar el faltante como deuda de la caja?
                </p>
            </div>
        </div>

        <!-- Body -->
        <div class="px-5 py-4 space-y-4">

            <!-- Concept label -->
            <p class="text-xs text-slate-500">
                Concepto: <span class="font-semibold text-slate-700">{concept}</span>
            </p>

            <!-- Balance breakdown card -->
            <div class="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-sm">
                <div class="flex items-center justify-between px-4 py-2.5">
                    <span class="flex items-center gap-2 text-slate-600">
                        <Wallet class="h-3.5 w-3.5 text-slate-400" />
                        Disponible en <span class="font-medium text-slate-800">{cashboxName}</span>
                    </span>
                    <span class="font-semibold text-slate-800 tabular-nums">{formatBOB(String(available))}</span>
                </div>
                <div class="flex items-center justify-between px-4 py-2.5">
                    <span class="flex items-center gap-2 text-slate-600">
                        <ArrowDown class="h-3.5 w-3.5 text-red-400" />
                        Monto solicitado
                    </span>
                    <span class="font-semibold text-red-700 tabular-nums">{formatBOB(String(requested))}</span>
                </div>
                <div class="flex items-center justify-between px-4 py-2.5 bg-amber-50 rounded-b-lg">
                    <span class="text-sm font-semibold text-amber-800">Deuda a registrar</span>
                    <span class="text-base font-bold text-amber-700 tabular-nums">{formatBOB(String(deficit))}</span>
                </div>
            </div>

            <!-- Info note -->
            <p class="text-xs text-slate-500 leading-relaxed">
                La caja quedará con saldo negativo de
                <span class="font-semibold text-red-600">{formatBOB(String(available - requested))}</span>.
                La transacción quedará marcada con el monto de deuda para trazabilidad.
            </p>
        </div>

        <!-- Footer -->
        <div class="px-5 pb-5 flex gap-3">
            <button
                type="button"
                onclick={onCancel}
                disabled={isSubmitting}
                class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
                Cancelar
            </button>
            <button
                type="button"
                onclick={onConfirm}
                disabled={isSubmitting}
                class="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {#if isSubmitting}
                    <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Registrando...
                {:else}
                    <TriangleAlert class="h-4 w-4" />
                    Registrar con deuda
                {/if}
            </button>
        </div>
    </div>
</div>
