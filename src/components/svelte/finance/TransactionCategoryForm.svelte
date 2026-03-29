<script lang="ts">
    import { actions, isInputError, isActionError } from "astro:actions";
    import Dialog from "@/components/svelte/Dialog.svelte";
    import {
        CircleDollarSign,
        HandCoins,
        Wallet,
        Banknote,
        CreditCard,
        Receipt,
        PiggyBank,
        BadgeDollarSign,
        ShoppingBag,
        Wrench,
        Bus,
        CarFront,
        Route,
        Map as MapIcon,
        Landmark,
        Ticket,
        Users,
        IdCard,
        Fuel,
        Shield,
        BadgeCheck,
        FileText,
        ClipboardList,
        CalendarCheck,
        Hammer,
        AlertTriangle,
        Building2,
        Handshake,
        Sparkles,
        Check,
        ChevronDown,
    } from "@lucide/svelte";
    import { navigate } from "astro:transitions/client";
    import { toast } from "@/lib/toast";
    import type { SelectTransactionCategories } from "@/db/schema";

    // ── Types ──────────────────────────────────────────────────────────────────
    interface RangeOption {
        id: string;
        code: string;
        category: string;
        prefix: string | null;
        current: number;
        rangeEnd: number;
    }

    interface Props {
        mode: "create" | "edit";
        activeParents: SelectTransactionCategories[];
        availableRanges: RangeOption[];
        inputErrors?: Record<string, string | string[]>;
        successMessage?: string | null;
        errorMessage?: string | null;
        defaults?: Partial<
            SelectTransactionCategories & { invoiceRangeId?: string }
        >;
    }

    // ── Icon map ───────────────────────────────────────────────────────────────
    const ICON_MAP = {
        "circle-dollar-sign": CircleDollarSign,
        "hand-coins": HandCoins,
        wallet: Wallet,
        banknote: Banknote,
        "credit-card": CreditCard,
        receipt: Receipt,
        "piggy-bank": PiggyBank,
        "badge-dollar-sign": BadgeDollarSign,
        "shopping-bag": ShoppingBag,
        wrench: Wrench,
        bus: Bus,
        "car-front": CarFront,
        route: Route,
        map: MapIcon,
        landmark: Landmark,
        ticket: Ticket,
        users: Users,
        "id-card": IdCard,
        fuel: Fuel,
        shield: Shield,
        "badge-check": BadgeCheck,
        "file-text": FileText,
        "clipboard-list": ClipboardList,
        "calendar-check": CalendarCheck,
        hammer: Hammer,
        "alert-triangle": AlertTriangle,
        "building-2": Building2,
        handshake: Handshake,
    } as const;

    type IconKey = keyof typeof ICON_MAP;

    const ICON_OPTIONS: { value: IconKey; label: string }[] = [
        { value: "circle-dollar-sign", label: "Ingreso" },
        { value: "hand-coins", label: "Egreso" },
        { value: "wallet", label: "Cartera" },
        { value: "banknote", label: "Billete" },
        { value: "credit-card", label: "Tarjeta" },
        { value: "receipt", label: "Recibo" },
        { value: "piggy-bank", label: "Ahorro" },
        { value: "badge-dollar-sign", label: "Cobro" },
        { value: "shopping-bag", label: "Compra" },
        { value: "wrench", label: "Servicio" },
        { value: "bus", label: "Bus" },
        { value: "car-front", label: "Auto" },
        { value: "route", label: "Ruta" },
        { value: "map", label: "Mapa" },
        { value: "landmark", label: "Sindicato" },
        { value: "ticket", label: "Ticket" },
        { value: "users", label: "Socios" },
        { value: "id-card", label: "Licencia" },
        { value: "fuel", label: "Combustible" },
        { value: "shield", label: "Seguro" },
        { value: "badge-check", label: "Aprobado" },
        { value: "file-text", label: "Documento" },
        { value: "clipboard-list", label: "Control" },
        { value: "calendar-check", label: "Calendario" },
        { value: "hammer", label: "Mantenimiento" },
        { value: "alert-triangle", label: "Multa" },
        { value: "building-2", label: "Oficina" },
        { value: "handshake", label: "Convenio" },
    ];

    // ── Props & state ──────────────────────────────────────────────────────────
    let {
        mode,
        activeParents,
        availableRanges,
        inputErrors = {},
        successMessage,
        errorMessage,
        defaults = {},
    }: Props = $props();

    let name = $state(defaults.name ?? "");
    let code = $state(defaults.code ?? "");
    let description = $state(defaults.description ?? "");
    let type = $state<"income" | "outcome" | "">(defaults.type ?? "");
    let selectedIcon = $state<IconKey | "">((defaults.icon as IconKey) ?? "");
    let requiresAuth = $state(Boolean(defaults.requiresAuthorization));
    let parentId = $state(defaults.parentId ?? "");
    let invoiceRangeId = $state(defaults.invoiceRangeId ?? "");
    let isSubmitting = $state(false);
    let iconDialogOpen = $state(false);
    let codeTouched = $state(mode === "edit");
    let serverError = $state<string | null>(errorMessage ?? null);
    let serverSuccess = $state<string | null>(successMessage ?? null);
    let fieldErrors = $state<Record<string, string>>(
        Object.fromEntries(
            Object.entries(inputErrors).map(([k, v]) => [
                k,
                Array.isArray(v) ? v.join(", ") : v,
            ]),
        ),
    );

    // ── Derived ────────────────────────────────────────────────────────────────
    let CurrentIcon = $derived(
        selectedIcon
            ? ICON_MAP[selectedIcon]
            : type === "income"
              ? CircleDollarSign
              : type === "outcome"
                ? HandCoins
                : Sparkles,
    );

    // ── Helpers ────────────────────────────────────────────────────────────────
    const slugify = (v: string) =>
        v
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 50);

    function onNameInput(e: Event) {
        name = (e.currentTarget as HTMLInputElement).value;
        if (!codeTouched) code = slugify(name);
    }

    function onCodeInput(e: Event) {
        code = (e.currentTarget as HTMLInputElement).value.toUpperCase();
        codeTouched = code.trim().length > 0;
    }

    function generateCode() {
        code = slugify(name);
        codeTouched = true;
    }

    // ── Submit ─────────────────────────────────────────────────────────────────
    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        fieldErrors = {};
        serverError = null;
        serverSuccess = null;
        isSubmitting = true;

        const fd = new FormData();
        if (mode === "edit") fd.append("categoryId", defaults.id!);
        fd.append("name", name);
        fd.append("code", code);
        fd.append("description", description);
        fd.append("type", type);
        fd.append("requiresAuthorization", requiresAuth ? "on" : "");
        if (selectedIcon) fd.append("icon", selectedIcon);
        if (parentId) fd.append("parentId", parentId);
        if (invoiceRangeId) fd.append("invoiceRangeId", invoiceRangeId);

        try {
            const action =
                mode === "edit"
                    ? actions.finance.updateTransactionCategory
                    : actions.finance.createTransactionCategory;

            const result = await action(fd);

            if (isInputError(result?.error)) {
                const errs = result.error.fields;
                fieldErrors = Object.fromEntries(
                    Object.entries(errs).map(([k, v]) => [
                        k,
                        Array.isArray(v) ? v.join(", ") : String(v),
                    ]),
                );
                return;
            }

            if (isActionError(result?.error)) {
                serverError = result.error.message;
                return;
            }

            if (result?.data?.message) {
                toast.success("Exito", { description: result.data.message });
                if (mode === "create") {
                    name = "";
                    code = "";
                    description = "";
                    type = "";
                    selectedIcon = "";
                    requiresAuth = false;
                    parentId = "";
                    invoiceRangeId = "";
                    codeTouched = false;
                } else {
                    navigate("/cuentas");
                }
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado";
        } finally {
            isSubmitting = false;
        }
    }
</script>

<section class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
    <h1 class="text-xl font-bold text-slate-900">
        {mode === "create" ? "Crear cuenta" : "Editar cuenta"}
    </h1>
    <p class="mt-1 text-sm text-slate-600">
        {mode === "create"
            ? "Define cuentas para ingresos y egresos."
            : "Actualiza los datos de la cuenta seleccionada."}
    </p>

    {#if serverSuccess}
        <p
            class="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
            {serverSuccess}
        </p>
    {/if}
    {#if serverError}
        <p
            class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
            {serverError}
        </p>
    {/if}

    <form class="mt-6 space-y-4" onsubmit={handleSubmit}>
        <!-- Name -->
        <div>
            <label
                for="cat-name"
                class="mb-1 block text-sm font-medium text-slate-700"
                >Nombre</label
            >
            <input
                id="cat-name"
                type="text"
                maxlength="100"
                required
                value={name}
                oninput={onNameInput}
                class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 {fieldErrors.name
                    ? 'border-red-400'
                    : ''}"
            />
            {#if fieldErrors.name}<p class="mt-1 text-xs text-red-600">
                    {fieldErrors.name}
                </p>{/if}
        </div>

        <!-- Description -->
        <div>
            <label
                for="cat-desc"
                class="mb-1 block text-sm font-medium text-slate-700"
                >Descripcion</label
            >
            <textarea
                id="cat-desc"
                rows="1"
                maxlength="500"
                bind:value={description}
                class="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            ></textarea>
        </div>

        <!-- Type -->
        <div>
            <span class="mb-2 block text-sm font-medium text-slate-700"
                >Tipo</span
            >
            <div class="grid gap-3 sm:grid-cols-2">
                <button
                    type="button"
                    onclick={() => (type = "income")}
                    class="flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-sm font-medium transition
            {type === 'income'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50'}"
                >
                    <span
                        class="rounded-md p-2 {type === 'income'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'}"
                    >
                        <CircleDollarSign class="h-4 w-4" />
                    </span>
                    <span class="block text-left">
                        <span class="block font-semibold">Ingreso</span>
                        <span
                            class="mt-0.5 block text-xs {type === 'income'
                                ? 'text-emerald-800'
                                : 'text-slate-600'}"
                            >Entradas de dinero a caja.</span
                        >
                    </span>
                    {#if type === "income"}<Check
                            class="ml-auto h-4 w-4 text-emerald-600 shrink-0 self-center"
                        />{/if}
                </button>

                <button
                    type="button"
                    onclick={() => (type = "outcome")}
                    class="flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-sm font-medium transition
            {type === 'outcome'
                        ? 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-200'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-red-300 hover:bg-red-50'}"
                >
                    <span
                        class="rounded-md p-2 {type === 'outcome'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'}"
                    >
                        <HandCoins class="h-4 w-4" />
                    </span>
                    <span class="block text-left">
                        <span class="block font-semibold">Egreso</span>
                        <span
                            class="mt-0.5 block text-xs {type === 'outcome'
                                ? 'text-red-800'
                                : 'text-slate-600'}"
                            >Salidas de dinero de caja.</span
                        >
                    </span>
                    {#if type === "outcome"}<Check
                            class="ml-auto h-4 w-4 text-red-500 shrink-0 self-center"
                        />{/if}
                </button>
            </div>
            {#if fieldErrors.type}<p class="mt-1 text-xs text-red-600">
                    {fieldErrors.type}
                </p>{/if}
        </div>

        <!-- Invoice range — only for income, shown before icon -->
        {#if type === "income" && availableRanges.length > 0}
            <div>
                <label
                    for="cat-range"
                    class="mb-1 block text-sm font-medium text-slate-700"
                >
                    Talonario asociado
                    <span class="ml-1 text-xs font-normal text-slate-500"
                        >(opcional)</span
                    >
                </label>
                <div class="relative">
                    <select
                        id="cat-range"
                        bind:value={invoiceRangeId}
                        class="w-full appearance-none rounded-md border border-slate-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Sin talonario</option>
                        {#each availableRanges as range}
                            {@const exhausted =
                                Number(range.current) >= Number(range.rangeEnd)}
                            <option value={range.id} disabled={exhausted}>
                                {range.category} ({range.code}){exhausted
                                    ? " — Agotado"
                                    : ""}
                            </option>
                        {/each}
                    </select>
                    <ChevronDown
                        class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    />
                </div>
                {#if invoiceRangeId}
                    {@const range = availableRanges.find(
                        (r) => r.id === invoiceRangeId,
                    )}
                    {#if range}
                        <p class="mt-1 text-xs text-slate-500">
                            Siguiente numero: <span
                                class="font-mono font-medium text-slate-700"
                            >
                                {range.prefix
                                    ? `${range.prefix}-${Number(range.current) + 1}`
                                    : Number(range.current) + 1}
                            </span>
                        </p>
                    {/if}
                {/if}
            </div>
        {/if}

        <!-- Icon picker — inline strip, type-aware color -->
        {#if type}
            {@const isIncome = type === "income"}
            {@const swatchBg = isIncome
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"}
            {@const stripHover = isIncome
                ? "hover:border-emerald-300 hover:bg-emerald-50"
                : "hover:border-red-300 hover:bg-red-50"}
            {@const changeCls = isIncome
                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "border-red-200 text-red-700 hover:bg-red-100"}
            <div>
                <span class="mb-2 block text-sm font-medium text-slate-700"
                    >Icono</span
                >
                <div
                    class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition {stripHover}"
                >
                    <span
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md {swatchBg}"
                    >
                        <CurrentIcon class="h-5 w-5" />
                    </span>
                    <span class="flex-1 text-sm text-slate-700">
                        {#if selectedIcon}
                            {ICON_OPTIONS.find((o) => o.value === selectedIcon)
                                ?.label ?? selectedIcon}
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
        <div
            class="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3"
        >
            <input
                type="checkbox"
                id="cat-auth"
                bind:checked={requiresAuth}
                class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label
                for="cat-auth"
                class="flex-1 cursor-pointer select-none text-sm font-medium text-amber-900"
            >
                Requiere autorizacion
                <span class="mt-0.5 block text-xs font-normal text-amber-700"
                    >Las transacciones en esta cuenta requeriran aprobacion
                    manual.</span
                >
            </label>
        </div>

        <!-- Advanced -->
        <details class="rounded-md border border-slate-200 bg-slate-50">
            <summary
                class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700"
                >Configuracion avanzada</summary
            >
            <div class="grid gap-4 p-3">
                <!-- Code -->
                <div>
                    <div class="mb-1 flex items-center justify-between gap-2">
                        <label
                            for="cat-code"
                            class="block text-sm font-medium text-slate-700"
                            >Codigo</label
                        >
                        <button
                            type="button"
                            onclick={generateCode}
                            class="text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >Generar codigo</button
                        >
                    </div>
                    <input
                        id="cat-code"
                        type="text"
                        maxlength="50"
                        required
                        value={code}
                        oninput={onCodeInput}
                        class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 {fieldErrors.code
                            ? 'border-red-400'
                            : ''}"
                    />
                    <p class="mt-1 text-xs text-slate-500">
                        Se autogenera desde el nombre y puedes editarlo.
                    </p>
                    {#if fieldErrors.code}<p class="mt-1 text-xs text-red-600">
                            {fieldErrors.code}
                        </p>{/if}
                </div>

                <!-- Parent -->
                <div>
                    <label
                        for="cat-parent"
                        class="mb-1 block text-sm font-medium text-slate-700"
                        >Cuenta padre (opcional)</label
                    >
                    <div class="relative">
                        <select
                            id="cat-parent"
                            bind:value={parentId}
                            class="w-full appearance-none rounded-md border border-slate-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">Sin cuenta padre</option>
                            {#each activeParents as cat}
                                <option value={cat.id}
                                    >{cat.name} ({cat.type === "income"
                                        ? "Ingreso"
                                        : "Egreso"})</option
                                >
                            {/each}
                        </select>
                        <ChevronDown
                            class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        />
                    </div>
                </div>
            </div>
        </details>

        <!-- Submit -->
        <div class="flex items-center gap-3">
            <button
                type="submit"
                disabled={isSubmitting || !type || !name.trim()}
                class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSubmitting
                    ? "Guardando..."
                    : mode === "edit"
                      ? "Guardar cambios"
                      : "Crear cuenta"}
            </button>
            {#if mode === "edit"}
                <a
                    href="/cuentas"
                    class="text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >Cancelar</a
                >
            {/if}
        </div>
    </form>
</section>

<!-- Icon picker dialog -->
<Dialog bind:isOpen={iconDialogOpen} title="Elegir icono" size="lg">
    {#snippet children()}
        {@const isIncome = type === "income"}
        {@const activeBorder = isIncome
            ? "border-emerald-400 bg-emerald-50 text-emerald-900"
            : "border-red-400 bg-red-50 text-red-900"}
        {@const hoverCls = isIncome
            ? "hover:border-emerald-300 hover:bg-emerald-50"
            : "hover:border-red-300 hover:bg-red-50"}
        {@const activeThumb = isIncome
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700"}
        {@const activeCheck = isIncome ? "text-emerald-600" : "text-red-500"}
        <div class="space-y-4">
            <!-- Auto option -->
            <button
                type="button"
                onclick={() => {
                    selectedIcon = "";
                    iconDialogOpen = false;
                }}
                class="flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm transition
          {selectedIcon === ''
                    ? activeBorder
                    : 'border-slate-200 bg-white text-slate-700 ' + hoverCls}"
            >
                <span
                    class="flex h-8 w-8 items-center justify-center rounded-md {selectedIcon ===
                    ''
                        ? activeThumb
                        : 'bg-slate-100 text-slate-600'}"
                >
                    <Sparkles class="h-4 w-4" />
                </span>
                <span class="font-medium">Auto</span>
                <span
                    class="text-xs {selectedIcon === ''
                        ? isIncome
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        : 'text-slate-500'}">Segun el tipo seleccionado</span
                >
                {#if selectedIcon === ""}<Check
                        class="ml-auto h-4 w-4 {activeCheck}"
                    />{/if}
            </button>

            <!-- Icon grid -->
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {#each ICON_OPTIONS as opt}
                    {@const Icon = ICON_MAP[opt.value]}
                    {@const active = selectedIcon === opt.value}
                    <button
                        type="button"
                        onclick={() => {
                            selectedIcon = opt.value;
                            iconDialogOpen = false;
                        }}
                        title={opt.label}
                        class="flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 text-xs font-medium transition
              {active
                            ? activeBorder
                            : 'border-slate-200 bg-white text-slate-600 ' +
                              hoverCls}"
                    >
                        <span
                            class="flex h-8 w-8 items-center justify-center rounded-md {active
                                ? activeThumb
                                : 'bg-slate-100 text-slate-600'}"
                        >
                            <Icon class="h-4 w-4" />
                        </span>
                        <span
                            class="truncate w-full text-center text-[10px] leading-tight"
                            >{opt.label}</span
                        >
                    </button>
                {/each}
            </div>
        </div>
    {/snippet}
</Dialog>
