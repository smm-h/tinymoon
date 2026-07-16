import { describe, it, expect } from "vitest";

// Unit tests for sparkline.js: the pure sparklinePoints geometry with fixed
// values, plus createSparkline -> {el, setData, destroy} (inline SVG, area,
// a11y). Colors are asserted to be absent from the emitted SVG (they live in
// CSS), guarding the raw-color conformance rule.

describe("sparklinePoints", () => {
  it("returns [] for an empty series", async () => {
    const { sparklinePoints } = await import("../../../assets/js/sparkline.js");
    expect(sparklinePoints([], 100, 40)).toEqual([]);
  });

  it("places a single point at x=0 and vertical center", async () => {
    const { sparklinePoints } = await import("../../../assets/js/sparkline.js");
    expect(sparklinePoints([5], 100, 40)).toEqual([{ x: 0, y: 20 }]);
  });

  it("maps a two-point ascending series across the box with the axis flipped", async () => {
    const { sparklinePoints } = await import("../../../assets/js/sparkline.js");
    // min=0 -> bottom (y=height), max=10 -> top (y=0).
    expect(sparklinePoints([0, 10], 100, 40)).toEqual([{ x: 0, y: 40 }, { x: 100, y: 0 }]);
  });

  it("spreads x evenly and scales y from min..max", async () => {
    const { sparklinePoints } = await import("../../../assets/js/sparkline.js");
    expect(sparklinePoints([0, 5, 10], 100, 40)).toEqual([
      { x: 0, y: 40 }, { x: 50, y: 20 }, { x: 100, y: 0 },
    ]);
  });

  it("puts a flat series on the vertical center (no divide-by-zero)", async () => {
    const { sparklinePoints } = await import("../../../assets/js/sparkline.js");
    expect(sparklinePoints([5, 5, 5], 120, 30)).toEqual([
      { x: 0, y: 15 }, { x: 60, y: 15 }, { x: 120, y: 15 },
    ]);
  });
});

describe("createSparkline", () => {
  it("returns {el, setData, destroy} with an inline <svg> polyline", async () => {
    const { createSparkline } = await import("../../../assets/js/sparkline.js");
    const s = createSparkline({ values: [1, 2, 3] });
    expect(s.el.tagName.toLowerCase()).toBe("svg");
    expect(s.el.getAttribute("viewBox")).toBe("0 0 120 32");
    const line = s.el.querySelector("polyline.tm-spark-line");
    expect(line).not.toBeNull();
    expect(line.getAttribute("points")).toBeTruthy();
  });

  it("is aria-hidden by default and a labelled image when given a label", async () => {
    const { createSparkline } = await import("../../../assets/js/sparkline.js");
    const bare = createSparkline({ values: [1, 2] });
    expect(bare.el.getAttribute("aria-hidden")).toBe("true");
    const labelled = createSparkline({ values: [1, 2], label: "CPU trend" });
    expect(labelled.el.getAttribute("role")).toBe("img");
    expect(labelled.el.getAttribute("aria-label")).toBe("CPU trend");
    expect(labelled.el.hasAttribute("aria-hidden")).toBe(false);
  });

  it("adds a filled area path only when area:true", async () => {
    const { createSparkline } = await import("../../../assets/js/sparkline.js");
    const plain = createSparkline({ values: [0, 1, 2] });
    expect(plain.el.querySelector("path.tm-spark-area")).toBeNull();
    const filled = createSparkline({ values: [0, 1, 2], area: true, width: 100, height: 40 });
    const area = filled.el.querySelector("path.tm-spark-area");
    expect(area).not.toBeNull();
    // Closed path anchored on the baseline (y = height).
    expect(area.getAttribute("d")).toMatch(/^M 0 40 /);
    expect(area.getAttribute("d")).toMatch(/Z$/);
  });

  it("emits NO color literals or color attributes in the SVG (colors live in CSS)", async () => {
    const { createSparkline } = await import("../../../assets/js/sparkline.js");
    const s = createSparkline({ values: [1, 5, 2, 8], area: true });
    const html = s.el.outerHTML;
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab)\s*\(/);
    expect(html.toLowerCase()).not.toContain("fill=");
    expect(html.toLowerCase()).not.toContain("stroke=");
  });

  it("setData repaints the polyline from a new series", async () => {
    const { createSparkline } = await import("../../../assets/js/sparkline.js");
    const s = createSparkline({ values: [0, 1], width: 100, height: 40 });
    const before = s.el.querySelector("polyline").getAttribute("points");
    s.setData([0, 5, 10]);
    const after = s.el.querySelector("polyline").getAttribute("points");
    expect(after).not.toBe(before);
    expect(after).toBe("0,40 50,20 100,0");
  });

  it("destroy detaches the svg", async () => {
    const { createSparkline } = await import("../../../assets/js/sparkline.js");
    const parent = document.createElement("div");
    const s = createSparkline({ values: [1, 2] });
    parent.appendChild(s.el);
    s.destroy();
    expect(parent.children.length).toBe(0);
  });
});
