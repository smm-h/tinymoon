// tinymoon — createGrid: a preset rectangular layout primitive. It is a CSS-
// first primitive — the four presets are plain .tm-grid[data-preset] classes in
// primitives.css (grid-template-areas), so a grid can be authored in HTML with
// no JS at all. createGrid is the programmatic convenience: it manages the slot
// elements and lets you switch presets at runtime.
//
// This is a CONTENT primitive, not a shell mode: it lays out content within a
// view, it does not change the app frame. Compose it with createSegmented (see
// the gallery) to build a preset switcher — none is baked in, by design.
//
// Presets are rectangular layouts: "1x1" (1 slot), "2x1" (2 side by side),
// "1x2" (2 stacked), "2x2" (4), plus two asymmetric 3-slot presets — "2+1"
// (a row of two above one full-width cell) and "1+2" (one full-width cell above
// a row of two).

import { el } from "./dom.js";

const CELLS = { "1x1": 1, "2x1": 2, "1x2": 2, "2x2": 4, "2+1": 3, "1+2": 3 };

// createGrid({preset, slots?}) → {el, slots, setPreset(preset), destroy()}.
// `slots` (optional) is an array of nodes placed into the slots in order.
export function createGrid(opts) {
  if (!opts || !opts.preset) throw new Error("createGrid: preset is required");
  if (!(opts.preset in CELLS)) throw new Error("createGrid: unknown preset " + opts.preset);

  const grid = el("div", "tm-grid");
  const slots = []; // live array of slot elements (grows/shrinks with preset)

  function setPreset(preset) {
    if (!(preset in CELLS)) throw new Error("createGrid: unknown preset " + preset);
    grid.dataset.preset = preset;
    const need = CELLS[preset];
    while (slots.length < need) {
      const s = el("div", "tm-grid-slot");
      slots.push(s);
      grid.appendChild(s);
    }
    while (slots.length > need) {
      const s = slots.pop();
      if (s.parentNode) s.parentNode.removeChild(s);
    }
  }

  setPreset(opts.preset);
  if (opts.slots) {
    opts.slots.forEach((node, i) => { if (node && slots[i]) slots[i].appendChild(node); });
  }

  return {
    el: grid,
    slots,
    setPreset,
    destroy() { if (grid.parentNode) grid.parentNode.removeChild(grid); },
  };
}
