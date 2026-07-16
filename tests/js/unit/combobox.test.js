import { describe, it, expect } from "vitest";

// Unit tests for combobox.js: createCombobox (single-value typeahead) and
// createMultiSelect (multi-value with removable chips). The debounce is ~150ms;
// tests wait past it. Stale-response discard and freeText-off are the load-
// bearing behaviors verified here.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
function optionTexts(root) {
  return Array.from(root.querySelectorAll("[role='option']")).map((o) => o.textContent);
}

describe("createCombobox", () => {
  it("returns {el, value, set, get, destroy} and a hidden input", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const cb = createCombobox({ name: "country", label: "Country", items: [] });
    expect(cb.el).toBeInstanceOf(HTMLElement);
    expect(typeof cb.set).toBe("function");
    expect(typeof cb.get).toBe("function");
    expect(cb.value).toBe(null);
    const hidden = cb.el.querySelector("input[type='hidden']");
    expect(hidden.name).toBe("country");
    // The visible input is an APG combobox.
    const input = cb.el.querySelector("input[role='combobox']");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("throws without name, label, or a results source", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    expect(() => createCombobox({ label: "X", items: [] })).toThrow("name is required");
    expect(() => createCombobox({ name: "x", items: [] })).toThrow("label is required");
    expect(() => createCombobox({ name: "x", label: "X" })).toThrow("onFilter or items");
  });

  it("static items filter client-side and render as options", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const cb = createCombobox({
      name: "c", label: "C",
      items: [{ value: "us", label: "United States" }, { value: "uk", label: "United Kingdom" }, { value: "fr", label: "France" }],
    });
    const input = cb.el.querySelector("input");
    input.value = "united";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    expect(optionTexts(cb.el).sort()).toEqual(["United Kingdom", "United States"]);
  });

  it("selecting an option commits its value to the hidden input and fires onChange", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const changes = [];
    const cb = createCombobox({
      name: "c", label: "C",
      items: [{ value: "us", label: "United States" }],
      onChange: (v) => changes.push(v),
    });
    const input = cb.el.querySelector("input");
    input.value = "un";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    // ArrowDown to activate the first option, Enter to select.
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(cb.value).toBe("us");
    expect(cb.el.querySelector("input[type='hidden']").value).toBe("us");
    expect(input.value).toBe("United States");
    expect(changes).toEqual(["us"]);
  });

  it("async onFilter shows a loading state then renders resolved results", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const d = deferred();
    const cb = createCombobox({ name: "c", label: "C", onFilter: () => d.promise });
    const input = cb.el.querySelector("input");
    input.value = "a";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    expect(cb.el.querySelector(".tm-combobox-status").textContent).toBe("Loading…");
    d.resolve([{ value: "a1", label: "Apple" }]);
    await sleep(0);
    expect(optionTexts(cb.el)).toEqual(["Apple"]);
  });

  it("discards a stale slow response so a newer query always wins", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const d1 = deferred();
    const d2 = deferred();
    let call = 0;
    const cb = createCombobox({
      name: "c", label: "C",
      onFilter: () => (call++ === 0 ? d1.promise : d2.promise),
    });
    const input = cb.el.querySelector("input");

    input.value = "a";
    input.dispatchEvent(new Event("input"));
    await sleep(180); // fires filter #1 (slow)

    input.value = "ab";
    input.dispatchEvent(new Event("input"));
    await sleep(180); // fires filter #2 (fast)

    // Resolve the NEWER request first.
    d2.resolve([{ value: "ab1", label: "AB Fresh" }]);
    await sleep(0);
    expect(optionTexts(cb.el)).toEqual(["AB Fresh"]);

    // Now resolve the OLDER (stale) request -- it must not overwrite.
    d1.resolve([{ value: "a1", label: "A Stale" }]);
    await sleep(0);
    expect(optionTexts(cb.el)).toEqual(["AB Fresh"]);
  });

  it("empty results render a 'No results' status, not an option", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const cb = createCombobox({ name: "c", label: "C", items: [{ value: "x", label: "Xylophone" }] });
    const input = cb.el.querySelector("input");
    input.value = "zzz";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    expect(cb.el.querySelectorAll("[role='option']").length).toBe(0);
    expect(cb.el.querySelector(".tm-combobox-status").textContent).toBe("No results");
  });

  it("freeText:false ignores Enter on unmatched text (no commit)", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const changes = [];
    const cb = createCombobox({
      name: "c", label: "C", items: [{ value: "x", label: "X" }],
      onChange: (v) => changes.push(v),
    });
    const input = cb.el.querySelector("input");
    input.value = "made up";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(cb.value).toBe(null);
    expect(changes).toEqual([]);
  });

  it("freeText:true commits arbitrary typed text on Enter", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const changes = [];
    const cb = createCombobox({
      name: "c", label: "C", freeText: true, items: [],
      onChange: (v) => changes.push(v),
    });
    const input = cb.el.querySelector("input");
    input.value = "bespoke";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(cb.value).toBe("bespoke");
    expect(cb.el.querySelector("input[type='hidden']").value).toBe("bespoke");
    expect(changes).toEqual(["bespoke"]);
  });

  it("set(value, text) seeds the value and hidden input", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const cb = createCombobox({ name: "c", label: "C", items: [{ value: "us", label: "United States" }] });
    cb.set("us", "United States");
    expect(cb.get()).toBe("us");
    expect(cb.el.querySelector("input[type='hidden']").value).toBe("us");
    expect(cb.el.querySelector("input[role='combobox']").value).toBe("United States");
  });

  it("destroy removes the element", async () => {
    const { createCombobox } = await import("../../../assets/js/combobox.js");
    const parent = document.createElement("div");
    const cb = createCombobox({ name: "c", label: "C", items: [] });
    parent.appendChild(cb.el);
    cb.destroy();
    expect(parent.children.length).toBe(0);
  });
});

describe("createMultiSelect", () => {
  it("returns {el, values, setValues, destroy} and a hidden <select multiple>", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    const ms = createMultiSelect({ name: "tags", label: "Tags", items: [] });
    expect(ms.el).toBeInstanceOf(HTMLElement);
    expect(typeof ms.setValues).toBe("function");
    expect(ms.values).toEqual([]);
    const sel = ms.el.querySelector("select");
    expect(sel.multiple).toBe(true);
    expect(sel.name).toBe("tags");
    // The hidden native select lives inside the tm-multiselect wrapper (auditor
    // exemption relies on this).
    expect(ms.el.classList.contains("tm-multiselect")).toBe(true);
  });

  it("throws without name, label, or a results source", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    expect(() => createMultiSelect({ label: "X", items: [] })).toThrow("name is required");
    expect(() => createMultiSelect({ name: "x", items: [] })).toThrow("label is required");
    expect(() => createMultiSelect({ name: "x", label: "X" })).toThrow("onFilter or items");
  });

  it("initial values render chips and populate the hidden select", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    const ms = createMultiSelect({
      name: "t", label: "T",
      items: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
      values: ["a"],
    });
    expect(ms.values).toEqual(["a"]);
    const chips = ms.el.querySelectorAll(".tm-chip");
    expect(chips.length).toBe(1);
    expect(chips[0].querySelector(".tm-chip-label").textContent).toBe("Alpha");
    const selected = Array.from(ms.el.querySelectorAll("select option")).filter((o) => o.selected).map((o) => o.value);
    expect(selected).toEqual(["a"]);
  });

  it("adding an option appends a chip and a selected <option>; onChange fires", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    const changes = [];
    const ms = createMultiSelect({
      name: "t", label: "T",
      items: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
      onChange: (vs) => changes.push(vs),
    });
    const input = ms.el.querySelector("input");
    input.value = "";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    // Click the first visible option.
    const opt = ms.el.querySelector("[role='option']");
    opt.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(ms.values).toEqual(["a"]);
    expect(changes[changes.length - 1]).toEqual(["a"]);
    // The selected value disappears from the menu (already chosen).
    expect(ms.el.querySelectorAll("[role='option']").length).toBe(1); // only Beta remains
  });

  it("clicking a chip's remove button removes the value", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    const changes = [];
    const ms = createMultiSelect({
      name: "t", label: "T",
      items: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
      values: ["a", "b"],
      onChange: (vs) => changes.push(vs),
    });
    ms.el.querySelector(".tm-chip-remove").click();
    expect(ms.values).toEqual(["b"]);
    expect(changes[changes.length - 1]).toEqual(["b"]);
  });

  it("Backspace on empty input removes the last chip", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    const ms = createMultiSelect({
      name: "t", label: "T",
      items: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
      values: ["a", "b"],
    });
    const input = ms.el.querySelector("input");
    input.value = "";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
    expect(ms.values).toEqual(["a"]);
  });

  it("setValues replaces the whole selection", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    const ms = createMultiSelect({
      name: "t", label: "T",
      items: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }, { value: "c", label: "Gamma" }],
    });
    ms.setValues(["b", "c"]);
    expect(ms.values).toEqual(["b", "c"]);
    const selected = Array.from(ms.el.querySelectorAll("select option")).map((o) => o.value);
    expect(selected.sort()).toEqual(["b", "c"]);
  });

  it("async onFilter discards a stale response", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    const d1 = deferred();
    const d2 = deferred();
    let call = 0;
    const ms = createMultiSelect({ name: "t", label: "T", onFilter: () => (call++ === 0 ? d1.promise : d2.promise) });
    const input = ms.el.querySelector("input");
    input.value = "a";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    input.value = "ab";
    input.dispatchEvent(new Event("input"));
    await sleep(180);
    d2.resolve([{ value: "ab1", label: "Fresh" }]);
    await sleep(0);
    expect(optionTexts(ms.el)).toEqual(["Fresh"]);
    d1.resolve([{ value: "a1", label: "Stale" }]);
    await sleep(0);
    expect(optionTexts(ms.el)).toEqual(["Fresh"]);
  });

  it("destroy removes the element", async () => {
    const { createMultiSelect } = await import("../../../assets/js/combobox.js");
    const parent = document.createElement("div");
    const ms = createMultiSelect({ name: "t", label: "T", items: [] });
    parent.appendChild(ms.el);
    ms.destroy();
    expect(parent.children.length).toBe(0);
  });
});
