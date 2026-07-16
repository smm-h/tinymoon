import { describe, it, expect, vi } from "vitest";
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

// subscribe() parity: the settings store gains a direct subscription channel
// with the IDENTICAL contract to createStore.subscribe (see store.test.js),
// additive to the tm:setting window event.
describe("createSettings subscribe (store-contract parity)", () => {
  it("fires cb(value, previousValue, key) on set, alongside tm:setting", () => {
    const store = createSettings({ storageKey: "tm-sub", defaults: { verbose: false } });
    const cb = vi.fn();
    const evt = vi.fn();
    window.addEventListener("tm:setting", evt);
    store.subscribe("verbose", cb);
    store.set("verbose", true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(true, false, "verbose");
    // The window event still fires (framework-global signal).
    expect(evt).toHaveBeenCalledTimes(1);
    expect(evt.mock.calls[0][0].detail).toEqual({ key: "verbose", value: true });
    window.removeEventListener("tm:setting", evt);
  });

  it("skips the subscriber when Object.is(old, value) (no-op write)", () => {
    const store = createSettings({ storageKey: "tm-sub", defaults: { verbose: false } });
    const cb = vi.fn();
    store.subscribe("verbose", cb);
    store.set("verbose", false); // unchanged
    expect(cb).not.toHaveBeenCalled();
  });

  it("a keyed subscriber ignores changes to other keys", () => {
    const store = createSettings({ storageKey: "tm-sub", defaults: { verbose: false, theme: "dark" } });
    const cb = vi.fn();
    store.subscribe("verbose", cb);
    store.set("theme", "light");
    expect(cb).not.toHaveBeenCalled();
  });

  it("null subscribes to any setting change", () => {
    const store = createSettings({ storageKey: "tm-sub", defaults: { verbose: false, theme: "dark" } });
    const cb = vi.fn();
    store.subscribe(null, cb);
    store.set("verbose", true);
    store.set("theme", "light");
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, true, false, "verbose");
    expect(cb).toHaveBeenNthCalledWith(2, "light", "dark", "theme");
  });

  it("unsubscribe stops further notifications", () => {
    const store = createSettings({ storageKey: "tm-sub", defaults: { verbose: false } });
    const cb = vi.fn();
    const off = store.subscribe("verbose", cb);
    store.set("verbose", true);
    off();
    store.set("verbose", false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("subscribe to an unknown key throws", () => {
    const store = createSettings({ storageKey: "tm-sub", defaults: { verbose: false } });
    expect(() => store.subscribe("nope", () => {})).toThrow(/unknown setting/);
  });
});
