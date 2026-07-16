// tinymoon — sparkline: a tiny inline-SVG trend line.
// createSparkline({values, width?, height?, area?, label?}) ->
//   {el, setData, destroy}.
//
// COLOR DISCIPLINE. Every color comes from CSS classes backed by design tokens
// (.tm-spark-line strokes var(--accent); .tm-spark-area fills a token-soft
// accent). The SVG this module emits carries NO color attributes and NO color
// literals — the conformance checker scans SVG-in-JS strings for raw colors, so
// keeping color entirely in the stylesheet keeps the widget clean and lets the
// line inherit currentColor when a consumer recolors it. There is no canvas and
// no theme listener needed: CSS restyles the SVG on theme change for free.
//
// A11y: the SVG is decorative by default (aria-hidden). Pass a `label` to make
// it a labelled image (role="img" + aria-label) when the trend itself carries
// meaning that isn't already stated in adjacent text.

import { el } from "./dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// sparklinePoints(values, width, height) -> array of {x, y} in SVG user units.
// Pure geometry, exported so the mapping is unit-testable without a DOM. x is
// spread evenly across [0, width]; y maps each value into [0, height] with the
// axis flipped (larger value = smaller y = higher on screen). A flat series
// (min === max) sits on the vertical center. A single point sits at x = 0.
export function sparklinePoints(values, width, height) {
  const vals = Array.isArray(values) ? values.map(Number) : [];
  const n = vals.length;
  if (n === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of vals) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  return vals.map((v, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * width;
    const t = span === 0 ? 0.5 : (v - min) / span;
    const y = height - t * height;
    return { x, y };
  });
}

function ptsAttr(points) {
  return points.map((p) => p.x + "," + p.y).join(" ");
}

// createSparkline({values, width?, height?, area?, label?}) -> {el, setData, destroy}.
// width/height default to 120x32 user units. area:true adds a filled region
// under the line. setData(values) repaints from a new series.
export function createSparkline(opts) {
  const options = opts || {};
  const width = typeof options.width === "number" ? options.width : 120;
  const height = typeof options.height === "number" ? options.height : 32;
  const withArea = options.area === true;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "tm-spark");
  svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  svg.setAttribute("preserveAspectRatio", "none");
  if (options.label != null && options.label !== "") {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", String(options.label));
  } else {
    svg.setAttribute("aria-hidden", "true");
  }

  let area = null;
  if (withArea) {
    area = document.createElementNS(SVG_NS, "path");
    area.setAttribute("class", "tm-spark-area");
    svg.appendChild(area);
  }
  const line = document.createElementNS(SVG_NS, "polyline");
  line.setAttribute("class", "tm-spark-line");
  svg.appendChild(line);

  function paint(values) {
    const points = sparklinePoints(values, width, height);
    line.setAttribute("points", ptsAttr(points));
    if (area) {
      if (points.length === 0) {
        area.setAttribute("d", "");
      } else {
        const first = points[0];
        const last = points[points.length - 1];
        // Baseline at the first x, up to the line, across every point, back
        // down to the baseline at the last x, and closed.
        const line2 = points.map((p) => "L " + p.x + " " + p.y).join(" ");
        const d = "M " + first.x + " " + height + " " + line2 +
          " L " + last.x + " " + height + " Z";
        area.setAttribute("d", d);
      }
    }
  }

  paint(options.values);

  function setData(values) {
    paint(values);
  }

  function destroy() {
    if (svg.parentNode) svg.parentNode.removeChild(svg);
  }

  return { el: svg, setData, destroy };
}
