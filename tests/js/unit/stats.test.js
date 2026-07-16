import { describe, it, expect } from "vitest";

// Unit tests for stats.js: createStat -> {el, set, setTrend, destroy} and
// renderStats -> {el, stats, destroy}. Trend direction is ALWAYS explicit.

describe("createStat", () => {
  it("returns {el, set, setTrend, destroy} and renders label + value", async () => {
    const { createStat } = await import("../../../assets/js/stats.js");
    const s = createStat({ label: "Items", value: 128 });
    expect(s.el).toBeInstanceOf(HTMLElement);
    for (const m of ["set", "setTrend", "destroy"]) expect(typeof s[m]).toBe("function");
    expect(s.el.querySelector(".k").textContent).toBe("Items");
    expect(s.el.querySelector(".stat-v-text").textContent).toBe("128");
  });

  it("throws without a label", async () => {
    const { createStat } = await import("../../../assets/js/stats.js");
    expect(() => createStat({})).toThrow(/label is required/);
    expect(() => createStat()).toThrow();
  });

  it("renders the unit as a dimmed <small> suffix", async () => {
    const { createStat } = await import("../../../assets/js/stats.js");
    const s = createStat({ label: "Latency", value: "42", unit: "ms" });
    expect(s.el.querySelector(".v small").textContent).toBe("ms");
  });

  it("set(value) updates only the value text", async () => {
    const { createStat } = await import("../../../assets/js/stats.js");
    const s = createStat({ label: "Count", value: 1, unit: "ea" });
    s.set(9);
    expect(s.el.querySelector(".stat-v-text").textContent).toBe("9");
    // The unit suffix survives a value update.
    expect(s.el.querySelector(".v small").textContent).toBe("ea");
  });

  it("trend is explicit — the widget never infers it from the value", async () => {
    const { createStat } = await import("../../../assets/js/stats.js");
    // No trend passed: no trend-* class at all (no default coloring).
    const s = createStat({ label: "Errors", value: 5 });
    expect(s.el.className).toBe("stat");
    // A rising value does NOT auto-color: set() touches only the text.
    s.set(9999);
    expect(s.el.classList.contains("trend-bad")).toBe(false);
    expect(s.el.classList.contains("trend-good")).toBe(false);
  });

  it("setTrend applies exactly one trend class and can clear it", async () => {
    const { createStat } = await import("../../../assets/js/stats.js");
    const s = createStat({ label: "Uptime", value: "99%", trend: "good" });
    expect(s.el.classList.contains("trend-good")).toBe(true);
    s.setTrend("bad");
    expect(s.el.classList.contains("trend-good")).toBe(false);
    expect(s.el.classList.contains("trend-bad")).toBe(true);
    s.setTrend(null);
    expect(s.el.classList.contains("trend-bad")).toBe(false);
  });

  it("throws on an unknown trend", async () => {
    const { createStat } = await import("../../../assets/js/stats.js");
    expect(() => createStat({ label: "X", trend: "up" })).toThrow(/unknown trend/);
    const s = createStat({ label: "X" });
    expect(() => s.setTrend("down")).toThrow(/unknown trend/);
  });

  it("destroy detaches the tile", async () => {
    const { createStat } = await import("../../../assets/js/stats.js");
    const parent = document.createElement("div");
    const s = createStat({ label: "X", value: 1 });
    parent.appendChild(s.el);
    s.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("renderStats", () => {
  it("builds a .report-stats row with one tile per item", async () => {
    const { renderStats } = await import("../../../assets/js/stats.js");
    const row = renderStats([
      { label: "A", value: 1 },
      { label: "B", value: 2, trend: "good" },
    ]);
    expect(row.el.classList.contains("report-stats")).toBe(true);
    expect(row.el.querySelectorAll(".stat").length).toBe(2);
    expect(row.stats.length).toBe(2);
    expect(row.stats[1].el.classList.contains("trend-good")).toBe(true);
  });

  it("throws without an items array", async () => {
    const { renderStats } = await import("../../../assets/js/stats.js");
    expect(() => renderStats()).toThrow(/items array is required/);
  });

  it("destroy tears down every tile and the row", async () => {
    const { renderStats } = await import("../../../assets/js/stats.js");
    const parent = document.createElement("div");
    const row = renderStats([{ label: "A", value: 1 }]);
    parent.appendChild(row.el);
    row.destroy();
    expect(parent.children.length).toBe(0);
  });
});
