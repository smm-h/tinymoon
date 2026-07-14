// tinymoon — popover: a small floating panel anchored to an element.

import { el } from "./dom.js";
import { pushLayer, placeBelow } from "./kernel.js";

let popoverEl = null;
// Document listener ref and layer removal are kept module-level so
// closePopover() always cleans up, no matter which path closed the popover.
let onDocDown = null;
let removeLayer = null;

export function closePopover() {
  if (popoverEl) { popoverEl.remove(); popoverEl = null; }
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
  build(popoverEl);
  document.body.appendChild(popoverEl);
  placeBelow(anchor, popoverEl, { gap: 6 });
  onDocDown = (e) => {
    if (popoverEl && !popoverEl.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
      closePopover();
    }
  };
  document.addEventListener("pointerdown", onDocDown, true);
  removeLayer = pushLayer(() => closePopover());
}
