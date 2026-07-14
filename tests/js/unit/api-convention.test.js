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
  "toggleWidget",
  "segmented",
  "copyButton",
  "kebabButton",
  // select.js — class with `new Select(opts)`, root on `.root` not `.el`
  "Select",
];

const MIGRATED = [
  // (none yet — all component factories are pre-convention)
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
  // kernel.js — infrastructure
  "cssVar", "ensureRoot", "placeBelow",
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
  // When MIGRATED is empty this test suite is a no-op scaffold.
  // As primitives are migrated, add a test case for each one.

  it("MIGRATED list is acknowledged (scaffold — no primitives migrated yet)", () => {
    // This assertion documents the starting state. Once the first primitive
    // is migrated, replace this with per-primitive checks.
    expect(MIGRATED.length).toBe(0);
  });

  // Template for per-primitive checks (uncomment and adapt when migrating):
  //
  // it("createToggle(opts) conforms to the convention", async () => {
  //   const { createToggle } = await import("../../../assets/js/index.js");
  //   // Factory returns an object, not a DOM node
  //   const instance = createToggle({ label: "Test", value: false, onChange: () => {} });
  //   expect(instance).toBeDefined();
  //   expect(typeof instance).toBe("object");
  //   expect(instance).not.toBeInstanceOf(HTMLElement);
  //   // .el is the root DOM element
  //   expect(instance.el).toBeInstanceOf(HTMLElement);
  //   // .destroy() exists
  //   expect(typeof instance.destroy).toBe("function");
  // });
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
