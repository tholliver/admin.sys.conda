<script lang="ts">
  /**
   * BackupTrigger.svelte
   * Topbar DB icon button — shows a coloured alert when backup is stale.
   * Hidden when backupLevel === null.
   */
  import { tooltip } from "@/lib/actions/tooltip";

  interface Props {
    backupLevel: "warning" | "critical" | null;
    backupLabel: string;
    isOpen:      boolean;
    onToggle:    () => void;
  }

  let { backupLevel, backupLabel, isOpen, onToggle }: Props = $props();
</script>

{#if backupLevel}
  <button
    use:tooltip={{ content: backupLabel }}
    onclick={onToggle}
    class="trigger-btn"
    class:trigger-btn--critical={backupLevel === "critical"}
    class:trigger-btn--warning={backupLevel === "warning"}
    class:is-open={isOpen}
    aria-expanded={isOpen}
    aria-label="Estado del respaldo"
  >
    <!-- DB / cylinder icon -->
    <svg class="trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
    </svg>
    <!-- Alert dot -->
    <span
      class="alert-dot"
      class:alert-dot--warning={backupLevel === "warning"}
      class:alert-dot--critical={backupLevel === "critical"}
    ></span>
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
    border: 1px solid transparent;
    cursor: pointer;
    transition: background 140ms, border-color 140ms;
    flex-shrink: 0;
  }

  .trigger-btn--warning {
    background: oklch(0.97 0.05 85);
    border-color: oklch(0.88 0.1 85);
    color: oklch(0.55 0.18 75);
  }
  .trigger-btn--warning:hover,
  .trigger-btn--warning.is-open { background: oklch(0.93 0.08 85); }

  .trigger-btn--critical {
    background: oklch(0.96 0.05 25);
    border-color: oklch(0.87 0.1 25);
    color: oklch(0.52 0.2 25);
  }
  .trigger-btn--critical:hover,
  .trigger-btn--critical.is-open { background: oklch(0.92 0.08 25); }

  .trigger-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  /* Coloured notification dot on the icon */
  .alert-dot {
    position: absolute;
    top: -0.25rem;
    right: -0.25rem;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 9999px;
    border: 1.5px solid white;
    pointer-events: none;
  }

  .alert-dot--warning  { background: oklch(0.72 0.18 75); }
  .alert-dot--critical { background: oklch(0.52 0.2 25); }
</style>
