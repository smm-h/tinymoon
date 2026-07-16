import { describe, it, expect, beforeEach } from "vitest";
import { createTabPanels } from "../../../assets/js/tabpanels.js";

beforeEach(() => { document.body.innerHTML = ""; });

function make(counts = {}) {
  return createTabPanels({
    label: "Sections",
    items: [
      { value: "a", label: "A", build: (p) => { counts.a = (counts.a || 0) + 1; p.appendChild(document.createElement("input")); } },
      { value: "b", label: "B", build: (p) => { counts.b = (counts.b || 0) + 1; p.textContent = "B body"; } },
      { value: "c", label: "C", build: (p) => { counts.c = (counts.c || 0) + 1; } },
    ],
    value: "a",
  });
}

describe("createTabPanels", () => {
  it("requires label and items", () => {
    expect(() => createTabPanels({ items: [{ value: "a", label: "A" }] })).toThrow(/label/);
    expect(() => createTabPanels({ label: "x", items: [] })).toThrow(/items/);
  });

  it("builds only the active panel on mount (lazy)", () => {
    const counts = {};
    make(counts);
    expect(counts.a).toBe(1);
    expect(counts.b).toBeUndefined();
    expect(counts.c).toBeUndefined();
  });

  it("builds a panel on first activation and never rebuilds it (idempotent)", () => {
    const counts = {};
    const tp = make(counts);
    tp.set("b");
    expect(counts.b).toBe(1);
    tp.set("a");
    tp.set("b"); // revisit
    expect(counts.b).toBe(1); // not rebuilt
    expect(counts.a).toBe(1);
  });

  it("hides inactive panels rather than destroying them (state preserved)", () => {
    const tp = make();
    document.body.appendChild(tp.el);
    tp.set("a");
    const input = tp.el.querySelector("input");
    input.value = "typed";
    tp.set("b");
    // Panel A is hidden, not removed; its input keeps its value.
    expect(input.isConnected).toBe(true);
    expect(input.value).toBe("typed");
    const panelA = input.closest('[role="tabpanel"]');
    expect(panelA.hidden).toBe(true);
    tp.set("a");
    expect(panelA.hidden).toBe(false);
    expect(tp.el.querySelector("input").value).toBe("typed");
  });

  it("completes the APG aria wiring: tab aria-controls ↔ panel aria-labelledby", () => {
    const tp = make();
    const tabs = tp.el.querySelectorAll('[role="tab"]');
    const panels = tp.el.querySelectorAll('[role="tabpanel"]');
    expect(tabs.length).toBe(3);
    expect(panels.length).toBe(3);
    tabs.forEach((tab, i) => {
      const panelId = tab.getAttribute("aria-controls");
      const panel = tp.el.querySelector("#" + panelId);
      expect(panel.getAttribute("role")).toBe("tabpanel");
      expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
    });
    // Exactly one panel visible at a time.
    const visible = [...panels].filter((p) => !p.hidden);
    expect(visible.length).toBe(1);
  });

  it("exposes the current value and reflects tab selection", () => {
    const tp = make();
    expect(tp.value).toBe("a");
    tp.set("c");
    expect(tp.value).toBe("c");
    const selected = tp.el.querySelector('[role="tab"][aria-selected="true"]');
    expect(selected.getAttribute("aria-controls")).toBe(
      tp.el.querySelector('[role="tabpanel"]:not([hidden])').id,
    );
  });

  it("destroy removes the element", () => {
    const tp = make();
    document.body.appendChild(tp.el);
    tp.destroy();
    expect(tp.el.isConnected).toBe(false);
  });
});
