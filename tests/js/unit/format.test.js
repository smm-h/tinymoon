import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unit tests for format.js: fmtTime shape, relativeTime (compared against a
// reference Intl.RelativeTimeFormat so the assertions are locale-independent),
// and liveRelativeTime's single shared ticker (fake timers: it repaints once a
// second, an unregister stops that element, and the interval stops when the
// registry empties).
//
// A fresh module is imported per test (vi.resetModules) so the module-level
// live ticker/registry never leaks across tests.

const BASE = 1_700_000_000_000; // fixed reference instant for determinism

// The same formatter relativeTime uses internally — the oracle for assertions.
const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

let fmtTime, relativeTime, liveRelativeTime;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(BASE);
  const mod = await import("../../../assets/js/format.js");
  fmtTime = mod.fmtTime;
  relativeTime = mod.relativeTime;
  liveRelativeTime = mod.liveRelativeTime;
});

afterEach(() => {
  vi.useRealTimers();
});

// -- fmtTime ------------------------------------------------------------------

describe("fmtTime", () => {
  it("formats sub-minute durations as m:ss", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(5)).toBe("0:05");
    expect(fmtTime(42)).toBe("0:42");
  });

  it("formats sub-hour durations as m:ss", () => {
    expect(fmtTime(90)).toBe("1:30");
    expect(fmtTime(599)).toBe("9:59");
    expect(fmtTime(3599)).toBe("59:59");
  });

  it("formats hour-and-over durations as h:mm:ss", () => {
    expect(fmtTime(3600)).toBe("1:00:00");
    expect(fmtTime(3661)).toBe("1:01:01");
    expect(fmtTime(37230)).toBe("10:20:30");
  });

  it("clamps negatives to 0 and floors fractional seconds", () => {
    expect(fmtTime(-10)).toBe("0:00");
    expect(fmtTime(42.9)).toBe("0:42");
  });

  it("treats non-numeric input as 0", () => {
    expect(fmtTime(NaN)).toBe("0:00");
    expect(fmtTime(undefined)).toBe("0:00");
  });
});

// -- relativeTime -------------------------------------------------------------

describe("relativeTime", () => {
  it("formats a past instant as '… ago' (seconds)", () => {
    const now = BASE;
    expect(relativeTime(now - 5000, now)).toBe(RTF.format(-5, "second"));
  });

  it("formats a past instant in minutes", () => {
    const now = BASE;
    expect(relativeTime(now - 3 * 60000, now)).toBe(RTF.format(-3, "minute"));
  });

  it("formats a future instant as 'in …' (hours)", () => {
    const now = BASE;
    expect(relativeTime(now + 2 * 3600000, now)).toBe(RTF.format(2, "hour"));
  });

  it("selects the day unit for multi-day spans", () => {
    const now = BASE;
    expect(relativeTime(now - 2 * 86400000, now)).toBe(RTF.format(-2, "day"));
  });

  it("accepts a Date as well as a millisecond timestamp", () => {
    const now = BASE;
    const d = new Date(now - 60000);
    expect(relativeTime(d, now)).toBe(RTF.format(-1, "minute"));
  });

  it("uses Date.now() as the reference when `now` is omitted", () => {
    // System time is pinned to BASE via fake timers.
    expect(relativeTime(BASE - 4000)).toBe(RTF.format(-4, "second"));
  });
});

// -- liveRelativeTime ---------------------------------------------------------

describe("liveRelativeTime", () => {
  it("paints the element immediately on registration", () => {
    const el = document.createElement("time");
    liveRelativeTime(el, BASE - 30000);
    expect(el.textContent).toBe(RTF.format(-30, "second"));
  });

  it("repaints once a second as time advances", () => {
    const el = document.createElement("time");
    liveRelativeTime(el, BASE); // "now" at registration
    vi.advanceTimersByTime(60000); // 60s pass
    expect(el.textContent).toBe(RTF.format(-1, "minute"));
  });

  it("shares ONE ticker across multiple registered elements", () => {
    const a = document.createElement("time");
    const b = document.createElement("time");
    liveRelativeTime(a, BASE);
    liveRelativeTime(b, BASE);
    // A single shared interval, not one per element.
    expect(vi.getTimerCount()).toBe(1);
  });

  it("unregistering one element stops updating it but keeps the ticker alive", () => {
    const a = document.createElement("time");
    const b = document.createElement("time");
    const stopA = liveRelativeTime(a, BASE);
    liveRelativeTime(b, BASE);
    stopA();
    const frozen = a.textContent;
    vi.advanceTimersByTime(120000);
    // a is frozen at its last value; b keeps updating; the ticker is still running.
    expect(a.textContent).toBe(frozen);
    expect(b.textContent).toBe(RTF.format(-2, "minute"));
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops the shared ticker when the last registration leaves", () => {
    const a = document.createElement("time");
    const b = document.createElement("time");
    const stopA = liveRelativeTime(a, BASE);
    const stopB = liveRelativeTime(b, BASE);
    expect(vi.getTimerCount()).toBe(1);
    stopA();
    expect(vi.getTimerCount()).toBe(1); // still one left
    stopB();
    expect(vi.getTimerCount()).toBe(0); // ticker cleared
  });
});
