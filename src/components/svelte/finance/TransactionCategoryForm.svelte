<script lang="ts">
    import { actions, isInputError, isActionError } from "astro:actions";
    import { z } from "zod";
    import Dialog from "@/components/svelte/Dialog.svelte";
    import { ZodForm } from "@/lib/form/create-zod-form.svelte";
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

    const transactionCategorySchema = z.object({
        name: z
            .string()
            .trim()
            .min(1, "Nombre requerido")
            .max(100, "Nombre demasiado largo"),
        code: z
            .string()
            .trim()
            .min(1, "Codigo requerido")
            .max(50, "Codigo demasiado largo"),
        type: z.enum(["income", "outcome"]).or(z.literal("")),
        description: z.string().max(500, "Descripcion demasiado larga"),
        icon: z.string().max(50, "Icono demasiado largo"),
        invoiceRangeId: z
            .string()
            .uuid("ID de talonario invalido")
            .or(z.literal("")),
        parentId: z.string().uuid("Cuenta padre invalida").or(z.literal("")),
        requiresAuthorization: z.boolean(),
    });

    type TransactionCategoryValues = z.infer<typeof transactionCategorySchema>;

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

    function buildInitialValues(): TransactionCategoryValues {
        return {
            name: defaults.name ?? "",
            code: defaults.code ?? "",
            description: defaults.description ?? "",
            type: (defaults.type as "income" | "outcome" | "") ?? "",
            icon: (defaults.icon as IconKey | "") ?? "",
            requiresAuthorization: Boolean(defaults.requiresAuthorization),
            parentId: defaults.parentId ?? "",
            invoiceRangeId: defaults.invoiceRangeId ?? "",
        };
    }

    let form = $state(
        new ZodForm({
            schema: transactionCategorySchema,
            initialValues: buildInitialValues(),
            validateMode: "onBlur",
        }),
    );

    let iconDialogOpen = $state(false);
    let codeTouched = $state(mode === "edit");
    let serverError = $state<string | null>(errorMessage ?? null);
    let serverSuccess = $state<string | null>(successMessage ?? null);
    let serverFieldErrors = $state<Record<string, string | string[]>>(
        inputErrors ?? {},
    );

    $effect(() => {
        form.reset(buildInitialValues());
        codeTouched = mode === "edit";
    });

    $effect(() => {
        serverFieldErrors = inputErrors ?? {};
        serverError = errorMessage ?? null;
        serverSuccess = successMessage ?? null;
    });

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
    const slugify = (v: string) =>
        v
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 50);

    function onNameInput(e: Event) {
        const nextName = (e.currentTarget as HTMLInputElement).value;
        form.setValue("name", nextName, { validate: false });
        if (!codeTouched) {
            form.setValue("code", slugify(nextName), { validate: false });
        }
    }

    function onCodeInput(e: Event) {
        const nextCode = (
            e.currentTarget as HTMLInputElement
        ).value.toUpperCase();
        form.setValue("code", nextCode, { validate: false });
        codeTouched = nextCode.trim().length > 0;
    }

    function generateCode() {
        form.setValue("code", slugify(form.values.name), { validate: false });
        codeTouched = true;
    }

    function fieldError(key: keyof TransactionCategoryValues | string) {
        const server = serverFieldErrors?.[key];
        if (server) return Array.isArray(server) ? server[0] : server;
        return form.errors[key] ?? "";
    }

    // Submit
    const handleSubmit = form.handleSubmit(async (values) => {
        serverFieldErrors = {};
        serverError = null;
        serverSuccess = null;

        const fd = new FormData();
        if (mode === "edit") fd.append("categoryId", defaults.id!);
        fd.append("name", values.name);
        fd.append("code", values.code);
        fd.append("description", values.description);
        fd.append("type", values.type);
        fd.append(
            "requiresAuthorization",
            values.requiresAuthorization ? "on" : "",
        );
        if (values.icon.trim()) fd.append("icon", values.icon.trim());
        if (values.parentId.trim())
            fd.append("parentId", values.parentId.trim());
        if (values.invoiceRangeId.trim())
            fd.append("invoiceRangeId", values.invoiceRangeId);

        try {
            const action =
                mode === "edit"
                    ? actions.finance.updateTransactionCategory
                    : actions.finance.createTransactionCategory;

            const result = await action(fd);

            if (isInputError(result?.error)) {
                serverFieldErrors = result.error.fields ?? {};
                return;
            }

            if (isActionError(result?.error)) {
                serverError = result.error.message;
                return;
            }

            if (result?.data?.message) {
                toast.success("Exito", { description: result.data.message });
                if (mode === "create") {
                    form.reset(buildInitialValues());
                    codeTouched = false;
                } else {
                    navigate("/cuentas");
                }
            }
        } catch (err: any) {
            serverError = err?.message ?? "Error inesperado";
        }
    });
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
                value={form.values.name}
                oninput={onNameInput}
                onblur={() => form.onBlur("name")}
                class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 {fieldError(
                    'name',
                )
                    ? 'border-red-400'
                    : ''}"
            />
            {#if fieldError("name")}<p class="mt-1 text-xs text-red-600">
                    {fieldError("name")}
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
                value={form.values.description}
                oninput={(e) =>
                    form.setValue("description", e.currentTarget.value, {
                        validate: false,
                    })}
                onblur={() => form.onBlur("description")}
                class="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            ></textarea>
            {#if fieldError("description")}<p class="mt-1 text-xs text-red-600">
                    {fieldError("description")}
                </p>{/if}
        </div>

        <!-- Type -->
        <div>
            <span class="mb-2 block text-sm font-medium text-slate-700"
                >Tipo</span
            >
            <div class="grid gap-3 sm:grid-cols-2">
                <button
                    type="button"
                    onclick={() =>
                        form.setValue("type", "income", { validate: true })}
                    class="flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-sm font-medium transition
            {form.values.type === 'income'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50'}"
                >
                    <span
                        class="rounded-md p-2 {form.values.type === 'income'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'}"
                    >
                        <CircleDollarSign class="h-4 w-4" />
                    </span>
                    <span class="block text-left">
                        <span class="block font-semibold">Ingreso</span>
                        <span
                            class="mt-0.5 block text-xs {form.values.type ===
                            'income'
                                ? 'text-emerald-800'
                                : 'text-slate-600'}"
                            >Entradas de dinero a caja.</span
                        >
                    </span>
                    {#if form.values.type === "income"}<Check
                            class="ml-auto h-4 w-4 text-emerald-600 shrink-0 self-center"
                        />{/if}
                </button>

                <button
                    type="button"
                    onclick={() =>
                        form.setValue("type", "outcome", { validate: true })}
                    class="flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-sm font-medium transition
            {form.values.type === 'outcome'
                        ? 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-200'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-red-300 hover:bg-red-50'}"
                >
                    <span
                        class="rounded-md p-2 {form.values.type === 'outcome'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'}"
                    >
                        <HandCoins class="h-4 w-4" />
                    </span>
                    <span class="block text-left">
                        <span class="block font-semibold">Egreso</span>
                        <span
                            class="mt-0.5 block text-xs {form.values.type ===
                            'outcome'
                                ? 'text-red-800'
                                : 'text-slate-600'}"
                            >Salidas de dinero de caja.</span
                        >
                    </span>
                    {#if form.values.type === "outcome"}<Check
                            class="ml-auto h-4 w-4 text-red-500 shrink-0 self-center"
                        />{/if}
                </button>
            </div>
            {#if fieldError("type")}<p class="mt-1 text-xs text-red-600">
                    {fieldError("type")}
                </p>{/if}
        </div>

        <!-- Invoice range — only for income, shown before icon -->
        {#if form.values.type === "income" && availableRanges.length > 0}
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
                        value={form.values.invoiceRangeId}
                        onchange={(e) =>
                            form.setValue(
                                "invoiceRangeId",
                                e.currentTarget.value,
                                { validate: false },
                            )}
                        onblur={() => form.onBlur("invoiceRangeId")}
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
                {#if form.values.invoiceRangeId}
                    {@const range = availableRanges.find(
                        (r) => r.id === form.values.invoiceRangeId,
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
                {#if fieldError("invoiceRangeId")}<p
                        class="mt-1 text-xs text-red-600"
                    >
                        {fieldError("invoiceRangeId")}
                    </p>{/if}
            </div>
        {/if}

        <!-- Icon picker — inline strip, type-aware color -->
        {#if form.values.type}
            {@const isIncome = form.values.type === "income"}
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
                        {#if form.values.icon}
                            {ICON_OPTIONS.find(
                                (o) => o.value === form.values.icon,
                            )?.label ?? form.values.icon}
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
                checked={form.values.requiresAuthorization}
                onchange={(e) =>
                    form.setValue(
                        "requiresAuthorization",
                        e.currentTarget.checked,
                        { validate: false },
                    )}
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
                        value={form.values.code}
                        oninput={onCodeInput}
                        onblur={() => form.onBlur("code")}
                        class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 {fieldError(
                            'code',
                        )
                            ? 'border-red-400'
                            : ''}"
                    />
                    <p class="mt-1 text-xs text-slate-500">
                        Se autogenera desde el nombre y puedes editarlo.
                    </p>
                    {#if fieldError("code")}<p
                            class="mt-1 text-xs text-red-600"
                        >
                            {fieldError("code")}
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
                            value={form.values.parentId}
                            onchange={(e) =>
                                form.setValue(
                                    "parentId",
                                    e.currentTarget.value,
                                    { validate: false },
                                )}
                            onblur={() => form.onBlur("parentId")}
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
                    {#if fieldError("parentId")}<p
                            class="mt-1 text-xs text-red-600"
                        >
                            {fieldError("parentId")}
                        </p>{/if}
                </div>
            </div>
        </details>

        <!-- Submit -->
        <div class="flex items-center gap-3">
            <button
                type="submit"
                disabled={form.isSubmitting ||
                    !form.values.type ||
                    !form.values.name.trim()}
                class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {form.isSubmitting
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
        {@const isIncome = form.values.type === "income"}
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
                    form.setValue("icon", "", { validate: false });
                    iconDialogOpen = false;
                }}
                class="flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm transition
          {form.values.icon === ''
                    ? activeBorder
                    : 'border-slate-200 bg-white text-slate-700 ' + hoverCls}"
            >
                <span
                    class="flex h-8 w-8 items-center justify-center rounded-md {form
                        .values.icon === ''
                        ? activeThumb
                        : 'bg-slate-100 text-slate-600'}"
                >
                    <Sparkles class="h-4 w-4" />
                </span>
                <span class="font-medium">Auto</span>
                <span
                    class="text-xs {form.values.icon === ''
                        ? isIncome
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        : 'text-slate-500'}">Segun el tipo seleccionado</span
                >
                {#if form.values.icon === ""}<Check
                        class="ml-auto h-4 w-4 {activeCheck}"
                    />{/if}
            </button>

            <!-- Icon grid -->
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {#each ICON_OPTIONS as opt}
                    {@const Icon = ICON_MAP[opt.value]}
                    {@const active = form.values.icon === opt.value}
                    <button
                        type="button"
                        onclick={() => {
                            form.setValue("icon", opt.value, {
                                validate: false,
                            });
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
