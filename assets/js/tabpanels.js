// tinymoon — createTabPanels: the tab bar (createTabs) composed with a panel
// region, completing the APG tabs pattern. It reuses createTabs' ARIA and
// keyboard model (role="tablist", arrow-key navigation) and adds:
//   - role="tabpanel" containers wired with aria-labelledby ↔ aria-controls,
//   - lazy, idempotent per-panel build() on first activation,
//   - state-preserving switching: inactive panels are HIDDEN, never destroyed,
//     so scroll position, form state, and DOM survive tab switches.

import { el } from "./dom.js";
import { createTabs } from "./controls.js";

let idc = 0;

// createTabPanels({label, items: [{value, label, icon?, build(panel)}], value?})
// → {el, set(v), value (getter), destroy()}.
export function createTabPanels(opts) {
  if (!opts || !opts.label) throw new Error("createTabPanels: label is required");
  if (!opts.items || !opts.items.length) throw new Error("createTabPanels: items is required");
  const { label, items, value: initial } = opts;
  const uid = ++idc;

  const wrap = el("div", "tm-tabpanels");
  const body = el("div", "tm-tabpanels-body");

  // The tab bar. Its onChange is the single activation entry point (clicks and
  // arrow-key navigation both route through it).
  const tabs = createTabs({
    label,
    items: items.map((it) => ({ value: it.value, label: it.label, icon: it.icon })),
    value: initial,
    onChange: activate,
  });
  wrap.appendChild(tabs.el);
  wrap.appendChild(body);

  // Build hidden panel containers and complete the APG aria wiring. The tab
  // buttons live inside tabs.el in items order.
  const panels = new Map(); // value → {panel, build, built}
  const tabButtons = tabs.el.querySelectorAll('[role="tab"]');
  items.forEach((it, i) => {
    const tabBtn = tabButtons[i];
    const tabId = "tm-tab-" + uid + "-" + i;
    const panelId = "tm-tabpanel-" + uid + "-" + i;
    tabBtn.id = tabId;
    tabBtn.setAttribute("aria-controls", panelId);
    const panel = el("div", "tm-tabpanel");
    panel.id = panelId;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tabId);
    panel.tabIndex = 0; // focusable per APG (panels have no guaranteed content)
    panel.hidden = true;
    panels.set(it.value, { panel, build: it.build, built: false });
    body.appendChild(panel);
  });

  function activate(v) {
    for (const [val, entry] of panels) entry.panel.hidden = val !== v;
    const entry = panels.get(v);
    if (entry && !entry.built) {
      entry.built = true;
      if (entry.build) entry.build(entry.panel);
    }
  }

  // createTabs' constructor selected the initial tab but did NOT fire onChange,
  // so activate the matching panel now (builds it lazily too).
  activate(initial !== undefined ? initial : items[0].value);

  return {
    el: wrap,
    set(v) { tabs.set(v); activate(v); },
    get value() { return tabs.value; },
    destroy() {
      tabs.destroy();
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}
