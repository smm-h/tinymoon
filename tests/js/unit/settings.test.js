import { describe, it, expect } from "vitest";
import { createSettings } from "../../../assets/js/settings.js";

// Characterization baseline for the settings store's hard-error contract.
// The store must fail loudly on missing schema parameters and on unknown
// keys — no silent defaults, no silent no-ops. This pins that behavior before
// Phase 2 touches the module.

describe("createSettings hard errors (characterization)", () => {
  it("throws when called with no arguments", () => {
    expect(() => createSettings()).toThrow();
  });

  it("throws when storageKey is missing", () => {
    expect(() => createSettings({ defaults: { theme: "dark" } })).toThrow(/storageKey/);
  });

  it("throws when defaults is missing", () => {
    expect(() => createSettings({ storageKey: "tm-test" })).toThrow(/defaults/);
  });

  it("get() of an unknown key throws", () => {
    const store = createSettings({ storageKey: "tm-test", defaults: { theme: "dark" } });
    expect(() => store.get("nope")).toThrow(/unknown setting/);
  });

  it("set() of an unknown key throws", () => {
    const store = createSettings({ storageKey: "tm-test", defaults: { theme: "dark" } });
    expect(() => store.set("nope", 1)).toThrow(/unknown setting/);
  });

  it("get() of a known key returns its default", () => {
    const store = createSettings({ storageKey: "tm-test", defaults: { theme: "dark" } });
    expect(store.get("theme")).toBe("dark");
  });
});
