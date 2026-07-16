import { describe, it, expect } from "vitest";

// Unit tests for slider.js: createSlider wraps a native range in a .tm-slider
// frame. The onInput (live drag) vs onChange (commit) distinction is the key
// behavior verified here.

describe("createSlider", () => {
  it("wraps a native input[type=range] in a .tm-slider frame", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    const s = createSlider({ name: "vol", label: "Volume", min: 0, max: 100 });
    expect(s.el.classList.contains("tm-slider")).toBe(true);
    const range = s.el.querySelector("input");
    expect(range.type).toBe("range");
    expect(range.name).toBe("vol");
    expect(range.min).toBe("0");
    expect(range.max).toBe("100");
    // A slider's accessible name is an aria-label (single control).
    expect(range.getAttribute("aria-label")).toBe("Volume");
  });

  it("defaults value to min and step to 1", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    const s = createSlider({ name: "v", label: "V", min: 10, max: 20 });
    const range = s.el.querySelector("input");
    expect(range.value).toBe("10");
    expect(range.step).toBe("1");
    expect(s.value).toBe(10);
  });

  it("applies value, step, and disabled", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    const s = createSlider({ name: "v", label: "V", min: 0, max: 100, step: 5, value: 40, disabled: true });
    const range = s.el.querySelector("input");
    expect(range.value).toBe("40");
    expect(range.step).toBe("5");
    expect(range.disabled).toBe(true);
    expect(s.value).toBe(40);
  });

  it("throws without name, label, min, or max", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    expect(() => createSlider({ label: "V", min: 0, max: 1 })).toThrow("name is required");
    expect(() => createSlider({ name: "v", min: 0, max: 1 })).toThrow("label is required");
    expect(() => createSlider({ name: "v", label: "V", max: 1 })).toThrow("min is required");
    expect(() => createSlider({ name: "v", label: "V", min: 0 })).toThrow("max is required");
  });

  it("accepts min: 0 and max: 0 (falsy but present)", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    expect(() => createSlider({ name: "v", label: "V", min: 0, max: 0 })).not.toThrow();
  });

  it("onInput fires on the input event, onChange on the change event", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    const live = [];
    const committed = [];
    const s = createSlider({
      name: "v", label: "V", min: 0, max: 100,
      onInput: (v) => live.push(v),
      onChange: (v) => committed.push(v),
    });
    const range = s.el.querySelector("input");

    range.value = "30";
    range.dispatchEvent(new Event("input"));
    expect(live).toEqual([30]);
    expect(committed).toEqual([]);

    range.value = "70";
    range.dispatchEvent(new Event("change"));
    expect(committed).toEqual([70]);
    expect(live).toEqual([30]); // change does not trigger onInput
  });

  it("callbacks receive numeric values, and value getter/get return numbers", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    const s = createSlider({ name: "v", label: "V", min: 0, max: 10, value: 3 });
    expect(typeof s.value).toBe("number");
    expect(typeof s.get()).toBe("number");
    s.set(7);
    expect(s.value).toBe(7);
  });

  it("paints the filled-track custom property from the value", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    const s = createSlider({ name: "v", label: "V", min: 0, max: 100, value: 25 });
    expect(s.el.style.getPropertyValue("--tm-slider-fill")).toBe("25%");
    s.set(50);
    expect(s.el.style.getPropertyValue("--tm-slider-fill")).toBe("50%");
  });

  it("destroy removes the slider from its parent", async () => {
    const { createSlider } = await import("../../../assets/js/slider.js");
    const parent = document.createElement("div");
    const s = createSlider({ name: "v", label: "V", min: 0, max: 10 });
    parent.appendChild(s.el);
    s.destroy();
    expect(parent.children.length).toBe(0);
  });
});
