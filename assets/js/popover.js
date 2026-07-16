// tinymoon — popover: a small floating panel anchored to an element.

import { el } from "./dom.js";
import { pushLayer, placeBelow } from "./kernel.js";
import { registerLightDismiss } from "./dismiss.js";

let popoverEl = null;
// Layer/dismiss removal kept module-level so closePopover() always cleans up.
let removeDismiss = null;
let removeLayer = null;

export function closePopover() {
  if (popoverEl) {
    if (popoverEl.hidePopover) try { popoverEl.hidePopover(); } catch (_) { /* not shown */ }
    popoverEl.remove();
    popoverEl = null;
  }
  if (removeDismiss) { removeDismiss(); removeDismiss = null; }
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
  // The anchor is the trigger (gesture-claim → no close-then-reopen).
  removeDismiss = registerLightDismiss({ panels: [popoverEl], dismiss: closePopover, trigger: anchor });
  removeLayer = pushLayer(() => closePopover());
}
