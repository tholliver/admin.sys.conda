<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { z } from "zod";
    import { CircleAlert, CircleCheck } from "@lucide/svelte";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import type { SelectSector } from "@/db/schema";
    import type { EmployeeFormData } from "./employeeFormTypes";

    interface Props {
        sectors: Pick<SelectSector, "id" | "name">[];
        directorioCount: number;
        plantaCount: number;
        maxDirectorio: number;
        maxPlanta: number;
        initial?: EmployeeFormData | null;
        formId?: string;
        fieldErrors?: Record<string, string | string[]>;
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

    const employeeFormSchema = z.object({
        employeeType: z.enum(["directorio", "planta"], {
            message: "Tipo de personal requerido",
        }),
        fullName: z
            .string()
            .min(2, "Nombre completo requerido")
            .refine((v) => v.trim().split(/\s+/).length >= 2, {
                message: "Ingrese al menos nombre y apellido",
            }),
        ci: z.string().min(5, "CI requerido"),
        ciCity: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        chargeTitle: z.string().min(2, "Cargo requerido"),
        sectorId: z.string().min(1, "Sector requerido"),
        hireDate: z.string().min(1, "Fecha de ingreso requerida"),
        baseSalary: z.string().min(1, "Salario requerido"),
        notes: z.string().optional(),
    });

    type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

    let {
        sectors,
        directorioCount,
        plantaCount,
        maxDirectorio,
        maxPlanta,
        initial = null,
        formId = "employee-form",
        fieldErrors = {},
    }: Props = $props();

    const dispatch = createEventDispatcher<{ submit: EmployeeFormData }>();

    function buildInitialValues(): EmployeeFormValues {
        if (!initial) {
            return {
                employeeType: "planta",
                fullName: "",
                ci: "",
                ciCity: "CB",
                phone: "",
                address: "",
                chargeTitle: "",
                sectorId: "",
                hireDate: "",
                baseSalary: "",
                notes: "",
            };
        }

        return {
            employeeType: initial.employeeType ?? "planta",
            fullName: initial.fullName ?? "",
            ci: initial.ci ?? "",
            ciCity: (initial.ciCity ?? "CB") as any,
            phone: initial.phone ?? "",
            address: initial.address ?? "",
            chargeTitle: initial.chargeTitle ?? "",
            sectorId: initial.sectorId ? String(initial.sectorId) : "",
            hireDate: initial.hireDate ?? "",
            baseSalary:
                typeof initial.baseSalary === "number"
                    ? String(initial.baseSalary)
                    : (initial.baseSalary ?? ""),
            notes: initial.notes ?? "",
        };
    }

    let form = $state(
        new ZodForm({
            schema: employeeFormSchema,
            initialValues: buildInitialValues(),
            validateMode: "onBlur",
        }),
    );

    $effect(() => {
        form.reset(buildInitialValues());
    });

    function fieldError(key: keyof EmployeeFormValues | string) {
        const server = fieldErrors?.[key];
        if (server) return Array.isArray(server) ? server[0] : server;
        return form.errors[key] ?? "";
    }

    const onSubmit = form.handleSubmit(async (values) => {
        dispatch("submit", {
            ...values,
            id: initial?.id,
        });
    });
</script>

<form id={formId} onsubmit={onSubmit} class="space-y-2 px-4">
    <!-- Tipo -->
    <div>
        <label class="block text-sm font-semibold text-slate-700 mb-2">
            Tipo de personal <span class="text-red-500">*</span>
        </label>
        <div class="grid grid-cols-2 gap-3">
            <label
                class="relative flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors
                {form.values.employeeType === 'directorio'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'}"
            >
                <input
                    type="radio"
                    name="employeeType"
                    value="directorio"
                    checked={form.values.employeeType === "directorio"}
                    class="sr-only"
                    onchange={() => form.setValue("employeeType", "directorio")}
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
                {form.values.employeeType === 'planta'
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-slate-200 hover:border-violet-300'}"
            >
                <input
                    type="radio"
                    name="employeeType"
                    value="planta"
                    checked={form.values.employeeType === "planta"}
                    class="sr-only"
                    onchange={() => form.setValue("employeeType", "planta")}
                />
                <div class="flex-1">
                    <p class="font-semibold text-slate-800 text-sm">Planta</p>
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
        <label class="block text-sm font-medium text-slate-700 mb-1">
            Nombre Completo <span class="text-red-500">*</span>
            <span class="text-slate-400 font-normal text-xs ml-1"
                >(Nombre Apellido1 Apellido2)</span
            >
        </label>
        <input
            type="text"
            name="fullName"
            value={form.values.fullName}
            placeholder="Juan Pérez López"
            required
            oninput={(e) =>
                form.setValue("fullName", e.currentTarget.value, {
                    validate: false,
                })}
            onblur={() => form.onBlur("fullName")}
            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            {fieldError('fullName') || fieldError('name') || fieldError('pLastName')
                ? 'border-red-400'
                : 'border-slate-200'}"
        />
        {#if fieldError("fullName")}
            <p class="mt-1 text-xs text-red-600 flex items-center gap-1">
                <CircleAlert class="h-3 w-3" />{fieldError("fullName")}
            </p>
        {:else if fieldError("name") || fieldError("pLastName")}
            <p class="mt-1 text-xs text-red-600 flex items-center gap-1">
                <CircleAlert class="h-3 w-3" />{fieldError("name") ??
                    fieldError("pLastName")}
            </p>
        {:else if form.values.fullName.trim().split(/\s+/).length >= 2}
            <p class="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                <CircleCheck class="h-3 w-3" />
                {form.values.fullName.trim().split(/\s+/).slice(0, 3).join(" · ")}
            </p>
        {/if}
    </div>

    <!-- CI + Ciudad -->
    <div class="grid grid-cols-2 gap-4">
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
                CI <span class="text-red-500">*</span>
            </label>
            <input
                type="text"
                name="ci"
                value={form.values.ci}
                required
                placeholder="12345678"
                oninput={(e) =>
                    form.setValue("ci", e.currentTarget.value, {
                        validate: false,
                    })}
                onblur={() => form.onBlur("ci")}
                class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                {fieldError('ci') ? 'border-red-400' : 'border-slate-200'}"
            />
            {#if fieldError("ci")}
                <p class="mt-1 text-xs text-red-600">{fieldError("ci")}</p>
            {/if}
        </div>
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1"
                >Ciudad CI</label
            >
            <select
                name="ciCity"
                value={form.values.ciCity}
                onchange={(e) =>
                    form.setValue("ciCity", e.currentTarget.value, {
                        validate: false,
                    })}
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {#each BO_CITIES as city}
                    <option value={city.value}>
                        {city.value} — {city.label}
                    </option>
                {/each}
            </select>
        </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
        <!-- Cargo -->
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
                Cargo / Función <span class="text-red-500">*</span>
            </label>
            <input
                type="text"
                name="chargeTitle"
                value={form.values.chargeTitle}
                required
                placeholder="Ej: Secretario General, Tesorero, Auxiliar Administrativo"
                oninput={(e) =>
                    form.setValue("chargeTitle", e.currentTarget.value, {
                        validate: false,
                    })}
                onblur={() => form.onBlur("chargeTitle")}
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
            <label class="block text-sm font-medium text-slate-700 mb-1">
                Sector <span class="text-red-500">*</span>
            </label>
            <select
                name="sectorId"
                value={form.values.sectorId}
                required
                onchange={(e) =>
                    form.setValue("sectorId", e.currentTarget.value, {
                        validate: false,
                    })}
                onblur={() => form.onBlur("sectorId")}
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
            <label class="block text-sm font-medium text-slate-700 mb-1"
                >Teléfono</label
            >
            <input
                type="tel"
                name="phone"
                value={form.values.phone}
                placeholder="+591 70000000"
                oninput={(e) =>
                    form.setValue("phone", e.currentTarget.value, {
                        validate: false,
                    })}
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1"
                >Dirección</label
            >
            <input
                type="text"
                name="address"
                value={form.values.address}
                placeholder="Av. Principal #123"
                oninput={(e) =>
                    form.setValue("address", e.currentTarget.value, {
                        validate: false,
                    })}
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    </div>

    <!-- Fecha ingreso + Salario -->
    <div class="grid grid-cols-2 gap-4">
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
                Fecha de Ingreso <span class="text-red-500">*</span>
            </label>
            <input
                type="date"
                name="hireDate"
                value={form.values.hireDate}
                required
                oninput={(e) =>
                    form.setValue("hireDate", e.currentTarget.value, {
                        validate: false,
                    })}
                onblur={() => form.onBlur("hireDate")}
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
            <label class="block text-sm font-medium text-slate-700 mb-1">
                Salario Base (Bs) <span class="text-red-500">*</span>
            </label>
            <div class="relative">
                <span
                    class="absolute left-3 top-2.5 text-slate-500 text-sm pointer-events-none"
                    >Bs</span
                >
                <input
                    type="number"
                    name="baseSalary"
                    value={form.values.baseSalary}
                    required
                    min="0"
                    step="0.01"
                    placeholder="2500.00"
                    oninput={(e) =>
                        form.setValue("baseSalary", e.currentTarget.value, {
                            validate: false,
                        })}
                    onblur={() => form.onBlur("baseSalary")}
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
            name="notes"
            value={form.values.notes}
            rows="2"
            placeholder="Observaciones opcionales..."
            oninput={(e) =>
                form.setValue("notes", e.currentTarget.value, {
                    validate: false,
                })}
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        ></textarea>
    </div>
+</form>
