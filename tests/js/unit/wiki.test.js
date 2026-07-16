import { describe, it, expect } from "vitest";
import { renderDocMd } from "../../../assets/js/wiki.js";

// Unit tests for the renderDocMd BLOCK dialect, focused on the fenced code-block
// support. The inline dialect (renderMiniMd) is characterized separately in
// markdown.test.js; here we pin the block-level constructs and, in particular,
// that ``` fences render verbatim <pre><code> with no inline parsing.

describe("renderDocMd block dialect", () => {
  it("renders a fenced ``` block as a verbatim <pre><code>", () => {
    const md = "Intro paragraph.\n\n```\nconst x = **not bold**;\nline two\n```\n\nAfter.";
    const box = renderDocMd(md);
    const pre = box.querySelector("pre.doc-code");
    expect(pre).not.toBeNull();
    const code = pre.querySelector("code");
    expect(code).not.toBeNull();
    // Verbatim: the **not bold** is NOT turned into a <strong>, and the two
    // lines are preserved with their newline.
    expect(code.textContent).toBe("const x = **not bold**;\nline two");
    expect(code.querySelector("strong")).toBeNull();
    // Surrounding paragraphs still render.
    const ps = box.querySelectorAll("p");
    expect(ps[0].textContent).toContain("Intro paragraph.");
    expect(ps[ps.length - 1].textContent).toContain("After.");
  });

  it("accepts and ignores an info string after the opening fence", () => {
    const md = "```js\nlet y = 1;\n```";
    const box = renderDocMd(md);
    const code = box.querySelector("pre.doc-code code");
    // The `js` info string is not rendered into the block content.
    expect(code.textContent).toBe("let y = 1;");
  });

  it("preserves indentation inside the fenced block", () => {
    const md = "```\n  indented\n    more\n```";
    const code = renderDocMd(md).querySelector("pre.doc-code code");
    expect(code.textContent).toBe("  indented\n    more");
  });

  it("renders an unterminated fence as a code block anyway", () => {
    const md = "```\ndangling code";
    const code = renderDocMd(md).querySelector("pre.doc-code code");
    expect(code.textContent).toBe("dangling code");
  });

  it("still renders paragraphs, ### subheadings, and - bullet lists", () => {
    const md = "A para.\n\n### Section {#sec}\n\n- one\n- two";
    const box = renderDocMd(md);
    expect(box.querySelector("p").textContent).toContain("A para.");
    const sub = box.querySelector(".doc-sub");
    expect(sub.textContent).toContain("Section");
    expect(sub.dataset.anchor).toBe("sec");
    const items = box.querySelectorAll(".doc-list li");
    expect([...items].map((li) => li.textContent)).toEqual(["one", "two"]);
  });
});
