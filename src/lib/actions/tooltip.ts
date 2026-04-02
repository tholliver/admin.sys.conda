// src/lib/actions/tooltip.ts

let tooltipEl: HTMLDivElement | null = null;

const GAP = 8;

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipParams {
    content: string;
    side?: TooltipSide;
}

function getTooltip(): HTMLDivElement {
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.style.cssText = `
            position: fixed;
            z-index: 9999;
            padding: 0.3rem 0.65rem;
            font-size: 0.75rem;
            font-weight: 600;
            color: oklch(0.98 0 0);
            background: oklch(0.15 0.005 285);
            border-radius: 0.375rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            pointer-events: none;
            white-space: nowrap;
            display: none;
        `;
        document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
}

function position(anchor: DOMRect, tip: HTMLDivElement, side: TooltipSide) {
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;

    if (side === "right") {
        top = anchor.top + anchor.height / 2 - th / 2;
        left = anchor.right + GAP;
    } else if (side === "left") {
        top = anchor.top + anchor.height / 2 - th / 2;
        left = anchor.left - tw - GAP;
    } else if (side === "bottom") {
        top = anchor.bottom + GAP;
        left = anchor.left + anchor.width / 2 - tw / 2;
    } else {
        // top (default) — fallback to bottom if no room
        top = anchor.top - th - GAP;
        if (top < 8) top = anchor.bottom + GAP;
        left = anchor.left + anchor.width / 2 - tw / 2;
    }

    // Clamp to viewport
    top  = Math.max(8, Math.min(top,  vh - th - 8));
    left = Math.max(8, Math.min(left, vw - tw - 8));

    tip.style.top  = `${top}px`;
    tip.style.left = `${left}px`;
}

export function tooltip(node: HTMLElement, params: TooltipParams | string) {
    const tip = getTooltip();

    let content: string;
    let side: TooltipSide;

    function parseParams(p: TooltipParams | string) {
        if (typeof p === "string") {
            content = p;
            side = "top";
        } else {
            content = p.content;
            side = p.side ?? "top";
        }
    }

    parseParams(params);

    function show() {
        if (!content) return;
        tip.textContent = content;
        tip.style.display = "block";
        requestAnimationFrame(() => position(node.getBoundingClientRect(), tip, side));
    }

    function hide() {
        tip.style.display = "none";
    }

    node.addEventListener("mouseenter", show);
    node.addEventListener("mouseleave", hide);
    node.addEventListener("focus", show);
    node.addEventListener("blur", hide);

    return {
        update(newParams: TooltipParams | string) {
            parseParams(newParams);
        },
        destroy() {
            node.removeEventListener("mouseenter", show);
            node.removeEventListener("mouseleave", hide);
            node.removeEventListener("focus", show);
            node.removeEventListener("blur", hide);
        },
    };
}
