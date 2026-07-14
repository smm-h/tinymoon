// tinymoon gallery — a real tinymoon app that documents every design token
// and primitive, and doubles as the framework's conformance fixture: no
// native controls, no title attributes, no external URLs, no palette values
// outside the token block.
//
// Serve the repo root with a static server (e.g. `python3 -m http.server`)
// and open /gallery/ — ES modules do not load under file://.

import {
  $$, el, icon,
  toast, setToastErrorHook, openModal, createSelect, openPopover,
  registerCtx, registerCtxFooter,
  createSwitch, copyButton, kebabButton,
  createCheckbox, createRadio, createFileInput,
  createSegmented, createTabs,
  createDatePicker,
  createSettings, cssVar,
  mountShell, createWikiView,
  registerCopyable,
} from "../assets/js/index.js";

// ---------- settings ----------

// Created and applied before the shell mounts, so the first painted frame
// already carries the right theme.
const settings = createSettings({
  storageKey: "tinymoon-gallery",
  defaults: {
    theme: "dark",     // "dark" | "light"
    verbose: false,    // demo setting: chattier toasts
  },
});
settings.load();
settings.applyTheme();

let shell = null; // assigned by mountShell below; handlers run after mount

// ---------- tokens view ----------

const COLOR_TOKENS = [
  "--bg", "--surface", "--surface-2", "--surface-3", "--border", "--border-2",
  "--text", "--text-dim", "--text-faint",
  "--accent", "--accent-hi", "--accent-soft", "--accent-glow",
  "--accent-a12", "--accent-a18", "--accent-a35", "--accent-a40",
  "--on-accent", "--green", "--red",
  "--input-bg", "--hover-border", "--scroll-thumb", "--backdrop",
];
const LAYOUT_TOKENS = ["--sidebar-w", "--topbar-h", "--footer-h", "--grain-opacity"];
const FONT_TOKENS = ["--font-ui", "--font-mono", "--font-brand"];
const SHADOW_TOKENS = ["--shadow-card", "--shadow-pop", "--shadow-modal"];
const TEXT_TOKENS = [
  "--text-3xl", "--text-2xl", "--text-xl", "--text-lg", "--text-base",
  "--text-sm", "--text-xs", "--text-2xs", "--text-3xs",
  "--text-micro", "--text-label",
];
const WEIGHT_TOKENS = ["--weight-normal", "--weight-medium", "--weight-semibold", "--weight-bold"];
const LEADING_TOKENS = ["--leading-tight", "--leading-normal", "--leading-relaxed"];
const SPACING_TOKENS = [
  "--space-1", "--space-2", "--space-3", "--space-4", "--space-5",
  "--space-6", "--space-7", "--space-8", "--space-9", "--space-10",
  "--space-12", "--space-14", "--space-16", "--space-18", "--space-20",
  "--space-24", "--space-26", "--space-28", "--space-48",
];
const DURATION_TOKENS = ["--dur-fast", "--dur-quick", "--dur-base", "--dur-mid", "--dur-slow"];
const Z_TOKENS = ["--z-menu", "--z-modal", "--z-ctx", "--z-popover", "--z-toast", "--z-grain", "--z-tooltip"];

function panel(title, iconName) {
  const p = el("div", "panel");
  const h = el("h2");
  if (iconName) h.innerHTML = icon(iconName);
  h.appendChild(el("span", null, title));
  p.appendChild(h);
  return p;
}

const TokensView = {
  root: null,
  built: false,

  build() {
    if (this.built) return;
    this.built = true;

    const colors = panel("Color tokens", "library");
    const grid = el("div", "sw-grid");
    for (const name of COLOR_TOKENS) {
      const sw = el("div", "sw");
      const chip = el("div", "sw-chip");
      chip.style.background = "var(" + name + ")";
      sw.appendChild(chip);
      sw.appendChild(el("div", "sw-name mono", name));
      const v = el("div", "sw-val mono");
      v.dataset.token = name;
      sw.appendChild(v);
      grid.appendChild(sw);
    }
    colors.appendChild(grid);
    this.root.appendChild(colors);

    const layout = panel("Layout tokens", "faders");
    for (const name of LAYOUT_TOKENS) {
      const row = el("div", "tok-row");
      row.appendChild(el("div", "tok-name mono", name));
      const v = el("div", "tok-val mono");
      v.dataset.token = name;
      row.appendChild(v);
      layout.appendChild(row);
    }
    this.root.appendChild(layout);

    const fonts = panel("Font tokens", "note");
    for (const name of FONT_TOKENS) {
      const row = el("div", "tok-row");
      row.appendChild(el("div", "tok-name mono", name));
      const sample = el("div", "tok-val", "Sphinx of black quartz, judge my vow — 0123456789");
      sample.style.fontFamily = "var(" + name + ")";
      sample.style.fontSize = "13px";
      sample.style.color = "var(--text)";
      row.appendChild(sample);
      fonts.appendChild(row);
    }
    this.root.appendChild(fonts);

    const shadows = panel("Shadow tokens", "copy");
    for (const name of SHADOW_TOKENS) {
      const row = el("div", "tok-row");
      row.appendChild(el("div", "tok-name mono", name));
      const demo = el("div", "shadow-demo");
      demo.style.boxShadow = "var(" + name + ")";
      row.appendChild(demo);
      const v = el("div", "tok-val mono");
      v.dataset.token = name;
      row.appendChild(v);
      shadows.appendChild(row);
    }
    this.root.appendChild(shadows);

    // scale tokens: type, weight, leading, spacing, duration, z-index
    const scales = [
      ["Type scale", "note", TEXT_TOKENS],
      ["Font weight", "note", WEIGHT_TOKENS],
      ["Line height", "note", LEADING_TOKENS],
      ["Spacing scale", "faders", SPACING_TOKENS],
      ["Duration scale", "faders", DURATION_TOKENS],
      ["Z-index scale", "faders", Z_TOKENS],
    ];
    for (const [title, ic, tokens] of scales) {
      const p = panel(title, ic);
      for (const name of tokens) {
        const row = el("div", "tok-row");
        row.appendChild(el("div", "tok-name mono", name));
        const v = el("div", "tok-val mono");
        v.dataset.token = name;
        row.appendChild(v);
        p.appendChild(row);
      }
      this.root.appendChild(p);
    }
  },

  // Values are read live from the computed style, so theme switches show the
  // real resolved values.
  refresh() {
    $$("[data-token]", this.root).forEach((n) => {
      n.textContent = cssVar(n.dataset.token);
    });
  },
};
window.addEventListener("tm:theme", () => { if (TokensView.built) TokensView.refresh(); });

// ---------- typography view ----------

function typeSample(label, node) {
  const box = el("div", "type-sample");
  box.appendChild(el("div", "type-label", label));
  box.appendChild(node);
  return box;
}

const TypeView = {
  root: null,
  built: false,

  build() {
    if (this.built) return;
    this.built = true;

    const p = panel("Type system", "note");
    p.appendChild(typeSample("h1 — brand font", el("h1", null, "Instrument panel, paper and ink")));
    p.appendChild(typeSample("h2 — brand font", el("h2", null, "Three fonts, one identity")));
    p.appendChild(typeSample("h3 — brand font", el("h3", null, "Headings speak Grotesk")));
    const body = el("p", null, "Body copy uses the UI sans at 14px/1.5. It stays quiet so data and headings can carry the hierarchy. ");
    const a = el("a", null, "Links take the bright accent.");
    a.href = "#/wiki";
    body.appendChild(a);
    p.appendChild(typeSample("body — UI font", body));
    p.appendChild(typeSample("mono — data font", el("div", "mono", "0x2D7FF9 · 44100 Hz · 0:42 · every number is mono")));
    this.root.appendChild(p);

    const doc = panel("Doc text", "docs");
    const docBody = el("div", "doc-body");
    const para = el("p");
    para.appendChild(el("strong", null, "Strong text"));
    para.appendChild(document.createTextNode(" anchors a sentence; "));
    para.appendChild(el("code", null, "inline code"));
    para.appendChild(document.createTextNode(" gets a bordered chip. Doc sections use this measure for comfortable reading."));
    docBody.appendChild(para);
    doc.appendChild(docBody);
    this.root.appendChild(doc);

    const badges = panel("Badges + hashes", "info");
    const row = el("div", "demo-row");
    const badge1 = el("span", "badge", "badge");
    registerCopyable(badge1, () => ({ text: "badge" }));
    row.appendChild(badge1);
    const b2 = el("span", "badge", "with icon");
    b2.innerHTML = icon("check") + b2.innerHTML;
    registerCopyable(b2, () => ({ text: "with icon" }));
    row.appendChild(b2);
    const hashSpan = el("span", "hash", "3f9c1a7e0b2d — hashes wrap anywhere and stay faint");
    registerCopyable(hashSpan, () => ({ text: "3f9c1a7e0b2d" }));
    row.appendChild(hashSpan);
    badges.appendChild(row);
    this.root.appendChild(badges);
  },

  refresh() {},
};

// ---------- widgets view ----------

const WidgetsView = {
  root: null,
  built: false,

  build() {
    if (this.built) return;
    this.built = true;

    // buttons
    const buttons = panel("Buttons", "check");
    const brow = el("div", "demo-row");
    const plain = el("button", "btn", "Button");
    plain.addEventListener("click", () => toast("Plain button clicked"));
    const primary = el("button", "btn primary", "Primary");
    primary.addEventListener("click", () => toast("Primary button clicked"));
    const ghost = el("button", "btn ghost", "Ghost");
    ghost.addEventListener("click", () => toast("Ghost button clicked"));
    const disabled = el("button", "btn", "Disabled");
    disabled.disabled = true;
    const ib = el("button", "icon-btn");
    ib.innerHTML = icon("refresh");
    ib.dataset.tooltip = "An icon button. Hover intent is 250ms.";
    const ibOn = el("button", "icon-btn on");
    ibOn.innerHTML = icon("bookmark");
    ibOn.dataset.tooltip = "An icon button in its .on state.";
    brow.appendChild(plain);
    brow.appendChild(primary);
    brow.appendChild(ghost);
    brow.appendChild(disabled);
    brow.appendChild(ib);
    brow.appendChild(ibOn);
    buttons.appendChild(brow);
    this.root.appendChild(buttons);

    // fields + select
    const fields = panel("Fields + select", "faders");
    const frow = el("div", "field-row");
    const f1 = el("div", "field");
    f1.appendChild(el("label", null, "Text input"));
    const input = el("input");
    input.type = "text";
    input.placeholder = "type here";
    f1.appendChild(input);
    frow.appendChild(f1);
    const f2 = el("div", "field");
    f2.appendChild(el("label", null, "Custom select"));
    const sel = createSelect({
      name: "widget-demo-select",
      label: "Custom select",
      items: [
        { value: "alpha", label: "Alpha" },
        { value: "beta", label: "Beta" },
        { value: "gamma", label: "Gamma" },
        { value: "delta", label: "Delta" },
      ],
      value: "beta",
      onChange: (v) => toast("Select picked: " + v),
    });
    f2.appendChild(sel.el);
    frow.appendChild(f2);
    fields.appendChild(frow);
    const ta = el("textarea");
    ta.placeholder = "textarea — native appearance eliminated, tokens applied";
    ta.style.width = "100%";
    ta.style.marginTop = "12px";
    fields.appendChild(ta);
    this.root.appendChild(fields);

    // toggle + segmented + settings rows
    const controls = panel("Toggle, segmented, settings rows", "gear");
    const crow = el("div", "demo-row");
    crow.appendChild(createSwitch({ label: "Demo toggle", value: true, onChange: (v) => toast("Toggle: " + (v ? "on" : "off")) }).el);
    crow.appendChild(createTabs({
      label: "View mode",
      items: [
        { value: "list", label: "List" },
        { value: "grid", label: "Grid", icon: "library" },
      ],
      value: "grid",
      onChange: (v) => toast("Tabs: " + v),
    }).el);
    controls.appendChild(crow);
    const group = el("div", "set-group");
    const rows = el("div", "set-rows");
    const r1 = el("div", "set-row");
    const t1 = el("div", "set-text");
    t1.appendChild(el("div", "set-title", "Verbose toasts"));
    t1.appendChild(el("div", "set-desc", "A schema setting persisted via createSettings; changing it dispatches tm:setting."));
    r1.appendChild(t1);
    r1.appendChild(createSwitch({ label: "Verbose toasts", value: settings.get("verbose"), onChange: (v) => settings.set("verbose", v) }).el);
    rows.appendChild(r1);
    const r2 = el("div", "set-row");
    const t2 = el("div", "set-text");
    t2.appendChild(el("div", "set-title", "Theme"));
    t2.appendChild(el("div", "set-desc", "Dark instrument panel or light paper-and-ink. Applied via tm:theme."));
    r2.appendChild(t2);
    const themeTabs = createTabs({
      label: "Theme",
      items: [
        { value: "dark", label: "Dark", icon: "moon" },
        { value: "light", label: "Light", icon: "sun" },
      ],
      value: settings.get("theme"),
      onChange: (v) => settings.set("theme", v),
    });
    // stay in sync when the theme is changed elsewhere (topbar, ctx menu)
    window.addEventListener("tm:setting", (e) => {
      if (e.detail.key === "theme") themeTabs.set(e.detail.value);
    });
    r2.appendChild(themeTabs.el);
    rows.appendChild(r2);
    group.appendChild(rows);
    controls.appendChild(group);
    this.root.appendChild(controls);

    // overlays
    const overlays = panel("Toasts, modal, popover, busy", "warn");
    const orow = el("div", "demo-row");
    const tBtn = el("button", "btn", "Toast");
    tBtn.addEventListener("click", () => toast("Everything is fine"));
    const teBtn = el("button", "btn", "Error toast");
    teBtn.addEventListener("click", () => toast("Something went wrong", "err"));
    const stickyBtn = el("button", "btn", "Sticky toast");
    stickyBtn.addEventListener("click", () => toast("This toast stays until you dismiss it", "ok", { duration: 0 }));
    const mBtn = el("button", "btn", "Modal");
    mBtn.addEventListener("click", () => {
      const body = el("div");
      const p = el("p", null, "Modals close on Escape, the close button, a backdrop click, or the returned close().");
      p.style.marginTop = "0";
      body.appendChild(p);
      const ta = el("textarea");
      ta.setAttribute("aria-label", "Demo text area");
      body.appendChild(ta);
      const cancel = el("button", "btn ghost", "Cancel");
      const ok = el("button", "btn primary", "Confirm");
      const close = openModal({
        title: "Demo modal",
        body,
        actions: [cancel, ok],
        onClose: () => toast("Modal closed"),
      });
      cancel.addEventListener("click", close);
      ok.addEventListener("click", () => { close(); toast("Confirmed"); });
    });
    const pBtn = el("button", "btn", "Popover");
    pBtn.addEventListener("click", () => {
      openPopover(pBtn, (bodyEl) => {
        for (const name of ["thumbup", "thumbdown", "bookmark"]) {
          const b = el("button", "icon-btn");
          b.innerHTML = icon(name);
          b.addEventListener("click", () => toast("Popover picked: " + name));
          bodyEl.appendChild(b);
        }
      });
    });
    const busyBtn = el("button", "btn", "Busy (2s)");
    busyBtn.addEventListener("click", () => {
      shell.setBusy("crunching numbers");
      setTimeout(() => shell.setBusy(null), 2000);
    });
    orow.appendChild(tBtn);
    orow.appendChild(teBtn);
    orow.appendChild(stickyBtn);
    orow.appendChild(mBtn);
    orow.appendChild(pBtn);
    orow.appendChild(busyBtn);
    overlays.appendChild(orow);
    this.root.appendChild(overlays);

    // tooltip + hovercard + copy + kebab + context menu
    const micro = panel("Tooltip, hovercard, copy, kebab, context menu", "kebab");
    micro.dataset.ctx = "gallery-demo";
    const mrow = el("div", "demo-row");
    const tipSpan = el("span", "badge", "hover me (tooltip)");
    tipSpan.dataset.tooltip = "A plain-text tooltip. No markdown, no links, no interactive content.";
    const hcSpan = el("span", "badge", "hover me (hovercard)");
    hcSpan.dataset.hovercard = "Hovercards teach: **bold**, `code`, and [links into the wiki](#/wiki/view-contract). The hover bridge keeps this open while you reach for a link.";
    hcSpan.tabIndex = 0;
    mrow.appendChild(hcSpan);
    mrow.appendChild(tipSpan);
    mrow.appendChild(copyButton(() => "copied from the gallery", "Copy a demo string"));
    mrow.appendChild(kebabButton(() => [
      { head: "Kebab menu" },
      { label: "First action", icon: "check", action: () => toast("First action") },
      { label: "Second action", icon: "save", action: () => toast("Second action") },
      { sep: true },
      { label: "Danger-ish action", icon: "warn", action: () => toast("Careful now", "err") },
    ]));
    mrow.appendChild(el("span", "hash", "right-click anywhere in this panel for the region context menu"));
    micro.appendChild(mrow);
    this.root.appendChild(micro);

    // cards
    const cards = panel("Cards", "library");
    const cgrid = el("div", "card-grid");
    const mkCard = (title, cls, badge) => {
      const c = el("div", "card" + (cls ? " " + cls : ""));
      const row = el("div", "card-title-row");
      const t = el("div", "card-title", title);
      t.dataset.tooltip = title;
      row.appendChild(t);
      row.appendChild(kebabButton(() => [
        { label: "Card action", icon: "check", action: () => toast(title + ": action") },
      ]));
      c.appendChild(row);
      const badges = el("div", "card-badges");
      badges.appendChild(el("span", "badge", badge));
      c.appendChild(badges);
      const bodyText = el("p", null, "Cards keep a uniform grid size; extra content truncates, sparse content pads out.");
      bodyText.style.margin = "0";
      bodyText.style.color = "var(--text-dim)";
      bodyText.style.fontSize = "12.5px";
      c.appendChild(bodyText);
      return c;
    };
    cgrid.appendChild(mkCard("A resting card", "", "idle"));
    cgrid.appendChild(mkCard("An active card (accent edge + glow)", "active", "active"));
    cards.appendChild(cgrid);
    this.root.appendChild(cards);

    // stats + table
    const data = panel("Stats + data table", "compare");
    const stats = el("div", "report-stats");
    for (const [k, v] of [["items", "128"], ["errors", "0"], ["uptime", "42:07"], ["build", "0.1.0"]]) {
      const s = el("div", "stat");
      s.appendChild(el("span", "k", k));
      s.appendChild(el("span", "v", v));
      // Register each stat as copyable: "key: value"
      registerCopyable(s, () => ({ text: k + ": " + v }));
      stats.appendChild(s);
    }
    data.appendChild(stats);
    const table = el("table", "data");
    const thead = el("thead");
    const hr = el("tr");
    for (const h of ["name", "kind", "hash"]) hr.appendChild(el("th", null, h));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el("tbody");
    for (const [n, k, h] of [
      ["tokens.css", "stylesheet", "9c2fa1"],
      ["shell.js", "module", "e07d3b"],
      ["space-grotesk-latin.woff2", "font", "51bb84"],
    ]) {
      const tr = el("tr");
      tr.appendChild(el("td", null, n));
      tr.appendChild(el("td", null, k));
      tr.appendChild(el("td", "hash", h));
      // Register each table row as copyable: "name  kind  hash"
      registerCopyable(tr, () => ({ text: n + "\t" + k + "\t" + h }));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    data.appendChild(table);
    this.root.appendChild(data);

    // empty state
    const emptyPanel = panel("Empty state", "info");
    const empty = el("div", "empty");
    const ic = el("span");
    ic.innerHTML = icon("library");
    empty.appendChild(ic);
    empty.appendChild(el("div", "empty-title", "Nothing here yet"));
    empty.appendChild(el("div", "empty-sub", "empty states pair a faint icon with a mono subline"));
    emptyPanel.appendChild(empty);
    this.root.appendChild(emptyPanel);
  },

  refresh() {},
};

// context-menu region + app footer (extension points)
registerCtx("gallery-demo", () => [
  { head: "Demo region" },
  { label: "Say hello", icon: "check", action: () => toast("Hello from the region provider") },
  { label: "Open the wiki", icon: "docs", action: () => shell.navigate("wiki") },
]);
registerCtxFooter(() => [
  { head: "tinymoon gallery" },
  { label: "Tokens", icon: "library", action: () => shell.navigate("tokens") },
  { label: "Widgets", icon: "faders", action: () => shell.navigate("widgets") },
  { label: "Toggle theme", icon: "sun", action: () => settings.set("theme", settings.get("theme") === "dark" ? "light" : "dark") },
]);

// toast error hook (extension point): mirror error toasts into the console
// log — visible when pressing "Error toast" on the Widgets page.
setToastErrorHook((msg, opts) => console.error("[gallery] error toast: " + msg, opts));

// verbose demo setting: narrate setting changes
window.addEventListener("tm:setting", (e) => {
  if (settings.get("verbose") || e.detail.key === "verbose") {
    toast("Setting " + e.detail.key + " → " + e.detail.value);
  }
});

// ---------- wiki view ----------

const WIKI_SECTIONS = [
  {
    id: "what-is-tinymoon",
    title: "What is tinymoon",
    md: `
tinymoon is a **content-first web framework**: you bring plain, semantic content and small view objects; tinymoon brings the app — shell, typography, widgets, motion. Everything ships as native ES modules and plain CSS with zero dependencies, zero build steps, and zero network loads. The visual identity (sharp corners, three fonts, glow language, grain) is enforced by constraint, not offered as options.
`,
  },
  {
    id: "view-contract",
    title: "The view contract",
    md: `
A route's view is a plain object: \`{root, built, build(), refresh(), setSub?}\`. The shell's router owns the lifecycle:

- **root** — the view's \`section.view\` element. The router creates it inside \`#tm-content\` and assigns it before the first \`build()\`; views never pre-declare HTML.
- **built + build()** — \`build()\` runs on every visit and must be idempotent: guard on \`this.built\` and construct the DOM once. Build the DOM once, then mutate data in place — no re-render passes.
- **refresh()** — runs on every visit, after the view is shown. Cheap updates belong here.
- **setSub(sub)** — optional. A deep link \`#/key/a/b\` delivers \`"a/b"\` before \`refresh()\` runs.

Routing to a different view retriggers the 180ms entry animation and resets the content scroll; revisiting the same view does neither.
`,
  },
  {
    id: "extension-points",
    title: "Extension points",
    md: `
Consumer apps extend tinymoon through explicit seams, never by patching internals:

- **Routes** — \`mountShell({routes})\`: each key maps to a title, an icon, and a view factory. \`hidden: true\` keeps a route out of the sidebar but routable.
- **Legacy routes** — \`legacyRoutes: {old: "new"}\` redirects stale bookmarks, tails included.
- **Route hook** — \`onRoute: (routeKey, sub) => …\` fires after the router finishes handling a route (view built, \`setSub\` applied, \`refresh()\` run, title set), including the initial route; \`routeKey\` is the resolved key after legacy redirects and \`sub\` is the deep-link tail or \`null\`. The shell object returned by \`mountShell\` also exposes \`refreshCurrent()\`, which re-runs the current view's \`refresh()\` in place — no rebuild, no entry animation.
- **Topbar actions** — \`topbarActions\`: prebuilt nodes or \`{icon, tip, onClick}\` specs rendered right of the busy indicator.
- **Footer slot** — \`footer: {height, node}\` pins an app-owned bar to the bottom; the shell sets \`--footer-h\` so the frame, toasts, tooltips, selects, and popovers all clear it.
- **Context menus** — \`registerCtx(key, provider)\` serves right-clicks on \`[data-ctx]\` regions; \`registerCtxFooter(fn)\` appends app-global items to every menu.
- **Settings schema** — \`createSettings({storageKey, defaults})\`: the defaults object is the schema; unknown keys are hard errors.
- **Icons** — \`registerIcons({name: svgString})\` merges consumer icons into the built-in set; a name collision with an existing icon is a hard error, never a silent overwrite.
- **Toast error hook** — \`setToastErrorHook(fn)\` mirrors every error toast's message into your hook (e.g. a log), invoked as \`fn(message, opts)\` where opts is the toast's own opts object (\`{}\` when the caller passed none) so per-call metadata reaches the hook; registering a second hook is a hard error, never a silent overwrite. This gallery mirrors error toasts (message and opts) to the browser console — press the **Error toast** button on the Widgets page with the console open.

### Custom components {#custom-components}

There is no plugin API for components — \`el()\`, the tokens, and the primitives are the component language. A well-written consumer component (see the **Custom component** route) is indistinguishable from a built-in: it reads colors via \`cssVar()\`, uses \`data-tooltip\` instead of titles, and never touches a native control.
`,
  },
  {
    id: "events",
    title: "Events",
    md: `
The framework dispatches exactly two events, both on \`window\`:

- **tm:theme** — the theme was (re)applied to \`<html data-theme>\`. Canvas-drawing components repaint on this, pulling fresh values with \`cssVar()\`.
- **tm:setting** — any setting changed; \`event.detail\` is \`{key, value}\`.
`,
  },
  {
    id: "primitive-api",
    title: "Primitive API convention",
    md: `
Every tinymoon primitive follows a single convention. A factory function \`createX(opts)\` accepts an options object and returns an instance — never a raw DOM node with methods bolted on, never a class you \`new\`. The instance carries an \`.el\` property (the root \`HTMLElement\`) and named methods (\`.set(v)\`, \`.destroy()\`, etc.). Application code appends \`instance.el\` to the DOM and calls methods on the instance; the DOM node itself has no expando properties.

### Required accessibility {#primitive-a11y}

Primitives that represent form controls accept a \`label\` (or \`name\`, where appropriate) option. Omitting it is a hard error — the factory throws. Primitives that participate in forms use a hidden native element internally so form submission and autofill still work; the visible UI is always custom-drawn.

### The destroy contract {#primitive-destroy}

Every instance exposes \`.destroy()\`. Calling it removes the root element from its parent, detaches every event listener the factory registered, and releases any internal references. After \`.destroy()\`, the instance is inert — calling methods on it is a no-op or a throw, never a silent bug. Teardown is required when a primitive is removed before the page unloads (e.g. inside a single-page view that rebuilds).

### Rationale {#primitive-rationale}

One convention for all primitives means no per-widget learning curve. No expandos eliminates an entire class of DOM-identity bugs where the node is cloned or replaced and the methods vanish. Required accessibility params prevent silent inaccessibility. The destroy contract prevents listener leaks in long-lived single-page apps.
`,
  },
  {
    id: "theming",
    title: "Tokens and theming",
    md: `
\`tokens.css\` is the single source of truth: every color, font, shadow, and layout measure is a custom property on \`:root\`, overridden per theme on \`html[data-theme="light"]\`. Rules everywhere else — and canvas code, via \`cssVar()\` — reference tokens only. Re-theming means overriding tokens; the identity constants (radius 0, fonts, motion timing, grain) are not tokens and cannot be opted out of.
`,
  },
];

const WikiView = createWikiView({ route: "wiki", sections: WIKI_SECTIONS });

// ---------- custom component view (consumer-defined) ----------

// A consumer-defined sparkline card: built with el(), colored exclusively
// through cssVar() so it repaints correctly on theme changes — the pattern
// every custom component should follow.
function sparklineCard(title, phase) {
  const card = el("div", "card");
  const row = el("div", "card-title-row");
  row.appendChild(el("div", "card-title", title));
  card.appendChild(row);
  const canvas = el("canvas", "spark-canvas");
  card.appendChild(canvas);
  const caption = el("div", "hash");
  card.appendChild(caption);

  const paint = () => {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 60;
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    const ctx = canvas.getContext("2d");
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = cssVar("--border-2");
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.strokeStyle = cssVar("--accent");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = h / 2 - Math.sin(x / 18 + phase) * Math.cos(x / 47) * (h / 2 - 6);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    caption.textContent = "stroke: " + cssVar("--accent") + " (read live via cssVar)";
  };
  card.paint = paint;
  window.addEventListener("tm:theme", paint);
  return card;
}

const CustomView = {
  root: null,
  built: false,
  visits: 0,

  build() {
    if (this.built) return;
    this.built = true;
    const p = panel("A consumer-defined component", "wave");
    const note = el("p", null,
      "This route is not a built-in: it is what any app writes. It follows the view contract, builds its DOM once, and pulls every canvas color from the tokens.");
    note.style.marginTop = "0";
    note.style.color = "var(--text-dim)";
    note.style.fontSize = "13px";
    p.appendChild(note);
    this.grid = el("div", "card-grid");
    this.cards = [sparklineCard("sine·cos A", 0), sparklineCard("sine·cos B", 2.1), sparklineCard("sine·cos C", 4.2)];
    for (const c of this.cards) this.grid.appendChild(c);
    p.appendChild(this.grid);
    this.meta = el("div", "hash");
    p.appendChild(this.meta);
    this.root.appendChild(p);
  },

  // refresh() runs on every visit — canvases size themselves here because
  // the section is visible (and thus measurable) by the time it runs.
  refresh() {
    this.visits += 1;
    this.meta.textContent = "refresh() calls so far: " + this.visits;
    for (const c of this.cards) c.paint();
  },
};

// ---------- forms view ----------

const FormsView = {
  root: null,
  built: false,

  build() {
    if (this.built) return;
    this.built = true;

    const p = panel("Form primitives", "gear");
    const note = el("p", null,
      "Every form control below uses a hidden native input for form participation and accessibility. The visible UI is custom-drawn. Submitting the form proves the values reach FormData.");
    note.style.marginTop = "0";
    note.style.color = "var(--text-dim)";
    note.style.fontSize = "13px";
    p.appendChild(note);

    // switch (not form-participating, outside the form)
    const switchRow = el("div", "demo-row");
    const sw = createSwitch({ label: "Standalone switch", value: false, onChange: (v) => toast("Switch: " + (v ? "on" : "off")) });
    switchRow.appendChild(sw.el);
    switchRow.appendChild(el("span", "hash", "switch — role=\"switch\" button, not form-participating"));
    p.appendChild(switchRow);

    // form with checkbox, radio, file, submit
    const form = el("form");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "var(--space-14)";

    // checkboxes
    const cbSection = el("div");
    cbSection.appendChild(el("div", "set-title", "Checkboxes"));
    const cbRow = el("div", "demo-row");
    cbRow.style.marginTop = "var(--space-8)";
    const cb1 = createCheckbox({ name: "notifications", label: "Enable notifications", checked: true });
    const cb2 = createCheckbox({ name: "analytics", label: "Send analytics" });
    cbRow.appendChild(cb1.el);
    cbRow.appendChild(cb2.el);
    cbSection.appendChild(cbRow);
    form.appendChild(cbSection);

    // radios
    const radioSection = el("div");
    radioSection.appendChild(el("div", "set-title", "Radio group"));
    const radioRow = el("div", "demo-row");
    radioRow.style.marginTop = "var(--space-8)";
    const r1 = createRadio({ name: "priority", label: "Low", value: "low" });
    const r2 = createRadio({ name: "priority", label: "Medium", value: "medium", checked: true });
    const r3 = createRadio({ name: "priority", label: "High", value: "high" });
    // sync radio indicators when the group changes
    function syncRadios() {
      for (const r of [r1, r2, r3]) {
        const inp = r.el.querySelector("input");
        r.el.querySelector(".tm-radio-indicator").classList.toggle("checked", inp.checked);
      }
    }
    for (const r of [r1, r2, r3]) {
      r.el.querySelector("input").addEventListener("change", syncRadios);
    }
    radioRow.appendChild(r1.el);
    radioRow.appendChild(r2.el);
    radioRow.appendChild(r3.el);
    radioSection.appendChild(radioRow);
    form.appendChild(radioSection);

    // segmented (form-participating)
    const segSection = el("div");
    segSection.appendChild(el("div", "set-title", "Segmented control"));
    const segRow = el("div", "demo-row");
    segRow.style.marginTop = "var(--space-8)";
    const seg = createSegmented({
      name: "size",
      label: "Size",
      items: [
        { value: "s", label: "S" },
        { value: "m", label: "M" },
        { value: "l", label: "L" },
        { value: "xl", label: "XL" },
      ],
      value: "m",
      onChange: (v) => toast("Segmented: " + v),
    });
    segRow.appendChild(seg.el);
    segRow.appendChild(el("span", "hash", "segmented — hidden radios, form-participating"));
    segSection.appendChild(segRow);
    form.appendChild(segSection);

    // file input
    const fileSection = el("div");
    fileSection.appendChild(el("div", "set-title", "File input"));
    const fileRow = el("div", "demo-row");
    fileRow.style.marginTop = "var(--space-8)";
    const fi = createFileInput({ name: "attachment", label: "Choose file", accept: ".txt,.json,.md" });
    fileRow.appendChild(fi.el);
    fileSection.appendChild(fileRow);
    form.appendChild(fileSection);

    // date picker
    const dpSection = el("div");
    dpSection.appendChild(el("div", "set-title", "Date picker"));
    const dpRow = el("div", "demo-row");
    dpRow.style.marginTop = "var(--space-8)";
    const dp = createDatePicker({
      name: "event-date",
      label: "Event date",
      value: "2026-07-14",
      onChange: (v) => toast("Date selected: " + v),
    });
    dpRow.appendChild(dp.el);
    dpSection.appendChild(dpRow);
    form.appendChild(dpSection);

    // select
    const selSection = el("div");
    selSection.appendChild(el("div", "set-title", "Select"));
    const selRow = el("div", "demo-row");
    selRow.style.marginTop = "var(--space-8)";
    const formSel = createSelect({
      name: "region",
      label: "Region",
      items: [
        { value: "us-east", label: "US East" },
        { value: "us-west", label: "US West" },
        { value: "eu-west", label: "EU West" },
      ],
      value: "us-east",
    });
    selRow.appendChild(formSel.el);
    selSection.appendChild(selRow);
    form.appendChild(selSection);

    // submit
    const submitRow = el("div", "demo-row");
    submitRow.style.marginTop = "var(--space-12)";
    const submitBtn = el("button", "btn primary", "Submit form");
    submitBtn.type = "submit";
    submitRow.appendChild(submitBtn);
    form.appendChild(submitRow);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const entries = [];
      for (const [k, v] of fd.entries()) {
        if (v instanceof File) {
          entries.push(k + ": " + (v.name || "(empty)"));
        } else {
          entries.push(k + ": " + v);
        }
      }
      toast("FormData: " + (entries.length ? entries.join(", ") : "(empty)"));
    });

    p.appendChild(form);
    this.root.appendChild(p);
  },

  refresh() {},
};

// ---------- mount ----------

const themeBtn = el("button", "icon-btn");
themeBtn.type = "button";
themeBtn.dataset.tooltip = "Toggle between the dark and light themes.";
const paintThemeBtn = () => {
  themeBtn.innerHTML = icon(settings.get("theme") === "dark" ? "sun" : "moon");
};
themeBtn.addEventListener("click", () => {
  settings.set("theme", settings.get("theme") === "dark" ? "light" : "dark");
});
window.addEventListener("tm:setting", (e) => { if (e.detail.key === "theme") paintThemeBtn(); });
paintThemeBtn();

const footerNode = el("footer", "gallery-footer");
footerNode.appendChild(el("span", null, "footer slot demo — the shell sets --footer-h from footer.height"));

shell = mountShell({
  root: document.body,
  brand: {
    name: "tinymoon",
    logoHTML: '<div class="wordmark">tiny<b>moon</b></div><div class="tagline">ui gallery</div>',
  },
  routes: {
    tokens: {
      title: "Tokens", icon: "library", view: () => TokensView,
      tip: "Tokens -- every design token with its live value, read from the active theme.",
    },
    type: {
      title: "Typography", icon: "note", view: () => TypeView,
      tip: "Typography -- the three-font system: brand headings, UI body, mono data.",
    },
    widgets: {
      title: "Widgets", icon: "faders", view: () => WidgetsView,
      tip: "Widgets -- every primitive, live: buttons, fields, select, toggles, toasts, modal, tooltips, menus, cards, tables.",
    },
    wiki: {
      title: "Wiki", icon: "docs", view: () => WikiView,
      tip: "Wiki -- the view contract and every extension point, with deep-linkable anchors.",
    },
    forms: {
      title: "Forms", icon: "save", view: () => FormsView,
      tip: "Forms -- segmented, checkbox, radio, file input, and switch, all form-participating (except switch). Submit proves values reach FormData.",
    },
    custom: {
      title: "Custom component", icon: "wave", view: () => CustomView,
      tip: "Custom component -- a consumer-defined view following the contract, indistinguishable from a built-in.",
    },
    content: {
      title: "Content-first", icon: "docs",
      view: '<h2>Content-first proof</h2>'
        + '<p>This view uses the <strong>declarative view path</strong>: its view is an HTML string, not a view object. Every element below is plain semantic HTML with <em>zero framework classes</em>.</p>'
        + '<h3>Headings</h3><h4>Fourth level</h4><h5>Fifth level</h5><h6>Sixth level</h6>'
        + '<hr>'
        + '<h3>Lists</h3>'
        + '<ul><li>Unordered item one</li><li>Unordered item two<ul><li>Nested item</li></ul></li><li>Item three</li></ul>'
        + '<ol><li>Ordered item one</li><li>Ordered item two<ol><li>Nested ordered</li></ol></li><li>Item three</li></ol>'
        + '<h3>Blockquote</h3>'
        + '<blockquote><p>A blockquote with an accent left border. No classes needed.</p></blockquote>'
        + '<h3>Code</h3>'
        + '<p>Inline <code>code</code> uses the mono font. Block code:</p>'
        + '<pre><code>const x = 42;\nconsole.log(x);</code></pre>'
        + '<h3>Table</h3>'
        + '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Alpha</td><td>1</td></tr><tr><td>Beta</td><td>2</td></tr></tbody></table>'
        + '<h3>Definition list</h3>'
        + '<dl><dt>Term</dt><dd>The definition of the term.</dd><dt>Another term</dt><dd>Its definition.</dd></dl>'
        + '<h3>Figure</h3>'
        + '<figure><div style="height:60px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-faint);">image placeholder</div><figcaption>A figure with a mono caption.</figcaption></figure>'
        + '<p><a href="#/wiki">Back to the wiki</a></p>',
      tip: "Content-first -- plain semantic HTML styled by the framework with zero classes, demonstrating the declarative view path.",
    },
  },
  defaultRoute: "tokens",
  legacyRoutes: { docs: "wiki" },
  topbarActions: [themeBtn],
  footer: { height: "40px", node: footerNode },
});
