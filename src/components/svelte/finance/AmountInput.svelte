<script lang="ts">
    import { fade } from "svelte/transition";
    import { CircleCheck, CircleAlert } from "@lucide/svelte";
    import { ENV } from "@/config/env";
    import { formatBOB } from "@/utils/formatters";

    interface QuickPreset {
        label: string;
        value: string;
        testid?: string;
    }

    interface Props {
        value: string;
        accentColor?: "green" | "red";
        name?: string;
        id?: string;
        error?: string | null;
        testid?: string;
        presets?: QuickPreset[];
        onChange?: (v: string) => void;
        max?: number;
    }

    const DEFAULT_PRESETS: QuickPreset[] = [
        { label: "Bs 50",    value: "50",   testid: "quick-amount-50"   },
        { label: "Bs 100",   value: "100",  testid: "quick-amount-100"  },
        { label: "Bs 500",   value: "500",  testid: "quick-amount-500"  },
        { label: "Bs 1.000", value: "1000", testid: "quick-amount-1000" },
        { label: "Bs 5.000", value: "5000", testid: "quick-amount-5000" },
    ];

    function getDefaultMax(accentColor: "green" | "red") {
        return accentColor === "green"
            ? ENV.TRANSACTION_LIMITS.DEPOSIT_MAX
            : ENV.TRANSACTION_LIMITS.WITHDRAWAL_MAX;
    }

    let {
        value = $bindable(""),
        accentColor = "green",
        name = "amount",
        id = "amount",
        error = null,
        testid,
        presets = DEFAULT_PRESETS,
        onChange,
        max = getDefaultMax(accentColor),
    }: Props = $props();

    // ── Colour tokens ────────────────────────────────────────────────────────
    const C = $derived(
        accentColor === "green"
            ? {
                  focusBorder: "border-2 border-green-400",
                  idle:        "border-slate-200",
                  confirm:     "bg-green-50 border-green-200 text-green-900",
                  confirmIcon: "text-green-600",
                  chipActive:  "bg-green-600 border-green-600 text-white shadow-sm",
                  chipIdle:    "bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700 hover:bg-green-50 active:bg-green-100",
                  cursor:      "#16a34a",
                  segHover:    "hover:bg-green-50/60",
              }
            : {
                  focusBorder: "border-2 border-red-400",
                  idle:        "border-slate-200",
                  confirm:     "bg-red-50 border-red-200 text-red-900",
                  confirmIcon: "text-red-600",
                  chipActive:  "bg-red-600 border-red-600 text-white shadow-sm",
                  chipIdle:    "bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 active:bg-red-100",
                  cursor:      "#dc2626",
                  segHover:    "hover:bg-red-50/60",
              }
    );

    // ── State ────────────────────────────────────────────────────────────────
    type Seg = "enteros" | "decimals";
    let activeSeg      = $state<Seg | null>(null);
    let enterosDigits  = $state("0");   // raw digits, no separators, e.g. "1234"
    let decimalsDigits = $state("00");  // always 2 chars, e.g. "47"
    let cursorPos      = $state(0);     // logical index within the ACTIVE segment
    let enterosDisplayEl: HTMLSpanElement | undefined = $state();
    let decimalsDisplayEl: HTMLSpanElement | undefined = $state();

    // ── Derived ──────────────────────────────────────────────────────────────
    const enterosDisplay = $derived(
        parseInt(enterosDigits, 10).toLocaleString("es-BO")
    );
    const numericRaw = $derived(
        parseFloat(`${enterosDigits || "0"}.${decimalsDigits || "00"}`)
    );
    const hasValue = $derived(numericRaw > 0);
    const enterosFontSize = $derived.by(() => {
        const length = enterosDisplay.length;
        if (length <= 6) return "clamp(1.75rem,5vw,2.5rem)";
        if (length <= 9) return "clamp(1.5rem,4vw,2.1rem)";
        if (length <= 12) return "clamp(1.2rem,3.1vw,1.7rem)";
        return "clamp(1rem,2.5vw,1.35rem)";
    });
    const decimalsFontSize = $derived.by(() => {
        const length = enterosDisplay.length;
        if (length <= 9) return "clamp(1.1rem,3vw,1.5rem)";
        if (length <= 12) return "clamp(0.95rem,2.3vw,1.2rem)";
        return "clamp(0.85rem,2vw,1rem)";
    });

    // ── Cursor split ─────────────────────────────────────────────────────────
    // Maps raw-digit cursor index → formatted-string index (skips separators)
    function splitEnteros(): [string, string] {
        const fmt = enterosDisplay;
        let rawIdx = 0, fmtIdx = 0;
        while (rawIdx < cursorPos && fmtIdx < fmt.length) {
            if (/\d/.test(fmt[fmtIdx])) rawIdx++;
            fmtIdx++;
        }
        return [fmt.slice(0, fmtIdx), fmt.slice(fmtIdx)];
    }

    function splitDecimals(): [string, string] {
        const p = Math.min(Math.max(cursorPos, 0), 2);
        return [decimalsDigits.slice(0, p), decimalsDigits.slice(p)];
    }

    function clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    function replaceDigitAt(digits: string, index: number, nextDigit: string) {
        return digits.slice(0, index) + nextDigit + digits.slice(index + 1);
    }

    function getCursorFromClientX(
        clientX: number,
        element: HTMLElement | undefined,
        digitCount: number
    ) {
        if (!element || digitCount <= 0) return digitCount;

        const rect = element.getBoundingClientRect();
        const relativeX = clamp(clientX - rect.left, 0, rect.width);
        const slotWidth = rect.width / digitCount;

        if (!Number.isFinite(slotWidth) || slotWidth <= 0) return digitCount;

        return clamp(Math.round(relativeX / slotWidth), 0, digitCount);
    }

    function getEnterosCursorFromClientX(clientX: number) {
        return getCursorFromClientX(clientX, enterosDisplayEl, enterosDigits.length);
    }

    function getDecimalsCursorFromClientX(clientX: number) {
        return getCursorFromClientX(clientX, decimalsDisplayEl, 2);
    }

    function syncFromNumericString(nextValue: string) {
        const num = parseFloat(nextValue);
        if (!Number.isFinite(num) || num <= 0) {
            enterosDigits = "0";
            decimalsDigits = "00";
            cursorPos = 0;
            return;
        }

        const clampedNum = Math.min(num, max);
        const [intPart, decPart = "00"] = clampedNum.toFixed(2).split(".");
        enterosDigits = String(parseInt(intPart, 10));
        decimalsDigits = decPart.padEnd(2, "0").slice(0, 2);
        cursorPos = Math.min(cursorPos, enterosDigits.length);
    }

    // ── Sync from external value ─────────────────────────────────────────────
    let _lastExternal = "";
    $effect(() => {
        if (value === _lastExternal) return;
        _lastExternal = value;
        syncFromNumericString(value);
        cursorPos = enterosDigits.length;
    });

    // ── Focus helpers ────────────────────────────────────────────────────────
    let enterosInput:  HTMLInputElement | undefined = $state();
    let decimalsInput: HTMLInputElement | undefined = $state();

    function focusSeg(seg: Seg, pos?: number) {
        activeSeg = seg;
        if (seg === "enteros") {
            cursorPos = pos ?? enterosDigits.length;
            enterosInput?.focus();
        } else {
            cursorPos = pos ?? 2;
            decimalsInput?.focus();
        }
    }

    function handleEnterosPointerDown(e: MouseEvent) {
        e.preventDefault();
        focusSeg("enteros", getEnterosCursorFromClientX(e.clientX));
    }

    function handleDecimalsPointerDown(e: MouseEvent) {
        e.preventDefault();
        focusSeg("decimals", getDecimalsCursorFromClientX(e.clientX));
    }

    function onBlur() {
        setTimeout(() => {
            if (
                document.activeElement !== enterosInput &&
                document.activeElement !== decimalsInput
            ) {
                activeSeg = null;
            }
        }, 80);
    }

    // ── Commit ───────────────────────────────────────────────────────────────
    function commitValue() {
        const full    = parseFloat(`${enterosDigits || "0"}.${decimalsDigits}`);
        const clamped = Math.min(full, max);
        const next    = clamped > 0 ? clamped.toFixed(2) : "";
        syncFromNumericString(next);
        _lastExternal = next;
        value         = next;
        onChange?.(next);
    }

    // ── Enteros keyboard ─────────────────────────────────────────────────────
    function handleEnterosKey(e: KeyboardEvent) {
        e.preventDefault();

        switch (e.key) {
            case "ArrowRight":
                if (cursorPos < enterosDigits.length) cursorPos++;
                else focusSeg("decimals", 0);
                return;

            case "ArrowLeft":
                if (cursorPos > 0) cursorPos--;
                return;

            case "ArrowUp":
            case "ArrowDown":
                return;

            case "Tab":
                focusSeg("decimals", e.shiftKey ? 2 : 0);
                return;

            case ".":
            case ",":
                focusSeg("decimals", 0);
                return;

            case "Backspace": {
                if (cursorPos === 0) return;
                const d    = enterosDigits;
                const next = (d.slice(0, cursorPos - 1) + d.slice(cursorPos)).replace(/^0+/, "") || "0";
                enterosDigits = next;
                cursorPos     = Math.max(0, cursorPos - 1);
                commitValue();
                return;
            }

            case "Delete": {
                if (cursorPos >= enterosDigits.length) return;
                const d    = enterosDigits;
                const next = (d.slice(0, cursorPos) + d.slice(cursorPos + 1)).replace(/^0+/, "") || "0";
                enterosDigits = next;
                // cursorPos stays — same position, char to the right was deleted
                commitValue();
                return;
            }

            default: {
                if (!/^\d$/.test(e.key)) return;
                const d    = enterosDigits === "0" ? "" : enterosDigits;
                const next = (d.slice(0, cursorPos) + e.key + d.slice(cursorPos)).replace(/^0+/, "") || "0";
                enterosDigits = next;
                cursorPos     = cursorPos + 1;
                commitValue();
            }
        }
    }

    // ── Decimals keyboard ────────────────────────────────────────────────────
    // Decimals are ALWAYS exactly 2 digits ("00".."99").
    // Cursor positions: 0 = before d[0], 1 = between d[0] and d[1], 2 = after d[1]
    //
    // INSERT: overwrite the digit at the cursor and advance
    //   e.g. "47", cursor=1, press "9" → "49", cursor=2
    //
    // BACKSPACE: zero the digit LEFT of cursor and move left
    //   e.g. "47", cursor=2, Backspace → "40", cursor=1
    //
    // DELETE: zero the digit AT cursor and keep the cursor in place
    //   e.g. "47", cursor=0, Delete → "07", cursor=0
    //
    // This keeps cents as a fixed 2-slot overwrite field, which is predictable
    // when users are correcting one decimal without wanting digits to shift.
    function handleDecimalsKey(e: KeyboardEvent) {
        e.preventDefault();

        switch (e.key) {
            case "ArrowLeft":
                if (cursorPos > 0) cursorPos--;
                else focusSeg("enteros", enterosDigits.length);
                return;

            case "ArrowRight":
                if (cursorPos < 2) cursorPos++;
                return;

            case "ArrowUp":
            case "ArrowDown":
                return;

            case "Tab":
                if (e.shiftKey) focusSeg("enteros", enterosDigits.length);
                return;

            case "Backspace": {
                if (cursorPos === 0) {
                    focusSeg("enteros", enterosDigits.length);
                    return;
                }

                const nextPos = cursorPos - 1;
                decimalsDigits = replaceDigitAt(decimalsDigits, nextPos, "0");
                cursorPos = nextPos;
                commitValue();
                return;
            }

            case "Delete": {
                if (cursorPos >= 2) return;

                decimalsDigits = replaceDigitAt(decimalsDigits, cursorPos, "0");
                commitValue();
                return;
            }

            default: {
                if (!/^\d$/.test(e.key)) return;
                // Overwrite digit at cursorPos, advance cursor (capped at 2)
                const d = decimalsDigits;
                decimalsDigits = (d.slice(0, cursorPos) + e.key + d.slice(cursorPos + 1)).slice(0, 2);
                cursorPos = Math.min(cursorPos + 1, 2);
                commitValue();
            }
        }
    }

    // ── Quick chips ──────────────────────────────────────────────────────────
    function selectPreset(v: string) {
        const num = parseFloat(v);
        const clamped = Number.isFinite(num) ? Math.min(num, max) : 0;
        const next = clamped > 0 ? clamped.toFixed(2) : "";

        syncFromNumericString(next);
        _lastExternal = next;
        value = next;
        onChange?.(next);
        cursorPos = enterosDigits.length;
    }
</script>

<div>
    <!-- Hidden real input for form submission -->
    <input
        type="number"
        {name}
        {id}
        bind:value
        {max}
        step="0.01"
        tabindex="-1"
        aria-hidden="true"
        data-testid={testid}
        style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;"
    />

    <!-- Big display -->
    <div
        class="focus-ring-field relative flex items-center rounded-xl transition-all duration-200 select-none overflow-hidden
               {error
                   ? 'border-red-500 ring-2 ring-red-100'
                   : activeSeg
                     ? C.focusBorder
                     : C.idle}"
        style="min-height:64px; background:#fff;"
    >
        <span class="shrink-0 pl-4 pr-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Bs.
        </span>

        <!-- ── Enteros segment ── -->
        <button
            type="button"
            onmousedown={handleEnterosPointerDown}
            class="flex min-w-0 flex-1 items-center justify-end py-3 pr-1
                   rounded-none transition-colors duration-100 {C.segHover}"
            aria-label="Editar parte entera"
            tabindex="-1"
        >
            {#if activeSeg === "enteros"}
                {@const [left, right] = splitEnteros()}
                <span
                    bind:this={enterosDisplayEl}
                    class="block max-w-full overflow-hidden text-right font-bold tabular-nums leading-none whitespace-nowrap"
                    style="font-size:{enterosFontSize}; color:{hasValue ? 'inherit' : '#cbd5e1'};"
                >{left}<span
                        class="inline-block animate-[blink_1s_step-end_infinite] rounded-sm"
                        style="width:2px; height:1.8rem; background:{C.cursor}; vertical-align:bottom; margin-bottom:2px;"
                    ></span>{right}</span>
            {:else}
                <span
                    bind:this={enterosDisplayEl}
                    class="block max-w-full overflow-hidden text-right font-bold tabular-nums leading-none whitespace-nowrap"
                    style="font-size:{enterosFontSize}; color:{hasValue ? 'inherit' : '#cbd5e1'};"
                >{enterosDisplay}</span>
            {/if}
        </button>

        <!-- Separator comma -->
        <span
            class="font-bold text-slate-400"
            style="font-size:{enterosFontSize}; line-height:1;"
        >,</span>

        <!-- ── Decimals segment ── -->
        <button
            type="button"
            onmousedown={handleDecimalsPointerDown}
            class="flex min-w-16 items-center py-3 pl-1 pr-4 rounded-none transition-colors duration-100 {C.segHover}"
            aria-label="Editar centavos"
            tabindex="-1"
        >
            {#if activeSeg === "decimals"}
                {@const [left, right] = splitDecimals()}
                <span
                    bind:this={decimalsDisplayEl}
                    class="block overflow-hidden font-bold tabular-nums leading-none whitespace-nowrap"
                    style="font-size:{decimalsFontSize}; color:{hasValue ? '#64748b' : '#cbd5e1'}; padding-bottom:0.15rem;"
                >{left}<span
                        class="inline-block animate-[blink_1s_step-end_infinite] rounded-sm"
                        style="width:2px; height:1.4rem; background:{C.cursor}; vertical-align:bottom; margin-bottom:1px;"
                    ></span>{right}</span>
            {:else}
                <span
                    bind:this={decimalsDisplayEl}
                    class="block overflow-hidden font-bold tabular-nums leading-none whitespace-nowrap"
                    style="font-size:{decimalsFontSize}; color:{hasValue ? '#64748b' : '#cbd5e1'}; padding-bottom:0.15rem;"
                >{decimalsDigits}</span>
            {/if}
        </button>

        <!-- Invisible keyboard-capture inputs -->
        <input
            bind:this={enterosInput}
            type="text"
            inputmode="numeric"
            autocomplete="off"
            aria-hidden="true"
            onkeydown={handleEnterosKey}
            onblur={onBlur}
            style="position:absolute;opacity:0;width:1px;height:1px;left:0;top:0;"
        />
        <input
            bind:this={decimalsInput}
            type="text"
            inputmode="numeric"
            autocomplete="off"
            aria-hidden="true"
            onkeydown={handleDecimalsKey}
            onblur={onBlur}
            style="position:absolute;opacity:0;width:1px;height:1px;left:0;top:0;"
        />
    </div>

    <!-- Confirmation badge -->
    {#if hasValue && !error}
        <div
            in:fade={{ duration: 200 }}
            data-testid="amount-confirmation-badge"
            class="mt-2 w-full flex items-center justify-between px-4 py-2 border rounded-lg {C.confirm}"
        >
            <div class="flex items-center gap-2">
                <CircleCheck class="w-4 h-4 shrink-0 {C.confirmIcon}" />
                <span class="text-sm font-medium">Monto ingresado</span>
            </div>
            <span class="text-base font-bold">{formatBOB(value)}</span>
        </div>
    {/if}

    <!-- Quick chips -->
    <!-- <div class="mt-3">
        <span class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Montos Rápidos
        </span>
        <div class="flex flex-wrap gap-2">
            {#each presets as preset (preset.value)}
                <button
                    type="button"
                    onclick={() => selectPreset(preset.value)}
                    data-testid={preset.testid}
                    class="px-3 py-1.5 text-xs font-semibold rounded-md border transition-all duration-150
                           {value === preset.value ? C.chipActive : C.chipIdle}"
                >{preset.label}</button>
            {/each}
        </div>
    </div> -->

    <!-- Error -->
    {#if error}
        <p data-testid="amount-input-error" class="mt-2 text-sm text-red-600 flex items-center gap-1">
            <CircleAlert class="h-4 w-4" />{error}
        </p>
    {/if}
</div>

<style>
    @keyframes blink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0; }
    }
</style>
