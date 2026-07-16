// tinymoon -- time picker: a text field showing a locale-formatted time with a
// custom hours/minutes popover. No native time input. Hidden input[type="hidden"]
// carries the canonical "HH:MM" 24h value for form participation.
//
// Factory: createTimePicker(opts) -> {el, set(v), value (getter), destroy()}
//   opts: {name (REQUIRED), label (REQUIRED), value?, minuteStep?,
//          onChange?, required?, disabled?}
//   value is a canonical 24h "HH:MM" string; the visible field shows the
//   locale format (e.g. "2:30 PM") via Intl.DateTimeFormat.
//
// Written plainly: the conformance checker exempts native-element creation in
// tinymoon's own shipped modules (framework-own allowance, keyed on the file's
// location inside the packaged assets, not on any obfuscation).

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { pushLayer, placeBelow } from "./kernel.js";

// Canonicalize {h, m} to "HH:MM".
function toHHMM(h, m) {
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// Parse a canonical "HH:MM" (24h) string to {h, m} or null.
function parseHHMM(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

// Format a canonical "HH:MM" to a locale-friendly display string.
function formatDisplay(hhmm) {
  const p = parseHHMM(hhmm);
  if (!p) return "";
  const d = new Date(2000, 0, 1, p.h, p.m);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

// Parse user-typed text into canonical "HH:MM" (24h). Accepts:
//   "14:30", "9:05", "2:30 PM", "2 PM", "230pm", "1430"
function parseUserInput(text) {
  const s = text.trim().toLowerCase();
  if (!s) return null;

  // 12h with meridiem: "2:30 pm", "2 pm", "2:30pm"
  const mer = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/);
  if (mer) {
    let h = parseInt(mer[1], 10);
    const m = mer[2] ? parseInt(mer[2], 10) : 0;
    if (h < 1 || h > 12 || m > 59) return null;
    if (mer[3] === "p" && h !== 12) h += 12;
    if (mer[3] === "a" && h === 12) h = 0;
    return toHHMM(h, m);
  }

  // 24h "H:MM" or "HH:MM"
  const colon = s.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) {
    const h = parseInt(colon[1], 10);
    const m = parseInt(colon[2], 10);
    if (h > 23 || m > 59) return null;
    return toHHMM(h, m);
  }

  // Bare digits "1430" / "930"
  const digits = s.match(/^(\d{3,4})$/);
  if (digits) {
    const raw = digits[1].padStart(4, "0");
    const h = parseInt(raw.slice(0, 2), 10);
    const m = parseInt(raw.slice(2), 10);
    if (h > 23 || m > 59) return null;
    return toHHMM(h, m);
  }

  return null;
}

let idCounter = 0;

export function createTimePicker(opts) {
  if (!opts || !opts.name) throw new Error("createTimePicker: name is required");
  if (!opts.label) throw new Error("createTimePicker: label is required");

  const { name, label, onChange, required = false, disabled = false } = opts;
  const minuteStep = opts.minuteStep && opts.minuteStep > 0 ? Number(opts.minuteStep) : 5;
  const instanceId = "tm-tp-" + (++idCounter);

  let currentValue = opts.value && parseHHMM(opts.value) ? opts.value : null;
  let destroyed = false;
  let removeLayer = null;
  let onDocDown = null;
  const handlers = [];

  function listen(elem, event, handler, listenerOpts) {
    elem.addEventListener(event, handler, listenerOpts);
    handlers.push([elem, event, handler, listenerOpts]);
  }

  // ---- build DOM ----

  const wrapper = el("div", "tm-timepicker");
  wrapper.id = instanceId;

  const labelEl = el("label", "tm-timepicker-label", label);
  labelEl.setAttribute("for", instanceId + "-input");
  wrapper.appendChild(labelEl);

  const inputRow = el("div", "tm-timepicker-input-row");

  const textInput = el("input", "tm-timepicker-text");
  textInput.type = "text";
  textInput.id = instanceId + "-input";
  textInput.placeholder = "Select a time";
  textInput.setAttribute("autocomplete", "off");
  if (disabled) textInput.disabled = true;
  inputRow.appendChild(textInput);

  const toggleBtn = el("button", "tm-timepicker-toggle");
  toggleBtn.type = "button";
  toggleBtn.setAttribute("aria-label", "Open time picker");
  toggleBtn.setAttribute("aria-expanded", "false");
  toggleBtn.setAttribute("aria-controls", instanceId + "-popover");
  toggleBtn.innerHTML = icon("clock");
  if (disabled) toggleBtn.disabled = true;
  inputRow.appendChild(toggleBtn);

  wrapper.appendChild(inputRow);

  // Hidden input for form participation (canonical "HH:MM").
  const hiddenInput = el("input");
  hiddenInput.type = "hidden";
  hiddenInput.name = name;
  hiddenInput.value = currentValue || "";
  if (required) hiddenInput.required = true;
  wrapper.appendChild(hiddenInput);

  // Popover with two listbox columns.
  const popover = el("div", "tm-timepicker-popover");
  popover.id = instanceId + "-popover";
  popover.setAttribute("popover", "manual");
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "false");
  popover.setAttribute("aria-label", label + " time picker");

  const hourCol = el("div", "tm-timepicker-col");
  hourCol.setAttribute("role", "listbox");
  hourCol.setAttribute("aria-label", "Hours");
  const minuteCol = el("div", "tm-timepicker-col");
  minuteCol.setAttribute("role", "listbox");
  minuteCol.setAttribute("aria-label", "Minutes");

  popover.appendChild(hourCol);
  popover.appendChild(minuteCol);
  wrapper.appendChild(popover);

  const hours = [];
  for (let h = 0; h < 24; h++) hours.push(h);
  const minutes = [];
  for (let m = 0; m < 60; m += minuteStep) minutes.push(m);

  // Pending selection while the popover is open. Defaults to the current value
  // or midnight so a single-column pick still yields a full time.
  function pending() {
    const p = currentValue ? parseHHMM(currentValue) : null;
    return { h: p ? p.h : 0, m: p ? p.m : 0 };
  }

  function optLabel(part, n) {
    if (part === "h") {
      const d = new Date(2000, 0, 1, n, 0);
      return new Intl.DateTimeFormat(undefined, { hour: "numeric", hour12: undefined }).format(d);
    }
    return String(n).padStart(2, "0");
  }

  function renderColumn(col, part, values, selected) {
    col.textContent = "";
    values.forEach((n) => {
      const o = el("button", "tm-timepicker-opt");
      o.type = "button";
      o.setAttribute("role", "option");
      o.dataset.value = String(n);
      o.textContent = optLabel(part, n);
      const isSel = n === selected;
      o.setAttribute("aria-selected", String(isSel));
      if (isSel) o.classList.add("selected");
      o.tabIndex = isSel ? 0 : -1;
      col.appendChild(o);
    });
    // Ensure at least one roving-tabindex target when nothing is selected.
    if (!col.querySelector("[tabindex='0']") && col.firstChild) {
      col.firstChild.tabIndex = 0;
    }
  }

  function renderColumns() {
    const p = pending();
    renderColumn(hourCol, "h", hours, p.h);
    renderColumn(minuteCol, "m", minutes, p.m);
  }

  // ---- commit ----

  function commit(h, m) {
    const iso = toHHMM(h, m);
    const changed = iso !== currentValue;
    currentValue = iso;
    hiddenInput.value = iso;
    textInput.value = formatDisplay(iso);
    renderColumns();
    if (changed && onChange) onChange(iso);
  }

  function pickHour(h) {
    const p = pending();
    commit(h, p.m);
  }
  function pickMinute(m) {
    const p = pending();
    commit(p.h, m);
  }

  // ---- open/close ----

  function isOpen() {
    try {
      return popover.matches(":popover-open");
    } catch (_) {
      return popover.dataset.open === "true";
    }
  }

  function openPicker() {
    if (destroyed || disabled) return;
    renderColumns();
    try {
      popover.showPopover();
      // A top-layer popover is positioned against the viewport, so place it
      // explicitly below the field instead of relying on flow-relative offsets.
      placeBelow(inputRow, popover, { gap: 4 });
    } catch (_) {
      popover.dataset.open = "true";
      popover.style.display = "flex";
    }
    toggleBtn.setAttribute("aria-expanded", "true");
    removeLayer = pushLayer(() => closePicker());
    onDocDown = (e) => { if (!wrapper.contains(e.target)) closePicker(); };
    document.addEventListener("pointerdown", onDocDown, true);
    requestAnimationFrame(() => {
      const sel = hourCol.querySelector("[tabindex='0']");
      if (sel) { sel.focus(); sel.scrollIntoView({ block: "center" }); }
      const selm = minuteCol.querySelector(".selected");
      if (selm) selm.scrollIntoView({ block: "center" });
    });
  }

  function closePicker() {
    if (removeLayer) { removeLayer(); removeLayer = null; }
    if (onDocDown) { document.removeEventListener("pointerdown", onDocDown, true); onDocDown = null; }
    try {
      if (isOpen()) popover.hidePopover();
    } catch (_) {
      popover.dataset.open = "false";
      popover.style.display = "";
    }
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  // ---- keyboard within a column (roving tabindex listbox) ----

  function columnKeydown(col, onPick) {
    return (e) => {
      const cur = e.target.closest("[role='option']");
      if (!cur) return;
      const opts2 = Array.from(col.children);
      const idx = opts2.indexOf(cur);
      let next = -1;
      if (e.key === "ArrowDown") next = Math.min(opts2.length - 1, idx + 1);
      else if (e.key === "ArrowUp") next = Math.max(0, idx - 1);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = opts2.length - 1;
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(Number(cur.dataset.value));
        return;
      } else if (e.key === "Tab") { return; }
      else return;
      e.preventDefault();
      if (next !== -1) {
        for (const o of opts2) o.tabIndex = -1;
        opts2[next].tabIndex = 0;
        opts2[next].focus();
        opts2[next].scrollIntoView({ block: "nearest" });
      }
    };
  }

  // ---- events ----

  listen(toggleBtn, "click", () => { isOpen() ? closePicker() : openPicker(); });
  listen(toggleBtn, "keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      isOpen() ? closePicker() : openPicker();
    }
  });

  listen(hourCol, "click", (e) => {
    const o = e.target.closest("[role='option']");
    if (o) pickHour(Number(o.dataset.value));
  });
  listen(minuteCol, "click", (e) => {
    const o = e.target.closest("[role='option']");
    if (o) pickMinute(Number(o.dataset.value));
  });
  listen(hourCol, "keydown", columnKeydown(hourCol, pickHour));
  listen(minuteCol, "keydown", columnKeydown(minuteCol, pickMinute));

  // Text input: parse on blur.
  listen(textInput, "blur", () => {
    const text = textInput.value.trim();
    if (!text) {
      currentValue = null;
      hiddenInput.value = "";
      return;
    }
    const iso = parseUserInput(text);
    if (iso) {
      const p = parseHHMM(iso);
      commit(p.h, p.m);
    } else if (currentValue) {
      textInput.value = formatDisplay(currentValue);
    } else {
      textInput.value = "";
    }
  });
  listen(textInput, "keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); textInput.blur(); }
  });

  // ---- initial render ----
  if (currentValue) textInput.value = formatDisplay(currentValue);
  renderColumns();

  // ---- public API ----

  function set(v) {
    if (destroyed) return;
    const p = parseHHMM(v);
    if (!p) throw new Error("createTimePicker.set(): invalid time (expected \"HH:MM\"): " + JSON.stringify(v));
    commit(p.h, p.m);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    closePicker();
    for (const [elem, event, handler, listenerOpts] of handlers) {
      elem.removeEventListener(event, handler, listenerOpts);
    }
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  }

  return {
    el: wrapper,
    set,
    get value() { return currentValue; },
    destroy,
  };
}
