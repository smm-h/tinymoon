// tinymoon — chart container: a renderer-agnostic charting LIFECYCLE. It ships
// NO charting. createChartContainer({render, update?, label}) ->
//   {el, redraw, destroy}.
//
// WHAT THIS IS AND IS NOT. tinymoon does not bundle a charting library (that
// would be a runtime dependency and a large one). Instead it provides the parts
// a chart always needs and that are tedious to get right: a sized root, a
// ResizeObserver that re-renders on layout changes (debounced to one paint per
// animation frame), a margin convention read from CSS tokens, and the shared
// tooltip. You bring the drawing — D3, hand-rolled SVG, canvas, whatever. The
// container NEVER draws anything itself.
//
// render(ctx) / update(ctx) receive:
//   { root, width, height, margin, cssVar }
// where `root` is the element to draw into, width/height are the container's
// current content box, `margin` is {top,right,bottom,left} read from the
// --chart-margin-* custom properties on the container (override them in your own
// CSS), and `cssVar(name)` reads a token resolved against the container so a
// themed subtree gets themed values. The first paint and every explicit
// redraw() call render(); a resize calls update() when provided (a lighter
// in-place patch) and otherwise falls back to render().
//
// TOOLTIP. The container activates the shared data-tooltip system: any element
// you draw with a data-tooltip attribute gets the singleton themed tooltip, so
// charts don't each ship their own tooltip layer.

import { el } from "./dom.js";
import { cssVar } from "./kernel.js";
import { ensureTooltip } from "./tooltip.js";

const MARGIN_SIDES = ["top", "right", "bottom", "left"];

// createChartContainer({render, update?, label}) -> {el, redraw(), destroy}.
// `label` is required (the chart's accessible name). `render`/`update` are the
// caller's draw callbacks.
export function createChartContainer(opts) {
  if (!opts || typeof opts.render !== "function") {
    throw new Error("createChartContainer: render(ctx) is required");
  }
  if (opts.label == null || opts.label === "") {
    throw new Error("createChartContainer: a label is required (accessible name)");
  }
  const { render, update } = opts;

  const root = el("div", "tm-chart");
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", String(opts.label));

  const drawRoot = el("div", "tm-chart-draw");
  root.appendChild(drawRoot);

  // The shared tooltip system is passive until an element with data-tooltip is
  // hovered; ensure the singleton exists so chart tooltips work immediately.
  ensureTooltip();

  function readMargin() {
    const m = {};
    for (const side of MARGIN_SIDES) {
      const raw = cssVar("--chart-margin-" + side, root);
      const n = parseFloat(raw);
      m[side] = Number.isFinite(n) ? n : 0;
    }
    return m;
  }

  function context() {
    return {
      root: drawRoot,
      width: root.clientWidth,
      height: root.clientHeight,
      margin: readMargin(),
      cssVar: (name) => cssVar(name, root),
    };
  }

  function doRender() {
    render(context());
  }

  function doUpdate() {
    if (update) update(context());
    else render(context());
  }

  // Debounce resize-driven re-renders to a single paint per animation frame.
  let rafId = 0;
  function scheduleUpdate() {
    if (rafId) return;
    const raf = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 16);
    rafId = raf(() => {
      rafId = 0;
      doUpdate();
    });
  }

  let observer = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => scheduleUpdate());
    observer.observe(root);
  }

  // redraw(): force a full render immediately (not the resize-path update).
  function redraw() {
    doRender();
  }

  // First paint.
  doRender();

  function destroy() {
    if (observer) { observer.disconnect(); observer = null; }
    if (rafId && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
    rafId = 0;
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, redraw, destroy };
}
