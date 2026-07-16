// tinymoon -- typeahead combobox and multi-select, siblings of createSelect.
// Both follow the APG combobox pattern (input[role="combobox"] + a
// [role="listbox"] popup) and both participate in forms through a hidden native
// element. createCombobox commits a single value through a hidden input;
// createMultiSelect commits many through a hidden <select multiple> and renders
// its selection as sharp, removable chips.
//
// Async results: onFilter(query) may return items synchronously or a Promise.
// Calls are debounced (~150ms) and stale responses are discarded, so a slow
// earlier request can never overwrite a newer one.
//
// Written plainly: the conformance checker exempts native-control creation in
// tinymoon's own shipped modules (framework-own allowance, keyed on the file's
// location inside the packaged assets, not on any obfuscation).

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { pushLayer } from "./kernel.js";

let idCounter = 0;

// debounce(fn, delay) -> wrapped fn with a .cancel(). Trailing-edge only.
function debounce(fn, delay) {
  let t = 0;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

function labelOf(item) {
  return item.label != null ? item.label : String(item.value);
}

// Client-side substring filter used when a static `items` array is given and no
// onFilter is supplied.
function staticFilter(items, query) {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice();
  return items.filter((it) => labelOf(it).toLowerCase().includes(q));
}

// ---------------------------------------------------------------------------
// createCombobox -- single-value typeahead
// ---------------------------------------------------------------------------

// createCombobox({name, label, onFilter?, items?, value?, text?, freeText?,
//   placeholder?, required?, disabled?, onChange?}) ->
//   {el, value (getter), set(v, text?), get(), destroy()}
// Exactly one of onFilter / items drives the results. freeText defaults to
// false: pressing Enter on text that matches no item does nothing (the field
// reverts on blur). Set freeText:true to commit arbitrary typed text.
export function createCombobox(opts) {
  if (!opts || !opts.name) throw new Error("createCombobox: name is required");
  if (!opts.label) throw new Error("createCombobox: label is required");
  if (!opts.onFilter && !opts.items) {
    throw new Error("createCombobox: provide onFilter or items");
  }

  const { name, label, onFilter, onChange, freeText = false, disabled = false, required = false } = opts;
  const staticItems = opts.items ? opts.items.slice() : null;
  const instanceId = "tm-cb-" + (++idCounter);

  let currentValue = opts.value !== undefined ? opts.value : null;
  let results = [];
  let activeIdx = -1;
  let seq = 0;
  let removeLayer = null;
  let destroyed = false;
  const handlers = [];

  function listen(elem, event, handler, listenerOpts) {
    elem.addEventListener(event, handler, listenerOpts);
    handlers.push([elem, event, handler, listenerOpts]);
  }

  // ---- DOM ----

  const wrapper = el("div", "tm-combobox field");

  const labelEl = el("label", null, label);
  labelEl.setAttribute("for", instanceId + "-input");
  wrapper.appendChild(labelEl);

  const box = el("div", "tm-combobox-box");

  const input = el("input", "tm-combobox-input");
  input.type = "text";
  input.id = instanceId + "-input";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", instanceId + "-listbox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("autocomplete", "off");
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (opts.text !== undefined) input.value = opts.text;
  else if (typeof currentValue === "string") input.value = currentValue;
  if (disabled) input.disabled = true;
  box.appendChild(input);

  const caret = el("span", "tm-combobox-caret");
  caret.setAttribute("aria-hidden", "true");
  caret.innerHTML = icon("chevron");
  box.appendChild(caret);

  wrapper.appendChild(box);

  const menu = el("div", "tm-combobox-menu");
  menu.id = instanceId + "-listbox";
  menu.setAttribute("role", "listbox");
  wrapper.appendChild(menu);

  // Hidden input for form participation (single value).
  const hiddenInput = el("input");
  hiddenInput.type = "hidden";
  hiddenInput.name = name;
  hiddenInput.value = currentValue != null ? String(currentValue) : "";
  if (required) hiddenInput.required = true;
  wrapper.appendChild(hiddenInput);

  // ---- rendering ----

  function optionId(i) { return instanceId + "-opt-" + i; }

  function renderStatus(text) {
    menu.textContent = "";
    const s = el("div", "tm-combobox-status", text);
    menu.appendChild(s);
  }

  function renderResults() {
    menu.textContent = "";
    if (results.length === 0) {
      const s = el("div", "tm-combobox-status", "No results");
      menu.appendChild(s);
      return;
    }
    results.forEach((item, i) => {
      const o = el("div", "tm-combobox-opt", labelOf(item));
      o.setAttribute("role", "option");
      o.id = optionId(i);
      o.setAttribute("aria-selected", String(item.value === currentValue));
      menu.appendChild(o);
    });
    setActive(activeIdx);
  }

  function setActive(i) {
    activeIdx = i;
    Array.from(menu.querySelectorAll("[role='option']")).forEach((o, j) => {
      o.classList.toggle("active", j === i);
    });
    if (i >= 0) {
      input.setAttribute("aria-activedescendant", optionId(i));
      const o = menu.children[i];
      if (o && o.scrollIntoView) o.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  // ---- filtering (debounced + stale-safe) ----

  function applyResults(items) {
    results = items || [];
    activeIdx = results.length ? 0 : -1;
    renderResults();
  }

  const runFilter = debounce((query) => {
    if (destroyed) return;
    const mySeq = ++seq;
    if (staticItems && !onFilter) {
      applyResults(staticFilter(staticItems, query));
      return;
    }
    const out = onFilter(query);
    if (out && typeof out.then === "function") {
      renderStatus("Loading…");
      out.then((items) => {
        // Discard stale responses: only the newest request may render.
        if (destroyed || mySeq !== seq) return;
        applyResults(items);
      }).catch(() => {
        if (destroyed || mySeq !== seq) return;
        applyResults([]);
      });
    } else {
      applyResults(out);
    }
  }, 150);

  // ---- open/close ----

  function isOpen() { return wrapper.classList.contains("open"); }

  function open() {
    if (destroyed || disabled || isOpen()) return;
    wrapper.classList.add("open");
    input.setAttribute("aria-expanded", "true");
    removeLayer = pushLayer(() => close());
  }

  function close() {
    if (removeLayer) { removeLayer(); removeLayer = null; }
    wrapper.classList.remove("open");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  // ---- selection ----

  function commit(value, text) {
    const changed = value !== currentValue;
    currentValue = value;
    hiddenInput.value = value != null ? String(value) : "";
    input.value = text != null ? text : (value != null ? String(value) : "");
    close();
    if (changed && onChange) onChange(value);
  }

  function selectIdx(i) {
    const item = results[i];
    if (!item) return;
    commit(item.value, labelOf(item));
  }

  // ---- events ----

  listen(input, "input", () => {
    open();
    renderStatus("Loading…");
    runFilter(input.value);
  });

  listen(input, "focus", () => {
    open();
    runFilter(input.value);
  });

  listen(input, "keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen()) { open(); runFilter(input.value); return; }
      setActive(Math.min(results.length - 1, activeIdx + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen()) return;
      setActive(Math.max(0, activeIdx - 1));
    } else if (e.key === "Enter") {
      if (isOpen() && activeIdx >= 0 && results[activeIdx]) {
        e.preventDefault();
        selectIdx(activeIdx);
      } else if (freeText) {
        e.preventDefault();
        const text = input.value.trim();
        commit(text === "" ? null : text, text);
      }
    } else if (e.key === "Escape") {
      if (isOpen()) { e.preventDefault(); close(); }
    }
  });

  listen(menu, "pointerdown", (e) => {
    const o = e.target.closest("[role='option']");
    if (!o) return;
    e.preventDefault(); // keep focus on the input
    const i = Array.from(menu.querySelectorAll("[role='option']")).indexOf(o);
    if (i >= 0) selectIdx(i);
  });

  // Blur: without freeText, a partial/unmatched query reverts to the committed
  // label so the field never displays an uncommitted value.
  listen(input, "blur", () => {
    setTimeout(() => {
      if (destroyed) return;
      close();
      if (!freeText) {
        input.value = currentValue != null ? String(labelForValue(currentValue)) : "";
      }
    }, 0);
  });

  // Best-effort label for a committed value (from the last results or static
  // items); falls back to the raw value.
  function labelForValue(value) {
    const inResults = results.find((it) => it.value === value);
    if (inResults) return labelOf(inResults);
    if (staticItems) {
      const inStatic = staticItems.find((it) => it.value === value);
      if (inStatic) return labelOf(inStatic);
    }
    return value;
  }

  // ---- public API ----

  function set(value, text) {
    if (destroyed) return;
    currentValue = value;
    hiddenInput.value = value != null ? String(value) : "";
    input.value = text != null ? text : (value != null ? String(labelForValue(value)) : "");
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    runFilter.cancel();
    close();
    for (const [elem, event, handler, listenerOpts] of handlers) {
      elem.removeEventListener(event, handler, listenerOpts);
    }
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  }

  return {
    el: wrapper,
    get value() { return currentValue; },
    set,
    get() { return currentValue; },
    destroy,
  };
}

// ---------------------------------------------------------------------------
// createMultiSelect -- multi-value typeahead with removable chips
// ---------------------------------------------------------------------------

// createMultiSelect({name, label, onFilter?, items?, values?, placeholder?,
//   required?, disabled?, onChange?}) ->
//   {el, values (getter), setValues(arr), destroy()}
// Selection renders as sharp removable chips; a hidden <select multiple> carries
// the values into FormData.
export function createMultiSelect(opts) {
  if (!opts || !opts.name) throw new Error("createMultiSelect: name is required");
  if (!opts.label) throw new Error("createMultiSelect: label is required");
  if (!opts.onFilter && !opts.items) {
    throw new Error("createMultiSelect: provide onFilter or items");
  }

  const { name, label, onFilter, onChange, disabled = false, required = false } = opts;
  const staticItems = opts.items ? opts.items.slice() : null;
  const instanceId = "tm-ms-" + (++idCounter);

  // value -> label for everything ever seen, so chips always have a label.
  const knownLabels = new Map();
  if (staticItems) for (const it of staticItems) knownLabels.set(it.value, labelOf(it));

  let selected = []; // array of values, in insertion order
  let results = [];
  let activeIdx = -1;
  let seq = 0;
  let removeLayer = null;
  let destroyed = false;
  const handlers = [];

  function listen(elem, event, handler, listenerOpts) {
    elem.addEventListener(event, handler, listenerOpts);
    handlers.push([elem, event, handler, listenerOpts]);
  }

  // ---- DOM ----

  const wrapper = el("div", "tm-multiselect field");

  const labelEl = el("label", null, label);
  labelEl.setAttribute("for", instanceId + "-input");
  wrapper.appendChild(labelEl);

  const control = el("div", "tm-multiselect-control");
  const chipHost = el("span", "tm-multiselect-chips");
  control.appendChild(chipHost);

  const input = el("input", "tm-multiselect-input");
  input.type = "text";
  input.id = instanceId + "-input";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", instanceId + "-listbox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("autocomplete", "off");
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (disabled) input.disabled = true;
  control.appendChild(input);
  wrapper.appendChild(control);

  const menu = el("div", "tm-combobox-menu");
  menu.id = instanceId + "-listbox";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-multiselectable", "true");
  wrapper.appendChild(menu);

  // Hidden native <select multiple> for form participation. Written plainly:
  // framework-own allowance (see module header).
  const hiddenSelect = document.createElement("select");
  hiddenSelect.multiple = true;
  hiddenSelect.name = name;
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
  if (required) hiddenSelect.required = true;
  if (disabled) hiddenSelect.disabled = true;
  wrapper.appendChild(hiddenSelect);

  // ---- rendering ----

  function optionId(i) { return instanceId + "-opt-" + i; }

  function labelFor(value) {
    return knownLabels.has(value) ? knownLabels.get(value) : String(value);
  }

  function syncHiddenSelect() {
    hiddenSelect.textContent = "";
    for (const v of selected) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = labelFor(v);
      o.selected = true;
      hiddenSelect.appendChild(o);
    }
  }

  function renderChips() {
    chipHost.textContent = "";
    selected.forEach((v) => {
      const chip = el("span", "tm-chip");
      chip.appendChild(el("span", "tm-chip-label", labelFor(v)));
      const x = el("button", "tm-chip-remove");
      x.type = "button";
      x.setAttribute("aria-label", "Remove " + labelFor(v));
      x.dataset.value = String(v);
      x.innerHTML = icon("close");
      if (disabled) x.disabled = true;
      chip.appendChild(x);
      chipHost.appendChild(chip);
    });
  }

  function renderStatus(text) {
    menu.textContent = "";
    menu.appendChild(el("div", "tm-combobox-status", text));
  }

  function visibleResults() {
    // Hide already-selected values from the menu.
    return results.filter((it) => !selected.includes(it.value));
  }

  function renderResults() {
    menu.textContent = "";
    const vis = visibleResults();
    if (vis.length === 0) {
      menu.appendChild(el("div", "tm-combobox-status", "No results"));
      return;
    }
    vis.forEach((item, i) => {
      const o = el("div", "tm-combobox-opt", labelOf(item));
      o.setAttribute("role", "option");
      o.id = optionId(i);
      o.dataset.value = String(item.value);
      o.setAttribute("aria-selected", "false");
      menu.appendChild(o);
    });
    setActive(activeIdx);
  }

  function setActive(i) {
    const optionEls = Array.from(menu.querySelectorAll("[role='option']"));
    activeIdx = Math.min(i, optionEls.length - 1);
    optionEls.forEach((o, j) => o.classList.toggle("active", j === activeIdx));
    if (activeIdx >= 0) {
      input.setAttribute("aria-activedescendant", optionId(activeIdx));
      const o = optionEls[activeIdx];
      if (o && o.scrollIntoView) o.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  // ---- filtering (debounced + stale-safe) ----

  function applyResults(items) {
    results = items || [];
    for (const it of results) knownLabels.set(it.value, labelOf(it));
    activeIdx = visibleResults().length ? 0 : -1;
    renderResults();
  }

  const runFilter = debounce((query) => {
    if (destroyed) return;
    const mySeq = ++seq;
    if (staticItems && !onFilter) {
      applyResults(staticFilter(staticItems, query));
      return;
    }
    const out = onFilter(query);
    if (out && typeof out.then === "function") {
      renderStatus("Loading…");
      out.then((items) => {
        if (destroyed || mySeq !== seq) return;
        applyResults(items);
      }).catch(() => {
        if (destroyed || mySeq !== seq) return;
        applyResults([]);
      });
    } else {
      applyResults(out);
    }
  }, 150);

  // ---- open/close ----

  function isOpen() { return wrapper.classList.contains("open"); }
  function open() {
    if (destroyed || disabled || isOpen()) return;
    wrapper.classList.add("open");
    input.setAttribute("aria-expanded", "true");
    removeLayer = pushLayer(() => close());
  }
  function close() {
    if (removeLayer) { removeLayer(); removeLayer = null; }
    wrapper.classList.remove("open");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  // ---- add/remove ----

  function addValue(value) {
    if (selected.includes(value)) return;
    selected.push(value);
    input.value = "";
    renderChips();
    syncHiddenSelect();
    renderResults();
    if (onChange) onChange(selected.slice());
  }

  function removeValue(value) {
    const idx = selected.indexOf(value);
    if (idx === -1) return;
    selected.splice(idx, 1);
    renderChips();
    syncHiddenSelect();
    renderResults();
    if (onChange) onChange(selected.slice());
  }

  function selectActive() {
    const vis = visibleResults();
    const item = vis[activeIdx];
    if (item) addValue(item.value);
  }

  // ---- events ----

  listen(input, "input", () => { open(); renderStatus("Loading…"); runFilter(input.value); });
  listen(input, "focus", () => { open(); runFilter(input.value); });

  listen(input, "keydown", (e) => {
    const vis = visibleResults();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen()) { open(); runFilter(input.value); return; }
      setActive(Math.min(vis.length - 1, activeIdx + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen()) return;
      setActive(Math.max(0, activeIdx - 1));
    } else if (e.key === "Enter") {
      if (isOpen() && activeIdx >= 0 && vis[activeIdx]) { e.preventDefault(); selectActive(); }
    } else if (e.key === "Escape") {
      if (isOpen()) { e.preventDefault(); close(); }
    } else if (e.key === "Backspace" && input.value === "" && selected.length) {
      // Backspace on an empty input removes the last chip.
      e.preventDefault();
      removeValue(selected[selected.length - 1]);
    }
  });

  listen(menu, "pointerdown", (e) => {
    const o = e.target.closest("[role='option']");
    if (!o) return;
    e.preventDefault();
    addValue(o.dataset.value);
  });

  listen(chipHost, "click", (e) => {
    const x = e.target.closest(".tm-chip-remove");
    if (!x || x.disabled) return;
    removeValue(x.dataset.value);
    input.focus();
  });

  listen(input, "blur", () => {
    setTimeout(() => { if (!destroyed) close(); }, 0);
  });

  // ---- initial state ----
  if (opts.values && opts.values.length) selected = opts.values.slice();
  renderChips();
  syncHiddenSelect();

  // ---- public API ----

  function setValues(values) {
    if (destroyed) return;
    selected = Array.isArray(values) ? values.slice() : [];
    renderChips();
    syncHiddenSelect();
    renderResults();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    runFilter.cancel();
    close();
    for (const [elem, event, handler, listenerOpts] of handlers) {
      elem.removeEventListener(event, handler, listenerOpts);
    }
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  }

  return {
    el: wrapper,
    get values() { return selected.slice(); },
    setValues,
    destroy,
  };
}
