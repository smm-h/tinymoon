// tinymoon — stats: a single key/value stat tile and a convenience row builder.
// createStat is a stateful component ({el, set, setTrend, destroy}); renderStats
// wraps several into the existing .report-stats grid.
//
// Trend direction is ALWAYS explicit — "good" | "bad" | "neutral" — never
// inferred from the value. The widget cannot know whether a metric is
// higher-is-better (throughput, uptime) or lower-is-better (error rate,
// latency, cost): a rising error count is BAD, a rising uptime is GOOD, and the
// same number can mean either. Forcing the caller to state the direction keeps
// the coloring honest. The direction drives a non-text delta indicator (a
// colored triangle/edge, the 3:1 non-text UI floor), never the value text,
// which stays at the high-contrast --text token so it always clears 4.5:1.

import { el } from "./dom.js";

const TRENDS = new Set(["good", "bad", "neutral"]);

function trendClass(trend) {
  return "trend-" + trend;
}

// createStat({label, value, unit?, trend?}) → {el, set(value), setTrend(trend),
// destroy}. `label` is required. `value` is coerced to a string. `unit` renders
// as a dimmed <small> suffix. `trend` (optional) is one of "good"|"bad"|
// "neutral"; omitting it shows no delta indicator. An unknown trend throws.
export function createStat(opts) {
  if (!opts || opts.label == null) throw new Error("createStat: label is required");
  const { label, value = "", unit, trend } = opts;
  if (trend !== undefined && !TRENDS.has(trend)) {
    throw new Error(
      "createStat: unknown trend " + JSON.stringify(trend) +
        " — expected one of good, bad, neutral (direction is always explicit)",
    );
  }

  const root = el("div", "stat");
  root.appendChild(el("span", "k", String(label)));

  // Delta indicator: a decorative, CSS-drawn triangle/edge colored by trend.
  // aria-hidden because the direction is conveyed to assistive tech by the
  // value + label, not by a glyph.
  const delta = el("span", "stat-delta");
  delta.setAttribute("aria-hidden", "true");

  const vWrap = el("span", "v");
  const vText = el("span", "stat-v-text");
  vWrap.appendChild(delta);
  vWrap.appendChild(vText);
  let unitEl = null;
  if (unit != null && unit !== "") {
    unitEl = document.createElement("small");
    unitEl.textContent = String(unit);
    vWrap.appendChild(unitEl);
  }
  root.appendChild(vWrap);

  function set(next) {
    vText.textContent = next == null ? "" : String(next);
  }
  function setTrend(next) {
    if (next != null && !TRENDS.has(next)) {
      throw new Error("createStat.setTrend: unknown trend " + JSON.stringify(next));
    }
    for (const t of TRENDS) root.classList.remove(trendClass(t));
    if (next != null) root.classList.add(trendClass(next));
  }

  set(value);
  if (trend !== undefined) setTrend(trend);

  function destroy() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, set, setTrend, destroy };
}

// renderStats(items) → {el, stats, destroy}. `items` is an array of createStat
// option objects; the returned `el` is a .report-stats grid holding one stat
// tile per item, `stats` is the array of createStat instances (in order), and
// `destroy` tears them all down. A convenience over hand-wiring a row.
export function renderStats(items) {
  if (!Array.isArray(items)) throw new Error("renderStats: items array is required");
  const root = el("div", "report-stats");
  const stats = items.map((item) => {
    const s = createStat(item);
    root.appendChild(s.el);
    return s;
  });
  function destroy() {
    for (const s of stats) s.destroy();
    if (root.parentNode) root.parentNode.removeChild(root);
  }
  return { el: root, stats, destroy };
}
