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

let errorHook = null;

// setToastErrorHook(fn): register a module-level hook invoked as
// fn(message, opts) whenever an error toast is shown — e.g. to mirror errors
// into a log. opts is the same opts object toast() received ({} when the
// caller passed none, never undefined), so per-call metadata reaches the hook.
// Registering a second hook is a hard error, never a silent overwrite.
export function setToastErrorHook(fn) {
  if (errorHook) throw new Error("setToastErrorHook: a hook is already registered");
  errorHook = fn;
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
    // Coupled with .toast.fading in primitives.css: its 180ms transition
    // must stay shorter than this removal delay.
    setTimeout(() => t.remove(), 200);
  }, life);
  // After the toast is on screen (and its removal is scheduled, so a
  // throwing hook can't strand it). Hook exceptions propagate.
  if (kind === "err" && errorHook) errorHook(msg, opts || {});
}
