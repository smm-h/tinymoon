// tinymoon — mini-wiki builder: one long page of linkable doc sections plus
// a sticky table of contents. Content is authored as JS template literals
// (zero network) in a small markdown dialect and rendered to DOM.

import { $$, el } from "./dom.js";
import { renderMiniMd } from "./markdown.js";

// renderDocMd(md) → .doc-body node. The block dialect:
//   - paragraphs separated by blank lines
//   - "### Sub {#anchor}" subheadings
//   - "- " bullet lists
//   - ``` fenced code blocks: everything between a line that starts with ```
//     and the next such line is rendered VERBATIM into a <pre><code> (no inline
//     markdown, no escaping surprises). An info string after the opening fence
//     (```js) is accepted and ignored — syntax highlighting is out of scope.
//   - the shared inline dialect (renderMiniMd) inside paragraphs, list items,
//     and subheadings.
// NOT supported (by design): tables, blockquotes, ATX headings other than
// "###", ordered lists, and inline HTML. Author those as plain paragraphs or
// bullet lists instead.
export function renderDocMd(md) {
  const box = el("div", "doc-body");
  const lines = md.split("\n");
  let para = [];
  let list = null;
  // While inside a fenced block, `code` accumulates the verbatim lines; it is
  // null outside a fence.
  let code = null;
  const flush = () => {
    if (list) { box.appendChild(list); list = null; }
    if (para.length) {
      const p = el("p");
      p.appendChild(renderMiniMd(para.join(" ")));
      box.appendChild(p);
      para = [];
    }
  };
  const flushCode = () => {
    const pre = el("pre", "doc-code");
    const codeEl = el("code");
    codeEl.textContent = code.join("\n");
    pre.appendChild(codeEl);
    box.appendChild(pre);
    code = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    // Fenced code blocks: a line starting with ``` opens/closes a verbatim
    // block. Inside one, every line is kept as-is (no inline parsing).
    const isFence = line.trimStart().startsWith("```");
    if (code !== null) {
      if (isFence) flushCode();
      else code.push(raw);
      continue;
    }
    if (isFence) { flush(); code = []; continue; }
    if (!line.trim()) { flush(); continue; }
    const h = line.match(/^### (.+?)(?:\s*\{#([^}]+)\})?$/);
    if (h) {
      flush();
      const h4 = el("h4", "doc-sub");
      h4.appendChild(renderMiniMd(h[1]));
      if (h[2]) h4.dataset.anchor = h[2];
      box.appendChild(h4);
      continue;
    }
    if (line.startsWith("- ")) {
      if (para.length) flush();
      if (!list) list = el("ul", "doc-list");
      const li = el("li");
      li.appendChild(renderMiniMd(line.slice(2)));
      list.appendChild(li);
      continue;
    }
    para.push(line.trim());
  }
  // An unterminated fence still renders its collected lines as a code block.
  if (code !== null) flushCode();
  flush();
  return box;
}

// createWikiView({route, sections}) → a view conforming to the shell's view
// contract. route is the hash key the view is mounted under (anchors become
// "#/<route>/<anchor>"); sections is [{id, title, md}] or a function
// returning it (anchors are stable API — tooltips elsewhere may link to
// them). Deep links (#/<route>/<anchor>) highlight the TOC entry and scroll
// the section into view.
export function createWikiView({ route, sections } = {}) {
  if (!route) throw new Error("createWikiView: route is required");
  if (!sections) throw new Error("createWikiView: sections is required");

  return {
    root: null,
    built: false,
    // Persistent: the currently active anchor (for TOC highlight on refresh).
    _anchor: "",
    // One-shot: set by setSub, consumed by refresh to scroll into view.
    _pendingScroll: "",

    build() {
      if (this.built) return;
      this.built = true;
      const layout = el("div", "docs-layout");

      // Sticky table of contents (in-page navigation).
      this.toc = el("nav", "docs-toc");
      this.toc.appendChild(el("div", "docs-toc-head", "Contents"));

      this.main = el("div", "docs-main");
      const secs = typeof sections === "function" ? sections() : sections;
      for (const sec of secs) {
        const s = el("section", "doc-section");
        s.dataset.anchor = sec.id;
        const h = el("h2", "doc-title", sec.title);
        // Heading click copies a deep link by navigating to it (linkable
        // anchors — the hash is shareable).
        h.dataset.tooltip = "Anchor: `#/" + route + "/" + sec.id + "` — click to set the address bar to this section's deep link.";
        h.addEventListener("click", () => { location.hash = "#/" + route + "/" + sec.id; });
        s.appendChild(h);
        s.appendChild(renderDocMd(sec.md));
        this.main.appendChild(s);

        const t = el("button", "docs-toc-item");
        t.dataset.anchor = sec.id;
        t.textContent = sec.title;
        t.addEventListener("click", () => { location.hash = "#/" + route + "/" + sec.id; });
        this.toc.appendChild(t);
        // Subsection TOC entries (### {#anchor} headings).
        for (const sub of $$("[data-anchor]", s)) {
          if (sub === s || !sub.classList.contains("doc-sub")) continue;
          const st = el("button", "docs-toc-item sub");
          st.dataset.anchor = sub.dataset.anchor;
          st.textContent = sub.textContent;
          st.addEventListener("click", () => { location.hash = "#/" + route + "/" + sub.dataset.anchor; });
          this.toc.appendChild(st);
        }
      }

      layout.appendChild(this.main);
      layout.appendChild(this.toc);
      this.root.appendChild(layout);
    },

    setSub(sub) {
      this._anchor = sub;
      this._pendingScroll = sub;
    },

    refresh() {
      // Highlight the TOC entry for the current anchor (persists across
      // refreshCurrent() calls — not cleared after use).
      $$(".docs-toc-item", this.toc).forEach((t) =>
        t.classList.toggle("active", t.dataset.anchor === this._anchor));
      // Scroll only on first visit to this anchor (one-shot).
      if (this._pendingScroll) {
        const target = this.main.querySelector('[data-anchor="' + CSS.escape(this._pendingScroll) + '"]');
        if (target) target.scrollIntoView({ block: "start" });
        this._pendingScroll = "";
      }
    },
  };
}
