import { describe, it, expect } from "vitest";

// Unit tests for createSelect: the custom select (combobox + listbox) with
// hidden real <select> for form participation.

describe("createSelect", () => {
  it("returns {el, set, value, setItems, destroy}", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "color",
      label: "Color",
      items: [{ value: "red", label: "Red" }, { value: "blue", label: "Blue" }],
    });
    expect(sel.el).toBeInstanceOf(HTMLElement);
    expect(typeof sel.set).toBe("function");
    expect(typeof sel.setItems).toBe("function");
    expect(typeof sel.destroy).toBe("function");
    expect(sel.value).toBe("red"); // defaults to first item
  });

  it("button has role=combobox and aria-label", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "size",
      label: "Size",
      items: [{ value: "s", label: "Small" }, { value: "m", label: "Medium" }],
    });
    const btn = sel.el.querySelector("button[role='combobox']");
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Size");
    expect(btn.getAttribute("aria-haspopup")).toBe("listbox");
  });

  it("aria-expanded is false when closed", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
    });
    const btn = sel.el.querySelector("button[role='combobox']");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("options have role=option and aria-selected", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      value: "b",
    });
    const opts = sel.el.querySelectorAll("[role='option']");
    expect(opts.length).toBe(2);
    expect(opts[0].getAttribute("aria-selected")).toBe("false");
    expect(opts[1].getAttribute("aria-selected")).toBe("true");
  });

  it("each option has a generated id", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    const opts = sel.el.querySelectorAll("[role='option']");
    expect(opts[0].id).toBeTruthy();
    expect(opts[1].id).toBeTruthy();
    expect(opts[0].id).not.toBe(opts[1].id);
  });

  it("hidden select syncs value", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "region",
      label: "Region",
      items: [
        { value: "us", label: "US" },
        { value: "eu", label: "EU" },
      ],
      value: "eu",
    });
    const hidden = sel.el.querySelector("select");
    expect(hidden).not.toBeNull();
    expect(hidden.name).toBe("region");
    expect(hidden.value).toBe("eu");
  });

  it("set() updates value and syncs hidden select", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      value: "a",
    });
    sel.set("b");
    expect(sel.value).toBe("b");
    const hidden = sel.el.querySelector("select");
    expect(hidden.value).toBe("b");
    // aria-selected should update
    const opts = sel.el.querySelectorAll("[role='option']");
    expect(opts[0].getAttribute("aria-selected")).toBe("false");
    expect(opts[1].getAttribute("aria-selected")).toBe("true");
  });

  it("set() throws for invalid value", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
    });
    expect(() => sel.set("nonexistent")).toThrow();
  });

  it("setItems() rebuilds options", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
    });
    sel.setItems([
      { value: "x", label: "X" },
      { value: "y", label: "Y" },
    ]);
    expect(sel.value).toBe("x"); // reset to first
    const opts = sel.el.querySelectorAll("[role='option']");
    expect(opts.length).toBe(2);
    const hidden = sel.el.querySelector("select");
    expect(hidden.querySelectorAll("option").length).toBe(2);
  });

  it("throws without name", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    expect(() => createSelect({ label: "X", items: [] })).toThrow("name is required");
  });

  it("throws without label", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    expect(() => createSelect({ name: "x", items: [] })).toThrow("label is required");
  });

  it("required propagates to hidden select", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
      required: true,
    });
    const hidden = sel.el.querySelector("select");
    expect(hidden.required).toBe(true);
  });

  it("disabled propagates to hidden select and button", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
      disabled: true,
    });
    const hidden = sel.el.querySelector("select");
    expect(hidden.disabled).toBe(true);
    const btn = sel.el.querySelector("button");
    expect(btn.disabled).toBe(true);
  });

  it("destroy removes the element from its parent", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const parent = document.createElement("div");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
    });
    parent.appendChild(sel.el);
    expect(parent.children.length).toBe(1);
    sel.destroy();
    expect(parent.children.length).toBe(0);
  });

  it("listbox has role=listbox", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
    });
    const listbox = sel.el.querySelector("[role='listbox']");
    expect(listbox).not.toBeNull();
  });

  it("combobox aria-controls references the listbox id", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
    });
    const btn = sel.el.querySelector("[role='combobox']");
    const listbox = sel.el.querySelector("[role='listbox']");
    expect(btn.getAttribute("aria-controls")).toBe(listbox.id);
  });

  it("value getter returns current selection", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      value: "b",
    });
    expect(sel.value).toBe("b");
    sel.set("a");
    expect(sel.value).toBe("a");
  });

  it("width option sets root element width", async () => {
    const { createSelect } = await import("../../../assets/js/select.js");
    const sel = createSelect({
      name: "x",
      label: "X",
      items: [{ value: "a", label: "A" }],
      width: "200px",
    });
    expect(sel.el.style.width).toBe("200px");
  });
});
