<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { Wallet, CircleAlert, CircleCheck, X } from "@lucide/svelte";

    let isOpen = $state(false);
    let isSubmitting = $state(false);
    let inputErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    let cbName = $state("");
    let code = $state("");
    let description = $state("");
    let initialBalance = $state("0");

    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function reset() {
        cbName = code = description = "";
        initialBalance = "0";
        inputErrors = {};
        serverError = null;
        successMsg = null;
    }

    // Auto-generate code from name
    $effect(() => {
        if (cbName && !code) {
            code = cbName
                .toUpperCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z0-9]/g, "_")
                .slice(0, 10);
        }
    });

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        const fd = new FormData();
        fd.set("name", cbName);
        fd.set("code", code);
        if (description) fd.set("description", description);
        fd.set("balance", initialBalance || "0");

        isSubmitting = true;
        try {
            const result = await actions.finance.createCashbox(fd);

            if (isInputError(result?.error)) {
                inputErrors = result.error.fields as any;
                return;
            }
            if (result?.error) {
                serverError = result.error.message ?? "Error al crear la caja.";
                return;
            }
            if (result?.data?.success) {
                successMsg =
                    result.data.message ?? "Caja creada correctamente.";
                setTimeout(() => {
                    isOpen = false;
                    reset();
                    window.location.reload();
                }, 1200);
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Dialog
    bind:isOpen
    size="md"
    title="Nueva Caja"
    preventCloseOnInteractOutside={true}
    preventCloseOnEscapeKeyDown={true}
    description="Crea una cuenta o caja para gestionar fondos"
    onClose={reset}
>
    {#snippet trigger({ open })}
        <button
            onclick={open}
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
            <Wallet class="h-4 w-4 text-slate-500" />
            Nueva Caja
        </button>
    {/snippet}

    {#if successMsg}
        <div class="flex flex-col items-center gap-3 py-8 text-center">
            <CircleCheck class="h-12 w-12 text-emerald-500" />
            <p class="font-semibold text-slate-900">{successMsg}</p>
            <p class="text-sm text-slate-500">Cerrando...</p>
        </div>
    {:else}
        {#if serverError}
            <div
                class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
            >
                <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p class="text-sm text-red-700 flex-1">{serverError}</p>
                <button
                    onclick={() => (serverError = null)}
                    class="text-red-400 hover:text-red-600"
                >
                    <X class="h-4 w-4" />
                </button>
            </div>
        {/if}

        <form onsubmit={handleSubmit} class="space-y-4">
            <!-- Nombre -->
            <div>
                <label
                    for="cbName"
                    class="block text-sm font-medium text-slate-700 mb-1"
                >
                    Nombre de la Caja <span class="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    bind:value={cbName}
                    required
                    placeholder="Ej: Caja Principal, Fondo Sector Norte"
                    class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            {fieldError('name') ? 'border-red-400' : 'border-slate-200'}"
                />
                {#if fieldError("name")}
                    <p class="mt-1 text-xs text-red-600">
                        {fieldError("name")}
                    </p>
                {/if}
            </div>

            <!-- Código -->
            <div class="flex justify-between gap-4">
                <div>
                    <label
                        for="code"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Código <span class="text-red-500">*</span>
                        <span class="text-slate-400 font-normal text-xs ml-1"
                            >(único, sin espacios)</span
                        >
                    </label>
                    <input
                        type="text"
                        bind:value={code}
                        required
                        maxlength="50"
                        placeholder="CAJA_PRINCIPAL"
                        class="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500
                {fieldError('code') ? 'border-red-400' : 'border-slate-200'}"
                    />
                    {#if fieldError("code")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("code")}
                        </p>
                    {/if}
                </div>

                <!-- Saldo inicial -->
                <div>
                    <label
                        for="initialBalance"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Saldo Inicial (Bs)
                    </label>
                    <div class="relative">
                        <span
                            class="absolute left-3 top-2.5 text-slate-500 text-sm pointer-events-none"
                            >Bs</span
                        >
                        <input
                            type="number"
                            bind:value={initialBalance}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            class="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <p class="mt-1 text-xs text-slate-400">
                        Dejar en 0 si la caja comienza vacía.
                    </p>
                </div>

            </div>


            <!-- Descripción -->
            <div>
                <label
                    for="description"
                    class="block text-sm font-medium text-slate-700 mb-1"
                    >Descripción</label
                >
                <input
                    type="text"
                    bind:value={description}
                    placeholder="Uso o propósito de esta caja..."
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <!-- Footer -->
            <div
                class="flex items-center justify-between border-t border-slate-100 pt-4"
            >
                <button
                    type="button"
                    onclick={reset}
                    class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    Limpiar
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || !cbName || !code}
                    class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {#if isSubmitting}
                        <div
                            class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                        ></div>
                        Creando...
                    {:else}
                        <Wallet class="h-4 w-4" />
                        Crear Caja
                    {/if}
                </button>
            </div>
        </form>
    {/if}
</Dialog>
