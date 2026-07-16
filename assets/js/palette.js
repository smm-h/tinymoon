// tinymoon — command palette: a fuzzy, source-aggregating command launcher on
// a native <dialog> (focus trap, backdrop, background inert — the same top-layer
// machinery openModal uses). It is NOT auto-installed: an app opts in explicitly
// via installPalette(), honoring the mandatory-choice philosophy (nothing binds
// a global key behind your back).
//
// Sources are the extension point: registerPaletteSource(fn) where fn(query)
// returns items — or a Promise of items — shaped {label, hint?, icon?, run()}.
// Every open re-queries all sources with the current input (debounced ~150ms,
// with stale-response discard so a slow source cannot overwrite a newer query).
//
// Ranking: the palette applies a built-in subsequence match + rank over the
// aggregated items, so a source may return its FULL, unfiltered list and let the
// palette filter. Sources MAY pre-filter (e.g. a server-side fuzzy search); the
// built-in matcher still runs over whatever they return, so pre-filtered items
// whose label does not subsequence-match the query would be dropped — return
// labels that contain the query, or widen them, if you pre-filter.

import { el } from "./dom.js";
import { icon as renderIcon } from "./icons.js";
import { pushLayer } from "./kernel.js";
import { loadingBlock, emptyBlock } from "./states.js";
import { registerShortcut } from "./shortcuts.js";

const sources = new Set();

// registerPaletteSource(fn) → unregister. fn(query) → items | Promise<items>.
export function registerPaletteSource(fn) {
  if (typeof fn !== "function") throw new Error("registerPaletteSource: fn must be a function");
  sources.add(fn);
  return () => sources.delete(fn);
}

// score(label, query) → a number (higher = better) if query is a subsequence of
// label (case-insensitive), else null. Contiguous runs and leading matches
// score higher; shorter labels break ties slightly.
export function score(label, query) {
  const s = String(label).toLowerCase();
  const q = query.toLowerCase();
  let si = 0, total = 0, streak = 0;
  for (let qi = 0; qi < q.length; qi++) {
    let found = -1;
    for (let i = si; i < s.length; i++) { if (s[i] === q[qi]) { found = i; break; } }
    if (found === -1) return null;
    streak = found === si ? streak + 1 : 1;
    total += streak * 2 + (found === 0 ? 5 : 0);
    si = found + 1;
  }
  return total - s.length * 0.01;
}

// rank(items, query) → the matching items, best first. An empty query keeps all
// items in source order (no ranking).
function rank(items, query) {
  if (!query) return items;
  const scored = [];
  for (const it of items) {
    const sc = score(it.label, query);
    if (sc !== null) scored.push({ it, sc });
  }
  scored.sort((a, b) => b.sc - a.sc);
  return scored.map((x) => x.it);
}

let openInstance = null;

// openPalette() → {close}. Returns the existing instance if already open (so a
// toggle shortcut can detect and close it). Opens a modal dialog with a search
// input; typing re-queries every source, results are keyboard-navigable
// (Up/Down move, Enter runs, Escape closes).
export function openPalette() {
  if (openInstance) return openInstance;

  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "tm-palette";
  dialog.setAttribute("aria-label", "Command palette");

  const input = el("input", "tm-palette-input");
  input.type = "text";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", "tm-palette-list");
  input.placeholder = "Type a command…";
  const list = el("div", "tm-palette-list");
  list.id = "tm-palette-list";
  list.setAttribute("role", "listbox");
  input.setAttribute("aria-activedescendant", "");
  dialog.appendChild(input);
  dialog.appendChild(list);

  document.body.appendChild(dialog);
  if (dialog.showModal) dialog.showModal();

  let items = [];       // current rendered items
  let active = -1;       // active option index
  let token = 0;         // query token for stale-discard
  let debounce = null;
  let removeLayer = null;
  let closed = false;

  function optionEls() { return list.querySelectorAll(".tm-palette-item"); }

  function setActive(i) {
    const els = optionEls();
    if (!els.length) { active = -1; input.setAttribute("aria-activedescendant", ""); return; }
    active = (i + els.length) % els.length;
    els.forEach((o, idx) => {
      const on = idx === active;
      o.classList.toggle("active", on);
      o.setAttribute("aria-selected", String(on));
      if (on) { input.setAttribute("aria-activedescendant", o.id); o.scrollIntoView({ block: "nearest" }); }
    });
  }

  function render() {
    list.replaceChildren();
    active = -1;
    items.forEach((it, idx) => {
      const o = el("div", "tm-palette-item");
      o.id = "tm-palette-item-" + idx;
      o.setAttribute("role", "option");
      o.setAttribute("aria-selected", "false");
      if (it.icon) { const s = el("span", "tm-palette-icon"); s.innerHTML = renderIcon(it.icon); o.appendChild(s); }
      o.appendChild(el("span", "tm-palette-label", it.label));
      if (it.hint) o.appendChild(el("span", "tm-palette-hint", it.hint));
      o.addEventListener("mousemove", () => setActive(idx));
      o.addEventListener("click", () => runItem(it));
      list.appendChild(o);
    });
    if (items.length) setActive(0);
  }

  function query(q) {
    const my = ++token;
    list.replaceChildren(loadingBlock({ label: "Searching…" }));
    Promise.all([...sources].map((fn) => Promise.resolve().then(() => fn(q))))
      .then((batches) => {
        if (my !== token || closed) return; // a newer query superseded this one
        const all = [];
        for (const b of batches) if (Array.isArray(b)) all.push(...b);
        items = rank(all, q);
        if (!items.length) { list.replaceChildren(emptyBlock({ title: "No matches", sub: q ? "for “" + q + "”" : "" })); return; }
        render();
      })
      .catch(() => {
        if (my !== token || closed) return;
        items = [];
        list.replaceChildren(emptyBlock({ title: "No matches" }));
      });
  }

  function runItem(it) {
    close();
    if (it && typeof it.run === "function") it.run();
  }

  function close() {
    if (closed) return;
    closed = true;
    openInstance = null;
    if (debounce) clearTimeout(debounce);
    if (removeLayer) removeLayer();
    if (dialog.close) dialog.close();
    dialog.remove();
    dialog.removeEventListener("cancel", onCancel);
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  input.addEventListener("input", () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => query(input.value.trim()), 150);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) runItem(items[active]);
    }
  });

  const onCancel = (e) => { e.preventDefault(); close(); };
  dialog.addEventListener("cancel", onCancel);
  removeLayer = pushLayer(() => close());

  input.focus();
  query(""); // seed with the full, unfiltered list

  openInstance = { close, el: dialog };
  return openInstance;
}

// installPalette({shortcut?}) → uninstall. Opt-in wiring: binds a GLOBAL toggle
// shortcut (default "mod+k") that opens the palette — or closes it if already
// open — and seeds a nav source from a mounted shell's routes (read from the
// rendered nav, so no shell internals are imported). Returns a function that
// unregisters the shortcut and the seeded source.
export function installPalette(opts) {
  const o = opts || {};
  const combo = o.shortcut || "mod+k";

  // Seed nav from the mounted shell's rendered nav items (public surface).
  const navSource = () => {
    const items = [];
    for (const b of document.querySelectorAll("#tm-nav .nav-item")) {
      const route = b.dataset.route;
      const label = (b.querySelector(".nav-label") || b).textContent.trim();
      if (route) items.push({ label, hint: "#/" + route, run: () => { location.hash = "#/" + route; } });
    }
    return items;
  };
  const offSource = registerPaletteSource(navSource);

  // Bind the GLOBAL toggle: open when closed, close when open. global:true so it
  // fires even though the open palette is itself a kernel layer; allowInInputs
  // so it works while focus is in a text field.
  const offShortcut = registerShortcut(combo, () => {
    if (openInstance) openInstance.close();
    else openPalette();
  }, { global: true, allowInInputs: true });

  return function uninstall() {
    offSource();
    offShortcut();
  };
}
