import { describe, it, expect, vi } from "vitest";
import { iconButton } from "../../../assets/js/iconbutton.js";

describe("iconButton", () => {
  it("requires an icon", () => {
    expect(() => iconButton({})).toThrow(/icon/);
  });

  it("builds an icon-btn with tooltip and aria-pressed reflecting active", () => {
    const b = iconButton({ icon: "close", tip: "Close panel", active: true });
    expect(b.el.tagName).toBe("BUTTON");
    expect(b.el.classList.contains("icon-btn")).toBe(true);
    expect(b.el.classList.contains("on")).toBe(true);
    expect(b.el.getAttribute("aria-pressed")).toBe("true");
    expect(b.el.dataset.tooltip).toBe("Close panel");
    expect(b.el.querySelector("svg")).not.toBeNull();
  });

  it("defaults to inactive", () => {
    const b = iconButton({ icon: "close" });
    expect(b.el.classList.contains("on")).toBe(false);
    expect(b.el.getAttribute("aria-pressed")).toBe("false");
  });

  it("setActive toggles the .on class and aria-pressed", () => {
    const b = iconButton({ icon: "close" });
    b.setActive(true);
    expect(b.el.classList.contains("on")).toBe(true);
    expect(b.el.getAttribute("aria-pressed")).toBe("true");
    b.setActive(false);
    expect(b.el.classList.contains("on")).toBe(false);
    expect(b.el.getAttribute("aria-pressed")).toBe("false");
  });

  it("setIcon swaps the rendered svg", () => {
    const b = iconButton({ icon: "close" });
    const before = b.el.innerHTML;
    b.setIcon("check");
    expect(b.el.innerHTML).not.toBe(before);
    expect(b.el.querySelector("svg")).not.toBeNull();
  });

  it("fires onClick and destroy removes the listener + node", () => {
    const onClick = vi.fn();
    const b = iconButton({ icon: "close", onClick });
    document.body.appendChild(b.el);
    b.el.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    b.destroy();
    expect(b.el.isConnected).toBe(false);
    // Detached node; clicking a fresh clone should not call the handler again.
    b.el.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
