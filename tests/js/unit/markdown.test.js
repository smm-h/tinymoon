import { describe, it, expect } from "vitest";
import { renderMiniMd } from "../../../assets/js/markdown.js";

// Characterization baseline for the inline mini-markdown dialect. This pins
// the CURRENT behavior of renderMiniMd before Phase 2 refactors touch it, so
// any accidental change to the dialect surfaces as a failing test. Note: the
// external-link behavior is deliberately NOT asserted here — that is a known
// bug pinned separately as an expected-fail in red-bugs.test.js.

function render(text) {
  const div = document.createElement("div");
  div.appendChild(renderMiniMd(text));
  return div;
}

describe("renderMiniMd dialect (characterization)", () => {
  it("renders **bold** as a <strong> element", () => {
    const div = render("**loud**");
    const strong = div.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong.textContent).toBe("loud");
  });

  it("renders *italic* as an <em> element", () => {
    const div = render("*slanted*");
    const em = div.querySelector("em");
    expect(em).not.toBeNull();
    expect(em.textContent).toBe("slanted");
  });

  it("renders `code` as a <code> element", () => {
    const div = render("`snippet`");
    const code = div.querySelector("code");
    expect(code).not.toBeNull();
    expect(code.textContent).toBe("snippet");
  });

  it("renders [label](#/x) as an anchor with that href and label", () => {
    const div = render("see [the wiki](#/wiki/view-contract) now");
    const a = div.querySelector("a.md-link");
    expect(a).not.toBeNull();
    expect(a.textContent).toBe("the wiki");
    expect(a.getAttribute("href")).toBe("#/wiki/view-contract");
    // Surrounding plain text is preserved as text nodes.
    expect(div.textContent).toBe("see the wiki now");
  });

  it("preserves plain text and mixes segments in order", () => {
    const div = render("a **b** c `d`");
    expect(div.querySelector("strong").textContent).toBe("b");
    expect(div.querySelector("code").textContent).toBe("d");
    expect(div.textContent).toBe("a b c d");
  });
});
