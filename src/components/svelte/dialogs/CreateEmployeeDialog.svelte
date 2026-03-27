<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { UserPlus, CircleAlert, CircleCheck, X } from "@lucide/svelte";
    import type { SelectSector } from "@/db/schema";

    interface Props {
        sectors: Pick<SelectSector, "id" | "name">[];
        directorioCount: number;
        plantaCount: number;
        maxDirectorio: number;
        maxPlanta: number;
    }

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

    let {
        sectors,
        directorioCount,
        plantaCount,
        maxDirectorio,
        maxPlanta,
    }: Props = $props();

    let isOpen = $state(false);
    let isSubmitting = $state(false);
    let inputErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    // Form state
    let employeeType = $state<"directorio" | "planta">("planta");
    let fullName = $state("");
    let ci = $state("");
    let ciCity = $state("CB");
    let phone = $state("");
    let address = $state("");
    let chargeTitle = $state("");
    let sectorId = $state("");
    let hireDate = $state("");
    let baseSalary = $state("");
    let notes = $state("");

    // Derived name split: expects "Nombre Apellido1 Apellido2"
    let nameParts = $derived(() => {
        const parts = fullName.trim().split(/\s+/);
        return {
            name: parts[0] ?? "",
            pLastName: parts[1] ?? "",
            mLastName: parts[2] ?? "",
        };
    });

    function fieldError(key: string) {
        const e = inputErrors[key];
        return Array.isArray(e) ? e[0] : e;
    }

    function reset() {
        fullName = "";
        ci = "";
        ciCity = "CB";
        phone = "";
        address = "";
        chargeTitle = "";
        sectorId = "";
        hireDate = "";
        baseSalary = "";
        notes = "";
        employeeType = "planta";
        inputErrors = {};
        serverError = null;
        successMsg = null;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;

        if (fullName.trim().split(/\s+/).length < 2) {
            inputErrors = { fullName: "Ingrese al menos nombre y apellido" };
            return;
        }

        const fd = new FormData();
        fd.set("employeeType", employeeType);
        fd.set("ci", ci);
        fd.set("ciCity", ciCity);
        fd.set("fullName", fullName.trim());
        if (phone) fd.set("phone", phone);
        if (address) fd.set("address", address);
        fd.set("chargeTitle", chargeTitle);
        fd.set("sectorId", sectorId);
        fd.set("hireDate", hireDate);
        fd.set("baseSalary", baseSalary);
        if (notes) fd.set("notes", notes);

        isSubmitting = true;
        try {
            const result = await actions.rrhh.createEmployee(fd);

            if (isInputError(result?.error)) {
                inputErrors = result.error.fields as any;
                return;
            }
            if (result?.error) {
                serverError =
                    result.error.message ?? "Error al registrar empleado.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Empleado registrado.";
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
    preventCloseOnInteractOutside={true}
    preventCloseOnEscapeKeyDown={true}
    title="Registrar Empleado"
    description="Complete los datos del nuevo empleado"
    onClose={reset}
>
    {#snippet trigger({ open })}
        <button
            onclick={open}
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
        >
            <UserPlus class="h-4 w-4" />
            Registrar Empleado
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
                id="create-employee-form"
                onsubmit={handleSubmit}
                class="space-y-2 px-4"
            >
                <!-- Tipo -->
                <div>
                    <label
                        class="block text-sm font-semibold text-slate-700 mb-2"
                    >
                        Tipo de Empleado <span class="text-red-500">*</span>
                    </label>
                    <div class="grid grid-cols-2 gap-3">
                        <label
                            class="relative flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors
                            {employeeType === 'directorio'
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-200 hover:border-blue-300'}"
                        >
                            <input
                                type="radio"
                                bind:group={employeeType}
                                value="directorio"
                                class="sr-only"
                            />
                            <div class="flex-1">
                                <p class="font-semibold text-slate-800 text-sm">
                                    Directorio
                                </p>
                                <p class="text-xs text-slate-500">
                                    {directorioCount}/{maxDirectorio} activos
                                </p>
                            </div>
                            {#if directorioCount >= maxDirectorio}
                                <span class="text-[10px] font-bold text-red-500"
                                    >LLENO</span
                                >
                            {/if}
                        </label>
                        <label
                            class="relative flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors
            {employeeType === 'planta'
                                ? 'border-violet-500 bg-violet-50'
                                : 'border-slate-200 hover:border-violet-300'}"
                        >
                            <input
                                type="radio"
                                bind:group={employeeType}
                                value="planta"
                                class="sr-only"
                            />
                            <div class="flex-1">
                                <p class="font-semibold text-slate-800 text-sm">
                                    Planta
                                </p>
                                <p class="text-xs text-slate-500">
                                    {plantaCount}/{maxPlanta} activos
                                </p>
                            </div>
                            {#if plantaCount >= maxPlanta}
                                <span class="text-[10px] font-bold text-red-500"
                                    >LLENO</span
                                >
                            {/if}
                        </label>
                    </div>
                </div>

                <!-- Nombre completo -->
                <div>
                    <label
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Nombre Completo <span class="text-red-500">*</span>
                        <span class="text-slate-400 font-normal text-xs ml-1"
                            >(Nombre Apellido1 Apellido2)</span
                        >
                    </label>
                    <input
                        type="text"
                        bind:value={fullName}
                        placeholder="Juan Pérez López"
                        required
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            {fieldError('fullName') ||
                        fieldError('name') ||
                        fieldError('pLastName')
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
                    {:else if fieldError("name") || fieldError("pLastName")}
                        <p
                            class="mt-1 text-xs text-red-600 flex items-center gap-1"
                        >
                            <CircleAlert class="h-3 w-3" />{fieldError(
                                "name",
                            ) ?? fieldError("pLastName")}
                        </p>
                    {:else if fullName.trim().split(/\s+/).length >= 2}
                        <p
                            class="mt-1 text-xs text-emerald-600 flex items-center gap-1"
                        >
                            <CircleCheck class="h-3 w-3" />
                            {fullName
                                .trim()
                                .split(/\s+/)
                                .slice(0, 3)
                                .join(" · ")}
                        </p>
                    {/if}
                </div>

                <!-- CI + Ciudad -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            CI <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            bind:value={ci}
                            required
                            placeholder="12345678"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
              {fieldError('ci') ? 'border-red-400' : 'border-slate-200'}"
                        />
                        {#if fieldError("ci")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("ci")}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
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

                <div class="grid grid-cols-2 gap-4">
                    <!-- Cargo -->
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Cargo / Función <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            bind:value={chargeTitle}
                            required
                            placeholder="Ej: Secretario General, Tesorero, Auxiliar Administrativo"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            {fieldError('chargeTitle') ? 'border-red-400' : 'border-slate-200'}"
                        />
                        {#if fieldError("chargeTitle")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("chargeTitle")}
                            </p>
                        {/if}
                    </div>

                    <!-- Sector -->
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Sector <span class="text-red-500">*</span>
                        </label>
                        <select
                            bind:value={sectorId}
                            required
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            {fieldError('sectorId') ? 'border-red-400' : 'border-slate-200'}"
                        >
                            <option value="">— Seleccionar sector —</option>
                            {#each sectors as s}
                                <option value={s.id}>{s.name}</option>
                            {/each}
                        </select>
                        {#if fieldError("sectorId")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("sectorId")}
                            </p>
                        {/if}
                    </div>
                </div>
                <!-- Teléfono + Dirección -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
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
                            class="block text-sm font-medium text-slate-700 mb-1"
                            >Dirección</label
                        >
                        <input
                            type="text"
                            bind:value={address}
                            placeholder="Av. Principal #123"
                            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <!-- Fecha ingreso + Salario -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Fecha de Ingreso <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            bind:value={hireDate}
                            required
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
              {fieldError('hireDate') ? 'border-red-400' : 'border-slate-200'}"
                        />
                        {#if fieldError("hireDate")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("hireDate")}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Salario Base (Bs) <span class="text-red-500">*</span
                            >
                        </label>
                        <div class="relative">
                            <span
                                class="absolute left-3 top-2.5 text-slate-500 text-sm pointer-events-none"
                                >Bs</span
                            >
                            <input
                                type="number"
                                bind:value={baseSalary}
                                required
                                min="0"
                                step="0.01"
                                placeholder="2500.00"
                                class="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                {fieldError('baseSalary')
                                    ? 'border-red-400'
                                    : 'border-slate-200'}"
                            />
                        </div>
                        {#if fieldError("baseSalary")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("baseSalary")}
                            </p>
                        {/if}
                    </div>
                </div>

                <!-- Notas -->
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1"
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
                form="create-employee-form"
                disabled={isSubmitting ||
                    !fullName ||
                    !ci ||
                    !chargeTitle ||
                    !sectorId ||
                    !hireDate ||
                    !baseSalary}
                class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Registrando...
                {:else}
                    <UserPlus class="h-4 w-4" />
                    Registrar Empleado
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
