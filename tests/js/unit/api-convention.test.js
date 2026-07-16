import { describe, it, expect } from "vitest";

// API convention conformance test.
//
// tinymoon's unified primitive convention:
//   Factory function: createX(opts) -> instance
//   Instance shape:   { el: HTMLElement, ...methods }
//   No expando properties on DOM nodes
//   Required a11y params hard-error when absent
//   Teardown via .destroy() removes listeners and DOM
//
// This test tracks migration progress. Every component factory export from
// the barrel is listed in exactly one of two arrays: LEGACY (pre-convention)
// or MIGRATED (conforms to the convention). As primitives are migrated in
// subphases 3.2-3.8, their entries move from LEGACY to MIGRATED. When all
// are migrated, LEGACY is empty.
//
// Exports that are NOT component factories (utilities, imperative actions,
// registration functions, constants) are listed in NOT_COMPONENTS and are
// excluded from convention checks entirely.

// ---------------------------------------------------------------------------
// Classification of every barrel export
// ---------------------------------------------------------------------------

// Component factories: functions that create and return a stateful UI widget.
// These must eventually conform to the createX(opts) -> {el, ...} convention.

const LEGACY = [
  // Empty: all component factories now conform to the convention.
  // copyButton and kebabButton moved to NOT_COMPONENTS — they are
  // one-shot element factories (return a pre-wired <button>, no .el
  // wrapper, no state, no .destroy()), not stateful components.
];

const MIGRATED = [
  // controls.js — createX(opts) -> {el, ...} convention
  "createSwitch",
  "createCheckbox",
  "createRadio",
  "createFileInput",
  "createSegmented",
  "createTabs",
  // tabpanels.js — createTabPanels(opts) -> {el, set, value, destroy}
  "createTabPanels",
  // inputs.js — createX(opts) -> {el, ...} convention
  "createInput",
  "createTextarea",
  "createField",
  "createNumber",
  // slider.js — createSlider(opts) -> {el, value, set, get, destroy}
  "createSlider",
  // select.js — createSelect(opts) -> {el, set, value, setItems, destroy}
  "createSelect",
  // embed.js — createEmbed(opts) -> {el, ...mode methods, destroy}
  "createEmbed",
  // datepicker.js — createDatePicker(opts) -> {el, set, value, destroy}
  "createDatePicker",
  // timepicker.js — createTimePicker(opts) -> {el, set, value, destroy}
  "createTimePicker",
  // combobox.js — createCombobox / createMultiSelect -> {el, ..., destroy}
  "createCombobox",
  "createMultiSelect",
  // accordion.js — createAccordion(opts) -> {el, open, close, toggle, destroy}
  "createAccordion",
];

// Non-component exports: utilities, imperative actions, registration
// functions, constants. These do not produce component instances and are
// not subject to the convention.
//
// Only core barrel exports are listed here. Extras (wiki, net, settings)
// live in extras.js and are covered by the extras barrel test below.
const NOT_COMPONENTS = [
  // dom.js — query helpers and element factory
  "$", "$$", "el",
  // icons.js — icon data and helpers
  "ICONS", "icon", "registerIcons",
  // markdown.js — rendering
  "renderMiniMd",
  // tooltip.js — singleton lifecycle
  "ensureTooltip", "hideTip",
  // hovercard.js — singleton lifecycle
  "ensureHovercard", "hideHovercard",
  // toast.js — imperative action + hook registration
  "toast", "setToastErrorHook",
  // modal.js — imperative action (returns close fn, not a component)
  "openModal",
  // drawer.js — imperative overlay action (returns {el, close}, not a
  // createX(opts) component instance). Sibling of openModal.
  "openDrawer",
  // controls.js — one-shot element factories (return a pre-wired <button>,
  // not a stateful {el, ...} component instance). By decision these are
  // permanent, sanctioned element utilities: they intentionally do NOT follow
  // the createX(opts) -> {el, ...} component convention and will never be
  // reshaped into createX components.
  "copyButton", "kebabButton",
  // ctxmenu.js — registration + imperative actions
  "registerCtx", "registerCtxFooter", "showCtxMenu", "hideCtxMenu",
  // popover.js — imperative actions
  "openPopover", "closePopover",
  // kernel.js — infrastructure + copyable registry
  "cssVar", "ensureRoot", "getCopyData", "placeBelow",
  "registerCopyable", "unregisterCopyable",
  // shell.js — app shell + aria-live announcer
  "mountShell", "announce",
  // view.js — view-object factory (returns a {root, built, build, refresh}
  // view object, not an {el, ...} component instance). Convenience over the
  // same view contract mountShell already accepts.
  "createView",
];

// ---------------------------------------------------------------------------
// Barrel completeness: every export must appear in exactly one list
// ---------------------------------------------------------------------------

describe("api-convention: barrel coverage", () => {
  it("every barrel export is classified", async () => {
    const barrel = await import("../../../assets/js/index.js");
    const exportNames = Object.keys(barrel).sort();
    const classified = [...LEGACY, ...MIGRATED, ...NOT_COMPONENTS].sort();
    expect(classified).toEqual(exportNames);
  });

  it("no export appears in more than one list", () => {
    const all = [...LEGACY, ...MIGRATED, ...NOT_COMPONENTS];
    const seen = new Set();
    const dupes = [];
    for (const name of all) {
      if (seen.has(name)) dupes.push(name);
      seen.add(name);
    }
    expect(dupes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Convention checks for migrated primitives
// ---------------------------------------------------------------------------

describe("api-convention: migrated primitives", () => {
  it("createSwitch(opts) conforms to the convention", async () => {
    const { createSwitch } = await import("../../../assets/js/index.js");
    const instance = createSwitch({ label: "Test", value: false, onChange: () => {} });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createCheckbox(opts) conforms to the convention", async () => {
    const { createCheckbox } = await import("../../../assets/js/index.js");
    const instance = createCheckbox({ name: "test", label: "Test" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.get).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createRadio(opts) conforms to the convention", async () => {
    const { createRadio } = await import("../../../assets/js/index.js");
    const instance = createRadio({ name: "test", label: "Test", value: "a" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.get).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createFileInput(opts) conforms to the convention", async () => {
    const { createFileInput } = await import("../../../assets/js/index.js");
    const instance = createFileInput({ name: "test", label: "Choose" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.getFiles).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createSegmented(opts) conforms to the convention", async () => {
    const { createSegmented } = await import("../../../assets/js/index.js");
    const instance = createSegmented({
      name: "test",
      label: "Test",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createTabs(opts) conforms to the convention", async () => {
    const { createTabs } = await import("../../../assets/js/index.js");
    const instance = createTabs({
      label: "Test",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createTabPanels(opts) conforms to the convention", async () => {
    const { createTabPanels } = await import("../../../assets/js/index.js");
    const instance = createTabPanels({
      label: "Test",
      items: [{ value: "a", label: "A", build() {} }, { value: "b", label: "B", build() {} }],
    });
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createInput(opts) conforms to the convention", async () => {
    const { createInput } = await import("../../../assets/js/index.js");
    const instance = createInput({ name: "test", label: "Test" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.get).toBe("function");
    expect(typeof instance.focus).toBe("function");
    expect(typeof instance.setError).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createTextarea(opts) conforms to the convention", async () => {
    const { createTextarea } = await import("../../../assets/js/index.js");
    const instance = createTextarea({ name: "test", label: "Test" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.setError).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createField(opts) conforms to the convention", async () => {
    const { createField } = await import("../../../assets/js/index.js");
    const control = document.createElement("input");
    const instance = createField({ label: "Test", control });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.setError).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createSlider(opts) conforms to the convention", async () => {
    const { createSlider } = await import("../../../assets/js/index.js");
    const instance = createSlider({ name: "test", label: "Test", min: 0, max: 10 });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.get).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createSelect(opts) conforms to the convention", async () => {
    const { createSelect } = await import("../../../assets/js/index.js");
    const instance = createSelect({
      name: "test",
      label: "Test",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.setItems).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createEmbed(opts) conforms to the convention", async () => {
    const { createEmbed } = await import("../../../assets/js/index.js");
    const instance = createEmbed({ mode: "shadow", label: "Test" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.destroy).toBe("function");
  });

  it("createDatePicker(opts) conforms to the convention", async () => {
    const { createDatePicker } = await import("../../../assets/js/index.js");
    const instance = createDatePicker({ name: "test", label: "Test" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createNumber(opts) conforms to the convention", async () => {
    const { createNumber } = await import("../../../assets/js/index.js");
    const instance = createNumber({ name: "test", label: "Test" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.get).toBe("function");
    expect(typeof instance.setError).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createTimePicker(opts) conforms to the convention", async () => {
    const { createTimePicker } = await import("../../../assets/js/index.js");
    const instance = createTimePicker({ name: "test", label: "Test" });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createCombobox(opts) conforms to the convention", async () => {
    const { createCombobox } = await import("../../../assets/js/index.js");
    const instance = createCombobox({ name: "test", label: "Test", items: [] });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.get).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createMultiSelect(opts) conforms to the convention", async () => {
    const { createMultiSelect } = await import("../../../assets/js/index.js");
    const instance = createMultiSelect({ name: "test", label: "Test", items: [] });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.setValues).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createAccordion(opts) conforms to the convention", async () => {
    const { createAccordion } = await import("../../../assets/js/index.js");
    const instance = createAccordion({
      items: [{ title: "A", body: "aa" }, { title: "B", body: "bb" }],
    });
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.open).toBe("function");
    expect(typeof instance.close).toBe("function");
    expect(typeof instance.toggle).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Legacy inventory — documents what still needs migration
// ---------------------------------------------------------------------------

describe("api-convention: legacy inventory", () => {
  it("legacy list is empty (migration complete)", () => {
    // All component factories now conform to the convention. copyButton
    // and kebabButton were reclassified as NOT_COMPONENTS (one-shot element
    // factories, not stateful components).
    expect(LEGACY.length).toBe(0);
  });

  it("all legacy exports exist in the barrel", async () => {
    const barrel = await import("../../../assets/js/index.js");
    for (const name of LEGACY) {
      expect(barrel[name], name + " should be exported").toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Extras barrel coverage
// ---------------------------------------------------------------------------

const EXTRAS_EXPORTS = [
  // net.js — fetch wrappers + error type + auth hook
  "api", "post", "ApiError", "setAuthHeader",
  // realtime.js — SSE + WebSocket wrappers
  "sse", "socket",
  // format.js — media-duration + relative-time helpers
  "fmtTime", "relativeTime", "liveRelativeTime",
  // settings.js — store factory
  "createSettings",
  // wiki.js — rendering + view factory
  "renderDocMd", "createWikiView",
];

describe("api-convention: extras barrel coverage", () => {
  it("extras barrel exports exactly the expected names", async () => {
    const extras = await import("../../../assets/js/extras.js");
    const exportNames = Object.keys(extras).sort();
    expect(exportNames).toEqual([...EXTRAS_EXPORTS].sort());
  });
});

// ---------------------------------------------------------------------------
// State barrel coverage
// ---------------------------------------------------------------------------
//
// The state story (store.js via the state.js barrel) is classified separately
// from the component convention. createStore, bind, and reconcile are NOT
// widget components: they follow no createX(opts) -> {el, ...} shape, carry no
// .el, and manage no widget instance. createStore returns a plain store object
// (get/set/update/subscribe/select/snapshot), bind returns an unbind function,
// and reconcile returns an array of nodes. They are the state-management
// counterpart to the NOT_COMPONENTS utilities in the core barrel — permanent,
// sanctioned non-component exports that will never be reshaped into components.

const STATE_EXPORTS = [
  // store.js — reactive store factory, store↔widget binder, keyed reconciler
  "createStore", "bind", "reconcile",
];

describe("api-convention: state barrel coverage", () => {
  it("state barrel exports exactly the expected names", async () => {
    const state = await import("../../../assets/js/state.js");
    const exportNames = Object.keys(state).sort();
    expect(exportNames).toEqual([...STATE_EXPORTS].sort());
  });

  it("state exports are not widget components (no .el instances)", async () => {
    const { createStore, bind, reconcile } = await import("../../../assets/js/state.js");
    const store = createStore({ a: 1 });
    // A plain store object, not a component instance.
    expect(store.el).toBeUndefined();
    expect(typeof store.get).toBe("function");
    expect(typeof store.set).toBe("function");
    expect(typeof store.subscribe).toBe("function");
    // bind returns an unbind function, not an instance.
    const unbind = bind(store, "a", { set() {} });
    expect(typeof unbind).toBe("function");
    unbind();
    // reconcile is a function; it returns an array, not an instance.
    expect(typeof reconcile).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Widgets barrel coverage
// ---------------------------------------------------------------------------
//
// The data-display widgets (badge, stats, table, virtual list) live in the
// separate "tinymoon/widgets" barrel, classified separately from the core
// component convention (mirroring the state barrel). Two shapes coexist here:
//
// - createStat, renderStats, createTable, createVirtualList are stateful
//   components: createX(opts) -> {el, ...methods, destroy}, matching the
//   convention.
// - badge is a one-shot element factory (returns a bare <span>, no .el wrapper,
//   no state, no .destroy()), exactly like copyButton/kebabButton in the core
//   barrel. windowRange is a pure math utility. Neither is a component.

const WIDGETS_COMPONENT_EXPORTS = [
  "createStat", "renderStats", "createTable", "createVirtualList",
  // Phase 5B completion — all createX(opts) -> {el, ..., destroy} components.
  "createTree", "createFilterBar", "createChips", "createLoadMore",
  "createBreadcrumbs", "createSparkline", "createChartContainer", "createFeed",
];
const WIDGETS_NON_COMPONENT_EXPORTS = [
  // badge.js — one-shot element factory (bare <span>, not an instance).
  "badge",
  // virtuallist.js — pure windowing-math utility.
  "windowRange",
  // sparkline.js — pure geometry utility (like windowRange).
  "sparklinePoints",
];

describe("api-convention: widgets barrel coverage", () => {
  it("widgets barrel exports exactly the expected names", async () => {
    const widgets = await import("../../../assets/js/widgets.js");
    const exportNames = Object.keys(widgets).sort();
    const expected = [...WIDGETS_COMPONENT_EXPORTS, ...WIDGETS_NON_COMPONENT_EXPORTS].sort();
    expect(exportNames).toEqual(expected);
  });

  it("createStat(opts) conforms to the component convention", async () => {
    const { createStat } = await import("../../../assets/js/widgets.js");
    const instance = createStat({ label: "Items", value: 12 });
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.set).toBe("function");
    expect(typeof instance.setTrend).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("renderStats(items) conforms to the component convention", async () => {
    const { renderStats } = await import("../../../assets/js/widgets.js");
    const instance = renderStats([{ label: "A", value: 1 }, { label: "B", value: 2 }]);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(Array.isArray(instance.stats)).toBe(true);
    expect(typeof instance.destroy).toBe("function");
  });

  it("createTable(opts) conforms to the component convention", async () => {
    const { createTable } = await import("../../../assets/js/widgets.js");
    const instance = createTable({ columns: [{ key: "a", label: "A" }] });
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.setRows).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createVirtualList(opts) conforms to the component convention", async () => {
    const { createVirtualList } = await import("../../../assets/js/widgets.js");
    const instance = createVirtualList({ rowHeight: 24, renderRow: () => document.createElement("div") });
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.setItems).toBe("function");
    expect(typeof instance.scrollToIndex).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("badge is a one-shot element factory, not a component instance", async () => {
    const { badge } = await import("../../../assets/js/widgets.js");
    const node = badge("OK", "ok");
    // Returns a bare element directly (like copyButton), no {el, ...} wrapper.
    expect(node).toBeInstanceOf(HTMLElement);
    expect(node.classList.contains("badge")).toBe(true);
  });

  it("windowRange is a pure function, not a component", async () => {
    const { windowRange } = await import("../../../assets/js/widgets.js");
    expect(typeof windowRange).toBe("function");
    const r = windowRange(0, 100, 20, 1000, 3);
    expect(r).toHaveProperty("start");
    expect(r).toHaveProperty("end");
  });

  it("createTree(opts) conforms to the component convention", async () => {
    const { createTree } = await import("../../../assets/js/widgets.js");
    const instance = createTree({ nodes: [{ id: "a", label: "A" }] });
    expect(typeof instance).toBe("object");
    expect(instance).not.toBeInstanceOf(HTMLElement);
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.setNodes).toBe("function");
    expect(typeof instance.expand).toBe("function");
    expect(typeof instance.collapse).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createFilterBar(opts) conforms to the component convention", async () => {
    const { createFilterBar } = await import("../../../assets/js/widgets.js");
    const instance = createFilterBar({ slots: [] });
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.setSlots).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createChips(opts) conforms to the component convention", async () => {
    const { createChips } = await import("../../../assets/js/widgets.js");
    const instance = createChips({ items: ["a"] });
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.setItems).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createLoadMore(opts) conforms to the component convention", async () => {
    const { createLoadMore } = await import("../../../assets/js/widgets.js");
    const instance = createLoadMore({
      fetchPage: async () => ({ items: [], nextCursor: null }),
      onItems: () => {},
    });
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.reset).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createBreadcrumbs(opts) conforms to the component convention", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/widgets.js");
    const instance = createBreadcrumbs({ items: [{ label: "Home" }] });
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.setItems).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createSparkline(opts) conforms to the component convention", async () => {
    const { createSparkline } = await import("../../../assets/js/widgets.js");
    const instance = createSparkline({ values: [1, 2, 3] });
    expect(typeof instance).toBe("object");
    expect(typeof instance.setData).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("sparklinePoints is a pure function, not a component", async () => {
    const { sparklinePoints } = await import("../../../assets/js/widgets.js");
    expect(typeof sparklinePoints).toBe("function");
    const pts = sparklinePoints([0, 1], 100, 40);
    expect(Array.isArray(pts)).toBe(true);
  });

  it("createChartContainer(opts) conforms to the component convention", async () => {
    const { createChartContainer } = await import("../../../assets/js/widgets.js");
    const instance = createChartContainer({ label: "Demo", render: () => {} });
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.redraw).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });

  it("createFeed(opts) conforms to the component convention", async () => {
    const { createFeed } = await import("../../../assets/js/widgets.js");
    const instance = createFeed({ renderItem: (x) => document.createTextNode(String(x)) });
    expect(instance.el).toBeInstanceOf(HTMLElement);
    expect(typeof instance.append).toBe("function");
    expect(typeof instance.prepend).toBe("function");
    expect(typeof instance.setItems).toBe("function");
    expect(typeof instance.destroy).toBe("function");
  });
});
