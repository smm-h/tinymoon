import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unit tests for toast.js: ARIA, dismiss button, pause-on-hover,
// duration 0 persistence, stack cap, and kind validation.

describe("toast", () => {
  let toast, setToastErrorHook;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    // Clean up any lingering toast root from prior tests.
    const old = document.getElementById("tm-toast-root");
    if (old) old.remove();
    const mod = await import("../../../assets/js/toast.js");
    toast = mod.toast;
    setToastErrorHook = mod.setToastErrorHook;
  });

  afterEach(() => {
    vi.useRealTimers();
    const old = document.getElementById("tm-toast-root");
    if (old) old.remove();
  });

  // -- ARIA --

  it("toast root has role=status and aria-live=polite", () => {
    toast("hello");
    const root = document.getElementById("tm-toast-root");
    expect(root).not.toBeNull();
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-live")).toBe("polite");
  });

  it("error toast element has role=alert for assertive announcement", () => {
    toast("fail", "err");
    const root = document.getElementById("tm-toast-root");
    const t = root.querySelector(".toast.err");
    expect(t.getAttribute("role")).toBe("alert");
  });

  it("ok toast does not have role=alert", () => {
    toast("ok msg", "ok");
    const root = document.getElementById("tm-toast-root");
    const t = root.querySelector(".toast");
    expect(t.getAttribute("role")).toBeNull();
  });

  // -- Dismiss button --

  it("each toast has a dismiss button", () => {
    toast("msg");
    const root = document.getElementById("tm-toast-root");
    const dismiss = root.querySelector(".toast-dismiss");
    expect(dismiss).not.toBeNull();
    expect(dismiss.getAttribute("aria-label")).toBe("Dismiss");
  });

  it("clicking dismiss removes the toast immediately", () => {
    toast("msg");
    const root = document.getElementById("tm-toast-root");
    expect(root.querySelectorAll(".toast").length).toBe(1);
    const dismiss = root.querySelector(".toast-dismiss");
    dismiss.click();
    expect(root.querySelectorAll(".toast").length).toBe(0);
  });

  // -- Pause-on-hover --

  it("pause-on-hover pauses the auto-dismiss timer", () => {
    toast("msg", "ok", { duration: 1000 });
    const root = document.getElementById("tm-toast-root");
    const t = root.querySelector(".toast");

    // Advance 500ms, then hover to pause.
    vi.advanceTimersByTime(500);
    t.dispatchEvent(new Event("pointerenter"));

    // Advance well past the original duration while hovered.
    vi.advanceTimersByTime(2000);
    expect(root.querySelectorAll(".toast").length).toBe(1);

    // Leave hover — timer resumes with remaining ~500ms.
    t.dispatchEvent(new Event("pointerleave"));

    // Advance to trigger fade + removal.
    vi.advanceTimersByTime(500);
    // Fade starts, then 200ms removal delay.
    vi.advanceTimersByTime(200);
    expect(root.querySelectorAll(".toast").length).toBe(0);
  });

  // -- duration: 0 (persistent) --

  it("duration 0 creates a persistent toast (no auto-dismiss)", () => {
    toast("sticky", "ok", { duration: 0 });
    const root = document.getElementById("tm-toast-root");
    expect(root.querySelectorAll(".toast").length).toBe(1);

    // Advance way past any default duration.
    vi.advanceTimersByTime(60000);
    expect(root.querySelectorAll(".toast").length).toBe(1);

    // Only dismiss button removes it.
    root.querySelector(".toast-dismiss").click();
    expect(root.querySelectorAll(".toast").length).toBe(0);
  });

  // -- Stack cap --

  it("stack cap removes oldest toast when exceeding 5", () => {
    for (let i = 0; i < 6; i++) {
      toast("msg " + i);
    }
    const root = document.getElementById("tm-toast-root");
    const toasts = root.querySelectorAll(".toast");
    expect(toasts.length).toBe(5);
    // The oldest (msg 0) should have been removed; newest (msg 5) present.
    const msgs = Array.from(toasts).map(t => t.querySelector(".toast-msg").textContent);
    expect(msgs).not.toContain("msg 0");
    expect(msgs).toContain("msg 5");
  });

  // -- Kind validation --

  it("invalid kind throws", () => {
    expect(() => toast("msg", "error")).toThrow('invalid kind "error"');
    expect(() => toast("msg", "success")).toThrow('invalid kind "success"');
    expect(() => toast("msg", "warning")).toThrow('invalid kind "warning"');
  });

  it("valid kinds do not throw", () => {
    expect(() => toast("ok", "ok")).not.toThrow();
    expect(() => toast("err", "err")).not.toThrow();
  });

  it("omitted kind defaults to ok", () => {
    toast("default");
    const root = document.getElementById("tm-toast-root");
    const t = root.querySelector(".toast");
    expect(t.classList.contains("err")).toBe(false);
  });

  // -- Default auto-dismiss works --

  it("toast auto-dismisses after default duration", () => {
    toast("msg");
    const root = document.getElementById("tm-toast-root");
    expect(root.querySelectorAll(".toast").length).toBe(1);

    // Default ok duration is 3200ms, then 200ms removal.
    vi.advanceTimersByTime(3200);
    vi.advanceTimersByTime(200);
    expect(root.querySelectorAll(".toast").length).toBe(0);
  });

  // -- Popover attribute for top-layer promotion --

  it("toast root has popover=manual attribute", () => {
    toast("msg");
    const root = document.getElementById("tm-toast-root");
    expect(root.getAttribute("popover")).toBe("manual");
  });
});
