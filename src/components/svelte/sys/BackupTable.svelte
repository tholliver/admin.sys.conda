<script lang="ts">
    import Dialog from "@/components/svelte/Dialog.svelte";
    import {
        TriangleAlert,
        CheckCircle2,
        ArrowRight,
        Lock,
        Clock,
    } from "@lucide/svelte";

    interface BackupFile {
        filename: string;
        size: number;
        created: string;
        formattedSize: string;
        formattedDate: string;
        origin: "manual" | "cron";
    }

    interface Props {
        systemInfo: {
            postgresInstalled: boolean;
        };
        initialBackupFiles: BackupFile[];
        latestFilename: string | null;
    }

    let { systemInfo, initialBackupFiles, latestFilename }: Props = $props();

    // ── State ─────────────────────────────────────────────────────────────────
    let backupFiles = $state<BackupFile[]>([]);
    let isRunning = $state(false);
    let searchQuery = $state("");
    let currentPage = $state(1);
    const PAGE_SIZE = 5;

    // Restore dialog
    let showRestoreDialog = $state(false);
    let selectedFile = $state<BackupFile | null>(null);
    let restoreConfirmWord = $state("");
    let restoreExpectedWord = $state("");
    let restoreStatusType = $state<"idle" | "loading" | "success" | "error">(
        "idle",
    );
    let restoreStatusMessage = $state("");

    // ── Derived ───────────────────────────────────────────────────────────────
    const pgReady = $derived(systemInfo.postgresInstalled);

    const filteredFiles = $derived(
        backupFiles.filter(
            (f) =>
                f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.formattedDate
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()),
        ),
    );

    const totalPages = $derived(
        Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE)),
    );

    const pagedFiles = $derived(
        filteredFiles.slice(
            (currentPage - 1) * PAGE_SIZE,
            currentPage * PAGE_SIZE,
        ),
    );

    const restoreWordMatches = $derived(
        restoreExpectedWord.length > 0 &&
            restoreConfirmWord.trim().toLowerCase() ===
                restoreExpectedWord.trim().toLowerCase(),
    );

    // Initialize backupFiles from prop and reset page on search change
    $effect(() => {
        backupFiles = [...initialBackupFiles];
    });

    // Reset page on search change
    $effect(() => {
        searchQuery;
        currentPage = 1;
    });

    // Listen for backup:created from BackupOperations to refresh list
    $effect(() => {
        function onBackupCreated() {
            refreshList();
        }
        window.addEventListener("backup:created", onBackupCreated);
        return () =>
            window.removeEventListener("backup:created", onBackupCreated);
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    const timeZone = "America/La_Paz";

    function fullDate(iso: string) {
        return new Date(iso).toLocaleDateString("es-BO", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone,
        });
    }

    function shortTime(iso: string) {
        return new Date(iso).toLocaleTimeString("es-BO", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone,
        });
    }

    function generateWord() {
        const words = [
            "nube",
            "rio",
            "sol",
            "cafe",
            "puma",
            "luna",
            "arbol",
            "sur",
        ];
        return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(100 + Math.random() * 900)}`;
    }

    async function refreshList() {
        try {
            const res = await fetch("/api/database/db-handler.json?list=true");
            if (res.ok) {
                const data = await res.json();
                if (data.files) backupFiles = data.files;
            }
        } catch {
            /* silent */
        }
    }

    // ── Restore ───────────────────────────────────────────────────────────────
    function openRestoreDialog(file: BackupFile) {
        if (!pgReady || isRunning) return;
        selectedFile = file;
        restoreConfirmWord = "";
        restoreExpectedWord = generateWord();
        restoreStatusType = "idle";
        restoreStatusMessage = "";
        showRestoreDialog = true;
    }

    function closeRestoreDialog() {
        if (isRunning) return;
        showRestoreDialog = false;
        restoreConfirmWord = "";
        selectedFile = null;
    }

    async function confirmRestore() {
        if (!restoreWordMatches || isRunning || !selectedFile) return;
        showRestoreDialog = false;

        isRunning = true;
        restoreStatusType = "loading";
        restoreStatusMessage = "Recuperando información, por favor espera…";

        const target = selectedFile;

        try {
            const res = await fetch("/api/database/db-handler.json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "restore",
                    filename: target.filename,
                }),
            });
            const data = await res.json();
            if (data.success) {
                restoreStatusType = "success";
                restoreStatusMessage = `El sistema fue recuperado al estado del ${fullDate(target.created)}.`;
            } else {
                restoreStatusType = "error";
                restoreStatusMessage = `No se pudo recuperar: ${data.message ?? "Error desconocido"}`;
            }
        } catch {
            restoreStatusType = "error";
            restoreStatusMessage =
                "Error de conexión al recuperar información.";
        } finally {
            isRunning = false;
            selectedFile = null;
            restoreConfirmWord = "";
        }
    }
</script>

<!-- ── RESTORE STATUS (shown below table after restore attempt) ────────── -->
{#if restoreStatusType !== "idle"}
    <div
        class="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm
    {restoreStatusType === 'success'
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
            : ''}
    {restoreStatusType === 'error'
            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
            : ''}
    {restoreStatusType === 'loading'
            ? 'border-border bg-muted/50 text-muted-foreground'
            : ''}"
    >
        {#if restoreStatusType === "loading"}
            <svg
                class="h-4 w-4 animate-spin shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                />
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                />
            </svg>
        {:else if restoreStatusType === "success"}
            <svg
                class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        {:else}
            <svg
                class="h-4 w-4 shrink-0 mt-0.5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
            </svg>
        {/if}
        <span>{restoreStatusMessage}</span>
    </div>
{/if}

<!-- ── HISTORY TABLE ──────────────────────────────────────────────────────── -->
<div class="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <!-- Table header with search -->
    <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-border"
    >
        <div class="flex items-center gap-2">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
            <h3 class="text-sm font-semibold text-foreground">
                Archivos de Respaldos
            </h3>
            <span
                class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
                {backupFiles.length}
            </span>
        </div>

        <div class="relative w-full sm:w-56">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Buscar respaldos…"
                class="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground
          placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
        </div>
    </div>

    <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
            <thead>
                <tr class="border-b border-border bg-muted/40">
                    <th
                        class="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >Fecha y Hora</th
                    >
                    <th
                        class="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >Origen</th
                    >
                    <th
                        class="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >Tamaño</th
                    >
                    <th
                        class="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >Archivo</th
                    >
                    <th
                        class="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right"
                        >Acciones</th
                    >
                </tr>
            </thead>
            <tbody class="divide-y divide-border">
                {#if backupFiles.length === 0}
                    <tr>
                        <td colspan="5" class="px-5 py-14 text-center">
                            <div class="flex flex-col items-center gap-3">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-10 w-10 text-muted-foreground/30"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                >
                                    <path
                                        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                                    />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <p class="text-sm text-muted-foreground">
                                    No hay respaldos todavía
                                </p>
                                <p class="text-xs text-muted-foreground/60">
                                    Usa el botón del panel izquierdo para crear
                                    tu primer respaldo
                                </p>
                            </div>
                        </td>
                    </tr>
                {:else if pagedFiles.length === 0}
                    <tr>
                        <td
                            colspan="5"
                            class="px-5 py-10 text-center text-sm text-muted-foreground"
                        >
                            Sin resultados para «{searchQuery}»
                        </td>
                    </tr>
                {:else}
                    {#each pagedFiles as file (file.filename)}
                        {@const isCron = file.origin === "cron"}
                        {@const isLatest = file.filename === latestFilename}
                        <tr class="hover:bg-muted/30 transition-colors">
                            <td class="whitespace-nowrap px-5 py-4">
                                <div class="flex flex-col">
                                    <span class="font-medium text-foreground"
                                        >{file.formattedDate}</span
                                    >
                                    <span class="text-xs text-muted-foreground"
                                        >{shortTime(file.created)}</span
                                    >
                                </div>
                            </td>

                            <td class="whitespace-nowrap px-5 py-4">
                                <span
                                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium
                  {isCron
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'}"
                                >
                                    <span
                                        class="h-1.5 w-1.5 rounded-full {isCron
                                            ? 'bg-emerald-500'
                                            : 'bg-blue-500'}"
                                    ></span>
                                    {isCron ? "Automático" : "Manual"}
                                </span>
                            </td>

                            <td
                                class="whitespace-nowrap px-5 py-4 font-mono text-sm text-muted-foreground"
                            >
                                {file.formattedSize}
                            </td>

                            <td class="px-5 py-4 max-w-50">
                                <span
                                    class="block truncate text-xs font-mono text-muted-foreground"
                                    title={file.filename}
                                >
                                    {file.filename}
                                </span>
                                {#if isLatest}
                                    <span
                                        class="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-0.5"
                                    >
                                        <span
                                            class="h-1.5 w-1.5 rounded-full bg-emerald-500"
                                        ></span>
                                        Más reciente
                                    </span>
                                {/if}
                            </td>

                            <td class="whitespace-nowrap px-5 py-4 text-right">
                                <button
                                    onclick={() => openRestoreDialog(file)}
                                    disabled={!pgReady || isRunning}
                                    class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground
                    hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-3.5 w-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                                        /><path d="M3 3v5h5" />
                                    </svg>
                                    Restaurar
                                </button>
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>

    <!-- Pagination -->
    {#if backupFiles.length > 0}
        <div
            class="flex items-center justify-between border-t border-border px-5 py-3.5"
        >
            <p class="text-xs text-muted-foreground">
                {#if filteredFiles.length === 0}
                    Sin resultados
                {:else if filteredFiles.length <= PAGE_SIZE}
                    {filteredFiles.length} respaldo{filteredFiles.length !== 1
                        ? "s"
                        : ""} en total
                {:else}
                    Mostrando <span class="font-medium"
                        >{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(
                            currentPage * PAGE_SIZE,
                            filteredFiles.length,
                        )}</span
                    >
                    de <span class="font-medium">{filteredFiles.length}</span>
                {/if}
            </p>

            {#if totalPages > 1}
                <div class="flex items-center gap-1">
                    <button
                        onclick={() =>
                            (currentPage = Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        class="flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-muted-foreground
              hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Página anterior"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>

                    {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
                        <button
                            onclick={() => (currentPage = page)}
                            class="flex h-7 min-w-7 items-center justify-center rounded border px-1.5 text-xs font-medium transition-colors
                {currentPage === page
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted'}"
                        >
                            {page}
                        </button>
                    {/each}

                    <button
                        onclick={() =>
                            (currentPage = Math.min(
                                totalPages,
                                currentPage + 1,
                            ))}
                        disabled={currentPage === totalPages}
                        class="flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-muted-foreground
              hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Página siguiente"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<!-- ── RESTORE CONFIRMATION DIALOG ───────────────────────────────────────── -->
<Dialog bind:isOpen={showRestoreDialog} onClose={closeRestoreDialog}>
    {#snippet header()}
        <div data-slot="dialog-header" class="flex items-start gap-3">
            <div
                class="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
            >
                <TriangleAlert class="h-5 w-5" />
            </div>
            <div class="flex flex-col gap-1">
                <h2
                    data-slot="dialog-title"
                    class="text-base leading-none font-medium text-foreground"
                >
                    Confirmar restauración
                </h2>
                <p
                    data-slot="dialog-description"
                    class="text-sm text-muted-foreground"
                >
                    Verifica manualmente antes de restaurar la información
                </p>
            </div>
        </div>
    {/snippet}
    {#snippet children()}
        <div class="max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
            <div class="space-y-5">
                <div class="relative flex justify-center">
                    <div
                        class="absolute inset-0 rounded-full bg-linear-to-br from-violet-500/20 to-fuchsia-500/20 blur-2xl"
                    ></div>
                    <div
                        class="relative rounded-full border border-border bg-card p-5 shadow-xl"
                    >
                        <Lock
                            class="h-8 w-8 text-violet-600 dark:text-violet-400"
                        />
                    </div>
                </div>

                <div class="space-y-1 text-center">
                    <h3 class="text-xl font-bold text-foreground">
                        Restaurar a este punto
                    </h3>
                    <p class="text-sm text-muted-foreground">
                        Verifica tu identidad para continuar con la restauración
                    </p>
                </div>

                <div
                    class="rounded-r-lg border-l-4 border-red-500 bg-red-50 dark:bg-red-950/30 p-4"
                >
                    <div class="flex items-start gap-2">
                        <TriangleAlert
                            class="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-400"
                        />
                        <div class="space-y-1">
                            <p class="text-sm font-semibold text-foreground">
                                Advertencia importante
                            </p>
                            <ul class="space-y-1 text-xs text-muted-foreground">
                                <li>• Esta acción es irreversible</li>
                                <li>• Reemplazará todos los datos actuales</li>
                                <li>• No podrá ser deshecha</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {#if selectedFile}
                    <div class="space-y-2 rounded-lg bg-muted/50 p-4">
                        <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                            Copia seleccionada
                        </p>
                        <p class="break-all text-sm font-mono text-foreground">
                            {selectedFile.filename}
                        </p>
                        <p
                            class="flex items-center gap-1 pt-1 text-xs text-muted-foreground"
                        >
                            <Clock class="h-3.5 w-3.5" />
                            {fullDate(selectedFile.created)} · {selectedFile.formattedSize}
                        </p>
                    </div>
                {/if}

                <div class="space-y-2">
                    <label
                        for="restore-word"
                        class="block text-sm font-semibold text-foreground"
                    >
                        Confirmación de seguridad
                    </label>
                    <p class="text-xs text-muted-foreground">
                        Escribe la siguiente palabra:
                        <span class="font-mono font-bold text-primary"
                            >{restoreExpectedWord}</span
                        >
                    </p>
                    <div class="relative">
                        <input
                            id="restore-word"
                            type="text"
                            bind:value={restoreConfirmWord}
                            autocomplete="off"
                            placeholder="Ingresa la palabra de confirmación…"
                            class="w-full rounded-lg border-2 border-border bg-input px-4 py-3 text-sm text-foreground
              placeholder:text-muted-foreground focus:border-violet-500 focus:outline-none transition-colors"
                        />
                        {#if restoreConfirmWord}
                            <div
                                class="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <CheckCircle2
                                    class="h-5 w-5 {restoreWordMatches
                                        ? 'text-emerald-500'
                                        : 'text-destructive'}"
                                />
                            </div>
                        {/if}
                    </div>
                    {#if restoreConfirmWord && !restoreWordMatches}
                        <p class="text-xs text-destructive">
                            La confirmación no coincide. Intenta de nuevo.
                        </p>
                    {/if}
                    {#if restoreWordMatches}
                        <p
                            class="text-xs text-emerald-600 dark:text-emerald-400"
                        >
                            Confirmación verificada ✓
                        </p>
                    {/if}
                </div>

                <p class="text-center text-xs text-muted-foreground">
                    Por tu seguridad, esta acción requiere confirmación manual.
                </p>
            </div>
        </div>
    {/snippet}

    {#snippet footer({ close })}
        <button
            type="button"
            onclick={close}
            disabled={isRunning}
            class="w-full sm:w-auto rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground
        transition-colors hover:bg-muted disabled:opacity-50"
        >
            Cancelar
        </button>
        <button
            type="button"
            onclick={confirmRestore}
            disabled={isRunning || !restoreWordMatches}
            class="w-full sm:w-auto rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all
        {restoreWordMatches
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'}"
        >
            {#if isRunning}
                <svg
                    class="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    />
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                    />
                </svg>
                Restaurando…
            {:else}
                Confirmar restauración
                <ArrowRight class="h-4 w-4" />
            {/if}
        </button>
    {/snippet}
</Dialog>
