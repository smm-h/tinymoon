// tinymoon -- date picker: full custom calendar with APG grid pattern, no
// native date input. Hidden input[type="hidden"] for form participation.
//
// Factory: createDatePicker(opts) -> {el, set(v), value (getter), destroy()}
//   opts: {name (REQUIRED), label (REQUIRED), value?, min?, max?,
//          onChange?, required?, disabled?}
//   value/min/max are ISO date strings (YYYY-MM-DD).

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { pushLayer } from "./kernel.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

// Parse an ISO date string to {year, month, day} or null.
function parseISO(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

// Format {year, month, day} to ISO string.
function toISO(y, m, d) {
  return String(y) + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

// Format ISO string to user-friendly display: "Jul 14, 2026".
function formatDisplay(iso) {
  const p = parseISO(iso);
  if (!p) return "";
  return MONTH_ABBR[p.month - 1] + " " + p.day + ", " + p.year;
}

// Try to parse user-typed text into an ISO date. Accepts:
// - ISO: 2026-07-14
// - US informal: 7/14/2026, 07/14/2026
// - Abbr: Jul 14, 2026
function parseUserInput(text) {
  const s = text.trim();
  if (!s) return null;

  // ISO
  const iso = parseISO(s);
  if (iso) return toISO(iso.year, iso.month, iso.day);

  // US slash: M/D/YYYY or MM/DD/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const m = parseInt(slash[1], 10);
    const d = parseInt(slash[2], 10);
    const y = parseInt(slash[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISO(y, m, d);
  }

  // Abbr month: "Jul 14, 2026" or "Jul 14 2026"
  const abbr = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (abbr) {
    const mi = MONTH_ABBR.findIndex((a) => a.toLowerCase() === abbr[1].toLowerCase().slice(0, 3));
    if (mi !== -1) {
      const d = parseInt(abbr[2], 10);
      const y = parseInt(abbr[3], 10);
      if (d >= 1 && d <= 31) return toISO(y, mi + 1, d);
    }
  }

  return null;
}

// Number of days in a given month (1-indexed).
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// Day of week for the 1st of a month (0=Sun).
function firstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

// Compare two ISO date strings. Returns <0, 0, or >0.
function compareDates(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

let idCounter = 0;

export function createDatePicker(opts) {
  if (!opts || !opts.name) throw new Error("createDatePicker: name is required");
  if (!opts.label) throw new Error("createDatePicker: label is required");

  const { name, label, onChange, required = false, disabled = false } = opts;
  const minDate = opts.min || null;
  const maxDate = opts.max || null;
  const instanceId = "tm-dp-" + (++idCounter);

  let currentValue = opts.value && parseISO(opts.value) ? opts.value : null;
  // The month/year currently displayed in the calendar grid.
  let viewYear, viewMonth;
  if (currentValue) {
    const p = parseISO(currentValue);
    viewYear = p.year;
    viewMonth = p.month;
  } else {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth() + 1;
  }

  let focusDay = null; // the day number that has roving tabindex 0
  let removeLayer = null;
  let onDocDown = null; // outside-click handler ref for cleanup
  let destroyed = false;
  const handlers = []; // [element, event, handler, opts?] for cleanup

  function listen(elem, event, handler, listenerOpts) {
    elem.addEventListener(event, handler, listenerOpts);
    handlers.push([elem, event, handler, listenerOpts]);
  }

  // ---- build DOM ----

  const wrapper = el("div", "tm-datepicker");
  wrapper.id = instanceId;

  // Label
  const labelEl = el("label", "tm-datepicker-label", label);
  labelEl.setAttribute("for", instanceId + "-input");
  wrapper.appendChild(labelEl);

  // Input row: text input + toggle button
  const inputRow = el("div", "tm-datepicker-input-row");

  const textInput = el("input");
  textInput.type = "text";
  textInput.id = instanceId + "-input";
  textInput.className = "tm-datepicker-text";
  textInput.placeholder = "Select a date";
  textInput.setAttribute("autocomplete", "off");
  if (disabled) textInput.disabled = true;
  inputRow.appendChild(textInput);

  const toggleBtn = el("button", "tm-datepicker-toggle");
  toggleBtn.type = "button";
  toggleBtn.setAttribute("aria-label", "Open calendar");
  toggleBtn.setAttribute("aria-expanded", "false");
  toggleBtn.setAttribute("aria-controls", instanceId + "-popover");
  toggleBtn.innerHTML = icon("calendar");
  if (disabled) toggleBtn.disabled = true;
  inputRow.appendChild(toggleBtn);

  wrapper.appendChild(inputRow);

  // Hidden input for form participation
  const hiddenInput = el("input");
  hiddenInput.type = "hidden";
  hiddenInput.name = name;
  hiddenInput.value = currentValue || "";
  if (required) hiddenInput.required = true;
  wrapper.appendChild(hiddenInput);

  // Calendar popover
  const popover = el("div", "tm-datepicker-popover");
  popover.id = instanceId + "-popover";
  popover.setAttribute("popover", "manual");
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "false");
  popover.setAttribute("aria-label", label + " calendar");

  // Month/year header
  const header = el("div", "tm-datepicker-header");

  const prevBtn = el("button", "tm-datepicker-nav");
  prevBtn.type = "button";
  prevBtn.setAttribute("aria-label", "Previous month");
  prevBtn.innerHTML = icon("chevron");
  header.appendChild(prevBtn);

  const monthLabel = el("span", "tm-datepicker-month");
  header.appendChild(monthLabel);

  const nextBtn = el("button", "tm-datepicker-nav");
  nextBtn.type = "button";
  nextBtn.setAttribute("aria-label", "Next month");
  nextBtn.innerHTML = icon("chevron");
  header.appendChild(nextBtn);

  popover.appendChild(header);

  // Grid
  const table = el("table", "tm-datepicker-grid");
  table.setAttribute("role", "grid");
  table.setAttribute("aria-label", label);

  const thead = el("thead");
  const headRow = el("tr");
  for (const d of DAY_HEADERS) {
    const th = el("th", null, d);
    th.setAttribute("scope", "col");
    th.setAttribute("aria-label", ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][DAY_HEADERS.indexOf(d) === -1 ? 0 : DAY_HEADERS.indexOf(d)]);
    headRow.appendChild(th);
  }
  // Fix ambiguous day names: Tue/Thu and Sat/Sun share initials
  const fullDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const thNodes = headRow.querySelectorAll("th");
  for (let i = 0; i < thNodes.length; i++) {
    thNodes[i].setAttribute("aria-label", fullDayNames[i]);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  table.appendChild(tbody);
  popover.appendChild(table);

  wrapper.appendChild(popover);

  // ---- calendar rendering ----

  function isDisabled(iso) {
    if (minDate && compareDates(iso, minDate) < 0) return true;
    if (maxDate && compareDates(iso, maxDate) > 0) return true;
    return false;
  }

  function renderCalendar() {
    monthLabel.textContent = MONTH_NAMES[viewMonth - 1] + " " + viewYear;

    tbody.textContent = "";
    const totalDays = daysInMonth(viewYear, viewMonth);
    const startDow = firstDayOfWeek(viewYear, viewMonth);

    // Determine which day should have tabindex 0 (roving focus)
    if (currentValue) {
      const p = parseISO(currentValue);
      if (p.year === viewYear && p.month === viewMonth) {
        focusDay = p.day;
      } else {
        focusDay = 1;
      }
    } else {
      // If today is in the viewed month, focus today
      const now = new Date();
      if (now.getFullYear() === viewYear && now.getMonth() + 1 === viewMonth) {
        focusDay = now.getDate();
      } else {
        focusDay = 1;
      }
    }

    let dayNum = 1;
    // Build up to 6 rows
    for (let row = 0; row < 6 && dayNum <= totalDays; row++) {
      const tr = el("tr");
      for (let col = 0; col < 7; col++) {
        const td = el("td");
        if ((row === 0 && col < startDow) || dayNum > totalDays) {
          // Empty cell
          tr.appendChild(td);
          continue;
        }

        const d = dayNum;
        const iso = toISO(viewYear, viewMonth, d);
        const btn = el("button", "tm-datepicker-day");
        btn.type = "button";
        btn.textContent = String(d);
        btn.dataset.date = iso;

        td.setAttribute("role", "gridcell");

        const dis = isDisabled(iso);
        if (dis) {
          btn.setAttribute("aria-disabled", "true");
          btn.disabled = true;
          btn.tabIndex = -1;
        } else {
          btn.tabIndex = (d === focusDay) ? 0 : -1;
        }

        // Today marker
        const now = new Date();
        if (d === now.getDate() && viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()) {
          btn.classList.add("today");
        }

        // Selected marker
        if (currentValue === iso) {
          btn.setAttribute("aria-selected", "true");
          btn.classList.add("selected");
        }

        td.appendChild(btn);
        tr.appendChild(td);
        dayNum++;
      }
      tbody.appendChild(tr);
    }
  }

  // ---- open/close ----

  function isOpen() {
    // Check if the popover matches :popover-open, falling back to a data attr
    // for environments without Popover API support.
    try {
      return popover.matches(":popover-open");
    } catch (_) {
      return popover.dataset.open === "true";
    }
  }

  function openCalendar() {
    if (destroyed || disabled) return;
    renderCalendar();
    try {
      popover.showPopover();
    } catch (_) {
      // Fallback for environments without Popover API (e.g. happy-dom)
      popover.dataset.open = "true";
      popover.style.display = "block";
    }
    toggleBtn.setAttribute("aria-expanded", "true");
    removeLayer = pushLayer(() => closeCalendar());
    // Outside click closes the calendar (popover="manual" does not auto-close)
    onDocDown = (e) => {
      if (!wrapper.contains(e.target)) closeCalendar();
    };
    document.addEventListener("pointerdown", onDocDown, true);
    // Focus the roving-focus day
    requestAnimationFrame(() => {
      const focused = tbody.querySelector("button[tabindex='0']");
      if (focused) focused.focus();
    });
  }

  function closeCalendar() {
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

  // ---- date selection ----

  function selectDate(iso) {
    const p = parseISO(iso);
    if (!p) return;
    if (isDisabled(iso)) return;
    currentValue = iso;
    hiddenInput.value = iso;
    textInput.value = formatDisplay(iso);
    viewYear = p.year;
    viewMonth = p.month;
    closeCalendar();
    toggleBtn.focus();
    if (onChange) onChange(iso);
  }

  // ---- month navigation ----

  function prevMonth() {
    viewMonth--;
    if (viewMonth < 1) { viewMonth = 12; viewYear--; }
    focusDay = null;
    renderCalendar();
    // Focus the first available day
    const first = tbody.querySelector("button[tabindex='0']");
    if (first) first.focus();
  }

  function nextMonth() {
    viewMonth++;
    if (viewMonth > 12) { viewMonth = 1; viewYear++; }
    focusDay = null;
    renderCalendar();
    const first = tbody.querySelector("button[tabindex='0']");
    if (first) first.focus();
  }

  // ---- event handlers ----

  listen(toggleBtn, "click", () => {
    if (isOpen()) closeCalendar();
    else openCalendar();
  });

  listen(toggleBtn, "keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isOpen()) closeCalendar();
      else openCalendar();
    }
  });

  listen(prevBtn, "click", (e) => {
    e.stopPropagation();
    prevMonth();
  });

  listen(nextBtn, "click", (e) => {
    e.stopPropagation();
    nextMonth();
  });

  // Day click delegation on tbody
  listen(tbody, "click", (e) => {
    const btn = e.target.closest("button[data-date]");
    if (!btn || btn.disabled) return;
    selectDate(btn.dataset.date);
  });

  // Keyboard navigation on the grid (APG date-picker grid pattern)
  listen(tbody, "keydown", (e) => {
    const btn = e.target.closest("button[data-date]");
    if (!btn) return;

    const p = parseISO(btn.dataset.date);
    if (!p) return;

    let targetISO = null;

    switch (e.key) {
      case "ArrowRight": {
        e.preventDefault();
        const next = new Date(p.year, p.month - 1, p.day + 1);
        targetISO = toISO(next.getFullYear(), next.getMonth() + 1, next.getDate());
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        const prev = new Date(p.year, p.month - 1, p.day - 1);
        targetISO = toISO(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        const down = new Date(p.year, p.month - 1, p.day + 7);
        targetISO = toISO(down.getFullYear(), down.getMonth() + 1, down.getDate());
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const up = new Date(p.year, p.month - 1, p.day - 7);
        targetISO = toISO(up.getFullYear(), up.getMonth() + 1, up.getDate());
        break;
      }
      case "Home": {
        e.preventDefault();
        targetISO = toISO(p.year, p.month, 1);
        break;
      }
      case "End": {
        e.preventDefault();
        const last = daysInMonth(p.year, p.month);
        targetISO = toISO(p.year, p.month, last);
        break;
      }
      case "PageUp": {
        e.preventDefault();
        let m = p.month - 1;
        let y = p.year;
        if (m < 1) { m = 12; y--; }
        const maxD = daysInMonth(y, m);
        const d = Math.min(p.day, maxD);
        targetISO = toISO(y, m, d);
        break;
      }
      case "PageDown": {
        e.preventDefault();
        let m = p.month + 1;
        let y = p.year;
        if (m > 12) { m = 1; y++; }
        const maxD = daysInMonth(y, m);
        const d = Math.min(p.day, maxD);
        targetISO = toISO(y, m, d);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (!btn.disabled) selectDate(btn.dataset.date);
        return;
      }
      default:
        return;
    }

    if (targetISO && !isDisabled(targetISO)) {
      const tp = parseISO(targetISO);
      if (tp.year !== viewYear || tp.month !== viewMonth) {
        viewYear = tp.year;
        viewMonth = tp.month;
        focusDay = tp.day;
        renderCalendar();
      } else {
        // Update roving tabindex within the same month
        const allBtns = tbody.querySelectorAll("button[data-date]");
        for (const b of allBtns) b.tabIndex = -1;
        focusDay = tp.day;
      }
      const target = tbody.querySelector("button[data-date='" + targetISO + "']");
      if (target && !target.disabled) {
        target.tabIndex = 0;
        target.focus();
      }
    }
  });

  // Text input: validate on blur
  listen(textInput, "blur", () => {
    const text = textInput.value.trim();
    if (!text) {
      currentValue = null;
      hiddenInput.value = "";
      return;
    }
    const iso = parseUserInput(text);
    if (iso && !isDisabled(iso)) {
      if (iso !== currentValue) {
        currentValue = iso;
        hiddenInput.value = iso;
        textInput.value = formatDisplay(iso);
        const p = parseISO(iso);
        viewYear = p.year;
        viewMonth = p.month;
        if (onChange) onChange(iso);
      } else {
        // Re-format even if unchanged
        textInput.value = formatDisplay(iso);
      }
    } else if (currentValue) {
      // Invalid input: revert to current value
      textInput.value = formatDisplay(currentValue);
    } else {
      textInput.value = "";
    }
  });

  // Text input: Enter opens calendar or validates
  listen(textInput, "keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      textInput.blur();
    }
  });

  // Note: using popover="manual" so the browser never auto-dismisses.
  // Closing is handled by: Escape (kernel layer stack), outside click
  // (document pointerdown), and selectDate/closeCalendar calls.

  // ---- initial render ----

  if (currentValue) {
    textInput.value = formatDisplay(currentValue);
  }

  // ---- public API ----

  function set(v) {
    if (destroyed) return;
    const p = parseISO(v);
    if (!p) throw new Error("createDatePicker.set(): invalid ISO date: " + JSON.stringify(v));
    currentValue = v;
    hiddenInput.value = v;
    textInput.value = formatDisplay(v);
    viewYear = p.year;
    viewMonth = p.month;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    closeCalendar();
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
