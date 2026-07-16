import { describe, it, expect, vi, afterEach } from "vitest";
import { createSettings, cycleTheme, THEME_BOOT_SNIPPET } from "../../../assets/js/settings.js";

// A controllable matchMedia: `matches` is togglable and `_set` fires a change
// event to every registered listener, simulating an OS light/dark flip.
function mockMatchMedia(dark) {
  let matches = dark;
  const listeners = new Set();
  const mql = {
    get matches() { return matches; },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_t, cb) => listeners.add(cb),
    removeEventListener: (_t, cb) => listeners.delete(cb),
    _set(v) { matches = v; for (const cb of [...listeners]) cb({ matches }); },
  };
  vi.stubGlobal("matchMedia", () => mql);
  return mql;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("applyTheme — tri-state resolution", () => {
  it("resolves a stored 'system' to dark when the OS prefers dark, keeping 'system' stored", () => {
    mockMatchMedia(true);
    const store = createSettings({ storageKey: "tm-th1", defaults: { theme: "system" } });
    store.applyTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(store.get("theme")).toBe("system");
  });

  it("resolves a stored 'system' to light when the OS prefers light", () => {
    mockMatchMedia(false);
    const store = createSettings({ storageKey: "tm-th2", defaults: { theme: "system" } });
    store.applyTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("applies an explicit dark/light value verbatim (OS ignored)", () => {
    mockMatchMedia(true); // OS dark, but explicit light must win
    const store = createSettings({ storageKey: "tm-th3", defaults: { theme: "light" } });
    store.applyTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("re-resolves live on OS change while the stored value is 'system'", () => {
    const mql = mockMatchMedia(false);
    const store = createSettings({ storageKey: "tm-th4", defaults: { theme: "system" } });
    store.applyTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    mql._set(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("stops re-resolving once the stored value leaves 'system'", () => {
    const mql = mockMatchMedia(false);
    const store = createSettings({ storageKey: "tm-th5", defaults: { theme: "system" } });
    store.applyTheme();
    store.set("theme", "light"); // set() re-applies
    expect(document.documentElement.dataset.theme).toBe("light");
    mql._set(true); // OS flips to dark, but stored is now light
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("cycleTheme", () => {
  it("cycles dark → light → system → dark and persists each step", () => {
    mockMatchMedia(false);
    const store = createSettings({ storageKey: "tm-th6", defaults: { theme: "dark" } });
    expect(cycleTheme(store)).toBe("light");
    expect(store.get("theme")).toBe("light");
    expect(cycleTheme(store)).toBe("system");
    expect(cycleTheme(store)).toBe("dark");
  });
});

describe("THEME_BOOT_SNIPPET", () => {
  it("is an inline script string resolving system before paint, with nothing the scanners flag", () => {
    expect(typeof THEME_BOOT_SNIPPET).toBe("string");
    expect(THEME_BOOT_SNIPPET).toContain("prefers-color-scheme");
    expect(THEME_BOOT_SNIPPET).toContain("dataset.theme");
    // No external URLs, no raw hex colors — checker-safe.
    expect(THEME_BOOT_SNIPPET).not.toMatch(/https?:\/\//);
    expect(THEME_BOOT_SNIPPET).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
