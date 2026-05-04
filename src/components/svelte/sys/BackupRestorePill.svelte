<script lang="ts">
    import { RotateCcw, FileUp, Loader2, ShieldCheck, XCircle, AlertTriangle } from "@lucide/svelte";
    import Dialog from "@/components/svelte/Dialog.svelte";

    interface Props {
        pgReady: boolean;
  }

    let { pgReady }: Props = $props();

    let isOpen = $state(false);
    let uploading = $state(false);
    let status = $state<"idle" | "success" | "error">("idle");
    let message = $state("");
    let selectedFile = $state<File | null>(null);
    let progress = $state(0);
    let confirmText = $state("");

    const CONFIRM_WORD = "RESTAURAR";
    const confirmed = $derived(confirmText.trim().toUpperCase() === CONFIRM_WORD);

    function handleOpen() {
        selectedFile = null;
        status = "idle";
        message = "";
        confirmText = "";
        progress = 0;
    }

    function handleClose() {
        if (uploading) return;
        isOpen = false;
    }

    function onFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files?.[0]) {
            selectedFile = input.files[0];
            status = "idle";
            message = "";
            confirmText = "";
        }
    }

    async function restore() {
        if (!selectedFile || uploading || !pgReady || !confirmed) return;
        uploading = true;
        status = "idle";
        message = "";
        progress = 0;

        try {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/database/db-handler.json?upload=true");

            const done = new Promise<{ success: boolean; message: string }>((resolve, reject) => {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) progress = Math.round((e.loaded / e.total) * 100);
                };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        try { reject(new Error(JSON.parse(xhr.responseText).message || "Error")); }
                        catch { reject(new Error("Upload failed")); }
                    }
                };
                xhr.onerror = () => reject(new Error("Network error"));
            });

            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("action", "upload-restore");
            xhr.send(formData);

            const data = await done;
            if (data.success) {
                status = "success";
                message = data.message;
                window.dispatchEvent(new CustomEvent("backup:created"));
            } else {
                status = "error";
                message = data.message;
            }
        } catch (err: unknown) {
            status = "error";
            message = err instanceof Error ? err.message : "Error subiendo el archivo.";
        } finally {
            uploading = false;
        }
    }
</script>

<!-- ── PILL ─────────────────────────────────────────────────────────────────── -->
<div class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm min-w-0">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
        <RotateCcw class="h-4 w-4" />
    </div>

    <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-foreground leading-none">Restaurar DB</p>
        <p class="text-xs text-muted-foreground mt-0.5">Sube un archivo .dump</p>
    </div>

    <Dialog
        bind:isOpen
        onOpen={handleOpen}
        onClose={handleClose}
        preventCloseOnInteractOutside={uploading}
        preventCloseOnEscapeKeyDown={uploading}
        size="md"
        showCloseButton={!uploading}
    >
        {#snippet trigger({ open })}
            <button
                onclick={open}
                disabled={!pgReady}
                class="shrink-0 flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700
                    bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300
                    hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
                <RotateCcw class="h-3.5 w-3.5" />
                Restaurar
            </button>
        {/snippet}

        {#snippet header()}
            <div class="flex items-center gap-3 pr-6">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <AlertTriangle class="h-5 w-5" />
                </div>
                <div>
                    <h2 class="text-base font-bold text-foreground">Restaurar Base de Datos</h2>
                    <p class="text-xs text-muted-foreground">Esta acción es irreversible</p>
                </div>
            </div>
        {/snippet}

        <!-- Body -->
        <div class="space-y-4 pt-1">
            <!-- Warning -->
            <div class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs text-red-700 dark:text-red-300 leading-relaxed">
                <strong class="block mb-1">⚠️ Advertencia importante</strong>
                Restaurar sobreescribirá <strong>todos los datos actuales</strong>. Esta operación no se puede deshacer.
            </div>

            <!-- File picker -->
            <div>
                <p class="text-xs font-medium text-foreground mb-2">Selecciona el archivo de respaldo</p>
                <label class="flex items-center gap-3 w-full rounded-lg border-2 border-dashed border-border bg-background px-4 py-3
                    cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <FileUp class="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div class="flex-1 min-w-0">
                        {#if selectedFile}
                            <p class="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                            <p class="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        {:else}
                            <p class="text-sm text-muted-foreground">Haz clic para seleccionar un archivo .dump</p>
                        {/if}
                    </div>
                    <input type="file" accept=".dump" class="hidden" onchange={onFileChange} disabled={uploading} />
                </label>
            </div>

            <!-- Typed confirmation -->
            {#if selectedFile && status === "idle"}
                <div>
                    <p class="text-xs font-medium text-foreground mb-2">
                        Escribe <span class="font-mono font-bold text-red-600 dark:text-red-400">{CONFIRM_WORD}</span> para continuar
                    </p>
                    <input
                        type="text"
                        bind:value={confirmText}
                        placeholder={CONFIRM_WORD}
                        disabled={uploading}
                        class="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono text-foreground
                            placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-red-400/50
                            focus:border-red-400 transition-colors disabled:opacity-50"
                    />
                </div>
            {/if}

            <!-- Progress bar -->
            {#if uploading}
                <div class="space-y-1.5">
                    <div class="flex justify-between text-xs text-muted-foreground">
                        <span>Subiendo y restaurando…</span>
                        <span>{progress}%</span>
                    </div>
                    <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div class="h-full rounded-full bg-primary transition-all duration-300" style="width: {progress}%"></div>
                    </div>
                </div>
            {/if}

            <!-- Result feedback -->
            {#if status !== "idle"}
                <div class="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm
                    {status === 'success'
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                        : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'}">
                    {#if status === "success"}
                        <ShieldCheck class="h-4 w-4 shrink-0 mt-0.5" />
                    {:else}
                        <XCircle class="h-4 w-4 shrink-0 mt-0.5" />
                    {/if}
                    <span>{message}</span>
                </div>
            {/if}
        </div>

        {#snippet footer({ close })}
            <button
                onclick={close}
                disabled={uploading}
                class="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground
                    hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {status === "success" ? "Cerrar" : "Cancelar"}
            </button>

            {#if status !== "success"}
                <button
                    onclick={restore}
                    disabled={!selectedFile || uploading || !confirmed}
                    class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white
                        hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {#if uploading}
                        <Loader2 class="h-4 w-4 animate-spin" />
                        Restaurando…
                    {:else}
                        <RotateCcw class="h-4 w-4" />
                        Confirmar Restauración
                    {/if}
                </button>
            {/if}
        {/snippet}
    </Dialog>
</div>
