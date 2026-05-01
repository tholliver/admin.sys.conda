<script lang="ts">
  /**
   * BellTrigger.svelte
   * Topbar bell button — shows pending-payment count badge.
   * Hidden when totalGaps === 0.
   */
  import { tooltip } from "@/lib/actions/tooltip";

  interface Props {
    totalGaps:      number;
    periodLabel:    string;
    isOpen:         boolean;
    onToggle:       () => void;
  }

  let { totalGaps, periodLabel, isOpen, onToggle }: Props = $props();

  const triggerTooltip = $derived(
    isOpen
      ? ""
      : `${periodLabel} · ${totalGaps} pendiente${totalGaps !== 1 ? "s" : ""}`
  );
</script>

{#if totalGaps > 0}
  <button
    use:tooltip={{ content: triggerTooltip }}
    onclick={onToggle}
    class="trigger-btn"
    class:is-open={isOpen}
    aria-expanded={isOpen}
    aria-label="Ver resumen de pagos pendientes"
  >
    <svg class="trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    <span class="trigger-badge">{totalGaps > 99 ? "99+" : totalGaps}</span>
  </button>
{/if}

<style>
  .trigger-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.4rem;
    border: 1px solid oklch(0.87 0.1 25);
    background: oklch(0.96 0.05 25);
    color: oklch(0.52 0.2 25);
    cursor: pointer;
    transition: background 140ms, border-color 140ms;
    flex-shrink: 0;
  }

  .trigger-btn:hover,
  .trigger-btn.is-open { background: oklch(0.92 0.08 25); }

  .trigger-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .trigger-badge {
    position: absolute;
    top: -0.3rem;
    right: -0.3rem;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.2rem;
    border-radius: 9999px;
    background: oklch(0.52 0.2 25);
    color: white;
    font-size: 0.55rem;
    font-weight: 700;
    line-height: 1.1rem;
    text-align: center;
    pointer-events: none;
    border: 1.5px solid white;
  }
</style>
