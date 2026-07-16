// tinymoon — iconButton: the reusable, instance-returning topbar icon button.
// Unlike copyButton/kebabButton (one-shot elements), iconButton returns an
// {el, ...} instance you can toggle and re-icon at runtime — the shape topbar
// chrome needs for stateful actions (a pinned filter, a live/paused toggle).
//
// topbarActions already accepts Nodes, so wire it in by passing the .el:
//   mountShell({ topbarActions: [iconButton({ icon: "star", tip: "Pin" }).el] })
//
// The active state uses the shared .icon-btn.on class (same as tabs/segmented)
// and mirrors aria-pressed, so it reads as a toggle button to assistive tech.

import { el } from "./dom.js";
import { icon as renderIcon } from "./icons.js";

// iconButton({icon, tip?, onClick?, active?}) → {el, setActive(bool),
// setIcon(name), destroy()}.
export function iconButton(opts) {
  if (!opts || !opts.icon) throw new Error("iconButton: icon is required");
  const { icon: iconName, tip, onClick, active = false } = opts;

  const b = el("button", "icon-btn" + (active ? " on" : ""));
  b.type = "button";
  b.innerHTML = renderIcon(iconName);
  // An icon-only button needs an accessible name: mirror tip onto aria-label
  // (data-tooltip is the visual tooltip; it is not exposed to assistive tech).
  if (tip) { b.dataset.tooltip = tip; b.setAttribute("aria-label", tip); }
  b.setAttribute("aria-pressed", String(!!active));

  const handler = onClick || null;
  if (handler) b.addEventListener("click", handler);

  function setActive(v) {
    b.classList.toggle("on", !!v);
    b.setAttribute("aria-pressed", String(!!v));
  }
  function setIcon(name) { b.innerHTML = renderIcon(name); }
  function destroy() {
    if (handler) b.removeEventListener("click", handler);
    if (b.parentNode) b.parentNode.removeChild(b);
  }

  return { el: b, setActive, setIcon, destroy };
}
