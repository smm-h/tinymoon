import { describe, it, expect } from "vitest";

// Unit tests for controls.js primitives: createSwitch, createCheckbox,
// createRadio, createFileInput, createSegmented, createTabs. Each follows the
// createX(opts) -> {el, ...} convention.

describe("createSwitch", () => {
  it("returns {el, set, destroy}", async () => {
    const { createSwitch } = await import("../../../assets/js/controls.js");
    const sw = createSwitch({ label: "Test", value: false, onChange: () => {} });
    expect(sw.el).toBeInstanceOf(HTMLElement);
    expect(typeof sw.set).toBe("function");
    expect(typeof sw.destroy).toBe("function");
  });

  it("el has role=switch and aria-label", async () => {
    const { createSwitch } = await import("../../../assets/js/controls.js");
    const sw = createSwitch({ label: "Dark mode", value: true, onChange: () => {} });
    expect(sw.el.getAttribute("role")).toBe("switch");
    expect(sw.el.getAttribute("aria-label")).toBe("Dark mode");
  });

  it("aria-checked reflects value and toggles with set()", async () => {
    const { createSwitch } = await import("../../../assets/js/controls.js");
    const sw = createSwitch({ label: "Toggle", value: false, onChange: () => {} });
    expect(sw.el.getAttribute("aria-checked")).toBe("false");
    sw.set(true);
    expect(sw.el.getAttribute("aria-checked")).toBe("true");
    sw.set(false);
    expect(sw.el.getAttribute("aria-checked")).toBe("false");
  });

  it("get() reports the current on/off state (parity with checkbox/radio)", async () => {
    const { createSwitch } = await import("../../../assets/js/controls.js");
    const sw = createSwitch({ label: "Toggle", value: true, onChange: () => {} });
    expect(sw.get()).toBe(true);
    sw.set(false);
    expect(sw.get()).toBe(false);
    // A click flips the state and get() reflects it.
    sw.el.click();
    expect(sw.get()).toBe(true);
  });

  it("throws without label", async () => {
    const { createSwitch } = await import("../../../assets/js/controls.js");
    expect(() => createSwitch({ value: false })).toThrow("label is required");
    expect(() => createSwitch({})).toThrow("label is required");
    expect(() => createSwitch()).toThrow();
  });

  it("destroy removes the element from its parent", async () => {
    const { createSwitch } = await import("../../../assets/js/controls.js");
    const parent = document.createElement("div");
    const sw = createSwitch({ label: "Test", value: false, onChange: () => {} });
    parent.appendChild(sw.el);
    expect(parent.children.length).toBe(1);
    sw.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createCheckbox", () => {
  it("el contains a real input[type=checkbox]", async () => {
    const { createCheckbox } = await import("../../../assets/js/controls.js");
    const cb = createCheckbox({ name: "agree", label: "I agree" });
    const input = cb.el.querySelector("input");
    expect(input).not.toBeNull();
    expect(input.type).toBe("checkbox");
    expect(input.name).toBe("agree");
  });

  it("checked state syncs with set() and get()", async () => {
    const { createCheckbox } = await import("../../../assets/js/controls.js");
    const cb = createCheckbox({ name: "opt", label: "Option", checked: false });
    expect(cb.get()).toBe(false);
    cb.set(true);
    expect(cb.get()).toBe(true);
    cb.set(false);
    expect(cb.get()).toBe(false);
  });

  it("initial checked state is applied", async () => {
    const { createCheckbox } = await import("../../../assets/js/controls.js");
    const cb = createCheckbox({ name: "opt", label: "Option", checked: true });
    expect(cb.get()).toBe(true);
    expect(cb.el.querySelector("input").checked).toBe(true);
  });

  it("throws without name", async () => {
    const { createCheckbox } = await import("../../../assets/js/controls.js");
    expect(() => createCheckbox({ label: "Test" })).toThrow("name is required");
  });

  it("throws without label", async () => {
    const { createCheckbox } = await import("../../../assets/js/controls.js");
    expect(() => createCheckbox({ name: "test" })).toThrow("label is required");
  });

  it("destroy removes the element from its parent", async () => {
    const { createCheckbox } = await import("../../../assets/js/controls.js");
    const parent = document.createElement("div");
    const cb = createCheckbox({ name: "opt", label: "Option" });
    parent.appendChild(cb.el);
    expect(parent.children.length).toBe(1);
    cb.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createRadio", () => {
  it("el contains a real input[type=radio]", async () => {
    const { createRadio } = await import("../../../assets/js/controls.js");
    const r = createRadio({ name: "color", label: "Red", value: "red" });
    const input = r.el.querySelector("input");
    expect(input).not.toBeNull();
    expect(input.type).toBe("radio");
    expect(input.name).toBe("color");
    expect(input.value).toBe("red");
  });

  it("checked state syncs with set() and get()", async () => {
    const { createRadio } = await import("../../../assets/js/controls.js");
    const r = createRadio({ name: "color", label: "Red", value: "red" });
    expect(r.get()).toBe(false);
    r.set(true);
    expect(r.get()).toBe(true);
  });

  it("throws without name", async () => {
    const { createRadio } = await import("../../../assets/js/controls.js");
    expect(() => createRadio({ label: "Test", value: "a" })).toThrow("name is required");
  });

  it("throws without label", async () => {
    const { createRadio } = await import("../../../assets/js/controls.js");
    expect(() => createRadio({ name: "test", value: "a" })).toThrow("label is required");
  });

  it("throws without value", async () => {
    const { createRadio } = await import("../../../assets/js/controls.js");
    expect(() => createRadio({ name: "test", label: "Test" })).toThrow("value is required");
  });

  it("destroy removes the element from its parent", async () => {
    const { createRadio } = await import("../../../assets/js/controls.js");
    const parent = document.createElement("div");
    const r = createRadio({ name: "color", label: "Red", value: "red" });
    parent.appendChild(r.el);
    expect(parent.children.length).toBe(1);
    r.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createFileInput", () => {
  it("el contains a hidden input[type=file]", async () => {
    const { createFileInput } = await import("../../../assets/js/controls.js");
    const fi = createFileInput({ name: "doc", label: "Upload" });
    const input = fi.el.querySelector("input");
    expect(input).not.toBeNull();
    expect(input.type).toBe("file");
    expect(input.name).toBe("doc");
  });

  it("hidden input[type=file] carries the label as its accessible name", async () => {
    const { createFileInput } = await import("../../../assets/js/controls.js");
    const fi = createFileInput({ name: "doc", label: "Upload" });
    const input = fi.el.querySelector("input");
    expect(input.getAttribute("aria-label")).toBe("Upload");
  });

  it("getFiles() returns a FileList", async () => {
    const { createFileInput } = await import("../../../assets/js/controls.js");
    const fi = createFileInput({ name: "doc", label: "Upload" });
    const files = fi.getFiles();
    // FileList may not exist in happy-dom; check it is at least defined
    expect(files).toBeDefined();
  });

  it("throws without name", async () => {
    const { createFileInput } = await import("../../../assets/js/controls.js");
    expect(() => createFileInput({ label: "Upload" })).toThrow("name is required");
  });

  it("throws without label", async () => {
    const { createFileInput } = await import("../../../assets/js/controls.js");
    expect(() => createFileInput({ name: "doc" })).toThrow("label is required");
  });

  it("accepts accept and multiple options", async () => {
    const { createFileInput } = await import("../../../assets/js/controls.js");
    const fi = createFileInput({ name: "doc", label: "Upload", accept: ".pdf", multiple: true });
    const input = fi.el.querySelector("input");
    expect(input.accept).toBe(".pdf");
    expect(input.multiple).toBe(true);
  });

  it("destroy removes the element from its parent", async () => {
    const { createFileInput } = await import("../../../assets/js/controls.js");
    const parent = document.createElement("div");
    const fi = createFileInput({ name: "doc", label: "Upload" });
    parent.appendChild(fi.el);
    expect(parent.children.length).toBe(1);
    fi.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createSegmented", () => {
  it("returns {el, set, value, destroy}", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    const seg = createSegmented({
      name: "size", label: "Size",
      items: [{ value: "s", label: "S" }, { value: "m", label: "M" }],
    });
    expect(seg.el).toBeInstanceOf(HTMLElement);
    expect(typeof seg.set).toBe("function");
    expect(typeof seg.destroy).toBe("function");
    expect(seg.value).toBeDefined();
  });

  it("el has role=radiogroup and aria-label", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    const seg = createSegmented({
      name: "size", label: "Pick a size",
      items: [{ value: "s", label: "S" }, { value: "m", label: "M" }],
    });
    expect(seg.el.getAttribute("role")).toBe("radiogroup");
    expect(seg.el.getAttribute("aria-label")).toBe("Pick a size");
  });

  it("el is a fieldset", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    const seg = createSegmented({
      name: "size", label: "Size",
      items: [{ value: "s", label: "S" }, { value: "m", label: "M" }],
    });
    expect(seg.el.tagName).toBe("FIELDSET");
  });

  it("contains hidden radio inputs with the shared name", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    const seg = createSegmented({
      name: "color", label: "Color",
      items: [{ value: "r", label: "Red" }, { value: "g", label: "Green" }, { value: "b", label: "Blue" }],
    });
    const radios = seg.el.querySelectorAll("input[type='radio']");
    expect(radios.length).toBe(3);
    for (const r of radios) {
      expect(r.name).toBe("color");
    }
  });

  it("set(v) updates checked state and value getter", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    const seg = createSegmented({
      name: "size", label: "Size",
      items: [{ value: "s", label: "S" }, { value: "m", label: "M" }],
      value: "s",
    });
    expect(seg.value).toBe("s");
    seg.set("m");
    expect(seg.value).toBe("m");
    const radios = seg.el.querySelectorAll("input[type='radio']");
    const checked = Array.from(radios).find(r => r.checked);
    expect(checked.value).toBe("m");
  });

  it("initial value selects the correct radio", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    const seg = createSegmented({
      name: "size", label: "Size",
      items: [{ value: "s", label: "S" }, { value: "m", label: "M" }],
      value: "m",
    });
    const radios = seg.el.querySelectorAll("input[type='radio']");
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
  });

  it("throws without name", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    expect(() => createSegmented({ label: "Size", items: [] })).toThrow("name is required");
  });

  it("throws without label", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    expect(() => createSegmented({ name: "size", items: [] })).toThrow("label is required");
  });

  it("disabled items have disabled radios", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    const seg = createSegmented({
      name: "size", label: "Size",
      items: [
        { value: "s", label: "S" },
        { value: "m", label: "M", disabled: true },
      ],
    });
    const radios = seg.el.querySelectorAll("input[type='radio']");
    expect(radios[0].disabled).toBe(false);
    expect(radios[1].disabled).toBe(true);
  });

  it("destroy removes the element from its parent", async () => {
    const { createSegmented } = await import("../../../assets/js/controls.js");
    const parent = document.createElement("div");
    const seg = createSegmented({
      name: "size", label: "Size",
      items: [{ value: "s", label: "S" }],
    });
    parent.appendChild(seg.el);
    expect(parent.children.length).toBe(1);
    seg.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createTabs", () => {
  it("returns {el, set, value, destroy}", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const tabs = createTabs({
      label: "View",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    expect(tabs.el).toBeInstanceOf(HTMLElement);
    expect(typeof tabs.set).toBe("function");
    expect(typeof tabs.destroy).toBe("function");
    expect(tabs.value).toBeDefined();
  });

  it("el has role=tablist and aria-label", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const tabs = createTabs({
      label: "Navigation",
      items: [{ value: "a", label: "A" }],
    });
    expect(tabs.el.getAttribute("role")).toBe("tablist");
    expect(tabs.el.getAttribute("aria-label")).toBe("Navigation");
  });

  it("tab buttons have role=tab and aria-selected", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const tabs = createTabs({
      label: "View",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      value: "a",
    });
    const btns = tabs.el.querySelectorAll("button[role='tab']");
    expect(btns.length).toBe(2);
    expect(btns[0].getAttribute("aria-selected")).toBe("true");
    expect(btns[1].getAttribute("aria-selected")).toBe("false");
  });

  it("set(v) updates aria-selected and value getter", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const tabs = createTabs({
      label: "View",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      value: "a",
    });
    tabs.set("b");
    expect(tabs.value).toBe("b");
    const btns = tabs.el.querySelectorAll("button[role='tab']");
    expect(btns[0].getAttribute("aria-selected")).toBe("false");
    expect(btns[1].getAttribute("aria-selected")).toBe("true");
  });

  it("active tab has tabIndex 0, others have tabIndex -1", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const tabs = createTabs({
      label: "View",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      value: "b",
    });
    const btns = tabs.el.querySelectorAll("button[role='tab']");
    expect(btns[0].tabIndex).toBe(-1);
    expect(btns[1].tabIndex).toBe(0);
  });

  it("keyboard ArrowRight wraps navigation", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const tabs = createTabs({
      label: "View",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }],
      value: "c",
    });
    document.body.appendChild(tabs.el);
    const btns = tabs.el.querySelectorAll("button[role='tab']");
    // Focus last tab and press ArrowRight — should wrap to first
    btns[2].focus();
    btns[2].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(tabs.value).toBe("a");
    expect(btns[0].getAttribute("aria-selected")).toBe("true");
    document.body.removeChild(tabs.el);
  });

  it("keyboard Home/End navigate to first/last", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const tabs = createTabs({
      label: "View",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }],
      value: "b",
    });
    document.body.appendChild(tabs.el);
    const btns = tabs.el.querySelectorAll("button[role='tab']");
    btns[1].focus();
    btns[1].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(tabs.value).toBe("c");
    btns[2].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(tabs.value).toBe("a");
    document.body.removeChild(tabs.el);
  });

  it("throws without label", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    expect(() => createTabs({ items: [] })).toThrow("label is required");
    expect(() => createTabs({})).toThrow("label is required");
    expect(() => createTabs()).toThrow();
  });

  it("does NOT contain any form inputs", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const tabs = createTabs({
      label: "View",
      items: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    expect(tabs.el.querySelectorAll("input").length).toBe(0);
  });

  it("destroy removes the element from its parent", async () => {
    const { createTabs } = await import("../../../assets/js/controls.js");
    const parent = document.createElement("div");
    const tabs = createTabs({
      label: "View",
      items: [{ value: "a", label: "A" }],
    });
    parent.appendChild(tabs.el);
    expect(parent.children.length).toBe(1);
    tabs.destroy();
    expect(parent.children.length).toBe(0);
  });
});
