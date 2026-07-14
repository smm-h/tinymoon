import { describe, it, expect } from "vitest";
import { icon, registerIcons } from "../../../assets/js/icons.js";

// Characterization baseline for the icon registry. registerIcons must reject
// name collisions (icons are never silently overwritten), and icon() of a
// known built-in must return non-empty SVG markup. Pins current behavior
// before Phase 2. Note: icon() of an UNKNOWN name currently returns "" — that
// is a known bug pinned separately as an expected-fail in red-bugs.test.js.

describe("icons registry (characterization)", () => {
  it("registerIcons throws on a name collision with a built-in", () => {
    expect(() => registerIcons({ library: "<svg></svg>" })).toThrow(/already exists/);
  });

  it("icon() of a known built-in returns non-empty markup", () => {
    const svg = icon("library");
    expect(typeof svg).toBe("string");
    expect(svg.length).toBeGreaterThan(0);
    expect(svg).toContain("<svg");
  });

  it("registerIcons adds a new name that icon() can then resolve", () => {
    registerIcons({ "tm-test-unique-glyph": "<svg data-test></svg>" });
    expect(icon("tm-test-unique-glyph")).toContain("data-test");
  });
});
