import { describe, it, expect } from "vitest";

// Unit tests for virtuallist.js: the pure windowing math (windowRange) and the
// createVirtualList component. happy-dom has no layout engine, so the component
// tests stub clientHeight/scrollTop to drive the windowing deterministically.

function stubLayout(el, viewportHeight) {
  let scroll = 0;
  Object.defineProperty(el, "clientHeight", { value: viewportHeight, configurable: true });
  Object.defineProperty(el, "scrollTop", {
    get: () => scroll,
    set: (v) => { scroll = v; },
    configurable: true,
  });
}

function rowRenderer(item) {
  const div = document.createElement("div");
  div.dataset.id = String(item.id);
  div.textContent = "id=" + item.id;
  return div;
}

describe("windowRange", () => {
  it("is empty for zero items or non-positive rowHeight", async () => {
    const { windowRange } = await import("../../../assets/js/virtuallist.js");
    expect(windowRange(0, 100, 20, 0, 3)).toEqual({ start: 0, end: 0 });
    expect(windowRange(0, 100, 0, 1000, 3)).toEqual({ start: 0, end: 0 });
  });

  it("windows around the scroll position, widened by overscan and clamped", async () => {
    const { windowRange } = await import("../../../assets/js/virtuallist.js");
    // scrollTop 0: first=0, visible=5, overscan 3 -> [0, 8)
    expect(windowRange(0, 100, 20, 1000, 3)).toEqual({ start: 0, end: 8 });
    // scrollTop 400: first=20 -> [17, 28)
    expect(windowRange(400, 100, 20, 1000, 3)).toEqual({ start: 17, end: 28 });
    // near the end: end clamps to itemCount
    expect(windowRange(19980, 100, 20, 1000, 3)).toEqual({ start: 996, end: 1000 });
  });
});

describe("createVirtualList", () => {
  it("throws without a positive rowHeight or a renderRow", async () => {
    const { createVirtualList } = await import("../../../assets/js/virtuallist.js");
    expect(() => createVirtualList({ renderRow: () => document.createElement("div") })).toThrow(/rowHeight/);
    expect(() => createVirtualList({ rowHeight: 20 })).toThrow(/renderRow/);
  });

  it("sizes the spacer to the full item count", async () => {
    const { createVirtualList } = await import("../../../assets/js/virtuallist.js");
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const vlist = createVirtualList({ rowHeight: 20, items, renderRow: rowRenderer });
    expect(vlist.el.querySelector(".tm-vlist-spacer").style.height).toBe("20000px");
  });

  it("keeps the live DOM node count bounded by the viewport, not the item count", async () => {
    const { createVirtualList } = await import("../../../assets/js/virtuallist.js");
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
    const vlist = createVirtualList({ rowHeight: 20, overscan: 3, items, renderRow: rowRenderer });
    stubLayout(vlist.el, 100);
    vlist.setItems(items); // re-render with the stubbed viewport
    const rows = vlist.el.querySelectorAll(".tm-vlist-row");
    // ceil(100/20)=5 visible + 2*3 overscan = 11 upper bound; nowhere near 10000.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(11);
  });

  it("scrollToIndex reaches the far end while staying bounded", async () => {
    const { createVirtualList } = await import("../../../assets/js/virtuallist.js");
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
    const vlist = createVirtualList({ rowHeight: 20, overscan: 3, items, renderRow: rowRenderer });
    stubLayout(vlist.el, 100);
    vlist.scrollToIndex(9999);
    const rows = vlist.el.querySelectorAll(".tm-vlist-row");
    expect(rows.length).toBeLessThanOrEqual(11);
    // The last item is rendered and positioned at index * rowHeight.
    const last = vlist.el.querySelector('[data-id="9999"]');
    expect(last).not.toBeNull();
    expect(last.parentElement.style.top).toBe("199980px");
  });

  it("reuses the same row node for a stable key across renders", async () => {
    const { createVirtualList } = await import("../../../assets/js/virtuallist.js");
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const vlist = createVirtualList({
      rowHeight: 20,
      overscan: 3,
      items,
      getKey: (item) => item.id,
      renderRow: rowRenderer,
    });
    stubLayout(vlist.el, 100);
    vlist.setItems(items);
    const before = vlist.el.querySelector('[data-id="3"]').parentElement;
    vlist.scrollToIndex(2); // id 3 stays within the window
    const after = vlist.el.querySelector('[data-id="3"]').parentElement;
    expect(after).toBe(before); // same node instance reused, not rebuilt
  });

  it("setItems swaps the data and resizes the spacer", async () => {
    const { createVirtualList } = await import("../../../assets/js/virtuallist.js");
    const vlist = createVirtualList({ rowHeight: 20, items: [{ id: 0 }], renderRow: rowRenderer });
    vlist.setItems(Array.from({ length: 50 }, (_, i) => ({ id: i })));
    expect(vlist.el.querySelector(".tm-vlist-spacer").style.height).toBe("1000px");
  });

  it("destroy detaches the container", async () => {
    const { createVirtualList } = await import("../../../assets/js/virtuallist.js");
    const parent = document.createElement("div");
    const vlist = createVirtualList({ rowHeight: 20, renderRow: rowRenderer });
    parent.appendChild(vlist.el);
    vlist.destroy();
    expect(parent.children.length).toBe(0);
  });
});
