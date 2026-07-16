// tinymoon — feed: a presentation-only live feed / log viewer.
// createFeed({renderItem, cap?, onPrune?}) ->
//   {el, append, prepend, setItems, destroy}.
//
// NO TRANSPORT COUPLING. The feed does not open an SSE stream, a socket, or a
// poll loop — that is the app's job (see the extras realtime helpers). You push
// items in with append()/prepend()/setItems(); the feed only renders, caps, and
// scrolls. renderItem(item) -> Node builds each row (set data-level on your node
// to color it by severity — the feed mirrors it onto the row wrapper for CSS).
//
// CAPPED BUFFER. Live feeds grow without bound, so the buffer is capped
// (default 200). When append() overflows the cap the OLDEST rows (the top) are
// pruned; when prepend() overflows, the far end (the bottom) is pruned. Pruned
// items are handed to onPrune(items) so the caller can release any resources.
//
// STICK-TO-BOTTOM. While the viewport is scrolled to the bottom, new appended
// rows keep it pinned there (the log-tail behavior). Scrolling up PAUSES the
// autoscroll — new rows no longer yank you back down — and reveals a "jump to
// latest" affordance; clicking it (or scrolling back to the bottom) re-pins.

import { el } from "./dom.js";

// Scroll distance from the bottom (px) still counted as "at the bottom".
const STICK_EPSILON = 4;

// createFeed({renderItem, cap?, onPrune?}) -> {el, append(item),
//   prepend(item), setItems(items), destroy}.
export function createFeed(opts) {
  if (!opts || typeof opts.renderItem !== "function") {
    throw new Error("createFeed: renderItem(item) is required");
  }
  const renderItem = opts.renderItem;
  const cap = typeof opts.cap === "number" && opts.cap > 0 ? Math.floor(opts.cap) : 200;
  const onPrune = typeof opts.onPrune === "function" ? opts.onPrune : null;

  const root = el("div", "tm-feed");
  const list = el("div", "tm-feed-list");
  root.appendChild(list);

  const jump = el("button", "tm-feed-jump");
  jump.type = "button";
  jump.textContent = "Jump to latest";
  jump.hidden = true;
  root.appendChild(jump);

  // Parallel array of rendered rows: { item, node } where node is the wrapper.
  let rows = [];
  let stuck = true;
  // True during a programmatic scroll-to-bottom. The scroll event it generates
  // must NOT be treated as a user scroll — otherwise rapid appends (each
  // growing scrollHeight before the async scroll event fires) would flip the
  // feed out of stick-to-bottom and never recover.
  let programmatic = false;

  function makeRow(item) {
    const inner = renderItem(item);
    const wrap = el("div", "tm-feed-item");
    // Mirror a caller-set data-level onto the wrapper for severity styling.
    if (inner instanceof HTMLElement && inner.dataset && inner.dataset.level) {
      wrap.dataset.level = inner.dataset.level;
    }
    if (inner instanceof Node) wrap.appendChild(inner);
    return { item, node: wrap };
  }

  function atBottom() {
    return root.scrollTop + root.clientHeight >= root.scrollHeight - STICK_EPSILON;
  }

  function scrollToBottom() {
    programmatic = true;
    root.scrollTop = root.scrollHeight;
    stuck = true;
    jump.hidden = true;
    // Clear the flag after the frame the scroll event fires in. The async
    // scroll event lands before this, so it is correctly ignored; genuine user
    // scrolls happen later, with the flag already cleared.
    const raf = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 0);
    raf(() => { programmatic = false; });
  }

  // Prune from the given end until within cap; returns pruned items (oldest→).
  function enforceCap(fromTop) {
    const pruned = [];
    while (rows.length > cap) {
      const row = fromTop ? rows.shift() : rows.pop();
      if (row.node.parentNode) row.node.parentNode.removeChild(row.node);
      pruned.push(row.item);
    }
    if (pruned.length && onPrune) onPrune(pruned);
  }

  function append(item) {
    const row = makeRow(item);
    rows.push(row);
    list.appendChild(row.node);
    enforceCap(true); // overflow drops the oldest (top)
    if (stuck) scrollToBottom();
  }

  function prepend(item) {
    const row = makeRow(item);
    rows.unshift(row);
    list.insertBefore(row.node, list.firstChild);
    enforceCap(false); // overflow drops the far end (bottom)
  }

  function setItems(items) {
    list.textContent = "";
    rows = [];
    const list2 = Array.isArray(items) ? items : [];
    // Keep only the last `cap` items when handed an oversized set.
    const start = Math.max(0, list2.length - cap);
    for (let i = start; i < list2.length; i++) {
      const row = makeRow(list2[i]);
      rows.push(row);
      list.appendChild(row.node);
    }
    scrollToBottom();
  }

  function onScroll() {
    if (programmatic) return; // ignore scrolls we caused ourselves
    if (atBottom()) {
      stuck = true;
      jump.hidden = true;
    } else {
      stuck = false;
      jump.hidden = false;
    }
  }
  root.addEventListener("scroll", onScroll);

  function onJump() { scrollToBottom(); }
  jump.addEventListener("click", onJump);

  function destroy() {
    root.removeEventListener("scroll", onScroll);
    jump.removeEventListener("click", onJump);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, append, prepend, setItems, destroy };
}
