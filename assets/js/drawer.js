// tinymoon — openDrawer: an edge-anchored overlay panel on the kernel layer
// stack. Two variants share one API:
//   modal: false (default) — a light-dismiss drawer. Escape (via the kernel
//     layer stack) or an outside pointerdown closes it; the page behind stays
//     interactive. role="dialog" aria-modal="false".
//   modal: true — a native <dialog> (showModal): focus trap, background inert,
//     and a dimmed ::backdrop for free, exactly like openModal.
//
// Both restore focus to the previously-focused element on close and slide in
// from `side` ("right" default | "left") using motion tokens (reduced-motion
// safe via the global suppression in base.css).

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { pushLayer, ensureRoot } from "./kernel.js";

let idCounter = 0;

// openDrawer({title, body, side?, modal?, onClose?}) → {el, close()}.
export function openDrawer({ title, body, side = "right", modal = false, onClose }) {
  const titleId = "tm-drawer-title-" + (++idCounter);
  const previousFocus = document.activeElement;

  // ---- build the panel (a <dialog> when modal, a <div> otherwise) ----
  const tag = modal ? "dialog" : "div";
  const panel = document.createElement(tag);
  panel.className = "tm-drawer tm-drawer-" + side + (modal ? " tm-drawer-modal" : "");
  panel.setAttribute("aria-labelledby", titleId);
  if (!modal) {
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
  }

  const head = el("div", "tm-drawer-head");
  const h3 = el("h3", null, title);
  h3.id = titleId;
  head.appendChild(h3);
  const x = el("button", "icon-btn");
  x.type = "button";
  x.innerHTML = icon("close");
  x.setAttribute("aria-label", "Close");
  x.dataset.tooltip = "Close (Esc)";
  head.appendChild(x);
  panel.appendChild(head);

  const b = el("div", "tm-drawer-body");
  if (typeof body === "string") b.textContent = body;
  else if (body) b.appendChild(body);
  panel.appendChild(b);

  // ---- mount ----
  if (modal) {
    document.body.appendChild(panel);
    panel.showModal();
  } else {
    ensureRoot("tm-drawer-root").appendChild(panel);
  }
  // Slide in on the next frame so the initial off-screen transform paints first.
  requestAnimationFrame(() => panel.classList.add("open"));

  let removeLayer = null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (removeLayer) { removeLayer(); removeLayer = null; }
    if (!modal) document.removeEventListener("pointerdown", onOutside, true);
    if (modal) {
      panel.removeEventListener("cancel", onCancel);
      panel.removeEventListener("pointerdown", onModalDown);
      panel.close();
    }
    panel.remove();
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    if (onClose) onClose();
  };

  // Non-modal: an outside pointerdown light-dismisses. Registered in the capture
  // phase and on a later tick so the click that opened the drawer is not caught.
  const onOutside = (e) => { if (!panel.contains(e.target)) close(); };
  if (!modal) {
    setTimeout(() => document.addEventListener("pointerdown", onOutside, true), 0);
  }

  // Modal: the native cancel (Escape) and a backdrop pointerdown both close.
  const onCancel = (e) => { e.preventDefault(); close(); };
  const onModalDown = (e) => { if (e.target === panel) close(); };
  if (modal) {
    panel.addEventListener("cancel", onCancel);
    panel.addEventListener("pointerdown", onModalDown);
  }

  x.addEventListener("click", close);
  removeLayer = pushLayer(() => close());

  // Focus the close button so keyboard users land inside the drawer.
  x.focus();

  return { el: panel, close };
}

// swipeToClose(panel, onClose, {edge}) — pointer-drag dismissal for an edge
// drawer. A drag AWAY from `edge` ("left" | "right") past a small threshold
// fires onClose. Reused by the shell's mobile nav drawer. Returns a teardown.
export function swipeToClose(panel, onClose, opts) {
  const edge = (opts && opts.edge) || "left";
  const threshold = (opts && opts.threshold) || 50;
  let x0 = null;
  const down = (e) => { x0 = e.clientX; };
  const up = (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (edge === "left" ? dx < -threshold : dx > threshold) onClose();
  };
  panel.addEventListener("pointerdown", down);
  panel.addEventListener("pointerup", up);
  return () => {
    panel.removeEventListener("pointerdown", down);
    panel.removeEventListener("pointerup", up);
  };
}
