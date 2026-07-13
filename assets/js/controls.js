// tinymoon — small stateful controls: copy button, toggle switch, segmented
// control, kebab menu button.

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { showCtxMenu } from "./ctxmenu.js";

// copyButton(getText, tipText) → small copy-to-clipboard icon button with a
// "Copied" flash (the icon swaps to a check for a moment).
export function copyButton(getText, tipText) {
  const b = el("button", "copy-btn");
  b.type = "button";
  b.innerHTML = icon("copy");
  b.dataset.tooltip = tipText || "Copy text to clipboard";
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(getText());
    b.innerHTML = icon("check");
    b.classList.add("copied");
    setTimeout(() => {
      if (b.isConnected) { b.innerHTML = icon("copy"); b.classList.remove("copied"); }
    }, 900);
  });
  return b;
}

// toggleWidget(value, onChange) → button.switch with .set(v).
export function toggleWidget(value, onChange) {
  const b = el("button", "switch" + (value ? " on" : ""));
  b.type = "button";
  b.setAttribute("role", "switch");
  b.appendChild(el("i"));
  b.set = (v) => { b.classList.toggle("on", !!v); b.setAttribute("aria-checked", String(!!v)); };
  b.set(value);
  b.addEventListener("click", () => {
    const v = !b.classList.contains("on");
    b.set(v);
    onChange(v);
  });
  return b;
}

// segmented({items: [{value, label, icon?, disabled?, title?}], value,
// onChange}) → .seg element with .set(v) and .value. The `title` field is a
// tooltip (data-tooltip), never a native title attribute.
export function segmented(opts) {
  const wrap = el("div", "seg");
  const btns = new Map();
  for (const it of opts.items) {
    const b = el("button");
    b.type = "button";
    if (it.icon) b.innerHTML = icon(it.icon);
    b.appendChild(el("span", null, it.label));
    if (it.disabled) b.disabled = true;
    if (it.title) b.dataset.tooltip = it.title;
    b.addEventListener("click", () => { wrap.set(it.value); opts.onChange(it.value); });
    btns.set(it.value, b);
    wrap.appendChild(b);
  }
  wrap.set = (v) => {
    wrap.value = v;
    for (const [val, b] of btns) b.classList.toggle("on", val === v);
  };
  wrap.set(opts.value);
  return wrap;
}

// kebabButton(itemsFn, tip?) → a three-vertical-dots button. Clicking it
// opens the shared custom context-menu dropdown anchored under the button
// with itemsFn()'s entries — never a native menu.
export function kebabButton(itemsFn, tip) {
  const b = el("button", "icon-btn kebab");
  b.type = "button";
  b.innerHTML = icon("kebab");
  b.dataset.tooltip = tip || "More actions";
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    const r = b.getBoundingClientRect();
    showCtxMenu(Math.max(8, r.right - 210), r.bottom + 4, itemsFn());
  });
  return b;
}
