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
  // controls.js — returns bare DOM elements with expando methods
  "copyButton",
  "kebabButton",
];

const MIGRATED = [
  // controls.js — createX(opts) -> {el, ...} convention
  "createSwitch",
  "createCheckbox",
  "createRadio",
  "createFileInput",
  "createSegmented",
  "createTabs",
  // select.js — createSelect(opts) -> {el, set, value, setItems, destroy}
  "createSelect",
  // datepicker.js — createDatePicker(opts) -> {el, set, value, destroy}
  "createDatePicker",
];

// Non-component exports: utilities, imperative actions, registration
// functions, store factories, constants. These do not produce component
// instances and are not subject to the convention.
const NOT_COMPONENTS = [
  // dom.js — query helpers and element factory
  "$", "$$", "el",
  // icons.js — icon data and helpers
  "ICONS", "icon", "registerIcons",
  // net.js — fetch wrappers
  "api", "post",
  // format.js — pure formatters
  "fmtTime",
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
  // ctxmenu.js — registration + imperative actions
  "registerCtx", "registerCtxFooter", "showCtxMenu", "hideCtxMenu",
  // popover.js — imperative actions
  "openPopover", "closePopover",
  // settings.js — store factory (not a UI component)
  "createSettings",
  // kernel.js — infrastructure + copyable registry
  "cssVar", "ensureRoot", "getCopyData", "placeBelow",
  "registerCopyable", "unregisterCopyable",
  // shell.js — app shell
  "mountShell",
  // wiki.js — rendering + view factory
  "renderDocMd", "createWikiView",
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
});

// ---------------------------------------------------------------------------
// Legacy inventory — documents what still needs migration
// ---------------------------------------------------------------------------

describe("api-convention: legacy inventory", () => {
  it("legacy list is non-empty (migration incomplete)", () => {
    // This test flips when all migrations are done: change to
    // expect(LEGACY.length).toBe(0) to gate on full migration.
    expect(LEGACY.length).toBeGreaterThan(0);
  });

  it("all legacy exports exist in the barrel", async () => {
    const barrel = await import("../../../assets/js/index.js");
    for (const name of LEGACY) {
      expect(barrel[name], name + " should be exported").toBeDefined();
    }
  });
});
