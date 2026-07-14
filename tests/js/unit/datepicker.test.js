import { describe, it, expect } from "vitest";

// Unit tests for datepicker.js: createDatePicker(opts) -> {el, set, value, destroy}.

describe("createDatePicker", () => {
  it("returns {el, set, value, destroy}", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date" });
    expect(dp.el).toBeInstanceOf(HTMLElement);
    expect(typeof dp.set).toBe("function");
    expect(typeof dp.destroy).toBe("function");
    expect(dp.value).toBe(null);
  });

  it("throws without name", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    expect(() => createDatePicker({ label: "Date" })).toThrow("name is required");
    expect(() => createDatePicker({})).toThrow("name is required");
    expect(() => createDatePicker()).toThrow();
  });

  it("throws without label", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    expect(() => createDatePicker({ name: "date" })).toThrow("label is required");
  });

  it("initial value renders correctly", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "event", label: "Event date", value: "2026-07-14" });
    expect(dp.value).toBe("2026-07-14");
    // Text input should show formatted date
    const textInput = dp.el.querySelector("input[type='text']");
    expect(textInput.value).toBe("Jul 14, 2026");
    // Hidden input should have ISO value
    const hiddenInput = dp.el.querySelector("input[type='hidden']");
    expect(hiddenInput.value).toBe("2026-07-14");
    expect(hiddenInput.name).toBe("event");
  });

  it("set() updates value, text, and hidden input", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date" });
    dp.set("2025-12-25");
    expect(dp.value).toBe("2025-12-25");
    const textInput = dp.el.querySelector("input[type='text']");
    expect(textInput.value).toBe("Dec 25, 2025");
    const hiddenInput = dp.el.querySelector("input[type='hidden']");
    expect(hiddenInput.value).toBe("2025-12-25");
  });

  it("set() throws on invalid ISO date", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date" });
    expect(() => dp.set("not-a-date")).toThrow("invalid ISO date");
    expect(() => dp.set("")).toThrow("invalid ISO date");
  });

  it("hidden input has required attribute when opts.required is true", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date", required: true });
    const hiddenInput = dp.el.querySelector("input[type='hidden']");
    expect(hiddenInput.required).toBe(true);
  });

  it("disabled state disables text input and toggle button", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date", disabled: true });
    const textInput = dp.el.querySelector("input[type='text']");
    const toggleBtn = dp.el.querySelector("button");
    expect(textInput.disabled).toBe(true);
    expect(toggleBtn.disabled).toBe(true);
  });

  it("has a label element with correct text", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Event date" });
    const labelEl = dp.el.querySelector("label");
    expect(labelEl).not.toBeNull();
    expect(labelEl.textContent).toBe("Event date");
  });

  it("toggle button has aria-label and aria-controls", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date" });
    const toggleBtn = dp.el.querySelector("button");
    expect(toggleBtn.getAttribute("aria-label")).toBe("Open calendar");
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
    expect(toggleBtn.getAttribute("aria-controls")).toBeTruthy();
  });

  it("popover has role=dialog and aria-label", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "My Date" });
    const popover = dp.el.querySelector("[popover]");
    expect(popover).not.toBeNull();
    expect(popover.getAttribute("role")).toBe("dialog");
    expect(popover.getAttribute("aria-label")).toBe("My Date calendar");
  });

  it("calendar grid has role=grid with day-of-week headers", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date" });
    const grid = dp.el.querySelector("table[role='grid']");
    expect(grid).not.toBeNull();
    const headers = grid.querySelectorAll("th");
    expect(headers.length).toBe(7);
    const texts = Array.from(headers).map((h) => h.textContent);
    expect(texts).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
  });

  it("destroy removes the element from its parent", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const parent = document.createElement("div");
    const dp = createDatePicker({ name: "date", label: "Date" });
    parent.appendChild(dp.el);
    expect(parent.children.length).toBe(1);
    dp.destroy();
    expect(parent.children.length).toBe(0);
  });

  it("value getter returns null when no date selected", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date" });
    expect(dp.value).toBe(null);
  });

  it("invalid initial value is ignored", async () => {
    const { createDatePicker } = await import("../../../assets/js/datepicker.js");
    const dp = createDatePicker({ name: "date", label: "Date", value: "not-valid" });
    expect(dp.value).toBe(null);
    const textInput = dp.el.querySelector("input[type='text']");
    expect(textInput.value).toBe("");
  });
});
