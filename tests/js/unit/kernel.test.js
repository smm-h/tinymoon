import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Escape stack
// ---------------------------------------------------------------------------

describe("kernel escape stack", () => {
  // Each test gets a fresh module instance so the layer stack is empty.
  let pushLayer;

  beforeEach(async () => {
    // Dynamic import with a cache-busting query ensures a fresh module
    // evaluation per test (vitest re-executes the module factory).
    vi.resetModules();
    const mod = await import("../../../assets/js/kernel.js");
    pushLayer = mod.pushLayer;
  });

  it("Escape closes only the topmost layer", () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    pushLayer(closeA);
    pushLayer(closeB);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it("second Escape closes the next layer after the first is removed", () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    pushLayer(closeA);
    const removeB = pushLayer(closeB);

    // First Escape fires closeB; simulate that closeB also removes itself
    // (the normal overlay pattern).
    closeB.mockImplementation(() => removeB());

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closeA).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the stack is empty", () => {
    // No layers — Escape should not throw.
    expect(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }).not.toThrow();
  });

  it("the remove function is idempotent", () => {
    const closeFn = vi.fn();
    const remove = pushLayer(closeFn);
    remove();
    remove(); // second call is a no-op

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closeFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// placeBelow
// ---------------------------------------------------------------------------

describe("kernel placeBelow", () => {
  let placeBelow;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../assets/js/kernel.js");
    placeBelow = mod.placeBelow;
  });

  function mockAnchor(rect) {
    return { getBoundingClientRect: () => rect };
  }

  function mockPanel(rect) {
    return {
      getBoundingClientRect: () => rect,
      style: { left: "", top: "" },
    };
  }

  it("places the panel below the anchor by default", () => {
    // Viewport: 1024 x 768, plenty of room below.
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
    // Ensure --footer-h is 0.
    document.documentElement.style.setProperty("--footer-h", "0px");

    const anchor = mockAnchor({ left: 100, top: 50, right: 200, bottom: 70, width: 100, height: 20 });
    const panel = mockPanel({ left: 0, top: 0, right: 120, bottom: 40, width: 120, height: 40 });

    placeBelow(anchor, panel);

    // Below: y = anchor.bottom + gap(8) = 78
    expect(panel.style.top).toBe("78px");
    // Centered: x = 100 + 50 - 60 = 90
    expect(panel.style.left).toBe("90px");
  });

  it("flips above when clipping the viewport bottom", () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 200, configurable: true });
    document.documentElement.style.setProperty("--footer-h", "0px");

    // Anchor near the bottom: bottom = 170, panel height 80 — would clip.
    const anchor = mockAnchor({ left: 100, top: 150, right: 200, bottom: 170, width: 100, height: 20 });
    const panel = mockPanel({ left: 0, top: 0, right: 120, bottom: 80, width: 120, height: 80 });

    placeBelow(anchor, panel);

    // Flipped above: y = anchor.top - panel.height - gap = 150 - 80 - 8 = 62
    expect(panel.style.top).toBe("62px");
  });

  it("accounts for --footer-h in the flip decision", () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 400, configurable: true });
    document.documentElement.style.setProperty("--footer-h", "200px");

    // Without footer: bottom at 300 + 8 + 80 = 388 < 400, fits.
    // With footer: 388 > 400 - 200 - 8 = 192, flips.
    const anchor = mockAnchor({ left: 100, top: 280, right: 200, bottom: 300, width: 100, height: 20 });
    const panel = mockPanel({ left: 0, top: 0, right: 120, bottom: 80, width: 120, height: 80 });

    placeBelow(anchor, panel);

    // Flipped above: y = 280 - 80 - 8 = 192
    expect(panel.style.top).toBe("192px");
  });
});

// ---------------------------------------------------------------------------
// ensureRoot
// ---------------------------------------------------------------------------

describe("kernel ensureRoot", () => {
  let ensureRoot;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../assets/js/kernel.js");
    ensureRoot = mod.ensureRoot;
    // Clean up any previously created roots.
    const old = document.getElementById("tm-test-root");
    if (old) old.remove();
  });

  it("creates a div with the given id", () => {
    const node = ensureRoot("tm-test-root");
    expect(node.tagName).toBe("DIV");
    expect(node.id).toBe("tm-test-root");
    expect(document.getElementById("tm-test-root")).toBe(node);
    node.remove();
  });

  it("returns the existing element on the second call", () => {
    const first = ensureRoot("tm-test-root");
    const second = ensureRoot("tm-test-root");
    expect(second).toBe(first);
    first.remove();
  });

  it("sets attributes from the attrs object", () => {
    const node = ensureRoot("tm-test-root", { role: "menu" });
    expect(node.getAttribute("role")).toBe("menu");
    node.remove();
  });
});

// ---------------------------------------------------------------------------
// cssVar
// ---------------------------------------------------------------------------

describe("kernel cssVar", () => {
  let cssVar;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../assets/js/kernel.js");
    cssVar = mod.cssVar;
  });

  it("reads a CSS custom property from :root", () => {
    document.documentElement.style.setProperty("--tm-test-token", "42px");
    expect(cssVar("--tm-test-token")).toBe("42px");
    document.documentElement.style.removeProperty("--tm-test-token");
  });
});
