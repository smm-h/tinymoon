// tinymoon — modal dialog built on a native <dialog> element. showModal()
// provides focus trap, background inert, Escape dismiss, and ::backdrop
// styling for free. A JS light-dismiss shim handles backdrop clicks (Safari
// lacks closedby). Each open creates a fresh dialog — no cached root.

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { pushLayer } from "./kernel.js";

let idCounter = 0;

// The currently open modal's close(), so opening over an open modal can run
// the previous modal's full close (listeners removed, its onClose fired).
let currentClose = null;

// openModal({title, body, actions, onClose}) → close(). body is a string or
// a node; actions is an optional array of footer buttons. Closes on Escape,
// the close button, a backdrop click, or the returned function. Opening
// while a modal is already open closes the previous one first.
export function openModal({ title, body, actions, onClose }) {
  if (currentClose) currentClose();

  const titleId = "tm-modal-title-" + (++idCounter);
  const dialog = document.createElement("dialog");
  dialog.className = "tm-modal";
  dialog.setAttribute("aria-labelledby", titleId);

  const head = el("div", "modal-head");
  const h3 = el("h3", null, title);
  h3.id = titleId;
  head.appendChild(h3);
  const x = el("button", "icon-btn");
  x.innerHTML = icon("close");
  x.setAttribute("aria-label", "Close");
  x.dataset.tooltip = "Close (Esc)";
  head.appendChild(x);
  dialog.appendChild(head);

  const b = el("div", "modal-body");
  if (typeof body === "string") b.textContent = body;
  else b.appendChild(body);
  dialog.appendChild(b);

  if (actions && actions.length) {
    const foot = el("div", "modal-foot");
    for (const a of actions) foot.appendChild(a);
    dialog.appendChild(foot);
  }

  // Capture the element that had focus before opening so we can restore it.
  const previousFocus = document.activeElement;

  document.body.appendChild(dialog);
  dialog.showModal();

  let removeLayer = null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (currentClose === close) currentClose = null;
    if (removeLayer) { removeLayer(); removeLayer = null; }
    dialog.close();
    dialog.remove();
    dialog.removeEventListener("pointerdown", onDown);
    dialog.removeEventListener("cancel", onCancel);
    // Restore focus to the element that was focused before the modal opened.
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
    if (onClose) onClose();
  };

  // Light-dismiss shim: a click on the dialog element itself (not its
  // children) means the user clicked the ::backdrop area. This is the
  // standard pattern since the dialog's padding box does not cover the
  // backdrop — event.target === dialog only for backdrop clicks.
  const onDown = (e) => { if (e.target === dialog) close(); };
  dialog.addEventListener("pointerdown", onDown);

  // The native <dialog> fires a "cancel" event on Escape. We intercept it
  // so our close() runs the full teardown (layer removal, focus restore,
  // onClose callback) instead of the browser's bare dialog.close().
  const onCancel = (e) => { e.preventDefault(); close(); };
  dialog.addEventListener("cancel", onCancel);

  x.addEventListener("click", close);
  removeLayer = pushLayer(() => close());
  currentClose = close;
  return close;
}
