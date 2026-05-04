<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import { apiEndpoints } from "@/utils";
    import { navigate } from "astro:transitions/client";
    import { FilePlus, Edit, Calendar } from "@lucide/svelte";
    import { toast } from "@/lib/toast";
    import { z } from "zod/v4"; // not 'zod'

    const schema = z
        .object({
            category: z
                .string()
                .min(1, "La cuenta es obligatoria")
                .max(50)
                .trim(),
            prefix: z.string().max(10).optional(),
            rangeStart: z.coerce.number().int().min(1, "Debe ser mayor a 0"),
            rangeEnd: z.coerce.number().int().min(1, "Debe ser mayor a 0"),
            authorizationNumber: z
                .string()
                .min(1, "El número de autorización es obligatorio")
                .max(50)
                .trim(),
            expirationDate: z
                .string()
                .min(1, "La fecha de expiración es obligatoria"),
        })
        .refine((d) => d.rangeEnd > d.rangeStart, {
            message: "El fin debe ser mayor al inicio",
            path: ["rangeEnd"],
        });

    const form = new ZodForm({
        schema,
        initialValues: {
            category: "",
            prefix: "",
            rangeStart: 1,
            rangeEnd: 99999,
            authorizationNumber: "",
            expirationDate: "",
        },
        validateMode: "onChange",
    });

    let isOpen = $state(false);
    let isSaving = $state(false);

    function parseError(payload: any): string {
        if (payload?.message) return payload.message;
        if (payload?.error) return payload.error;
        if (Array.isArray(payload?.details) && payload.details[0]?.message)
            return payload.details[0].message;
        return "Error desconocido";
    }

    const submit = form.handleSubmit(async (values) => {
        isSaving = true;
        try {
            const response = await fetch(
                apiEndpoints.invoiceRanges.createUpdate,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...values,
                        prefix: values.prefix?.trim() || null,
                    }),
                },
            );
            const result = await response.json();
            if (!response.ok) throw new Error(parseError(result));
            toast.success("Éxito", {
                description: "Rango de talonario creado",
            });
            isOpen = false;
            navigate("/talonarios");
        } catch (error: any) {
            toast.error("Error al crear el rango", {
                description: error?.message || "Error desconocido",
            });
        } finally {
            isSaving = false;
        }
    });
</script>

<button
    type="button"
    data-testid="invoice-range-create-open"
    class="ml-auto inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 text-sm font-medium"
    onclick={() => {
        form.reset({
            category: "",
            prefix: "",
            rangeStart: 1,
            rangeEnd: 99999,
            authorizationNumber: "",
            expirationDate: "",
        });
        isOpen = true;
    }}
>
    <FilePlus class="h-4 w-4" />
    Nuevo Talonario
</button>

<Dialog
    bind:isOpen
    onClose={() => (isOpen = false)}
    size="sm"
    preventCloseOnInteractOutside={true}
    preventCloseOnEscapeKeyDown={true}
    testId="invoice-range-create-dialog"
>
    {#snippet children()}
        <div class="space-y-4">
            <div>
                <h2 class="text-lg font-semibold">Crear Rango de talonario</h2>
                <p class="text-sm text-muted-foreground">
                    Define una cuenta con su rango de números de talonario.
                </p>
            </div>

            <form
                id="invoice-range-create-form"
                class="space-y-4"
                onsubmit={submit}
            >
                <!-- Prefix side by side -->
                <div class="grid grid-cols-2 gap-4">
                    <!-- Expiration date -->
                    <div>
                            <label
                                for="ir-create-expiry"
                                class="text-sm font-medium"
                            >
                                Fecha de Expiración
                            </label>

                        <div class="relative date-input-wrap">
                            <input
                                id="ir-create-expiry"
                                data-testid="ir-create-expiry-input"
                                type="date"
                                class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={form.values.expirationDate}
                                oninput={(e) =>
                                    form.setValue(
                                        "expirationDate",
                                        (e.currentTarget as HTMLInputElement).value,
                                    )}
                                onblur={() => form.onBlur("expirationDate")}
                            />
                            <Calendar
                                class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                            />
                        </div>
                        {#if form.errors.expirationDate}
                            <p class="mt-1 text-sm text-red-500">
                                {form.errors.expirationDate}
                            </p>
                        {/if}
                    </div>

                    <div>
                        <label
                            for="ir-create-prefix"
                            class="text-sm font-medium"
                        >
                            Prefijo
                            <span class="text-muted-foreground text-xs ml-1"
                                >(opcional)</span
                            >
                        </label>
                        <input
                            id="ir-create-prefix"
                            data-testid="ir-create-prefix-input"
                            type="text"
                            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            value={form.values.prefix}
                            oninput={(e) =>
                                form.setValue(
                                    "prefix",
                                    (e.currentTarget as HTMLInputElement).value,
                                )}
                            onblur={() => form.onBlur("prefix")}
                            placeholder="ej. FAC, SRV"
                            maxlength={10}
                        />
                    </div>
                </div>

                <!-- Category -->
                <div>
                    <label for="ir-create-category" class="text-sm font-medium"
                        >Categoría</label
                    >
                    <input
                        id="ir-create-category"
                        data-testid="ir-create-category-input"
                        type="text"
                        class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.values.category}
                        oninput={(e) =>
                            form.setValue(
                                "category",
                                (e.currentTarget as HTMLInputElement).value,
                            )}
                        onblur={() => form.onBlur("category")}
                        placeholder="ej. Cuotas de afiliación, Multas"
                    />
                    {#if form.errors.category}
                        <p class="mt-1 text-sm text-red-500">
                            {form.errors.category}
                        </p>
                    {/if}
                </div>

                <!-- Range start / end -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="ir-create-start" class="text-sm font-medium"
                            >Inicio</label
                        >
                        <input
                            id="ir-create-start"
                            data-testid="ir-create-start-input"
                            type="number"
                            step="1"
                            min="1"
                            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            value={form.values.rangeStart}
                            oninput={(e) => form.setValue("rangeStart", Number.parseInt((e.currentTarget as HTMLInputElement).value) || 0)}
                            onblur={() => form.onBlur("rangeStart")}
                        />
                        {#if form.errors.rangeStart}
                            <p class="mt-1 text-sm text-red-500">
                                {form.errors.rangeStart}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label for="ir-create-end" class="text-sm font-medium"
                            >Fin</label
                        >
                        <input
                            id="ir-create-end"
                            data-testid="ir-create-end-input"
                            type="number"
                            step="1"
                            min="1"
                            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            value={form.values.rangeEnd}
                            oninput={(e) =>
                                form.setValue(
                                    "rangeEnd",
                                    Number.parseInt(
                                        (e.currentTarget as HTMLInputElement)
                                            .value,
                                    ) || 0,
                                )}
                            onblur={() => form.onBlur("rangeEnd")}
                        />
                        {#if form.errors.rangeEnd}
                            <p class="mt-1 text-sm text-red-500">
                                {form.errors.rangeEnd}
                            </p>
                        {/if}
                    </div>
                </div>

                <!-- Authorization number -->
                <div>
                    <div class="flex items-center justify-between mb-1">
                    <label for="ir-create-auth" class="text-sm font-medium">
                        Nro. de Autorización
                    </label>
                    <button
                        type="button"
                        onclick={() =>
                            form.reset({
                                category: "",
                                prefix: "",
                                rangeStart: 1,
                                rangeEnd: 99999,
                                authorizationNumber: "",
                                expirationDate: "",
                            })}
                        class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 rounded border border-input px-2 py-0.5 hover:bg-accent transition-colors"
                        title="Limpiar formulario"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            ><path
                                d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                            /><path d="M3 3v5h5" /></svg
                        >
                        Limpiar
                    </button>

                    </div>
                    <input
                        id="ir-create-auth"
                        data-testid="ir-create-auth-input"
                        type="text"
                        class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        value={form.values.authorizationNumber}
                        oninput={(e) =>
                            form.setValue(
                                "authorizationNumber",
                                (e.currentTarget as HTMLInputElement).value,
                            )}
                        onblur={() => form.onBlur("authorizationNumber")}
                        placeholder="ej. 83521234567"
                        maxlength={50}
                    />
                    {#if form.errors.authorizationNumber}
                        <p class="mt-1 text-sm text-red-500">
                            {form.errors.authorizationNumber}
                        </p>
                    {/if}
                </div>

                <div class="flex justify-end gap-2">
                    <button
                        data-testid="ir-create-cancel-button"
                        type="button"
                        class="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                        onclick={() => (isOpen = false)}
                    >
                        Cancelar
                    </button>
                    <button
                        data-testid="ir-create-submit-button"
                        type="submit"
                        class="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                        disabled={isSaving || form.isSubmitting}
                    >
                        {isSaving || form.isSubmitting
                            ? "Guardando..."
                            : "Crear"}
                    </button>
                </div>
            </form>
        </div>
    {/snippet}
</Dialog>
