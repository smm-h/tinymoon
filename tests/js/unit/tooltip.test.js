import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unit tests for the tooltip module: plain-text-only, focus/hover triggered,
// aria-describedby, Escape dismiss via kernel layer stack.

describe("tooltip", () => {
  let ensureTooltip, hideTip;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../assets/js/tooltip.js");
    ensureTooltip = mod.ensureTooltip;
    hideTip = mod.hideTip;
  });

  afterEach(() => {
    hideTip();
    // Clean up any tooltip elements left on the DOM.
    document.querySelectorAll("[id^='tm-tooltip']").forEach((el) => el.remove());
  });

  it("ensureTooltip creates the singleton with role=tooltip", () => {
    const tip = ensureTooltip();
    expect(tip).toBeInstanceOf(HTMLElement);
    expect(tip.getAttribute("role")).toBe("tooltip");
    // Second call returns the same element.
    expect(ensureTooltip()).toBe(tip);
  });

  it("tooltip shows on focusin and sets aria-describedby", async () => {
    const trigger = document.createElement("button");
    trigger.dataset.tooltip = "Test tooltip text";
    document.body.appendChild(trigger);

    // Simulate focusin.
    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    // The tooltip should be visible.
    const tip = document.querySelector("[id^='tm-tooltip']");
    expect(tip).not.toBeNull();
    expect(tip.classList.contains("show")).toBe(true);

    // Content is plain text, not HTML.
    expect(tip.textContent).toBe("Test tooltip text");

    // aria-describedby is set on the trigger.
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy)).toBe(tip);

    trigger.remove();
  });

  it("tooltip content is plain text -- no markdown rendering", async () => {
    const trigger = document.createElement("button");
    trigger.dataset.tooltip = "**bold** and `code` and [link](#/foo)";
    document.body.appendChild(trigger);

    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const tip = document.querySelector("[id^='tm-tooltip']");
    // Content should be the raw text, not rendered markdown.
    expect(tip.textContent).toBe("**bold** and `code` and [link](#/foo)");
    // No child elements (strong, code, a) -- just a text node.
    expect(tip.querySelector("strong")).toBeNull();
    expect(tip.querySelector("code")).toBeNull();
    expect(tip.querySelector("a")).toBeNull();

    trigger.remove();
  });

  it("tooltip hides on focusout and clears aria-describedby", async () => {
    const trigger = document.createElement("button");
    trigger.dataset.tooltip = "Test text";
    document.body.appendChild(trigger);

    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const tip = document.querySelector("[id^='tm-tooltip']");
    expect(tip.classList.contains("show")).toBe(true);

    trigger.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

    expect(tip.classList.contains("show")).toBe(false);
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);

    trigger.remove();
  });

  it("tooltip hides on Escape via kernel layer stack", async () => {
    const trigger = document.createElement("button");
    trigger.dataset.tooltip = "Escape test";
    document.body.appendChild(trigger);

    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const tip = document.querySelector("[id^='tm-tooltip']");
    expect(tip.classList.contains("show")).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(tip.classList.contains("show")).toBe(false);
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);

    trigger.remove();
  });

  it("tooltip is non-interactive (pointer-events: none in CSS)", () => {
    // The tooltip element itself should not have pointer-events set in JS.
    // CSS handles this. We verify the element does NOT have pointer-events: auto.
    const tip = ensureTooltip();
    // The JS does not set pointer-events at all -- CSS controls it.
    expect(tip.style.pointerEvents).toBe("");
  });
});
