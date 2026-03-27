import { dismiss, subscribe, type ToastItem } from "./index";

type MountOptions = {
  position: string;
  richColors: boolean;
  visibleToasts: number;
  closeButton: boolean;
  offset: string;
  className: string;
};

const ROOT_ATTR = "data-plain-toaster-root";
const STYLE_ID = "plain-toaster-style";
const GAP = 14;
const TOAST_WIDTH = 356;
const SWIPE_THRESHOLD = 20;
const DEFAULT_DURATION = 4000;

const ICONS: Record<string, string> = {
  success:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>',
  error:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>',
  warning:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>',
  info:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>',
  loading:
    '<svg class="plain-toast-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
};

const CLOSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
[data-plain-toaster-root]{position:fixed;z-index:9999;width:${TOAST_WIDTH}px;max-width:calc(100vw - 2rem)}
[data-plain-toaster-root][data-x-position="left"]{left:max(var(--offset),env(safe-area-inset-left))}
[data-plain-toaster-root][data-x-position="center"]{left:50%;transform:translateX(-50%)}
[data-plain-toaster-root][data-x-position="right"]{right:max(var(--offset),env(safe-area-inset-right))}
[data-plain-toaster-root][data-y-position="top"]{top:max(var(--offset),env(safe-area-inset-top))}
[data-plain-toaster-root][data-y-position="bottom"]{bottom:max(var(--offset),env(safe-area-inset-bottom))}

[data-plain-toaster-root] ol{list-style:none;margin:0;padding:0;position:relative;transition:height .4s cubic-bezier(.21,1.02,.73,1)}
[data-plain-toaster-root] ol li{position:absolute;inset-inline:0;bottom:0;transform-origin:center bottom;transition:transform .4s cubic-bezier(.21,1.02,.73,1),opacity .4s ease}
[data-plain-toaster-root][data-y-position="top"] ol li{top:0;bottom:auto;transform-origin:center top}

[data-plain-toaster-root] .plain-toast{position:relative;display:flex;align-items:flex-start;gap:.6rem;width:${TOAST_WIDTH}px;max-width:calc(100vw - 2rem);padding:.9rem 1rem;border-radius:.75rem;font-size:.875rem;line-height:1.4;background:var(--pt-bg,hsl(0,0%,100%));color:var(--pt-fg,hsl(0,0%,9%));border:1px solid hsl(0,0%,91%);box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 1px rgba(0,0,0,.04);cursor:default;pointer-events:auto;user-select:none;touch-action:none;box-sizing:border-box;overflow:hidden;transition:transform .4s cubic-bezier(.21,1.02,.73,1),opacity .4s ease,box-shadow .2s,background .2s}
[data-plain-toaster-root] .plain-toast[data-removed="true"]{transition:transform .5s cubic-bezier(.06,.71,.55,1),opacity .5s ease}
[data-plain-toaster-root] .plain-toast[data-swiping="true"]{transition:none!important}

/* Stacked back-card shadow peek when collapsed */
[data-plain-toaster-root] ol li:nth-child(2) .plain-toast{box-shadow:0 2px 8px rgba(0,0,0,.07),0 0 0 1px rgba(0,0,0,.04)}
[data-plain-toaster-root] ol li:nth-child(3) .plain-toast{box-shadow:0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.03)}

.plain-toast .pt-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.05rem;width:16px;height:16px}
.plain-toast .pt-icon svg{width:100%;height:100%}
.plain-toast--success .pt-icon{color:#2a9d5c}
.plain-toast--error .pt-icon{color:#e5484d}
.plain-toast--warning .pt-icon{color:#e5a50a}
.plain-toast--info .pt-icon{color:#006adc}
.plain-toast--loading .pt-icon{color:hsl(0,0%,40%)}

.plain-toast .pt-body{flex:1;min-width:0}
.plain-toast .pt-title{font-weight:500;color:inherit;margin:0}
.plain-toast .pt-desc{margin:.2rem 0 0;color:hsl(0,0%,40%);font-size:.8rem;line-height:1.4}

.plain-toast--success[data-rich-colors="true"]{background:hsl(143,72%,95%);border-color:hsl(143,72%,80%);color:hsl(143,55%,20%)}
.plain-toast--success[data-rich-colors="true"] .pt-desc{color:hsl(143,40%,35%)}
.plain-toast--error[data-rich-colors="true"]{background:hsl(358,100%,97%);border-color:hsl(358,80%,88%);color:hsl(358,65%,30%)}
.plain-toast--error[data-rich-colors="true"] .pt-desc{color:hsl(358,50%,40%)}
.plain-toast--warning[data-rich-colors="true"]{background:hsl(48,100%,95%);border-color:hsl(48,85%,78%);color:hsl(35,75%,25%)}
.plain-toast--warning[data-rich-colors="true"] .pt-desc{color:hsl(35,55%,38%)}
.plain-toast--info[data-rich-colors="true"]{background:hsl(215,100%,97%);border-color:hsl(215,80%,85%);color:hsl(215,65%,25%)}
.plain-toast--info[data-rich-colors="true"] .pt-desc{color:hsl(215,50%,38%)}

.plain-toast .pt-action{margin-left:auto;flex-shrink:0;padding:.25rem .65rem;border-radius:.45rem;border:1px solid hsl(0,0%,80%);background:transparent;font-size:.8rem;font-weight:500;cursor:pointer;color:inherit;line-height:1.4;white-space:nowrap;transition:background .15s}
.plain-toast .pt-action:hover{background:hsl(0,0%,95%)}
.plain-toast .pt-close{position:absolute;top:-.35rem;left:-.35rem;width:1.25rem;height:1.25rem;display:grid;place-items:center;border-radius:50%;border:1px solid hsl(0,0%,85%);background:hsl(0,0%,100%);cursor:pointer;opacity:0;transition:opacity .2s;color:hsl(0,0%,30%);padding:0;z-index:1}
.plain-toast:hover .pt-close,.plain-toast:focus-within .pt-close{opacity:1}
.plain-toast .pt-close:hover{background:hsl(0,0%,93%)}

.plain-toast .pt-progress{position:absolute;bottom:0;left:0;height:3px;background:hsl(0,0%,75%);border-radius:0 0 0 .75rem}
.plain-toast--success .pt-progress{background:hsl(143,55%,55%)}
.plain-toast--error .pt-progress{background:hsl(358,65%,58%)}
.plain-toast--warning .pt-progress{background:hsl(35,85%,52%)}
.plain-toast--info .pt-progress{background:hsl(215,65%,52%)}
.plain-toast--success[data-rich-colors="true"] .pt-progress{background:hsl(143,55%,32%)}
.plain-toast--error[data-rich-colors="true"] .pt-progress{background:hsl(358,65%,38%)}
.plain-toast--warning[data-rich-colors="true"] .pt-progress{background:hsl(35,75%,32%)}
.plain-toast--info[data-rich-colors="true"] .pt-progress{background:hsl(215,65%,32%)}

@keyframes plain-toast-spin{to{transform:rotate(360deg)}}
.plain-toast-spin{animation:plain-toast-spin .8s linear infinite}

@keyframes pt-enter-top{0%{transform:translateY(-100%) scale(.94);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
@keyframes pt-enter-bottom{0%{transform:translateY(100%) scale(.94);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
@keyframes pt-leave-right{0%{transform:translateX(0);opacity:1}to{transform:translateX(110%);opacity:0}}
@keyframes pt-leave-left{0%{transform:translateX(0);opacity:1}to{transform:translateX(-110%);opacity:0}}
@keyframes pt-leave-up{0%{transform:translateY(0) scale(1);opacity:1}to{transform:translateY(-30%) scale(.9);opacity:0}}
@keyframes pt-leave-down{0%{transform:translateY(0) scale(1);opacity:1}to{transform:translateY(30%) scale(.9);opacity:0}}

.plain-toast[data-entering="true"]{animation-fill-mode:both;animation-duration:.35s;animation-timing-function:cubic-bezier(.21,1.02,.73,1)}
[data-y-position="top"] .plain-toast[data-entering="true"]{animation-name:pt-enter-top}
[data-y-position="bottom"] .plain-toast[data-entering="true"]{animation-name:pt-enter-bottom}

.plain-toast[data-removed="true"]{pointer-events:none}
[data-y-position="top"] .plain-toast[data-swiped-direction="up"]{animation:pt-leave-up .35s cubic-bezier(.06,.71,.55,1) both}
[data-y-position="top"] .plain-toast[data-swiped-direction="down"]{animation:pt-leave-down .35s cubic-bezier(.06,.71,.55,1) both}
[data-y-position="bottom"] .plain-toast[data-swiped-direction="down"]{animation:pt-leave-down .35s cubic-bezier(.06,.71,.55,1) both}
[data-y-position="bottom"] .plain-toast[data-swiped-direction="up"]{animation:pt-leave-up .35s cubic-bezier(.06,.71,.55,1) both}
.plain-toast[data-swiped-direction="left"]{animation:pt-leave-left .35s cubic-bezier(.06,.71,.55,1) both}
.plain-toast[data-swiped-direction="right"]{animation:pt-leave-right .35s cubic-bezier(.06,.71,.55,1) both}

@media(max-width:480px){[data-plain-toaster-root]{width:calc(100vw - 2rem)}.plain-toast{width:calc(100vw - 2rem)}}
`;
  document.head.appendChild(style);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toastHtml(t: ToastItem, richColors: boolean, closeButton: boolean): string {
  const icon = ICONS[t.type] ? `<span class="pt-icon">${ICONS[t.type]}</span>` : "";
  const desc = t.description ? `<p class="pt-desc">${escapeHtml(String(t.description))}</p>` : "";
  const action = t.action
    ? `<button class="pt-action" data-act="${String(t.id)}">${escapeHtml(t.action.label)}</button>`
    : "";
  const close = closeButton
    ? `<button class="pt-close" data-close="${String(t.id)}" aria-label="Close">${CLOSE_ICON}</button>`
    : "";
  const typeClass = t.type ? ` plain-toast--${t.type}` : "";
  const richAttr = richColors ? ` data-rich-colors="true"` : "";
  const duration = typeof (t as any).duration === "number" ? (t as any).duration : DEFAULT_DURATION;
  const showProgress = t.type !== "loading" && duration !== Infinity;
  const progress = showProgress
    ? `<div class="pt-progress" style="width:100%" data-duration="${duration}"></div>`
    : "";

  return `<li class="plain-toast${typeClass}" data-id="${String(t.id)}" data-entering="true"${richAttr}>${close}${icon}<div class="pt-body"><p class="pt-title">${escapeHtml(t.message)}</p>${desc}</div>${action}${progress}</li>`;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function startProgress(li: HTMLElement) {
  const bar = li.querySelector<HTMLElement>(".pt-progress");
  if (!bar) return;
  const duration = Number(bar.dataset.duration ?? DEFAULT_DURATION);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = `width ${duration}ms linear`;
      bar.style.width = "0%";
    });
  });
}

function pauseProgress(li: HTMLElement) {
  const bar = li.querySelector<HTMLElement>(".pt-progress");
  if (!bar) return;
  const computedPx = getComputedStyle(bar).width;
  bar.style.transition = "none";
  bar.style.width = computedPx;
}

function resumeProgress(li: HTMLElement) {
  const bar = li.querySelector<HTMLElement>(".pt-progress");
  if (!bar) return;
  const totalWidth = li.getBoundingClientRect().width;
  if (!totalWidth) return;
  const currentPx = parseFloat(getComputedStyle(bar).width);
  const remainingPct = currentPx / totalWidth;
  const duration = Number(bar.dataset.duration ?? DEFAULT_DURATION);
  const remainingMs = remainingPct * duration;
  requestAnimationFrame(() => {
    bar.style.transition = `width ${remainingMs}ms linear`;
    bar.style.width = "0%";
  });
}

// ─── Restack ──────────────────────────────────────────────────────────────────

function restackToasts(ol: HTMLElement, visibleToasts: number, yPos: string) {
  const alive = Array.from(
    ol.querySelectorAll<HTMLElement>(".plain-toast:not([data-removed='true'])")
  );
  alive.forEach((item, i) => {
    item.style.marginBottom = "";
    item.style.position = "absolute";
    item.style.insetInline = "0";
    item.style.top = yPos === "top" ? "0" : "";
    item.style.bottom = yPos === "bottom" ? "0" : "";
    const scale = 1 - i * 0.05;
    const translateY = i * (yPos === "bottom" ? -GAP : GAP);
    item.style.transform = `translateY(${translateY}px) scale(${scale})`;
    item.style.opacity = i >= visibleToasts - 1 ? "0" : String(1 - i * 0.1);
    item.style.zIndex = String(visibleToasts - i);
  });
  requestAnimationFrame(() => {
    const front = alive[0];
    ol.style.height = front ? `${front.getBoundingClientRect().height}px` : "0px";
  });
}

// ─── Swipe ────────────────────────────────────────────────────────────────────

function setupSwipe(li: HTMLLIElement, id: string, yPos: string, xPos: string) {
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let deltaY = 0;
  let axis: "x" | "y" | null = null;
  let swiping = false;

  function onPointerDown(e: PointerEvent) {
    const root = li.closest<HTMLElement>("[data-plain-toaster-root]");
    root?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    startX = e.clientX;
    startY = e.clientY;
    deltaX = 0;
    deltaY = 0;
    axis = null;
    swiping = true;
    li.setPointerCapture(e.pointerId);
    li.dataset.swiping = "true";
  }

  function onPointerMove(e: PointerEvent) {
    if (!swiping) return;
    deltaX = e.clientX - startX;
    deltaY = e.clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!axis && (absX > 5 || absY > 5)) {
      axis = absX >= absY ? "x" : "y";
    }

    if (axis === "x") {
      // Outward = away from the anchor edge.
      // left-anchored  → right (positive) is inward, left (negative) is outward
      // right-anchored → left (negative) is inward, right (positive) is outward
      // center         → both sides are "outward" (dismiss either way)
      const leftRect  = li.getBoundingClientRect().left;
      const rightRect = li.getBoundingClientRect().right;
      const vw        = window.innerWidth;

      // Determine if we're moving toward the center of the screen
      let isInward: boolean;
      if (xPos === "left") {
        isInward = deltaX > 0; // dragging right = toward center
      } else if (xPos === "right") {
        isInward = deltaX < 0; // dragging left = toward center
      } else {
        // center: inward = whichever direction keeps toast inside viewport
        isInward = false; // center toasts dismiss both ways
      }

      let visualX: number;
      if (isInward) {
        // Very strong resistance — feels like a wall, max ~6px travel
        visualX = deltaX / (1 + absX * 0.35);
        li.style.transform = `translateX(${visualX}px)`;
        li.style.opacity = "1";
      } else {
        visualX = deltaX;
        li.style.transform = `translateX(${visualX}px)`;
        // Start fading once the toast edge is near/past the viewport edge
        const offscreen = xPos === "right"
          ? Math.max(0, vw - rightRect + absX)
          : Math.max(0, leftRect - absX);
        li.style.opacity = String(Math.max(0, 1 - absX / 200));
      }

    } else if (axis === "y") {
      // Only allow dragging away from the anchor edge
      const isInward = yPos === "top" ? deltaY > 0 : deltaY < 0;
      if (isInward) {
        // Wall resistance
        const visualY = deltaY / (1 + Math.abs(deltaY) * 0.35);
        li.style.transform = `translateY(${visualY}px)`;
        li.style.opacity = "1";
      } else {
        li.style.transform = `translateY(${deltaY}px)`;
        li.style.opacity = String(Math.max(0, 1 - Math.abs(deltaY) / 120));
      }
    }
  }

  function onPointerUp() {
    if (!swiping) return;
    swiping = false;
    delete li.dataset.swiping;
    li.style.transform = "";
    li.style.opacity = "";

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (axis === "x" && absX > SWIPE_THRESHOLD) {
      let isInward: boolean;
      if (xPos === "left")       isInward = deltaX > 0;
      else if (xPos === "right") isInward = deltaX < 0;
      else                       isInward = false; // center: both dismiss

      if (!isInward) {
        li.dataset.swipedDirection = deltaX > 0 ? "right" : "left";
        setTimeout(() => dismiss(id), 320);
      }
      // Inward always snaps back — no dismiss ever

    } else if (axis === "y" && absY > SWIPE_THRESHOLD) {
      const isInward = yPos === "top" ? deltaY > 0 : deltaY < 0;
      if (!isInward) {
        li.dataset.swipedDirection = deltaY < 0 ? "up" : "down";
        setTimeout(() => dismiss(id), 320);
      }
      // Inward vertical snaps back too
    }
    axis = null;
  }

  li.addEventListener("pointerdown", onPointerDown);
  li.addEventListener("pointermove", onPointerMove);
  li.addEventListener("pointerup", onPointerUp);
  li.addEventListener("pointercancel", onPointerUp);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render(root: HTMLElement, toasts: ToastItem[], opts: MountOptions) {
  const yPos = opts.position.startsWith("bottom") ? "bottom" : "top";
  const visible = toasts.slice(0, opts.visibleToasts);

  const ol = root.querySelector<HTMLElement>("ol") ?? (() => {
    const o = document.createElement("ol");
    root.appendChild(o);
    return o;
  })();

  root.querySelectorAll<HTMLElement>(".plain-toast").forEach((el) => {
    const id = el.dataset.id!;
    if (!visible.find((t) => String(t.id) === id) && !el.dataset.removed) {
      el.dataset.removed = "true";
      setTimeout(() => {
        el.remove();
        const isExpanded = root.matches(":hover") || root.matches(":focus-within");
        const alive = Array.from(
          ol.querySelectorAll<HTMLElement>(".plain-toast:not([data-removed='true'])")
        );
        if (isExpanded) {
          // Immediately re-lay-out remaining toasts so no gap is left
          alive.forEach((item, i) => {
            item.style.position = "relative";
            item.style.insetInline = "";
            item.style.top = "";
            item.style.bottom = "";
            item.style.transform = "none";
            item.style.opacity = "1";
            item.style.zIndex = String(opts.visibleToasts - i);
            item.style.marginBottom = i < alive.length - 1 ? `${GAP}px` : "0";
          });
          ol.style.height = "";
        } else {
          restackToasts(ol, opts.visibleToasts, yPos);
        }
      }, 400);
    }
  });

  visible.forEach((t, i) => {
    const id = String(t.id);
    let li = ol.querySelector<HTMLLIElement>(`[data-id="${id}"]`);

    if (!li) {
      const tmp = document.createElement("div");
      tmp.innerHTML = toastHtml(t, opts.richColors, opts.closeButton);
      li = tmp.firstElementChild as HTMLLIElement;
      if (yPos === "bottom") ol.prepend(li);
      else ol.append(li);

      setTimeout(() => { if (li) delete li!.dataset.entering; }, 400);
      setTimeout(() => { if (li) startProgress(li!); }, 50);

      setupSwipe(li, id, yPos, opts.position.split("-")[1]);
      li.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", () => dismiss(id));
      li.querySelector<HTMLButtonElement>("[data-act]")?.addEventListener("click", () => t?.action?.onClick());
    }

    const isExpanded = root.matches(":hover") || root.matches(":focus-within");

    if (isExpanded) {
      li.style.position = "relative";
      li.style.insetInline = "";
      li.style.top = "";
      li.style.bottom = "";
      li.style.transform = "none";
      li.style.opacity = "1";
      li.style.zIndex = String(opts.visibleToasts - i);
      li.style.marginBottom = i < visible.length - 1 ? `${GAP}px` : "0";
    } else {
      li.style.position = "absolute";
      li.style.insetInline = "0";
      li.style.top = yPos === "top" ? "0" : "";
      li.style.bottom = yPos === "bottom" ? "0" : "";
      li.style.marginBottom = "";
      const scale = 1 - i * 0.05;
      const translateY = i * (yPos === "bottom" ? -GAP : GAP);
      li.style.transform = `translateY(${translateY}px) scale(${scale})`;
      li.style.opacity = i >= opts.visibleToasts - 1 ? "0" : String(1 - i * 0.1);
      li.style.zIndex = String(opts.visibleToasts - i);
    }
  });

  if (!root.matches(":hover") && !root.matches(":focus-within")) {
    const front = ol.querySelector<HTMLElement>(".plain-toast:not([data-removed='true'])");
    requestAnimationFrame(() => {
      ol.style.height = front ? `${front.getBoundingClientRect().height}px` : "0px";
    });
  } else {
    ol.style.height = "";
  }
}

// ─── Mount ────────────────────────────────────────────────────────────────────

export function mountPlainToaster(host: HTMLElement) {
  if (typeof window === "undefined") return;
  ensureStyle();

  const [yPos, xPos] = (host.dataset.position || "top-center").split("-");

  const opts: MountOptions = {
    position: host.dataset.position || "top-center",
    richColors: host.dataset.richColors === "true",
    visibleToasts: Number(host.dataset.visibleToasts || "3"),
    closeButton: host.dataset.closeButton === "true",
    offset: host.dataset.offset || "1rem",
    className: host.dataset.className || "",
  };

  let root = host.querySelector<HTMLElement>(`[${ROOT_ATTR}]`);

  // isFirstMount = root doesn't exist yet.
  // With transition:persist the host survives navigation so root stays in DOM —
  // we must NOT re-add event listeners on subsequent mounts or they stack up.
  const isFirstMount = !root;

  if (isFirstMount) {
    root = document.createElement("section");
    root.setAttribute(ROOT_ATTR, "1");
    root.setAttribute("aria-label", "Notifications");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-relevant", "additions text");
    host.appendChild(root);
  }

  const r = root!;
  r.dataset.yPosition = yPos;
  r.dataset.xPosition = xPos;
  r.style.setProperty("--offset", opts.offset);
  if (opts.className) r.className = opts.className;

  if (isFirstMount) {
    // Only register pointer listeners once — they survive transition:persist
    r.addEventListener("pointerenter", () => {
      r.querySelectorAll<HTMLElement>(".plain-toast:not([data-removed='true'])").forEach((li) => {
        li.style.position = "relative";
        li.style.insetInline = "";
        li.style.top = "";
        li.style.bottom = "";
        li.style.transform = "none";
        li.style.opacity = "1";
        li.style.marginBottom = `${GAP}px`;
        pauseProgress(li);
      });
      const ol = r.querySelector<HTMLElement>("ol");
      if (ol) ol.style.height = "";
    });

    r.addEventListener("pointerleave", () => {
      const ol = r.querySelector<HTMLElement>("ol");
      if (!ol) return;
      ol.querySelectorAll<HTMLElement>(".plain-toast:not([data-removed='true'])").forEach((li) => {
        resumeProgress(li);
      });
      restackToasts(ol, opts.visibleToasts, yPos);
    });

    // Pause all timers when tab is hidden or window loses focus, resume when back
    const pauseAll = () => {
      r.querySelectorAll<HTMLElement>(".plain-toast:not([data-removed='true'])").forEach(pauseProgress);
    };
    const resumeAll = () => {
      // Only resume if mouse is not currently over the toaster
      if (!r.matches(":hover")) {
        r.querySelectorAll<HTMLElement>(".plain-toast:not([data-removed='true'])").forEach(resumeProgress);
      }
    };

    document.addEventListener("visibilitychange", () => {
      document.hidden ? pauseAll() : resumeAll();
    });
    window.addEventListener("blur", pauseAll);
    window.addEventListener("focus", resumeAll);
  }

  // Always re-subscribe — old sub is cleaned up via the unsub map
  const unsub = subscribe((toasts) => render(r, toasts, opts));

  const w = window as unknown as { __plain_toaster_unsubs__?: Map<HTMLElement, () => void> };
  if (!w.__plain_toaster_unsubs__) w.__plain_toaster_unsubs__ = new Map();
  const prev = w.__plain_toaster_unsubs__.get(host);
  if (prev) prev();
  w.__plain_toaster_unsubs__.set(host, unsub);
}
