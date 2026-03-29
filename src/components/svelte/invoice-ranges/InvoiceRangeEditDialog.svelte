<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import type { InvoiceRange } from "@/db/schema";
    import { apiEndpoints } from "@/utils";
    import { navigate } from "astro:transitions/client";
    import { Edit, Calendar } from "@lucide/svelte";
    import { toast } from "@/lib/toast";
    import { z } from "zod/v4";

    interface Props {
        range: InvoiceRange;
    }

    let { range }: Props = $props();

    const schema = z
        .object({
            code: z.string().min(1, "El código es obligatorio").max(10).trim(),
            category: z
                .string()
                .min(1, "La cuenta es obligatoria")
                .max(50)
                .trim(),
            prefix: z.string().max(10).optional(),
            rangeStart: z.coerce.number().int().min(1, "Debe ser mayor a 0"),
            rangeEnd: z.coerce.number().int().min(1, "Debe ser mayor a 0"),
            current: z.coerce.number().int().min(1, "Debe ser mayor a 0"),
            authorizationNumber: z
                .string()
                .min(1, "El número de autorización es obligatorio")
                .max(50)
                .trim(),
            isSystem: z.boolean(),
            expirationDate: z
                .string()
                .min(1, "La fecha de expiración es obligatoria"),
        })
        .refine((d) => d.rangeEnd > d.rangeStart, {
            message: "El fin debe ser mayor al inicio",
            path: ["rangeEnd"],
        })
        .refine((d) => d.current >= d.rangeStart && d.current <= d.rangeEnd, {
            message: "El actual debe estar dentro del rango",
            path: ["current"],
        });

    const form = new ZodForm({
        schema,
        get initialValues() {
            return {
                code: range.code,
                category: range.category,
                prefix: range.prefix ?? "",
                rangeStart: Number(range.rangeStart),
                rangeEnd: Number(range.rangeEnd),
                current: Number(range.current),
                authorizationNumber: range.authorizationNumber,
                isSystem: range.isSystem,
                expirationDate: range.expirationDate
                    ? new Date(range.expirationDate).toISOString().split("T")[0]
                    : "",
            };
        },
    });

    // Sync current to rangeStart whenever start changes
    function syncCurrentToStart(val: number) {
        form.setValue("rangeStart", val || 1);
        form.setValue("current", val || 1);
    }

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
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...values,
                        id: range.id,
                        code: values.code.toUpperCase().trim(),
                        prefix: values.prefix?.trim() || null,
                        authorizationNumber: values.authorizationNumber.trim(),
                        expirationDate: new Date(values.expirationDate),
                    }),
                },
            );
            const result = await response.json();
            if (!response.ok) throw new Error(parseError(result));
            toast.success("Éxito", {
                description: "Rango actualizado correctamente",
            });
            isOpen = false;
            navigate("/talonarios");
        } catch (error: any) {
            toast.error("Error al actualizar", {
                description: error?.message || "Error desconocido",
            });
        } finally {
            isSaving = false;
        }
    });
</script>

<button
    data-testid={`ir-edit-open-${range.id}`}
    type="button"
    class="inline-flex items-center justify-center size-9 rounded-md border border-input bg-background hover:bg-accent"
    onclick={() => {
        form.reset({
            code: range.code,
            category: range.category,
            prefix: range.prefix ?? "",
            rangeStart: Number(range.rangeStart),
            rangeEnd: Number(range.rangeEnd),
            current: Number(range.current),
            authorizationNumber: range.authorizationNumber,
            isSystem: range.isSystem,
            expirationDate: range.expirationDate
                ? new Date(range.expirationDate).toISOString().split("T")[0]
                : "",
        });
        isOpen = true;
    }}
    aria-label="Editar rango"
    title="Editar rango"
>
    <Edit class="h-4 w-4" />
</button>

<Dialog
    bind:isOpen
    onClose={() => (isOpen = false)}
    size="sm"
    testId={`ir-edit-dialog-${range.id}`}
>
    {#snippet children()}
        <div class="space-y-4">
            <div>
                <h2 class="text-lg font-semibold">
                    Editar Rango de Talonarios
                </h2>
                <p class="text-sm text-muted-foreground">
                    Actualizando rango <span class="font-mono font-medium"
                        >{range.code}</span
                    >
                    — {range.category}.
                </p>
            </div>

            <form
                id={`ir-edit-form-${range.id}`}
                class="space-y-4"
                onsubmit={submit}
            >
                <!-- Code + Prefix side by side -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            for={`ir-edit-code-${range.id}`}
                            class="text-sm font-medium"
                        >
                            Código
                            <span class="text-muted-foreground text-xs ml-1"
                                >usado en el sistema</span
                            >
                        </label>
                        <input
                            id={`ir-edit-code-${range.id}`}
                            data-testid="ir-edit-code-input"
                            type="text"
                            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                            value={form.values.code}
                            oninput={(e) =>
                                form.setValue(
                                    "code",
                                    (
                                        e.currentTarget as HTMLInputElement
                                    ).value.toUpperCase(),
                                )}
                            onblur={() => form.onBlur("code")}
                            maxlength={10}
                            disabled={form.values.isSystem}
                        />
                        {#if form.errors.code}
                            <p class="mt-1 text-sm text-red-500">
                                {form.errors.code}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
                            for={`ir-edit-prefix-${range.id}`}
                            class="text-sm font-medium"
                        >
                            Prefijo
                            <span class="text-muted-foreground text-xs ml-1"
                                >(en factura)</span
                            >
                        </label>
                        <input
                            id={`ir-edit-prefix-${range.id}`}
                            data-testid="ir-edit-prefix-input"
                            type="text"
                            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            value={form.values.prefix}
                            oninput={(e) =>
                                form.setValue(
                                    "prefix",
                                    (e.currentTarget as HTMLInputElement).value,
                                )}
                            onblur={() => form.onBlur("prefix")}
                            maxlength={10}
                        />
                    </div>
                </div>

                <!-- Category -->
                <div>
                    <label
                        for={`ir-edit-category-${range.id}`}
                        class="text-sm font-medium">Categoría</label
                    >
                    <input
                        id={`ir-edit-category-${range.id}`}
                        data-testid="ir-edit-category-input"
                        type="text"
                        class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.values.category}
                        oninput={(e) =>
                            form.setValue(
                                "category",
                                (e.currentTarget as HTMLInputElement).value,
                            )}
                        onblur={() => form.onBlur("category")}
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
                        <label
                            for={`ir-edit-start-${range.id}`}
                            class="text-sm font-medium">Inicio</label
                        >
                        <input
                            id={`ir-edit-start-${range.id}`}
                            data-testid="ir-edit-start-input"
                            type="number"
                            step="1"
                            min="1"
                            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            value={form.values.rangeStart}
                            oninput={(e) =>
                                syncCurrentToStart(
                                    Number.parseInt(
                                        (e.currentTarget as HTMLInputElement)
                                            .value,
                                    ),
                                )}
                            onblur={() => form.onBlur("rangeStart")}
                        />
                        {#if form.errors.rangeStart}
                            <p class="mt-1 text-sm text-red-500">
                                {form.errors.rangeStart}
                            </p>
                        {/if}
                    </div>
                    <div>
                        <label
                            for={`ir-edit-end-${range.id}`}
                            class="text-sm font-medium">Fin</label
                        >
                        <input
                            id={`ir-edit-end-${range.id}`}
                            data-testid="ir-edit-end-input"
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
                                    ) || 1,
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

                <!-- Current -->
                <div>
                    <label
                        for={`ir-edit-current-${range.id}`}
                        class="text-sm font-medium"
                    >
                        Número actual
                        <span class="text-muted-foreground text-xs ml-1"
                            >(próximo a emitir)</span
                        >
                    </label>
                    <input
                        id={`ir-edit-current-${range.id}`}
                        data-testid="ir-edit-current-input"
                        type="number"
                        step="1"
                        min="1"
                        class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        value={form.values.current}
                        oninput={(e) =>
                            form.setValue(
                                "current",
                                Number.parseInt(
                                    (e.currentTarget as HTMLInputElement).value,
                                ) || 1,
                            )}
                        onblur={() => form.onBlur("current")}
                    />
                    {#if form.errors.current}
                        <p class="mt-1 text-sm text-red-500">
                            {form.errors.current}
                        </p>
                    {/if}
                </div>

                <!-- Authorization number -->
                <div>
                    <div class="flex items-center justify-between">
                        <label for="ir-create-auth" class="text-sm font-medium">
                            Nro. de Autorización
                        </label>
                        <!-- <label
                            class="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                            <input
                                data-testid="ir-edit-is-system-toggle"
                                type="checkbox"
                                class="h-4 w-4 rounded border-input text-primary focus:ring-ring focus:ring-offset-background"
                                checked={form.values.isSystem}
                                onchange={(e) =>
                                    form.setValue(
                                        "isSystem",
                                        (e.currentTarget as HTMLInputElement)
                                            .checked,
                                    )}
                            />
                            Sistema
                        </label> -->
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

                <!-- Expiration date -->
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label
                            for="ir-create-expiry"
                            class="text-sm font-medium"
                        >
                            Fecha de Expiración
                        </label>
                        <button
                            type="button"
                            onclick={() =>
                                form.setValue(
                                    "current",
                                    form.values.rangeStart,
                                )}
                            class="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 hover:bg-amber-100 transition-colors"
                            title="Reiniciar contador al inicio del rango"
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
                            Reiniciar contador
                        </button>
                    </div>
                    <div class="relative">
                        <input
                            id="ir-create-expiry"
                            data-testid="ir-create-expiry-input"
                            type="date"
                            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm appearance-none date-input-icon"
                            value={form.values.expirationDate}
                            oninput={(e) =>
                                form.setValue(
                                    "expirationDate",
                                    (e.currentTarget as HTMLInputElement).value,
                                )}
                            onblur={() => form.onBlur("expirationDate")}
                        />
                        <Calendar
                            class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                        />
                    </div>
                    {#if form.errors.expirationDate}
                        <p class="mt-1 text-sm text-red-500">
                            {form.errors.expirationDate}
                        </p>
                    {/if}
                </div>

                <div class="flex justify-end gap-2">
                    <button
                        data-testid="ir-edit-cancel-button"
                        type="button"
                        class="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                        onclick={() => (isOpen = false)}
                    >
                        Cancelar
                    </button>
                    <button
                        data-testid="ir-edit-submit-button"
                        type="submit"
                        class="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                        disabled={isSaving || form.isSubmitting}
                    >
                        {isSaving || form.isSubmitting
                            ? "Guardando..."
                            : "Actualizar"}
                    </button>
                </div>
            </form>
        </div>
    {/snippet}
</Dialog>
