import { describe, it, expect } from "vitest";

// Unit tests for tree.js: createTree -> {el, setNodes, expand, collapse,
// destroy}. Pins the APG TreeView a11y structure and — especially — the
// keyboard navigation model (arrow keys, Home/End, Enter/Space).

function nodes() {
  return [
    {
      id: "src", label: "src", open: true, children: [
        { id: "app", label: "app.js" },
        { id: "lib", label: "lib", children: [{ id: "util", label: "util.js" }] },
      ],
    },
    { id: "docs", label: "docs", children: [{ id: "readme", label: "README" }] },
    { id: "pkg", label: "package.json" },
  ];
}

function key(el, k) {
  el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
}

function tabbable(tree) {
  return Array.from(tree.el.querySelectorAll('[role="treeitem"]')).filter((li) => li.tabIndex === 0);
}

describe("createTree", () => {
  it("throws without a nodes array", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    expect(() => createTree({})).toThrow(/nodes array is required/);
  });

  it("renders role=tree with treeitems and groups", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    expect(t.el.getAttribute("role")).toBe("tree");
    expect(t.el.querySelectorAll('[role="treeitem"]').length).toBe(7);
    expect(t.el.querySelectorAll('[role="group"]').length).toBe(3);
  });

  it("pins each treeitem's accessible name to its own label via aria-labelledby", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const first = t.el.querySelector('[role="treeitem"]');
    const labelId = first.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(t.el.querySelector("#" + labelId).textContent).toBe("src");
  });

  it("seeds aria-expanded from open and hides collapsed groups", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const src = t.el.querySelector('[role="treeitem"]');
    expect(src.getAttribute("aria-expanded")).toBe("true");
    // docs is collapsed by default -> its group is hidden.
    const docs = t.el.querySelectorAll(':scope > [role="treeitem"]')[1];
    expect(docs.getAttribute("aria-expanded")).toBe("false");
    expect(docs.querySelector('[role="group"]').hidden).toBe(true);
  });

  it("leaf nodes carry no aria-expanded", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const pkg = Array.from(t.el.querySelectorAll('[role="treeitem"]')).find(
      (li) => li.textContent.includes("package.json"),
    );
    expect(pkg.hasAttribute("aria-expanded")).toBe(false);
  });

  it("roving tabindex: exactly one treeitem is tabbable (the first visible)", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const tab = tabbable(t);
    expect(tab.length).toBe(1);
    expect(tab[0].getAttribute("aria-labelledby")).toBeTruthy();
    expect(t.el.querySelector("#" + tab[0].getAttribute("aria-labelledby")).textContent).toBe("src");
  });

  it("ArrowDown / ArrowUp move roving focus across visible items", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const src = t.el.querySelector('[role="treeitem"]');
    key(src, "ArrowDown"); // -> app.js (visible child of open src)
    let focused = tabbable(t)[0];
    expect(focused.textContent).toContain("app.js");
    key(focused, "ArrowUp");
    expect(tabbable(t)[0].textContent).toContain("src");
  });

  it("ArrowRight expands a collapsed parent, then enters its first child", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const docs = Array.from(t.el.querySelectorAll(':scope > [role="treeitem"]'))[1];
    // Move roving focus to docs first.
    docs.tabIndex = 0;
    key(docs, "ArrowRight");
    expect(docs.getAttribute("aria-expanded")).toBe("true");
    key(docs, "ArrowRight"); // enter first child
    expect(tabbable(t)[0].textContent).toContain("README");
  });

  it("ArrowLeft collapses an expanded parent; on a child it focuses the parent", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const src = t.el.querySelector('[role="treeitem"]');
    // src is open; ArrowLeft collapses it.
    key(src, "ArrowLeft");
    expect(src.getAttribute("aria-expanded")).toBe("false");
    // Re-open and move into the child, then ArrowLeft returns to src.
    key(src, "ArrowRight");
    key(src, "ArrowRight"); // focus app.js
    const child = tabbable(t)[0];
    expect(child.textContent).toContain("app.js");
    key(child, "ArrowLeft");
    expect(tabbable(t)[0].textContent).toContain("src");
  });

  it("Home / End jump to the first / last visible item", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const src = t.el.querySelector('[role="treeitem"]');
    key(src, "End");
    expect(tabbable(t)[0].textContent).toContain("package.json");
    const last = tabbable(t)[0];
    key(last, "Home");
    expect(tabbable(t)[0].textContent).toContain("src");
  });

  it("Enter activates onSelect and toggles a parent; Space too", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const picked = [];
    const t = createTree({ nodes: nodes(), onSelect: (n) => picked.push(n.id) });
    const src = t.el.querySelector('[role="treeitem"]');
    key(src, "Enter"); // parent: toggles closed + selects
    expect(src.getAttribute("aria-expanded")).toBe("false");
    expect(picked).toEqual(["src"]);
    key(src, " ");
    expect(src.getAttribute("aria-expanded")).toBe("true");
    expect(picked).toEqual(["src", "src"]);
  });

  it("clicking the twist toggles expansion without selecting", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const picked = [];
    const t = createTree({ nodes: nodes(), onSelect: (n) => picked.push(n.id) });
    const src = t.el.querySelector('[role="treeitem"]');
    src.querySelector(".tm-tree-twist").click();
    expect(src.getAttribute("aria-expanded")).toBe("false");
    expect(picked).toEqual([]); // twist click never selects
  });

  it("clicking a leaf row selects it", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const picked = [];
    const t = createTree({ nodes: nodes(), onSelect: (n) => picked.push(n.id) });
    const pkg = Array.from(t.el.querySelectorAll('[role="treeitem"]')).find(
      (li) => li.textContent.includes("package.json"),
    );
    pkg.querySelector(".tm-tree-row").click();
    expect(picked).toEqual(["pkg"]);
  });

  it("expand/collapse address nodes by id", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    const docs = Array.from(t.el.querySelectorAll(':scope > [role="treeitem"]'))[1];
    t.expand("docs");
    expect(docs.getAttribute("aria-expanded")).toBe("true");
    t.collapse("docs");
    expect(docs.getAttribute("aria-expanded")).toBe("false");
  });

  it("expand by path opens ancestors so the target is reachable", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    // lib is nested under src; open it via a path.
    t.expand(["src", "lib"]);
    const lib = Array.from(t.el.querySelectorAll('[role="treeitem"]')).find(
      (li) => li.getAttribute("aria-labelledby") &&
        t.el.querySelector("#" + li.getAttribute("aria-labelledby")).textContent === "lib",
    );
    expect(lib.getAttribute("aria-expanded")).toBe("true");
  });

  it("setNodes rebuilds the tree", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const t = createTree({ nodes: nodes() });
    t.setNodes([{ id: "only", label: "only" }]);
    expect(t.el.querySelectorAll('[role="treeitem"]').length).toBe(1);
    expect(t.el.textContent).toContain("only");
  });

  it("destroy detaches the tree", async () => {
    const { createTree } = await import("../../../assets/js/tree.js");
    const parent = document.createElement("div");
    const t = createTree({ nodes: nodes() });
    parent.appendChild(t.el);
    t.destroy();
    expect(parent.children.length).toBe(0);
  });
});
