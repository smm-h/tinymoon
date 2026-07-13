// tinymoon — toasts: transient notifications stacked above the footer slot.

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { copyButton } from "./controls.js";

function toastRoot() {
  let root = document.getElementById("tm-toast-root");
  if (!root) {
    root = el("div");
    root.id = "tm-toast-root";
    document.body.appendChild(root);
  }
  return root;
}

// toast(msg, kind, opts): kind "err" turns the toast red and keeps it on
// screen longer. opts.duration (ms) overrides the lifetime. Every toast
// carries a copy icon for its message text. The mount point is created
// lazily on first use.
export function toast(msg, kind, opts) {
  const t = el("div", "toast" + (kind === "err" ? " err" : ""));
  t.innerHTML = icon(kind === "err" ? "warn" : "check");
  t.appendChild(el("span", "toast-msg", msg));
  t.appendChild(copyButton(() => msg, "Copy this message"));
  toastRoot().appendChild(t);
  const life = opts && opts.duration ? opts.duration : (kind === "err" ? 5200 : 3200);
  setTimeout(() => {
    t.classList.add("fading");
    setTimeout(() => t.remove(), 300);
  }, life);
}
