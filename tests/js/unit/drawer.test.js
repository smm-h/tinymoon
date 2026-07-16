import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDrawer, swipeToClose } from "../../../assets/js/drawer.js";

// happy-dom lacks requestAnimationFrame timing guarantees and <dialog>.showModal
// is a partial stub; these unit tests exercise the JS contract (structure,
// layer stack, dismissal paths, focus restore). Full modal trap + swipe on a
// real viewport are covered by the Playwright e2e suite.

beforeEach(() => {
  document.body.innerHTML = "";
  vi.stubGlobal("requestAnimationFrame", (cb) => cb());
});

describe("openDrawer (non-modal)", () => {
  it("mounts a labeled role=dialog panel with a title and body", () => {
    const d = openDrawer({ title: "Filters", body: "hello body", side: "left" });
    expect(d.el.getAttribute("role")).toBe("dialog");
    expect(d.el.getAttribute("aria-modal")).toBe("false");
    expect(d.el.classList.contains("tm-drawer-left")).toBe(true);
    const titleId = d.el.getAttribute("aria-labelledby");
    expect(d.el.querySelector("#" + titleId).textContent).toBe("Filters");
    expect(d.el.querySelector(".tm-drawer-body").textContent).toBe("hello body");
    d.close();
  });

  it("appends into the shared tm-drawer-root and removes on close", () => {
    const d = openDrawer({ title: "T", body: "b" });
    const root = document.getElementById("tm-drawer-root");
    expect(root).not.toBeNull();
    expect(root.contains(d.el)).toBe(true);
    d.close();
    expect(d.el.isConnected).toBe(false);
  });

  it("closes on an outside pointerdown but not on an inside one", () => {
    vi.useFakeTimers();
    const d = openDrawer({ title: "T", body: "b" });
    vi.runAllTimers(); // register the deferred outside listener
    // Inside pointerdown: stays open.
    d.el.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(d.el.isConnected).toBe(true);
    // Outside pointerdown: closes.
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(d.el.isConnected).toBe(false);
    vi.useRealTimers();
  });

  it("restores focus to the previously focused element on close", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();
    expect(document.activeElement).toBe(btn);
    const d = openDrawer({ title: "T", body: "b" });
    // Focus moved into the drawer (close button).
    expect(d.el.contains(document.activeElement)).toBe(true);
    d.close();
    expect(document.activeElement).toBe(btn);
  });

  it("the close button dismisses the drawer", () => {
    const d = openDrawer({ title: "T", body: "b" });
    d.el.querySelector(".icon-btn").dispatchEvent(new Event("click", { bubbles: true }));
    expect(d.el.isConnected).toBe(false);
  });

  it("Escape (kernel layer stack) closes the drawer", () => {
    const d = openDrawer({ title: "T", body: "b" });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(d.el.isConnected).toBe(false);
  });
});

describe("openDrawer (modal)", () => {
  it("builds a <dialog> panel without the non-modal aria-modal=false attr", () => {
    // happy-dom may not implement showModal; guard so the JS path is covered.
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      HTMLDialogElement.prototype.close = function () { this.open = false; };
    }
    const d = openDrawer({ title: "M", body: "b", modal: true, side: "right" });
    expect(d.el.tagName).toBe("DIALOG");
    expect(d.el.classList.contains("tm-drawer-modal")).toBe(true);
    expect(d.el.getAttribute("aria-modal")).toBeNull();
    d.close();
    expect(d.el.isConnected).toBe(false);
  });
});

describe("swipeToClose", () => {
  it("fires onClose on a leftward drag past the threshold for a left drawer", () => {
    const panel = document.createElement("div");
    const onClose = vi.fn();
    swipeToClose(panel, onClose, { edge: "left", threshold: 50 });
    panel.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 200 }));
    panel.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 120 }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire on a short drag under the threshold", () => {
    const panel = document.createElement("div");
    const onClose = vi.fn();
    swipeToClose(panel, onClose, { edge: "left", threshold: 50 });
    panel.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 200 }));
    panel.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 180 }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("teardown removes the listeners", () => {
    const panel = document.createElement("div");
    const onClose = vi.fn();
    const off = swipeToClose(panel, onClose, { edge: "left" });
    off();
    panel.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 200 }));
    panel.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 100 }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
