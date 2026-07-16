// tinymoon — createSlider: a native <input type="range"> in a `.tm-slider`
// frame (keyboard + slider ARIA come free; track/thumb are pure CSS via the
// --tm-slider-fill property). Two callbacks: onInput fires live during a drag,
// onChange once on commit. variant:"seek" is a distinct identity — an invisible
// position scrubber over app-drawn visuals; see SliderVariant in index.d.ts and
// the .tm-slider-seek CSS. The checker exempts native creation in own modules.

import { el } from "./dom.js";

let idCounter = 0;

const VARIANTS = new Set(["seek"]);

// createSlider({name, label, min, max, step?, value?, disabled?, variant?,
//   onChange, onInput?}) -> {el, value (getter), set(v), get(), destroy()}.
export function createSlider(opts) {
  if (!opts || !opts.name) throw new Error("createSlider: name is required");
  if (!opts.label) throw new Error("createSlider: label is required");
  if (opts.min === undefined || opts.min === null) throw new Error("createSlider: min is required");
  if (opts.max === undefined || opts.max === null) throw new Error("createSlider: max is required");
  if (opts.variant !== undefined && !VARIANTS.has(opts.variant)) {
    throw new Error("createSlider: unknown variant " + JSON.stringify(opts.variant));
  }

  const min = Number(opts.min);
  const max = Number(opts.max);
  const step = opts.step !== undefined ? Number(opts.step) : 1;
  const id = "tm-slider-" + (++idCounter);

  const wrap = el("div", opts.variant === "seek" ? "tm-slider tm-slider-seek" : "tm-slider");

  const range = el("input", "tm-slider-input");
  range.type = "range";
  range.id = id;
  range.name = opts.name;
  range.min = String(min);
  range.max = String(max);
  range.step = String(step);
  // An aria-label is the single control's accessible name (createField also
  // associates its <label for> when composed).
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
