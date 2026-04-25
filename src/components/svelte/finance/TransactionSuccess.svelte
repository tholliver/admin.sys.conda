<script lang="ts">
    import { CircleCheck, Plus, Eye, ArrowLeft } from "@lucide/svelte";

    interface Props {
        amount: string;
        concept: string;
        reference: string | null;
        transactionId: string;
        newBalance: string;
        authorizedBy?: string | null;
        color: "blue" | "red";
        registerAnotherHref: string;
        printBack: string;
    }

    let {
        amount,
        concept,
        reference,
        transactionId,
        newBalance,
        authorizedBy,
        color,
        registerAnotherHref,
        printBack,
    }: Props = $props();

    let hdr = $derived(color === "blue" ? "bg-blue-700" : "bg-red-700");
    let sub = $derived(color === "blue" ? "text-blue-200" : "text-red-200");
    let badge = $derived(color === "blue" ? "bg-blue-900/40 text-blue-200" : "bg-red-900/40 text-red-200");
    let val = $derived(color === "blue" ? "text-blue-700" : "text-red-700");

    let primaryBtn = $derived(
        color === "blue"
            ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white"
            : "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white"
    );

    let label = $derived(color === "blue" ? "Ingreso registrado" : "Egreso registrado");

    function openPrint() {
        window.open(`/print/recibo?id=${transactionId}&back=${printBack}`, "_blank");
    }
</script>

<div class="rounded-xl border border-slate-200 overflow-hidden">
    <!-- Header -->
    <div class="{hdr} px-5 py-4 flex items-center gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <CircleCheck class="h-5 w-5 text-white" />
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-white font-semibold text-sm leading-tight">{label}</p>
            <p class="{sub} text-xs mt-0.5 truncate">{concept}</p>
            {#if reference}
                <span class="inline-block mt-1 font-mono text-xs {badge} px-2 py-0.5 rounded">
                    {reference}
                </span>
            {/if}
        </div>
    </div>

    <!-- Receipt rows -->
    <div class="bg-white divide-y divide-slate-100">
        <div class="flex justify-between items-center px-5 py-3">
            <span class="text-sm text-slate-500">Monto</span>
            <span class="text-base font-semibold {val}">{amount}</span>
        </div>
        <div class="flex justify-between items-center px-5 py-3">
            <span class="text-sm text-slate-500">Referencia</span>
            <span class="text-sm font-mono font-medium text-slate-700">{reference ?? "—"}</span>
        </div>
        <div class="flex justify-between items-center px-5 py-3">
            <span class="text-sm text-slate-500">Concepto</span>
            <span class="text-sm font-medium text-slate-900 text-right max-w-[60%] truncate">{concept}</span>
        </div>
        {#if authorizedBy}
            <div class="flex justify-between items-center px-5 py-3">
                <span class="text-sm text-slate-500">Autorizado por</span>
                <span class="text-sm font-medium text-slate-900">{authorizedBy}</span>
            </div>
        {/if}
        <div class="flex justify-between items-center px-5 py-3">
            <span class="text-sm text-slate-500">Nuevo balance</span>
            <span class="text-sm font-semibold text-slate-900">{newBalance}</span>
        </div>
    </div>

    <!-- Actions -->
    <div class="bg-slate-50 border-t border-slate-200 px-5 py-3 space-y-2">
        <!-- Primary -->
        <button
            type="button"
            onclick={openPrint}
            class="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors {primaryBtn}"
        >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M9 21h6v-4H9v4z" />
            </svg>
            Imprimir comprobante{reference ? ` ${reference}` : ""}
        </button>

        <!-- Secondary -->
        <div class="flex gap-2">
            <a
                href={registerAnotherHref}
                class="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
                <Plus class="h-4 w-4" />
                Registrar otro
            </a>
            <a
                href="/historial"
                class="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
                <Eye class="h-4 w-4" />
                Ver historial
            </a>
        </div>

        <!-- Tertiary -->
        <a
            href="/"
            class="flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors pt-1"
        >
            <ArrowLeft class="h-3 w-3" />
            Volver al inicio
        </a>
    </div>
</div>
