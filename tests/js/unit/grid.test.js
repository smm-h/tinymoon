import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGrid } from "../../../assets/js/grid.js";

const CSS = readFileSync(
  resolve(import.meta.dirname, "../../../assets/css/primitives.css"),
  "utf8",
);

describe("createGrid", () => {
  it("requires a known preset", () => {
    expect(() => createGrid({})).toThrow(/preset/);
    expect(() => createGrid({ preset: "3x3" })).toThrow(/unknown preset/);
  });

  it("sets data-preset and the right slot count per preset", () => {
    expect(createGrid({ preset: "1x1" }).slots.length).toBe(1);
    expect(createGrid({ preset: "2x1" }).slots.length).toBe(2);
    expect(createGrid({ preset: "1x2" }).slots.length).toBe(2);
    const g = createGrid({ preset: "2x2" });
    expect(g.slots.length).toBe(4);
    expect(g.el.dataset.preset).toBe("2x2");
    expect(g.el.classList.contains("tm-grid")).toBe(true);
  });

  it("supports the asymmetric 3-slot presets 2+1 and 1+2", () => {
    const a = createGrid({ preset: "2+1" });
    expect(a.slots.length).toBe(3);
    expect(a.el.dataset.preset).toBe("2+1");
    const b = createGrid({ preset: "1+2" });
    expect(b.slots.length).toBe(3);
    expect(b.el.dataset.preset).toBe("1+2");
    // setPreset switches between symmetric and asymmetric presets.
    a.setPreset("1+2");
    expect(a.slots.length).toBe(3);
    expect(a.el.dataset.preset).toBe("1+2");
  });

  it("each slot is a .tm-grid-slot child of the grid, in order", () => {
    const g = createGrid({ preset: "2x2" });
    const children = [...g.el.children];
    expect(children.length).toBe(4);
    children.forEach((c) => expect(c.classList.contains("tm-grid-slot")).toBe(true));
    expect(children).toEqual(g.slots);
  });

  it("places provided slot nodes in order", () => {
    const a = document.createElement("span");
    const b = document.createElement("span");
    const g = createGrid({ preset: "2x1", slots: [a, b] });
    expect(g.slots[0].contains(a)).toBe(true);
    expect(g.slots[1].contains(b)).toBe(true);
  });

  it("setPreset grows/shrinks slots and preserves surviving slot content", () => {
    const g = createGrid({ preset: "2x2" });
    const marker = document.createElement("i");
    g.slots[0].appendChild(marker);
    g.setPreset("1x1"); // shrink to 1
    expect(g.slots.length).toBe(1);
    expect(g.el.dataset.preset).toBe("1x1");
    expect(g.slots[0].contains(marker)).toBe(true); // first slot survived
    g.setPreset("2x2"); // grow back to 4
    expect(g.slots.length).toBe(4);
    expect(g.slots[0].contains(marker)).toBe(true);
  });

  it("destroy detaches the grid", () => {
    const g = createGrid({ preset: "1x1" });
    document.body.appendChild(g.el);
    g.destroy();
    expect(g.el.isConnected).toBe(false);
  });

  it("primitives.css defines a selector for every preset", () => {
    for (const preset of ["1x1", "2x1", "1x2", "2x2", "2+1", "1+2"]) {
      expect(CSS).toContain(`.tm-grid[data-preset="${preset}"]`);
    }
  });
});
