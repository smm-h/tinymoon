// tinymoon — overlay kernel and copy infrastructure: shared infrastructure for
// all floating overlays (tooltip, popover, context menu, select, modal, toast)
// and the object-copy system. Centralizes escape key handling (layer stack),
// viewport-aware positioning, root element creation, CSS custom property
// reading, and the copyable registry (registerCopyable/unregisterCopyable).

// ---------------------------------------------------------------------------
// cssVar — read a live CSS custom property off :root
// ---------------------------------------------------------------------------

// cssVar(name) → the trimmed computed value of a CSS custom property on
// :root. Canvas rendering and layout math pull live token values through this.
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---------------------------------------------------------------------------
// Escape stack — one document-level listener, LIFO close order
// ---------------------------------------------------------------------------

const layers = [];

// pushLayer(closeFn) → removeFn. When an overlay opens, it pushes its close
// function. When the overlay closes (by any path — Escape, outside click, API
// call), it calls the returned remove function to deregister. The kernel's
// single Escape listener calls only the topmost layer's close function.
export function pushLayer(closeFn) {
  const entry = { close: closeFn };
  layers.push(entry);
  return () => {
    const idx = layers.indexOf(entry);
    if (idx !== -1) layers.splice(idx, 1);
  };
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || layers.length === 0) return;
  e.stopPropagation();
  e.preventDefault();
  layers[layers.length - 1].close();
});

// Hash navigation closes all open overlays. Overlays are transient UI that
// must not survive a page-level navigation — a tooltip, popover, modal, or
// context menu left floating after the content underneath changes is a bug.
// This single listener replaces per-module cross-imports (e.g. markdown.js
// importing hideTip/closePopover) and covers every overlay type uniformly.
window.addEventListener("hashchange", () => {
  while (layers.length > 0) {
    const n = layers.length;
    layers[n - 1].close();
    // Defensive: if close() didn't remove the entry from the stack
    // (broken overlay), pop it to prevent an infinite loop.
    if (layers.length === n) layers.pop();
  }
});

// ---------------------------------------------------------------------------
// placeBelow — shared viewport-aware positioning for anchored overlays
// ---------------------------------------------------------------------------

// placeBelow(anchor, panel, opts?) — measures the anchor, positions the panel
// below it with the given gap, flips above when the viewport bottom minus the
// footer height would clip it, and clamps horizontally.
//   opts.gap         — vertical distance from anchor (default 8)
//   opts.flipMargin  — extra margin below viewport for flip decision (default 8)
export function placeBelow(anchor, panel, opts) {
  const gap = (opts && opts.gap !== undefined) ? opts.gap : 8;
  const flipMargin = (opts && opts.flipMargin !== undefined) ? opts.flipMargin : 8;
  const footerH = parseFloat(cssVar("--footer-h")) || 0;
  const ar = anchor.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  let x = ar.left + ar.width / 2 - pr.width / 2;
  let y = ar.bottom + gap;
  if (y + pr.height > window.innerHeight - footerH - flipMargin) {
    y = ar.top - pr.height - gap;
  }
  x = Math.max(8, Math.min(x, window.innerWidth - pr.width - 8));
  y = Math.max(8, y);
  panel.style.left = x + "px";
  panel.style.top = y + "px";
}

// ---------------------------------------------------------------------------
// ensureRoot — lazy singleton root elements on document.body
// ---------------------------------------------------------------------------

// ensureRoot(id, attrs?) → gets or creates a div#id on document.body. The
// optional attrs object sets attributes (e.g. {role: "menu"}) on every call,
// whether the element is freshly created or already exists. This guarantees
// required attributes are present even when an earlier caller omitted them.
export function ensureRoot(id, attrs) {
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement("div");
    node.id = id;
    document.body.appendChild(node);
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  }
  return node;
}

// ---------------------------------------------------------------------------
// Copyable registry — object-level Ctrl+C via the synchronous copy event
// ---------------------------------------------------------------------------

// Natively focusable tag names — elements that already accept keyboard focus
// without needing tabindex. Shared concept with ctxmenu.js, but duplicated
// here to keep kernel dependency-free from ctxmenu.
const COPY_NATIVE_FOCUSABLE = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

// WeakMap<Element, () => {text: string, html?: string}>
const copyables = new WeakMap();

// registerCopyable(element, getData): registers an element as a copy-object.
// getData() returns {text: string, html?: string}. Adds tabindex="0" if the
// element is not natively focusable (same pattern as ctxmenu).
export function registerCopyable(element, getData) {
  copyables.set(element, getData);
  if (!COPY_NATIVE_FOCUSABLE.has(element.tagName) && !element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "0");
  }
}

// unregisterCopyable(element): removes the element from the copy registry.
export function unregisterCopyable(element) {
  copyables.delete(element);
}

// getCopyData(element): if element (or an ancestor) is registered as
// copyable, returns getData(). Otherwise returns null. Exported so
// ctxmenu.js can check for copyable ancestors and build copy menu items.
export function getCopyData(element) {
  let node = element;
  while (node) {
    const getData = copyables.get(node);
    if (getData) return getData();
    node = node.parentElement;
  }
  return null;
}

// Document-level copy event listener: when fired, check if
// document.activeElement is a registered copyable. If so, intercept and
// set clipboard data from the getData function.
document.addEventListener("copy", (e) => {
  const active = document.activeElement;
  if (!active) return;
  const getData = copyables.get(active);
  if (!getData) return;
  const data = getData();
  e.preventDefault();
  e.clipboardData.setData("text/plain", data.text);
  if (data.html) {
    e.clipboardData.setData("text/html", data.html);
  }
});
