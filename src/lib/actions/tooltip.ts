// src/lib/actions/tooltip.ts

let tooltipEl: HTMLDivElement | null = null;
let arrowEl: HTMLDivElement | null = null;

const GAP = 8;

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

        arrowEl = document.createElement("div");
        arrowEl.style.cssText = `
            position: fixed;
            z-index: 9998;
            width: 0;
            height: 0;
            pointer-events: none;
            display: none;
        `;

        document.body.appendChild(tooltipEl);
        document.body.appendChild(arrowEl);
    }
    return tooltipEl;
}

function position(anchor: DOMRect, tip: HTMLDivElement, arrow: HTMLDivElement) {
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ARROW = 6; // half arrow size

    let onTop = anchor.top - th - GAP >= 8;

    let top = onTop
        ? anchor.top - th - GAP
        : anchor.bottom + GAP;

    // If bottom also overflows, prefer top anyway
    if (!onTop && top + th > vh - 8) {
        top = anchor.top - th - GAP;
        onTop = true;
    }

    let left = anchor.left + anchor.width / 2 - tw / 2;
    if (left < 8) left = 8;
    if (left + tw > vw - 8) left = vw - tw - 8;

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;

    // Arrow position: centered on anchor, pointing toward it
    const arrowLeft = anchor.left + anchor.width / 2 - ARROW;

    if (onTop) {
        // Arrow below tooltip pointing down
        arrow.style.top = `${top + th}px`;
        arrow.style.left = `${arrowLeft}px`;
        arrow.style.borderLeft = `${ARROW}px solid transparent`;
        arrow.style.borderRight = `${ARROW}px solid transparent`;
        arrow.style.borderTop = `${ARROW}px solid oklch(0.15 0.005 285)`;
        arrow.style.borderBottom = "none";
    } else {
        // Arrow above tooltip pointing up
        arrow.style.top = `${top - ARROW}px`;
        arrow.style.left = `${arrowLeft}px`;
        arrow.style.borderLeft = `${ARROW}px solid transparent`;
        arrow.style.borderRight = `${ARROW}px solid transparent`;
        arrow.style.borderBottom = `${ARROW}px solid oklch(0.15 0.005 285)`;
        arrow.style.borderTop = "none";
    }
}

export function tooltip(node: HTMLElement, content: string) {
    const tip = getTooltip();
    const arrow = arrowEl!;

    function show() {
        if (!content) return;
        tip.textContent = content;
        tip.style.display = "block";
        arrow.style.display = "block";
        requestAnimationFrame(() => position(node.getBoundingClientRect(), tip, arrow));
    }

    function hide() {
        tip.style.display = "none";
        arrow.style.display = "none";
    }

    node.addEventListener("mouseenter", show);
    node.addEventListener("mouseleave", hide);
    node.addEventListener("focus", show);
    node.addEventListener("blur", hide);

    return {
        update(newContent: string) {
            content = newContent;
        },
        destroy() {
            node.removeEventListener("mouseenter", show);
            node.removeEventListener("mouseleave", hide);
            node.removeEventListener("focus", show);
            node.removeEventListener("blur", hide);
        },
    };
}
