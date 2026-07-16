// tinymoon — breadcrumbs: a caller-supplied navigation trail.
// createBreadcrumbs({items, onNavigate?}) -> {el, setItems, destroy}.
//
// ROUTER-AGNOSTIC by decision. tinymoon ships no router, so breadcrumbs never
// assume one. `items` is a flat trail of {label, href?}; an item with an href
// renders a real <a> (hash routing, full URLs, anything works), an item with no
// href but an onNavigate handler renders a <button>, and the LAST item is
// always the current page — rendered as a non-interactive span with
// aria-current="page". onNavigate(item, index) fires on activation but never
// preventDefaults: if you gave the crumb an href, the browser follows it; if
// you want pure-JS routing, omit href and route inside onNavigate.
//
// Semantics: a nav[aria-label="Breadcrumb"] wrapping an <ol>; chevron
// separators are drawn in CSS between list items. When the trail exceeds ~6
// items it collapses the middle into an expandable "…" affordance (first item +
// ellipsis + the last few), so a deep path never blows out the bar; clicking
// the ellipsis expands the full trail.

import { el } from "./dom.js";

// Beyond this many items the middle collapses to an ellipsis.
const COLLAPSE_THRESHOLD = 6;
// When collapsed, keep this many trailing items visible after the first.
const TAIL_KEEP = 4;

// createBreadcrumbs({items, onNavigate?}) -> {el, setItems(items), destroy}.
export function createBreadcrumbs(opts) {
  if (!opts || !Array.isArray(opts.items)) {
    throw new Error("createBreadcrumbs: an items array is required");
  }
  const onNavigate = typeof opts.onNavigate === "function" ? opts.onNavigate : null;

  const root = el("nav", "tm-crumbs-nav");
  root.setAttribute("aria-label", "Breadcrumb");
  const ol = el("ol", "tm-crumbs");
  root.appendChild(ol);

  let items = opts.items;
  let expanded = false;

  function crumbContent(item, index, isLast) {
    const label = item && item.label != null ? String(item.label) : "";
    if (isLast) {
      const span = el("span", "tm-crumb-current", label);
      span.setAttribute("aria-current", "page");
      return span;
    }
    if (item && item.href != null) {
      const a = el("a", "tm-crumb-link", label);
      a.href = String(item.href);
      if (onNavigate) a.addEventListener("click", () => onNavigate(item, index));
      return a;
    }
    if (onNavigate) {
      const btn = el("button", "tm-crumb-link", label);
      btn.type = "button";
      btn.addEventListener("click", () => onNavigate(item, index));
      return btn;
    }
    return el("span", "tm-crumb-static", label);
  }

  function liFor(item, index, isLast) {
    const li = el("li", "tm-crumb");
    li.appendChild(crumbContent(item, index, isLast));
    return li;
  }

  function render() {
    ol.textContent = "";
    const n = items.length;
    const collapse = !expanded && n > COLLAPSE_THRESHOLD;

    if (!collapse) {
      items.forEach((item, i) => ol.appendChild(liFor(item, i, i === n - 1)));
      return;
    }

    // First item, an expandable ellipsis, then the trailing TAIL_KEEP items.
    ol.appendChild(liFor(items[0], 0, false));

    const li = el("li", "tm-crumb tm-crumb-ellipsis");
    const btn = el("button", "tm-crumb-more", "…");
    btn.type = "button";
    btn.setAttribute("aria-label", "Show " + (n - 1 - TAIL_KEEP) + " hidden breadcrumbs");
    btn.addEventListener("click", () => { expanded = true; render(); });
    li.appendChild(btn);
    ol.appendChild(li);

    for (let i = n - TAIL_KEEP; i < n; i++) {
      ol.appendChild(liFor(items[i], i, i === n - 1));
    }
  }

  function setItems(next) {
    items = Array.isArray(next) ? next : [];
    expanded = false;
    render();
  }

  render();

  function destroy() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, setItems, destroy };
}
