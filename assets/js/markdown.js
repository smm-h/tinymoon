// tinymoon — the inline mini-markdown dialect shared by tooltips, toasts,
// and docs.

import { el } from "./dom.js";
import { hideTip } from "./tooltip.js";
import { closePopover } from "./popover.js";

// renderMiniMd(text) → DocumentFragment. The dialect: **bold**, *italic*,
// `code`, [label](#/hash-target) links, and literal \n line breaks. Links
// are internal hash navigations only (zero network) — clicking one navigates
// and closes whatever overlay surfaced it.
export function renderMiniMd(text) {
  const frag = document.createDocumentFragment();
  const inlineRe = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  const lines = String(text).split("\n");
  lines.forEach((line, li) => {
    if (li > 0) frag.appendChild(document.createElement("br"));
    let last = 0;
    let m;
    inlineRe.lastIndex = 0;
    while ((m = inlineRe.exec(line)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(line.slice(last, m.index)));
      if (m[1] !== undefined) frag.appendChild(el("strong", null, m[1]));
      else if (m[2] !== undefined) frag.appendChild(el("em", null, m[2]));
      else if (m[3] !== undefined) frag.appendChild(el("code", null, m[3]));
      else {
        const target = m[5];
        if (!target.startsWith("#")) {
          // Non-hash targets violate the zero-network guarantee; render as
          // plain text instead of creating an anchor.
          frag.appendChild(document.createTextNode(m[4]));
        } else {
          const a = el("a", "md-link", m[4]);
          a.href = target;
          a.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            hideTip();
            closePopover();
            location.hash = target;
          });
          frag.appendChild(a);
        }
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) frag.appendChild(document.createTextNode(line.slice(last)));
  });
  return frag;
}
