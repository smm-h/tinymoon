// tinymoon — pure formatting helpers.

// fmtTime(seconds) → "m:ss". Negative or non-finite input clamps to 0:00.
export function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
}
