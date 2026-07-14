// tinymoon — custom context menu. Regions register a provider: an element
// with dataset.ctx = key gets providers[key](el)'s items when right-clicked;
// nested [data-ctx] regions stack their items with separators. The app can
// register a footer provider whose items are appended to every menu.
// Keyboard: Shift+F10 or the ContextMenu/Apps key opens the menu at the
// focused [data-ctx] region. Home/End navigate to first/last item.

import { $$, el } from "./dom.js";
import { icon } from "./icons.js";
import { pushLayer, ensureRoot, getCopyData } from "./kernel.js";

const ctxProviders = {};
let ctxFooter = null;

// Natively focusable tag names — elements that already accept keyboard focus
// without needing tabindex. Used by the focusability enforcement in
// registerCtx to avoid setting a redundant tabindex.
const NATIVE_FOCUSABLE = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

// registerCtx(key, provider): provider(el) returns
// [{label, icon, action} | {sep: true} | {head}] items.
// Also enforces focusability: every [data-ctx] element matching `key` gets
// tabindex="0" if it is not natively focusable, so the Shift+F10 keyboard
// path works automatically.
export function registerCtx(key, provider) {
  if (key in ctxProviders) throw new Error('registerCtx: key "' + key + '" already exists');
  ctxProviders[key] = provider;
  _enforceFocusability(key);
}

// Ensure all existing [data-ctx] elements for a given key are focusable.
function _enforceFocusability(key) {
  const nodes = $$('[data-ctx="' + key + '"]');
  for (const node of nodes) {
    if (!NATIVE_FOCUSABLE.has(node.tagName) && !node.hasAttribute("tabindex")) {
      node.setAttribute("tabindex", "0");
    }
  }
}

// Enforce focusability on a single element if it has a registered provider.
function _enforceSingleFocusability(node) {
  const key = node.dataset && node.dataset.ctx;
  if (!key || !(key in ctxProviders)) return;
  if (!NATIVE_FOCUSABLE.has(node.tagName) && !node.hasAttribute("tabindex")) {
    node.setAttribute("tabindex", "0");
  }
}

// MutationObserver: catch dynamically added [data-ctx] elements (e.g. views
// built lazily after registerCtx has already run).
const _observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type === "attributes" && m.attributeName === "data-ctx") {
      _enforceSingleFocusability(m.target);
    } else if (m.type === "childList") {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.dataset && node.dataset.ctx) _enforceSingleFocusability(node);
        // Also check descendants of added subtrees.
        if (node.querySelectorAll) {
          for (const desc of node.querySelectorAll("[data-ctx]")) {
            _enforceSingleFocusability(desc);
          }
        }
      }
    }
  }
});
_observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-ctx"],
  childList: true,
  subtree: true,
});

// registerCtxFooter(fn): fn() returns items appended to every context menu
// (after a separator). No footer is shown when unregistered.
export function registerCtxFooter(fn) { ctxFooter = fn; }

let removeLayer = null;
let _triggerElement = null; // element that opened the menu (for focus restore)

export function showCtxMenu(x, y, items, trigger) {
  _triggerElement = trigger || null;
  const menu = ensureRoot("tm-ctx-root", { role: "menu" });
  menu.textContent = "";
  for (const it of items) {
    if (it.sep) { menu.appendChild(el("div", "ctx-sep")); continue; }
    if (it.head) { menu.appendChild(el("div", "ctx-head", it.head)); continue; }
    const b = el("button", "ctx-item");
    b.setAttribute("role", "menuitem");
    b.innerHTML = icon(it.icon || "check");
    b.appendChild(el("span", null, it.label));
    b.addEventListener("click", () => { hideCtxMenu(); it.action(); });
    menu.appendChild(b);
  }
  menu.classList.add("open");
  const r = menu.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8) x = window.innerWidth - r.width - 8;
  if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  const first = menu.querySelector("[role='menuitem']");
  if (first) first.focus();
  if (removeLayer) removeLayer();
  removeLayer = pushLayer(() => hideCtxMenu());
}

export function hideCtxMenu() {
  if (removeLayer) { removeLayer(); removeLayer = null; }
  const menu = document.getElementById("tm-ctx-root");
  if (menu) menu.classList.remove("open");
  // Restore focus to the element that triggered the menu.
  if (_triggerElement && _triggerElement.isConnected) {
    _triggerElement.focus();
    _triggerElement = null;
  }
}

// Collect context menu items for a given target element by walking up the
// [data-ctx] ancestor chain, prepending a Copy item for copyable elements,
// and appending footer items.
function _collectItems(target) {
  let items = [];

  // If the target (or an ancestor) is a registered copyable, prepend a
  // Copy item that writes the text data to the clipboard.
  const copyData = getCopyData(target);
  if (copyData) {
    items.push({
      label: "Copy",
      icon: "copy",
      action: () => navigator.clipboard.writeText(copyData.text),
    });
  }

  let node = target.closest("[data-ctx]");
  while (node) {
    const p = ctxProviders[node.dataset.ctx];
    if (p) {
      const part = p(node);
      if (part && part.length) {
        if (items.length) items.push({ sep: true });
        items = items.concat(part);
      }
    }
    node = node.parentElement ? node.parentElement.closest("[data-ctx]") : null;
  }
  if (ctxFooter) {
    const foot = ctxFooter();
    if (foot && foot.length) {
      if (items.length) items.push({ sep: true });
      items = items.concat(foot);
    }
  }
  return items;
}

document.addEventListener("contextmenu", (e) => {
  // Native inputs keep the browser menu (paste etc. must stay usable).
  if (e.target.closest("input, textarea")) return;
  const items = _collectItems(e.target);
  // Only prevent the native menu when the framework has items to show.
  if (!items.length) { hideCtxMenu(); return; }
  e.preventDefault();
  showCtxMenu(e.clientX, e.clientY, items, e.target);
});

// Keyboard entry: Shift+F10 and the ContextMenu/Apps key open the context
// menu at the focused [data-ctx] region.
document.addEventListener("keydown", (e) => {
  const isShiftF10 = e.key === "F10" && e.shiftKey;
  const isMenuKey = e.key === "ContextMenu";
  if (!isShiftF10 && !isMenuKey) return;

  const target = document.activeElement;
  if (!target) return;
  const ctxNode = target.closest("[data-ctx]");
  if (!ctxNode) return;

  const items = _collectItems(target);
  if (!items.length) return;

  e.preventDefault();
  // Position at the bottom-center of the focused element.
  const rect = ctxNode.getBoundingClientRect();
  showCtxMenu(
    rect.left + rect.width / 2,
    rect.bottom,
    items,
    target
  );
});

document.addEventListener("pointerdown", (e) => {
  const menu = document.getElementById("tm-ctx-root");
  if (menu && !menu.contains(e.target)) hideCtxMenu();
});
document.addEventListener("keydown", (e) => {
  const menu = document.getElementById("tm-ctx-root");
  if (!menu || !menu.classList.contains("open")) return;
  const items = $$("[role='menuitem']", menu);
  const idx = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); (items[idx + 1] || items[0]).focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); (items[idx - 1] || items[items.length - 1]).focus(); }
  else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
  else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
});
