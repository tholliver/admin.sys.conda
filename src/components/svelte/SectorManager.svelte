<script lang="ts">
    import { actions, isInputError } from "astro:actions";
    import {
        Building2,
        CircleAlert,
        CircleCheck,
        Pencil,
        Trash2,
        X,
        Plus,
        Users,
        Wallet,
        TriangleAlert,
        Link2,
    } from "@lucide/svelte";

    // ─── Types ────────────────────────────────────────────────────────────────

    interface Sector {
        id: number;
        name: string;
        description: string | null;
        isActive: boolean;
        cashboxId: string;
        cashboxName?: string | null;
        cashboxCode?: string | null;
        empCount?: number;
    }

    interface CashboxOption {
        id: string;
        name: string;
        code: string;
        balance: string | null;
    }

    interface Props {
        cashboxId: string;
        cashboxIsActive: boolean;
        initialSectors: Sector[];
        allCashboxes: CashboxOption[];
    }

    // ─── Props ────────────────────────────────────────────────────────────────

    let {
        cashboxId,
        cashboxIsActive,
        initialSectors,
        allCashboxes,
    }: Props = $props();

    // ─── State ────────────────────────────────────────────────────────────────

    type Mode = "list" | "create" | "edit" | "delete-confirm" | "deactivate-confirm";

    let sectors = $state<Sector[]>(initialSectors);
    let mode = $state<Mode>("list");
    let activeSector = $state<Sector | null>(null);

    // form fields
    let fieldName = $state("");
    let fieldDescription = $state("");
    let fieldCashboxId = $state(cashboxId);

    // feedback
    let isSubmitting = $state(false);
    let inputErrors = $state<Record<string, string>>({});
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function resetForm() {
        fieldName = "";
        fieldDescription = "";
        fieldCashboxId = cashboxId;
        inputErrors = {};
        serverError = null;
        successMsg = null;
    }

    function openCreate() {
        resetForm();
        activeSector = null;
        mode = "create";
    }

    function openEdit(s: Sector) {
        resetForm();
        activeSector = s;
        fieldName = s.name;
        fieldDescription = s.description ?? "";
        fieldCashboxId = s.cashboxId;
        mode = "edit";
    }

    function openDeleteConfirm(s: Sector) {
        activeSector = s;
        serverError = null;
        mode = "delete-confirm";
    }

    function openDeactivateConfirm(s: Sector) {
        activeSector = s;
        serverError = null;
        mode = "deactivate-confirm";
    }

    function backToList() {
        mode = "list";
        activeSector = null;
        resetForm();
    }

    function parseInputErrors(err: any) {
        if (!isInputError(err)) return;
        const raw = err.fields as Record<string, string | string[]>;
        for (const [k, v] of Object.entries(raw)) {
            inputErrors[k] = Array.isArray(v) ? v[0] : v;
        }
    }

    async function reload() {
        // Give the DB a moment then hard-reload for fresh SSR data
        await new Promise((r) => setTimeout(r, 800));
        window.location.reload();
    }

    // ─── Actions ─────────────────────────────────────────────────────────────

    async function handleCreate(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;
        isSubmitting = true;

        const fd = new FormData();
        fd.set("name", fieldName.trim());
        if (fieldDescription.trim()) fd.set("description", fieldDescription.trim());
        fd.set("cashboxId", fieldCashboxId);

        try {
            const result = await actions.sector.createSector(fd);
            if (result?.error) {
                parseInputErrors(result.error);
                if (!Object.keys(inputErrors).length)
                    serverError = result.error.message ?? "Error al crear el sector.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Sector creado.";
                await reload();
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    async function handleUpdate(e: SubmitEvent) {
        e.preventDefault();
        inputErrors = {};
        serverError = null;
        isSubmitting = true;

        const fd = new FormData();
        fd.set("id", String(activeSector!.id));
        fd.set("name", fieldName.trim());
        if (fieldDescription.trim()) fd.set("description", fieldDescription.trim());
        // Only send cashboxId if it changed — updateSector only updates it when provided
        if (fieldCashboxId && fieldCashboxId !== activeSector!.cashboxId)
            fd.set("cashboxId", fieldCashboxId);

        try {
            const result = await actions.sector.updateSector(fd);
            if (result?.error) {
                parseInputErrors(result.error);
                if (!Object.keys(inputErrors).length)
                    serverError = result.error.message ?? "Error al actualizar.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Sector actualizado.";
                await reload();
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    async function handleDeactivate() {
        serverError = null;
        isSubmitting = true;
        const fd = new FormData();
        fd.set("id", String(activeSector!.id));

        try {
            const result = await actions.sector.deactivateSector(fd);
            if (result?.error) {
                serverError = result.error.message ?? "Error al desactivar.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Sector desactivado.";
                await reload();
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    async function handleDelete() {
        serverError = null;
        isSubmitting = true;
        const fd = new FormData();
        fd.set("id", String(activeSector!.id));

        try {
            const result = await actions.sector.deleteSector(fd);
            if (result?.error) {
                serverError = result.error.message ?? "Error al eliminar.";
                return;
            }
            if (result?.data?.success) {
                successMsg = result.data.message ?? "Sector eliminado.";
                await reload();
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado.";
        } finally {
            isSubmitting = false;
        }
    }

    // ─── Derived ─────────────────────────────────────────────────────────────

    let activeSectors   = $derived(sectors.filter((s) => s.isActive));
    let inactiveSectors = $derived(sectors.filter((s) => !s.isActive));

    const formId = `sector-manager-form-${cashboxId}`;
</script>

<!-- ─── List view ─────────────────────────────────────────────────────────── -->

{#if mode === "list"}
    <div class="space-y-3">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-800">
                Sectores vinculados
            </h2>
            {#if cashboxIsActive}
                <button
                    type="button"
                    onclick={openCreate}
                    class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                    <Plus class="h-3.5 w-3.5" />
                    Nuevo sector
                </button>
            {/if}
        </div>

        <!-- Empty state -->
        {#if activeSectors.length === 0 && inactiveSectors.length === 0}
            <div class="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400">
                <Building2 class="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p class="text-sm">Esta caja no tiene sectores.</p>
                {#if cashboxIsActive}
                    <button
                        type="button"
                        onclick={openCreate}
                        class="mt-3 text-xs text-emerald-600 hover:underline font-medium"
                    >
                        Crear el primero →
                    </button>
                {/if}
            </div>

        {:else}
            <!-- Active sectors -->
            {#if activeSectors.length > 0}
                <div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div class="divide-y divide-slate-100">
                        {#each activeSectors as sector (sector.id)}
                            {@const empCount = sector.empCount ?? 0}
                            <div class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                                <!-- Icon + name -->
                                <div class="shrink-0 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <Building2 class="h-3.5 w-3.5 text-slate-500" />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-sm font-semibold text-slate-900 truncate">{sector.name}</p>
                                    {#if sector.description}
                                        <p class="text-xs text-slate-400 truncate">{sector.description}</p>
                                    {/if}
                                </div>

                                <!-- Cashbox chip (only shows when different from current caja) -->
                                {#if sector.cashboxId !== cashboxId && sector.cashboxName}
                                    <span class="hidden sm:inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                        <Wallet class="h-2.5 w-2.5" />
                                        {sector.cashboxName}
                                    </span>
                                {/if}

                                <!-- Employee count -->
                                <div class="hidden sm:flex items-center gap-1 shrink-0">
                                    <Users class="h-3.5 w-3.5 text-slate-400" />
                                    <span class="text-xs text-slate-500">{empCount}</span>
                                </div>

                                <!-- Actions -->
                                <div class="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onclick={() => openEdit(sector)}
                                        class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                                        title="Editar sector"
                                    >
                                        <Pencil class="h-3 w-3" />
                                        Editar
                                    </button>
                                    {#if empCount === 0}
                                        <button
                                            type="button"
                                            onclick={() => openDeleteConfirm(sector)}
                                            class="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                                            title="Eliminar sector"
                                        >
                                            <Trash2 class="h-3 w-3" />
                                        </button>
                                    {:else}
                                        <button
                                            type="button"
                                            onclick={() => openDeactivateConfirm(sector)}
                                            class="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                                            title="Desactivar sector"
                                        >
                                            <TriangleAlert class="h-3 w-3" />
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Inactive sectors -->
            {#if inactiveSectors.length > 0}
                <details class="group rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <summary class="flex cursor-pointer items-center justify-between px-4 py-3 select-none hover:bg-slate-50 transition-colors">
                        <span class="text-xs font-semibold text-slate-400">
                            Inactivos ({inactiveSectors.length})
                        </span>
                        <svg class="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </summary>
                    <div class="divide-y divide-slate-100 border-t border-slate-100">
                        {#each inactiveSectors as sector (sector.id)}
                            <div class="flex items-center gap-3 px-4 py-2.5 opacity-55">
                                <Building2 class="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <p class="text-sm text-slate-500 flex-1 truncate">{sector.name}</p>
                                <span class="text-[10px] bg-slate-100 text-slate-400 rounded-full px-2 py-0.5 font-medium">Inactivo</span>
                            </div>
                        {/each}
                    </div>
                </details>
            {/if}
        {/if}
    </div>

<!-- ─── Create / Edit form ────────────────────────────────────────────────── -->

{:else if mode === "create" || mode === "edit"}
    {@const isEdit = mode === "edit"}
    <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <!-- Panel header -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div class="flex items-center gap-2">
                <Building2 class="h-4 w-4 text-slate-400" />
                <h2 class="text-sm font-semibold text-slate-800">
                    {isEdit ? `Editar: ${activeSector?.name}` : "Nuevo sector"}
                </h2>
            </div>
            <button
                type="button"
                onclick={backToList}
                class="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
                <X class="h-4 w-4" />
            </button>
        </div>

        <!-- Success -->
        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-10 text-center">
                <CircleCheck class="h-10 w-10 text-emerald-500" />
                <p class="text-sm font-semibold text-slate-900">{successMsg}</p>
            </div>

        {:else}
            <!-- Server error -->
            {#if serverError}
                <div class="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-700 flex-1">{serverError}</p>
                    <button type="button" onclick={() => (serverError = null)} class="text-red-400 hover:text-red-600">
                        <X class="h-4 w-4" />
                    </button>
                </div>
            {/if}

            <form id={formId} class="px-5 py-4 space-y-4" onsubmit={isEdit ? handleUpdate : handleCreate}>
                <!-- Name -->
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">
                        Nombre <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        bind:value={fieldName}
                        required
                        maxlength="100"
                        placeholder="Ej: Sector Norte, Directivo..."
                        class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            {inputErrors.name ? 'border-red-400' : 'border-slate-200'}"
                    />
                    {#if inputErrors.name}
                        <p class="mt-1 text-xs text-red-600">{inputErrors.name}</p>
                    {/if}
                </div>

                <!-- Description -->
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">
                        Descripción <span class="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                        type="text"
                        bind:value={fieldDescription}
                        maxlength="500"
                        placeholder="Descripción del sector..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <!-- Cashbox assignment (shown in edit to allow reassign; in create it's pre-set but shown for transparency) -->
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">
                        <span class="inline-flex items-center gap-1">
                            <Link2 class="h-3 w-3" />
                            Caja vinculada <span class="text-red-500">*</span>
                        </span>
                    </label>
                    <select
                        bind:value={fieldCashboxId}
                        required
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        {#each allCashboxes as cb (cb.id)}
                            <option value={cb.id}>
                                {cb.name} ({cb.code}) — Bs {parseFloat(cb.balance ?? "0").toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                                {cb.id === cashboxId ? " · esta caja" : ""}
                            </option>
                        {/each}
                    </select>
                    {#if inputErrors.cashboxId}
                        <p class="mt-1 text-xs text-red-600">{inputErrors.cashboxId}</p>
                    {/if}
                </div>
            </form>

            <!-- Footer -->
            <div class="flex items-center justify-between gap-3 px-5 pb-4">
                {#if isEdit}
                    <!-- Deactivate/delete shortcut from edit view -->
                    {@const empCount = activeSector?.empCount ?? 0}
                    {#if empCount === 0}
                        <button
                            type="button"
                            onclick={() => openDeleteConfirm(activeSector!)}
                            class="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors inline-flex items-center gap-1.5"
                        >
                            <Trash2 class="h-3.5 w-3.5" />
                            Eliminar
                        </button>
                    {:else}
                        <button
                            type="button"
                            onclick={() => openDeactivateConfirm(activeSector!)}
                            class="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors inline-flex items-center gap-1.5"
                        >
                            <TriangleAlert class="h-3.5 w-3.5" />
                            Desactivar
                        </button>
                    {/if}
                {:else}
                    <div></div>
                {/if}

                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onclick={backToList}
                        class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form={formId}
                        disabled={isSubmitting || !fieldName.trim() || !fieldCashboxId}
                        class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                        {#if isSubmitting}
                            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Guardando...
                        {:else}
                            {isEdit ? "Guardar cambios" : "Crear sector"}
                        {/if}
                    </button>
                </div>
            </div>
        {/if}
    </div>

<!-- ─── Delete confirm ────────────────────────────────────────────────────── -->

{:else if mode === "delete-confirm"}
    <div class="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
        <div class="flex items-center gap-3 px-5 py-4 border-b border-red-100 bg-red-50">
            <Trash2 class="h-4 w-4 text-red-600 shrink-0" />
            <h2 class="text-sm font-semibold text-red-900">Eliminar sector</h2>
        </div>

        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-10 text-center">
                <CircleCheck class="h-10 w-10 text-emerald-500" />
                <p class="text-sm font-semibold text-slate-900">{successMsg}</p>
            </div>
        {:else}
            <div class="px-5 py-4 space-y-4">
                <p class="text-sm text-slate-700">
                    ¿Eliminar <strong class="font-semibold">"{activeSector?.name}"</strong>?
                    Esta acción no se puede deshacer.
                </p>
                <p class="text-xs text-slate-500">
                    Las transacciones históricas vinculadas a este sector quedarán con referencia nula pero no se perderán.
                </p>
                {#if serverError}
                    <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <p class="text-sm text-red-700">{serverError}</p>
                    </div>
                {/if}
                <div class="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onclick={backToList}
                        class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={handleDelete}
                        disabled={isSubmitting}
                        class="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {#if isSubmitting}
                            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {:else}
                            <Trash2 class="h-4 w-4" />
                        {/if}
                        Eliminar definitivamente
                    </button>
                </div>
            </div>
        {/if}
    </div>

<!-- ─── Deactivate confirm ────────────────────────────────────────────────── -->

{:else if mode === "deactivate-confirm"}
    <div class="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div class="flex items-center gap-3 px-5 py-4 border-b border-amber-100 bg-amber-50">
            <TriangleAlert class="h-4 w-4 text-amber-600 shrink-0" />
            <h2 class="text-sm font-semibold text-amber-900">Desactivar sector</h2>
        </div>

        {#if successMsg}
            <div class="flex flex-col items-center gap-3 py-10 text-center">
                <CircleCheck class="h-10 w-10 text-emerald-500" />
                <p class="text-sm font-semibold text-slate-900">{successMsg}</p>
            </div>
        {:else}
            <div class="px-5 py-4 space-y-4">
                <p class="text-sm text-slate-700">
                    ¿Desactivar <strong class="font-semibold">"{activeSector?.name}"</strong>?
                </p>
                <p class="text-xs text-slate-500">
                    El sector quedará inactivo. El personal asignado seguirá existiendo pero no generará cuotas nuevas. Se puede reactivar desde la base de datos si es necesario.
                </p>
                {#if serverError}
                    <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <p class="text-sm text-red-700">{serverError}</p>
                    </div>
                {/if}
                <div class="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onclick={backToList}
                        class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={handleDeactivate}
                        disabled={isSubmitting}
                        class="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {#if isSubmitting}
                            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {:else}
                            <TriangleAlert class="h-4 w-4" />
                        {/if}
                        Desactivar sector
                    </button>
                </div>
            </div>
        {/if}
    </div>
{/if}
