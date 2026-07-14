import { describe, it, expect, vi, beforeEach } from "vitest";

// Unit tests for the copyable registry (registerCopyable, unregisterCopyable,
// getCopyData) and the document-level copy event handler in kernel.js.

describe("registerCopyable", () => {
  let registerCopyable, unregisterCopyable, getCopyData;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../assets/js/kernel.js");
    registerCopyable = mod.registerCopyable;
    unregisterCopyable = mod.unregisterCopyable;
    getCopyData = mod.getCopyData;
  });

  it("adds tabindex='0' to non-focusable elements", () => {
    const div = document.createElement("div");
    registerCopyable(div, () => ({ text: "hello" }));
    expect(div.getAttribute("tabindex")).toBe("0");
  });

  it("does not override existing tabindex", () => {
    const div = document.createElement("div");
    div.setAttribute("tabindex", "-1");
    registerCopyable(div, () => ({ text: "hello" }));
    expect(div.getAttribute("tabindex")).toBe("-1");
  });

  it("does not add tabindex to natively focusable elements", () => {
    const btn = document.createElement("button");
    registerCopyable(btn, () => ({ text: "hello" }));
    expect(btn.hasAttribute("tabindex")).toBe(false);
  });

  it("getCopyData returns data for a registered element", () => {
    const div = document.createElement("div");
    registerCopyable(div, () => ({ text: "the-value" }));
    const data = getCopyData(div);
    expect(data).toEqual({ text: "the-value" });
  });

  it("getCopyData walks ancestors", () => {
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.appendChild(child);
    registerCopyable(parent, () => ({ text: "from-parent" }));
    const data = getCopyData(child);
    expect(data).toEqual({ text: "from-parent" });
  });

  it("getCopyData returns null for unregistered elements", () => {
    const div = document.createElement("div");
    expect(getCopyData(div)).toBeNull();
  });

  it("unregisterCopyable removes the element from the registry", () => {
    const div = document.createElement("div");
    registerCopyable(div, () => ({ text: "hello" }));
    expect(getCopyData(div)).toEqual({ text: "hello" });
    unregisterCopyable(div);
    expect(getCopyData(div)).toBeNull();
  });
});

describe("copy event handler", () => {
  let registerCopyable;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../assets/js/kernel.js");
    registerCopyable = mod.registerCopyable;
  });

  it("intercepts copy on a focused copyable element", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    registerCopyable(div, () => ({ text: "copied-text", html: "<b>copied</b>" }));
    div.focus();

    const setData = vi.fn();
    const prevented = { value: false };
    const event = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { setData },
    });
    event.preventDefault = () => { prevented.value = true; };

    document.dispatchEvent(event);

    expect(prevented.value).toBe(true);
    expect(setData).toHaveBeenCalledWith("text/plain", "copied-text");
    expect(setData).toHaveBeenCalledWith("text/html", "<b>copied</b>");

    document.body.removeChild(div);
  });

  it("sets only text/plain when html is not provided", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    registerCopyable(div, () => ({ text: "just-text" }));
    div.focus();

    const setData = vi.fn();
    const event = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { setData },
    });
    event.preventDefault = () => {};

    document.dispatchEvent(event);

    expect(setData).toHaveBeenCalledWith("text/plain", "just-text");
    expect(setData).not.toHaveBeenCalledWith("text/html", expect.anything());

    document.body.removeChild(div);
  });

  it("does not intercept copy when activeElement is not copyable", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    div.setAttribute("tabindex", "0");
    div.focus();

    const setData = vi.fn();
    const prevented = { value: false };
    const event = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { setData },
    });
    event.preventDefault = () => { prevented.value = true; };

    document.dispatchEvent(event);

    expect(prevented.value).toBe(false);
    expect(setData).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });
});
