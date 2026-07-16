// tinymoon — filter bar + chips: two presentation-only pieces for building a
// filter strip out of the controls you already have.
//
// createFilterBar({slots}) -> {el, setSlots, destroy}
//   A slot-based layout strip. The caller drops in EXISTING controls (tabs,
//   segmented, combobox, a search input, a datepicker) and the bar provides
//   only layout + responsive wrapping. It deliberately owns NO filter state.
//   Filter state is APPLICATION state: which facets are active, how they map to
//   a query, how they persist in the URL — all of that is the app's concern,
//   not a widget's. A bar that owned filter state would have to know every
//   control's value shape and every app's query model, which no generic widget
//   can. So the bar is pure presentation and the controls stay the source of
//   truth. (Compare createTable's caller-side sort: the widget reports, the app
//   owns the data.)
//
// createChips({items?, onRemove?, onClearAll?}) -> {el, setItems, destroy}
//   Sharp, removable chips rendered over CALLER state. Each chip shows a label
//   (or a key:value pair) and an × icon-button; a Clear-all affordance appears
//   once more than one chip is present, and the strip collapses to nothing when
//   empty. Like the bar, chips are presentation-only: clicking × does NOT
//   remove the chip from the DOM itself — it calls onRemove(item, index) and
//   the caller updates its state and calls setItems() with the new list. This
//   keeps the chips a faithful mirror of caller state, never a second copy that
//   can drift.

import { el } from "./dom.js";
import { icon } from "./icons.js";

// createFilterBar({slots}) -> {el, setSlots(slots), destroy}. `slots` is an
// array of controls to lay out left-to-right with responsive wrapping. Each
// slot may be a DOM Node or a component instance carrying an `.el` Node.
export function createFilterBar(opts) {
  const root = el("div", "tm-filterbar");
  root.setAttribute("role", "group");
  if (opts && opts.label) root.setAttribute("aria-label", String(opts.label));

  function nodeOfSlot(slot) {
    if (slot instanceof Node) return slot;
    if (slot && slot.el instanceof Node) return slot.el;
    return null;
  }

  function setSlots(slots) {
    root.textContent = "";
    const list = Array.isArray(slots) ? slots : [];
    for (const slot of list) {
      const node = nodeOfSlot(slot);
      if (!node) continue;
      const cell = el("div", "tm-filterbar-slot");
      cell.appendChild(node);
      root.appendChild(cell);
    }
  }

  setSlots(opts && opts.slots);

  function destroy() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, setSlots, destroy };
}

// Normalize a chip item to { text, item }. Accepts a string, a { label }, or a
// { key, value } pair (rendered "key: value").
function chipText(item) {
  if (item == null) return "";
  if (typeof item === "string") return item;
  if (item.key != null && item.value != null) return String(item.key) + ": " + String(item.value);
  if (item.label != null) return String(item.label);
  return String(item);
}

// createChips({items?, onRemove?, onClearAll?}) -> {el, setItems(items),
//   destroy}. Renders one removable chip per item over caller state.
export function createChips(opts) {
  const options = opts || {};
  const onRemove = typeof options.onRemove === "function" ? options.onRemove : null;
  const onClearAll = typeof options.onClearAll === "function" ? options.onClearAll : null;

  const root = el("div", "tm-chips");
  let items = Array.isArray(options.items) ? options.items : [];

  function render() {
    root.textContent = "";
    // Collapse to nothing when empty — no empty strip, no residual affordance.
    if (items.length === 0) return;

    items.forEach((item, i) => {
      const chip = el("span", "tm-chip");
      chip.appendChild(el("span", "tm-chip-label", chipText(item)));
      const rm = el("button", "tm-chip-x");
      rm.type = "button";
      rm.innerHTML = icon("close");
      rm.setAttribute("aria-label", "Remove " + chipText(item));
      rm.addEventListener("click", () => { if (onRemove) onRemove(item, i); });
      chip.appendChild(rm);
      root.appendChild(chip);
    });

    // Clear-all appears only when there is more than one chip to clear.
    if (items.length > 1) {
      const clear = el("button", "tm-chips-clear");
      clear.type = "button";
      clear.textContent = "Clear all";
      clear.addEventListener("click", () => { if (onClearAll) onClearAll(); });
      root.appendChild(clear);
    }
  }

  function setItems(next) {
    items = Array.isArray(next) ? next : [];
    render();
  }

  render();

  function destroy() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, setItems, destroy };
}
