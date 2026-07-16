// tinymoon gallery — a real tinymoon app that documents every design token
// and primitive, and doubles as the framework's conformance fixture: no
// native controls, no title attributes, no external URLs, no palette values
// outside the token block.
//
// Serve the repo root with a static server (e.g. `python3 -m http.server`)
// and open /gallery/ — ES modules do not load under file://.

import {
  $$, el, icon,
  toast, setToastErrorHook, openModal, createSelect, createEmbed, openPopover,
  registerCtx, registerCtxFooter,
  createSwitch, copyButton, kebabButton,
  createCheckbox, createRadio, createFileInput,
  createSegmented, createTabs,
  createInput, createTextarea, createField, createSlider, createNumber,
  createDatePicker, createTimePicker,
  createCombobox, createMultiSelect,
  createAccordion,
  cssVar,
  mountShell,
  createView,
  openDrawer,
  createTabPanels,
  createGrid,
  iconButton,
  registerCopyable,
} from "../assets/js/index.js";

import {
  api, post, ApiError, setAuthHeader,
  sse, socket,
  fmtTime, relativeTime, liveRelativeTime,
  createSettings, cycleTheme,
  renderDocMd,
  createWikiView,
} from "../assets/js/extras.js";

import {
  loadingBlock, emptyBlock, errorBlock, renderAsync,
  lazyMount,
  registerPaletteSource, installPalette,
  registerOverlayTrigger,
} from "../assets/js/chrome.js";

import {
  createStore, bind, reconcile,
} from "../assets/js/state.js";

import {
  badge, createStat, renderStats, createTable, createVirtualList,
  createTree, createFilterBar, createChips, createLoadMore,
  createBreadcrumbs, createSparkline, createChartContainer, createFeed,
} from "../assets/js/widgets.js";

// ---------- settings ----------

// Created and applied before the shell mounts, so the first painted frame
// already carries the right theme.
const settings = createSettings({
  storageKey: "tinymoon-gallery",
  defaults: {
    theme: "dark",     // "dark" | "light" | "system"
    verbose: false,    // demo setting: chattier toasts
  },
});
settings.load();
settings.applyTheme();

let shell = null; // assigned by mountShell below; handlers run after mount

// ---------- tokens view ----------

// Token names, grouping membership, and order are DERIVED from the committed
// export artifact (assets/tokens.json, generated from assets/css/tokens.css by
// scripts/gen_tokens_json.py) rather than hand-listed here. Single source of
// truth: a token added to the CSS surfaces in the gallery automatically and
// can never be silently forgotten. The mapping layer below carries only
// presentation metadata the raw artifact lacks -- panel title, icon, render
// style, and the one curated intra-group ordering (layout) -- never the token
// names themselves.
//
// Same-origin fetch: the gallery is served from the repo root, so the artifact
// resolves next to the assets it mirrors. Values are still read live from
// computed styles at render time (see refresh()), so theme switches show real
// resolved values including color-mix() results the artifact leaves declared
// but unresolved.
const tokensArtifact = await fetch(new URL("../assets/tokens.json", import.meta.url))
  .then((r) => r.json());

const DEFAULT_TOKENS = tokensArtifact.themes.default.tokens;
const DEFAULT_TOKEN_NAMES = Object.keys(DEFAULT_TOKENS); // CSS declaration order

// Runtime-only tokens the shell sets at mount (e.g. the collapsed-sidebar
// brand initial, an empty string until configured): nothing static to show.
const HIDDEN_TOKENS = new Set(["--brand-initial"]);

// A value that is a pure color literal (hex, rgb/rgba, hsl/hsla, color-mix).
// Shadow and size values do not match, so colors classify cleanly by value.
function isColorValue(v) {
  return /^(#|rgba?\(|hsla?\(|color-mix\()/.test(v.trim());
}

const LAYOUT_TOKEN_ORDER = ["--sidebar-w", "--topbar-h", "--footer-h", "--grain-opacity"];

// Ordered group specs. Each declared token joins the FIRST group whose match()
// returns true; the page renders groups in this order. `style` selects the
// renderer; `order` (optional) pins intra-group order where curation differs
// from CSS declaration order.
const TOKEN_GROUPS = [
  { title: "Color tokens", icon: "library", style: "color",
    match: (name, value) => isColorValue(value) },
  { title: "Layout tokens", icon: "faders", style: "row", order: LAYOUT_TOKEN_ORDER,
    match: (name) => LAYOUT_TOKEN_ORDER.includes(name) },
  { title: "Font tokens", icon: "note", style: "font",
    match: (name) => name.startsWith("--font-") },
  { title: "Shadow tokens", icon: "copy", style: "shadow",
    match: (name) => name.startsWith("--shadow-") },
  { title: "Type scale", icon: "note", style: "row",
    match: (name) => name.startsWith("--text-") },
  { title: "Font weight", icon: "note", style: "row",
    match: (name) => name.startsWith("--weight-") },
  { title: "Line height", icon: "note", style: "row",
    match: (name) => name.startsWith("--leading-") },
  { title: "Spacing scale", icon: "faders", style: "row",
    match: (name) => name.startsWith("--space-") },
  { title: "Duration scale", icon: "faders", style: "row",
    match: (name) => name.startsWith("--dur-") },
  { title: "Z-index scale", icon: "faders", style: "row",
    match: (name) => name.startsWith("--z-") },
];

// Catch-all so a declared token claimed by no group above still renders --
// completeness guarantee: nothing declared can vanish from the gallery.
const OTHER_GROUP = { title: "Other tokens", icon: "library", style: "row" };

// Classify declared default-theme tokens into groups. Returns
// [{ title, icon, style, names }] in render order, skipping empty groups.
function classifyTokens() {
  const buckets = TOKEN_GROUPS.map((group) => ({ group, names: [] }));
  const other = [];
  for (const name of DEFAULT_TOKEN_NAMES) {
    if (HIDDEN_TOKENS.has(name)) continue;
    const idx = TOKEN_GROUPS.findIndex((g) => g.match(name, DEFAULT_TOKENS[name]));
    if (idx === -1) { other.push(name); continue; }
    buckets[idx].names.push(name);
  }
  const groups = [];
  for (const { group, names } of buckets) {
    if (!names.length) continue;
    let ordered = names;
    if (group.order) {
      const rank = (n) => {
        const i = group.order.indexOf(n);
        return i === -1 ? group.order.length : i; // unknowns keep declaration order (stable sort)
      };
      ordered = [...names].sort((a, b) => rank(a) - rank(b));
    }
    groups.push({ ...group, names: ordered });
  }
  if (other.length) groups.push({ ...OTHER_GROUP, names: other });
  return groups;
}

function panel(title, iconName) {
  const p = el("div", "panel");
  const h = el("h2");
  if (iconName) h.innerHTML = icon(iconName);
  h.appendChild(el("span", null, title));
  p.appendChild(h);
  return p;
}

// Migrated to createView (dogfood): build/refresh receive ctx {root, setSub}.
// createView manages `built` and the idempotent build guard for us.
const TokensView = createView({
  build(ctx) {
    for (const group of classifyTokens()) {
      const p = panel(group.title, group.icon);

      if (group.style === "color") {
        const grid = el("div", "sw-grid");
        for (const name of group.names) {
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
        p.appendChild(grid);
        ctx.root.appendChild(p);
        continue;
      }

      for (const name of group.names) {
        const row = el("div", "tok-row");
        row.appendChild(el("div", "tok-name mono", name));
        if (group.style === "font") {
          const sample = el("div", "tok-val", "Sphinx of black quartz, judge my vow — 0123456789");
          sample.style.fontFamily = "var(" + name + ")";
          sample.style.fontSize = "13px";
          sample.style.color = "var(--text)";
          row.appendChild(sample);
        } else if (group.style === "shadow") {
          const demo = el("div", "shadow-demo");
          demo.style.boxShadow = "var(" + name + ")";
          row.appendChild(demo);
          const v = el("div", "tok-val mono");
          v.dataset.token = name;
          row.appendChild(v);
        } else { // "row"
          const v = el("div", "tok-val mono");
          v.dataset.token = name;
          row.appendChild(v);
        }
        p.appendChild(row);
      }
      ctx.root.appendChild(p);
    }
  },

  // Values are read live from the computed style, so theme switches show the
  // real resolved values. ctx.setSub writes the topbar subtitle without ever
  // touching #tm-page-sub directly — but only while this view is on screen (the
  // theme event fires refresh() even on other routes).
  refresh(ctx) {
    const nodes = $$("[data-token]", ctx.root);
    nodes.forEach((n) => { n.textContent = cssVar(n.dataset.token); });
    if (!ctx.root.classList.contains("hidden")) ctx.setSub(nodes.length + " tokens");
  },
});
window.addEventListener("tm:theme", () => { if (TokensView.built) TokensView.refresh(); });

// ---------- typography view ----------

function typeSample(label, node) {
  const box = el("div", "type-sample");
  box.appendChild(el("div", "type-label", label));
  box.appendChild(node);
  return box;
}

// Migrated to createView (dogfood): a build-only view — no refresh needed.
const TypeView = createView({
  build(ctx) {
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
    ctx.root.appendChild(p);

    const doc = panel("Doc text", "docs");
    const docBody = el("div", "doc-body");
    const para = el("p");
    para.appendChild(el("strong", null, "Strong text"));
    para.appendChild(document.createTextNode(" anchors a sentence; "));
    para.appendChild(el("code", null, "inline code"));
    para.appendChild(document.createTextNode(" gets a bordered chip. Doc sections use this measure for comfortable reading."));
    docBody.appendChild(para);
    doc.appendChild(docBody);
    ctx.root.appendChild(doc);

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
    ctx.root.appendChild(badges);
  },
});

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
    const f1 = createInput({
      name: "widget-demo-text",
      label: "Text input",
      placeholder: "type here",
    });
    frow.appendChild(f1.el);
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
    const ta = createTextarea({
      name: "widget-demo-textarea",
      label: "Text area",
      placeholder: "textarea — native appearance eliminated, tokens applied",
    });
    ta.el.style.marginTop = "12px";
    fields.appendChild(ta.el);
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
      const ta = createTextarea({ name: "demo-modal-textarea", label: "Demo text area" });
      body.appendChild(ta.el);
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
    pBtn.dataset.testid = "open-popover";
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

    // accordion (createAccordion) — stacked disclosure panels, single-open.
    const accPanel = panel("Accordion", "menu");
    const acc = createAccordion({
      items: [
        { title: "What is an accordion?", body: "A stack of disclosure panels. Headers are button[aria-expanded]; panels animate open via the grid-template-rows technique using a duration token, so reduced-motion suppresses it automatically.", open: true },
        { title: "Single vs. multi", body: "By default only one panel is open at a time. Pass multi:true to allow several." },
        { title: "Keyboard", body: "Each header is a real <button>: Tab to it, Enter or Space to toggle." },
      ],
    });
    accPanel.appendChild(acc.el);
    this.root.appendChild(accPanel);

    // net helpers (extras barrel: api + post + ApiError + setAuthHeader)
    const netPanel = panel("API helpers (extras)", "docs");
    const netNote = el("p", null,
      "The extras barrel exports api(path, {signal?, headers?}) and post(path, body, onError?, {signal?, headers?}) for same-origin JSON APIs. A non-OK response throws an ApiError carrying {status, statusText, path, detail}; detail is surfaced from the body's detail OR error field. No API server is mounted, so these buttons hit paths the static server has no file for and demonstrate the ApiError path.");
    netNote.style.marginTop = "0";
    netNote.style.color = "var(--text-dim)";
    netNote.style.fontSize = "13px";
    netPanel.appendChild(netNote);
    const netRow = el("div", "demo-row");
    // api(): a missing path 404s -> ApiError. We surface the structured fields.
    const getBtn = el("button", "btn", "api(\"/status\")");
    getBtn.addEventListener("click", () => {
      api("/status")
        .then((d) => toast("GET /status: " + JSON.stringify(d)))
        .catch((e) => {
          if (e instanceof ApiError) {
            toast("ApiError " + e.status + " on " + e.path + " — " + (e.detail || e.message), "err");
          } else {
            toast(e.message, "err");
          }
        });
    });
    // post(): onError fires with the error's message BEFORE the promise rejects.
    const postBtn = el("button", "btn", "post(\"/echo\", {x: 1})");
    postBtn.addEventListener("click", () => {
      post("/echo", { x: 1 }, (msg, status) => toast("onError: " + status + " — " + msg, "err")).catch(() => {});
    });
    // abort: an AbortController cancels the in-flight request.
    const abortBtn = el("button", "btn", "abort a request");
    abortBtn.addEventListener("click", () => {
      const ctrl = new AbortController();
      const pending = api("/slow", { signal: ctrl.signal })
        .then(() => toast("completed"))
        .catch((e) => toast(e.name === "AbortError" ? "request aborted" : e.message, "err"));
      ctrl.abort();
      return pending;
    });
    netRow.appendChild(getBtn);
    netRow.appendChild(postBtn);
    netRow.appendChild(abortBtn);
    netPanel.appendChild(netRow);
    const authNote = el("p", "hash",
      "This app registered a setAuthHeader() getter at boot, so every api()/post() call above now carries an Authorization header. The hook is single-registration (a second call is a hard error), mirroring setToastErrorHook. EventSource and WebSocket cannot carry custom headers, so the auth hook does not reach the realtime transports.");
    authNote.style.marginTop = "0";
    netPanel.appendChild(authNote);
    const mdDemo = el("div");
    mdDemo.style.marginTop = "var(--space-12)";
    mdDemo.appendChild(el("div", "set-title", "renderDocMd (extras)"));
    mdDemo.appendChild(renderDocMd("A doc paragraph with **bold**, `code`, and [a link](#/wiki/view-contract).\n\n- List item one\n- List item two"));
    netPanel.appendChild(mdDemo);
    this.root.appendChild(netPanel);

    // formatting helpers (extras barrel: fmtTime + relativeTime + liveRelativeTime)
    const fmtPanel = panel("Formatting (extras)", "clock");
    const fmtNote = el("p", null,
      "fmtTime(seconds) renders a media duration as m:ss or h:mm:ss. relativeTime(date) localizes a relative time via Intl.RelativeTimeFormat. liveRelativeTime(el, date) keeps an element's text fresh from ONE shared ticker. fmtTime returns here after being removed in 0.4.0.");
    fmtNote.style.marginTop = "0";
    fmtNote.style.color = "var(--text-dim)";
    fmtNote.style.fontSize = "13px";
    fmtPanel.appendChild(fmtNote);
    const fmtList = el("div", "fmt-list");
    for (const secs of [42, 90, 3661, 37230]) {
      const r = el("div", "tok-row");
      r.appendChild(el("div", "tok-name mono", "fmtTime(" + secs + ")"));
      r.appendChild(el("div", "tok-val mono", fmtTime(secs)));
      fmtList.appendChild(r);
    }
    for (const [label, ms] of [["5 minutes ago", Date.now() - 5 * 60000], ["in 2 hours", Date.now() + 2 * 3600000]]) {
      const r = el("div", "tok-row");
      r.appendChild(el("div", "tok-name mono", "relativeTime(" + label + ")"));
      r.appendChild(el("div", "tok-val mono", relativeTime(ms)));
      fmtList.appendChild(r);
    }
    const liveRow = el("div", "tok-row");
    liveRow.appendChild(el("div", "tok-name mono", "liveRelativeTime (page opened)"));
    const liveVal = el("div", "tok-val mono");
    liveRelativeTime(liveVal, Date.now());
    liveRow.appendChild(liveVal);
    fmtList.appendChild(liveRow);
    fmtPanel.appendChild(fmtList);
    this.root.appendChild(fmtPanel);
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

// auth header hook (extension point): a single module-level getter whose
// headers are merged into every api()/post() request. Demonstrated on the
// Widgets page's API-helpers panel. Realtime transports (sse/socket) cannot
// carry custom headers, so this hook intentionally does not reach them.
setAuthHeader(() => ({ Authorization: "Bearer gallery-demo-token" }));

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

### createView {#create-view}

Writing the raw contract by hand is repetitive. \`createView({build, refresh?, setSub?})\` returns a conforming view object with \`built\` and the idempotent build guard managed for you. Your \`build(ctx)\` and \`refresh(ctx)\` receive a **ctx** \`{root, setSub(text)}\`:

- **ctx.root** — the view's section element (assigned before the first build; the same node across callbacks).
- **ctx.setSub(text)** — write the topbar page subtitle (\`#tm-page-sub\`) without ever touching that node directly. The Tokens page uses it to show its live token count.

The factory's own optional \`setSub(sub, ctx)\` is the deep-link handler (the contract's \`setSub\`), distinct from \`ctx.setSub\`. Plain object views still work unchanged — createView is additive sugar over the same contract.

### Eager routes {#eager-routes}

A route marked \`eager: true\` has its root created and \`build()\` run at mount time (hidden), instead of lazily on first visit — useful for a route whose first paint must be instant. Because \`build()\` is idempotent, the router's later build on first visit is a no-op. The **Shell & chrome** route is eager.

### shell.announce {#announce}

\`shell.announce(msg)\` (also the standalone \`announce\` export) pushes a message into the shell's polite \`aria-live\` region — the same one route changes announce through — so app events reach screen readers without minting a new live region.
`,
  },
  {
    id: "shell-chrome",
    title: "Shell & chrome primitives",
    md: `
Phase 6A adds structural shell-and-chrome primitives, budgeted in their own \`chrome-js\` tier so the frozen core stays frozen (only the barrel re-export lines touch core). See them live on the **Shell & chrome** route.

### openDrawer {#open-drawer}

\`openDrawer({title, body, side?, modal?, trigger?, onClose?})\` → \`{el, close()}\` opens an edge-anchored overlay on the kernel layer stack. Two variants share one API:

- **modal: false** (default) — a light-dismiss drawer: Escape (via the kernel layer stack) or an outside pointerdown closes it, and the page behind stays interactive (\`role="dialog"\`, \`aria-modal="false"\`). Outside-pointer dismissal rides the kernel's central light-dismiss registry — one document capture-phase \`pointerdown\` listener, registered synchronously (no per-drawer timer), so it is deterministic under load.
- **modal: true** — a native \`<dialog>\` (showModal): focus trap, inert background, and a dimmed backdrop, exactly like \`openModal\`.

Both restore focus to the previously-focused element on close and slide in from \`side\` (\`"right"\` default | \`"left"\`) using motion tokens (reduced-motion safe). The shell's mobile nav drawer reuses the same swipe-to-close gesture: drag it toward its edge past a threshold to dismiss.

For a proper toggle button, wrap the trigger with \`registerOverlayTrigger(triggerEl, ({trigger, onClose}) => openDrawer({..., trigger, onClose}))\` from \`tinymoon/chrome\`: the framework owns the trigger's click handler and \`aria-expanded\`, and the kernel's gesture-claim ensures a close-press can never immediately reopen the drawer. The same contract backs the shell's hamburger and any light-dismiss overlay (popover, select, context menu) via \`registerLightDismiss\`.

### createTabPanels {#create-tabpanels}

\`createTabPanels({label, items: [{value, label, build(panel)}], value?})\` → \`{el, set, value, destroy}\` composes the \`createTabs\` bar with a panel region, completing the APG tabs pattern (\`aria-controls\` ↔ \`aria-labelledby\`, arrow-key navigation). Each panel's \`build(panel)\` runs lazily on first activation and never again; switching **hides** inactive panels rather than destroying them, so scroll position and form state survive.

### createGrid {#create-grid}

\`createGrid({preset, slots?})\` → \`{el, slots, setPreset, destroy}\` is a CSS-first rectangular layout primitive. The four presets — \`1x1\`, \`2x1\`, \`1x2\`, \`2x2\` (columns×rows) — are plain \`.tm-grid[data-preset]\` classes, so a grid can be authored in HTML with no JS. It is a **content** primitive, not a shell mode. No preset switcher is baked in; compose \`createSegmented\` with \`grid.setPreset()\` (as the demo does).

### iconButton {#icon-button}

\`iconButton({icon, tip, onClick, active?})\` → \`{el, setActive, setIcon, destroy}\` is the reusable, stateful topbar icon button. Unlike \`copyButton\`/\`kebabButton\` (one-shot elements), it returns an instance you can toggle (\`setActive\`, mirrored to \`aria-pressed\` and the shared \`.on\` class) and re-icon (\`setIcon\`) at runtime. \`topbarActions\` accepts Nodes, so wire it in by passing \`iconButton(...).el\`.
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
    id: "forms",
    title: "Forms & FormData",
    md: `
Form controls wrap real, visible native elements, so a plain \`<form>\` and the browser's own \`FormData\` do all the collecting — there is no form state library.

### Text fields {#forms-text}

\`createInput({name, label})\` wraps a native \`<input>\`; \`createTextarea({name, label})\` wraps a \`<textarea>\`. Both build a self-labeling \`.field\` (a real \`<label for>\`, never \`aria-label\`) and expose \`.value\`, \`.set(v)\`, \`.get()\`, \`.focus()\`, and \`.setError(msg | null)\`. \`createInput\` accepts only text-like types — \`text\`, \`password\`, \`email\`, \`url\`, \`search\`, \`tel\`; \`checkbox\`, \`radio\`, \`file\`, \`range\`, \`number\`, and date/time are a hard error, because each has its own factory.

### Sliders {#forms-slider}

\`createSlider({name, label, min, max})\` wraps a native \`input[type=range]\` in a \`.tm-slider\` frame — keyboard (arrows, Home, End) and the slider role come free from the element. It surfaces two callbacks: **onInput** fires live during a drag, **onChange** fires once on release.

\`variant: "seek"\` is a **semantically distinct** slider, not a cosmetic chrome-blanking flag: an **invisible position scrubber laid over app-drawn visuals** (a waveform or timeline canvas). It renders the same native-range mechanics inside a \`.tm-slider.tm-slider-seek\` wrapper whose framework CSS makes the track and thumb visually transparent while keeping the **full-area hit target**, the **focus-visible outline**, and the **slider ARIA** (role, valuenow) intact. **The app owns the visual representation drawn underneath** — the seek variant only scrubs over it. An unknown variant is a hard error. See it live on the **Forms** route's overlay-scrubber demo.

### Fields, hints, and errors {#forms-field}

\`createField({label, control, hint?})\` wraps any control — a slider, a select, a raw element — in a labeled field with an optional hint line. Both \`createField\` and the text controls expose \`.setError(msg)\`, which renders an inline \`.field-error\` and wires \`aria-invalid\` + \`aria-describedby\` on the control; \`.setError(null)\` clears it. Validation is native constraint validation plus this affordance — you own the logic.

### Numbers, times, and typeaheads {#forms-more}

- \`createNumber({name, label, min?, max?, step?})\` wraps a native \`input[type=number]\` (browser spinners hidden) framed by custom \`+\`/\`-\` stepper buttons that respect \`min\`/\`max\`/\`step\`. Same instance contract as \`createInput\` (\`.value\`, \`.set\`, \`.get\`, \`.setError\`).
- \`createTimePicker({name, label, value?, minuteStep?})\` shows a locale-formatted time in the field while the form-participating element carries a canonical 24h \`"HH:MM"\` value. Typed input is parsed on blur; an hours/minutes popover follows the date picker's focus and dismissal pattern.
- \`createCombobox({name, label, onFilter | items, freeText?})\` is an editable typeahead. \`onFilter(query)\` returns items or a \`Promise\` of items — debounced, with stale responses discarded so a slow earlier request never overwrites a newer one. \`freeText\` defaults to \`false\`: arbitrary typed text only commits when you opt in.
- \`createMultiSelect({name, label, onFilter | items, values?})\` renders its selection as sharp removable chips and submits through a hidden \`<select multiple>\`. Chips are keyboard-removable (Backspace on an empty input drops the last); \`.values\` and \`.setValues\` read and replace the selection.

### Submitting {#forms-submit}

Because every control is a real named form element, submission is ordinary DOM:

\`\`\`
const fd = new FormData(form);
for (const [name, value] of fd.entries()) { /* ... */ }
\`\`\`

The **Forms** route composes \`createInput\`, \`createTextarea\`, \`createField\`, \`createSlider\`, \`createNumber\`, \`createTimePicker\`, \`createCombobox\`, and \`createMultiSelect\` in one form and toasts the collected \`FormData\` on submit.
`,
  },
  {
    id: "state",
    title: "State: store, bind, reconcile",
    md: `
tinymoon's state story is deliberately small — level **L2**: a store, a binder, and a keyed reconciler. There is **no declarative render layer** by design. You build the DOM once (with \`el()\` and the primitives) and mutate it in place; these three helpers, exported from \`tinymoon/state\`, keep that mutation centralized and correct. Watch it live on the **State** route.

### createStore {#state-store}

\`createStore(initial)\` returns \`{get, set, update, subscribe, select, snapshot}\`. It is a schemaless key/value store:

- **set(key, value)** skips its emit entirely when \`Object.is(old, value)\` — a no-op write notifies nobody. \`update(key, fn)\` is \`set(key, fn(get(key)))\`.
- **subscribe(key, cb) → unsubscribe** fires \`cb(value, previousValue, key)\`. \`subscribe(null, cb)\` subscribes to *any* change. (\`createSettings\` stores expose the identical \`subscribe\` contract, additive to the \`tm:setting\` event.)
- **select(fn) → {get, subscribe}** is a memoized projection: it recomputes \`fn(snapshot)\` on change but notifies only when the projection's identity changes (\`Object.is\`), so an unrelated write stays silent.
- In-place mutation of a stored object does **not** emit — the store only sees identity changes through \`set\`/\`update\`. Pass a new value (or a fresh copy).

### bind {#state-bind}

\`bind(store, key, widget) → unbind\` wires a store key to a widget instance's \`.set(v)\` (the house update convention): it syncs the current value once, then forwards every change. It returns an \`unbind\` function — call it in your view's teardown, exactly as you call \`.destroy()\` on the widget.

### reconcile {#state-reconcile}

\`reconcile(container, items, keyFn, {create, update, remove})\` reconciles a collection into keyed child nodes. New keys call \`create(item)\`; kept keys reuse their node — **identity preserved** — and call \`update(node, item)\`; disappeared keys call \`remove(node, item)\` (a pre-detach hook) and are then removed. Kept nodes are reordered in place with \`insertBefore\`, never re-created. There is no virtual DOM and no attribute diffing: \`create\`/\`update\` own a node's contents, the reconciler owns only which nodes exist and in what order.

### Why L2 and not a render layer {#state-l2}

A declarative render layer would mean a diffing runtime, a component model, and a build step — all of which the charter forbids. L2 gives you the two things that actually hurt to hand-roll (targeted subscriptions and correct keyed list reordering) while keeping the mental model "build once, mutate in place." Everything stays vanilla ES modules with zero dependencies.
`,
  },
  {
    id: "realtime",
    title: "Realtime: sse and socket",
    md: `
The extras barrel ships two realtime transports, thin wrappers over the browser's own primitives. Both take a **relative, same-origin path** and throw on an absolute or external URL — routing every connection through a relative path is what keeps consumer code conformance-clean (the checker bans external \`ws://\`/\`wss://\`/\`http(s)://\` literals), and the socket wrapper resolves the scheme and host from \`location\` so you never hand-write a \`wss://\` connection literal yourself. See it live on the **Realtime** route.

### sse {#realtime-sse}

\`sse(path, {onMessage, onError?, onOpen?, events?}) → {close()}\` wraps \`EventSource\`. Each \`message\` event's \`data\` is auto-parsed as JSON with a raw-string fallback, delivered as \`onMessage(data, event)\`; named server events are subscribed via the \`events\` map. Reconnection is **browser-native**: after a drop the browser reconnects and resends the last event id in the \`Last-Event-ID\` header, so a server that stamps events with \`id:\` can resume the stream.

### socket {#realtime-socket}

\`socket(path, {onMessage, onError?, onOpen?, onReconnect?, reconnect?, protocols?}) → {send(data), close()}\` wraps \`WebSocket\`. Incoming frames are auto-parsed (JSON, raw-string fallback); \`send()\` stringifies objects and passes strings through. On an **abnormal** close the socket reconnects with **framework-owned exponential backoff** — 1000ms first, ×2 each attempt, capped at 30000ms, reset on a successful open — unless you pass \`reconnect: false\`. \`onReconnect()\` fires only after a *successful* reconnection: resync (replay from a cursor, refetch a snapshot) is application-level, so the framework signals the moment and leaves the strategy to you. \`send()\` while the socket is not open **throws** — there is deliberately no silent buffering, so the same call behaves the same way every time.

### Auth {#realtime-auth}

\`setAuthHeader(getter)\` merges headers into every \`api()\`/\`post()\` request, but it does **not** reach the realtime transports: browser \`EventSource\` and \`WebSocket\` cannot carry custom request headers. Use a same-origin cookie or a query parameter for realtime auth — a browser-platform limitation stated plainly, not worked around.
`,
  },
  {
    id: "transcript-recipe",
    title: "Recipe: a streaming transcript",
    md: `
This is a **recipe, not a widget**. tinymoon ships no chat/transcript component — and it does not need to, because the existing primitives compose into one. This recipe proves that the store, the reconciler, the realtime transports, and \`el()\` are *sufficient* to build a streaming-chat-transcript pattern, so you can write your own without waiting for a bespoke component. See it live on the **Transcript recipe** route (a synthetic ticker stands in for the server there, since the gallery has no backend).

### The composition {#recipe-composition}

- **Source** — \`socket(path, {onMessage})\` (or \`sse\`). Each message its \`onMessage\` delivers is appended to a store key. In the demo a \`setInterval\` plays the part of the socket.
- **State** — a \`createStore({messages: []})\`. Appending is immutable: \`set("messages", [...prev, msg])\`. A **capped buffer** trims the oldest beyond a retention limit (the demo keeps 200 messages, a stand-in for a ~256KB document budget) so a long-running stream never grows the DOM without bound.
- **Render** — \`reconcile(container, messages, m => m.id, {create, update})\`. The list is **append-only and keyed**, so reconcile reuses every existing node on each append and trim — node identity survives, which is what lets a collapsed block stay collapsed as new messages arrive.
- **Blocks** — each message is a collapsible \`el()\` disclosure: a header \`<button aria-expanded>\` toggles a \`collapsed\` flag *in the store* (immutably), and \`update\` reflects it onto the node. Timestamps stay fresh via \`liveRelativeTime\`, one shared ticker across every block.
- **Auto-scroll** — the viewport pins to the tail while you are at the bottom; scrolling up **pauses** the follow and reveals a jump-to-latest control, so incoming messages append without yanking your view.

### Why a recipe and not a component {#recipe-why}

A shipped transcript widget would bake in decisions — message shape, grouping, virtualization, retention — that belong to the app. The recipe keeps those in your hands while proving the primitives carry the weight. If you find yourself copying this recipe verbatim across apps, that is a signal to extract *your* component, styled and shaped for *your* domain — not a gap in the framework.
`,
  },
  {
    id: "data-display",
    title: "Data-display widgets",
    md: `
The \`tinymoon/widgets\` barrel is the **data-display** story — the widgets that render *data*, as opposed to controls that collect *input*. It is optional: link \`widgets.css\` and import the barrel (or a single widget's subpath, e.g. \`tinymoon/table\`) only when your app shows tables, stats, and status chips. See it live on the **Data** route.

### Badges {#data-badges}

\`badge(text, variant?)\` is a **one-shot element factory** — like \`copyButton\`, it returns a bare \`<span>\`, not a stateful instance, because a status chip has nothing to update or tear down. Variants are \`ok\` | \`warn\` | \`err\` | \`muted\` | \`neutral\`; an unknown variant is a hard error. The status hue drives the **border and a soft fill** (a non-text 3:1 signal), while the label stays at the high-contrast \`--text\` token so 10px uppercase text clears 4.5:1 in **both** themes — saturated status hues (especially light-theme green) cannot hold 4.5:1 as small text. \`warn\` pulls the new \`--gold\` token.

### Stats {#data-stats}

\`createStat({label, value, unit?, trend?})\` is a stateful tile (\`{el, set, setTrend, destroy}\`); \`renderStats(items)\` wraps several into a \`.report-stats\` row. **Trend direction is always explicit** — \`good\` | \`bad\` | \`neutral\`, never inferred. The widget cannot know whether a metric is higher-is-better (throughput, uptime) or lower-is-better (error rate, latency, cost): the same rising number is *good* for one and *bad* for another. Forcing the caller to state the direction keeps the coloring honest. The delta renders as a colored triangle/edge (non-text), never as colored value text.

### Data table {#data-table}

\`createTable({columns, rows?, maxRows?, onSort?, caption?, rowClass?})\` → \`{el, setRows, destroy}\`. Two decisions the API pins:

- **Declarative rendering** — \`setRows(rows)\` re-renders the body wholesale. Per-row diffing is what the state barrel's \`reconcile()\` is for; a table redraws cheaply from an array.
- **Caller-side sorting** — clicking a sortable header (or Enter/Space on it) cycles its \`aria-sort\` none → ascending → descending and calls \`onSort(key, direction)\`. The table **never sorts the rows itself and never mutates the array** you hand it — it only reports the request; you re-sort your data and call \`setRows()\`. This keeps sort semantics (locale, numeric vs. string, stability) in your hands.

A column's \`format(value, row)\` may return a **string or a live DOM Node**, so a cell can hold a badge or a button. \`maxRows\` caps the rendered body; extra rows collapse into an "N more rows not shown" footer note (the data is unshown, never dropped or sorted). Cells form a **roving-tabindex grid** (\`role="grid"\`): arrow keys move the focused cell, Home/End jump to the row's ends, and a sticky header keeps column labels visible while scrolling.

Two class hooks let you tint rows and cells from your own data, re-applied on every \`setRows()\`: table-level \`rowClass(row)\` and per-column \`cellClass(value, row)\` each return a class string (or null/""). The returned classes are **appended** to the framework's own \`tr\`/\`td\` classes — never replacing them — so ARIA roles and the roving grid stay intact. The **Data** route uses \`rowClass\` to tint whole rows by status token (warn → gold, err → red).

### Virtual list {#data-virtuallist}

\`createVirtualList({rowHeight, items?, renderRow, getKey?, overscan?})\` → \`{el, setItems, scrollToIndex, destroy}\` renders only the rows intersecting the viewport (plus overscan), so a 10,000-item list keeps a near-constant DOM node count. **Fixed row height only** — variable/measured heights are out of scope by decision; the constant height is what makes the windowing O(1). It is a **standalone list, not a table mode**: virtual rows are absolutely-positioned \`<div>\`s (a \`<tbody>\` cannot position \`<tr>\`s), so a virtual *table* is a different problem. Give \`.tm-vlist\` a height in CSS — \`contain: strict\` needs a viewport to window against. A stable \`getKey\` lets rows be reused as they scroll back into view.

### Tree view {#data-tree}

\`createTree({nodes, onSelect?})\` → \`{el, setNodes, expand, collapse, destroy}\` is the **APG TreeView**: a \`role="tree"\` of \`role="treeitem"\` rows with \`role="group"\` child lists, a **roving tabindex**, and the full keyboard model — Arrow **Down/Up** move between visible items, **Right** expands a collapsed parent then enters it, **Left** collapses then exits to the parent, **Home/End** jump, and **Enter/Space** activate (\`onSelect(node)\`). \`nodes\` is recursive \`[{id, label, children?, open?}]\`; \`expand\`/\`collapse\` address nodes by \`id\` or by a **path** (array of ids). Depth indentation is CSS-driven. **Lazy/async children are out of scope** — build the whole forest and hand it to \`setNodes\`.

### Filter bar + chips {#data-filterbar}

\`createFilterBar({slots})\` → \`{el, setSlots, destroy}\` is a **layout-only** strip: you drop in the controls you already have (tabs, segmented, combobox, a search input, a datepicker) and the bar provides flex layout + responsive wrap. It owns **no filter state** — filter state is *application* state (which facets are active, how they map to a query, how they persist in the URL), which no generic widget can model. \`createChips({items?, onRemove?, onClearAll?})\` → \`{el, setItems, destroy}\` renders **sharp removable chips** (a label or a \`key: value\`) over caller state. Clicking a chip's × calls \`onRemove(item, index)\` — it does **not** self-remove; the caller updates state and calls \`setItems\`, so the chips can never drift from the truth. A **Clear-all** affordance appears past one chip, and the strip collapses to nothing when empty.

### Load more {#data-loadmore}

\`createLoadMore({fetchPage, onItems, pageSize?})\` → \`{el, reset, destroy}\` is **transport-agnostic** pagination. You supply \`fetchPage(cursor, pageSize) -> Promise<{items, nextCursor}>\`; the widget owns the button, its loading spinner, and the end/error affordances. It starts at a null cursor; each page advances the cursor and calls \`onItems(items)\`; a null \`nextCursor\` hides the button. **No silent failure** — a rejected fetch shows a visible error line with a **Retry** that re-requests the *same* cursor (the position is never lost). \`reset()\` returns to the first-page state for a filter change (it does not fetch — the next click loads page one, keeping every fetch caller-visible).

### Breadcrumbs {#data-breadcrumbs}

\`createBreadcrumbs({items, onNavigate?})\` → \`{el, setItems, destroy}\` renders a **router-agnostic** trail: \`nav[aria-label="Breadcrumb"]\` wrapping an \`<ol>\`, chevron separators in CSS, and \`aria-current="page"\` on the last (current) item. An item with an \`href\` is a real link; an href-less navigable item is a \`<button>\`; \`onNavigate(item, index)\` fires on activation but never preventDefaults — the href drives navigation, or you route in the handler. Beyond ~6 items the middle **collapses into an expandable ellipsis**.

### Sparkline {#data-sparkline}

\`createSparkline({values, width?, height?, area?, label?})\` → \`{el, setData, destroy}\` is a tiny **inline-SVG** trend line, with an optional area fill. **Every color lives in CSS** backed by tokens — the emitted SVG carries no color literals, so it re-themes for free and the conformance checker stays clean. It is \`aria-hidden\` by default; pass a \`label\` to make it a labelled \`role="img"\` when the trend itself carries meaning. The pure \`sparklinePoints(values, width, height)\` geometry is exported alongside (like \`windowRange\`) for testing and reuse.

### Chart container {#data-chart}

\`createChartContainer({render, update?, label})\` → \`{el, redraw, destroy}\` is a renderer-**agnostic** lifecycle that ships **no charting**. tinymoon does not bundle a charting library (that would be a large runtime dependency); instead the container provides the parts a chart always needs: a sized root, a **ResizeObserver** that re-renders on layout change (debounced to one paint per animation frame), a **margin** convention read from \`--chart-margin-*\` tokens on the container, and the **shared tooltip** (draw elements with \`data-tooltip\`). Your \`render(ctx)\` receives \`{root, width, height, margin, cssVar}\` and does the drawing — D3, hand-rolled SVG, canvas, whatever. The container **never draws anything itself**. \`label\` is required (the accessible name).

### Live feed {#data-feed}

\`createFeed({renderItem, cap?, onPrune?})\` → \`{el, append, prepend, setItems, destroy}\` is a **presentation-only** live feed / log viewer with **no transport coupling** — you wire the SSE/socket/polling and push items in. \`renderItem(item) -> Node\` builds each row (set \`data-level\` for severity coloring, mirrored onto the row wrapper). The buffer is **capped** (default 200): \`append\` overflow prunes the oldest (top), \`prepend\` overflow prunes the far end (bottom), and pruned items go to \`onPrune\`. **Stick-to-bottom** autoscroll keeps the tail pinned; scrolling up **pauses** it and reveals a **jump-to-latest** affordance.
`,
  },
  {
    id: "theming",
    title: "Tokens and theming",
    md: `
\`tokens.css\` is the single source of truth: every color, font, shadow, and layout measure is a custom property on \`:root\`, overridden per theme on \`html[data-theme="light"]\`. Rules everywhere else — and canvas code, via \`cssVar()\` — reference tokens only. Re-theming means overriding tokens; the identity constants (radius 0, fonts, motion timing, grain) are not tokens and cannot be opted out of.
`,
  },
  {
    id: "auditor",
    title: "Runtime auditor and CSP",
    md: `
### Runtime auditor {#runtime-auditor}

\`assets/js/auditor.js\` is a dev-mode module that activates runtime conformance checks. Import it during development (not in production) to catch charter violations live:

- **border-radius** — a \`MutationObserver\` checks every added DOM node. Any computed \`border-radius\` other than \`0px\` logs a \`console.error\` with the element reference.
- **native controls** — added \`<select>\`, \`<dialog>\`, or \`<input type="checkbox/radio/file">\` elements that are not inside the framework's hidden-input wrapper classes trigger an error. The framework's own primitives (\`createCheckbox\`, \`createRadio\`, \`createFileInput\`, \`createSelect\`, \`createSegmented\`, \`createDatePicker\`) are exempted.
- **external loads** — a periodic \`performance.getEntriesByType("resource")\` scan flags any off-origin network request.

The auditor exposes \`window.__tmAuditorErrors\` (an array of \`{message, element}\` objects) for programmatic access in tests. It is not included in the core or extras barrel.

### Content Security Policy {#csp-guidance}

tinymoon is designed to work under a strict CSP with zero violations. A recommended policy for production:

\`\`\`
default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; script-src 'self'
\`\`\`

The \`'unsafe-inline'\` for \`style-src\` covers the framework's computed style assignments (element.style). The \`data:\` allowance in \`img-src\` covers the inline grain SVG. No external fonts, CDNs, or network loads are needed — everything is vendored.
`,
  },
  {
    id: "chrome-async",
    title: "Async-state blocks",
    md: `
The \`tinymoon/chrome\` barrel adds the Phase 6B framework wave. It is a separate barrel (not the core \`tinymoon\` index) purely for size discipline — the frozen core byte ceiling has no room for extra re-export lines.

### State blocks {#state-blocks}

\`loadingBlock({label?})\`, \`emptyBlock({title, sub?})\`, and \`errorBlock({message, onRetry?})\` are one-shot element factories (like \`badge\`/\`copyButton\` — a bare element, no instance, no \`destroy\`). They build on the existing \`.empty\` widgets.css block, so no new stylesheet is needed. They are **static-first**: the only motion is the shared \`.spin\` spinner inside \`loadingBlock\`, so they are reduced-motion-safe by construction.

### renderAsync {#render-async}

\`renderAsync(container, promise, {loading?, empty?, error?, onData})\` swaps the blocks into \`container\` as \`promise\` settles:

- shows \`loadingBlock\` immediately;
- on resolve, calls \`onData(data)\` — return a falsy value to show \`emptyBlock\` (the empty predicate), an \`Element\` to display it, or any other truthy value to signal you populated \`container\` yourself;
- on reject, shows \`errorBlock\` (message taken from the error, merged with your \`error\` opts so you can pass an \`onRetry\`).

It resolves to the data on success. On rejection it also resolves (to \`undefined\`) once the error block is shown — the failure surfaces as the visible error state, so a fire-and-forget call never trips an unhandled rejection. Wire recovery through \`error.onRetry\`.
`,
  },
  {
    id: "chrome-lazy",
    title: "lazyMount",
    md: `
\`lazyMount(target, loadFn, {root?, rootMargin?, concurrency?})\` → \`cancel()\` loads elements only once they scroll into view, and runs at most \`concurrency\` (default 3) \`loadFn\`s at a time, draining in visibility order — so a viewport that reveals fifty candidates at once does not fire fifty simultaneous loads.

- \`target\` is an Element or an array/NodeList of Elements.
- \`loadFn(el)\` runs once per element when it first becomes visible; it may return a promise, which is awaited to gate the concurrency slot.
- \`root\` defaults to the shell content scroller (\`#tm-content\`) when a shell is mounted, resolved internally — you never query shell internals. Pass \`null\` for the viewport, or an element to scope it.
- \`cancel()\` disconnects the observer and drops not-yet-started candidates; loads already in flight run to completion.
`,
  },
  {
    id: "chrome-shortcuts",
    title: "Keyboard shortcuts",
    md: `
\`registerShortcut(combo, handler, {allowInInputs?, global?})\` → \`unregister\` binds a shortcut on ONE shared module-level keydown listener.

- **Combo syntax** is \`"mod+k"\` style: \`+\`-joined tokens, the last is the key. \`mod\` resolves to Cmd on Apple platforms and Ctrl elsewhere, so one registration is correct on every OS. For a single-character key the shift state is implied by the character itself (\`"?"\` already means Shift+/), so shift is not part of the signature there.
- **Overlay suppression** — while a modal overlay (a modal, a modal drawer, or the command palette) is open, ordinary shortcuts are suppressed; only \`{global: true}\` shortcuts fire. That is what lets the palette's own toggle close it while it is open. Documented limitation: shortcuts are not suppressed while these light-dismiss overlays are open: popover, context menu, select menu, non-modal drawer. They are Escape-dismissable and short-lived, so ordinary shortcuts stay live underneath them.
- **Text entry** — a bare single-key combo does not fire inside an input/textarea/contenteditable unless \`allowInInputs\` is set; modifier combos always fire.
- **No silent override** — registering an already-active combo is a hard error; unregister the first before rebinding.
`,
  },
  {
    id: "chrome-palette",
    title: "Command palette",
    md: `
The command palette is a fuzzy, source-aggregating launcher on a native \`<dialog>\` (focus trap, backdrop, background inert). It is **not auto-installed** — an app opts in explicitly, honoring the mandatory-choice philosophy.

### Sources {#palette-sources}

\`registerPaletteSource(fn)\` → \`unregister\`, where \`fn(query)\` returns items — or a Promise of items — shaped \`{label, hint?, icon?, run()}\`. Every open re-queries all sources with the current input, debounced ~150ms, with stale-response discard so a slow source cannot overwrite a newer query.

### Ranking {#palette-ranking}

The palette applies a built-in **subsequence match + rank** over the aggregated items, so a source may return its full, unfiltered list and let the palette filter. Sources MAY pre-filter (e.g. a server-side fuzzy search); the built-in matcher still runs, so a pre-filtered item whose label does not subsequence-match the query would be dropped — return labels that contain the query if you pre-filter.

### Opening {#palette-open}

\`openPalette()\` opens the dialog (returns the existing handle if already open, so a toggle can detect and close it). \`installPalette({shortcut?})\` is the opt-in wiring: it binds a GLOBAL toggle (default \`mod+k\`) and seeds a nav source from a mounted shell's rendered routes. Keyboard model: type to filter, Up/Down to move, Enter to run, Escape to close.
`,
  },
  {
    id: "toast-action",
    title: "Toast action",
    md: `
\`toast(msg, kind, {action: {label, onClick}})\` adds a single action button to a toast. An action **forces persistence** — the toast stays on screen (no auto-dismiss) until the action is taken or the toast is dismissed, and acting dismisses it. The container keeps \`role="status"\`, so the message is announced and the action button remains reachable in the live region before any dismissal.
`,
  },
  {
    id: "theme-tristate",
    title: "Tri-state theme",
    md: `
The settings store's \`theme\` value may be \`"dark"\`, \`"light"\`, or \`"system"\`.

- \`applyTheme()\` **stores** \`"system"\` untouched but **resolves** it to the concrete OS theme (via \`matchMedia("(prefers-color-scheme: dark)")\`) when writing \`<html data-theme>\`. It re-resolves live whenever the OS preference changes while the stored value is still \`"system"\`.
- \`cycleTheme(store)\` cycles \`dark → light → system → dark\` and persists each step.

### No-flash boot snippet {#theme-boot}

\`THEME_BOOT_SNIPPET\` is an exported string: an inline pre-paint script. Drop it into a \`<script>\` in \`<head>\`, **before** your stylesheets, so \`<html data-theme>\` is set before the first paint and there is no light/dark flash:

\`\`\`
<script>/* paste THEME_BOOT_SNIPPET here */</script>
<link rel="stylesheet" href="assets/css/tokens.css">
\`\`\`

The snippet reads the persisted settings blob, resolves a stored \`"system"\` value against the OS, and sets \`data-theme\`. It assumes the default storage key \`"tm-settings"\`; if your \`createSettings\` \`storageKey\` differs, replace that one literal. It touches only \`localStorage\`, \`matchMedia\`, and \`documentElement\` — nothing the conformance scanners flag.
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

    // number stepper (createNumber) — form-participating; native input[type=number]
    // framed by custom +/- buttons (browser spinners are hidden by CSS).
    const numSection = el("div");
    numSection.appendChild(el("div", "set-title", "Number stepper"));
    const num = createNumber({
      name: "quantity",
      label: "Quantity",
      min: 0,
      max: 20,
      step: 1,
      value: 3,
      onChange: (v) => toast("Quantity: " + v),
    });
    numSection.appendChild(num.el);
    form.appendChild(numSection);

    // time picker (createTimePicker) — form-participating; canonical HH:MM 24h.
    const tpSection = el("div");
    tpSection.appendChild(el("div", "set-title", "Time picker"));
    const tpRow = el("div", "demo-row");
    tpRow.style.marginTop = "var(--space-8)";
    const tp = createTimePicker({
      name: "start-time",
      label: "Start time",
      value: "09:30",
      minuteStep: 15,
      onChange: (v) => toast("Time: " + v),
    });
    tpRow.appendChild(tp.el);
    tpSection.appendChild(tpRow);
    form.appendChild(tpSection);

    // combobox (createCombobox) — typeahead single-value, form-participating.
    const cbSection2 = el("div");
    cbSection2.appendChild(el("div", "set-title", "Combobox (typeahead)"));
    const cb = createCombobox({
      name: "country",
      label: "Country",
      placeholder: "Type to filter…",
      items: [
        { value: "us", label: "United States" },
        { value: "uk", label: "United Kingdom" },
        { value: "de", label: "Germany" },
        { value: "fr", label: "France" },
        { value: "jp", label: "Japan" },
      ],
      value: "de",
      text: "Germany",
      onChange: (v) => toast("Country: " + v),
    });
    cbSection2.appendChild(cb.el);
    form.appendChild(cbSection2);

    // multi-select (createMultiSelect) — chips + hidden <select multiple>.
    const msSection = el("div");
    msSection.appendChild(el("div", "set-title", "Multi-select (chips)"));
    const ms = createMultiSelect({
      name: "tags",
      label: "Tags",
      placeholder: "Add a tag…",
      items: [
        { value: "urgent", label: "Urgent" },
        { value: "backend", label: "Backend" },
        { value: "design", label: "Design" },
        { value: "docs", label: "Docs" },
      ],
      values: ["backend"],
      onChange: (vs) => toast("Tags: " + vs.join(", ")),
    });
    msSection.appendChild(ms.el);
    form.appendChild(msSection);

    // text fields (createInput + createTextarea) — self-labeling .field
    // controls that wrap real, visible native elements. The setError demo below
    // drives the username field's inline validation line.
    const textSection = el("div");
    textSection.appendChild(el("div", "set-title", "Text fields"));
    const nameInput = createInput({
      name: "username",
      label: "Username",
      placeholder: "at least 3 characters",
      value: "ada",
    });
    const bio = createTextarea({
      name: "bio",
      label: "Bio",
      rows: 3,
      placeholder: "a sentence or two",
    });
    textSection.appendChild(nameInput.el);
    textSection.appendChild(bio.el);
    form.appendChild(textSection);

    // slider (createSlider) composed inside a createField for a labeled row
    // with a hint. onInput drives the live readout; onChange commits a toast.
    const sliderSection = el("div");
    sliderSection.appendChild(el("div", "set-title", "Slider"));
    const readout = el("span", "hash", "volume — 40");
    const slider = createSlider({
      name: "volume",
      label: "Volume",
      min: 0,
      max: 100,
      value: 40,
      onInput: (v) => { readout.textContent = "volume — " + v; },
      onChange: (v) => toast("Volume committed: " + v),
    });
    const sliderField = createField({
      label: "Volume",
      control: slider,
      hint: "onInput fires live while dragging; onChange fires on release.",
    });
    sliderSection.appendChild(sliderField.el);
    sliderSection.appendChild(readout);
    form.appendChild(sliderSection);

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
      // setError demo: soft-validate the username before submitting. A too-short
      // value renders the inline .field-error line and aborts; a valid value
      // clears it. (Native `required` is avoided here so the demo stays live.)
      const uname = nameInput.get().trim();
      if (uname.length < 3) {
        nameInput.setError("Username needs at least 3 characters");
        nameInput.focus();
        return;
      }
      nameInput.setError(null);
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

    // Seek slider (createSlider variant:"seek"): an invisible position scrubber
    // laid over app-drawn visuals. THIS view draws the waveform strip on a
    // canvas (every color pulled live via cssVar, never a literal); the seek
    // slider sits on top as a transparent, full-area, keyboard-seekable hit
    // target with the slider role + value intact. The app owns the visuals.
    const seekPanel = panel("Seek slider — overlay scrubber", "wave");
    seekPanel.appendChild(el("p", "hash",
      "variant:\"seek\" renders the same native-range mechanics inside a transparent .tm-slider-seek wrapper — a full-area scrubber over app-drawn visuals. The waveform below is this view's canvas; the slider only seeks. Arrows/Home/End move it; the slider role and value stay intact."));

    const strip = el("div", "seek-demo");
    const waveCanvas = el("canvas", "seek-wave");
    // The waveform is decorative chrome the app draws; the slider carries the
    // accessible name, so the canvas is hidden from the accessibility tree.
    waveCanvas.setAttribute("aria-hidden", "true");
    strip.appendChild(waveCanvas);

    let seekPos = 30;
    const seekReadout = el("span", "hash", "position — 30");

    const drawWave = () => {
      const w = waveCanvas.clientWidth || 600;
      const h = waveCanvas.clientHeight || 64;
      waveCanvas.width = w * devicePixelRatio;
      waveCanvas.height = h * devicePixelRatio;
      const ctx = waveCanvas.getContext("2d");
      ctx.scale(devicePixelRatio, devicePixelRatio);
      ctx.clearRect(0, 0, w, h);
      const playedX = (seekPos / 100) * w;
      // The already-seeked portion gets a soft accent wash (non-text signal).
      ctx.fillStyle = cssVar("--accent-soft");
      ctx.fillRect(0, 0, playedX, h);
      // Fake waveform bars: accent up to the playhead, muted border past it.
      for (let x = 4; x < w; x += 6) {
        const amp = Math.abs(Math.sin(x / 22) * Math.cos(x / 60)) * (h / 2 - 4);
        ctx.strokeStyle = x <= playedX ? cssVar("--accent") : cssVar("--border-2");
        ctx.beginPath();
        ctx.moveTo(x, h / 2 - amp);
        ctx.lineTo(x, h / 2 + amp);
        ctx.stroke();
      }
      // Playhead line at the current position.
      ctx.strokeStyle = cssVar("--accent-hi");
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playedX, 0);
      ctx.lineTo(playedX, h);
      ctx.stroke();
    };

    const seek = createSlider({
      name: "seek-position",
      label: "Seek position",
      min: 0,
      max: 100,
      value: seekPos,
      variant: "seek",
      onInput: (v) => { seekPos = v; seekReadout.textContent = "position — " + v; drawWave(); },
      onChange: (v) => toast("Seeked to " + v),
    });
    seek.el.dataset.testid = "seek-slider";
    strip.appendChild(seek.el);

    seekPanel.appendChild(strip);
    const seekRow = el("div", "demo-row");
    seekRow.style.marginTop = "var(--space-10)";
    seekRow.appendChild(seekReadout);
    seekPanel.appendChild(seekRow);
    this.root.appendChild(seekPanel);

    // The canvas needs layout to size against, so it paints in refresh() (run on
    // every visit) and repaints on theme change like every other canvas here.
    this._drawWave = drawWave;
    window.addEventListener("tm:theme", drawWave);
  },

  refresh() { if (this._drawWave) this._drawWave(); },
};

// ---------- embed view ----------

// The isolation boundary. Both demos use SAME-ORIGIN / self-contained content
// so the gallery stays checker-clean and auditor-clean; the genuinely external
// cases (a foreign iframe src waived only inside the marker) live in the test
// fixtures, never in the shipped gallery.
//
// The shadow demo's garish foreign CSS is a REAL vendored file, quarantined
// under gallery/third_party/ and pinned by sha256 in its PROVENANCE.toml. The
// gallery is its own first consumer of the vendor-quarantine mechanism: the
// conformance checker exempts the pinned file rather than the CSS hiding in a
// JS string. It is fetched same-origin (next to gallery.js) and sealed into
// the shadow root, lazily on first build so it never touches gallery boot.
const EmbedView = {
  root: null,
  built: false,

  build() {
    if (this.built) return;
    this.built = true;

    const p = panel("Isolation boundary", "compare");
    const note = el("p", null,
      "createEmbed wraps a FOREIGN surface off the identity surface. Two explicit modes: a sandboxed iframe for foreign network surfaces, and a shadow root for foreign DOM/CSS. The static checker and the runtime auditor both key on the data-tm-embed marker to waive the wrapped subtree.");
    note.style.marginTop = "0";
    note.style.color = "var(--text-dim)";
    note.style.fontSize = "13px";
    p.appendChild(note);

    // iframe mode — same-origin content keeps the gallery checker-clean.
    p.appendChild(el("div", "set-title", "iframe mode — sandboxed, same-origin"));
    const iframeRow = el("div", "demo-row");
    this.iframeEmbed = createEmbed({
      mode: "iframe",
      label: "Framed same-origin demo page",
      src: "embed-demo.html",
    });
    this.iframeEmbed.el.style.width = "100%";
    iframeRow.appendChild(this.iframeEmbed.el);
    p.appendChild(iframeRow);

    // shadow mode — deliberately garish foreign CSS, sealed inside the root so
    // it cannot restyle the gallery around it. Named colors + a rounded corner
    // that would be banned on the identity surface prove the isolation.
    p.appendChild(el("div", "set-title", "shadow mode — foreign CSS, non-leaking"));
    const shadowRow = el("div", "demo-row");
    this.shadowEmbed = createEmbed({
      mode: "shadow",
      label: "Foreign widget (garish CSS, contained)",
    });
    this.shadowEmbed.el.style.width = "100%";
    shadowRow.appendChild(this.shadowEmbed.el);
    p.appendChild(shadowRow);

    // Load the vendored, sha256-pinned foreign stylesheet and seal it into the
    // shadow root. Fetched same-origin next to gallery.js.
    fetch(new URL("third_party/foreign-widget.css", import.meta.url))
      .then((r) => r.text())
      .then((css) => {
        this.shadowEmbed.setContent(
          "<style>" + css + "</style>"
          + "<div class='foreign'>Foreign vendor UI. Its garish styling "
          + "(hotpink fill, lime dashed border, rounded corners) is sealed "
          + "inside the shadow root and cannot leak out to restyle the "
          + "gallery. Its stylesheet is a real vendored file, pinned by sha256 "
          + "under gallery/third_party/.</div>",
        );
      });

    this.root.appendChild(p);
  },

  refresh() {},
};

// ---------- state view (the house state pattern) ----------

// The L2 state story, live: a single createStore holds the demo state; a
// synthetic ticker mutates it; a bound widget and a keyed reconciled list
// update in place. This is exactly the pattern a consumer app writes — build
// the DOM once, then push every change through the store. No declarative
// re-render layer exists by design.
const stateStore = createStore({
  count: 0,
  level: 20,
  label: "tick 0",
  items: [
    { id: "alpha", label: "Alpha", value: 42 },
    { id: "beta", label: "Beta", value: 17 },
    { id: "gamma", label: "Gamma", value: 63 },
    { id: "delta", label: "Delta", value: 28 },
  ],
});

const StateView = {
  root: null,
  built: false,
  timer: null,
  seq: 0, // monotonic create-stamp: proves reconcile reuses nodes on reorder

  build() {
    if (this.built) return;
    this.built = true;

    const p = panel("Live state — store · bind · reconcile", "faders");
    const note = el("p", null,
      "A synthetic ticker mutates a createStore four times a second. A bound slider and text field track store keys via bind(); a keyed leaderboard reconciles in place, reusing and reordering its existing DOM nodes. This is the house pattern: build once, mutate through the store — there is no declarative render layer by design.");
    note.style.marginTop = "0";
    note.style.color = "var(--text-dim)";
    note.style.fontSize = "13px";
    p.appendChild(note);

    // bind() a slider to the numeric "level" key: the ticker moves it live.
    const level = createSlider({ name: "state-level", label: "Level", min: 0, max: 100, value: stateStore.get("level") });
    this.unbindLevel = bind(stateStore, "level", level);
    const levelField = createField({ label: "Level (bound to store.level)", control: level, hint: "Driven entirely by the store via bind() — no direct widget calls." });
    p.appendChild(levelField.el);

    // bind() a text field to the string "label" key.
    const label = createInput({ name: "state-label", label: "Label (bound to store.label)", value: stateStore.get("label") });
    this.unbindLabel = bind(stateStore, "label", label);
    p.appendChild(label.el);

    // select(): a memoized projection (the current leader), updated via
    // subscribe only when the leader actually changes.
    const readout = el("div", "state-readout mono");
    readout.dataset.testid = "state-readout";
    this.leader = stateStore.select((snap) => [...snap.items].sort((a, b) => b.value - a.value)[0].id);
    const paintReadout = () => {
      readout.textContent = "count " + stateStore.get("count") + " · leader " + this.leader.get();
    };
    this.offLeader = this.leader.subscribe(paintReadout);
    this.offCount = stateStore.subscribe("count", paintReadout);
    paintReadout();
    p.appendChild(readout);

    // reconcile(): a keyed leaderboard. Each row is stamped with its key and a
    // create-sequence at CREATE time; on reorder the reconciler reuses the
    // node, so the stamp survives — the proof that node identity is preserved.
    p.appendChild(el("div", "set-title", "Reconciled leaderboard (keyed, reorders live)"));
    this.list = el("div", "state-list");
    this.list.dataset.testid = "state-list";
    p.appendChild(this.list);
    this.offItems = stateStore.subscribe("items", () => this.renderList());
    this.renderList();

    this.root.appendChild(p);
    this.start();
  },

  renderList() {
    reconcile(this.list, stateStore.get("items"), (it) => it.id, {
      create: (it) => {
        const row = el("div", "state-row");
        row.dataset.key = it.id;
        row.dataset.createSeq = String(++this.seq);
        row.appendChild(el("span", "state-name", it.label));
        row.appendChild(el("span", "state-val mono", String(it.value)));
        return row;
      },
      update: (row, it) => {
        row.querySelector(".state-val").textContent = String(it.value);
      },
    });
  },

  start() {
    this.stop();
    this.timer = setInterval(() => {
      stateStore.update("count", (n) => n + 1);
      const t = stateStore.get("count");
      stateStore.set("label", "tick " + t);
      stateStore.set("level", Math.round(50 + 45 * Math.sin(t / 3)));
      // New array with shuffled values (identity change → the store emits),
      // sorted descending so the leaderboard reorders over time.
      const items = stateStore.get("items")
        .map((it) => ({ ...it, value: (it.value + (it.id.length * 7 + t * 13) % 37) % 100 }))
        .sort((a, b) => b.value - a.value);
      stateStore.set("items", items);
    }, 250);
  },

  // Graceful stop for the demo ticker (also releases the store bindings). Not
  // called by the shell today, but demonstrates the teardown contract that a
  // real view would run in its own lifecycle.
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },

  refresh() {},
};

// ---------- realtime view (sse / socket lifecycle) ----------

// The realtime transports, live. There is no realtime server behind the
// gallery, so the socket connects to a nonexistent same-origin endpoint on
// purpose: the connection fails and the framework-owned backoff drives the
// closed -> reconnecting lifecycle, which is exactly what this demo surfaces.
// The socket is button-gated (it never auto-connects) so a route walk stays
// free of connection-failure console noise.
const RealtimeView = {
  root: null,
  built: false,
  sock: null,
  stream: null,
  attempts: 0,

  build() {
    if (this.built) return;
    this.built = true;

    const p = panel("Realtime — sse · socket", "compare");
    const note = el("p", null,
      "sse(path, {onMessage}) wraps EventSource; socket(path, {onMessage, onReconnect?, reconnect?}) wraps WebSocket with framework-owned exponential backoff (1000ms, ×2, capped at 30000ms). Paths are relative/same-origin only — an absolute or external URL is a hard error, which is what keeps consumer code conformance-clean. No realtime server is mounted, so Connect targets a nonexistent endpoint to show the closed → reconnecting lifecycle.");
    note.style.marginTop = "0";
    note.style.color = "var(--text-dim)";
    note.style.fontSize = "13px";
    p.appendChild(note);

    const status = el("div", "realtime-status mono", "idle");
    status.dataset.testid = "realtime-status";
    const setStatus = (s) => { status.textContent = s; };

    const row = el("div", "demo-row");
    const connectBtn = el("button", "btn primary", "Connect");
    const disconnectBtn = el("button", "btn", "Disconnect");
    const sseBtn = el("button", "btn", "SSE connect");
    const sseStopBtn = el("button", "btn", "SSE close");
    disconnectBtn.disabled = true;
    sseStopBtn.disabled = true;

    // sse() demo: EventSource against a nonexistent endpoint. The browser owns
    // reconnection (it resends Last-Event-ID); onError surfaces the drop.
    sseBtn.addEventListener("click", () => {
      if (this.stream) return;
      sseBtn.disabled = true;
      sseStopBtn.disabled = false;
      setStatus("SSE connecting… (browser-native reconnection)");
      this.stream = sse("/sse/nonexistent-demo-stream", {
        onMessage: (data) => setStatus("SSE message: " + JSON.stringify(data)),
        onOpen: () => setStatus("SSE connected"),
        onError: () => setStatus("SSE error — EventSource will retry automatically"),
      });
    });
    sseStopBtn.addEventListener("click", () => {
      if (this.stream) { this.stream.close(); this.stream = null; }
      sseBtn.disabled = false;
      sseStopBtn.disabled = true;
      setStatus("SSE closed by user");
    });

    connectBtn.addEventListener("click", () => {
      if (this.sock) return;
      this.attempts = 0;
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      setStatus("connecting…");
      this.sock = socket("/ws/nonexistent-demo-endpoint", {
        onMessage: (data) => setStatus("message: " + JSON.stringify(data)),
        onOpen: () => setStatus("connected"),
        onError: () => {
          this.attempts += 1;
          setStatus("disconnected — reconnecting (attempt " + this.attempts + ", backoff grows to a 30s cap)");
        },
        onReconnect: () => setStatus("reconnected — a real app would resync here"),
      });
    });

    disconnectBtn.addEventListener("click", () => {
      if (this.sock) { this.sock.close(); this.sock = null; }
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      setStatus("closed by user (no further reconnects)");
    });

    row.appendChild(connectBtn);
    row.appendChild(disconnectBtn);
    row.appendChild(sseBtn);
    row.appendChild(sseStopBtn);
    p.appendChild(row);
    p.appendChild(status);

    const relNote = el("p", "hash",
      "The socket's onReconnect() fires only after a SUCCESSFUL reconnection (never here — the endpoint does not exist) because resync is application-level: the framework signals the moment, you choose the strategy. send() while closed throws — there is no silent buffering.");
    relNote.style.marginTop = "var(--space-12)";
    p.appendChild(relNote);

    this.root.appendChild(p);
  },

  refresh() {},
};

// ---------- transcript recipe (store · reconcile · realtime · primitives) ----

// A RECIPE, not a shipped widget: it proves the existing primitives compose
// into a streaming-chat-transcript pattern without a new component. A real app
// would feed this from socket()/sse(); here a synthetic interval stands in for
// the server so the gallery needs no backend. The store holds an append-only
// keyed message list; reconcile() owns the DOM node identity; each block is a
// collapsible el()-built disclosure; auto-scroll pins to the bottom and pauses
// when you scroll up; the buffer is capped (oldest messages drop).
const TRANSCRIPT_ROLES = ["system", "agent", "user"];
const TRANSCRIPT_LINES = [
  "Session opened. Wiring the store subscription and the reconciler.",
  "How does the transcript stay pinned to the newest message?",
  "It pins while you are at the bottom. Scroll up and it pauses, revealing a jump-to-latest control; new messages then append without yanking your view.",
  "Streaming a longer block to show the collapsible body. Click any header to collapse or expand it — the store carries the collapsed flag, reconcile() reuses the node, so the toggle survives every reorder and trim. This is the whole point: no bespoke widget, just store + reconcile + el().",
  "Buffer note: the recipe caps retained messages (here 200, a stand-in for a ~256KB document budget) and drops the oldest, so a long-running stream never grows the DOM without bound.",
  "user acknowledged.",
];

// The append-only transcript store (module-level so the demo survives route
// switches, exactly like the State route's store).
const MAX_TRANSCRIPT_MESSAGES = 200;
const transcriptStore = createStore({ messages: [] });

const TranscriptView = {
  root: null,
  built: false,
  timer: null,
  seq: 0,
  pinned: true, // auto-scroll follows the tail until the user scrolls up

  build() {
    if (this.built) return;
    this.built = true;

    const p = panel("Transcript recipe — store · reconcile · realtime", "docs");
    const note = el("p", null,
      "A RECIPE composing the primitives — not a shipped widget. A synthetic ticker stands in for a socket()/sse() feed. The store holds an append-only keyed list; reconcile() preserves node identity across appends and trims; each block is a collapsible el() disclosure; auto-scroll pins to the tail and pauses on scroll-up; the buffer is capped so the DOM never grows without bound.");
    note.style.marginTop = "0";
    note.style.color = "var(--text-dim)";
    note.style.fontSize = "13px";
    p.appendChild(note);

    // The scroll viewport. Its scroll position drives the pin/pause state.
    this.scroll = el("div", "transcript-scroll");
    this.scroll.dataset.testid = "transcript-scroll";
    this.list = el("div", "transcript-list");
    this.scroll.appendChild(this.list);
    this.scroll.addEventListener("scroll", () => {
      const atBottom =
        this.scroll.scrollHeight - this.scroll.scrollTop - this.scroll.clientHeight < 24;
      this.pinned = atBottom;
      this.resume.classList.toggle("hidden", this.pinned);
    });
    p.appendChild(this.scroll);

    // Jump-to-latest affordance, shown only while paused (scrolled up).
    this.resume = el("button", "btn ghost transcript-resume hidden", "Paused — jump to latest");
    this.resume.dataset.testid = "transcript-resume";
    this.resume.addEventListener("click", () => {
      this.pinned = true;
      this.scrollToTail();
      this.resume.classList.add("hidden");
    });
    p.appendChild(this.resume);

    this.root.appendChild(p);

    this.offMessages = transcriptStore.subscribe("messages", () => this.render());
    this.render();
    this.start();
  },

  render() {
    reconcile(this.list, transcriptStore.get("messages"), (m) => m.id, {
      create: (m) => this.createBlock(m),
      update: (node, m) => this.updateBlock(node, m),
    });
    if (this.pinned) this.scrollToTail();
  },

  createBlock(m) {
    const block = el("div", "transcript-block role-" + m.role + (m.collapsed ? " collapsed" : ""));
    block.dataset.testid = "transcript-block";
    block.dataset.msgId = m.id;

    const head = el("button", "transcript-head");
    head.type = "button";
    head.setAttribute("aria-expanded", String(!m.collapsed));
    const chev = el("span", "transcript-chevron");
    chev.innerHTML = icon("chevron");
    head.appendChild(chev);
    head.appendChild(el("span", "transcript-role", m.role));
    const time = el("span", "transcript-time mono");
    // liveRelativeTime keeps the timestamp fresh from one shared ticker.
    this.offTimes = this.offTimes || [];
    this.offTimes.push(liveRelativeTime(time, m.ts));
    head.appendChild(time);
    head.addEventListener("click", () => this.toggleCollapse(m.id));
    block.appendChild(head);

    const body = el("div", "transcript-body");
    body.textContent = m.text;
    block.appendChild(body);
    return block;
  },

  updateBlock(node, m) {
    node.classList.toggle("collapsed", !!m.collapsed);
    node.querySelector(".transcript-head").setAttribute("aria-expanded", String(!m.collapsed));
  },

  // Toggle a message's collapsed flag immutably (new object + new array), so
  // the store emits and reconcile() updates in place.
  toggleCollapse(id) {
    const next = transcriptStore.get("messages").map(
      (m) => (m.id === id ? { ...m, collapsed: !m.collapsed } : m),
    );
    transcriptStore.set("messages", next);
  },

  scrollToTail() {
    this.scroll.scrollTop = this.scroll.scrollHeight;
  },

  // The synthetic source: append a message, trimming to the cap. In a real app
  // this body is an onMessage handler from socket()/sse().
  start() {
    this.stop();
    this.timer = setInterval(() => {
      const n = ++this.seq;
      const msg = {
        id: "m" + n,
        role: TRANSCRIPT_ROLES[n % TRANSCRIPT_ROLES.length],
        text: "#" + n + " · " + TRANSCRIPT_LINES[n % TRANSCRIPT_LINES.length],
        ts: Date.now(),
        collapsed: false,
      };
      const next = [...transcriptStore.get("messages"), msg];
      // Capped buffer: drop the oldest beyond the retention limit.
      if (next.length > MAX_TRANSCRIPT_MESSAGES) next.splice(0, next.length - MAX_TRANSCRIPT_MESSAGES);
      transcriptStore.set("messages", next);
    }, 600);
  },

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },

  refresh() {},
};

// ---------- data view (data-display widgets: badge, stats, table, virtual list) ----------

const DataView = {
  root: null,
  built: false,

  build() {
    if (this.built) return;
    this.built = true;

    // badges — every variant.
    const bp = panel("Badges", "faders");
    bp.appendChild(el("p", "hash",
      "Five variants (ok, warn, err, muted, neutral). The status hue drives the border + a soft fill (a non-text 3:1 signal); the label stays high-contrast so it clears 4.5:1 in both themes. warn pulls the new --gold."));
    const brow = el("div", "demo-row");
    brow.dataset.testid = "data-badges";
    for (const v of ["ok", "warn", "err", "muted", "neutral"]) brow.appendChild(badge(v, v));
    bp.appendChild(brow);
    this.root.appendChild(bp);

    // stats — explicit trends.
    const sp = panel("Stats", "compare");
    const statsRow = renderStats([
      { label: "throughput", value: "1.2k", unit: "req/s", trend: "good" },
      { label: "error rate", value: "0.4", unit: "%", trend: "bad" },
      { label: "p99 latency", value: "180", unit: "ms", trend: "neutral" },
      { label: "build", value: "0.4.0" },
    ]);
    statsRow.el.dataset.testid = "data-stats";
    sp.appendChild(statsRow.el);
    sp.appendChild(el("p", "hash",
      "Trend direction is ALWAYS explicit. A rising error rate is bad; a rising throughput is good; the same number means either — so the widget never infers direction. The delta shows as a colored triangle/edge (non-text), never as colored value text."));
    this.root.appendChild(sp);

    // data table — sortable (caller-side), node formatter, maxRows.
    const tp = panel("Data table", "library");
    tp.appendChild(el("p", "hash",
      "Sortable headers cycle none -> ascending -> descending and report the request via onSort; the widget never sorts or mutates the rows — THIS view re-sorts its own data. The Status column's formatter returns a live badge element. maxRows caps the body; the rest collapse into a footer note."));
    const files = [
      { name: "tokens.css", kind: "stylesheet", size: 4980, status: "ok" },
      { name: "shell.js", kind: "module", size: 12030, status: "ok" },
      { name: "space-grotesk-latin.woff2", kind: "font", size: 51840, status: "warn" },
      { name: "widgets.css", kind: "stylesheet", size: 9527, status: "ok" },
      { name: "table.js", kind: "module", size: 8816, status: "ok" },
      { name: "auditor.js", kind: "module", size: 30000, status: "err" },
      { name: "primitives.css", kind: "stylesheet", size: 38000, status: "ok" },
    ];
    const table = createTable({
      caption: "Shipped assets",
      maxRows: 5,
      // rowClass tints the whole row from its status token (warn -> gold, err ->
      // red); ok rows get no class. The hook only APPENDS the class to the tr.
      rowClass: (row) => (row.status === "ok" ? null : "gal-row-" + row.status),
      columns: [
        { key: "name", label: "Name", sortable: true },
        { key: "kind", label: "Kind", sortable: true },
        { key: "size", label: "Size", align: "end", sortable: true, format: (v) => (v / 1000).toFixed(1) + " kB" },
        { key: "status", label: "Status", format: (v) => badge(v, v) },
      ],
      rows: files.slice(),
      onSort: (key, dir) => {
        // Caller-side sort: the widget only reported the request.
        let next;
        if (dir === "none") {
          next = files.slice();
        } else {
          next = files.slice().sort((a, b) => {
            const av = a[key];
            const bv = b[key];
            const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
            return dir === "ascending" ? cmp : -cmp;
          });
        }
        table.setRows(next);
      },
    });
    table.el.dataset.testid = "data-table";
    tp.appendChild(table.el);
    this.root.appendChild(tp);

    // virtual list — 10,000 rows, bounded DOM.
    const vp = panel("Virtual list (10,000 rows)", "menu");
    vp.appendChild(el("p", "hash",
      "10,000 rows, but only the visible window (plus overscan) exists in the DOM. Fixed row height by design — variable heights are out of scope."));
    const listItems = Array.from({ length: 10000 }, (_, i) => ({ id: i, label: "row " + i }));
    const vlist = createVirtualList({
      rowHeight: 28,
      items: listItems,
      getKey: (it) => it.id,
      renderRow: (it) => {
        const row = el("div");
        row.appendChild(el("span", "hash", "#" + it.id));
        row.appendChild(el("span", null, it.label));
        return row;
      },
    });
    vlist.el.dataset.testid = "data-vlist";
    vlist.el.style.height = "320px";
    vp.appendChild(vlist.el);
    this.root.appendChild(vp);

    // tree — APG TreeView, keyboard-navigable.
    const trp = panel("Tree view", "library");
    trp.appendChild(el("p", "hash",
      "APG TreeView: role=tree/treeitem/group with a roving tabindex. Arrow keys move (Right expands/enters, Left collapses/exits), Home/End jump, Enter/Space activate. Synchronous data only — lazy/async children are out of scope."));
    const tree = createTree({
      label: "Project files",
      onSelect: (node) => toast("Selected: " + node.label),
      nodes: [
        { id: "assets", label: "assets", open: true, children: [
          { id: "js", label: "js", open: true, children: [
            { id: "index", label: "index.js" },
            { id: "widgets", label: "widgets.js" },
            { id: "tree", label: "tree.js" },
          ] },
          { id: "css", label: "css", children: [
            { id: "tokens", label: "tokens.css" },
            { id: "widgetscss", label: "widgets.css" },
          ] },
        ] },
        { id: "tests", label: "tests", children: [{ id: "unit", label: "unit" }] },
        { id: "pkg", label: "package.json" },
      ],
    });
    tree.el.dataset.testid = "data-tree";
    trp.appendChild(tree.el);
    this.root.appendChild(trp);

    // filter bar + chips — a slot strip over app-owned filter state.
    const fp = panel("Filter bar + chips", "faders");
    fp.appendChild(el("p", "hash",
      "The bar lays out existing controls (here a segmented + a search input) and owns NO filter state — filter state is app state. The chips mirror that state: clicking × calls onRemove and THIS view updates its state and re-renders the chips. Clear-all appears past one chip."));
    // App-owned filter state (the source of truth the widgets only present).
    let activeFilters = ["status: open", "kind: module"];
    const chips = createChips({
      items: activeFilters,
      onRemove: (_item, i) => { activeFilters = activeFilters.filter((_, k) => k !== i); chips.setItems(activeFilters); },
      onClearAll: () => { activeFilters = []; chips.setItems(activeFilters); },
    });
    chips.el.dataset.testid = "data-chips";
    const seg = createSegmented({
      name: "data-scope", label: "Scope",
      items: [{ value: "all", label: "All" }, { value: "mine", label: "Mine" }],
      value: "all",
    });
    const search = createInput({ name: "data-search", label: "Search", placeholder: "Filter…" });
    const filterBar = createFilterBar({ label: "Filters", slots: [seg, search] });
    filterBar.el.dataset.testid = "data-filterbar";
    fp.appendChild(filterBar.el);
    fp.appendChild(chips.el);
    this.root.appendChild(fp);

    // load more — a synthetic paged source, transport-agnostic.
    const lp = panel("Load more", "download");
    lp.appendChild(el("p", "hash",
      "Transport-agnostic: the caller supplies fetchPage(cursor) -> {items, nextCursor}. The button shows a loading state, appends each page, and hides at the end (nextCursor null). Errors surface as a visible line with a Retry — never swallowed. Here a synthetic source yields three pages."));
    const loadedList = el("ul", "hash");
    loadedList.dataset.testid = "data-loaded-list";
    const PAGES = 3;
    const loadMore = createLoadMore({
      pageSize: 4,
      fetchPage: (cursor) => new Promise((resolve) => {
        const page = cursor == null ? 0 : cursor;
        setTimeout(() => {
          const items = Array.from({ length: 4 }, (_, i) => "item " + (page * 4 + i));
          resolve({ items, nextCursor: page + 1 < PAGES ? page + 1 : null });
        }, 120);
      }),
      onItems: (items) => { for (const it of items) loadedList.appendChild(el("li", null, it)); },
    });
    loadMore.el.dataset.testid = "data-loadmore";
    lp.appendChild(loadedList);
    lp.appendChild(loadMore.el);
    this.root.appendChild(lp);

    // breadcrumbs — a router-agnostic trail with middle-ellipsis collapse.
    const cp = panel("Breadcrumbs", "compare");
    cp.appendChild(el("p", "hash",
      "Router-agnostic: a flat {label, href?} trail. The last item is the current page (aria-current). Beyond ~6 items the middle collapses into an expandable ellipsis."));
    const crumbs = createBreadcrumbs({
      items: [
        { label: "Home", href: "#/data" },
        { label: "Reports", href: "#/data" },
        { label: "2026", href: "#/data" },
        { label: "Q3", href: "#/data" },
        { label: "July", href: "#/data" },
        { label: "Week 29", href: "#/data" },
        { label: "Load report" },
      ],
      onNavigate: (item) => toast("Navigate: " + item.label),
    });
    crumbs.el.dataset.testid = "data-breadcrumbs";
    cp.appendChild(crumbs.el);
    this.root.appendChild(cp);

    // sparkline — inline SVG, colors from tokens via CSS.
    const skp = panel("Sparklines", "wave");
    skp.appendChild(el("p", "hash",
      "Tiny inline-SVG trend lines. Every color comes from the token layer via CSS classes — the SVG emits no color literals, so it re-themes for free. aria-hidden by default; pass a label when the trend itself carries meaning."));
    const skrow = el("div", "demo-row");
    skrow.dataset.testid = "data-sparkline";
    const sine = Array.from({ length: 24 }, (_, i) => Math.sin(i / 3) * 10 + 10);
    const ramp = Array.from({ length: 24 }, (_, i) => i);
    const noisy = [4, 9, 3, 12, 6, 15, 8, 11, 5, 14, 7, 18, 10, 6, 13, 9];
    skrow.appendChild(createSparkline({ values: sine, label: "sine trend" }).el);
    skrow.appendChild(createSparkline({ values: ramp, area: true, label: "ramp trend" }).el);
    skrow.appendChild(createSparkline({ values: noisy, area: true, label: "noisy trend" }).el);
    skp.appendChild(skrow);
    this.root.appendChild(skp);

    // chart container — renderer-agnostic lifecycle; the view brings the SVG.
    const chp = panel("Chart container", "faders");
    chp.appendChild(el("p", "hash",
      "The container ships NO charting — it drives a lifecycle: a sized root, a ResizeObserver (debounced to one paint per frame), a margin read from --chart-margin-* tokens, and the shared tooltip. THIS view brings the drawing (hand-rolled SVG here), pulling every color from the tokens via ctx.cssVar. Hover a bar for the shared tooltip."));
    const bars = [12, 28, 9, 34, 22, 40, 18, 30];
    const chart = createChartContainer({
      label: "Requests per hour",
      render: (ctx) => this.paintChart(ctx, bars),
      update: (ctx) => this.paintChart(ctx, bars),
    });
    chart.el.dataset.testid = "data-chart";
    chart.el.style.height = "160px";
    this.chart = chart;
    // Repaint on theme change so the token-read bar colors never go stale.
    window.addEventListener("tm:theme", () => chart.redraw());
    chp.appendChild(chart.el);
    this.root.appendChild(chp);

    // feed — presentation-only live log viewer.
    const gp = panel("Live feed", "menu");
    gp.appendChild(el("p", "hash",
      "Presentation-only: no transport coupling (wire your own sse/socket/polling). A capped buffer (200) prunes the oldest; stick-to-bottom autoscroll pauses when you scroll up and offers a jump-to-latest. Set data-level on your row for severity coloring."));
    const LEVELS = ["info", "success", "warn", "error"];
    let feedSeq = 0;
    const feed = createFeed({
      cap: 200,
      renderItem: (item) => {
        const row = el("div");
        row.dataset.level = item.level;
        row.appendChild(el("span", "hash", "#" + item.n + " "));
        row.appendChild(el("span", null, item.text));
        return row;
      },
    });
    feed.el.dataset.testid = "data-feed";
    feed.el.style.height = "200px";
    for (let i = 0; i < 6; i++) {
      feed.append({ n: feedSeq, level: LEVELS[feedSeq % 4], text: "seed line " + feedSeq });
      feedSeq += 1;
    }
    const emit = el("button", "btn");
    emit.type = "button";
    emit.textContent = "Emit log line";
    emit.dataset.testid = "data-feed-emit";
    emit.addEventListener("click", () => {
      feed.append({ n: feedSeq, level: LEVELS[feedSeq % 4], text: "log line " + feedSeq });
      feedSeq += 1;
    });
    gp.appendChild(emit);
    gp.appendChild(feed.el);
    this.root.appendChild(gp);

    // composed dashboard — the consistency showcase: filter bar + chips +
    // table + feed + sparklines side by side.
    const dp = panel("Dashboard (composed)", "library");
    dp.appendChild(el("p", "hash",
      "The consistency showcase: a filter bar + chips, a data table, a live feed, and sparklines composed into one strip. Every widget reads the same tokens, so a dashboard assembled from independent parts looks like one designed surface."));
    const dash = el("div", "data-dashboard");
    dash.dataset.testid = "data-dashboard";
    let dashFilters = ["region: us-east", "tier: pro"];
    const dashChips = createChips({
      items: dashFilters,
      onRemove: (_item, i) => { dashFilters = dashFilters.filter((_, k) => k !== i); dashChips.setItems(dashFilters); },
      onClearAll: () => { dashFilters = []; dashChips.setItems(dashFilters); },
    });
    const dashTabs = createTabs({
      label: "Range",
      items: [{ value: "24h", label: "24h" }, { value: "7d", label: "7d" }, { value: "30d", label: "30d" }],
      value: "24h",
    });
    const dashBar = createFilterBar({ label: "Dashboard filters", slots: [dashTabs] });
    const dashStats = renderStats([
      { label: "requests", value: "8.4k", unit: "/h", trend: "good" },
      { label: "errors", value: "12", unit: "/h", trend: "bad" },
      { label: "p95", value: "240", unit: "ms", trend: "neutral" },
    ]);
    const dashSparks = el("div", "demo-row");
    dashSparks.appendChild(createSparkline({ values: sine, area: true, label: "requests trend" }).el);
    dashSparks.appendChild(createSparkline({ values: noisy, label: "errors trend" }).el);
    const dashTable = createTable({
      caption: "Top endpoints",
      columns: [
        { key: "path", label: "Endpoint" },
        { key: "hits", label: "Hits", align: "end" },
        { key: "status", label: "Status", format: (v) => badge(v, v) },
      ],
      rows: [
        { path: "/api/search", hits: 3820, status: "ok" },
        { path: "/api/upload", hits: 940, status: "warn" },
        { path: "/api/report", hits: 210, status: "err" },
      ],
    });
    const dashFeed = createFeed({
      cap: 50,
      renderItem: (item) => {
        const row = el("div");
        row.dataset.level = item.level;
        row.appendChild(el("span", null, item.text));
        return row;
      },
    });
    dashFeed.el.style.height = "120px";
    for (const s of [
      { level: "info", text: "deploy started" },
      { level: "success", text: "healthcheck ok" },
      { level: "warn", text: "latency spike" },
      { level: "error", text: "5xx on /api/report" },
    ]) dashFeed.append(s);
    dash.appendChild(dashBar.el);
    dash.appendChild(dashChips.el);
    dash.appendChild(dashStats.el);
    dash.appendChild(dashSparks);
    dash.appendChild(dashTable.el);
    dash.appendChild(dashFeed.el);
    dp.appendChild(dash);
    this.root.appendChild(dp);
  },

  // Hand-rolled SVG bar chart drawn into the chart container's root. Colors are
  // pulled live from the tokens via ctx.cssVar (never literals), and each bar
  // carries a data-tooltip for the shared tooltip system.
  paintChart(ctx, values) {
    const { root, width, height, margin } = ctx;
    root.textContent = "";
    const w = width || 320;
    const h = height || 160;
    const plotW = Math.max(0, w - margin.left - margin.right);
    const plotH = Math.max(0, h - margin.top - margin.bottom);
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    const max = Math.max(1, ...values);
    const gap = 4;
    const bw = values.length ? (plotW - gap * (values.length - 1)) / values.length : 0;
    values.forEach((v, i) => {
      const bh = (v / max) * plotH;
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(margin.left + i * (bw + gap)));
      rect.setAttribute("y", String(margin.top + (plotH - bh)));
      rect.setAttribute("width", String(Math.max(0, bw)));
      rect.setAttribute("height", String(Math.max(0, bh)));
      rect.setAttribute("fill", ctx.cssVar("--accent"));
      rect.dataset.tooltip = v + " requests";
      svg.appendChild(rect);
    });
    root.appendChild(svg);
  },

  refresh() {
    // The chart draws from clientWidth/clientHeight, valid once the view is on
    // screen; force a redraw on each visit so a route re-entry repaints.
    if (this.chart) this.chart.redraw();
  },
};

// ---------- mount ----------

// ---------- chrome view (Phase 6A: shell & chrome primitives) ----------

// Built with createView. Demos openDrawer, createTabPanels, createGrid, and
// iconButton — plus shell.announce via the aria-live route announcer.
const ChromeView = createView({
  build(ctx) {
    // -- iconButton: instance-returning topbar buttons (setActive/setIcon) --
    const ib = panel("Icon buttons", "faders");
    const ibRow = el("div", "demo-row");
    const pin = iconButton({ icon: "bookmark", tip: "Pin (toggle)", active: false });
    pin.el.addEventListener("click", () => pin.setActive(!pin.el.classList.contains("on")));
    let playing = false;
    const play = iconButton({ icon: "wave", tip: "Play/pause (setIcon)" });
    play.el.addEventListener("click", () => { playing = !playing; play.setIcon(playing ? "check" : "wave"); play.setActive(playing); });
    ibRow.appendChild(pin.el);
    ibRow.appendChild(play.el);
    ib.appendChild(ibRow);
    ib.appendChild(el("p", "demo-note", "iconButton returns an {el, setActive, setIcon, destroy} instance — the topbar theme toggle above is a plain icon-btn; these are stateful."));
    ctx.root.appendChild(ib);

    // -- openDrawer: light-dismiss (left) and modal (right) --
    const dp = panel("Drawers", "compare");
    const dRow = el("div", "demo-row");
    const openLight = el("button", "btn", "Open light drawer (left)");
    openLight.type = "button";
    openLight.dataset.testid = "open-light-drawer";
    openLight.addEventListener("click", () => {
      const body = el("div");
      body.appendChild(el("p", null, "A non-modal drawer: click outside, press Escape, or use the close button. The page behind stays interactive."));
      openDrawer({ title: "Filters", body, side: "left", modal: false });
    });
    // A proper toggle button via registerOverlayTrigger: the framework owns the
    // click handler, aria-expanded, and open/close state. Pressing it toggles the
    // drawer; the kernel gesture-claim keeps a close-press from reopening it. It
    // is right-anchored so the trigger stays clear of the panel while open.
    const openToggle = el("button", "btn", "Toggle drawer (right)");
    openToggle.type = "button";
    openToggle.dataset.testid = "open-toggle-drawer";
    registerOverlayTrigger(openToggle, ({ trigger, onClose }) => {
      const body = el("div");
      body.appendChild(el("p", null, "A framework-owned toggle: press the button again to close, click outside, or press Escape."));
      return openDrawer({ title: "Toggle", body, side: "right", modal: false, trigger, onClose });
    });
    const openModalD = el("button", "btn", "Open dialog drawer (right)");
    openModalD.type = "button";
    openModalD.dataset.testid = "open-modal-drawer";
    openModalD.addEventListener("click", () => {
      const body = el("div");
      body.appendChild(el("p", null, "A modal drawer built on a native <dialog>: focus is trapped and the background is inert."));
      openDrawer({ title: "Details", body, side: "right", modal: true });
    });
    dRow.appendChild(openLight);
    dRow.appendChild(openToggle);
    dRow.appendChild(openModalD);
    dp.appendChild(dRow);
    ctx.root.appendChild(dp);

    // -- createTabPanels: APG tabs + lazy state-preserving panels --
    const tp = panel("Tab panels", "docs");
    const panels = createTabPanels({
      label: "Chrome demo sections",
      items: [
        { value: "overview", label: "Overview", build: (p) => p.appendChild(el("p", null, "Panels build lazily on first activation and are hidden (not destroyed) on switch, so state survives.")) },
        { value: "form", label: "Form", build: (p) => {
          const f = createInput({ name: "demo-tab-field", label: "Type here, switch away, come back" });
          p.appendChild(f.el);
        } },
        { value: "count", label: "Counter", build: (p) => {
          let n = 0;
          const out = el("p", null, "clicks: 0");
          const btn = el("button", "btn", "increment");
          btn.type = "button";
          btn.addEventListener("click", () => { n++; out.textContent = "clicks: " + n; });
          p.appendChild(out);
          p.appendChild(btn);
        } },
      ],
      value: "overview",
    });
    tp.appendChild(panels.el);
    ctx.root.appendChild(tp);

    // -- createGrid: preset layouts + createSegmented switcher composition --
    const gp = panel("Grid presets", "library");
    const grid = createGrid({ preset: "2x2" });
    const paint = () => grid.slots.forEach((s, i) => { s.innerHTML = ""; s.appendChild(el("div", "grid-cell mono", "slot " + (i + 1))); });
    paint();
    const switcher = createSegmented({
      name: "grid-preset",
      label: "Grid preset",
      items: [
        { value: "1x1", label: "1×1" },
        { value: "2x1", label: "2×1" },
        { value: "1x2", label: "1×2" },
        { value: "2x2", label: "2×2" },
      ],
      value: "2x2",
      onChange: (v) => { grid.setPreset(v); paint(); },
    });
    gp.appendChild(switcher.el);
    gp.appendChild(grid.el);
    gp.appendChild(el("p", "demo-note", "No switcher is baked into createGrid — this composes createSegmented with grid.setPreset(). createGrid is a content layout primitive, not a shell mode."));
    ctx.root.appendChild(gp);

    // -- shell.announce: push a message into the aria-live route announcer --
    const ap = panel("Announce", "info");
    const announceBtn = el("button", "btn", "Announce to screen readers");
    announceBtn.type = "button";
    announceBtn.dataset.testid = "announce-btn";
    announceBtn.addEventListener("click", () => shell.announce("Chrome demo announcement at " + new Date().toLocaleTimeString()));
    ap.appendChild(announceBtn);
    ap.appendChild(el("p", "demo-note", "shell.announce(msg) reuses the shell's polite aria-live region — the same one route changes use."));
    ctx.root.appendChild(ap);
  },
});

// Tri-state theme cycle: dark → light → system, driven by cycleTheme(). The
// icon reflects the STORED value (sun=dark, moon=light, gear=system), so the
// "system" state is visible even though data-theme resolves to light/dark.
const THEME_ICON = { dark: "sun", light: "moon", system: "gear" };
const themeIcon = () => THEME_ICON[settings.get("theme")] || "gear";
const themeBtnInstance = iconButton({
  icon: themeIcon(),
  tip: "Cycle theme: dark → light → system",
  onClick: () => cycleTheme(settings),
});
const themeBtn = themeBtnInstance.el;
themeBtn.dataset.testid = "theme-cycle";
const paintThemeBtn = () => { themeBtnInstance.setIcon(themeIcon()); };
window.addEventListener("tm:theme", paintThemeBtn);
paintThemeBtn();

// ---------- Async states + lazyMount demo ----------

// A simulated fetch: resolves after a short delay with data, an empty list, or
// a rejection, so renderAsync's loading → data / empty / error swap is visible.
function fakeFetch(kind) {
  return new Promise((res, rej) => setTimeout(() => {
    if (kind === "error") rej(new Error("Simulated fetch failure"));
    else if (kind === "empty") res([]);
    else res(["Alpha", "Beta", "Gamma", "Delta"]);
  }, 350));
}

const AsyncView = createView({
  build(ctx) {
    ctx.setSub("renderAsync + state blocks + lazyMount");
    const root = ctx.root;
    root.appendChild(el("h2", null, "Async states"));

    // renderAsync: swap blocks per promise state.
    const p1 = el("div", "panel");
    p1.appendChild(el("h3", null, "renderAsync"));
    p1.appendChild(el("p", "demo-note",
      "renderAsync swaps a loading block for the resolved data, the empty block when there is none, or the error block on failure — static-first and reduced-motion-safe."));
    const bar = el("div", "demo-row");
    const results = el("div");
    results.dataset.asyncResults = "";
    const load = (kind) => renderAsync(results, fakeFetch(kind), {
      loading: { label: "Fetching…" },
      empty: { title: "No results", sub: "the fetch returned an empty list" },
      error: { onRetry: () => load("data") },
      onData: (rows) => {
        if (!rows.length) return false;
        const ul = el("ul");
        rows.forEach((r) => ul.appendChild(el("li", null, r)));
        return ul;
      },
    });
    for (const [kind, label] of [["data", "Load data"], ["empty", "Load empty"], ["error", "Load error"]]) {
      const b = el("button", "btn", label);
      b.type = "button";
      b.dataset.async = kind;
      b.addEventListener("click", () => load(kind));
      bar.appendChild(b);
    }
    p1.appendChild(bar);

    // Toast action demo: a persistent toast with a single Undo action button.
    const actionRow = el("div", "demo-row");
    const toastBtn = el("button", "btn", "Toast with an action");
    toastBtn.type = "button";
    toastBtn.dataset.testid = "toast-action-btn";
    toastBtn.addEventListener("click", () =>
      toast("Saved a draft", "ok", { action: { label: "Undo", onClick: () => toast("Undone", "ok") } }));
    actionRow.appendChild(toastBtn);
    p1.appendChild(actionRow);
    p1.appendChild(results);
    root.appendChild(p1);

    // The three blocks, static.
    const p2 = el("div", "panel");
    p2.appendChild(el("h3", null, "State blocks"));
    p2.appendChild(loadingBlock({ label: "Loading…" }));
    p2.appendChild(emptyBlock({ title: "Nothing here yet", sub: "an empty collection" }));
    p2.appendChild(errorBlock({ message: "Something went wrong", onRetry: () => toast("Retried", "ok") }));
    root.appendChild(p2);

    // lazyMount: each card loads only when scrolled into view, 3 in flight.
    const p3 = el("div", "panel");
    p3.appendChild(el("h3", null, "lazyMount"));
    p3.appendChild(el("p", "demo-note",
      "Each card loads only when it scrolls into view, at most 3 loads in flight, draining in visibility order. Scroll the box to trigger loads."));
    const scroller = el("div", "lazy-scroller");
    const cards = [];
    for (let i = 0; i < 30; i++) {
      const c = el("div", "lazy-card");
      c.dataset.lazyCard = String(i);
      c.appendChild(el("span", "demo-note", "card " + (i + 1) + " — pending"));
      scroller.appendChild(c);
      cards.push(c);
    }
    p3.appendChild(scroller);
    root.appendChild(p3);
    lazyMount(cards, (card) => new Promise((res) => setTimeout(() => {
      card.classList.add("loaded");
      card.querySelector(".demo-note").textContent = "card " + (Number(card.dataset.lazyCard) + 1) + " — loaded";
      res();
    }, 150)), { root: scroller, concurrency: 3 });
  },
});

// Dogfood iconButton in the real topbar: a stateful "pin" toggle alongside the
// theme button (topbarActions accepts Nodes, so we pass the instance's .el).
const pinBtn = iconButton({ icon: "bookmark", tip: "Pin this page (demo toggle)", active: false });
pinBtn.el.addEventListener("click", () => pinBtn.setActive(!pinBtn.el.classList.contains("on")));

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
    chrome: {
      title: "Shell & chrome", icon: "faders", view: () => ChromeView, eager: true,
      tip: "Shell & chrome -- the Phase 6A structural primitives: openDrawer (light + modal), createTabPanels, createGrid presets, iconButton, and shell.announce. Eager route: built at mount.",
    },
    async: {
      title: "Async & lazy", icon: "download", view: () => AsyncView,
      tip: "Async & lazy -- the Phase 6B async-state blocks (renderAsync driving loading/data/empty/error) and lazyMount (IntersectionObserver-gated, concurrency-pumped loading).",
    },
    state: {
      title: "State", icon: "faders", view: () => StateView,
      tip: "State -- the L2 state story live: a store, bound widgets, and a keyed reconciled list, all mutating in place. No declarative render layer.",
    },
    data: {
      title: "Data", icon: "compare", view: () => DataView,
      tip: "Data -- the full data-display set live: badges, stat tiles, sortable table, 10,000-row virtual list, APG tree, filter bar + chips, transport-agnostic load-more, breadcrumbs, token-colored sparklines, a renderer-agnostic chart container, a live feed, and a composed dashboard strip.",
    },
    realtime: {
      title: "Realtime", icon: "compare", view: () => RealtimeView,
      tip: "Realtime -- sse() and socket() wrappers, live: connect to a nonexistent endpoint to watch the framework-owned reconnect backoff drive the closed/reconnecting lifecycle.",
    },
    transcript: {
      title: "Transcript recipe", icon: "docs", view: () => TranscriptView,
      tip: "Transcript recipe -- store + reconcile + realtime + primitives composed into a streaming-chat-transcript pattern: append-only keyed list, collapsible blocks, auto-scroll with pause-on-scroll-up, capped buffer. A recipe, not a widget.",
    },
    embed: {
      title: "Embed", icon: "compare", view: () => EmbedView,
      tip: "Embed -- the isolation boundary: a sandboxed iframe (same-origin demo) and a shadow root sealing garish foreign CSS.",
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
  topbarActions: [pinBtn.el, themeBtn],
  footer: { height: "40px", node: footerNode },
});

// ---------- command palette (opt-in) ----------

// installPalette is explicit opt-in (nothing binds a global key behind your
// back). It seeds a nav source from the shell's routes and binds mod+k. We add
// a second source of gallery-specific commands beyond navigation.
installPalette({ shortcut: "mod+k" });
registerPaletteSource(() => [
  { label: "Cycle theme", hint: "dark → light → system", icon: "sun", run: () => cycleTheme(settings) },
  { label: "Show a toast", hint: "demo", icon: "check", run: () => toast("Hello from the command palette", "ok") },
  { label: "Toast with an action", hint: "demo", icon: "note", run: () =>
    toast("Saved a draft", "ok", { action: { label: "Undo", onClick: () => toast("Undone", "ok") } }) },
]);
