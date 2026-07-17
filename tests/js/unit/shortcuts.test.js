import { describe, it, expect, vi, afterEach } from "vitest";
import { registerShortcut } from "../../../assets/js/shortcuts.js";
import { registerLightDismiss } from "../../../assets/js/dismiss.js";

// The module keeps ONE document keydown listener and a module-level registry.
// Each test unregisters its combos so signatures do not collide across tests.
const cleanups = [];
function reg(...args) {
  const off = registerShortcut(...args);
  cleanups.push(off);
  return off;
}
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
  document.body.innerHTML = "";
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

function key(opts, target) {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...opts });
  (target || document).dispatchEvent(e);
  return e;
}

describe("registerShortcut — combo parsing & platform mod", () => {
  it("fires on a bare single-key combo", () => {
    const h = vi.fn();
    reg("k", h);
    key({ key: "k" });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("resolves mod to Ctrl on non-Apple platforms (happy-dom default)", () => {
    const h = vi.fn();
    reg("mod+k", h);
    key({ key: "k", ctrlKey: true });
    expect(h).toHaveBeenCalledTimes(1);
    key({ key: "k", metaKey: true });
    expect(h).toHaveBeenCalledTimes(1); // meta does not match on non-mac
  });

  it("matches a shifted single character by the character itself", () => {
    const h = vi.fn();
    reg("?", h);
    key({ key: "?", shiftKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("respects shift for named keys", () => {
    const h = vi.fn();
    reg("shift+Enter", h);
    key({ key: "Enter" });
    expect(h).not.toHaveBeenCalled();
    key({ key: "Enter", shiftKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("throws on an unknown modifier", () => {
    expect(() => registerShortcut("hyper+k", () => {})).toThrow(/unknown modifier/);
  });

  it("requires a handler function", () => {
    expect(() => registerShortcut("k", null)).toThrow(/handler is required/);
  });
});

describe("registerShortcut — duplicate & unregister", () => {
  it("throws on a duplicate active combo (no silent override)", () => {
    reg("mod+p", () => {});
    expect(() => registerShortcut("mod+p", () => {})).toThrow(/already registered/);
  });

  it("allows re-registration after unregister", () => {
    const off = registerShortcut("mod+j", () => {});
    off();
    expect(() => { cleanups.push(registerShortcut("mod+j", () => {})); }).not.toThrow();
  });

  it("unregister stops the handler firing", () => {
    const h = vi.fn();
    const off = registerShortcut("g", h);
    key({ key: "g" });
    expect(h).toHaveBeenCalledTimes(1);
    off();
    key({ key: "g" });
    expect(h).toHaveBeenCalledTimes(1);
  });
});

describe("registerShortcut — input & overlay suppression", () => {
  it("suppresses a bare single-key combo inside a text input", () => {
    const h = vi.fn();
    reg("k", h);
    const input = document.createElement("input");
    document.body.appendChild(input);
    key({ key: "k" }, input);
    expect(h).not.toHaveBeenCalled();
  });

  it("allowInInputs lets a single-key combo fire inside an input", () => {
    const h = vi.fn();
    reg("k", h, { allowInInputs: true });
    const input = document.createElement("input");
    document.body.appendChild(input);
    key({ key: "k" }, input);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("a modifier combo always fires inside an input", () => {
    const h = vi.fn();
    reg("mod+k", h);
    const input = document.createElement("input");
    document.body.appendChild(input);
    key({ key: "k", ctrlKey: true }, input);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("suppresses a non-global shortcut while a modal dialog is open", () => {
    const h = vi.fn();
    reg("mod+k", h);
    const dlg = document.createElement("dialog");
    dlg.setAttribute("open", "");
    document.body.appendChild(dlg);
    key({ key: "k", ctrlKey: true });
    expect(h).not.toHaveBeenCalled();
  });

  it("a global shortcut fires even while a modal dialog is open", () => {
    const h = vi.fn();
    reg("mod+k", h, { global: true });
    const dlg = document.createElement("dialog");
    dlg.setAttribute("open", "");
    document.body.appendChild(dlg);
    key({ key: "k", ctrlKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });
});

describe("registerShortcut — light-dismiss overlay suppression", () => {
  const layers = [];
  function openLightOverlay() {
    // Any transient overlay (popover, context menu, select, non-modal drawer)
    // registers a light-dismiss layer; a bare panel registration stands in.
    const panel = document.createElement("div");
    document.body.appendChild(panel);
    const off = registerLightDismiss({ panels: [panel], dismiss: () => {} });
    layers.push(off);
    return off;
  }
  afterEach(() => { while (layers.length) layers.pop()(); });

  it("suppresses a non-global shortcut while a light-dismiss overlay is open", () => {
    const h = vi.fn();
    reg("mod+k", h);
    openLightOverlay();
    key({ key: "k", ctrlKey: true });
    expect(h).not.toHaveBeenCalled();
  });

  it("a global shortcut still fires while a light-dismiss overlay is open", () => {
    const h = vi.fn();
    reg("mod+k", h, { global: true });
    openLightOverlay();
    key({ key: "k", ctrlKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("suppression lifts once the overlay unregisters its layer", () => {
    const h = vi.fn();
    reg("mod+k", h);
    const off = openLightOverlay();
    key({ key: "k", ctrlKey: true });
    expect(h).not.toHaveBeenCalled();
    off(); // overlay closed → layer gone → shortcuts live again
    key({ key: "k", ctrlKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });
});
