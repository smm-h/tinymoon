// tinymoon — pagination: a transport-agnostic "Load more" control.
// createLoadMore({fetchPage, onItems, pageSize?}) -> {el, reset, load, destroy}.
//
// TRANSPORT-AGNOSTIC by design. The widget knows nothing about HTTP, GraphQL,
// cursors vs. offsets, or your data shape. The caller supplies
// fetchPage(cursor, pageSize) -> Promise<{items, nextCursor}>; the widget owns
// only the button, its loading state, and the end/error affordances. It starts
// with a null cursor (the first page); each successful page advances the cursor
// to nextCursor and calls onItems(items). When nextCursor is null the widget
// has reached the end and hides the button.
//
// NO SILENT FAILURE. A rejected fetchPage is surfaced as a visible error line
// with an explicit Retry button that re-requests the SAME cursor — the error is
// never swallowed and the pagination position is never lost. reset() returns
// the control to its first-page state for a filter change (it does not fetch;
// the next Load-more click fetches page one, keeping every fetch caller-visible
// and predictable).

import { el } from "./dom.js";
import { icon } from "./icons.js";

// createLoadMore({fetchPage, onItems, pageSize?}) -> {el, reset(), load(), destroy}.
// fetchPage(cursor, pageSize) returns a promise of {items, nextCursor}; onItems
// receives each page's items in order. pageSize (optional) is forwarded to
// fetchPage as a hint — the widget itself does not slice.
//
// load() programmatically triggers a page load — the exact same path the button
// click takes (respects loading/ended state). Called on a fresh or reset()
// control it fetches page one, so a caller can auto-load the first page without
// synthesizing a click. It returns the underlying fetch promise.
export function createLoadMore(opts) {
  if (!opts || typeof opts.fetchPage !== "function") {
    throw new Error("createLoadMore: fetchPage(cursor) is required");
  }
  if (typeof opts.onItems !== "function") {
    throw new Error("createLoadMore: onItems(items) is required");
  }
  const { fetchPage, onItems, pageSize } = opts;

  const root = el("div", "tm-loadmore");

  const btn = el("button", "btn tm-loadmore-btn");
  btn.type = "button";
  const btnLabel = el("span", "tm-loadmore-label", "Load more");
  const spinner = el("span", "tm-loadmore-spin");
  spinner.setAttribute("aria-hidden", "true");
  spinner.innerHTML = icon("spinner");
  btn.appendChild(spinner);
  btn.appendChild(btnLabel);
  root.appendChild(btn);

  // Error region: an assertive live line + a Retry button. Hidden until a
  // fetch rejects.
  const errorBox = el("div", "tm-loadmore-error");
  errorBox.setAttribute("role", "alert");
  errorBox.hidden = true;
  const errorText = el("span", "tm-loadmore-error-text");
  const retry = el("button", "btn tm-loadmore-retry");
  retry.type = "button";
  retry.textContent = "Retry";
  errorBox.appendChild(errorText);
  errorBox.appendChild(retry);
  root.appendChild(errorBox);

  // End note: shown when nextCursor comes back null.
  const endNote = el("div", "tm-loadmore-end", "No more items");
  endNote.hidden = true;
  root.appendChild(endNote);

  let cursor = null;
  let loading = false;
  let ended = false;

  function setLoading(on) {
    loading = on;
    btn.disabled = on;
    root.classList.toggle("loading", on);
    btnLabel.textContent = on ? "Loading" : "Load more";
  }

  function showError(err) {
    errorText.textContent = err && err.message ? err.message : "Failed to load";
    errorBox.hidden = false;
    btn.hidden = true;
  }

  function clearError() {
    errorBox.hidden = true;
    if (!ended) btn.hidden = false;
  }

  function markEnded() {
    ended = true;
    btn.hidden = true;
    endNote.hidden = false;
  }

  async function load() {
    if (loading || ended) return;
    clearError();
    setLoading(true);
    try {
      const page = await fetchPage(cursor, pageSize);
      const items = page && Array.isArray(page.items) ? page.items : [];
      onItems(items);
      cursor = page ? page.nextCursor : null;
      setLoading(false);
      if (cursor == null) markEnded();
    } catch (err) {
      setLoading(false);
      showError(err);
    }
  }

  btn.addEventListener("click", load);
  retry.addEventListener("click", load);

  // reset(): return to the first-page state (cursor null, button shown, error
  // and end cleared). Does not fetch — the next click loads page one.
  function reset() {
    cursor = null;
    ended = false;
    loading = false;
    setLoading(false);
    errorBox.hidden = true;
    endNote.hidden = true;
    btn.hidden = false;
  }

  function destroy() {
    btn.removeEventListener("click", load);
    retry.removeEventListener("click", load);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, reset, load, destroy };
}
