<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { Building, CircleAlert, CircleCheck, X } from "@lucide/svelte";

    const BO_CITIES = [
        { value: "CB", label: "Cochabamba" },
        { value: "LP", label: "La Paz" },
        { value: "SC", label: "Santa Cruz" },
        { value: "OR", label: "Oruro" },
        { value: "PT", label: "Potosí" },
        { value: "SU", label: "Sucre" },
        { value: "TJ", label: "Tarija" },
        { value: "BE", label: "Beni" },
        { value: "PA", label: "Pando" },
    ];

    let isOpen = $state(false);
    let isSubmitting = $state(false);
    let inputErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    // Form fields
    let fullName = $state("");
    let ci = $state("");
    let ciCity = $state("CB");
    let phone = $state("");
    let email = $state("");
    let roomNumber = $state("");
    let floor = $state("");
    let description = $state("");
    let monthlyRent = $state("");
    let startDate = $state("");
    let endDate = $state("");
    let notes = $state("");

    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function reset() {
        fullName =
            ci =
            ciCity =
            phone =
            email =
            roomNumber =
            floor =
            description =
            monthlyRent =
            startDate =
            endDate =
            notes =
                "";
        ciCity = "CB";
        inputErrors = {};
        serverError = null;
        successMsg = null;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        const fd = new FormData();
        fd.set("fullName", fullName);
        if (ci) fd.set("ci", ci);
        if (phone) fd.set("phone", phone);
        if (email) fd.set("email", email);
        fd.set("roomNumber", roomNumber);
        if (floor) fd.set("floor", floor);
        if (description) fd.set("description", description);
        fd.set("monthlyRent", monthlyRent);
        fd.set("startDate", startDate);
        if (endDate) fd.set("endDate", endDate);
        if (notes) fd.set("notes", notes);

        isSubmitting = true;
        try {
            const result = await actions.inquilinos.createTenant(fd);

            if (isInputError(result?.error)) {
                inputErrors = result.error.fields as any;
                return;
            }
            if (result?.error) {
                serverError =
                    result.error.message ?? "Error al registrar inquilino.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Inquilino registrado.";
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
    size="lg"
    title="Registrar Inquilino"
    preventCloseOnInteractOutside={true}
    preventCloseOnEscapeKeyDown={true}
    description="Complete los datos del nuevo cliente"
    onClose={reset}
>
    {#snippet trigger({ open })}
        <button
            onclick={open}
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
        >
            <Building class="h-4 w-4" />
            Nuevo Inquilino
        </button>
    {/snippet}

    {#snippet children()}
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

            <form
                id="create-tenant-form"
                onsubmit={handleSubmit}
                class="space-y-4 p-4"
            >
                <!-- Nombre completo -->
                <div>
                    <label
                        for="fullName"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Nombre Completo <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        bind:value={fullName}
                        required
                        placeholder="Juan Pérez López"
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                        {fieldError('fullName')
                            ? 'border-red-400'
                            : 'border-slate-200'}"
                    />
                    {#if fieldError("fullName")}
                        <p
                            class="mt-1 text-xs text-red-600 flex items-center gap-1"
                        >
                            <CircleAlert class="h-3 w-3" />{fieldError(
                                "fullName",
                            )}
                        </p>
                    {/if}
                </div>

                <!-- CI + Ciudad -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            for="ci"
                            class="block text-sm font-medium text-slate-700 mb-1"
                            >CI</label
                        >
                        <input
                            type="text"
                            bind:value={ci}
                            placeholder="12345678"
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label
                            for="ciCity"
                            class="block text-sm font-medium text-slate-700 mb-1"
                            >Ciudad CI</label
                        >
                        <select
                            bind:value={ciCity}
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {#each BO_CITIES as city}
                                <option value={city.value}
                                    >{city.value} — {city.label}</option
                                >
                            {/each}
                        </select>
                    </div>
                </div>

                <!-- Teléfono + Email -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            for="phone"
                            class="block text-sm font-medium text-slate-700 mb-1"
                            >Teléfono</label
                        >
                        <input
                            type="tel"
                            bind:value={phone}
                            placeholder="+591 70000000"
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label
                            for="email"
                            class="block text-sm font-medium text-slate-700 mb-1"
                            >Correo</label
                        >
                        <input
                            type="email"
                            bind:value={email}
                            placeholder="cliente@correo.com"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                  {fieldError('email') ? 'border-red-400' : 'border-slate-200'}"
                        />
                        {#if fieldError("email")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("email")}
                            </p>
                        {/if}
                    </div>
                </div>

                <!-- Ambiente + Piso -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            for="roomNumber"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            N° Ambiente <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            bind:value={roomNumber}
                            required
                            placeholder="101"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                  {fieldError('roomNumber')
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if fieldError("roomNumber")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("roomNumber")}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
                            for="floor"
                            class="block text-sm font-medium text-slate-700 mb-1"
                            >Piso</label
                        >
                        <input
                            type="text"
                            bind:value={floor}
                            placeholder="1"
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <!-- Descripción -->
                <div>
                    <label
                        for="description"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Tipo de Ambiente
                    </label>
                    <input
                        type="text"
                        bind:value={description}
                        placeholder="Ej: Oficina, Depósito, Local comercial..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <!-- Alquiler + Fechas -->
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label
                            for="monthlyRent"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Alquiler/Mes (Bs) <span class="text-red-500">*</span
                            >
                        </label>
                        <div class="relative">
                            <span
                                class="absolute left-3 top-2.5 text-slate-500 text-sm pointer-events-none"
                                >Bs</span
                            >
                            <input
                                type="number"
                                bind:value={monthlyRent}
                                required
                                min="0"
                                step="0.01"
                                placeholder="500.00"
                                class="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                    {fieldError('monthlyRent')
                                    ? 'border-red-400'
                                    : 'border-slate-200'}"
                            />
                        </div>
                        {#if fieldError("monthlyRent")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("monthlyRent")}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
                            for="startDate"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Inicio Contrato <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            bind:value={startDate}
                            required
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                  {fieldError('startDate')
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if fieldError("startDate")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("startDate")}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
                            for="endDate"
                            class="block text-sm font-medium text-slate-700 mb-1"
                            >Fin Contrato</label
                        >
                        <input
                            type="date"
                            bind:value={endDate}
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <!-- Notas -->
                <div>
                    <label
                        for="notes"
                        class="block text-sm font-medium text-slate-700 mb-1"
                        >Notas</label
                    >
                    <textarea
                        bind:value={notes}
                        rows="2"
                        placeholder="Observaciones opcionales..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                </div>
            </form>
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        {#if !successMsg}
            <button
                type="button"
                onclick={reset}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:mr-auto"
            >
                Limpiar
            </button>
            <button
                type="submit"
                form="create-tenant-form"
                disabled={isSubmitting ||
                    !fullName ||
                    !roomNumber ||
                    !monthlyRent ||
                    !startDate}
                class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Registrando...
                {:else}
                    <Building class="h-4 w-4" />
                    Registrar Inquilino
                {/if}
            </button>
        {:else}
            <button
                type="button"
                onclick={close}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:ml-auto"
            >
                Cerrar
            </button>
        {/if}
    {/snippet}
</Dialog>
