// tinymoon -- hovercard: rich-content floating panel triggered by hover or
// focus on elements with data-hovercard. Unlike tooltips (plain text,
// non-interactive), hovercards support mini-markdown (bold, code, links) and
// are interactive -- the pointer can move into the hovercard, and keyboard
// users can navigate into its content. Uses the Popover API for top-layer
// rendering and light-dismiss.

import { el } from "./dom.js";
import { renderMiniMd } from "./markdown.js";
import { pushLayer, placeBelow } from "./kernel.js";

let hcEl = null;
let hcBody = null;
let hcShowTimer = 0;
let hcHideTimer = 0;
let hcTarget = null;
let removeLayer = null;

// ensureHovercard() -> the singleton hovercard element, created on first use.
export function ensureHovercard() {
  if (!hcEl) {
    hcEl = el("div", "tm-hovercard");
    hcEl.id = "tm-hovercard";
    hcEl.setAttribute("popover", "manual");
    hcBody = el("div", "hc-body");
    hcEl.appendChild(hcBody);
    document.body.appendChild(hcEl);
  }
  return hcEl;
}

function showHovercard(target) {
  const text = target.dataset.hovercard;
  if (!text) return;
  const h = ensureHovercard();
  hcBody.textContent = "";
  hcBody.appendChild(renderMiniMd(text));
  // Show via Popover API (manual mode -- we control show/hide ourselves).
  if (h.showPopover) h.showPopover();
  // Position after content is set.
  h.style.left = "0px";
  h.style.top = "0px";
  placeBelow(target, h);
  h.classList.add("show");
  hcTarget = target;
  // Register in the kernel layer stack.
  if (removeLayer) removeLayer();
  removeLayer = pushLayer(() => hideHovercard());
}

export function hideHovercard() {
  clearTimeout(hcShowTimer);
  clearTimeout(hcHideTimer);
  hcTarget = null;
  if (hcEl) {
    hcEl.classList.remove("show");
    if (hcEl.hidePopover) try { hcEl.hidePopover(); } catch (_) { /* not shown */ }
  }
  if (removeLayer) { removeLayer(); removeLayer = null; }
}

// schedulehcHide starts the 300ms hover-bridge grace period: the hovercard
// survives the pointer leaving the trigger long enough to be hovered itself.
function scheduleHcHide() {
  clearTimeout(hcShowTimer);
  clearTimeout(hcHideTimer);
  hcHideTimer = setTimeout(hideHovercard, 300);
}

// --- pointer-based triggers ---

document.addEventListener("pointerover", (e) => {
  // Hovering the hovercard itself keeps it open (hover bridge).
  if (hcEl && hcEl.contains(e.target)) {
    clearTimeout(hcHideTimer);
    return;
  }
  const target = e.target.closest ? e.target.closest("[data-hovercard]") : null;
  if (target === hcTarget) {
    if (target) clearTimeout(hcHideTimer);
    return;
  }
  if (!target) {
    // Left the trigger: grace period, then hide.
    if (hcTarget) scheduleHcHide();
    return;
  }
  clearTimeout(hcShowTimer);
  clearTimeout(hcHideTimer);
  if (hcEl) {
    hcEl.classList.remove("show");
    if (hcEl.hidePopover) try { hcEl.hidePopover(); } catch (_) { /* not shown */ }
  }
  hcTarget = target;
  hcShowTimer = setTimeout(() => {
    if (hcTarget === target && target.isConnected) showHovercard(target);
  }, 400);
});

document.addEventListener("pointerdown", (e) => {
  if (hcEl && hcEl.contains(e.target)) return; // clicking inside the hovercard
  hideHovercard();
}, true);

document.addEventListener("scroll", (e) => {
  if (hcEl && hcEl.contains(e.target)) return;
  hideHovercard();
}, true);

window.addEventListener("blur", () => hideHovercard());

// --- focus-based triggers ---

document.addEventListener("focusin", (e) => {
  // Focus moving inside the hovercard keeps it open.
  if (hcEl && hcEl.contains(e.target)) {
    clearTimeout(hcHideTimer);
    return;
  }
  const target = e.target.closest ? e.target.closest("[data-hovercard]") : null;
  if (!target || target === hcTarget) return;
  hideHovercard();
  hcTarget = target;
  // Show immediately on focus for keyboard users.
  if (target.isConnected) showHovercard(target);
});

document.addEventListener("focusout", (e) => {
  // When focus leaves both the trigger and the hovercard, hide after a
  // brief delay (allows focus to move into the hovercard).
  if (!hcTarget) return;
  setTimeout(() => {
    if (!hcEl) return;
    const active = document.activeElement;
    if (active && (hcEl.contains(active) || (hcTarget && hcTarget.contains(active)))) return;
    // Also check if the active element IS the trigger itself.
    if (active === hcTarget) return;
    hideHovercard();
  }, 0);
});

// --- keyboard navigation into the hovercard ---

document.addEventListener("keydown", (e) => {
  if (!hcTarget || !hcEl || !hcEl.classList.contains("show")) return;
  // When the trigger is focused and the hovercard is visible, Down arrow
  // or Enter moves focus into the first focusable element in the hovercard.
  const trigger = hcTarget;
  if (document.activeElement !== trigger && !trigger.contains(document.activeElement)) return;
  if (e.key === "ArrowDown" || e.key === "Enter") {
    const focusable = hcEl.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      focusable[0].focus();
    }
  }
});
