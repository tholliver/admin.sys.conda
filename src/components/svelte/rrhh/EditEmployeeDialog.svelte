<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { CircleAlert, CircleCheck, X } from "@lucide/svelte";
    import EmployeeForm from "@/components/svelte/rrhh/EmployeeForm.svelte";
    import type { SelectCashbox } from "@/db/schema";
    import type { EmployeeFormData } from "./employeeFormTypes";

    interface Props {
        cashboxes: Pick<SelectCashbox, "id" | "name">[];
        directorioCount: number;
        plantaCount: number;
        maxDirectorio: number;
        maxPlanta: number;
        employee: EmployeeFormData;
        triggerLabel?: string;
        triggerClass?: string;
    }

    let {
        cashboxes,
        directorioCount,
        plantaCount,
        maxDirectorio,
        maxPlanta,
        employee,
        triggerLabel = "Editar",
        triggerClass = "rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors",
    }: Props = $props();

    let isOpen = $state(false);
    let isSubmitting = $state(false);
    let fieldErrors = $state<Record<string, string | string[]>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);
    let formKey = $state(0);

    let formId = $derived(`edit-employee-form-${employee.id}`);

    function resetState() {
        fieldErrors = {};
        serverError = null;
        successMsg = null;
    }

    async function handleSubmit(data: EmployeeFormData) {
        fieldErrors = {};
        serverError = null;

        const fd = new FormData();
        fd.set("id", String(employee.id));
        fd.set("employeeType", data.employeeType);
        fd.set("ci", data.ci);
        fd.set("ciCity", data.ciCity ?? "CB");
        fd.set("fullName", data.fullName.trim());
        if (data.phone) fd.set("phone", data.phone);
        if (data.address) fd.set("address", data.address);
        fd.set("chargeTitle", data.chargeTitle);
        if (data.cashboxId) fd.set("cashboxId", data.cashboxId);
        fd.set("hireDate", data.hireDate ?? "");
        fd.set("baseSalary", String(data.baseSalary));
        if (data.notes) fd.set("notes", data.notes);

        isSubmitting = true;
        try {
            const result = await actions.rrhh.updateEmployee(fd);

            if (isInputError(result?.error)) {
                fieldErrors = result.error.fields as any;
                return;
            }
            if (result?.error) {
                serverError =
                    result.error.message ??
                    "Error al actualizar al miembro del personal.";
                return;
            }
            if (result?.data?.success) {
                successMsg =
                    result.data.message ?? "Miembro del personal actualizado.";
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
    title="Editar miembro del personal"
    description="Actualice los datos del miembro del personal"
    onClose={resetState}
>
    {#snippet trigger({ open })}
        <button
            onclick={() => {
                resetState();
                formKey += 1;
                open();
            }}
            class={triggerClass}
        >
            {triggerLabel}
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
                    cashboxes={cashboxes}
                    {directorioCount}
                    {plantaCount}
                    {maxDirectorio}
                    {maxPlanta}
                    initial={employee}
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
                class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {#if isSubmitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Guardando...
                {:else}
                    Guardar cambios
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
