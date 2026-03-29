<script lang="ts">
    import { X } from "@lucide/svelte";
    import type { Snippet } from "svelte";

    type DialogSize = "sm" | "md" | "lg" | "xl" | "bare";

    interface Props {
        isOpen?: boolean;
        onClose?: () => void;
        onOpen?: () => void;
        onOpenChange?: (isOpen: boolean) => void;
        trigger?: Snippet<[DialogContext]>;
        children?: Snippet;
        /** Replaces the default header. Use the header/title/description slots inside. */
        header?: Snippet<[DialogContext]>;
        /** Rendered in the footer area with bg-muted/50 + border-t chrome. */
        footer?: Snippet<[DialogContext]>;
        /** Convenience prop — auto-renders a title */
        title?: string;
        /** Convenience prop — auto-renders a description */
        description?: string;
        /** Controls panel max-width. Overlay never changes. Default: 'md' */
        size?: DialogSize;
        showCloseButton?: boolean;
        closeButtonLabel?: string;
        preventCloseOnInteractOutside?: boolean;
        preventCloseOnEscapeKeyDown?: boolean;
        testId?: string;
    }

    export interface DialogContext {
        isOpen: boolean;
        open: () => void;
        close: () => void;
        toggle: () => void;
    }

    // --- constants ---

    const sizeMap: Record<DialogSize, string> = {
        sm: "sm:max-w-sm",
        md: "sm:max-w-lg",
        lg: "sm:max-w-2xl",
        xl: "sm:max-w-4xl",
        bare: "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-auto bg-transparent border-0 shadow-none p-0",
    };

    // Overlay — fixed, never a prop. Matches real shadcn:
    // low opacity + blur guarded by supports-backdrop-filter
    const OVERLAY =
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 " +
        "bg-black/10 duration-100 p-6 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50";

    const CLOSE_BTN =
        "absolute top-2 right-2 rounded-md p-1 opacity-70 transition-opacity " +
        "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring " +
        "focus:ring-offset-2 ring-offset-background disabled:pointer-events-none";

    // Sub-component classes — inlined, no extra files needed
    const HEADER_CLS = "flex flex-col gap-2";
    const TITLE_CLS = "text-base leading-none font-medium";
    const DESCRIPTION_CLS = "text-muted-foreground text-sm";
    const CONTENT_CLS =
        "bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 " +
        "data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 flex flex-col max-w-[calc(100%-2rem)] " +
        "gap-4 rounded-xl p-4 text-sm ring-1 duration-100 fixed top-1/2 left-1/2 z-50 w-full " +
        "-translate-x-1/2 -translate-y-1/2 outline-none max-h-[calc(100vh-3rem)] overflow-hidden";
    // Bleeds to panel edges (panel is p-4), bg + border-t like shadcn
    const FOOTER_CLS =
        "bg-muted/50 -mx-4 -mb-4 mt-2 rounded-b-xl border-t p-4 " +
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end";

    // --- props ---

    let {
        isOpen = $bindable(false),
        onClose,
        onOpen,
        onOpenChange,
        trigger,
        children,
        header,
        footer,
        title,
        description,
        size = "md",
        showCloseButton = true,
        closeButtonLabel = "Close",
        preventCloseOnInteractOutside = false,
        preventCloseOnEscapeKeyDown = false,
        testId = "",
    }: Props = $props();

    // --- portal ---
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return { destroy: () => node.remove() };
    }

    // --- handlers ---
    function closeDialog() {
        if (!isOpen) return;
        isOpen = false;
        onClose?.();
        onOpenChange?.(false);
    }

    function openDialog() {
        if (isOpen) return;
        isOpen = true;
        onOpen?.();
        onOpenChange?.(true);
    }

    function toggleDialog() {
        isOpen ? closeDialog() : openDialog();
    }

    function handleOverlayClick(e: MouseEvent) {
        if (!preventCloseOnInteractOutside && e.target === e.currentTarget)
            closeDialog();
    }

    function handleEscape(e: KeyboardEvent) {
        if (!preventCloseOnEscapeKeyDown && e.key === "Escape" && isOpen)
            closeDialog();
    }

    // --- derived ---
    const isBare = $derived(size === "bare");

    const panelClass = $derived(
        [!isBare && [CONTENT_CLS, "text-foreground"].join(" "), sizeMap[size]]
            .filter(Boolean)
            .join(" "),
    );

    const dialogContext = $derived<DialogContext>({
        isOpen,
        open: openDialog,
        close: closeDialog,
        toggle: toggleDialog,
    });

    $effect(() => {
        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "";
        };
    });
</script>

{#if trigger}
    {@render trigger(dialogContext)}
{/if}

{#if isOpen}
    <!-- Overlay — never changes -->
    <div
        class={OVERLAY}
        onclick={handleOverlayClick}
        role="presentation"
        data-testid={testId ? `${testId}-overlay` : undefined}
        data-slot="dialog-overlay"
        data-open
        use:portal
    >
        <!-- Panel -->
        <div
            class={panelClass}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title && testId ? `${testId}-title` : undefined}
            data-testid={testId ? `${testId}-panel` : undefined}
            data-slot="dialog-content"
            data-open
            tabindex="-1"
        >
            {#if showCloseButton && !isBare}
                <button
                    type="button"
                    class={CLOSE_BTN}
                    onclick={closeDialog}
                    aria-label={closeButtonLabel}
                    data-testid={testId ? `${testId}-close` : undefined}
                >
                    <X class="h-4 w-4" />
                    <span class="sr-only">{closeButtonLabel}</span>
                </button>
            {/if}

            <!-- Header: snippet > title+description props > nothing -->
            {#if !isBare}
                {#if header}
                    {@render header(dialogContext)}
                {:else if title || description}
                    <div data-slot="dialog-header" class={HEADER_CLS}>
                        {#if title}
                            <h2
                                data-slot="dialog-title"
                                id={testId ? `${testId}-title` : undefined}
                                class={TITLE_CLS}
                                data-testid={testId
                                    ? `${testId}-title`
                                    : undefined}
                            >
                                {title}
                            </h2>
                        {/if}
                        {#if description}
                            <p
                                data-slot="dialog-description"
                                class={DESCRIPTION_CLS}
                                data-testid={testId
                                    ? `${testId}-description`
                                    : undefined}
                            >
                                {description}
                            </p>
                        {/if}
                    </div>
                {/if}
            {/if}

            <!-- Body -->
            <div data-slot="dialog-body" class="min-h-0 flex-1 overflow-y-auto">
                <div class="">
                    {#if children}
                        {@render children()}
                    {/if}
                </div>
            </div>

            <!-- Footer -->
            {#if !isBare && footer}
                <div data-slot="dialog-footer" class={FOOTER_CLS}>
                    {@render footer(dialogContext)}
                </div>
            {/if}
        </div>
    </div>
{/if}
