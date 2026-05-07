import { z } from "zod";
import { ZodForm } from "@/lib/form/create-zod-form.svelte";
import { actions, isInputError } from "astro:actions";

// ── Types ──────────────────────────────────────────────────────────────────────

export type OpMode = "deposit" | "transfer" | "debt";

export interface CategoryOption {
    id: string;
    name: string;
    code: string;
}

export interface CashboxOption {
    id: string;
    name: string;
    balance: string | number;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const depositSchema = z.object({
    categoryId: z.string().min(1, "Selecciona una categoría"),
    amount:     z.string().min(1, "Monto requerido").refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    notes:      z.string().max(500).optional().or(z.literal("")),
    reference:  z.string().max(100).optional().or(z.literal("")),
});

const transferSchema = z.object({
    toCashboxId: z.string().min(1, "Selecciona la caja destino"),
    amount:      z.string().min(1, "Monto requerido").refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    concept:     z.string().min(1, "Concepto requerido").max(255),
    notes:       z.string().max(500).optional().or(z.literal("")),
});

const debtSchema = z.object({
    amount:     z.string().min(1, "Monto requerido").refine((v) => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    categoryId: z.string().min(1, "Selecciona una categoría"),
    notes:      z.string().max(500).optional().or(z.literal("")),
    reference:  z.string().max(100).optional().or(z.literal("")),
});

type DepositValues = z.infer<typeof depositSchema>;
type TransferValues = z.infer<typeof transferSchema>;
type DebtValues = z.infer<typeof debtSchema>;

// ── Store factory ──────────────────────────────────────────────────────────────

export interface CashboxOpsStore {
    mode: OpMode;
    isOpen: boolean;
    serverError: string | null;
    successMsg: string | null;

    depositForm: ZodForm<typeof depositSchema>;
    transferForm: ZodForm<typeof transferSchema>;
    debtForm: ZodForm<typeof debtSchema>;
    form: ZodForm<any>;

    isDeposit: boolean;
    isTransfer: boolean;
    isDebt: boolean;
    amountNum: number;
    balanceAfter: number;
    wouldOverdraw: boolean;
    gap: number;
    coveragePct: number;
    canSubmit: boolean;
    selectedDestCashbox: CashboxOption | null;
    formId: string;

    switchTab(mode: OpMode): void;
    open(mode: OpMode): void;
    close(): void;
    reset(): void;
    fillGap(): void;
    handleSubmit(e?: SubmitEvent): void;
    categoryName(categoryId: string): string;
}

export function createCashboxOperationsStore(
    cashboxId: string,
    cashboxName: string,
    currentBalance: number,
    monthlySalary: number,
    incomeCategories: CategoryOption[],
    outcomeCategories: CategoryOption[],
    allCashboxes: CashboxOption[],
    defaultMode: OpMode = "deposit",
): CashboxOpsStore {
    let mode = $state<OpMode>(defaultMode);
    let isOpen = $state(false);
    let serverError = $state<string | null>(null);
    let successMsg = $state<string | null>(null);

    // ── Helpers ────────────────────────────────────────────────────────────────

    function defaultCategoryId() {
        return incomeCategories.find((c) => c.code === "TRANSFER_IN")?.id ?? incomeCategories[0]?.id ?? "";
    }

    function categoryName(categoryId: string) {
        return incomeCategories.find((c) => c.id === categoryId)?.name ?? "Movimiento de caja";
    }

    // ── Forms ──────────────────────────────────────────────────────────────────

    const depositForm = new ZodForm({
        schema: depositSchema,
        initialValues: { categoryId: defaultCategoryId(), amount: "", notes: "", reference: "" },
        validateMode: "onBlur",
    });

    const transferForm = new ZodForm({
        schema: transferSchema,
        initialValues: { toCashboxId: "", amount: "", concept: "", notes: "" },
        validateMode: "onBlur",
    });

    const debtForm = new ZodForm({
        schema: debtSchema,
        initialValues: { categoryId: defaultCategoryId(), amount: "", notes: "", reference: "" },
        validateMode: "onBlur",
    });

    const form = $derived(
        mode === "deposit" ? depositForm :
        mode === "transfer" ? transferForm :
        debtForm
    );

    // ── Derived ────────────────────────────────────────────────────────────────

    const isDeposit = $derived(mode === "deposit");
    const isTransfer = $derived(mode === "transfer");
    const isDebt = $derived(mode === "debt");

    const otherCashboxes = $derived(allCashboxes.filter((c) => c.id !== cashboxId));

    const amountNum = $derived(parseFloat(form.values.amount) || 0);
    const gap = $derived(Math.max(0, monthlySalary - currentBalance));
    const coveragePct = $derived(monthlySalary > 0 ? Math.min((currentBalance / monthlySalary) * 100, 100) : 100);

    const balanceAfter = $derived(
        isDeposit || isDebt ? currentBalance + amountNum : currentBalance - amountNum
    );
    const wouldOverdraw = $derived(isTransfer && amountNum > currentBalance);

    const formId = $derived(`cashbox-ops-form-${cashboxId}`);

    const selectedDestCashbox = $derived(
        isTransfer ? otherCashboxes.find((c) => c.id === (transferForm.values as any).toCashboxId) : null
    );

    const canSubmit = $derived(
        !form.isSubmitting &&
        !wouldOverdraw &&
        amountNum > 0 &&
        (isTransfer
            ? !!(transferForm.values as any).toCashboxId && !!(transferForm.values as any).concept
            : !!(form.values as any).categoryId)
    );

    // ── Actions ────────────────────────────────────────────────────────────────

    function reset() {
        depositForm.reset({ categoryId: defaultCategoryId(), amount: "", notes: "", reference: "" });
        transferForm.reset({ toCashboxId: "", amount: "", concept: "", notes: "" });
        debtForm.reset({ categoryId: defaultCategoryId(), amount: "", notes: "", reference: "" });
        serverError = null;
        successMsg = null;
    }

    function open(openMode: OpMode) {
        mode = openMode;
        reset();
        isOpen = true;
    }

    function close() {
        isOpen = false;
        reset();
    }

    function fillGap() {
        if (gap > 0) {
            if (mode === "deposit") depositForm.setValue("amount", gap.toFixed(2));
            if (mode === "debt")    debtForm.setValue("amount", gap.toFixed(2));
        }
    }

    function switchTab(t: OpMode) {
        mode = t;
        serverError = null;
        successMsg = null;
    }

    // ── Submit handlers ────────────────────────────────────────────────────────

    const onSubmitDeposit = depositForm.handleSubmit(async (values) => {
        serverError = null;
        const fd = new FormData();
        fd.set("cashboxId", cashboxId);
        fd.set("categoryId", values.categoryId);
        fd.set("amount", values.amount);
        fd.set("concept", categoryName(values.categoryId));
        if (values.notes?.trim()) fd.set("notes", values.notes.trim());
        if (values.reference?.trim()) fd.set("reference", values.reference.trim());

        const result = await actions.sector.depositToCashbox(fd);
        if (isInputError(result?.error)) { depositForm.setErrors(result.error.fields as any); return; }
        if (result?.error) { serverError = result.error.message ?? "Error al depositar."; return; }
        if (result?.data?.success) {
            successMsg = result.data.message ?? "Depósito registrado.";
            setTimeout(() => { isOpen = false; reset(); window.location.reload(); }, 1400);
        }
    });

    const onSubmitTransfer = transferForm.handleSubmit(async (values) => {
        serverError = null;
        const fd = new FormData();
        fd.set("fromCashboxId", cashboxId);
        fd.set("toCashboxId", (values as any).toCashboxId);
        fd.set("amount", values.amount);
        fd.set("concept", (values as any).concept.trim());
        if ((values as any).notes?.trim()) fd.set("notes", (values as any).notes.trim());

        const result = await actions.finance.cashboxTransfer(fd);
        if (isInputError(result?.error)) { transferForm.setErrors(result.error.fields as any); return; }
        if (result?.error) { serverError = result.error.message ?? "Error al transferir."; return; }
        if (result?.data?.success) {
            successMsg = result.data.message ?? "Transferencia registrada.";
            setTimeout(() => { isOpen = false; reset(); window.location.reload(); }, 1400);
        }
    });

    const onSubmitDebt = debtForm.handleSubmit(async (values) => {
        serverError = null;
        const fd = new FormData();
        fd.set("cashboxId", cashboxId);
        fd.set("categoryId", values.categoryId);
        fd.set("amount", values.amount);
        fd.set("concept", `Cobertura deuda salarial - ${categoryName(values.categoryId)}`);
        fd.set("notes", `[Cobertura deuda salarial] ${(values.notes ?? "").trim()}`);
        if ((values as any).reference?.trim()) fd.set("reference", (values as any).reference.trim());

        const result = await actions.sector.depositToCashbox(fd);
        if (isInputError(result?.error)) { debtForm.setErrors(result.error.fields as any); return; }
        if (result?.error) { serverError = result.error.message ?? "Error al cubrir deuda."; return; }
        if (result?.data?.success) {
            successMsg = result.data.message ?? "Deuda cubierta correctamente.";
            setTimeout(() => { isOpen = false; reset(); window.location.reload(); }, 1400);
        }
    });

    function handleSubmit(e?: SubmitEvent) {
        e?.preventDefault();
        if (mode === "deposit") onSubmitDeposit(e);
        else if (mode === "transfer") onSubmitTransfer(e);
        else onSubmitDebt(e);
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    return {
        get mode() { return mode; },
        get isOpen() { return isOpen; },
        set isOpen(v) { isOpen = v; },
        get serverError() { return serverError; },
        set serverError(v) { serverError = v; },
        get successMsg() { return successMsg; },
        set successMsg(v) { successMsg = v; },

        get depositForm() { return depositForm; },
        get transferForm() { return transferForm; },
        get debtForm() { return debtForm; },
        get form() { return form; },

        get isDeposit() { return isDeposit; },
        get isTransfer() { return isTransfer; },
        get isDebt() { return isDebt; },
        get amountNum() { return amountNum; },
        get balanceAfter() { return balanceAfter; },
        get wouldOverdraw() { return wouldOverdraw; },
        get gap() { return gap; },
        get coveragePct() { return coveragePct; },
        get canSubmit() { return canSubmit; },
        get selectedDestCashbox() { return selectedDestCashbox; },
        get formId() { return formId; },

        switchTab,
        open,
        close,
        reset,
        fillGap,
        handleSubmit,
        categoryName,
    };
}
