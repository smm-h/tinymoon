// tinymoon — data table: a declarative, keyboard-navigable data grid built on
// the existing table.data styling.
//
// DESIGN — two decisions the API pins:
//
// 1. Declarative rendering. setRows(rows) re-renders the body WHOLESALE. There
//    is no per-row diffing here (that is what the state barrel's reconcile() is
//    for); a data table redraws cheaply from an array.
//
// 2. Caller-side sorting. Clicking a sortable header (or pressing Enter/Space on
//    it) cycles its aria-sort none → ascending → descending → none and calls
//    onSort(key, direction). The table NEVER sorts the rows itself and NEVER
//    mutates the rows array you hand it — it only reports the requested sort.
//    The caller sorts its own data and calls setRows() with the new order. This
//    keeps sorting semantics (locale, numeric vs. string, stability) entirely in
//    the caller's hands.
//
// Keyboard: cells form a roving-tabindex grid (role="grid"). Arrow keys move the
// focused cell, Home/End jump to the row's first/last cell, and Enter/Space on a
// sortable header cycles its sort. Exactly one cell carries tabindex=0 at a time.

import { el } from "./dom.js";

const SORT_CYCLE = { none: "ascending", ascending: "descending", descending: "none" };

// Resolve a column's value from a row. `key` is either a property name or a
// function of the row.
function cellValue(col, row) {
  return typeof col.key === "function" ? col.key(row) : row[col.key];
}

// Fill a cell element with a column's rendered content. `format(value, row)` may
// return a string OR a live DOM Node; a Node is appended as-is (so a cell can
// hold a badge, a button, any element). Absent a format, the raw value is
// stringified into textContent. `value` is precomputed by the caller so a
// function `key` (and any cellClass hook) evaluates exactly once per cell.
function fillCell(cell, col, row, value) {
  cell.textContent = "";
  if (typeof col.format === "function") {
    const out = col.format(value, row);
    if (out instanceof Node) cell.appendChild(out);
    else cell.textContent = out == null ? "" : String(out);
  } else {
    cell.textContent = value == null ? "" : String(value);
  }
}

function applyAlign(cell, align) {
  if (align) cell.style.textAlign = align;
}

// Append caller-supplied classes to a framework node WITHOUT replacing the
// framework's own classes. A hook (rowClass / cellClass) may return a single
// class, a space-separated list, or null/undefined/"" for "no class".
function addClasses(node, cls) {
  if (cls == null || cls === "") return;
  for (const name of String(cls).split(/\s+/)) {
    if (name) node.classList.add(name);
  }
}

// createTable({columns, rows?, maxRows?, onSort?, caption?}) →
//   {el, setRows(rows), destroy}
//
// columns: [{ key: string | (row)=>any, label, align?, sortable?,
//             format?(value,row) -> string | Node,
//             cellClass?(value,row) -> string | null }]
// maxRows: cap the rendered body; extra rows collapse into a "N more rows not
//          shown" footer note (the data is not sorted or dropped, just unshown).
// rowClass(row) -> string | null: an optional per-row class hook. Both hooks
//   only APPEND to the framework's own tr/td classes — they never replace them;
//   null/undefined/"" means no class.
// onRowClick(row, index, event): called when a body data row is activated by
//   pointer. Delegated inside the widget (one listener), so it survives
//   setRows() re-renders. index is the row's position in the current rows array
//   and row is that array element; the tfoot "more rows" note never fires it.
// onRowHover(row | null, index, event): called when the pointer enters a body
//   data row (row + index) and again with (null, -1) when it leaves the table.
//   Fires once per row transition, not per cell. Only wired when provided.
export function createTable(opts) {
  if (!opts || !Array.isArray(opts.columns)) {
    throw new Error("createTable: columns array is required");
  }
  const { columns, rows = [], maxRows, onSort, caption, rowClass, onRowClick, onRowHover } = opts;

  const table = el("table", "data tm-table");
  table.setAttribute("role", "grid");

  if (caption) {
    const cap = document.createElement("caption");
    cap.textContent = caption;
    table.appendChild(cap);
  }

  // -- header -----------------------------------------------------------------
  const thead = document.createElement("thead");
  const headRow = el("tr");
  headRow.setAttribute("role", "row");
  const headerCells = [];
  columns.forEach((col, c) => {
    const th = el("th", null, undefined);
    th.setAttribute("role", "columnheader");
    th.textContent = col.label == null ? "" : String(col.label);
    applyAlign(th, col.align);
    th.dataset.col = String(c);
    if (col.sortable) {
      th.classList.add("sortable");
      th.setAttribute("aria-sort", "none");
    }
    headRow.appendChild(th);
    headerCells.push(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  // -- body -------------------------------------------------------------------
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  const tfoot = document.createElement("tfoot");
  table.appendChild(tfoot);

  // The rows reference we were last given — kept by identity, NEVER sorted or
  // mutated. renderBody reads it; setRows swaps it.
  let currentRows = rows;
  // Roving-grid model: grid[r][c] is a focusable cell. Row 0 is the header.
  let grid = [];
  let focusR = 0;
  let focusC = 0;

  function renderBody() {
    tbody.textContent = "";
    tfoot.textContent = "";
    const cap = typeof maxRows === "number" ? Math.max(0, maxRows) : currentRows.length;
    const shown = Math.min(cap, currentRows.length);
    for (let r = 0; r < shown; r++) {
      const row = currentRows[r];
      const tr = el("tr");
      tr.setAttribute("role", "row");
      if (typeof rowClass === "function") addClasses(tr, rowClass(row));
      columns.forEach((col, c) => {
        const td = el("td");
        td.setAttribute("role", "gridcell");
        td.dataset.col = String(c);
        applyAlign(td, col.align);
        const value = cellValue(col, row);
        fillCell(td, col, row, value);
        if (typeof col.cellClass === "function") addClasses(td, col.cellClass(value, row));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    const hidden = currentRows.length - shown;
    if (hidden > 0) {
      const tr = el("tr", "tm-table-more");
      tr.setAttribute("role", "row");
      const td = el("td", null, hidden + " more row" + (hidden === 1 ? "" : "s") + " not shown");
      td.setAttribute("role", "gridcell");
      td.colSpan = columns.length;
      tr.appendChild(td);
      tfoot.appendChild(tr);
    }
    rebuildGrid();
  }

  // Recompute the focusable grid (header + body data rows; the tfoot "more" row
  // is intentionally excluded so the grid stays rectangular) and reset roving
  // tabindex so exactly one cell is tabbable.
  function rebuildGrid() {
    grid = [headerCells.slice()];
    for (const tr of tbody.querySelectorAll("tr")) {
      grid.push(Array.from(tr.querySelectorAll("td")));
    }
    if (focusR >= grid.length) focusR = grid.length - 1;
    if (focusR < 0) focusR = 0;
    const rowLen = grid[focusR] ? grid[focusR].length : 0;
    if (focusC >= rowLen) focusC = Math.max(0, rowLen - 1);
    if (focusC < 0) focusC = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        grid[r][c].tabIndex = r === focusR && c === focusC ? 0 : -1;
      }
    }
  }

  function moveFocus(r, c) {
    if (!grid[r] || !grid[r][c]) return;
    if (grid[focusR] && grid[focusR][focusC]) grid[focusR][focusC].tabIndex = -1;
    focusR = r;
    focusC = c;
    const cell = grid[focusR][focusC];
    cell.tabIndex = 0;
    cell.focus();
  }

  function cycleSort(c) {
    const col = columns[c];
    if (!col || !col.sortable) return;
    const th = headerCells[c];
    const cur = th.getAttribute("aria-sort") || "none";
    const next = SORT_CYCLE[cur] || "ascending";
    // A single active sort column: reset every other sortable header to none.
    headerCells.forEach((h, i) => {
      if (i !== c && h.hasAttribute("aria-sort")) h.setAttribute("aria-sort", "none");
    });
    th.setAttribute("aria-sort", next);
    if (typeof onSort === "function") onSort(col.key, next);
  }

  function onKeydown(e) {
    const cell = e.target.closest("[role='columnheader'],[role='gridcell']");
    if (!cell || !table.contains(cell)) return;
    // Locate the cell in the grid.
    let r = -1;
    let c = -1;
    for (let ri = 0; ri < grid.length && r < 0; ri++) {
      const ci = grid[ri].indexOf(cell);
      if (ci >= 0) { r = ri; c = ci; }
    }
    if (r < 0) return;
    switch (e.key) {
      case "ArrowRight": e.preventDefault(); moveFocus(r, Math.min(c + 1, grid[r].length - 1)); break;
      case "ArrowLeft": e.preventDefault(); moveFocus(r, Math.max(c - 1, 0)); break;
      case "ArrowDown": {
        e.preventDefault();
        const nr = Math.min(r + 1, grid.length - 1);
        moveFocus(nr, Math.min(c, grid[nr].length - 1));
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const nr = Math.max(r - 1, 0);
        moveFocus(nr, Math.min(c, grid[nr].length - 1));
        break;
      }
      case "Home": e.preventDefault(); moveFocus(r, 0); break;
      case "End": e.preventDefault(); moveFocus(r, grid[r].length - 1); break;
      case "Enter":
      case " ":
        if (r === 0) { e.preventDefault(); cycleSort(c); }
        break;
      default: break;
    }
  }

  // Resolve the body data row a pointer event landed on, or null. The index is
  // the row's position in currentRows (tbody holds exactly the shown data rows,
  // in order); the tfoot "more" row lives outside tbody and never resolves.
  function rowFromEvent(e) {
    const tr = e.target.closest("tbody tr");
    if (!tr || !tbody.contains(tr)) return null;
    const index = Array.prototype.indexOf.call(tbody.children, tr);
    if (index < 0 || index >= currentRows.length) return null;
    return { index, row: currentRows[index] };
  }

  function onClick(e) {
    const th = e.target.closest("th.sortable");
    if (th && table.contains(th)) { cycleSort(Number(th.dataset.col)); return; }
    if (onRowClick) {
      const hit = rowFromEvent(e);
      if (hit) onRowClick(hit.row, hit.index, e);
    }
  }

  // Hover delegation: collapse per-cell mouseover noise into one call per row
  // transition, and one (null, -1) call when the pointer leaves the table.
  let hoverIndex = -1;
  function onMouseover(e) {
    const hit = rowFromEvent(e);
    const idx = hit ? hit.index : -1;
    if (idx === hoverIndex) return;
    hoverIndex = idx;
    onRowHover(hit ? hit.row : null, idx, e);
  }
  function onMouseleave(e) {
    if (hoverIndex === -1) return;
    hoverIndex = -1;
    onRowHover(null, -1, e);
  }

  table.addEventListener("keydown", onKeydown);
  table.addEventListener("click", onClick);
  if (onRowHover) {
    table.addEventListener("mouseover", onMouseover);
    table.addEventListener("mouseleave", onMouseleave);
  }

  function setRows(next) {
    // Keep the caller's array by identity; never sort or mutate it.
    currentRows = Array.isArray(next) ? next : [];
    renderBody();
  }

  renderBody();

  function destroy() {
    table.removeEventListener("keydown", onKeydown);
    table.removeEventListener("click", onClick);
    if (onRowHover) {
      table.removeEventListener("mouseover", onMouseover);
      table.removeEventListener("mouseleave", onMouseleave);
    }
    if (table.parentNode) table.parentNode.removeChild(table);
  }

  return { el: table, setRows, destroy };
}
