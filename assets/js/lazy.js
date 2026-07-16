// tinymoon — lazyMount: an IntersectionObserver-gated loader with a concurrency
// pump. Elements are loaded only once they scroll into view, and at most N
// loadFns run at a time, so a viewport that reveals fifty candidates at once
// does not fire fifty simultaneous loads — they drain in visibility order, N
// wide.
//
// The observer root defaults to the shell's content scroller (#tm-content) when
// a shell is mounted, resolved internally so consumers never reach into shell
// internals. Pass an explicit `root` (or `null` for the viewport) to override.

// Resolve the observer root. `undefined` (the default) means "auto": the shell
// content scroller when present, else the viewport (null). An explicit value —
// including null — is honored as given.
function resolveRoot(root) {
  if (root !== undefined) return root;
  return (typeof document !== "undefined" && document.getElementById("tm-content")) || null;
}

// lazyMount(target, loadFn, {root?, rootMargin?, concurrency?}) → cancel().
//   target       — an Element, or an array/NodeList of Elements, to watch.
//   loadFn(el)   — called once per element when it first becomes visible; may
//                  return a promise (awaited to gate the concurrency slot).
//   root         — observer root (see resolveRoot); default: shell scroller.
//   rootMargin   — IntersectionObserver rootMargin (default "0px").
//   concurrency  — max in-flight loadFns (default 3).
// cancel() disconnects the observer and drops any not-yet-started candidates;
// loads already in flight run to completion but never re-pump.
export function lazyMount(target, loadFn, opts) {
  if (typeof loadFn !== "function") throw new Error("lazyMount: loadFn is required");
  const o = opts || {};
  const concurrency = o.concurrency || 3;
  const els = target instanceof Element ? [target] : Array.from(target);

  const queue = [];         // visible elements awaiting a pump slot, in order
  const claimed = new Set(); // elements queued or already loading (dedupe)
  let active = 0;
  let cancelled = false;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting || claimed.has(e.target)) continue;
      claimed.add(e.target);
      io.unobserve(e.target); // one-shot: each element loads at most once
      queue.push(e.target);
    }
    pump();
  }, { root: resolveRoot(o.root), rootMargin: o.rootMargin || "0px" });

  function pump() {
    while (!cancelled && active < concurrency && queue.length) {
      const el = queue.shift();
      active++;
      Promise.resolve()
        .then(() => loadFn(el))
        .catch(() => { /* a failed load must not stall the pump */ })
        .then(() => { active--; if (!cancelled) pump(); });
    }
  }

  for (const el of els) io.observe(el);

  return function cancel() {
    cancelled = true;
    io.disconnect();
    queue.length = 0;
  };
}
