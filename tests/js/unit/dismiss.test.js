import { describe, it, expect, vi, beforeEach } from "vitest";

// Light-dismiss engine + declarative overlay-trigger invoker (dismiss.js).
// Each test gets a fresh module so the persistent capture-phase listener and
// the LIFO layer stack start empty.

let registerLightDismiss, registerOverlayTrigger;

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = "";
  const mod = await import("../../../assets/js/dismiss.js");
  registerLightDismiss = mod.registerLightDismiss;
  registerOverlayTrigger = mod.registerOverlayTrigger;
});

function mount(tag = "div") {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function pointerdown(el) {
  el.dispatchEvent(new Event("pointerdown", { bubbles: true }));
}

function click(el) {
  const e = new Event("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
}

// ---------------------------------------------------------------------------
// LIFO dismissal — only the topmost layer is consulted
// ---------------------------------------------------------------------------

describe("registerLightDismiss — LIFO", () => {
  it("an outside press dismisses only the topmost layer", () => {
    const panelA = mount();
    const panelB = mount();
    const dA = vi.fn();
    const dB = vi.fn();
    registerLightDismiss({ panels: [panelA], dismiss: dA });
    registerLightDismiss({ panels: [panelB], dismiss: dB });

    // Press somewhere outside both panels: topmost (B) dismisses, A untouched.
    pointerdown(document.body);
    expect(dB).toHaveBeenCalledTimes(1);
    expect(dA).not.toHaveBeenCalled();
  });

  it("a press inside the topmost panel dismisses nothing", () => {
    const panel = mount();
    const inner = document.createElement("span");
    panel.appendChild(inner);
    const dismiss = vi.fn();
    registerLightDismiss({ panels: [panel], dismiss });

    pointerdown(inner); // descendant of the panel — inside
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("unregister removes the layer so the one below becomes topmost", () => {
    const panelA = mount();
    const panelB = mount();
    const dA = vi.fn();
    const dB = vi.fn();
    registerLightDismiss({ panels: [panelA], dismiss: dA });
    const removeB = registerLightDismiss({ panels: [panelB], dismiss: dB });

    removeB();
    pointerdown(document.body);
    expect(dB).not.toHaveBeenCalled();
    expect(dA).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the stack is empty", () => {
    expect(() => pointerdown(document.body)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Nested overlays — opening a nested overlay must not dismiss its opener
// ---------------------------------------------------------------------------

describe("registerLightDismiss — nested overlays", () => {
  it("a press inside a nested (topmost) panel dismisses neither it nor its opener", () => {
    const opener = mount();
    const nested = document.createElement("div"); // DOM-nested inside the opener
    opener.appendChild(nested);
    const dOpener = vi.fn();
    const dNested = vi.fn();
    registerLightDismiss({ panels: [opener], dismiss: dOpener });
    registerLightDismiss({ panels: [nested], dismiss: dNested });

    pointerdown(nested);
    expect(dNested).not.toHaveBeenCalled();
    expect(dOpener).not.toHaveBeenCalled();
  });

  it("a press in the opener but outside the nested panel closes only the nested (topmost)", () => {
    const opener = mount();
    const openerOnly = document.createElement("span");
    opener.appendChild(openerOnly);
    const nested = mount(); // mounted elsewhere (like a body-appended menu)
    const dOpener = vi.fn();
    const dNested = vi.fn();
    registerLightDismiss({ panels: [opener], dismiss: dOpener });
    registerLightDismiss({ panels: [nested], dismiss: dNested });

    pointerdown(openerOnly);
    expect(dNested).toHaveBeenCalledTimes(1);
    expect(dOpener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Gesture-claim — a press on the trigger dismisses AND suppresses the reopen click
// ---------------------------------------------------------------------------

describe("registerLightDismiss — trigger gesture-claim", () => {
  it("pressing the trigger dismisses and suppresses the trailing click on it", () => {
    const panel = mount();
    const trigger = mount("button");
    const dismiss = vi.fn();
    const triggerClick = vi.fn();
    trigger.addEventListener("click", triggerClick);
    registerLightDismiss({ panels: [panel], dismiss, trigger });

    pointerdown(trigger);
    expect(dismiss).toHaveBeenCalledTimes(1);

    // The trailing click is swallowed (stopImmediatePropagation + preventDefault),
    // so the trigger's own click handler never runs → no close-then-reopen.
    const e = click(trigger);
    expect(e.defaultPrevented).toBe(true);
    expect(triggerClick).not.toHaveBeenCalled();
  });

  it("the suppressor is one-shot: a second click on the trigger passes through", () => {
    const panel = mount();
    const trigger = mount("button");
    registerLightDismiss({ panels: [panel], dismiss: () => {}, trigger });

    pointerdown(trigger);
    click(trigger); // consumes the one-shot
    const second = click(trigger);
    expect(second.defaultPrevented).toBe(false);
  });

  it("an unrelated click stays armed so the trigger click is still suppressed", () => {
    const panel = mount();
    const trigger = mount("button");
    const other = mount("button");
    registerLightDismiss({ panels: [panel], dismiss: () => {}, trigger });

    pointerdown(trigger);
    const otherClick = click(other); // unrelated — must pass through, stay armed
    expect(otherClick.defaultPrevented).toBe(false);
    const triggerClick = click(trigger);
    expect(triggerClick.defaultPrevented).toBe(true);
  });

  it("accepts a set of triggers; a press on any one claims the gesture", () => {
    const panel = mount();
    const t1 = mount("button");
    const t2 = mount("button");
    const dismiss = vi.fn();
    registerLightDismiss({ panels: [panel], dismiss, trigger: [t1, t2] });

    pointerdown(t2);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(click(t2).defaultPrevented).toBe(true);
  });

  it("a press outside both panel and trigger dismisses without claiming", () => {
    const panel = mount();
    const trigger = mount("button");
    const outside = mount("button");
    const outsideClick = vi.fn();
    outside.addEventListener("click", outsideClick);
    registerLightDismiss({ panels: [panel], dismiss: () => {}, trigger });

    pointerdown(outside);
    // No gesture claimed for a non-trigger press: the outside click runs normally.
    click(outside);
    expect(outsideClick).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// registerOverlayTrigger — declarative invoker contract
// ---------------------------------------------------------------------------

describe("registerOverlayTrigger", () => {
  it("owns the click handler: opens when closed, closes when open", () => {
    const trigger = mount("button");
    const close = vi.fn();
    let opens = 0;
    registerOverlayTrigger(trigger, () => { opens++; return { close }; });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    click(trigger); // open
    expect(opens).toBe(1);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    click(trigger); // close
    expect(close).toHaveBeenCalledTimes(1);
    expect(opens).toBe(1);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("sets aria-controls when the overlay element has an id, and clears it on close", () => {
    const trigger = mount("button");
    const overlay = document.createElement("div");
    overlay.id = "ov-1";
    registerOverlayTrigger(trigger, () => ({ el: overlay, close() {} }));

    click(trigger);
    expect(trigger.getAttribute("aria-controls")).toBe("ov-1");
    click(trigger);
    expect(trigger.hasAttribute("aria-controls")).toBe(false);
  });

  it("passes onClose so an external close resets the trigger state", () => {
    const trigger = mount("button");
    let onCloseRef = null;
    registerOverlayTrigger(trigger, ({ onClose }) => {
      onCloseRef = onClose;
      return { close() {} };
    });

    click(trigger); // open
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    onCloseRef(); // simulate Escape / outside dismiss
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // State was reset, so the next click opens fresh rather than toggling closed.
    click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("hard-errors on double-registering the same element", () => {
    const trigger = mount("button");
    registerOverlayTrigger(trigger, () => ({ close() {} }));
    expect(() => registerOverlayTrigger(trigger, () => ({ close() {} }))).toThrow(
      /already registered/,
    );
  });

  it("unregister removes the click handler and frees the element to re-register", () => {
    const trigger = mount("button");
    let opens = 0;
    const off = registerOverlayTrigger(trigger, () => { opens++; return { close() {} }; });
    off();
    click(trigger); // handler removed — nothing opens
    expect(opens).toBe(0);
    // Freed: re-registering the same element no longer throws.
    expect(() => registerOverlayTrigger(trigger, () => ({ close() {} }))).not.toThrow();
  });
});
