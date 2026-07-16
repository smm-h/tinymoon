// Type-consumer fixture. Imports EVERY named export from both published
// barrels through the package's own name (self-referencing), which forces
// TypeScript to resolve them via package.json "exports" + "types" conditions.
// A missing or misnamed type here is a compile error -- `tsc --noEmit` is the
// permanent guarantee that every export ships with a declaration.

// -- core barrel ("tinymoon") -------------------------------------------------

import {
  $,
  $$,
  el,
  ICONS,
  icon,
  registerIcons,
  renderMiniMd,
  ensureTooltip,
  hideTip,
  ensureHovercard,
  hideHovercard,
  toast,
  setToastErrorHook,
  openModal,
  createSelect,
  createEmbed,
  registerCtx,
  registerCtxFooter,
  showCtxMenu,
  hideCtxMenu,
  openPopover,
  closePopover,
  createSwitch,
  copyButton,
  kebabButton,
  createCheckbox,
  createRadio,
  createFileInput,
  createSegmented,
  createTabs,
  createInput,
  createTextarea,
  createField,
  createNumber,
  createSlider,
  createDatePicker,
  createTimePicker,
  createCombobox,
  createMultiSelect,
  createAccordion,
  cssVar,
  ensureRoot,
  placeBelow,
  registerCopyable,
  unregisterCopyable,
  getCopyData,
  mountShell,
  announce,
  createView,
} from "tinymoon";

// -- extras barrel ("tinymoon/extras") ----------------------------------------

import {
  api,
  post,
  ApiError,
  setAuthHeader,
  sse,
  socket,
  fmtTime,
  relativeTime,
  liveRelativeTime,
  createSettings,
  renderDocMd,
  createWikiView,
} from "tinymoon/extras";

// -- state barrel ("tinymoon/state") ------------------------------------------

import {
  createStore,
  bind as bindStore,
  reconcile,
} from "tinymoon/state";

// -- widgets barrel ("tinymoon/widgets") --------------------------------------

import {
  badge,
  createStat,
  renderStats,
  createTable,
  createVirtualList,
  windowRange,
  createTree,
  createFilterBar,
  createChips,
  createLoadMore,
  createBreadcrumbs,
  createSparkline,
  sparklinePoints,
  createChartContainer,
  createFeed,
} from "tinymoon/widgets";

// Reference every import so the fixture is a genuine consumer. `unknownRef`
// swallows values without exercising their behavior; the typed calls below do
// the real checking.
function ref(..._values: unknown[]): void {}
ref(
  $, $$, el, ICONS, icon, registerIcons, renderMiniMd, ensureTooltip, hideTip,
  ensureHovercard, hideHovercard, toast, setToastErrorHook, openModal,
  createSelect, createEmbed, registerCtx, registerCtxFooter, showCtxMenu, hideCtxMenu,
  openPopover, closePopover, createSwitch, copyButton, kebabButton,
  createCheckbox, createRadio, createFileInput, createSegmented, createTabs,
  createInput, createTextarea, createField, createNumber, createSlider,
  createDatePicker, createTimePicker, createCombobox, createMultiSelect,
  createAccordion, cssVar, ensureRoot, placeBelow, registerCopyable,
  unregisterCopyable, getCopyData, mountShell, announce, createView,
  api, post, ApiError, setAuthHeader, sse, socket,
  fmtTime, relativeTime, liveRelativeTime,
  createSettings, renderDocMd, createWikiView,
  createStore, bindStore, reconcile,
  badge, createStat, renderStats, createTable, createVirtualList, windowRange,
  createTree, createFilterBar, createChips, createLoadMore, createBreadcrumbs,
  createSparkline, sparklinePoints, createChartContainer, createFeed,
);

// -- exercise a handful of typed calls (core) ---------------------------------

const heading: HTMLElement = el("h1", "title", "Hello");
const found: Element | null = $("#root");
const many: Element[] = $$(".item");
const markup: string = renderMiniMd("**bold** and `code`");
toast("saved", "ok", { duration: 2000 });

const sw = createSwitch({
  label: "Dark mode",
  value: true,
  onChange: (v: boolean) => ref(v),
});
sw.set(false);
sw.destroy();

const mapEmbed = createEmbed({ mode: "iframe", label: "Map", src: "/map" });
mapEmbed.setSrc?.("/map?zoom=2");
mapEmbed.destroy();

const nameInput = createInput({
  name: "username",
  label: "Username",
  type: "text",
  required: true,
  onInput: (v: string) => ref(v),
});
const nameValue: string = nameInput.value;
nameInput.set("ada");
nameInput.focus();
nameInput.setError("Taken");
nameInput.setError(null);
ref(nameValue, nameInput.get());

const bio = createTextarea({ name: "bio", label: "Bio", rows: 4 });
bio.set("hello");
bio.destroy();

// createView: a contract-conforming view object; ctx carries root + setSub.
const dashView = createView({
  build: (ctx) => {
    ctx.setSub("overview");
    ctx.root.appendChild(el("h2", null, "Dashboard"));
  },
  refresh: (ctx) => ref(ctx.root),
  setSub: (sub, ctx) => ref(sub, ctx.root),
});
ref(dashView.built, dashView.root);

// mountShell wires routes (incl. an eager route) and returns announce().
const shell = mountShell({
  root: el("div"),
  brand: { name: "Demo", logoHTML: "<b>D</b>" },
  routes: { home: { title: "Home", icon: "home", view: () => dashView, eager: true } },
  defaultRoute: "home",
});
shell.announce("Loaded");
announce("Standalone announce");

const volume = createSlider({
  name: "volume",
  label: "Volume",
  min: 0,
  max: 100,
  value: 40,
  onInput: (v: number) => ref(v),
  onChange: (v: number) => ref(v),
});
const vol: number = volume.value;
volume.set(80);
ref(vol, volume.get());

const volField = createField({ label: "Volume", control: volume, hint: "0–100" });
volField.setError("Too loud");
volField.setError(null);
ref(volField.el);

const qty = createNumber({
  name: "qty",
  label: "Quantity",
  min: 0,
  max: 10,
  step: 1,
  value: 2,
  onChange: (v: string) => ref(v),
});
qty.set("3");
qty.setError("Too many");
qty.setError(null);
ref(qty.value, qty.get());

const start = createTimePicker({
  name: "start",
  label: "Start time",
  value: "09:30",
  minuteStep: 15,
  onChange: (v: string) => ref(v),
});
start.set("14:00");
const startVal: string | null = start.value;
ref(startVal);

const country = createCombobox({
  name: "country",
  label: "Country",
  freeText: false,
  onFilter: (q: string) => Promise.resolve([{ value: "us", label: "United States" }].filter((i) => i.label.includes(q))),
  onChange: (v: string | null) => ref(v),
});
country.set("us", "United States");
const countryVal: string | null = country.get();
ref(countryVal, country.value);

const tags = createMultiSelect({
  name: "tags",
  label: "Tags",
  items: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
  values: ["a"],
  onChange: (vs: string[]) => ref(vs),
});
tags.setValues(["a", "b"]);
const tagVals: string[] = tags.values;
ref(tagVals);

const acc = createAccordion({
  items: [
    { title: "One", body: "first" },
    { title: "Two", body: el("div", null, "second"), open: true },
  ],
  multi: false,
});
acc.open(0);
acc.close(1);
acc.toggle(0);
ref(acc.el);

// -- exercise a handful of typed calls (extras) -------------------------------

// api/post are generic over the response body.
async function fetchThings(): Promise<void> {
  const users = await api<{ id: number }[]>("/api/users");
  const created = await post<{ ok: boolean }>(
    "/api/users",
    { name: "x" },
    (msg: string, status: number, path: string) => ref(msg, status, path),
  );
  ref(users, created);
}
ref(fetchThings);

// api/post accept per-request options (signal + headers); ApiError carries the
// response metadata; setAuthHeader registers a headers getter.
async function fetchWithOpts(): Promise<void> {
  const ctrl = new AbortController();
  try {
    await api<{ id: number }>("/api/thing", { signal: ctrl.signal, headers: { "X-Trace": "1" } });
    await post<{ ok: boolean }>("/api/thing", { a: 1 }, undefined, { signal: ctrl.signal });
  } catch (e) {
    if (e instanceof ApiError) {
      const s: number = e.status;
      const st: string = e.statusText;
      const p: string = e.path;
      const d: string | undefined = e.detail;
      ref(s, st, p, d);
    }
  }
}
ref(fetchWithOpts);
setAuthHeader(() => ({ Authorization: "Bearer token" }));

// realtime: sse + socket wrappers.
const stream = sse("/events", {
  onMessage: (data: unknown, event: MessageEvent) => ref(data, event),
  onError: (event: Event) => ref(event),
  events: { tick: (data: unknown) => ref(data) },
});
stream.close();

const ws = socket("/ws/chat", {
  onMessage: (data: unknown) => ref(data),
  onReconnect: () => ref("resync"),
  reconnect: true,
  protocols: ["v1"],
});
ws.send({ hello: "world" });
ws.send("raw string");
ws.close();

// format: fmtTime, relativeTime, liveRelativeTime.
const dur: string = fmtTime(3661);
const rel: string = relativeTime(new Date(), Date.now());
const rel2: string = relativeTime(Date.now() - 60000);
const stopLive: () => void = liveRelativeTime(el("time"), new Date());
stopLive();
ref(dur, rel, rel2);

// createSettings is generic over its schema: get()/set() are key-checked and
// return/accept the schema's value type.
const settings = createSettings({
  storageKey: "tm-demo",
  defaults: { theme: "dark", compact: false },
});
settings.load();
const theme: string = settings.get("theme");
const compact: boolean = settings.get("compact");
settings.set("theme", "light");
settings.applyTheme();
ref(theme, compact);

// -- exercise a handful of typed calls (state) --------------------------------

const store = createStore({ count: 0, label: "idle" });
const count: number = store.get("count");
store.set("count", 1);
store.update("count", (n: number) => n + 1);
const off = store.subscribe("count", (value: number, prev: number, key: "count" | "label") => ref(value, prev, key));
off();
const offAny = store.subscribe(null, (value, prev, key) => ref(value, prev, key));
offAny();
const doubled = store.select((snap) => snap.count * 2);
const doubledNow: number = doubled.get();
const offSel = doubled.subscribe((p: number) => ref(p));
offSel();
const snap = store.snapshot();
ref(count, doubledNow, snap.label);

// bind a store key to a widget's .set(v); unbind on teardown.
const boundVolume = createSlider({ name: "vol", label: "Vol", min: 0, max: 100, value: 0 });
const unbindVolume = bindStore(createStore({ vol: 10 }), "vol", boundVolume);
unbindVolume();

// reconcile a keyed list into a container.
const listHost: HTMLElement = el("div");
const nodes = reconcile(
  listHost,
  [{ id: "a", label: "A" }, { id: "b", label: "B" }],
  (item) => item.id,
  {
    create: (item) => el("div", "row", item.label),
    update: (node, item) => { node.textContent = item.label; },
    remove: (node, item) => ref(node, item),
  },
);
ref(nodes);

const docBody: HTMLElement = renderDocMd("### Intro {#intro}\n\nHello.");
const wiki = createWikiView({
  route: "docs",
  sections: [{ id: "intro", title: "Intro", md: "Hello." }],
});
wiki.build();
wiki.refresh();
ref(heading, found, many, markup, docBody, wiki);

// -- exercise a handful of typed calls (widgets) ------------------------------

// badge: a one-shot element (variant is a checked union).
const okBadge: HTMLElement = badge("Ready", "ok");
const bareBadge: HTMLElement = badge("Idle");
ref(okBadge, bareBadge);

// createStat / renderStats: trend is the explicit union.
const stat = createStat({ label: "Errors", value: 0, unit: "today", trend: "good" });
stat.set(3);
stat.setTrend("bad");
stat.setTrend(null);
const statsRow = renderStats([
  { label: "Items", value: 128 },
  { label: "Uptime", value: "42:07", trend: "neutral" },
]);
const firstStat: HTMLElement = statsRow.stats[0].el;
statsRow.destroy();
ref(stat.el, firstStat);

// createTable: columns are generic over the row shape; format may return a Node.
interface FileRow { name: string; size: number; }
const fileTable = createTable<FileRow>({
  caption: "Files",
  maxRows: 50,
  columns: [
    { key: "name", label: "Name", sortable: true },
    { key: (row) => row.size, label: "Size", align: "end", format: (v) => String(v) + " B" },
    { key: "name", label: "Chip", format: (_v, row) => badge(row.name, "muted") },
  ],
  rows: [{ name: "a.css", size: 10 }],
  onSort: (key, direction) => ref(key, direction),
});
fileTable.setRows([{ name: "b.js", size: 20 }]);
fileTable.destroy();
ref(fileTable.el);

// createVirtualList: generic over the item type; renderRow returns a Node.
const vlist = createVirtualList<{ id: number }>({
  rowHeight: 28,
  overscan: 4,
  items: [{ id: 1 }, { id: 2 }],
  getKey: (item) => item.id,
  renderRow: (item, index) => el("div", "row", "#" + index + " id=" + item.id),
});
vlist.setItems([{ id: 3 }]);
vlist.scrollToIndex(0);
vlist.destroy();
const range: { start: number; end: number } = windowRange(0, 200, 28, 1000, 4);
ref(vlist.el, range.start, range.end);

// createTree: recursive nodes, expand/collapse by id or path, onSelect(node).
const tree = createTree({
  label: "Files",
  nodes: [
    { id: "src", label: "src", open: true, children: [{ id: "app", label: "app.js" }] },
    { id: "docs", label: "docs" },
  ],
  onSelect: (node) => ref(node.id, node.label),
});
tree.expand("src");
tree.expand(["src", "app"]);
tree.collapse("src");
tree.setNodes([{ id: "x", label: "X" }]);
tree.destroy();
ref(tree.el);

// createFilterBar: layout-only; slots are nodes or instances with `.el`.
const filterBar = createFilterBar({ slots: [el("div"), { el: el("span") }] });
filterBar.setSlots([el("div")]);
filterBar.destroy();

// createChips: string / {label} / {key,value} items, remove + clear-all hooks.
const chips = createChips({
  items: ["draft", { label: "open" }, { key: "owner", value: "me" }],
  onRemove: (item, index) => ref(item, index),
  onClearAll: () => {},
});
chips.setItems(["a", "b"]);
chips.destroy();
ref(filterBar.el, chips.el);

// createLoadMore: transport-agnostic; fetchPage returns {items, nextCursor}.
const loadMore = createLoadMore<{ id: number }>({
  pageSize: 20,
  fetchPage: async (cursor) => ({ items: [{ id: 1 }], nextCursor: cursor == null ? "c2" : null }),
  onItems: (items) => ref(items.length),
});
loadMore.reset();
loadMore.destroy();
ref(loadMore.el);

// createBreadcrumbs: {label, href?} trail, onNavigate.
const crumbs = createBreadcrumbs({
  items: [{ label: "Home", href: "#/" }, { label: "Reports", href: "#/reports" }, { label: "Q3" }],
  onNavigate: (item, index) => ref(item.label, index),
});
crumbs.setItems([{ label: "Home", href: "#/" }]);
crumbs.destroy();
ref(crumbs.el);

// createSparkline: inline SVG; setData; sparklinePoints is pure geometry.
const spark = createSparkline({ values: [1, 3, 2, 5], area: true, label: "trend" });
spark.setData([2, 4, 6]);
const spts: Array<{ x: number; y: number }> = sparklinePoints([1, 2, 3], 100, 40);
spark.destroy();
ref(spark.el, spts[0]?.x);

// createChartContainer: renderer-agnostic; ctx carries root/size/margin/cssVar.
const chart = createChartContainer({
  label: "Load over time",
  render: (ctx) => ref(ctx.root, ctx.width, ctx.height, ctx.margin.left, ctx.cssVar("--accent")),
  update: (ctx) => ref(ctx.width),
});
chart.redraw();
chart.destroy();
ref(chart.el);

// createFeed: presentation-only; append/prepend/setItems, cap + onPrune.
const feed = createFeed<{ line: string }>({
  cap: 100,
  renderItem: (item) => el("div", "row", item.line),
  onPrune: (items) => ref(items.length),
});
feed.append({ line: "hello" });
feed.prepend({ line: "first" });
feed.setItems([{ line: "a" }, { line: "b" }]);
feed.destroy();
ref(feed.el);
