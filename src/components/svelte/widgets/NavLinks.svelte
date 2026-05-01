<script lang="ts">
  /**
   * NavLinks.svelte
   * Quick-nav anchor buttons for the topbar (Egresos / Ingresos).
   * Extracted from GenerateDebtsWidget so anchors live in their own component.
   */
  import { tooltip } from "@/lib/actions/tooltip";
</script>

<a
  href="/egresos"
  class="nav-link nav-link--egreso"
  use:tooltip={{ content: "Ir a Egresos" }}
  aria-label="Ir a Egresos"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7"/>
  </svg>
</a>

<a
  href="/ingresos"
  class="nav-link nav-link--ingreso"
  use:tooltip={{ content: "Ir a Ingresos" }}
  aria-label="Ir a Ingresos"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 5v14M19 12l-7 7-7-7"/>
  </svg>
</a>

<style>
  .nav-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.4rem;
    border: 1px solid transparent;
    text-decoration: none;
    transition: background 140ms, border-color 140ms;
    flex-shrink: 0;
  }

  .nav-link svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .nav-link--egreso {
    background: oklch(0.96 0.05 25);
    border-color: oklch(0.87 0.1 25);
    color: oklch(0.52 0.2 25);
  }
  .nav-link--egreso:hover { background: oklch(0.92 0.08 25); }

  .nav-link--ingreso {
    background: oklch(0.96 0.05 150);
    border-color: oklch(0.87 0.1 150);
    color: oklch(0.45 0.18 150);
  }
  .nav-link--ingreso:hover { background: oklch(0.92 0.08 150); }
</style>
