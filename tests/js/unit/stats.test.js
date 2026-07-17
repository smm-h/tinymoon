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

  it("accepts already-built createStat instances and passes them through", async () => {
    const { createStat, renderStats } = await import("../../../assets/js/stats.js");
    // Pre-build a tile, then hand the INSTANCE (not a config) to renderStats.
    // Previously this threw "label is required" because renderStats fed the
    // instance to createStat, which saw no .label.
    const pre = createStat({ label: "Pre", value: 7, trend: "good" });
    const row = renderStats([pre]);
    expect(row.stats.length).toBe(1);
    // The SAME instance is used (identity preserved), not a rebuilt copy.
    expect(row.stats[0]).toBe(pre);
    // Its already-set trend and value survived the pass-through.
    expect(row.el.querySelector(".stat-v-text").textContent).toBe("7");
    expect(row.stats[0].el.classList.contains("trend-good")).toBe(true);
    // And its .el is actually mounted into the row.
    expect(pre.el.parentNode).toBe(row.el);
  });

  it("accepts a mix of config objects and instances in one row", async () => {
    const { createStat, renderStats } = await import("../../../assets/js/stats.js");
    const inst = createStat({ label: "Inst", value: 2 });
    const row = renderStats([
      { label: "Cfg", value: 1 },       // config object -> createStat()
      inst,                              // instance -> passed through
    ]);
    expect(row.el.querySelectorAll(".stat").length).toBe(2);
    expect(row.stats[1]).toBe(inst);
    // The config entry became a fresh instance, distinct from the passed one.
    expect(row.stats[0]).not.toBe(inst);
    expect(row.stats[0].el.querySelector(".k").textContent).toBe("Cfg");
  });

  it("destroy tears down passed-through instances too", async () => {
    const { createStat, renderStats } = await import("../../../assets/js/stats.js");
    const parent = document.createElement("div");
    const inst = createStat({ label: "X", value: 1 });
    const row = renderStats([inst]);
    parent.appendChild(row.el);
    row.destroy();
    expect(parent.children.length).toBe(0);
    // The instance's node is detached by the row's destroy.
    expect(inst.el.parentNode).toBe(null);
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
