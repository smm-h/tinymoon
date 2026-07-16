// tinymoon — async-state blocks: one-shot element factories for the three
// canonical async UI states (loading, empty, error), plus renderAsync to swap
// between them as a promise settles.
//
// Static-first by construction: no shimmer, no skeleton pulse — the only motion
// is the shared .spin rotation inside loadingBlock's spinner (the one animation
// the design vocabulary sanctions), so these blocks are reduced-motion-safe
// without any per-block media queries. All three reuse the existing .empty
// widgets.css block, so an app that already links widgets.css needs no new CSS.
//
// These are NOT_COMPONENTS-style factories: each returns a bare element (no
// {el, ...} wrapper, no .destroy()), exactly like badge()/copyButton().

import { el } from "./dom.js";
import { icon } from "./icons.js";

// loadingBlock({label?}) → a centered .empty block with a spinner and a label
// ("Loading…" by default). aria-busy marks it as an in-progress region.
export function loadingBlock(opts) {
  const box = el("div", "empty tm-state-loading");
  box.setAttribute("aria-busy", "true");
  const s = el("span");
  s.innerHTML = icon("spinner");
  box.appendChild(s);
  box.appendChild(el("div", "empty-title", (opts && opts.label) || "Loading…"));
  return box;
}

// emptyBlock({title, sub?}) → a centered .empty block, no spinner. title is
// required (an empty state with no message is a bug); sub is optional detail.
export function emptyBlock(opts) {
  if (!opts || !opts.title) throw new Error("emptyBlock: title is required");
  const box = el("div", "empty");
  box.appendChild(el("div", "empty-title", opts.title));
  if (opts.sub) box.appendChild(el("div", "empty-sub", opts.sub));
  return box;
}

// errorBlock({message, onRetry?}) → a centered .empty block with a warn icon,
// role="alert", and an optional Retry button wired to onRetry.
export function errorBlock(opts) {
  if (!opts || !opts.message) throw new Error("errorBlock: message is required");
  const box = el("div", "empty tm-state-error");
  box.setAttribute("role", "alert");
  const s = el("span");
  s.innerHTML = icon("warn");
  box.appendChild(s);
  box.appendChild(el("div", "empty-title", opts.message));
  if (opts.onRetry) {
    const b = el("button", "btn", "Retry");
    b.type = "button";
    b.addEventListener("click", opts.onRetry);
    box.appendChild(b);
  }
  return box;
}

// renderAsync(container, promise, {loading?, empty?, error?, onData}) → Promise.
// Convenience that swaps blocks per state into `container`:
//   1. loadingBlock (using the optional `loading` opts) shows immediately;
//   2. on resolution, onData(data) runs — its return value decides the outcome:
//        - falsy (false/null/undefined/0/"")  → emptyBlock (empty predicate),
//        - an Element                          → that Element replaces content,
//        - any other truthy value             → onData already populated
//          `container` itself, so it is left untouched;
//   3. on rejection, errorBlock shows (message from the error, merged with the
//      optional `error` opts so a caller can supply onRetry).
//
// The returned promise RESOLVES to the data on success. On rejection it also
// resolves (to undefined) after the errorBlock is shown — the failure is not
// silently dropped, it is surfaced as the visible error state, so fire-and-
// forget callers never trip an unhandled rejection. Wire recovery through
// error.onRetry (which re-invokes your own renderAsync call).
export function renderAsync(container, promise, opts) {
  const o = opts || {};
  container.replaceChildren(loadingBlock(o.loading));
  return Promise.resolve(promise).then(
    (data) => {
      const result = o.onData ? o.onData(data) : data;
      if (!result) {
        container.replaceChildren(emptyBlock(o.empty || { title: "Nothing here" }));
      } else if (result instanceof Node) {
        container.replaceChildren(result);
      }
      return data;
    },
    (err) => {
      container.replaceChildren(errorBlock({
        message: (err && err.message) || String(err),
        ...(o.error || {}),
      }));
    },
  );
}
