// tinymoon — virtual list: windowed rendering for long, flat lists. Only the
// rows intersecting the viewport (plus an overscan margin) exist in the DOM at
// any moment, so a 10,000-item list keeps a near-constant node count while
// scrolling.
//
// CONSTRAINT — FIXED ROW HEIGHT ONLY. Every row is exactly `rowHeight` pixels
// tall. Variable / measured / auto row heights are deliberately OUT OF SCOPE:
// they require measuring rendered rows and maintaining a running offset map,
// which is a different (and much heavier) widget. If your rows vary in height,
// this is not the tool. The fixed height is what makes the windowing math O(1).
//
// This is a STANDALONE list, not a table mode. Virtual rows are absolutely
// positioned <div>s inside a spacer; they cannot be <tr> elements (a <tbody>
// cannot absolutely-position its rows), so a virtual *table* is a different
// problem and is not offered here.
//
// Layout: a scrolling container (`contain: strict`, so its scroll and paint are
// isolated) holds a single spacer whose height is items.length * rowHeight; each
// live row is absolutely positioned at top = index * rowHeight. Give the
// container a height via CSS — it needs one to have a viewport to window against.

import { el } from "./dom.js";

// Pure windowing math: which item indices should be live for a given scroll
// position. Exposed as a named export so the range logic is unit-testable
// without layout. Returns a half-open [start, end) range, clamped to
// [0, itemCount), widened by `overscan` rows on each side.
export function windowRange(scrollTop, viewportHeight, rowHeight, itemCount, overscan = 3) {
  if (itemCount === 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(scrollTop / rowHeight);
  const visible = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(itemCount, first + visible + overscan);
  return { start, end };
}

// createVirtualList({rowHeight, items?, renderRow, getKey?, overscan?}) →
//   {el, setItems(items), scrollToIndex(i), destroy}
//
// renderRow(item, index) -> Node builds a row's content (its height is fixed by
// the container, so don't set it yourself). getKey(item, index) -> stable key
// lets the list REUSE an existing row node when the same item scrolls back into
// view, instead of rebuilding it; without getKey the row index is the key.
export function createVirtualList(opts) {
  if (!opts || typeof opts.rowHeight !== "number" || opts.rowHeight <= 0) {
    throw new Error("createVirtualList: a positive rowHeight is required");
  }
  if (typeof opts.renderRow !== "function") {
    throw new Error("createVirtualList: renderRow(item, index) is required");
  }
  const { rowHeight, renderRow, getKey, overscan = 3 } = opts;
  let items = Array.isArray(opts.items) ? opts.items : [];

  const container = el("div", "tm-vlist");
  const spacer = el("div", "tm-vlist-spacer");
  container.appendChild(spacer);

  // Live row nodes currently in the DOM, keyed for reuse across renders.
  let live = new Map(); // key -> { node, index }

  function keyOf(item, index) {
    return getKey ? getKey(item, index) : index;
  }

  function sizeSpacer() {
    spacer.style.height = items.length * rowHeight + "px";
  }

  function render() {
    const { start, end } = windowRange(
      container.scrollTop,
      container.clientHeight,
      rowHeight,
      items.length,
      overscan,
    );
    const next = new Map();
    for (let i = start; i < end; i++) {
      const item = items[i];
      const key = keyOf(item, i);
      let entry = live.get(key);
      if (entry) {
        // Reuse the existing node; only reposition if its index moved.
        if (entry.index !== i) {
          entry.node.style.top = i * rowHeight + "px";
          entry.index = i;
        }
        live.delete(key);
      } else {
        const inner = renderRow(item, i);
        const node = el("div", "tm-vlist-row");
        node.style.height = rowHeight + "px";
        node.style.top = i * rowHeight + "px";
        if (inner instanceof Node) node.appendChild(inner);
        container.appendChild(node);
        entry = { node, index: i };
      }
      next.set(key, entry);
    }
    // Anything still in `live` scrolled out of the window — detach it.
    for (const entry of live.values()) {
      if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
    }
    live = next;
  }

  function onScroll() {
    render();
  }
  container.addEventListener("scroll", onScroll);

  function setItems(next) {
    items = Array.isArray(next) ? next : [];
    // Item set changed wholesale: drop reused nodes and redraw the window.
    for (const entry of live.values()) {
      if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
    }
    live = new Map();
    sizeSpacer();
    render();
  }

  function scrollToIndex(i) {
    const clamped = Math.max(0, Math.min(i, items.length - 1));
    container.scrollTop = clamped * rowHeight;
    render();
  }

  sizeSpacer();
  render();

  function destroy() {
    container.removeEventListener("scroll", onScroll);
    if (container.parentNode) container.parentNode.removeChild(container);
  }

  return { el: container, setItems, scrollToIndex, destroy };
}
