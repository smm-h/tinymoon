// tinymoon -- tooltip: plain-text-only singleton tooltip. Any element with
// data-tooltip gets a themed tooltip on hover (250ms intent delay) or focus
// (immediate for keyboard users). The tooltip is non-interactive
// (pointer-events: none) -- rich content belongs in hovercards. Native title
// attributes are banned in tinymoon UIs; use data-tooltip.

import { el } from "./dom.js";
import { pushLayer, placeBelow } from "./kernel.js";

let tipEl = null;
let tipShowTimer = 0;
let tipHideTimer = 0;
let tipTarget = null;
let removeLayer = null;

let tipIdCounter = 0;

// ensureTooltip() -> the singleton tooltip element, created on first use.
export function ensureTooltip() {
  if (!tipEl) {
    tipEl = el("div");
    tipEl.id = "tm-tooltip";
    tipEl.setAttribute("role", "tooltip");
    // Hidden until shown -- prevents axe from flagging an empty role="tooltip".
    tipEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function showTip(target) {
  const text = target.dataset.tooltip;
  if (!text) return;
  const t = ensureTooltip();
  // Plain text only -- no markdown, no HTML.
  t.textContent = text;
  // Stable id for aria-describedby.
  tipIdCounter += 1;
  t.id = "tm-tooltip-" + tipIdCounter;
  target.setAttribute("aria-describedby", t.id);
  // Position after content is set: below the anchor, flipped above when the
  // viewport bottom (or the footer slot) would clip it, clamped horizontally.
  t.style.left = "0px";
  t.style.top = "0px";
  placeBelow(target, t);
  t.classList.add("show");
  t.removeAttribute("aria-hidden");
  tipTarget = target;
  // Register in the kernel layer stack so Escape dismisses the tooltip.
  if (removeLayer) removeLayer();
  removeLayer = pushLayer(() => hideTip());
}

export function hideTip() {
  clearTimeout(tipShowTimer);
  clearTimeout(tipHideTimer);
  if (tipTarget) {
    tipTarget.removeAttribute("aria-describedby");
  }
  tipTarget = null;
  if (tipEl) {
    tipEl.classList.remove("show");
    tipEl.setAttribute("aria-hidden", "true");
  }
  if (removeLayer) { removeLayer(); removeLayer = null; }
}

function scheduleTipHide() {
  clearTimeout(tipShowTimer);
  clearTimeout(tipHideTimer);
  tipHideTimer = setTimeout(hideTip, 300);
}

// --- pointer-based triggers ---

document.addEventListener("pointerover", (e) => {
  const target = e.target.closest ? e.target.closest("[data-tooltip]") : null;
  if (target === tipTarget) {
    if (target) clearTimeout(tipHideTimer);
    return;
  }
  if (!target) {
    if (tipTarget) scheduleTipHide();
    return;
  }
  clearTimeout(tipShowTimer);
  clearTimeout(tipHideTimer);
  if (tipEl) tipEl.classList.remove("show");
  if (tipTarget) tipTarget.removeAttribute("aria-describedby");
  tipTarget = target;
  tipShowTimer = setTimeout(() => {
    if (tipTarget === target && target.isConnected) showTip(target);
  }, 250);
});

document.addEventListener("pointerdown", () => {
  hideTip();
}, true);

document.addEventListener("scroll", () => {
  hideTip();
}, true);

window.addEventListener("blur", () => hideTip());

// --- focus-based triggers (keyboard users) ---

document.addEventListener("focusin", (e) => {
  const target = e.target.closest ? e.target.closest("[data-tooltip]") : null;
  if (!target || target === tipTarget) return;
  hideTip();
  tipTarget = target;
  // Show immediately on focus -- no delay for keyboard users.
  if (target.isConnected) showTip(target);
});

document.addEventListener("focusout", (e) => {
  const target = e.target.closest ? e.target.closest("[data-tooltip]") : null;
  if (target && target === tipTarget) {
    hideTip();
  }
});
