<!-- src/components/svelte/finance/NotesAutocomplete.svelte -->
<!--
  Smart textarea with inline employee-name autocomplete.

  Strategy:
  - Employees are passed as a prop (fetched SSR in egresos.astro → zero extra request).
  - On every keystroke we detect the "current word" under the caret.
  - A compact trie built once at mount gives O(prefix-length) lookup.
  - Tab accepts the top suggestion; Arrow keys cycle; Escape closes.
-->
<script lang="ts">
  import { tick } from "svelte";

  // ── Types ────────────────────────────────────────────────────────────────
  interface Employee {
    id: number;
    fullName: string;
    chargeTitle: string;
  }

  interface Props {
    value: string;
    employees: Employee[];
    placeholder?: string;
    id?: string;
    name?: string;
    error?: string;
    onchange?: (v: string) => void;
  }

  let {
    value = $bindable(""),
    employees,
    placeholder = "Notas de la transacción…",
    id = "notes",
    name = "notes",
    error,
    onchange,
  }: Props = $props();

  // ── Trie ─────────────────────────────────────────────────────────────────
  type TrieNode = { children: Map<string, TrieNode>; hits: Employee[] };

  function newNode(): TrieNode {
    return { children: new Map(), hits: [] };
  }

  const trie: TrieNode = $derived.by(() => {
    const root = newNode();
    for (const emp of employees) {
      // Index every word in the full name so "García" matches mid-name too
      const tokens = emp.fullName.toLowerCase().split(/\s+/);
      for (const token of tokens) {
        let node = root;
        for (const ch of token) {
          if (!node.children.has(ch)) node.children.set(ch, newNode());
          node = node.children.get(ch)!;
          // Keep at most 8 candidates per node (bounded memory)
          if (node.hits.length < 8 && !node.hits.includes(emp)) {
            node.hits.push(emp);
          }
        }
      }
    }
    return root;
  });

  function searchTrie(prefix: string): Employee[] {
    if (prefix.length < 2) return [];
    let node = trie;
    for (const ch of prefix.toLowerCase()) {
      if (!node.children.has(ch)) return [];
      node = node.children.get(ch)!;
    }
    return node.hits;
  }

  // ── State ────────────────────────────────────────────────────────────────
  let textarea: HTMLTextAreaElement;
  let suggestions = $state<Employee[]>([]);
  let highlighted = $state(0);
  let showDropdown = $state(false);
  let currentWordStart = $state(0);
  let currentWordEnd = $state(0);

  // ── Caret word detection ──────────────────────────────────────────────────
  function getCurrentWord(): { word: string; start: number; end: number } {
    const pos = textarea?.selectionStart ?? 0;
    const text = value;

    let start = pos;
    while (start > 0 && !/[\s,;]/.test(text[start - 1])) start--;
    let end = pos;
    while (end < text.length && !/[\s,;]/.test(text[end])) end++;

    return { word: text.slice(start, end), start, end };
  }

  // ── Input handler ─────────────────────────────────────────────────────────
  function handleInput() {
    const { word, start, end } = getCurrentWord();
    currentWordStart = start;
    currentWordEnd = end;

    if (word.length >= 2) {
      const results = searchTrie(word);
      suggestions = results;
      highlighted = 0;
      showDropdown = results.length > 0;
    } else {
      showDropdown = false;
      suggestions = [];
    }

    onchange?.(value);
  }

  // ── Accept suggestion ─────────────────────────────────────────────────────
  async function accept(emp: Employee) {
    const before = value.slice(0, currentWordStart);
    const after  = value.slice(currentWordEnd);
    // Insert full name, add a space after if needed
    const insert = emp.fullName + (after.startsWith(" ") ? "" : " ");
    value = before + insert + after;

    showDropdown = false;
    suggestions = [];
    onchange?.(value);

    await tick();
    const newCaret = currentWordStart + insert.length;
    textarea.setSelectionRange(newCaret, newCaret);
    textarea.focus();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlighted = (highlighted + 1) % suggestions.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlighted = (highlighted - 1 + suggestions.length) % suggestions.length;
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (suggestions[highlighted]) {
        e.preventDefault();
        accept(suggestions[highlighted]);
      }
    } else if (e.key === "Escape") {
      showDropdown = false;
    }
  }

  function handleBlur() {
    // Delay so click on suggestion fires first
    setTimeout(() => { showDropdown = false; }, 150);
  }
</script>

<div class="relative">
  <label for={id} class="block text-sm font-medium text-slate-700 mb-2">
    Notas <span class="text-slate-500 text-xs">(Opcional — escribe un nombre para autocompletar)</span>
  </label>

  <textarea
    bind:this={textarea}
    {id}
    {name}
    bind:value
    oninput={handleInput}
    onkeydown={handleKeydown}
    onblur={handleBlur}
    rows="3"
    {placeholder}
    spellcheck="false"
    autocomplete="off"
    class={[
      "w-full rounded-lg border px-4 py-2.5 text-slate-900 placeholder-slate-400",
      "focus:outline-none focus:ring-2 focus:ring-red-100 transition resize-none text-sm",
      "leading-relaxed",
      error
        ? "border-red-400 focus:border-red-500"
        : "border-slate-300 focus:border-red-500",
    ].join(" ")}
  ></textarea>

  <!-- Dropdown -->
  {#if showDropdown && suggestions.length > 0}
    <ul
      role="listbox"
      class="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden"
    >
      {#each suggestions as emp, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          role="option"
          aria-selected={i === highlighted}
          onmousedown={() => accept(emp)}
          onmousemove={() => { highlighted = i; }}
          class={[
            "flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer select-none transition-colors",
            i === highlighted
              ? "bg-red-50 text-red-900"
              : "text-slate-800 hover:bg-slate-50",
          ].join(" ")}
        >
          <span class="font-medium text-sm">{emp.fullName}</span>
          <span class="text-xs text-slate-500 shrink-0">{emp.chargeTitle}</span>
        </li>
      {/each}
      <li class="px-4 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 select-none">
        Tab / Enter para aceptar · Esc para cerrar
      </li>
    </ul>
  {/if}

  {#if error}
    <p class="mt-1.5 text-xs text-red-600">{error}</p>
  {/if}
</div>
