// tinymoon — custom context menu. Regions register a provider: an element
// with dataset.ctx = key gets providers[key](el)'s items when right-clicked;
// nested [data-ctx] regions stack their items with separators. The app can
// register a footer provider whose items are appended to every menu.

import { $$, el } from "./dom.js";
import { icon } from "./icons.js";

const ctxProviders = {};
let ctxFooter = null;

// registerCtx(key, provider): provider(el) returns
// [{label, icon, action} | {sep: true} | {head}] items.
export function registerCtx(key, provider) { ctxProviders[key] = provider; }

// registerCtxFooter(fn): fn() returns items appended to every context menu
// (after a separator). No footer is shown when unregistered.
export function registerCtxFooter(fn) { ctxFooter = fn; }

function ctxRoot() {
  let menu = document.getElementById("tm-ctx-root");
  if (!menu) {
    menu = el("div");
    menu.id = "tm-ctx-root";
    menu.setAttribute("role", "menu");
    document.body.appendChild(menu);
  }
  return menu;
}

export function showCtxMenu(x, y, items) {
  const menu = ctxRoot();
  menu.textContent = "";
  for (const it of items) {
    if (it.sep) { menu.appendChild(el("div", "ctx-sep")); continue; }
    if (it.head) { menu.appendChild(el("div", "ctx-head", it.head)); continue; }
    const b = el("button", "ctx-item");
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
  const first = menu.querySelector(".ctx-item");
  if (first) first.focus();
}

export function hideCtxMenu() {
  const menu = document.getElementById("tm-ctx-root");
  if (menu) menu.classList.remove("open");
}

document.addEventListener("contextmenu", (e) => {
  // Native inputs keep the browser menu (paste etc. must stay usable).
  if (e.target.closest("input, textarea")) return;
  e.preventDefault();
  let node = e.target.closest("[data-ctx]");
  let items = [];
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
  if (!items.length) { hideCtxMenu(); return; }
  showCtxMenu(e.clientX, e.clientY, items);
});
document.addEventListener("pointerdown", (e) => {
  const menu = document.getElementById("tm-ctx-root");
  if (menu && !menu.contains(e.target)) hideCtxMenu();
});
document.addEventListener("keydown", (e) => {
  const menu = document.getElementById("tm-ctx-root");
  if (!menu || !menu.classList.contains("open")) return;
  const items = $$(".ctx-item", menu);
  const idx = items.indexOf(document.activeElement);
  if (e.key === "Escape") { hideCtxMenu(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); (items[idx + 1] || items[0]).focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); (items[idx - 1] || items[items.length - 1]).focus(); }
});
