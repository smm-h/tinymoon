// tinymoon gallery — a real tinymoon app that documents every design token
// and primitive, and doubles as the framework's conformance fixture: no
// native controls, no title attributes, no external URLs, no palette values
// outside the token block.
//
// Serve the repo root with a static server (e.g. `python3 -m http.server`)
// and open /gallery/ — ES modules do not load under file://.

import {
  $$, el, icon,
  toast, setToastErrorHook, openModal, Select, openPopover,
  registerCtx, registerCtxFooter,
  toggleWidget, segmented, copyButton, kebabButton,
  createSettings, cssVar,
  mountShell, createWikiView,
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
  "--accent-a12", "--accent-a18", "--accent-a35", "--accent-a40", "--accent-a45",
  "--on-accent", "--green", "--green-soft", "--orange", "--purple",
  "--red", "--red-soft", "--gold",
  "--input-bg", "--hover-border", "--scroll-thumb", "--overlay", "--backdrop",
];
const LAYOUT_TOKENS = ["--sidebar-w", "--topbar-h", "--footer-h", "--grain-opacity"];
const FONT_TOKENS = ["--font-ui", "--font-mono", "--font-brand"];
const SHADOW_TOKENS = ["--shadow-card", "--shadow-pop", "--shadow-modal"];

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
    row.appendChild(el("span", "badge", "badge"));
    const b2 = el("span", "badge", "with icon");
    b2.innerHTML = icon("check") + b2.innerHTML;
    row.appendChild(b2);
    row.appendChild(el("span", "hash", "3f9c1a7e0b2d — hashes wrap anywhere and stay faint"));
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
    ib.dataset.tooltip = "An icon button. Hover intent is 250ms; this text is **mini-markdown**.";
    const ibOn = el("button", "icon-btn on");
    ibOn.innerHTML = icon("bookmark");
    ibOn.dataset.tooltip = "An icon button in its `.on` state.";
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
    const sel = new Select({
      items: ["alpha", "beta", "gamma", "delta"],
      value: "beta",
      labels: { alpha: "Alpha", beta: "Beta", gamma: "Gamma", delta: "Delta" },
      onChange: (v) => toast("Select picked: " + v),
    });
    f2.appendChild(sel.root);
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
    crow.appendChild(toggleWidget(true, (v) => toast("Toggle: " + (v ? "on" : "off"))));
    crow.appendChild(segmented({
      items: [
        { value: "list", label: "List" },
        { value: "grid", label: "Grid", icon: "library" },
        { value: "off", label: "Off", disabled: true },
      ],
      value: "grid",
      onChange: (v) => toast("Segmented: " + v),
    }));
    controls.appendChild(crow);
    const group = el("div", "set-group");
    const rows = el("div", "set-rows");
    const r1 = el("div", "set-row");
    const t1 = el("div", "set-text");
    t1.appendChild(el("div", "set-title", "Verbose toasts"));
    t1.appendChild(el("div", "set-desc", "A schema setting persisted via createSettings; changing it dispatches tm:setting."));
    r1.appendChild(t1);
    r1.appendChild(toggleWidget(settings.get("verbose"), (v) => settings.set("verbose", v)));
    rows.appendChild(r1);
    const r2 = el("div", "set-row");
    const t2 = el("div", "set-text");
    t2.appendChild(el("div", "set-title", "Theme"));
    t2.appendChild(el("div", "set-desc", "Dark instrument panel or light paper-and-ink. Applied via tm:theme."));
    r2.appendChild(t2);
    const themeSeg = segmented({
      items: [
        { value: "dark", label: "Dark", icon: "moon" },
        { value: "light", label: "Light", icon: "sun" },
      ],
      value: settings.get("theme"),
      onChange: (v) => settings.set("theme", v),
    });
    // stay in sync when the theme is changed elsewhere (topbar, ctx menu)
    window.addEventListener("tm:setting", (e) => {
      if (e.detail.key === "theme") themeSeg.set(e.detail.value);
    });
    r2.appendChild(themeSeg);
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
    const mBtn = el("button", "btn", "Modal");
    mBtn.addEventListener("click", () => {
      const body = el("div");
      const p = el("p", null, "Modals close on Escape, the close button, a backdrop click, or the returned close().");
      p.style.marginTop = "0";
      body.appendChild(p);
      body.appendChild(el("textarea"));
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
    orow.appendChild(mBtn);
    orow.appendChild(pBtn);
    orow.appendChild(busyBtn);
    overlays.appendChild(orow);
    this.root.appendChild(overlays);

    // tooltip + copy + kebab + context menu
    const micro = panel("Tooltip, copy, kebab, context menu", "kebab");
    micro.dataset.ctx = "gallery-demo";
    const mrow = el("div", "demo-row");
    const tipSpan = el("span", "badge", "hover me");
    tipSpan.dataset.tooltip = "Tooltips teach: **bold**, `code`, and [links into the wiki](#/wiki/view-contract). The hover bridge keeps this open while you reach for the copy icon.";
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
setToastErrorHook((msg) => console.error("[gallery] error toast: " + msg));

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
- **Toast error hook** — \`setToastErrorHook(fn)\` mirrors every error toast's message into your hook (e.g. a log); registering a second hook is a hard error, never a silent overwrite. This gallery mirrors error toasts to the browser console — press the **Error toast** button on the Widgets page with the console open.

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

// ---------- mount ----------

const themeBtn = el("button", "icon-btn");
themeBtn.type = "button";
themeBtn.dataset.tooltip = "Toggle between the dark and light themes. The icon shows the theme it switches **to**.";
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
      tip: "**Tokens** — every design token with its live value, read from the active theme.",
    },
    type: {
      title: "Typography", icon: "note", view: () => TypeView,
      tip: "**Typography** — the three-font system: brand headings, UI body, mono data.",
    },
    widgets: {
      title: "Widgets", icon: "faders", view: () => WidgetsView,
      tip: "**Widgets** — every primitive, live: buttons, fields, select, toggles, toasts, modal, tooltips, menus, cards, tables.",
    },
    wiki: {
      title: "Wiki", icon: "docs", view: () => WikiView,
      tip: "**Wiki** — the view contract and every extension point, with deep-linkable anchors.",
    },
    custom: {
      title: "Custom component", icon: "wave", view: () => CustomView,
      tip: "**Custom component** — a consumer-defined view following the contract, indistinguishable from a built-in.",
    },
  },
  defaultRoute: "tokens",
  legacyRoutes: { docs: "wiki" },
  topbarActions: [themeBtn],
  footer: { height: "40px", node: footerNode },
});
