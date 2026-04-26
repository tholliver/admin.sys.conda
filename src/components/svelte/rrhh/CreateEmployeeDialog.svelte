<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { UserPlus, CircleAlert, CircleCheck, X } from "@lucide/svelte";
    import EmployeeForm from "@/components/svelte/rrhh/EmployeeForm.svelte";
    import type { SelectSector } from "@/db/schema";
    import type { EmployeeFormData } from "@/components/svelte/rrhh/employeeFormTypes";

    interface Props {
        sectors: Pick<SelectSector, "id" | "name">[];
        directorioCount: number;
        plantaCount: number;
        maxDirectorio: number;
        maxPlanta: number;
    }

    let {
        sectors,
        directorioCount,
        plantaCount,
        maxDirectorio,
        maxPlanta,
    }: Props = $props();

    let isOpen = $state(false);
    let isSubmitting = $state(false);
    let fieldErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);
    let formKey = $state(0);

    const formId = "create-employee-form";

    function resetState() {
        fieldErrors = {};
        serverError = null;
        successMsg = null;
    }

    async function handleSubmit(data: EmployeeFormData) {
        fieldErrors = {};
        serverError = null;

        const fd = new FormData();
        fd.set("employeeType", data.employeeType);
        fd.set("ci", data.ci);
        fd.set("ciCity", data.ciCity ?? "CB");
        fd.set("fullName", data.fullName.trim());
        if (data.phone) fd.set("phone", data.phone);
        if (data.address) fd.set("address", data.address);
        fd.set("chargeTitle", data.chargeTitle);
        const sectorId = Number(data.sectorId);
        if (Number.isFinite(sectorId) && sectorId > 0) fd.set("sectorId", String(sectorId));
        fd.set("hireDate", data.hireDate ?? "");
        fd.set("baseSalary", String(data.baseSalary));
        if (data.notes) fd.set("notes", data.notes);

        isSubmitting = true;
        try {
            const result = await actions.rrhh.createEmployee(fd);

            if (isInputError(result?.error)) {
                fieldErrors = result.error.fields as any;
                return;
            }
            if (result?.error) {
                serverError =
                    result.error.message ??
                    "Error al registrar al miembro del personal.";
                return;
            }
            if (result?.data?.success) {
                successMsg =
                    result.data.message ?? "Miembro del personal registrado.";
                setTimeout(() => {
                    isOpen = false;
                    resetState();
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
    title="Registrar miembro del personal"
    description="Complete los datos del nuevo miembro del personal"
    onClose={resetState}
>
    {#snippet trigger({ open })}
        <button
            onclick={() => {
                resetState();
                formKey += 1;
                open();
            }}
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
        >
            <UserPlus class="h-4 w-4" />
            Agregar personal
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

            {#key formKey}
                <EmployeeForm
                    {formId}
                    {sectors}
                    {directorioCount}
                    {plantaCount}
                    {maxDirectorio}
                    {maxPlanta}
                    {fieldErrors}
                    onSubmit={handleSubmit}
                />
            {/key}
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        {#if !successMsg}
            <button
                type="button"
                onclick={() => {
                    resetState();
                    close();
                }}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:mr-auto"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form={formId}
                disabled={isSubmitting}
                class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Registrando...
                {:else}
                    <UserPlus class="h-4 w-4" />
                    Registrar miembro del personal
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
