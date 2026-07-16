import { describe, it, expect } from "vitest";

// Unit tests for filterbar.js: createFilterBar (layout-only slots) and
// createChips (removable chips over caller state). Pins the presentation-only
// contract — chips do NOT self-remove; clicking × calls onRemove and the caller
// re-renders via setItems — plus clear-all visibility and empty collapse.

describe("createFilterBar", () => {
  it("returns {el, setSlots, destroy} and lays out node + instance slots", async () => {
    const { createFilterBar } = await import("../../../assets/js/filterbar.js");
    const a = document.createElement("div");
    const b = document.createElement("span");
    const bar = createFilterBar({ slots: [a, { el: b }] });
    expect(bar.el).toBeInstanceOf(HTMLElement);
    const cells = bar.el.querySelectorAll(".tm-filterbar-slot");
    expect(cells.length).toBe(2);
    expect(cells[0].firstChild).toBe(a);
    expect(cells[1].firstChild).toBe(b);
  });

  it("setSlots replaces the laid-out controls", async () => {
    const { createFilterBar } = await import("../../../assets/js/filterbar.js");
    const bar = createFilterBar({ slots: [document.createElement("div")] });
    bar.setSlots([document.createElement("input"), document.createElement("button")]);
    expect(bar.el.querySelectorAll(".tm-filterbar-slot").length).toBe(2);
  });

  it("ignores slots that are neither a Node nor carry an .el node", async () => {
    const { createFilterBar } = await import("../../../assets/js/filterbar.js");
    const bar = createFilterBar({ slots: [null, "x", {}, document.createElement("div")] });
    expect(bar.el.querySelectorAll(".tm-filterbar-slot").length).toBe(1);
  });

  it("destroy detaches the bar", async () => {
    const { createFilterBar } = await import("../../../assets/js/filterbar.js");
    const parent = document.createElement("div");
    const bar = createFilterBar({ slots: [] });
    parent.appendChild(bar.el);
    bar.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createChips", () => {
  it("renders string, {label}, and {key,value} items", async () => {
    const { createChips } = await import("../../../assets/js/filterbar.js");
    const chips = createChips({ items: ["draft", { label: "open" }, { key: "owner", value: "me" }] });
    const labels = Array.from(chips.el.querySelectorAll(".tm-chip-label")).map((n) => n.textContent);
    expect(labels).toEqual(["draft", "open", "owner: me"]);
  });

  it("each chip has a keyboard-operable × button with an accessible name", async () => {
    const { createChips } = await import("../../../assets/js/filterbar.js");
    const chips = createChips({ items: ["draft"] });
    const x = chips.el.querySelector(".tm-chip-x");
    expect(x.tagName).toBe("BUTTON");
    expect(x.getAttribute("aria-label")).toBe("Remove draft");
  });

  it("× calls onRemove(item, index) but does NOT self-remove (presentation-only)", async () => {
    const { createChips } = await import("../../../assets/js/filterbar.js");
    const removed = [];
    const chips = createChips({ items: ["a", "b"], onRemove: (item, i) => removed.push([item, i]) });
    chips.el.querySelectorAll(".tm-chip-x")[1].click();
    expect(removed).toEqual([["b", 1]]);
    // The chip is STILL rendered — the widget mirrors caller state, it does not
    // mutate it. The caller updates state and calls setItems.
    expect(chips.el.querySelectorAll(".tm-chip").length).toBe(2);
  });

  it("Clear-all appears only when more than one chip is present", async () => {
    const { createChips } = await import("../../../assets/js/filterbar.js");
    const one = createChips({ items: ["a"] });
    expect(one.el.querySelector(".tm-chips-clear")).toBeNull();
    const two = createChips({ items: ["a", "b"] });
    expect(two.el.querySelector(".tm-chips-clear")).not.toBeNull();
  });

  it("Clear-all calls onClearAll", async () => {
    const { createChips } = await import("../../../assets/js/filterbar.js");
    let cleared = false;
    const chips = createChips({ items: ["a", "b"], onClearAll: () => { cleared = true; } });
    chips.el.querySelector(".tm-chips-clear").click();
    expect(cleared).toBe(true);
  });

  it("collapses to nothing when empty", async () => {
    const { createChips } = await import("../../../assets/js/filterbar.js");
    const chips = createChips({ items: ["a", "b"] });
    chips.setItems([]);
    expect(chips.el.children.length).toBe(0);
    expect(chips.el.textContent).toBe("");
  });

  it("setItems re-renders from the new array", async () => {
    const { createChips } = await import("../../../assets/js/filterbar.js");
    const chips = createChips({ items: ["a"] });
    chips.setItems(["x", "y", "z"]);
    expect(chips.el.querySelectorAll(".tm-chip").length).toBe(3);
    expect(chips.el.querySelector(".tm-chips-clear")).not.toBeNull();
  });

  it("destroy detaches the strip", async () => {
    const { createChips } = await import("../../../assets/js/filterbar.js");
    const parent = document.createElement("div");
    const chips = createChips({ items: ["a"] });
    parent.appendChild(chips.el);
    chips.destroy();
    expect(parent.children.length).toBe(0);
  });
});
