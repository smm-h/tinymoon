import { describe, it, expect } from "vitest";

// Unit tests for badge.js: badge(text, variant?) -> <span class="badge
// badge-<variant>">. A one-shot element factory, not a component.

describe("badge", () => {
  it("returns a bare <span> with the base + variant class", async () => {
    const { badge } = await import("../../../assets/js/badge.js");
    const b = badge("Ready", "ok");
    expect(b).toBeInstanceOf(HTMLElement);
    expect(b.tagName).toBe("SPAN");
    expect(b.classList.contains("badge")).toBe(true);
    expect(b.classList.contains("badge-ok")).toBe(true);
    expect(b.textContent).toBe("Ready");
  });

  it("defaults to the neutral variant", async () => {
    const { badge } = await import("../../../assets/js/badge.js");
    const b = badge("Idle");
    expect(b.classList.contains("badge-neutral")).toBe(true);
  });

  it("supports all five variants", async () => {
    const { badge } = await import("../../../assets/js/badge.js");
    for (const v of ["ok", "warn", "err", "muted", "neutral"]) {
      expect(badge("x", v).classList.contains("badge-" + v)).toBe(true);
    }
  });

  it("throws on an unknown variant (no silent fallback)", async () => {
    const { badge } = await import("../../../assets/js/badge.js");
    expect(() => badge("x", "success")).toThrow(/unknown variant/);
  });

  it("coerces non-string text and renders empty for null/undefined", async () => {
    const { badge } = await import("../../../assets/js/badge.js");
    expect(badge(42, "ok").textContent).toBe("42");
    expect(badge(null, "ok").textContent).toBe("");
    expect(badge(undefined).textContent).toBe("");
  });
});
