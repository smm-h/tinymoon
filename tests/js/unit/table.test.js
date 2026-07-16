import { describe, it, expect } from "vitest";

// Unit tests for table.js: createTable -> {el, setRows, destroy}. Pins the two
// load-bearing decisions — caller-side sorting (the widget never sorts or
// mutates rows) and Node-returning formatters — plus the maxRows footer and the
// roving-tabindex grid.

const COLS = [
  { key: "name", label: "Name", sortable: true },
  { key: "size", label: "Size", align: "end" },
];

function makeRows() {
  return [
    { name: "c", size: 3 },
    { name: "a", size: 1 },
    { name: "b", size: 2 },
  ];
}

describe("createTable", () => {
  it("returns {el, setRows, destroy} and renders a header + body", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const t = createTable({ columns: COLS, rows: makeRows() });
    expect(t.el).toBeInstanceOf(HTMLElement);
    expect(t.el.getAttribute("role")).toBe("grid");
    expect(t.el.querySelectorAll("thead th").length).toBe(2);
    expect(t.el.querySelectorAll("tbody tr").length).toBe(3);
  });

  it("throws without a columns array", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    expect(() => createTable({})).toThrow(/columns array is required/);
  });

  it("renders a caption when given", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const t = createTable({ columns: COLS, caption: "Files" });
    expect(t.el.querySelector("caption").textContent).toBe("Files");
  });

  it("sortable header cycles aria-sort none -> ascending -> descending -> none and reports each", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const calls = [];
    const t = createTable({
      columns: COLS,
      rows: makeRows(),
      onSort: (key, dir) => calls.push([key, dir]),
    });
    const th = t.el.querySelector("thead th");
    expect(th.getAttribute("aria-sort")).toBe("none");
    th.click();
    expect(th.getAttribute("aria-sort")).toBe("ascending");
    th.click();
    expect(th.getAttribute("aria-sort")).toBe("descending");
    th.click();
    expect(th.getAttribute("aria-sort")).toBe("none");
    expect(calls).toEqual([
      ["name", "ascending"],
      ["name", "descending"],
      ["name", "none"],
    ]);
  });

  it("a non-sortable header has no aria-sort and never calls onSort", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    let called = false;
    const t = createTable({ columns: COLS, rows: makeRows(), onSort: () => { called = true; } });
    const sizeTh = t.el.querySelectorAll("thead th")[1];
    expect(sizeTh.hasAttribute("aria-sort")).toBe(false);
    sizeTh.click();
    expect(called).toBe(false);
  });

  it("NEVER sorts or mutates the rows array — DOM order equals input order", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const rows = makeRows();
    const snapshot = rows.map((r) => r.name).join(",");
    const t = createTable({ columns: COLS, rows });
    // Click sort several times — the widget must not touch the array.
    const th = t.el.querySelector("thead th");
    th.click();
    th.click();
    // The passed array is unchanged (same order, same reference contents).
    expect(rows.map((r) => r.name).join(",")).toBe(snapshot);
    // The rendered order matches the INPUT order, never a sorted order.
    const rendered = Array.from(t.el.querySelectorAll("tbody tr td:first-child")).map((td) => td.textContent);
    expect(rendered).toEqual(["c", "a", "b"]);
  });

  it("format may return a live DOM Node placed into the cell", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const marker = document.createElement("button");
    marker.textContent = "open";
    marker.className = "cell-node";
    const t = createTable({
      columns: [
        { key: "name", label: "Name" },
        { key: "size", label: "Action", format: () => marker },
      ],
      rows: [{ name: "a", size: 1 }],
    });
    const cell = t.el.querySelector("tbody tr td:nth-child(2)");
    // The EXACT node instance is in the cell (live element, not stringified).
    expect(cell.querySelector(".cell-node")).toBe(marker);
    expect(cell.textContent).toBe("open");
  });

  it("format returning a string is stringified into the cell", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const t = createTable({
      columns: [{ key: "size", label: "Size", format: (v) => v + " B" }],
      rows: [{ size: 10 }],
    });
    expect(t.el.querySelector("tbody td").textContent).toBe("10 B");
  });

  it("maxRows caps the body and shows a 'N more rows not shown' footer", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const rows = Array.from({ length: 5 }, (_, i) => ({ name: "r" + i, size: i }));
    const t = createTable({ columns: COLS, rows, maxRows: 2 });
    expect(t.el.querySelectorAll("tbody tr").length).toBe(2);
    const more = t.el.querySelector("tfoot .tm-table-more td");
    expect(more.textContent).toBe("3 more rows not shown");
    expect(more.colSpan).toBe(2);
  });

  it("setRows re-renders wholesale from the new array", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const t = createTable({ columns: COLS, rows: makeRows() });
    t.setRows([{ name: "z", size: 9 }]);
    expect(t.el.querySelectorAll("tbody tr").length).toBe(1);
    expect(t.el.querySelector("tbody td").textContent).toBe("z");
  });

  it("uses a roving tabindex: exactly one cell is tabbable and arrows move it", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const t = createTable({ columns: COLS, rows: makeRows() });
    const cells = t.el.querySelectorAll("[role='columnheader'],[role='gridcell']");
    const tabbable = Array.from(cells).filter((c) => c.tabIndex === 0);
    expect(tabbable.length).toBe(1);
    const first = t.el.querySelector("thead th");
    expect(first.tabIndex).toBe(0);
    // ArrowRight moves the roving focus to the next header cell.
    first.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const second = t.el.querySelectorAll("thead th")[1];
    expect(second.tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);
  });

  it("destroy detaches the table", async () => {
    const { createTable } = await import("../../../assets/js/table.js");
    const parent = document.createElement("div");
    const t = createTable({ columns: COLS, rows: makeRows() });
    parent.appendChild(t.el);
    t.destroy();
    expect(parent.children.length).toBe(0);
  });
});
