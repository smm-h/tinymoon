import { describe, it, expect, vi, afterEach } from "vitest";
import {
  registerPaletteSource, openPalette, installPalette, score,
} from "../../../assets/js/palette.js";

const offs = [];
function src(fn) { const off = registerPaletteSource(fn); offs.push(off); return off; }
const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  // Close any open palette and unregister sources/installs.
  document.querySelectorAll(".tm-palette").forEach((d) => d.remove());
  while (offs.length) offs.pop()();
  document.body.innerHTML = "";
});

describe("palette — score / rank", () => {
  it("returns null when the query is not a subsequence", () => {
    expect(score("apple", "xyz")).toBeNull();
    expect(score("grape", "app")).toBeNull();
  });

  it("scores a subsequence match and prefers contiguous/leading hits", () => {
    expect(score("apple", "app")).not.toBeNull();
    // "app" is a leading contiguous run in "apple" but only scattered in "a-b-p-p".
    expect(score("apple", "app")).toBeGreaterThan(score("a_b_p_p", "app"));
  });
});

describe("palette — source aggregation & ranking", () => {
  it("aggregates items from all sources (sync and async) on open", async () => {
    src(() => [{ label: "Alpha", run() {} }]);
    src(async () => [{ label: "Beta", run() {} }]);
    const p = openPalette();
    await tick();
    const labels = [...p.el.querySelectorAll(".tm-palette-label")].map((e) => e.textContent).sort();
    expect(labels).toEqual(["Alpha", "Beta"]);
    p.close();
  });

  it("filters and ranks by subsequence once a query is typed", async () => {
    vi.useFakeTimers();
    src(() => [
      { label: "apple", run() {} },
      { label: "grape", run() {} },
      { label: "application", run() {} },
    ]);
    const p = openPalette();
    const input = p.el.querySelector(".tm-palette-input");
    input.value = "app";
    input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(150);
    const labels = [...p.el.querySelectorAll(".tm-palette-label")].map((e) => e.textContent);
    expect(labels).toContain("apple");
    expect(labels).toContain("application");
    expect(labels).not.toContain("grape");
    p.close();
    vi.useRealTimers();
  });

  it("shows the empty block when nothing matches", async () => {
    vi.useFakeTimers();
    src(() => [{ label: "apple", run() {} }]);
    const p = openPalette();
    const input = p.el.querySelector(".tm-palette-input");
    input.value = "zzz";
    input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(150);
    expect(p.el.querySelector(".empty-title").textContent).toBe("No matches");
    p.close();
    vi.useRealTimers();
  });
});

describe("palette — debounce & stale-discard", () => {
  it("debounces rapid typing into a single query", async () => {
    vi.useFakeTimers();
    const seen = [];
    src((q) => { seen.push(q); return []; });
    const p = openPalette();
    await vi.advanceTimersByTimeAsync(0); // the initial seed query("")
    const input = p.el.querySelector(".tm-palette-input");
    input.value = "a"; input.dispatchEvent(new Event("input"));
    input.value = "ab"; input.dispatchEvent(new Event("input"));
    input.value = "abc"; input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(150);
    // The seed "" plus exactly one debounced query for "abc".
    expect(seen).toEqual(["", "abc"]);
    p.close();
    vi.useRealTimers();
  });

  it("discards a stale response when a newer query supersedes it", async () => {
    vi.useFakeTimers();
    const calls = [];
    src((q) => new Promise((res) => calls.push({ q, res })));
    const p = openPalette();
    const input = p.el.querySelector(".tm-palette-input");
    input.value = "old"; input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(150);
    input.value = "new"; input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(150);
    // calls: [ "", "old", "new" ] — resolve the newest first, then the stale one.
    calls.find((c) => c.q === "new").res([{ label: "NEW", run() {} }]);
    await vi.advanceTimersByTimeAsync(0);
    calls.find((c) => c.q === "old").res([{ label: "OLD", run() {} }]);
    await vi.advanceTimersByTimeAsync(0);
    const labels = [...p.el.querySelectorAll(".tm-palette-label")].map((e) => e.textContent);
    expect(labels).toEqual(["NEW"]);
    p.close();
    vi.useRealTimers();
  });
});

describe("palette — keyboard & lifecycle", () => {
  it("Enter runs the active item and closes the palette", async () => {
    const ran = vi.fn();
    src(() => [{ label: "One", run: ran }, { label: "Two", run() {} }]);
    const p = openPalette();
    await tick();
    const input = p.el.querySelector(".tm-palette-input");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ran).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".tm-palette")).toBeNull();
  });

  it("ArrowDown moves the active option", async () => {
    src(() => [{ label: "One", run() {} }, { label: "Two", run() {} }]);
    const p = openPalette();
    await tick();
    const input = p.el.querySelector(".tm-palette-input");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const active = p.el.querySelector(".tm-palette-item.active .tm-palette-label");
    expect(active.textContent).toBe("Two");
    p.close();
  });

  it("openPalette is a singleton while open", async () => {
    src(() => []);
    const a = openPalette();
    const b = openPalette();
    expect(a).toBe(b);
    a.close();
  });
});

describe("palette — installPalette", () => {
  it("seeds a nav source from the rendered shell nav and returns an uninstaller", async () => {
    // Fake a mounted shell nav.
    const nav = document.createElement("nav");
    nav.id = "tm-nav";
    for (const [route, label] of [["home", "Home"], ["docs", "Docs"]]) {
      const b = document.createElement("button");
      b.className = "nav-item";
      b.dataset.route = route;
      const span = document.createElement("span");
      span.className = "nav-label";
      span.textContent = label;
      b.appendChild(span);
      nav.appendChild(b);
    }
    document.body.appendChild(nav);

    const uninstall = installPalette();
    const p = openPalette();
    await tick();
    const labels = [...p.el.querySelectorAll(".tm-palette-label")].map((e) => e.textContent).sort();
    expect(labels).toEqual(["Docs", "Home"]);
    p.close();
    uninstall();
  });
});
