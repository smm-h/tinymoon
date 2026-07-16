// tinymoon — tree view: a keyboard-navigable hierarchical list following the
// ARIA Authoring Practices TreeView pattern. createTree({nodes, onSelect?}) ->
// {el, setNodes, expand, collapse, destroy}.
//
// SCOPE — SYNCHRONOUS DATA ONLY. The whole tree is built from the `nodes`
// array up front; there is no lazy/async child loading. Expanding a node
// reveals children that already exist in the DOM (hidden until then), it does
// NOT fetch them. Async/lazy trees need a loading state, a spinner-per-branch,
// and error handling per branch — a different (heavier) widget. If your tree's
// children arrive over the network, load them yourself and hand the resolved
// shape to setNodes().
//
// A11y model (APG TreeView): the container is role="tree"; every node is a
// role="treeitem" carrying aria-expanded when it has children; child lists are
// role="group". Exactly one treeitem is tabbable at a time (roving tabindex).
// Each treeitem's accessible name is pinned to its own label span via
// aria-labelledby so the name never bleeds in nested descendants.
//
// Keyboard (APG): ArrowDown/ArrowUp move to the next/previous VISIBLE treeitem;
// ArrowRight expands a collapsed parent then enters it; ArrowLeft collapses an
// expanded parent then exits to its parent; Home/End jump to the first/last
// visible treeitem; Enter/Space activate (onSelect) and toggle a parent.
// Depth indentation is CSS-driven off a --tm-tree-depth custom property.

import { el } from "./dom.js";
import { icon } from "./icons.js";

let treeIdSeq = 0;

// createTree({nodes, onSelect?}) -> {el, setNodes(nodes), expand(idOrPath),
//   collapse(idOrPath), destroy}
//
// nodes is a recursive array: [{ id, label, children?, open? }]. `id` is a
// stable key (required — expand/collapse address nodes by it); `label` is the
// row text; `children` is a nested nodes array; `open` seeds the initial
// expanded state of a parent. onSelect(node) fires when a treeitem is
// activated (Enter/Space or a row click).
export function createTree(opts) {
  if (!opts || !Array.isArray(opts.nodes)) {
    throw new Error("createTree: a nodes array is required");
  }
  const onSelect = typeof opts.onSelect === "function" ? opts.onSelect : null;
  const uid = "tm-tree-" + ++treeIdSeq;

  const root = el("ul", "tm-tree");
  root.setAttribute("role", "tree");
  if (opts.label) root.setAttribute("aria-label", String(opts.label));

  // Registry: id -> { node, li, group, twist }. Rebuilt on every setNodes.
  let byId = new Map();
  let nodes = opts.nodes;

  // -- build ------------------------------------------------------------------

  function buildNode(node, depth, labelSeq) {
    const li = el("li", "tm-tree-item");
    li.setAttribute("role", "treeitem");
    li.tabIndex = -1;

    const rowEl = el("div", "tm-tree-row");
    rowEl.style.setProperty("--tm-tree-depth", String(depth));

    const twist = el("span", "tm-tree-twist");
    twist.setAttribute("aria-hidden", "true");
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    if (hasChildren) twist.innerHTML = icon("chevron");
    rowEl.appendChild(twist);

    const labelEl = el("span", "tm-tree-label", node.label == null ? "" : String(node.label));
    const labelId = uid + "-label-" + labelSeq.n++;
    labelEl.id = labelId;
    rowEl.appendChild(labelEl);
    // Pin the treeitem's accessible name to its own label, not its subtree.
    li.setAttribute("aria-labelledby", labelId);

    li.appendChild(rowEl);

    let group = null;
    if (hasChildren) {
      const open = node.open === true;
      li.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) li.classList.add("open");
      group = el("ul", "tm-tree-group");
      group.setAttribute("role", "group");
      if (!open) group.hidden = true;
      for (const child of node.children) {
        group.appendChild(buildNode(child, depth + 1, labelSeq));
      }
      li.appendChild(group);
    }

    if (node.id != null) byId.set(String(node.id), { node, li, group, twist });
    return li;
  }

  function build() {
    root.textContent = "";
    byId = new Map();
    const labelSeq = { n: 0 };
    for (const node of nodes) root.appendChild(buildNode(node, 0, labelSeq));
    resetRoving();
  }

  // -- roving tabindex --------------------------------------------------------

  // The flat list of currently VISIBLE treeitems (those with no collapsed
  // ancestor group). Read live from the DOM so it always reflects expansion.
  function visibleItems() {
    return Array.from(root.querySelectorAll('[role="treeitem"]')).filter(
      (li) => !li.closest('[role="group"][hidden]'),
    );
  }

  // Ensure exactly one treeitem carries tabindex 0 (the first visible one),
  // every other -1.
  function resetRoving() {
    const items = Array.from(root.querySelectorAll('[role="treeitem"]'));
    for (const li of items) li.tabIndex = -1;
    const visible = visibleItems();
    if (visible.length) visible[0].tabIndex = 0;
  }

  function focusItem(li) {
    if (!li) return;
    for (const other of root.querySelectorAll('[role="treeitem"]')) other.tabIndex = -1;
    li.tabIndex = 0;
    li.focus();
  }

  // -- expand / collapse ------------------------------------------------------

  function setOpen(li, open) {
    if (!li || li.getAttribute("aria-expanded") == null) return;
    li.setAttribute("aria-expanded", open ? "true" : "false");
    li.classList.toggle("open", open);
    const group = li.querySelector(':scope > [role="group"]');
    if (group) group.hidden = !open;
  }

  // Resolve an id (string/number) or a path (array of ids from the root) to the
  // target treeitem's registry entry, expanding ancestors along a path so the
  // target is reachable/visible.
  function resolve(idOrPath) {
    if (Array.isArray(idOrPath)) {
      let entry = null;
      for (const step of idOrPath) {
        entry = byId.get(String(step));
        if (!entry) return null;
        // Open each ancestor so the next step is visible.
        if (entry.group) setOpen(entry.li, true);
      }
      return entry;
    }
    return byId.get(String(idOrPath)) || null;
  }

  function expand(idOrPath) {
    const entry = resolve(idOrPath);
    if (entry && entry.group) setOpen(entry.li, true);
    resetRoving();
  }

  function collapse(idOrPath) {
    const entry = resolve(idOrPath);
    if (entry && entry.group) setOpen(entry.li, false);
    resetRoving();
  }

  // -- interaction ------------------------------------------------------------

  function nodeOf(li) {
    for (const entry of byId.values()) {
      if (entry.li === li) return entry.node;
    }
    return null;
  }

  function activate(li) {
    const node = nodeOf(li);
    // A parent row toggles its own expansion in addition to selecting.
    if (li.getAttribute("aria-expanded") != null) {
      const open = li.getAttribute("aria-expanded") === "true";
      setOpen(li, !open);
      resetRoving();
      focusItem(li);
    }
    if (node && onSelect) onSelect(node);
  }

  function onClick(e) {
    const li = e.target.closest('[role="treeitem"]');
    if (!li || !root.contains(li)) return;
    // A click on the twist toggles expansion only (no selection).
    if (e.target.closest(".tm-tree-twist") && li.getAttribute("aria-expanded") != null) {
      const open = li.getAttribute("aria-expanded") === "true";
      setOpen(li, !open);
      resetRoving();
      focusItem(li);
      return;
    }
    activate(li);
  }

  function onKeydown(e) {
    const li = e.target.closest('[role="treeitem"]');
    if (!li || !root.contains(li)) return;
    const visible = visibleItems();
    const idx = visible.indexOf(li);
    const expanded = li.getAttribute("aria-expanded");
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (idx < visible.length - 1) focusItem(visible[idx + 1]);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (idx > 0) focusItem(visible[idx - 1]);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (expanded === "false") { setOpen(li, true); }
        else if (expanded === "true") {
          const child = li.querySelector(':scope > [role="group"] > [role="treeitem"]');
          if (child) focusItem(child);
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (expanded === "true") { setOpen(li, false); }
        else {
          const parent = li.parentElement.closest('[role="treeitem"]');
          if (parent) focusItem(parent);
        }
        break;
      case "Home":
        e.preventDefault();
        if (visible.length) focusItem(visible[0]);
        break;
      case "End":
        e.preventDefault();
        if (visible.length) focusItem(visible[visible.length - 1]);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        activate(li);
        break;
      default:
        break;
    }
  }

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);

  function setNodes(next) {
    nodes = Array.isArray(next) ? next : [];
    build();
  }

  build();

  function destroy() {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeydown);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { el: root, setNodes, expand, collapse, destroy };
}
