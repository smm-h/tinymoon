// tinymoon — createSlider: a range control wrapped in a `.tm-slider` frame.
// The native <input type="range"> supplies keyboard support (Arrow keys, Home,
// End, Page Up/Down) and the slider ARIA role for free; the wrapper class is
// the sanctioned framework construct, and the filled track / sharp thumb are
// drawn entirely by CSS via the --tm-slider-fill custom property.
//
// Two callbacks, by convention:
//   onInput  — fires live during a drag (the native "input" event)
//   onChange — fires once on commit (the native "change" event)
// This split extends tinymoon's usual single-onChange convention; it is the
// one place where the input/commit distinction is worth surfacing.
//
// Written plainly: the conformance checker exempts native-element creation in
// tinymoon's own shipped modules (framework-own allowance).

import { el } from "./dom.js";

let idCounter = 0;

// createSlider({name, label, min, max, step?, value?, disabled?, onChange,
//   onInput?}) -> {el, value (getter), set(v), get(), destroy()}.
// name, label, min, and max are required (hard error).
export function createSlider(opts) {
  if (!opts || !opts.name) throw new Error("createSlider: name is required");
  if (!opts.label) throw new Error("createSlider: label is required");
  if (opts.min === undefined || opts.min === null) throw new Error("createSlider: min is required");
  if (opts.max === undefined || opts.max === null) throw new Error("createSlider: max is required");

  const min = Number(opts.min);
  const max = Number(opts.max);
  const step = opts.step !== undefined ? Number(opts.step) : 1;
  const id = "tm-slider-" + (++idCounter);

  const wrap = el("div", "tm-slider");

  const range = el("input", "tm-slider-input");
  range.type = "range";
  range.id = id;
  range.name = opts.name;
  range.min = String(min);
  range.max = String(max);
  range.step = String(step);
  // A slider is a single control: an aria-label is its accessible name. When
  // composed inside createField, the field's <label for> associates as well.
  range.setAttribute("aria-label", opts.label);
  range.value = String(opts.value !== undefined ? Number(opts.value) : min);
  if (opts.disabled) range.disabled = true;

  wrap.appendChild(range);

  function fillPct() {
    if (max === min) return 0;
    return ((Number(range.value) - min) / (max - min)) * 100;
  }
  function paint() {
    wrap.style.setProperty("--tm-slider-fill", fillPct() + "%");
  }
  paint();

  const handlers = [];
  function listen(ev, fn) {
    range.addEventListener(ev, fn);
    handlers.push([ev, fn]);
  }
  listen("input", (e) => {
    paint();
    if (opts.onInput) opts.onInput(Number(range.value), e);
  });
  listen("change", (e) => {
    paint();
    if (opts.onChange) opts.onChange(Number(range.value), e);
  });

  return {
    el: wrap,
    get value() { return Number(range.value); },
    set(v) { range.value = String(v); paint(); },
    get() { return Number(range.value); },
    destroy() {
      for (const [ev, fn] of handlers) range.removeEventListener(ev, fn);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}
