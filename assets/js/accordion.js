// tinymoon -- accordion: stacked disclosure panels. Each item is a
// button[aria-expanded] header controlling a region panel. Panels expand and
// collapse with the grid-template-rows 0fr->1fr technique, transitioned with a
// duration token only, so the global prefers-reduced-motion suppression (which
// zeroes every transition-duration) covers it automatically.
//
// Factory: createAccordion(opts) -> {el, open(i), close(i), toggle(i), destroy()}
//   opts: {items: [{title, body, open?}], multi?}
//   `body` is a string or an HTMLElement. multi:false (default) keeps at most
//   one panel open; multi:true allows several.

import { el } from "./dom.js";
import { icon } from "./icons.js";

let idCounter = 0;

export function createAccordion(opts) {
  if (!opts || !Array.isArray(opts.items)) {
    throw new Error("createAccordion: items array is required");
  }
  const multi = !!opts.multi;
  const instanceId = "tm-acc-" + (++idCounter);

  const root = el("div", "tm-accordion");
  const entries = []; // {item, header, panel, inner}
  const handlers = [];

  function listen(elem, event, handler) {
    elem.addEventListener(event, handler);
    handlers.push([elem, event, handler]);
  }

  opts.items.forEach((item, i) => {
    const itemEl = el("div", "tm-accordion-item");
    const headerId = instanceId + "-h-" + i;
    const panelId = instanceId + "-p-" + i;

    const header = el("button", "tm-accordion-header");
    header.type = "button";
    header.id = headerId;
    header.setAttribute("aria-expanded", "false");
    header.setAttribute("aria-controls", panelId);

    const titleSpan = el("span", "tm-accordion-title", item.title);
    header.appendChild(titleSpan);

    const chev = el("span", "tm-accordion-chevron");
    chev.setAttribute("aria-hidden", "true");
    chev.innerHTML = icon("chevron");
    header.appendChild(chev);

    const panel = el("div", "tm-accordion-panel");
    panel.id = panelId;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", headerId);

    // Inner wrapper owns overflow:hidden so the outer grid row can animate.
    const inner = el("div", "tm-accordion-panel-inner");
    if (item.body instanceof HTMLElement) inner.appendChild(item.body);
    else inner.appendChild(el("div", "tm-accordion-body", item.body != null ? String(item.body) : ""));
    panel.appendChild(inner);

    itemEl.appendChild(header);
    itemEl.appendChild(panel);
    root.appendChild(itemEl);

    entries.push({ item, itemEl, header, panel });

    listen(header, "click", () => toggle(i));
  });

  function setOpen(i, isOpen) {
    const e = entries[i];
    if (!e) return;
    if (isOpen && !multi) {
      // Single-open: collapse every other panel first.
      entries.forEach((other, j) => { if (j !== i) applyOpen(j, false); });
    }
    applyOpen(i, isOpen);
  }

  function applyOpen(i, isOpen) {
    const e = entries[i];
    if (!e) return;
    e.itemEl.classList.toggle("open", isOpen);
    e.header.setAttribute("aria-expanded", String(isOpen));
  }

  function open(i) { setOpen(i, true); }
  function close(i) { applyOpen(i, false); }
  function toggle(i) {
    const e = entries[i];
    if (!e) return;
    setOpen(i, !e.itemEl.classList.contains("open"));
  }

  // Initial open state from item.open flags (respecting single-open mode).
  opts.items.forEach((item, i) => {
    if (item.open) {
      if (!multi) { applyOpen(i, true); }
      else applyOpen(i, true);
    }
  });
  // In single-open mode, keep only the first requested-open panel.
  if (!multi) {
    let seenOpen = false;
    entries.forEach((e, i) => {
      const isOpen = e.itemEl.classList.contains("open");
      if (isOpen && !seenOpen) seenOpen = true;
      else if (isOpen) applyOpen(i, false);
    });
  }

  function destroy() {
    for (const [elem, event, handler] of handlers) elem.removeEventListener(event, handler);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, open, close, toggle, destroy };
}
