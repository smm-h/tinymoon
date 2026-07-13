// tinymoon — popover: a small floating panel anchored to an element.

import { el } from "./dom.js";
import { cssVar } from "./settings.js";

let popoverEl = null;
// Document listener refs are kept module-level so closePopover() always
// removes both, no matter which path closed the popover.
let onDocDown = null;
let onDocKey = null;

export function closePopover() {
  if (popoverEl) { popoverEl.remove(); popoverEl = null; }
  if (onDocDown) { document.removeEventListener("pointerdown", onDocDown, true); onDocDown = null; }
  if (onDocKey) { document.removeEventListener("keydown", onDocKey); onDocKey = null; }
}

// openPopover(anchor, build): build(body) fills the content. Closes on
// outside pointerdown, Escape, or closePopover(). Positioned under the
// anchor, flipped above when the viewport bottom (or the footer slot)
// would clip it.
export function openPopover(anchor, build) {
  closePopover();
  popoverEl = el("div", "popover");
  build(popoverEl);
  document.body.appendChild(popoverEl);
  const footerH = parseFloat(cssVar("--footer-h")) || 0;
  const ar = anchor.getBoundingClientRect();
  const pr = popoverEl.getBoundingClientRect();
  let x = ar.left + ar.width / 2 - pr.width / 2;
  let y = ar.bottom + 6;
  if (y + pr.height > window.innerHeight - footerH - 8) y = ar.top - pr.height - 6;
  x = Math.max(8, Math.min(x, window.innerWidth - pr.width - 8));
  popoverEl.style.left = x + "px";
  popoverEl.style.top = y + "px";
  onDocDown = (e) => {
    if (popoverEl && !popoverEl.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
      closePopover();
    }
  };
  onDocKey = (e) => {
    if (e.key === "Escape") closePopover();
  };
  document.addEventListener("pointerdown", onDocDown, true);
  document.addEventListener("keydown", onDocKey);
}
