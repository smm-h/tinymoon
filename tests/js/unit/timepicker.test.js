import { describe, it, expect } from "vitest";

// Unit tests for timepicker.js: createTimePicker(opts) -> {el, set, value, destroy}.
// Canonical value is 24h "HH:MM"; the visible field shows a locale format.

describe("createTimePicker", () => {
  it("returns {el, set, value, destroy}", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "Time" });
    expect(tp.el).toBeInstanceOf(HTMLElement);
    expect(typeof tp.set).toBe("function");
    expect(typeof tp.destroy).toBe("function");
    expect(tp.value).toBe(null);
  });

  it("throws without name or label", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    expect(() => createTimePicker({ label: "T" })).toThrow("name is required");
    expect(() => createTimePicker({ name: "t" })).toThrow("label is required");
  });

  it("initial value populates hidden input and text field", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "start", label: "Start", value: "14:30" });
    expect(tp.value).toBe("14:30");
    const hidden = tp.el.querySelector("input[type='hidden']");
    expect(hidden.value).toBe("14:30");
    expect(hidden.name).toBe("start");
    const text = tp.el.querySelector("input[type='text']");
    // Locale display is non-empty and reflects the time (ICU present in Node).
    expect(text.value.length).toBeGreaterThan(0);
    expect(text.value).toMatch(/30/);
  });

  it("invalid initial value is ignored", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "T", value: "25:99" });
    expect(tp.value).toBe(null);
  });

  it("set() updates the canonical value and hidden input", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "T" });
    tp.set("09:05");
    expect(tp.value).toBe("09:05");
    expect(tp.el.querySelector("input[type='hidden']").value).toBe("09:05");
  });

  it("set() throws on an invalid time", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "T" });
    expect(() => tp.set("nope")).toThrow("invalid time");
    expect(() => tp.set("24:00")).toThrow("invalid time");
  });

  it("parses typed 12h and 24h text on blur to canonical HH:MM", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "T" });
    const text = tp.el.querySelector("input[type='text']");

    text.value = "2:30 PM";
    text.dispatchEvent(new Event("blur"));
    expect(tp.value).toBe("14:30");

    text.value = "9:05";
    text.dispatchEvent(new Event("blur"));
    expect(tp.value).toBe("09:05");

    text.value = "1430";
    text.dispatchEvent(new Event("blur"));
    expect(tp.value).toBe("14:30");
  });

  it("unparseable text reverts to the committed value on blur", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "T", value: "10:00" });
    const text = tp.el.querySelector("input[type='text']");
    text.value = "garbage";
    text.dispatchEvent(new Event("blur"));
    expect(tp.value).toBe("10:00");
  });

  it("builds hour and minute listbox columns; minuteStep controls minutes", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "T", minuteStep: 15 });
    const cols = tp.el.querySelectorAll(".tm-timepicker-col[role='listbox']");
    expect(cols.length).toBe(2);
    const hourOpts = cols[0].querySelectorAll("[role='option']");
    expect(hourOpts.length).toBe(24);
    const minuteOpts = cols[1].querySelectorAll("[role='option']");
    expect(minuteOpts.length).toBe(4); // 0, 15, 30, 45
  });

  it("clicking an hour then a minute commits and fires onChange", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const changes = [];
    const tp = createTimePicker({ name: "t", label: "T", minuteStep: 30, onChange: (v) => changes.push(v) });
    const cols = tp.el.querySelectorAll(".tm-timepicker-col");
    // Pick hour 8 (index 8), minute 30 (index 1 of [00, 30]).
    cols[0].querySelectorAll("[role='option']")[8].click();
    cols[1].querySelectorAll("[role='option']")[1].click();
    expect(tp.value).toBe("08:30");
    expect(changes[changes.length - 1]).toBe("08:30");
  });

  it("required sets the hidden input required", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "T", required: true });
    expect(tp.el.querySelector("input[type='hidden']").required).toBe(true);
  });

  it("has a label targeting the text input and a dialog popover", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const tp = createTimePicker({ name: "t", label: "Meeting" });
    const label = tp.el.querySelector("label");
    const text = tp.el.querySelector("input[type='text']");
    expect(label.getAttribute("for")).toBe(text.id);
    const pop = tp.el.querySelector("[popover]");
    expect(pop.getAttribute("role")).toBe("dialog");
  });

  it("destroy removes the element", async () => {
    const { createTimePicker } = await import("../../../assets/js/timepicker.js");
    const parent = document.createElement("div");
    const tp = createTimePicker({ name: "t", label: "T" });
    parent.appendChild(tp.el);
    tp.destroy();
    expect(parent.children.length).toBe(0);
  });
});
