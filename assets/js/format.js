// tinymoon — formatting utilities: media-duration and relative-time helpers.
// App-level, DOM-light: fmtTime and relativeTime are pure string functions;
// liveRelativeTime drives an element's textContent from a single shared ticker.

// fmtTime(seconds) → a media-duration string. Under an hour it is "m:ss" (the
// minutes are not zero-padded); at or above an hour it is "h:mm:ss". Negative
// and fractional inputs are clamped/floored to whole seconds. This is the
// duration shape earlier releases shipped as `fmtTime` before it was removed in
// 0.4.0; it returns here in the extras `format` module.
export function fmtTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n) => String(n).padStart(2, "0");
  return h > 0 ? h + ":" + two(m) + ":" + two(s) : m + ":" + two(s);
}

// The unit ladder for relativeTime, largest first, in seconds.
const RELATIVE_UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

// A single reused Intl.RelativeTimeFormat. `numeric: "auto"` yields idiomatic
// phrasings ("now", "yesterday") where the locale has them, falling back to
// numeric ("3 minutes ago") otherwise.
let rtf = null;
function relFormatter() {
  if (!rtf) rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return rtf;
}

// relativeTime(date | ms, now?) → a localized relative-time string ("3 minutes
// ago", "in 2 hours", "now") via Intl.RelativeTimeFormat. `date` is a Date or a
// millisecond timestamp. `now` (a ms timestamp) overrides the reference point —
// pass it for deterministic output in tests. A past instant reads "… ago"; a
// future instant reads "in …".
export function relativeTime(date, now) {
  const then = date instanceof Date ? date.getTime() : Number(date);
  const ref = now === undefined ? Date.now() : now;
  const diffSec = (then - ref) / 1000; // negative = past
  const abs = Math.abs(diffSec);
  for (const [unit, secs] of RELATIVE_UNITS) {
    if (abs >= secs || unit === "second") {
      return relFormatter().format(Math.round(diffSec / secs), unit);
    }
  }
  return relFormatter().format(0, "second"); // unreachable; keeps the type total
}

// -- liveRelativeTime: one shared ticker across every registered element -------

// Element → target timestamp (ms). While this map is non-empty a single
// setInterval repaints every registered element once a second; when it empties
// the interval is cleared. This is the kernel-singleton discipline: exactly one
// timer, alive only while there is work for it, no per-element intervals.
const liveRegistry = new Map();
let liveTimer = null;

function repaintAll() {
  const now = Date.now();
  for (const [element, ms] of liveRegistry) {
    element.textContent = relativeTime(ms, now);
  }
}

function ensureTicker() {
  if (liveTimer === null && liveRegistry.size > 0) {
    liveTimer = setInterval(repaintAll, 1000);
  }
}

function stopTickerIfEmpty() {
  if (liveTimer !== null && liveRegistry.size === 0) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
}

// liveRelativeTime(el, date) → unregister(). Registers `el` with the shared
// ticker so its textContent tracks the relative time to `date` (a Date or ms
// timestamp), painting once immediately and then once a second. The returned
// function unregisters `el`; when the last registration leaves, the shared
// interval stops. Re-registering the same element replaces its target time.
export function liveRelativeTime(el, date) {
  if (!el) throw new Error("liveRelativeTime: el is required");
  const ms = date instanceof Date ? date.getTime() : Number(date);
  liveRegistry.set(el, ms);
  el.textContent = relativeTime(ms);
  ensureTicker();
  return () => {
    liveRegistry.delete(el);
    stopTickerIfEmpty();
  };
}
