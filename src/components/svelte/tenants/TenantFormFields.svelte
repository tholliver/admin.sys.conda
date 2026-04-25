<script lang="ts">
    /**
     * TenantFormFields.svelte
     *
     * Pure dumb field set — no state, no actions, no dialog knowledge.
     * Receives a ZodForm instance and renders all tenant form inputs.
     *
     * Used by both CreateTenantDialog and EditTenantDialog.
     */
    import { Calendar, CircleAlert } from "@lucide/svelte";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import { BO_CITIES, type TenantFormValues, tenantSchema } from "@/lib/tenant/validation.schema";

    interface Props {
        form: ZodForm<typeof tenantSchema>;
        formId: string;
        onsubmit: (e: SubmitEvent) => void;
    }

    let { form, formId, onsubmit }: Props = $props();

    function err(key: keyof TenantFormValues) {
        return form.errors[key];
    }

    function set(key: keyof TenantFormValues, value: string) {
        form.setValue(key, value, { validate: false });
    }
</script>

<form id={formId} {onsubmit} class="space-y-4 p-4">

    <!-- Nombre completo -->
    <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">
            Nombre Completo <span class="text-red-500">*</span>
        </label>
        <input
            type="text"
            value={form.values.fullName}
            oninput={(e) => set("fullName", e.currentTarget.value)}
            onblur={() => form.onBlur("fullName")}
            placeholder="Juan Pérez López"
            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                   {err('fullName') ? 'border-red-400' : 'border-slate-200'}"
        />
        {#if err("fullName")}
            <p class="mt-1 text-xs text-red-600 flex items-center gap-1">
                <CircleAlert class="h-3 w-3" />{err("fullName")}
            </p>
        {/if}
    </div>

    <!-- CI + Ciudad CI -->
    <div class="grid grid-cols-2 gap-4">
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">CI</label>
            <input
                type="text"
                value={form.values.ci}
                oninput={(e) => set("ci", e.currentTarget.value)}
                onblur={() => form.onBlur("ci")}
                placeholder="12345678"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Ciudad CI</label>
            <select
                value={form.values.ciCity}
                onchange={(e) => set("ciCity", e.currentTarget.value)}
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {#each BO_CITIES as city}
                    <option value={city.value}>{city.value} — {city.label}</option>
                {/each}
            </select>
        </div>
    </div>

    <!-- Teléfono + Email -->
    <div class="grid grid-cols-2 gap-4">
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
            <input
                type="tel"
                value={form.values.phone}
                oninput={(e) => set("phone", e.currentTarget.value)}
                onblur={() => form.onBlur("phone")}
                placeholder="+591 70000000"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Correo</label>
            <input
                type="email"
                value={form.values.email}
                oninput={(e) => set("email", e.currentTarget.value)}
                onblur={() => form.onBlur("email")}
                placeholder="cliente@correo.com"
                class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                       {err('email') ? 'border-red-400' : 'border-slate-200'}"
            />
            {#if err("email")}
                <p class="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-3 w-3" />{err("email")}
                </p>
            {/if}
        </div>
    </div>

    <!-- Tipo de Ambiente -->
    <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Tipo de Ambiente</label>
        <input
            type="text"
            value={form.values.description}
            oninput={(e) => set("description", e.currentTarget.value)}
            onblur={() => form.onBlur("description")}
            placeholder="Ej: Oficina, Depósito, Local comercial..."
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
    </div>

    <!-- Alquiler + Fechas -->
    <div class="grid grid-cols-3 gap-3">
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
                Alquiler/Mes (Bs) <span class="text-red-500">*</span>
            </label>
            <div class="relative">
                <span class="absolute left-3 top-2.5 text-slate-500 text-sm pointer-events-none">Bs</span>
                <input
                    type="number"
                    value={form.values.monthlyRent}
                    oninput={(e) => set("monthlyRent", e.currentTarget.value)}
                    onblur={() => form.onBlur("monthlyRent")}
                    min="0"
                    step="0.01"
                    placeholder="500.00"
                    class="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                           {err('monthlyRent') ? 'border-red-400' : 'border-slate-200'}"
                />
            </div>
            {#if err("monthlyRent")}
                <p class="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-3 w-3" />{err("monthlyRent")}
                </p>
            {/if}
        </div>
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
                Inicio Contrato <span class="text-red-500">*</span>
            </label>
            <div class="relative">
                <input
                    type="date"
                    value={form.values.startDate}
                    oninput={(e) => set("startDate", e.currentTarget.value)}
                    onblur={() => form.onBlur("startDate")}
                    class="w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none
                           {err('startDate') ? 'border-red-400' : 'border-slate-200'}"
                />
                <Calendar class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {#if err("startDate")}
                <p class="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <CircleAlert class="h-3 w-3" />{err("startDate")}
                </p>
            {/if}
        </div>
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Fin Contrato</label>
            <div class="relative">
                <input
                    type="date"
                    value={form.values.endDate}
                    oninput={(e) => set("endDate", e.currentTarget.value)}
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                />
                <Calendar class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
        </div>
    </div>

    <!-- Notas -->
    <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Notas</label>
        <textarea
            rows="2"
            value={form.values.notes}
            oninput={(e) => set("notes", e.currentTarget.value)}
            onblur={() => form.onBlur("notes")}
            placeholder="Observaciones opcionales..."
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        ></textarea>
    </div>

</form>
