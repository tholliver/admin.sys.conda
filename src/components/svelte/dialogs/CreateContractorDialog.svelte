<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { actions, isInputError } from "astro:actions";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import { z } from "zod";
    import { UserPlus, CircleAlert, CircleCheck, X } from "@lucide/svelte";

    const schema = z.object({
        fullName: z.string().trim().min(2, "Nombre requerido").max(200),
        specialty: z.string().trim().max(120).optional().or(z.literal("")),
        phone: z.string().trim().max(20).optional().or(z.literal("")),
        email: z
            .string()
            .trim()
            .max(150)
            .email("Email invalido")
            .optional()
            .or(z.literal("")),
        ci: z.string().trim().max(20).optional().or(z.literal("")),
        ruc: z.string().trim().max(20).optional().or(z.literal("")),
        address: z.string().trim().max(255).optional().or(z.literal("")),
        notes: z.string().trim().max(1000).optional().or(z.literal("")),
    });

    const initialValues = {
        fullName: "",
        specialty: "",
        phone: "",
        email: "",
        ci: "",
        ruc: "",
        address: "",
        notes: "",
    };

    const form = new ZodForm({
        schema,
        initialValues,
        validateMode: "onBlur",
    });

    let isOpen = $state(false);
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    function fieldError(key: keyof typeof initialValues) {
        return form.errors[key];
    }

    function resetState() {
        serverError = null;
        successMsg = null;
        form.reset(initialValues);
    }

    function toFormData(values: typeof initialValues) {
        const fd = new FormData();
        fd.set("fullName", values.fullName.trim());
        if (values.specialty.trim())
            fd.set("specialty", values.specialty.trim());
        if (values.phone.trim()) fd.set("phone", values.phone.trim());
        if (values.email.trim()) fd.set("email", values.email.trim());
        if (values.ci.trim()) fd.set("ci", values.ci.trim());
        if (values.ruc.trim()) fd.set("ruc", values.ruc.trim());
        if (values.address.trim()) fd.set("address", values.address.trim());
        if (values.notes.trim()) fd.set("notes", values.notes.trim());
        return fd;
    }

    const onSubmit = form.handleSubmit(async (values) => {
        serverError = null;
        form.setErrors({});

        try {
            const result = await actions.finance.createContractor(
                toFormData(values),
            );

            if (isInputError(result?.error)) {
                const mapped: Record<string, string> = {};
                for (const [key, value] of Object.entries(
                    result.error.fields,
                )) {
                    mapped[key] = Array.isArray(value)
                        ? value[0]
                        : String(value);
                }
                form.setErrors(mapped as any);
                return;
            }

            if (result?.error) {
                serverError =
                    result.error.message ?? "Error al registrar contratista.";
                return;
            }

            if (result?.data?.success) {
                successMsg = result.data.message ?? "Contratista registrado.";
                setTimeout(() => {
                    isOpen = false;
                    resetState();
                    window.location.reload();
                }, 900);
            }
        } catch (error: any) {
            serverError = error?.message ?? "Error inesperado.";
        }
    });
</script>

<Dialog
    bind:isOpen
    size="lg"
    title="Registrar Contratista"
    description="Complete los datos del nuevo contratista"
    preventCloseOnInteractOutside={true}
    preventCloseOnEscapeKeyDown={true}
    onClose={resetState}
>
    {#snippet trigger({ open })}
        <button
            onclick={() => {
                resetState();
                open();
            }}
            class="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
            <UserPlus class="h-4 w-4" />
            Nuevo
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
                        type="button"
                        onclick={() => (serverError = null)}
                        class="text-red-400 hover:text-red-600"
                    >
                        <X class="h-4 w-4" />
                    </button>
                </div>
            {/if}

            <form
                id="create-contractor-form"
                class="space-y-4 p-4"
                onsubmit={onSubmit}
            >
                <div>
                    <label
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Nombre completo <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={form.values.fullName}
                        required
                        oninput={(e) =>
                            form.setValue("fullName", e.currentTarget.value, {
                                validate: false,
                            })}
                        onblur={() => form.onBlur("fullName")}
                        placeholder="Juan Perez Lopez"
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                        {fieldError('fullName')
                            ? 'border-red-400'
                            : 'border-slate-200'}"
                    />
                    {#if fieldError("fullName")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("fullName")}
                        </p>
                    {/if}
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Especialidad
                        </label>
                        <input
                            type="text"
                            value={form.values.specialty}
                            oninput={(e) =>
                                form.setValue(
                                    "specialty",
                                    e.currentTarget.value,
                                    {
                                        validate: false,
                                    },
                                )}
                            onblur={() => form.onBlur("specialty")}
                            placeholder="Ej: Electricidad"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {fieldError('specialty')
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if fieldError("specialty")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("specialty")}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Telefono
                        </label>
                        <input
                            type="text"
                            value={form.values.phone}
                            oninput={(e) =>
                                form.setValue("phone", e.currentTarget.value, {
                                    validate: false,
                                })}
                            onblur={() => form.onBlur("phone")}
                            placeholder="+591 70000000"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {fieldError('phone')
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if fieldError("phone")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("phone")}
                            </p>
                        {/if}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            value={form.values.email}
                            oninput={(e) =>
                                form.setValue("email", e.currentTarget.value, {
                                    validate: false,
                                })}
                            onblur={() => form.onBlur("email")}
                            placeholder="contratista@correo.com"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {fieldError('email')
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if fieldError("email")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("email")}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            CI
                        </label>
                        <input
                            type="text"
                            value={form.values.ci}
                            oninput={(e) =>
                                form.setValue("ci", e.currentTarget.value, {
                                    validate: false,
                                })}
                            onblur={() => form.onBlur("ci")}
                            placeholder="12345678"
                            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {fieldError('ci')
                                ? 'border-red-400'
                                : 'border-slate-200'}"
                        />
                        {#if fieldError("ci")}
                            <p class="mt-1 text-xs text-red-600">
                                {fieldError("ci")}
                            </p>
                        {/if}
                    </div>
                </div>

                <div>
                    <label
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        RUC / NIT
                    </label>
                    <input
                        type="text"
                        value={form.values.ruc}
                        oninput={(e) =>
                            form.setValue("ruc", e.currentTarget.value, {
                                validate: false,
                            })}
                        onblur={() => form.onBlur("ruc")}
                        placeholder="Opcional"
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                        {fieldError('ruc')
                            ? 'border-red-400'
                            : 'border-slate-200'}"
                    />
                    {#if fieldError("ruc")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("ruc")}
                        </p>
                    {/if}
                </div>

                <div>
                    <label
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Direccion
                    </label>
                    <input
                        type="text"
                        value={form.values.address}
                        oninput={(e) =>
                            form.setValue("address", e.currentTarget.value, {
                                validate: false,
                            })}
                        onblur={() => form.onBlur("address")}
                        placeholder="Av. Principal #123"
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                        {fieldError('address')
                            ? 'border-red-400'
                            : 'border-slate-200'}"
                    />
                    {#if fieldError("address")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("address")}
                        </p>
                    {/if}
                </div>

                <div>
                    <label
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        Notas
                    </label>
                    <textarea
                        rows="3"
                        value={form.values.notes}
                        oninput={(e) =>
                            form.setValue("notes", e.currentTarget.value, {
                                validate: false,
                            })}
                        onblur={() => form.onBlur("notes")}
                        placeholder="Observaciones opcionales..."
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none
                        {fieldError('notes')
                            ? 'border-red-400'
                            : 'border-slate-200'}"
                    ></textarea>
                    {#if fieldError("notes")}
                        <p class="mt-1 text-xs text-red-600">
                            {fieldError("notes")}
                        </p>
                    {/if}
                </div>
            </form>
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
                form="create-contractor-form"
                disabled={form.isSubmitting}
                class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {#if form.isSubmitting}
                    <div
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Registrando...
                {:else}
                    <UserPlus class="h-4 w-4" />
                    Registrar contratista
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
