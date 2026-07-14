import { describe, it, expect } from "vitest";
import { el } from "../../../assets/js/dom.js";

// Smoke test: the element factory that every other module builds with must
// produce a real DOM node with the requested tag, class, and text.
describe("dom.el", () => {
  it("creates an element with tag, class, and text", () => {
    const node = el("div", "demo", "hello");
    expect(node.tagName).toBe("DIV");
    expect(node.className).toBe("demo");
    expect(node.textContent).toBe("hello");
  });
});
