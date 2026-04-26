<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
    import {
        CircleDollarSign, HandCoins, Sparkles, Check, ChevronDown,
    } from "@lucide/svelte";
    import {
        ICON_MAP, ICON_OPTIONS, DEFAULT_ICON,
        type IconKey, type TransactionCategoryValues,
    } from "./form.constants";
    import type { SelectTransactionCategories } from "@/db/schema";

    // ── Types ──────────────────────────────────────────────────────────────────
    export interface RangeOption {
        id: string;
        category: string;
        prefix: string | null;
        current: number;
        rangeEnd: number;
    }

    interface Props {
        /** ZodForm instance owned by the parent dialog */
        form: ZodForm<any>;
        formId: string;
        activeParents: SelectTransactionCategories[];
        /** Server-side field errors to merge with client validation */
        serverFieldErrors?: Record<string, string | string[]>;
        onSubmit: (e: SubmitEvent) => void;
        /** True when rendering inside edit dialog — code field starts touched */
        isEdit?: boolean;
    }

    let {
        form,
        formId,
        activeParents,
        serverFieldErrors = {},
        onSubmit,
        isEdit = false,
    }: Props = $props();

    // ── Local UI state (icon picker dialog — scoped here, not in parent) ───────
    let iconDialogOpen = $state(false);
    let codeTouched    = $state(isEdit);

    // ── Derived ────────────────────────────────────────────────────────────────
    let CurrentIcon = $derived(
        form.values.icon
            ? ICON_MAP[form.values.icon as IconKey]
            : form.values.type === "income"
              ? CircleDollarSign
              : form.values.type === "outcome"
                ? HandCoins
                : Sparkles,
    );

    // ── Helpers ────────────────────────────────────────────────────────────────
    function fieldError(key: string): string {
        const server = serverFieldErrors?.[key];
        if (server) return Array.isArray(server) ? server[0] : server;
        return form.errors[key] ?? "";
    }

    function slugify(v: string): string {
        return v
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 50);
    }

    function onNameInput(e: Event) {
        const next = (e.currentTarget as HTMLInputElement).value;
        form.setValue("name", next, { validate: false });
        if (!codeTouched) form.setValue("code", slugify(next), { validate: false });
    }

    function onCodeInput(e: Event) {
        const next = (e.currentTarget as HTMLInputElement).value.toUpperCase();
        form.setValue("code", next, { validate: false });
        codeTouched = next.trim().length > 0;
    }

    function generateCode() {
        form.setValue("code", slugify(form.values.name), { validate: false });
        codeTouched = true;
    }
</script>

<form id={formId} class="space-y-4" onsubmit={onSubmit}>
    <!-- Name -->
    <div>
        <label for="{formId}-name" class="mb-1 block text-sm font-medium text-slate-700">
            Nombre
        </label>
        <input
            id="{formId}-name"
            type="text"
            maxlength="100"
            required
            value={form.values.name}
            oninput={onNameInput}
            onblur={() => form.onBlur("name")}
            class="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100
                {fieldError('name') ? 'border-red-400' : 'border-slate-300'}"
        />
        {#if fieldError("name")}
            <p class="mt-1 text-xs text-red-600">{fieldError("name")}</p>
        {/if}
    </div>

    <!-- Description -->
    <div>
        <label for="{formId}-desc" class="mb-1 block text-sm font-medium text-slate-700">
            Descripcion
        </label>
        <textarea
            id="{formId}-desc"
            rows="2"
            maxlength="500"
            value={form.values.description}
            oninput={(e) => form.setValue("description", e.currentTarget.value, { validate: false })}
            onblur={() => form.onBlur("description")}
            class="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        ></textarea>
        {#if fieldError("description")}
            <p class="mt-1 text-xs text-red-600">{fieldError("description")}</p>
        {/if}
    </div>

    <!-- Type -->
    <div>
        <span class="mb-2 block text-sm font-medium text-slate-700">Tipo</span>
        <div class="grid gap-3 sm:grid-cols-2">
            <!-- Income -->
            <button
                type="button"
                onclick={() => form.setValue("type", "income", { validate: true })}
                class="flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-sm font-medium transition
                    {form.values.type === 'income'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50'}"
            >
                <span class="rounded-md p-2 {form.values.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}">
                    <CircleDollarSign class="h-4 w-4" />
                </span>
                <span class="block text-left">
                    <span class="block font-semibold">Ingreso</span>
                    <span class="mt-0.5 block text-xs {form.values.type === 'income' ? 'text-emerald-800' : 'text-slate-600'}">
                        Entradas de dinero a caja.
                    </span>
                </span>
                {#if form.values.type === "income"}
                    <Check class="ml-auto h-4 w-4 text-emerald-600 shrink-0 self-center" />
                {/if}
            </button>

            <!-- Outcome -->
            <button
                type="button"
                onclick={() => form.setValue("type", "outcome", { validate: true })}
                class="flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-sm font-medium transition
                    {form.values.type === 'outcome'
                        ? 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-200'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-red-300 hover:bg-red-50'}"
            >
                <span class="rounded-md p-2 {form.values.type === 'outcome' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}">
                    <HandCoins class="h-4 w-4" />
                </span>
                <span class="block text-left">
                    <span class="block font-semibold">Egreso</span>
                    <span class="mt-0.5 block text-xs {form.values.type === 'outcome' ? 'text-red-800' : 'text-slate-600'}">
                        Salidas de dinero de caja.
                    </span>
                </span>
                {#if form.values.type === "outcome"}
                    <Check class="ml-auto h-4 w-4 text-red-500 shrink-0 self-center" />
                {/if}
            </button>
        </div>
        {#if fieldError("type")}
            <p class="mt-1 text-xs text-red-600">{fieldError("type")}</p>
        {/if}
    </div>

    <!-- Icon picker strip (only when type is selected) -->
    {#if form.values.type}
        {@const isIncome  = form.values.type === "income"}
        {@const swatchBg  = isIncome ? "bg-emerald-100 text-emerald-700"    : "bg-red-100 text-red-700"}
        {@const stripHov  = isIncome ? "hover:border-emerald-300 hover:bg-emerald-50" : "hover:border-red-300 hover:bg-red-50"}
        {@const changeCls = isIncome ? "border-emerald-200 text-emerald-700 hover:bg-emerald-100" : "border-red-200 text-red-700 hover:bg-red-100"}
        <div>
            <span class="mb-2 block text-sm font-medium text-slate-700">Icono</span>
            <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition {stripHov}">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md {swatchBg}">
                    <CurrentIcon class="h-5 w-5" />
                </span>
                <span class="flex-1 text-sm text-slate-700">
                    {#if form.values.icon}
                        {ICON_OPTIONS.find((o) => o.value === form.values.icon)?.label ?? form.values.icon}
                    {:else}
                        Auto (segun el tipo)
                    {/if}
                </span>
                <button
                    type="button"
                    onclick={() => (iconDialogOpen = true)}
                    class="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition {changeCls}"
                >
                    Cambiar
                </button>
            </div>
        </div>
    {/if}

    <!-- Requires auth -->
    <div class="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
        <input
            type="checkbox"
            id="{formId}-auth"
            checked={form.values.requiresAuthorization}
            onchange={(e) => form.setValue("requiresAuthorization", e.currentTarget.checked, { validate: false })}
            class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label for="{formId}-auth" class="flex-1 cursor-pointer select-none text-sm font-medium text-amber-900">
            Requiere autorizacion
            <span class="mt-0.5 block text-xs font-normal text-amber-700">
                Las transacciones en esta cuenta requeriran aprobacion manual.
            </span>
        </label>
    </div>

    <!-- Advanced -->
    <details class="rounded-md border border-slate-200 bg-slate-50">
        <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700">
            Configuracion avanzada
        </summary>
        <div class="grid gap-4 p-3">
            <!-- Code -->
            <div>
                <div class="mb-1 flex items-center justify-between gap-2">
                    <label for="{formId}-code" class="block text-sm font-medium text-slate-700">Codigo</label>
                    <button
                        type="button"
                        onclick={generateCode}
                        class="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                        Generar codigo
                    </button>
                </div>
                <input
                    id="{formId}-code"
                    type="text"
                    maxlength="50"
                    required
                    value={form.values.code}
                    oninput={onCodeInput}
                    onblur={() => form.onBlur("code")}
                    class="w-full rounded-md border px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100
                        {fieldError('code') ? 'border-red-400' : 'border-slate-300'}"
                />
                <p class="mt-1 text-xs text-slate-500">Se autogenera desde el nombre y puedes editarlo.</p>
                {#if fieldError("code")}
                    <p class="mt-1 text-xs text-red-600">{fieldError("code")}</p>
                {/if}
            </div>

            <!-- Parent -->
            <div>
                <label for="{formId}-parent" class="mb-1 block text-sm font-medium text-slate-700">
                    Cuenta padre (opcional)
                </label>
                <div class="relative">
                    <select
                        id="{formId}-parent"
                        value={form.values.parentId}
                        onchange={(e) => form.setValue("parentId", e.currentTarget.value, { validate: false })}
                        onblur={() => form.onBlur("parentId")}
                        class="w-full appearance-none rounded-md border border-slate-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Sin cuenta padre</option>
                        {#each activeParents as cat}
                            <option value={cat.id}>
                                {cat.name} ({cat.type === "income" ? "Ingreso" : "Egreso"})
                            </option>
                        {/each}
                    </select>
                    <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                {#if fieldError("parentId")}
                    <p class="mt-1 text-xs text-red-600">{fieldError("parentId")}</p>
                {/if}
            </div>
        </div>
    </details>
</form>

<!-- Icon picker dialog — owned here so it doesn't pollute parent -->
<Dialog bind:isOpen={iconDialogOpen} title="Elegir icono" size="lg">
    {#snippet children()}
        {@const isIncome    = form.values.type === "income"}
        {@const activeBorder = isIncome ? "border-emerald-400 bg-emerald-50 text-emerald-900"  : "border-red-400 bg-red-50 text-red-900"}
        {@const hoverCls    = isIncome ? "hover:border-emerald-300 hover:bg-emerald-50"         : "hover:border-red-300 hover:bg-red-50"}
        {@const activeThumb = isIncome ? "bg-emerald-100 text-emerald-700"                      : "bg-red-100 text-red-700"}
        {@const activeCheck = isIncome ? "text-emerald-600"                                     : "text-red-500"}

        <div class="space-y-4">
            <!-- Auto -->
            <button
                type="button"
                onclick={() => { form.setValue("icon", "", { validate: false }); iconDialogOpen = false; }}
                class="flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm transition
                    {form.values.icon === '' ? activeBorder : 'border-slate-200 bg-white text-slate-700 ' + hoverCls}"
            >
                <span class="flex h-8 w-8 items-center justify-center rounded-md {form.values.icon === '' ? activeThumb : 'bg-slate-100 text-slate-600'}">
                    <Sparkles class="h-4 w-4" />
                </span>
                <span class="font-medium">Auto</span>
                <span class="text-xs {form.values.icon === '' ? (isIncome ? 'text-emerald-700' : 'text-red-700') : 'text-slate-500'}">
                    Segun el tipo seleccionado
                </span>
                {#if form.values.icon === ""}
                    <Check class="ml-auto h-4 w-4 {activeCheck}" />
                {/if}
            </button>

            <!-- Grid -->
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {#each ICON_OPTIONS as opt}
                    {@const Icon   = ICON_MAP[opt.value]}
                    {@const active = form.values.icon === opt.value}
                    <button
                        type="button"
                        onclick={() => { form.setValue("icon", opt.value, { validate: false }); iconDialogOpen = false; }}
                        title={opt.label}
                        class="flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 text-xs font-medium transition
                            {active ? activeBorder : 'border-slate-200 bg-white text-slate-600 ' + hoverCls}"
                    >
                        <span class="flex h-8 w-8 items-center justify-center rounded-md {active ? activeThumb : 'bg-slate-100 text-slate-600'}">
                            <Icon class="h-4 w-4" />
                        </span>
                        <span class="truncate w-full text-center text-[10px] leading-tight">{opt.label}</span>
                    </button>
                {/each}
            </div>
        </div>
    {/snippet}
</Dialog>
