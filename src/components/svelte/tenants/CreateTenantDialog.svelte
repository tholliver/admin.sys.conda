<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import { Building, CircleAlert, CircleCheck, X } from "@lucide/svelte";
    import TenantFormFields from "./TenantFormFields.svelte";
    import {
        tenantSchema,
        tenantInitialValues,
        toTenantFormData,
    } from "@/lib/tenant/validation.schema";

    const FORM_ID = "create-tenant-form";

    const form = new ZodForm({
        schema: tenantSchema,
        initialValues: tenantInitialValues,
        validateMode: "onBlur",
    });

    let isOpen = $state(false);
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    function resetState() {
        serverError = null;
        successMsg = null;
        form.reset();
    }

    const onSubmit = form.handleSubmit(async (values) => {
        serverError = null;
        form.setErrors({});

        try {
            const result = await actions.inquilinos.createTenant(
                toTenantFormData(values),
            );

            if (isInputError(result?.error)) {
                const mapped: Record<string, string> = {};
                for (const [k, v] of Object.entries(result.error.fields)) {
                    mapped[k] = Array.isArray(v) ? v[0] : String(v);
                }
                form.setErrors(mapped as any);
                return;
            }

            if (result?.error) {
                serverError = result.error.message ?? "Error al registrar inquilino.";
                return;
            }

            if (result?.data?.success) {
                successMsg = result.data.message ?? "Inquilino registrado.";
                setTimeout(() => {
                    isOpen = false;
                    resetState();
                    window.location.reload();
                }, 1200);
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        }
    });
</script>

<Dialog
    bind:isOpen
    size="lg"
    title="Registrar Inquilino"
    description="Complete los datos del nuevo inquilino"
    preventCloseOnInteractOutside={true}
    preventCloseOnEscapeKeyDown={true}
    onClose={resetState}
>
    {#snippet trigger({ open })}
        <button
            onclick={() => { resetState(); open(); }}
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
                <div class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-700 flex-1">{serverError}</p>
                    <button type="button" onclick={() => (serverError = null)} class="text-red-400 hover:text-red-600">
                        <X class="h-4 w-4" />
                    </button>
                </div>
            {/if}
            <TenantFormFields {form} formId={FORM_ID} onsubmit={onSubmit} />
        {/if}
    {/snippet}

    {#snippet footer({ close })}
        {#if !successMsg}
            <button
                type="button"
                onclick={() => { resetState(); close(); }}
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:mr-auto"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form={FORM_ID}
                disabled={form.isSubmitting}
                class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {#if form.isSubmitting}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
