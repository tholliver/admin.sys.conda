<script lang="ts">
    import { actions, isInputError, isActionError } from "astro:actions";
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import { CircleAlert, CircleCheck, Plus, X } from "@lucide/svelte";
    import TransactionCategoryFormFields from "./TransactionCategoryFormFields.svelte";
    import {
        transactionCategorySchema,
        buildInitialValues,
        type TransactionCategoryValues,
    } from "./form.constants";
    import type { SelectTransactionCategories } from "@/db/schema";
    import type { RangeOption } from "./TransactionCategoryFormFields.svelte";

    interface Props {
        activeParents: SelectTransactionCategories[];
        availableRanges: RangeOption[];
        triggerClass?: string;
    }

    let {
        activeParents,
        availableRanges,
        triggerClass = "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm",
    }: Props = $props();

    const FORM_ID = "create-category-form";

    let isOpen        = $state(false);
    let serverError   = $state<string | null>(null);
    let successMsg    = $state<string | null>(null);
    let serverErrors  = $state<Record<string, string | string[]>>({});
    let formKey       = $state(0); // forces fields to remount on reset

    let form = $state(
        new ZodForm({
            schema: transactionCategorySchema,
            initialValues: buildInitialValues(),
            validateMode: "onBlur",
        }),
    );

    function resetState() {
        serverError  = null;
        successMsg   = null;
        serverErrors = {};
        form.reset(buildInitialValues());
        formKey += 1;
    }

    const handleSubmit = form.handleSubmit(async (values: TransactionCategoryValues) => {
        serverErrors = {};
        serverError  = null;
        successMsg   = null;

        const fd = new FormData();
        fd.append("name",                 values.name);
        fd.append("code",                 values.code);
        fd.append("description",          values.description);
        fd.append("type",                 values.type);
        fd.append("requiresAuthorization", values.requiresAuthorization ? "on" : "");
        if (values.icon.trim())     fd.append("icon",     values.icon.trim());
        if (values.parentId.trim()) fd.append("parentId", values.parentId.trim());

        try {
            const result = await actions.finance.createTransactionCategory(fd);

            if (isInputError(result?.error)) {
                serverErrors = result.error.fields ?? {};
                return;
            }
            if (isActionError(result?.error)) {
                serverError = result.error.message;
                return;
            }
            if (result?.data?.message) {
                successMsg = result.data.message;
                setTimeout(() => {
                    isOpen = false;
                    resetState();
                    window.location.reload();
                }, 1000);
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado";
        }
    });
</script>

<Dialog
    bind:isOpen
    size="lg"
    title="Crear cuenta"
    description="Define una nueva cuenta de ingresos o egresos."
    preventCloseOnEscapeKeyDown={true}
    preventCloseOnInteractOutside={true}
    onClose={resetState}
>
    {#snippet trigger({ open })}
        <button
            type="button"
            onclick={() => { resetState(); open(); }}
            class={triggerClass}
        >
            <Plus class="h-4 w-4" />
            Nueva cuenta
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

            {#key formKey}
                <TransactionCategoryFormFields
                    {form}
                    formId={FORM_ID}
                    {activeParents}
                    serverFieldErrors={serverErrors}
                    onSubmit={handleSubmit}
                    isEdit={false}
                />
            {/key}
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
                disabled={form.isSubmitting || !form.values.type || !form.values.name.trim()}
                class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
                {#if form.isSubmitting}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creando...
                {:else}
                    <Plus class="h-4 w-4" />
                    Crear cuenta
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
