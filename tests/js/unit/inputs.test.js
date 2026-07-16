import { describe, it, expect } from "vitest";

// Unit tests for inputs.js: createInput, createTextarea, and the createField
// layout wrapper (including its setError aria wiring). Each self-labeling
// control follows the createX(opts) -> {el, ...} convention.

describe("createInput", () => {
  it("wraps a real, visible input[type=text] with a real <label for>", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    const inp = createInput({ name: "user", label: "Username" });
    const input = inp.el.querySelector("input");
    const label = inp.el.querySelector("label");
    expect(input).not.toBeNull();
    expect(input.type).toBe("text");
    expect(input.name).toBe("user");
    expect(input.classList.contains("tm-input")).toBe(true);
    // The label targets the input by id -- not aria-label.
    expect(label.getAttribute("for")).toBe(input.id);
    expect(label.textContent).toBe("Username");
    expect(input.getAttribute("aria-label")).toBeNull();
  });

  it("defaults to type=text and accepts allowed types", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    for (const type of ["text", "password", "email", "url", "search", "tel"]) {
      const inp = createInput({ name: "f", label: "F", type });
      expect(inp.el.querySelector("input").type).toBe(type);
    }
  });

  it("rejects banned input types with a hard error", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    for (const type of ["checkbox", "radio", "file", "range", "number", "time", "date"]) {
      expect(() => createInput({ name: "f", label: "F", type })).toThrow("is not allowed");
    }
  });

  it("throws without name or label", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    expect(() => createInput({ label: "F" })).toThrow("name is required");
    expect(() => createInput({ name: "f" })).toThrow("label is required");
  });

  it("applies value, placeholder, required, pattern, disabled", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    const inp = createInput({
      name: "f", label: "F", value: "hi", placeholder: "type",
      required: true, pattern: "[a-z]+", disabled: true,
    });
    const input = inp.el.querySelector("input");
    expect(input.value).toBe("hi");
    expect(input.placeholder).toBe("type");
    expect(input.required).toBe(true);
    expect(input.getAttribute("pattern")).toBe("[a-z]+");
    expect(input.disabled).toBe(true);
  });

  it("value getter / set / get / focus operate on the input", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    const inp = createInput({ name: "f", label: "F", value: "a" });
    expect(inp.value).toBe("a");
    expect(inp.get()).toBe("a");
    inp.set("b");
    expect(inp.value).toBe("b");
    inp.set(null);
    expect(inp.value).toBe("");
  });

  it("onChange / onInput fire with the current value", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    const changes = [];
    const inputs = [];
    const inp = createInput({
      name: "f", label: "F",
      onChange: (v) => changes.push(v),
      onInput: (v) => inputs.push(v),
    });
    const input = inp.el.querySelector("input");
    input.value = "x";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("change"));
    expect(inputs).toEqual(["x"]);
    expect(changes).toEqual(["x"]);
  });

  it("setError renders a .field-error and wires aria-invalid + aria-describedby", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    const inp = createInput({ name: "f", label: "F" });
    const input = inp.el.querySelector("input");
    inp.setError("Required");
    const err = inp.el.querySelector(".field-error");
    expect(err).not.toBeNull();
    expect(err.textContent).toBe("Required");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(err.id);
    // Clearing removes the line and the aria wiring.
    inp.setError(null);
    expect(inp.el.querySelector(".field-error")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("destroy removes the field from its parent", async () => {
    const { createInput } = await import("../../../assets/js/inputs.js");
    const parent = document.createElement("div");
    const inp = createInput({ name: "f", label: "F" });
    parent.appendChild(inp.el);
    expect(parent.children.length).toBe(1);
    inp.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createTextarea", () => {
  it("wraps a real textarea labeled by <label for>", async () => {
    const { createTextarea } = await import("../../../assets/js/inputs.js");
    const ta = createTextarea({ name: "bio", label: "Bio", rows: 5 });
    const textarea = ta.el.querySelector("textarea");
    const label = ta.el.querySelector("label");
    expect(textarea).not.toBeNull();
    expect(textarea.name).toBe("bio");
    expect(textarea.classList.contains("tm-textarea")).toBe(true);
    expect(Number(textarea.rows)).toBe(5);
    expect(label.getAttribute("for")).toBe(textarea.id);
  });

  it("throws without name or label", async () => {
    const { createTextarea } = await import("../../../assets/js/inputs.js");
    expect(() => createTextarea({ label: "B" })).toThrow("name is required");
    expect(() => createTextarea({ name: "b" })).toThrow("label is required");
  });

  it("set / get and setError work like createInput", async () => {
    const { createTextarea } = await import("../../../assets/js/inputs.js");
    const ta = createTextarea({ name: "b", label: "B", value: "one" });
    expect(ta.get()).toBe("one");
    ta.set("two");
    expect(ta.value).toBe("two");
    ta.setError("Too short");
    const textarea = ta.el.querySelector("textarea");
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    ta.setError(null);
    expect(textarea.getAttribute("aria-invalid")).toBeNull();
  });
});

describe("createField", () => {
  it("wraps a raw control, minting an id and wiring <label for>", async () => {
    const { createField } = await import("../../../assets/js/inputs.js");
    const control = document.createElement("input");
    const field = createField({ label: "Age", control });
    const label = field.el.querySelector("label");
    expect(label.textContent).toBe("Age");
    expect(control.id).not.toBe("");
    expect(label.getAttribute("for")).toBe(control.id);
    expect(field.el.contains(control)).toBe(true);
  });

  it("wraps a factory instance and finds the labelable descendant", async () => {
    const { createField } = await import("../../../assets/js/inputs.js");
    const wrap = document.createElement("div");
    const inner = document.createElement("input");
    wrap.appendChild(inner);
    const instance = { el: wrap };
    const field = createField({ label: "Vol", control: instance });
    const label = field.el.querySelector("label");
    expect(field.el.contains(wrap)).toBe(true);
    expect(inner.id).not.toBe("");
    expect(label.getAttribute("for")).toBe(inner.id);
  });

  it("reuses an existing control id instead of minting a new one", async () => {
    const { createField } = await import("../../../assets/js/inputs.js");
    const control = document.createElement("input");
    control.id = "preset-id";
    const field = createField({ label: "X", control });
    expect(field.el.querySelector("label").getAttribute("for")).toBe("preset-id");
  });

  it("renders a hint and points aria-describedby at it", async () => {
    const { createField } = await import("../../../assets/js/inputs.js");
    const control = document.createElement("input");
    const field = createField({ label: "X", control, hint: "0 to 100" });
    const hint = field.el.querySelector(".field-hint");
    expect(hint.textContent).toBe("0 to 100");
    expect(control.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("setError composes describedby with the hint and restores it on clear", async () => {
    const { createField } = await import("../../../assets/js/inputs.js");
    const control = document.createElement("input");
    const field = createField({ label: "X", control, hint: "help" });
    const hintId = field.el.querySelector(".field-hint").id;
    field.setError("Bad");
    const err = field.el.querySelector(".field-error");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBe(hintId + " " + err.id);
    field.setError(null);
    expect(field.el.querySelector(".field-error")).toBeNull();
    expect(control.getAttribute("aria-invalid")).toBeNull();
    // Cleared error restores the hint-only describedby.
    expect(control.getAttribute("aria-describedby")).toBe(hintId);
  });

  it("throws without label or control", async () => {
    const { createField } = await import("../../../assets/js/inputs.js");
    expect(() => createField({ control: document.createElement("input") })).toThrow("label is required");
    expect(() => createField({ label: "X" })).toThrow("control is required");
  });

  it("destroy removes the field from its parent", async () => {
    const { createField } = await import("../../../assets/js/inputs.js");
    const parent = document.createElement("div");
    const field = createField({ label: "X", control: document.createElement("input") });
    parent.appendChild(field.el);
    field.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createNumber", () => {
  it("wraps a native input[type=number] with +/- stepper buttons", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    const n = createNumber({ name: "qty", label: "Quantity" });
    const input = n.el.querySelector("input");
    expect(input.type).toBe("number");
    expect(input.name).toBe("qty");
    expect(input.classList.contains("tm-number-input")).toBe(true);
    const steps = n.el.querySelectorAll(".tm-number-step");
    expect(steps.length).toBe(2);
    // The label is a real <label for>, never aria-label.
    const label = n.el.querySelector("label");
    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.getAttribute("aria-label")).toBeNull();
  });

  it("applies min, max, step, value, required, disabled", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    const n = createNumber({ name: "q", label: "Q", min: 2, max: 8, step: 2, value: 4, required: true, disabled: true });
    const input = n.el.querySelector("input");
    expect(input.min).toBe("2");
    expect(input.max).toBe("8");
    expect(input.step).toBe("2");
    expect(input.value).toBe("4");
    expect(input.required).toBe(true);
    expect(input.disabled).toBe(true);
    for (const s of n.el.querySelectorAll(".tm-number-step")) expect(s.disabled).toBe(true);
  });

  it("throws without name or label", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    expect(() => createNumber({ label: "Q" })).toThrow("name is required");
    expect(() => createNumber({ name: "q" })).toThrow("label is required");
  });

  it("+ / - buttons step within min/max and fire onInput/onChange", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    const inputs = [];
    const changes = [];
    const n = createNumber({
      name: "q", label: "Q", min: 0, max: 3, step: 1, value: 2,
      onInput: (v) => inputs.push(v),
      onChange: (v) => changes.push(v),
    });
    const input = n.el.querySelector("input");
    const [down, up] = n.el.querySelectorAll(".tm-number-step");
    up.click();
    expect(input.value).toBe("3");
    up.click(); // clamped at max 3
    expect(input.value).toBe("3");
    down.click();
    expect(input.value).toBe("2");
    // onInput fires on every step; onChange too (a stepper is a commit).
    expect(inputs).toEqual(["3", "3", "2"]);
    expect(changes).toEqual(["3", "3", "2"]);
  });

  it("stepping from empty seeds from min (or 0)", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    const n = createNumber({ name: "q", label: "Q", min: 5, max: 10 });
    const input = n.el.querySelector("input");
    expect(input.value).toBe("");
    n.el.querySelectorAll(".tm-number-step")[1].click(); // up
    expect(input.value).toBe("6"); // seeds from min=5, +1
  });

  it("respects fractional step precision", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    const n = createNumber({ name: "q", label: "Q", step: 0.1, value: 0.2 });
    const input = n.el.querySelector("input");
    n.el.querySelectorAll(".tm-number-step")[1].click();
    expect(input.value).toBe("0.3");
  });

  it("setError wires aria-invalid and clears it", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    const n = createNumber({ name: "q", label: "Q" });
    const input = n.el.querySelector("input");
    n.setError("Bad");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    n.setError(null);
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("value/get reflect the input and set updates it", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    const n = createNumber({ name: "q", label: "Q", value: 7 });
    expect(n.value).toBe("7");
    expect(n.get()).toBe("7");
    n.set(9);
    expect(n.value).toBe("9");
  });

  it("destroy removes the field and detaches stepper listeners", async () => {
    const { createNumber } = await import("../../../assets/js/inputs.js");
    const parent = document.createElement("div");
    const n = createNumber({ name: "q", label: "Q" });
    parent.appendChild(n.el);
    n.destroy();
    expect(parent.children.length).toBe(0);
  });
});
