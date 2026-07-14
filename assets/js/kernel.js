// tinymoon — overlay kernel: shared infrastructure for all floating overlays
// (tooltip, popover, context menu, select, modal, toast). Centralizes escape
// key handling (layer stack), viewport-aware positioning, root element
// creation, and CSS custom property reading.

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
// optional attrs object sets attributes (e.g. {role: "menu"}).
export function ensureRoot(id, attrs) {
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement("div");
    node.id = id;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    }
    document.body.appendChild(node);
  }
  return node;
}
