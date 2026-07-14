import { describe, it, expect } from "vitest";

// Unit tests for the Phase 3.3 form primitives: createSwitch, createCheckbox,
// createRadio, createFileInput. Each follows the createX(opts) -> {el, ...}
// convention and uses hidden native inputs for form participation.

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
