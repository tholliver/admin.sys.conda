<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions } from "astro:actions";
    import {
        Banknote,
        Clock,
        CircleCheckBig,
        CircleAlert,
        Vault,
        ArrowUpRight,
    } from "@lucide/svelte";

    interface CashboxInfo {
        id: string;
        name: string;
        balance: number;
    }

    interface Fee {
        id: number;
        amount: string | number;
        period: string;
        status: string;
        employee: {
            fullName: string;
            ci: string;
            sectorName: string;
            sectorId: number | null;
            chargeTitle: string;
        };
    }

    interface Props {
        fee: Fee;
        cashbox: CashboxInfo | null;
        currentPeriod: string;
        periodLabel: string;
    }

    let { fee, cashbox, currentPeriod, periodLabel }: Props = $props();

    let isOpen       = $state(false);
    let isSubmitting = $state(false);
    let serverError  = $state<string | null>(null);
    let successMsg   = $state<string | null>(null);
    let notes        = $state("");

    const amount    = $derived(Number(fee.amount));
    const isOverdue = $derived(fee.period < currentPeriod);
    const balance   = $derived(cashbox?.balance ?? 0);
    const lowFunds  = $derived(cashbox !== null && balance < amount);
    const noBox     = $derived(cashbox === null);

    const bsFormat = (n: number) =>
        "Bs " + n.toLocaleString("es-BO", { minimumFractionDigits: 2 });

    function reset() {
        serverError = null;
        successMsg  = null;
        notes       = "";
    }

    async function handlePay() {
        serverError  = null;
        isSubmitting = true;
        try {
            const fd = new FormData();
            fd.set("feeId",      String(fee.id));
            fd.set("amountPaid", String(amount));
            if (notes.trim()) fd.set("notes", notes.trim());

            const result = await actions.rrhh.payEmployeeFee(fd);

            if (result?.error) {
                serverError = result.error.message ?? "Error al registrar el pago.";
                return;
            }
            successMsg = result?.data?.message ?? "Pago registrado correctamente.";
            setTimeout(() => {
                isOpen = false;
                window.location.reload();
            }, 1200);
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Dialog bind:isOpen size="sm" onClose={reset} testId="pay-fee-dialog">

    {#snippet trigger({ open })}
        <button
            onclick={open}
            class="rounded border px-3 py-1 text-xs font-semibold transition-colors
                {isOverdue
                    ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}"
        >
            {isOverdue ? "Pagar atrasado" : "Pagar"}
        </button>
    {/snippet}

    {#if successMsg}
        <div class="flex flex-col items-center gap-3 py-8 text-center">
            <CircleCheckBig class="h-10 w-10 text-emerald-500" />
            <p class="font-semibold text-slate-900">{successMsg}</p>
            <p class="text-xs text-slate-400">Actualizando…</p>
        </div>

    {:else}
        <div class="flex flex-col gap-4">

            <!-- Who + what -->
            <div>
                <p class="font-semibold text-slate-900 text-sm leading-tight">
                    {fee.employee.fullName}
                </p>
                <p class="text-xs text-slate-500 mt-0.5">
                    {fee.employee.chargeTitle} · {fee.employee.sectorName}
                </p>
            </div>

            <!-- Overdue badge -->
            {#if isOverdue}
                <div class="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                    <Clock class="size-3.5 shrink-0 text-red-500" />
                    Período atrasado: <strong class="capitalize ml-0.5">{periodLabel}</strong>
                </div>
            {/if}

            <!-- Amount + cashbox in one card -->
            <div class="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">

                <!-- Amount row — prominent -->
                <div class="flex items-center justify-between px-4 py-3.5
                    {isOverdue ? 'bg-red-50' : 'bg-emerald-50'}">
                    <span class="text-xs font-medium {isOverdue ? 'text-red-700' : 'text-emerald-700'}">
                        Monto {isOverdue ? "atrasado" : "del período"}
                    </span>
                    <span class="text-xl font-bold tabular-nums font-mono
                        {isOverdue ? 'text-red-800' : 'text-emerald-800'}">
                        {bsFormat(amount)}
                    </span>
                </div>

                <!-- Cashbox row -->
                <div class="flex items-center justify-between px-4 py-3 bg-white">
                    <div class="flex items-center gap-2 text-xs text-slate-500">
                        <Vault class="size-3.5 shrink-0 text-slate-400" />
                        <span>
                            {#if noBox}
                                Sin caja vinculada
                            {:else}
                                {cashbox!.name}
                            {/if}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        {#if !noBox}
                            <span class="text-xs font-mono font-semibold tabular-nums
                                {lowFunds ? 'text-red-600' : 'text-slate-700'}">
                                {bsFormat(balance)}
                            </span>
                            <a
                                href="/cajas/{cashbox!.id}"
                                target="_blank"
                                class="text-slate-400 hover:text-blue-600 transition-colors"
                                title="Ver caja"
                            >
                                <ArrowUpRight class="size-3.5" />
                            </a>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Low balance / no cashbox warning -->
            {#if noBox}
                <div class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                    <CircleAlert class="size-3.5 shrink-0 text-amber-500 mt-px" />
                    <span>
                        El sector <strong>{fee.employee.sectorName}</strong> no tiene una caja vinculada.
                        El pago usará la caja general.
                    </span>
                </div>
            {:else if lowFunds}
                <div class="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-800">
                    <CircleAlert class="size-3.5 shrink-0 text-red-500 mt-px" />
                    <span>
                        Saldo insuficiente en <strong>{cashbox!.name}</strong>.
                        Faltan <strong>{bsFormat(amount - balance)}</strong> para cubrir este pago.
                        <a href="/cajas/{cashbox!.id}" target="_blank" class="underline hover:text-red-900 ml-0.5">
                            Depositar ahora ↗
                        </a>
                    </span>
                </div>
            {/if}

            <!-- Notes — only optional field worth keeping -->
            <div class="flex flex-col gap-1.5">
                <label for="pay-notes" class="text-xs font-medium text-slate-500">
                    Observaciones <span class="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                    id="pay-notes"
                    type="text"
                    bind:value={notes}
                    maxlength={500}
                    placeholder="Ej: pago con retraso acordado…"
                    class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800
                           placeholder:text-slate-300 focus:outline-none focus:ring-2
                           focus:ring-emerald-400 focus:border-transparent transition"
                />
            </div>

            <!-- Server error -->
            {#if serverError}
                <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                    <CircleAlert class="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-700">{serverError}</p>
                </div>
            {/if}

            <!-- Actions -->
            <div class="flex gap-2 justify-end border-t border-slate-100 pt-2">
                <button
                    type="button"
                    onclick={() => (isOpen = false)}
                    disabled={isSubmitting}
                    class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium
                           text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onclick={handlePay}
                    disabled={isSubmitting}
                    class="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all
                           active:scale-95 disabled:opacity-60 flex items-center gap-2
                           {isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}"
                >
                    {#if isSubmitting}
                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Procesando…
                    {:else}
                        <Banknote class="h-4 w-4" />
                        Confirmar pago
                    {/if}
                </button>
            </div>

        </div>
    {/if}

</Dialog>