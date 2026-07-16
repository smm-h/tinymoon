import { describe, it, expect } from "vitest";

// Unit tests for paginate.js: createLoadMore -> {el, reset, destroy}. Pins the
// transport-agnostic paging (cursor advance via nextCursor), end-of-pages
// (nextCursor null hides the button), the no-silent-failure error path (visible
// error + Retry re-requesting the SAME cursor), and reset().

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createLoadMore", () => {
  it("throws without fetchPage or onItems", async () => {
    const { createLoadMore } = await import("../../../assets/js/paginate.js");
    expect(() => createLoadMore({ onItems: () => {} })).toThrow(/fetchPage/);
    expect(() => createLoadMore({ fetchPage: async () => ({}) })).toThrow(/onItems/);
  });

  it("clicking Load more fetches a page, forwards items, and advances the cursor", async () => {
    const { createLoadMore } = await import("../../../assets/js/paginate.js");
    const seenCursors = [];
    const pages = {
      null: { items: [1, 2], nextCursor: "c1" },
      c1: { items: [3, 4], nextCursor: "c2" },
    };
    const got = [];
    const lm = createLoadMore({
      fetchPage: async (cursor) => { seenCursors.push(cursor); return pages[cursor == null ? "null" : cursor]; },
      onItems: (items) => got.push(...items),
    });
    const btn = lm.el.querySelector(".tm-loadmore-btn");
    btn.click();
    await flush();
    expect(got).toEqual([1, 2]);
    btn.click();
    await flush();
    expect(got).toEqual([1, 2, 3, 4]);
    expect(seenCursors).toEqual([null, "c1"]);
  });

  it("forwards the pageSize hint to fetchPage", async () => {
    const { createLoadMore } = await import("../../../assets/js/paginate.js");
    let seenSize;
    const lm = createLoadMore({
      pageSize: 25,
      fetchPage: async (_cursor, size) => { seenSize = size; return { items: [], nextCursor: null }; },
      onItems: () => {},
    });
    lm.el.querySelector(".tm-loadmore-btn").click();
    await flush();
    expect(seenSize).toBe(25);
  });

  it("hides the button and shows the end note when nextCursor is null", async () => {
    const { createLoadMore } = await import("../../../assets/js/paginate.js");
    const lm = createLoadMore({
      fetchPage: async () => ({ items: [1], nextCursor: null }),
      onItems: () => {},
    });
    const btn = lm.el.querySelector(".tm-loadmore-btn");
    btn.click();
    await flush();
    expect(btn.hidden).toBe(true);
    expect(lm.el.querySelector(".tm-loadmore-end").hidden).toBe(false);
  });

  it("surfaces a rejected fetch as a visible error with a Retry that re-requests the same cursor", async () => {
    const { createLoadMore } = await import("../../../assets/js/paginate.js");
    let calls = 0;
    const cursors = [];
    const lm = createLoadMore({
      fetchPage: async (cursor) => {
        cursors.push(cursor);
        calls += 1;
        if (calls === 1) throw new Error("network down");
        return { items: [7], nextCursor: null };
      },
      onItems: () => {},
    });
    const btn = lm.el.querySelector(".tm-loadmore-btn");
    btn.click();
    await flush();
    const errorBox = lm.el.querySelector(".tm-loadmore-error");
    expect(errorBox.hidden).toBe(false);
    expect(errorBox.textContent).toContain("network down");
    expect(btn.hidden).toBe(true);
    // Retry re-requests the SAME cursor (null — the failed first page).
    lm.el.querySelector(".tm-loadmore-retry").click();
    await flush();
    expect(cursors).toEqual([null, null]);
    expect(errorBox.hidden).toBe(true);
  });

  it("reset returns to the first-page state without fetching", async () => {
    const { createLoadMore } = await import("../../../assets/js/paginate.js");
    let calls = 0;
    const lm = createLoadMore({
      fetchPage: async () => { calls += 1; return { items: [1], nextCursor: null }; },
      onItems: () => {},
    });
    const btn = lm.el.querySelector(".tm-loadmore-btn");
    btn.click();
    await flush();
    expect(btn.hidden).toBe(true); // ended
    lm.reset();
    expect(btn.hidden).toBe(false);
    expect(lm.el.querySelector(".tm-loadmore-end").hidden).toBe(true);
    expect(calls).toBe(1); // reset did NOT fetch
  });

  it("destroy detaches the control", async () => {
    const { createLoadMore } = await import("../../../assets/js/paginate.js");
    const parent = document.createElement("div");
    const lm = createLoadMore({ fetchPage: async () => ({ items: [], nextCursor: null }), onItems: () => {} });
    parent.appendChild(lm.el);
    lm.destroy();
    expect(parent.children.length).toBe(0);
  });
});
