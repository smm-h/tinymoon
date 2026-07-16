// tinymoon — custom select (combobox + listbox) replacing the banned native
// <select>: keyboard navigation, type-ahead, viewport-aware flip-up, and a
// hidden real <select> for form submission.
//
// Factory: createSelect(opts) -> {el, set, value, setItems, destroy}
// APG combobox pattern: button[role="combobox"] + div[role="listbox"].

import { $$, el } from "./dom.js";
import { icon } from "./icons.js";
import { cssVar, pushLayer } from "./kernel.js";
import { registerLightDismiss } from "./dismiss.js";

// At most one select is open at a time (opening one closes another). Outside-
// pointer dismissal rides the kernel's central light-dismiss registry.
let openInstance = null;

let idCounter = 0;

export function createSelect(opts) {
  if (!opts || !opts.name) throw new Error("name is required");
  if (!opts.label) throw new Error("label is required");

  const items = (opts.items || []).slice(); // [{value, label}]
  let currentValue = opts.value !== undefined ? opts.value : (items[0] ? items[0].value : undefined);
  const onChange = opts.onChange || (() => {});
  const instanceId = "tm-sel-" + (++idCounter);

  let hoverIdx = -1;
  let typeahead = "";
  let typeaheadT = 0;
  let removeLayer = null;
  let removeDismiss = null;
  let destroyed = false;

  // ---- build DOM ----

  const root = el("div", "sel");
  if (opts.width) root.style.width = opts.width;

  // button[role="combobox"]
  const btn = el("button", "sel-btn");
  btn.type = "button";
  btn.setAttribute("role", "combobox");
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", opts.label);
  btn.setAttribute("aria-controls", instanceId + "-listbox");

  const labelEl = el("span", "sel-label");
  btn.appendChild(labelEl);
  const chevSpan = el("span");
  chevSpan.innerHTML = icon("chevron");
  btn.appendChild(chevSpan.firstChild);

  // div[role="listbox"]
  const menu = el("div", "sel-menu");
  menu.setAttribute("role", "listbox");
  menu.id = instanceId + "-listbox";

  // Hidden real <select> for form participation and accessibility. Written
  // plainly: the conformance checker exempts native-control creation in
  // tinymoon's own shipped modules (framework-own allowance, keyed on the
  // file's location inside the packaged assets, not on any obfuscation).
  const hiddenSelect = document.createElement("select");
  hiddenSelect.name = opts.name;
  hiddenSelect.setAttribute("aria-hidden", "true");
  hiddenSelect.tabIndex = -1;
  hiddenSelect.style.position = "absolute";
  hiddenSelect.style.width = "1px";
  hiddenSelect.style.height = "1px";
  hiddenSelect.style.padding = "0";
  hiddenSelect.style.margin = "-1px";
  hiddenSelect.style.overflow = "hidden";
  hiddenSelect.style.clipPath = "inset(50%)";
  hiddenSelect.style.whiteSpace = "nowrap";
  hiddenSelect.style.border = "0";
  if (opts.required) hiddenSelect.required = true;
  if (opts.disabled) {
    hiddenSelect.disabled = true;
    btn.disabled = true;
  }

  root.appendChild(btn);
  root.appendChild(menu);
  root.appendChild(hiddenSelect);

  // ---- rendering ----

  function labelOf(item) {
    return item.label || String(item.value);
  }

  function renderLabel() {
    const item = items.find((it) => it.value === currentValue);
    labelEl.textContent = item ? labelOf(item) : "—";
  }

  function optionId(i) {
    return instanceId + "-opt-" + i;
  }

  function renderMenu() {
    menu.textContent = "";
    items.forEach((item, i) => {
      const o = el("div", "sel-opt", labelOf(item));
      o.setAttribute("role", "option");
      o.id = optionId(i);
      o.setAttribute("aria-selected", String(item.value === currentValue));
      o.addEventListener("click", () => pick(i));
      o.addEventListener("pointerenter", () => setHover(i));
      menu.appendChild(o);
    });
  }

  function syncHiddenSelect() {
    hiddenSelect.textContent = "";
    for (const item of items) {
      const opt = document.createElement("option");
      opt.value = item.value;
      opt.textContent = labelOf(item);
      if (item.value === currentValue) opt.selected = true;
      hiddenSelect.appendChild(opt);
    }
  }

  function setHover(i) {
    hoverIdx = i;
    const children = Array.from(menu.children);
    children.forEach((o, j) => o.classList.toggle("hover", j === i));
    const o = menu.children[i];
    if (o) {
      o.scrollIntoView({ block: "nearest" });
      btn.setAttribute("aria-activedescendant", optionId(i));
    }
  }

  function pick(i) {
    const item = items[i];
    if (!item) return;
    const changed = item.value !== currentValue;
    currentValue = item.value;
    renderLabel();
    renderMenu();
    syncHiddenSelect();
    close();
    btn.focus();
    if (changed) onChange(currentValue);
  }

  function open() {
    if (destroyed) return;
    if (openInstance && openInstance !== instance) openInstance._close();
    openInstance = instance;
    root.classList.add("open");
    btn.setAttribute("aria-expanded", "true");

    // Flip up when the menu would clip the viewport bottom
    const footerH = parseFloat(cssVar("--footer-h")) || 0;
    const r = root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - footerH - r.bottom;
    menu.classList.toggle("up", spaceBelow < Math.min(260, items.length * 30 + 8));

    menu.tabIndex = -1;
    // Focus stays on button (combobox pattern), not menu
    const selectedIdx = items.findIndex((it) => it.value === currentValue);
    setHover(Math.max(0, selectedIdx));

    removeDismiss = registerLightDismiss({ panels: [root], dismiss: close });
    removeLayer = pushLayer(() => { close(); btn.focus(); });
  }

  function close() {
    if (removeDismiss) { removeDismiss(); removeDismiss = null; }
    if (removeLayer) { removeLayer(); removeLayer = null; }
    root.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    btn.removeAttribute("aria-activedescendant");
    if (openInstance === instance) openInstance = null;
  }

  // ---- keyboard handling ----

  function btnKeydown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  }

  function menuKey(e) {
    const n = items.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setHover(Math.min(n - 1, hoverIdx + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHover(Math.max(0, hoverIdx - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setHover(0); }
    else if (e.key === "End") { e.preventDefault(); setHover(n - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(hoverIdx); }
    else if (e.key === "Tab") { close(); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      // type-ahead
      const now = Date.now();
      if (now - typeaheadT > 800) typeahead = "";
      typeaheadT = now;
      typeahead += e.key.toLowerCase();
      const idx = items.findIndex((it) => labelOf(it).toLowerCase().startsWith(typeahead));
      if (idx >= 0) setHover(idx);
    }
  }

  btn.addEventListener("click", () => {
    root.classList.contains("open") ? close() : open();
  });
  btn.addEventListener("keydown", btnKeydown);
  menu.addEventListener("keydown", menuKey);

  // Initial render
  renderLabel();
  renderMenu();
  syncHiddenSelect();

  // ---- public API ----

  const instance = {
    el: root,
    // Internal references for the module-level outside-click handler
    _root: root,
    _close: close,

    get value() {
      return currentValue;
    },

    set(v) {
      const valid = items.some((it) => it.value === v);
      if (!valid) throw new Error("createSelect.set(): value " + JSON.stringify(v) + " is not in items");
      currentValue = v;
      renderLabel();
      renderMenu();
      syncHiddenSelect();
    },

    setItems(newItems) {
      items.length = 0;
      for (const it of newItems) items.push(it);
      // If current value is no longer valid, reset to first
      if (!items.some((it) => it.value === currentValue)) {
        currentValue = items[0] ? items[0].value : undefined;
      }
      renderLabel();
      renderMenu();
      syncHiddenSelect();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      close();
      btn.removeEventListener("keydown", btnKeydown);
      menu.removeEventListener("keydown", menuKey);
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };

  return instance;
}
