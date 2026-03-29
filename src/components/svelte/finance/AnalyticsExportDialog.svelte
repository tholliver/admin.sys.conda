<script lang="ts">
    import {
        FileSpreadsheet,
        Download,
        Calendar,
        Filter,
        CheckCircle2,
        TrendingUp,
        TrendingDown,
        BarChart3,
        AlertCircle,
        LoaderCircle,
    } from "@lucide/svelte";
    import { tick } from "svelte";
    import Dialog from "@/components/svelte/Dialog.svelte";

    interface ReportOption {
        id: string;
        name: string;
        description: string;
        icon: any;
    }

    const REPORT_OPTIONS: ReportOption[] = [
        {
            id: "monthly_summary",
            name: "Resumen Mensual",
            description: "Ingresos, egresos y balance del mes actual",
            icon: Calendar,
        },
        {
            id: "top_income",
            name: "Top Ingresos por Categoría",
            description: "Las cuentas con mayores ingresos",
            icon: TrendingUp,
        },
        {
            id: "top_outcome",
            name: "Top Egresos por Categoría",
            description: "Las cuentas con mayores gastos",
            icon: TrendingDown,
        },
        {
            id: "monthly_trend",
            name: "Tendencia de 6 Meses",
            description: "Comparación mensual de flujo de caja",
            icon: BarChart3,
        },
        {
            id: "all_transactions",
            name: "Todas las Transacciones",
            description: "Listado completo con filtros de fecha",
            icon: Filter,
        },
    ];

    let isOpen = $state(false);
    let selectedReport = $state<string | null>(null);
    let isLoading = $state(false);
    let errorMessage = $state<string | null>(null);
    let successMessage = $state<string | null>(null);

    // Date range for all_transactions report
    let startDate = $state("");
    let endDate = $state("");
    let dateRangeSection: HTMLDivElement | null = null;
    let startDateInput: HTMLInputElement | null = null;
    let endDateInput: HTMLInputElement | null = null;

    function openDialog() {
        isOpen = true;
        selectedReport = null;
        errorMessage = null;
        successMessage = null;

        // Set default dates (current month)
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startDate = start.toISOString().split("T")[0];
        endDate = end.toISOString().split("T")[0];
    }

    function closeDialog() {
        isOpen = false;
        selectedReport = null;
        errorMessage = null;
        successMessage = null;
    }

    async function selectReport(reportId: string) {
        selectedReport = reportId;
        errorMessage = null;

        if (reportId === "all_transactions") {
            await tick();
            startDateInput?.focus({ preventScroll: true });
        }
    }

    async function downloadReport() {
        if (!selectedReport) {
            errorMessage = "Debe seleccionar un tipo de reporte";
            return;
        }

        // Validate dates for all_transactions report
        if (selectedReport === "all_transactions") {
            if (!startDate || !endDate) {
                errorMessage = "Debe seleccionar un rango de fechas";
                return;
            }
            if (new Date(startDate) > new Date(endDate)) {
                errorMessage =
                    "La fecha inicial no puede ser mayor a la fecha final";
                return;
            }
        }

        isLoading = true;
        errorMessage = null;
        successMessage = null;

        try {
            // Build query params
            const params = new URLSearchParams({
                reportType: selectedReport,
            });

            if (selectedReport === "all_transactions") {
                params.append("startDate", startDate);
                params.append("endDate", endDate);
            }

            // Call API endpoint
            // C:\Users\Sol\Documents\ville.docs\sys.conda\src\pages\api\finance\analytics.json.ts
            const response = await fetch(
                `/api/finance/analytics.json?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    },
                },
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message || "Error al generar el reporte",
                );
            }

            // Download file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;

            // Generate filename
            const reportName =
                REPORT_OPTIONS.find((r) => r.id === selectedReport)?.name ||
                "Reporte";
            const timestamp = new Date().toISOString().split("T")[0];
            link.setAttribute("download", `${reportName}_${timestamp}.xlsx`);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            successMessage = "Reporte descargado exitosamente";

            // Auto close after success
            setTimeout(() => {
                closeDialog();
            }, 2000);
        } catch (error) {
            console.error("Error downloading report:", error);
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Error al descargar el reporte";
        } finally {
            isLoading = false;
        }
    }
</script>

<!-- Trigger Button -->
<button
    type="button"
    onclick={openDialog}
    class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
>
    <FileSpreadsheet class="h-4 w-4" />
    <span>Exportar a Excel</span>
</button>

<!-- Dialog -->
{#if isOpen}
    <Dialog bind:isOpen onClose={closeDialog} size="lg">
        {#snippet header()}
            <div data-slot="dialog-header" class="flex items-start gap-3">
                <div
                    class="mt-0.5 h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"
                >
                    <FileSpreadsheet class="h-5 w-5 text-emerald-600" />
                </div>
                <div class="flex flex-col gap-1">
                    <h2
                        data-slot="dialog-title"
                        class="text-base leading-none font-medium text-foreground"
                    >
                        Exportar Reporte
                    </h2>
                    <p
                        data-slot="dialog-description"
                        class="text-sm text-muted-foreground"
                    >
                        Seleccione el tipo de análisis a descargar
                    </p>
                </div>
            </div>
        {/snippet}

        {#snippet children()}
            <div class="max-h-[calc(100vh-18rem)] overflow-y-auto pr-1 pb-4">
                <div class="space-y-4">
                    <!-- Success Message -->
                    {#if successMessage}
                        <div
                            class="flex items-center gap-3 rounded-lg bg-emerald-50 p-4 border border-emerald-200"
                        >
                            <CheckCircle2
                                class="h-5 w-5 text-emerald-600 shrink-0"
                            />
                            <p class="text-sm text-emerald-800 font-medium">
                                {successMessage}
                            </p>
                        </div>
                    {/if}

                    <!-- Error Message -->
                    {#if errorMessage}
                        <div
                            class="flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-200"
                        >
                            <AlertCircle
                                class="h-5 w-5 text-red-600 shrink-0 mt-0.5"
                            />
                            <div class="flex-1">
                                <p class="text-sm text-red-800 font-medium">
                                    Error
                                </p>
                                <p class="text-sm text-red-700">
                                    {errorMessage}
                                </p>
                            </div>
                        </div>
                    {/if}

                    <!-- Report Options -->
                    <div class="space-y-3">
                        <label
                            for="report-type"
                            class="block text-sm font-medium text-slate-700"
                        >
                            Tipo de Reporte
                        </label>
                        <div class="grid gap-3">
                            {#each REPORT_OPTIONS as option (option.id)}
                                <button
                                    type="button"
                                    onclick={() => selectReport(option.id)}
                                    class={`text-left rounded-lg border-2 p-4 transition-all hover:border-emerald-300 hover:bg-emerald-50 ${
                                        selectedReport === option.id
                                            ? "border-emerald-500 bg-emerald-50"
                                            : "border-slate-200"
                                    }`}
                                >
                                    <div class="flex items-start gap-3">
                                        <div
                                            class={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                                                selectedReport === option.id
                                                    ? "bg-emerald-100"
                                                    : "bg-slate-100"
                                            }`}
                                        >
                                            {#if option.icon}
                                                {@const Icon = option.icon}
                                                <Icon
                                                    class={`h-5 w-5 ${
                                                        selectedReport ===
                                                        option.id
                                                            ? "text-emerald-600"
                                                            : "text-slate-600"
                                                    }`}
                                                />
                                            {/if}
                                        </div>
                                        <div class="flex-1">
                                            <p
                                                class={`font-medium ${
                                                    selectedReport === option.id
                                                        ? "text-emerald-900"
                                                        : "text-slate-900"
                                                }`}
                                            >
                                                {option.name}
                                            </p>
                                            <p
                                                class="text-sm text-slate-600 mt-1"
                                            >
                                                {option.description}
                                            </p>
                                        </div>
                                        {#if selectedReport === option.id}
                                            <CheckCircle2
                                                class="h-5 w-5 text-emerald-600 shrink-0"
                                            />
                                        {/if}
                                    </div>
                                </button>
                            {/each}
                        </div>
                    </div>

                    <!-- Date Range (for all_transactions) -->
                    {#if selectedReport === "all_transactions"}
                        <div
                            bind:this={dateRangeSection}
                            class="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200"
                        >
                            <p class="text-sm font-medium text-slate-700">
                                Rango de Fechas
                            </p>
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        for="startDate"
                                        class="block text-sm text-slate-600 mb-2"
                                    >
                                        Fecha Inicial
                                    </label>
                                    <input
                                        id="startDate"
                                        type="date"
                                        bind:this={startDateInput}
                                        bind:value={startDate}
                                        class="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 date-input-icon"
                                    />
                                </div>
                                <div>
                                    <label
                                        for="endDate"
                                        class="block text-sm text-slate-600 mb-2"
                                    >
                                        Fecha Final
                                    </label>
                                    <input
                                        id="endDate"
                                        type="date"
                                        bind:this={endDateInput}
                                        bind:value={endDate}
                                        class="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 date-input-icon"
                                    />
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/snippet}

        {#snippet footer({ close })}
            <button
                type="button"
                onclick={close}
                disabled={isLoading}
                class="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Cancelar
            </button>
            <button
                type="button"
                onclick={downloadReport}
                disabled={!selectedReport || isLoading}
                class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {#if isLoading}
                    <LoaderCircle class="h-4 w-4 animate-spin" />
                    <span>Generando...</span>
                {:else}
                    <Download class="h-4 w-4" />
                    <span>Descargar Excel</span>
                {/if}
            </button>
        {/snippet}
    </Dialog>
{/if}

<style>
    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes slide-in-from-top-2 {
        from {
            transform: translateY(-0.5rem);
        }
        to {
            transform: translateY(0);
        }
    }

    .animate-in {
        animation:
            fade-in 0.2s ease-out,
            slide-in-from-top-2 0.2s ease-out;
    }

    .date-input-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        background-size: 16px 16px;
    }
</style>
