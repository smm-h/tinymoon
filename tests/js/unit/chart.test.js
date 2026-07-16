import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Unit tests for chart.js: createChartContainer -> {el, redraw, destroy}. The
// container ships no charting; it drives a render lifecycle. ResizeObserver and
// requestAnimationFrame are mocked so the resize path and the rAF debounce are
// exercised deterministically.

let roCallback = null;
let roDisconnected = false;
let rafQueue = [];
let savedRO;
let savedRAF;
let savedCAF;

class MockResizeObserver {
  constructor(cb) { roCallback = cb; }
  observe() {}
  disconnect() { roDisconnected = true; }
}

function runRaf() {
  const q = rafQueue;
  rafQueue = [];
  for (const fn of q) fn();
}

beforeEach(() => {
  roCallback = null;
  roDisconnected = false;
  rafQueue = [];
  savedRO = globalThis.ResizeObserver;
  savedRAF = globalThis.requestAnimationFrame;
  savedCAF = globalThis.cancelAnimationFrame;
  globalThis.ResizeObserver = MockResizeObserver;
  globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
  globalThis.cancelAnimationFrame = () => {};
});

afterEach(() => {
  globalThis.ResizeObserver = savedRO;
  globalThis.requestAnimationFrame = savedRAF;
  globalThis.cancelAnimationFrame = savedCAF;
});

describe("createChartContainer", () => {
  it("throws without render or without a label", async () => {
    const { createChartContainer } = await import("../../../assets/js/chart.js");
    expect(() => createChartContainer({ label: "x" })).toThrow(/render/);
    expect(() => createChartContainer({ render: () => {} })).toThrow(/label is required/);
  });

  it("renders once on creation with a full context, and is a labelled image", async () => {
    const { createChartContainer } = await import("../../../assets/js/chart.js");
    const ctxs = [];
    const c = createChartContainer({ label: "Loads", render: (ctx) => ctxs.push(ctx) });
    expect(c.el.getAttribute("role")).toBe("img");
    expect(c.el.getAttribute("aria-label")).toBe("Loads");
    expect(ctxs.length).toBe(1);
    const ctx = ctxs[0];
    expect(ctx.root).toBeInstanceOf(HTMLElement);
    expect(typeof ctx.width).toBe("number");
    expect(typeof ctx.height).toBe("number");
    expect(typeof ctx.cssVar).toBe("function");
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(typeof ctx.margin[side]).toBe("number");
    }
    // The container never draws — it only hands the caller a draw root.
    expect(c.el.querySelector(".tm-chart-draw")).toBe(ctx.root);
  });

  it("redraw forces another full render", async () => {
    const { createChartContainer } = await import("../../../assets/js/chart.js");
    let renders = 0;
    const c = createChartContainer({ label: "x", render: () => { renders += 1; } });
    expect(renders).toBe(1);
    c.redraw();
    expect(renders).toBe(2);
  });

  it("a resize drives update() through a single rAF (debounced)", async () => {
    const { createChartContainer } = await import("../../../assets/js/chart.js");
    let renders = 0;
    let updates = 0;
    createChartContainer({
      label: "x",
      render: () => { renders += 1; },
      update: () => { updates += 1; },
    });
    expect(renders).toBe(1);
    // Two resize notifications before a frame runs coalesce into one update.
    roCallback([]);
    roCallback([]);
    expect(updates).toBe(0); // nothing until the frame runs
    runRaf();
    expect(updates).toBe(1);
    expect(renders).toBe(1); // resize uses update, not render
  });

  it("falls back to render() on resize when no update() is given", async () => {
    const { createChartContainer } = await import("../../../assets/js/chart.js");
    let renders = 0;
    createChartContainer({ label: "x", render: () => { renders += 1; } });
    expect(renders).toBe(1);
    roCallback([]);
    runRaf();
    expect(renders).toBe(2);
  });

  it("destroy disconnects the observer and detaches the container", async () => {
    const { createChartContainer } = await import("../../../assets/js/chart.js");
    const parent = document.createElement("div");
    const c = createChartContainer({ label: "x", render: () => {} });
    parent.appendChild(c.el);
    c.destroy();
    expect(roDisconnected).toBe(true);
    expect(parent.children.length).toBe(0);
  });
});
