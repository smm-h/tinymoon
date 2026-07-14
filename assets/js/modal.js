// tinymoon — modal dialog over a blurred backdrop.

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { pushLayer, ensureRoot } from "./kernel.js";

// The currently open modal's close(), so opening over an open modal can run
// the previous modal's full close (listeners removed, its onClose fired).
let currentClose = null;

// openModal({title, body, actions, onClose}) → close(). body is a string or
// a node; actions is an optional array of footer buttons. Closes on Escape,
// the close button, a backdrop click, or the returned function. Opening
// while a modal is already open closes the previous one first.
export function openModal({ title, body, actions, onClose }) {
  if (currentClose) currentClose();
  const root = ensureRoot("tm-modal-root");
  root.textContent = "";
  const m = el("div", "modal");
  const head = el("div", "modal-head");
  head.appendChild(el("h3", null, title));
  const x = el("button", "icon-btn");
  x.innerHTML = icon("close");
  x.dataset.tooltip = "Close (Esc)";
  head.appendChild(x);
  m.appendChild(head);
  const b = el("div", "modal-body");
  if (typeof body === "string") b.textContent = body;
  else b.appendChild(body);
  m.appendChild(b);
  if (actions && actions.length) {
    const foot = el("div", "modal-foot");
    for (const a of actions) foot.appendChild(a);
    m.appendChild(foot);
  }
  root.appendChild(m);
  root.classList.add("open");

  let removeLayer = null;
  const close = () => {
    if (currentClose === close) currentClose = null;
    if (removeLayer) { removeLayer(); removeLayer = null; }
    root.classList.remove("open");
    root.textContent = "";
    root.removeEventListener("pointerdown", onDown);
    if (onClose) onClose();
  };
  const onDown = (e) => { if (e.target === root) close(); };
  root.addEventListener("pointerdown", onDown);
  x.addEventListener("click", close);
  removeLayer = pushLayer(() => close());
  currentClose = close;
  return close;
}
