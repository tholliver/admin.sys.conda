<script lang="ts">
    interface QuickAmountPreset {
        label: string;
        value: string;
        testid: string;
    }

    interface Props {
        amount: string;
        onSelectAmount: (value: string) => void;
        title?: string;
        activeClass: string;
        inactiveClass: string;
        presets?: QuickAmountPreset[];
    }

    const DEFAULT_PRESETS: QuickAmountPreset[] = [
        { label: "Bs 50", value: "50", testid: "quick-amount-50" },
        { label: "Bs 100", value: "100", testid: "quick-amount-100" },
        { label: "Bs 500", value: "500", testid: "quick-amount-500" },
        { label: "Bs 1.000", value: "1000", testid: "quick-amount-1000" },
        { label: "Bs 5.000", value: "5000", testid: "quick-amount-5000" },
    ];

    let {
        amount,
        onSelectAmount,
        title = "Montos Rápidos",
        activeClass,
        inactiveClass,
        presets = DEFAULT_PRESETS,
    }: Props = $props();
</script>

<div class="mt-3">
    <span class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
        {title}
    </span>
    <div class="flex flex-wrap gap-2">
        {#each presets as preset (preset.value)}
            <button
                type="button"
                onclick={() => onSelectAmount(preset.value)}
                data-testid={preset.testid}
                class={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all duration-150 ${
                    amount === preset.value ? activeClass : inactiveClass
                }`}
            >
                {preset.label}
            </button>
        {/each}
    </div>
</div>
