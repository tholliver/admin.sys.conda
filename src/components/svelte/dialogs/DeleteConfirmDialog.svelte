<script lang="ts">
  import Dialog from "@/components/svelte/Dialog.svelte";
  import { actions, isInputError } from "astro:actions";
  import { Trash2, CircleAlert, CircleCheck, X, AlertTriangle } from "@lucide/svelte";

  type EntityType = "employee" | "tenant";

  interface Props {
    entityType: EntityType;
    entityId: number;
    entityName: string;
    /** Optional extra label shown in confirmation text */
    entityLabel?: string;
  }

  let { entityType, entityId, entityName, entityLabel }: Props = $props();

  let isOpen = $state(false);
  let isSubmitting = $state(false);
  let serverError = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  const labels: Record<EntityType, { title: string; desc: string; action: string; color: string }> = {
    employee: {
      title: "Dar de Baja al Empleado",
      desc: "El empleado quedará inactivo y no podrá recibir salarios. Esta acción puede revertirse editando su estado.",
      action: "Dar de Baja",
      color: "bg-red-600 hover:bg-red-700",
    },
    tenant: {
      title: "Desactivar Inquilino",
      desc: "El inquilino quedará inactivo. El historial de pagos se conserva.",
      action: "Desactivar",
      color: "bg-red-600 hover:bg-red-700",
    },
  };

  const cfg = $derived(labels[entityType]);

  async function handleDelete() {
    serverError = null;
    isSubmitting = true;
    try {
      let result: any;
      const fd = new FormData();
      fd.set("id", String(entityId));

      if (entityType === "employee") {
        result = await actions.rrhhExtra.deleteEmployee(fd);
      } else {
        result = await actions.inquilinos.deleteTenant(fd);
      }

      if (result?.error) {
        serverError = result.error.message ?? "Error al procesar la acción.";
        return;
      }
      if (result?.data?.success) {
        successMsg = result.data.message;
        setTimeout(() => {
          isOpen = false;
          window.location.reload();
        }, 1000);
      }
    } catch (err: any) {
      serverError = err?.message ?? "Error inesperado.";
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Dialog bind:isOpen size="sm" onClose={() => { serverError = null; successMsg = null; }}>
  {#snippet trigger({ open })}
    <button
      onclick={open}
      class="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors flex items-center gap-1"
      title={cfg.title}
    >
      <Trash2 class="h-3 w-3" />
    </button>
  {/snippet}

  {#if successMsg}
    <div class="flex flex-col items-center gap-3 py-6 text-center">
      <CircleCheck class="h-10 w-10 text-emerald-500" />
      <p class="font-semibold text-slate-900">{successMsg}</p>
    </div>
  {:else}
    <div class="flex flex-col gap-4">
      <!-- Icon + title -->
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-red-100 p-2 shrink-0">
          <AlertTriangle class="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-900 text-sm">{cfg.title}</h3>
          <p class="text-xs text-slate-500 mt-0.5">{entityName}{entityLabel ? ` — ${entityLabel}` : ''}</p>
        </div>
      </div>

      <p class="text-sm text-slate-600">{cfg.desc}</p>

      {#if serverError}
        <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <CircleAlert class="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p class="text-sm text-red-700">{serverError}</p>
        </div>
      {/if}

      <div class="flex gap-3 justify-end border-t border-slate-100 pt-3">
        <button
          onclick={() => (isOpen = false)}
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onclick={handleDelete}
          disabled={isSubmitting}
          class="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center gap-2 {cfg.color}"
        >
          {#if isSubmitting}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          {:else}
            <Trash2 class="h-4 w-4" />
          {/if}
          {cfg.action}
        </button>
      </div>
    </div>
  {/if}
</Dialog>
