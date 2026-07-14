// tinymoon — global custom tooltip singleton: any element with data-tooltip
// gets a themed tooltip (250ms intent delay, 150ms fade-in, smart
// positioning that avoids viewport and footer overflow). Tooltip text is
// mini-markdown (renderMiniMd) so tooltips can teach — bold, code, and
// clickable [links](#/...) into the app. A hover bridge keeps the tooltip
// open while the pointer travels from the trigger to the tooltip (300ms
// grace), so links and the copy icon are reachable. Native title attributes
// are banned in tinymoon UIs — use data-tooltip.

import { el } from "./dom.js";
import { copyButton } from "./controls.js";
import { renderMiniMd } from "./markdown.js";
import { placeBelow } from "./kernel.js";

let tipEl = null;
let tipBody = null;
let tipShowTimer = 0;
let tipHideTimer = 0;
let tipTarget = null;

// ensureTooltip() → the singleton tooltip element, created on first use.
export function ensureTooltip() {
  if (!tipEl) {
    tipEl = el("div");
    tipEl.id = "tm-tooltip";
    tipEl.setAttribute("role", "tooltip");
    tipBody = el("div", "tip-body");
    tipEl.appendChild(tipBody);
    tipEl.appendChild(copyButton(() => tipBody.textContent, "Copy this tooltip's text"));
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function showTip(target) {
  const text = target.dataset.tooltip;
  if (!text) return;
  const t = ensureTooltip();
  tipBody.textContent = "";
  tipBody.appendChild(renderMiniMd(text));
  // Position after content is set: below the anchor, flipped above when the
  // viewport bottom (or the footer slot) would clip it, clamped horizontally.
  t.style.left = "0px";
  t.style.top = "0px";
  placeBelow(target, t);
  t.classList.add("show");
}

export function hideTip() {
  clearTimeout(tipShowTimer);
  clearTimeout(tipHideTimer);
  tipTarget = null;
  if (tipEl) tipEl.classList.remove("show");
}

// scheduleTipHide starts the 300ms hover-bridge grace period: the tooltip
// survives the pointer leaving the trigger long enough to be hovered itself.
function scheduleTipHide() {
  clearTimeout(tipShowTimer);
  clearTimeout(tipHideTimer);
  tipHideTimer = setTimeout(hideTip, 300);
}

document.addEventListener("pointerover", (e) => {
  // Hovering the tooltip itself keeps it open (hover bridge).
  if (tipEl && tipEl.contains(e.target)) {
    clearTimeout(tipHideTimer);
    return;
  }
  const target = e.target.closest ? e.target.closest("[data-tooltip]") : null;
  if (target === tipTarget) {
    if (target) clearTimeout(tipHideTimer);
    return;
  }
  if (!target) {
    // Left the trigger: grace period, then hide.
    if (tipTarget) scheduleTipHide();
    return;
  }
  clearTimeout(tipShowTimer);
  clearTimeout(tipHideTimer);
  if (tipEl) tipEl.classList.remove("show");
  tipTarget = target;
  tipShowTimer = setTimeout(() => {
    if (tipTarget === target && target.isConnected) showTip(target);
  }, 250);
});
document.addEventListener("pointerdown", (e) => {
  if (tipEl && tipEl.contains(e.target)) return; // clicking a tip link/copy
  hideTip();
}, true);
document.addEventListener("scroll", (e) => {
  if (tipEl && tipEl.contains(e.target)) return;
  hideTip();
}, true);
window.addEventListener("blur", () => hideTip());
