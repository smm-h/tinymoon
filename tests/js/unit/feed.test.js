import { describe, it, expect } from "vitest";

// Unit tests for feed.js: createFeed -> {el, append, prepend, setItems,
// destroy}. Pins the capped buffer (pruning from the far end + onPrune), the
// data-level mirroring, and the stick-to-bottom / pause-on-scroll-up logic
// (scroll metrics are stubbed since happy-dom does no layout).

function textRow(item) {
  const d = document.createElement("div");
  d.textContent = String(item.text != null ? item.text : item);
  if (item && item.level) d.dataset.level = item.level;
  return d;
}

// Stub the scroll geometry of a feed container so atBottom() is controllable.
function stubScroll(el, { clientHeight, scrollHeight }) {
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => clientHeight });
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => scrollHeight });
}

describe("createFeed", () => {
  it("throws without renderItem", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    expect(() => createFeed({})).toThrow(/renderItem/);
  });

  it("append renders rows at the bottom in order", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    const f = createFeed({ renderItem: textRow });
    f.append("a");
    f.append("b");
    const rows = f.el.querySelectorAll(".tm-feed-item");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toBe("a");
    expect(rows[1].textContent).toBe("b");
  });

  it("caps the buffer, pruning the OLDEST (top) on append, and calls onPrune", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    const pruned = [];
    const f = createFeed({ renderItem: textRow, cap: 2, onPrune: (items) => pruned.push(...items) });
    f.append("a");
    f.append("b");
    f.append("c"); // overflow -> "a" pruned from the top
    const rows = f.el.querySelectorAll(".tm-feed-item");
    expect(Array.from(rows).map((r) => r.textContent)).toEqual(["b", "c"]);
    expect(pruned).toEqual(["a"]);
  });

  it("prepend adds to the top and prunes the far end (bottom) on overflow", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    const pruned = [];
    const f = createFeed({ renderItem: textRow, cap: 2, onPrune: (items) => pruned.push(...items) });
    f.append("a");
    f.append("b");
    f.prepend("z"); // top: z,a,b -> overflow prunes bottom ("b")
    const rows = f.el.querySelectorAll(".tm-feed-item");
    expect(Array.from(rows).map((r) => r.textContent)).toEqual(["z", "a"]);
    expect(pruned).toEqual(["b"]);
  });

  it("setItems keeps only the last cap items", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    const f = createFeed({ renderItem: textRow, cap: 3 });
    f.setItems(["a", "b", "c", "d", "e"]);
    const rows = f.el.querySelectorAll(".tm-feed-item");
    expect(Array.from(rows).map((r) => r.textContent)).toEqual(["c", "d", "e"]);
  });

  it("mirrors a caller-set data-level onto the row wrapper for severity styling", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    const f = createFeed({ renderItem: textRow });
    f.append({ text: "boom", level: "error" });
    const row = f.el.querySelector(".tm-feed-item");
    expect(row.dataset.level).toBe("error");
  });

  it("jump-to-latest is hidden until the user scrolls up, then re-hides at the bottom", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    const f = createFeed({ renderItem: textRow });
    const jump = f.el.querySelector(".tm-feed-jump");
    expect(jump.hidden).toBe(true);

    // Content taller than the viewport, scrolled up from the bottom.
    stubScroll(f.el, { clientHeight: 100, scrollHeight: 500 });
    f.el.scrollTop = 0;
    f.el.dispatchEvent(new window.Event("scroll"));
    expect(jump.hidden).toBe(false);

    // Scrolled back to the bottom -> pinned again, affordance hidden.
    f.el.scrollTop = 400;
    f.el.dispatchEvent(new window.Event("scroll"));
    expect(jump.hidden).toBe(true);
  });

  it("appending while paused does NOT autoscroll, but the jump button re-pins", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    const f = createFeed({ renderItem: textRow });
    const jump = f.el.querySelector(".tm-feed-jump");
    stubScroll(f.el, { clientHeight: 100, scrollHeight: 500 });
    f.el.scrollTop = 0;
    f.el.dispatchEvent(new window.Event("scroll")); // pause
    expect(jump.hidden).toBe(false);
    f.append("new"); // paused: no yank to bottom
    expect(f.el.scrollTop).toBe(0);
    // Jump re-pins to the bottom and hides the affordance.
    jump.click();
    expect(f.el.scrollTop).toBe(500);
    expect(jump.hidden).toBe(true);
  });

  it("destroy detaches the feed", async () => {
    const { createFeed } = await import("../../../assets/js/feed.js");
    const parent = document.createElement("div");
    const f = createFeed({ renderItem: textRow });
    parent.appendChild(f.el);
    f.destroy();
    expect(parent.children.length).toBe(0);
  });
});
