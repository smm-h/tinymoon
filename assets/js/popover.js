// tinymoon — popover: a small floating panel anchored to an element.

import { el } from "./dom.js";
import { pushLayer, placeBelow } from "./kernel.js";

let popoverEl = null;
// Document listener ref and layer removal are kept module-level so
// closePopover() always cleans up, no matter which path closed the popover.
let onDocDown = null;
let removeLayer = null;

export function closePopover() {
  if (popoverEl) {
    if (popoverEl.hidePopover) try { popoverEl.hidePopover(); } catch (_) { /* not shown */ }
    popoverEl.remove();
    popoverEl = null;
  }
  if (onDocDown) { document.removeEventListener("pointerdown", onDocDown, true); onDocDown = null; }
  if (removeLayer) { removeLayer(); removeLayer = null; }
}

// openPopover(anchor, build): build(body) fills the content. Closes on
// outside pointerdown, Escape (via kernel layer stack), or closePopover().
// Positioned under the anchor, flipped above when the viewport bottom (or
// the footer slot) would clip it.
export function openPopover(anchor, build) {
  closePopover();
  popoverEl = el("div", "popover");
  popoverEl.setAttribute("popover", "manual");
  build(popoverEl);
  document.body.appendChild(popoverEl);
  // Promote to top layer so the popover renders above the grain overlay.
  if (popoverEl.showPopover) try { popoverEl.showPopover(); } catch (_) { /* already shown */ }
  placeBelow(anchor, popoverEl, { gap: 6 });
  onDocDown = (e) => {
    if (popoverEl && !popoverEl.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
      closePopover();
    }
  };
  document.addEventListener("pointerdown", onDocDown, true);
  removeLayer = pushLayer(() => closePopover());
}
