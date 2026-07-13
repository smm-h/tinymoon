// tinymoon — custom select (listbox) replacing the banned native <select>:
// keyboard navigation, type-ahead, and viewport-aware flip-up.

import { $$, el } from "./dom.js";
import { icon } from "./icons.js";
import { cssVar } from "./settings.js";

// At most one Select is open at a time; this single module-level document
// listener closes it on an outside pointerdown. Instances never register
// their own document listeners, so nothing accumulates.
let openSelect = null;
document.addEventListener("pointerdown", (e) => {
  if (openSelect && !openSelect.root.contains(e.target)) openSelect.close();
});

export class Select {
  // opts: { items: [..], value, onChange(v), labels?, width? }
  constructor(opts) {
    this.items = opts.items || [];
    this.value = opts.value !== undefined ? opts.value : (this.items[0] ?? "");
    this.onChange = opts.onChange || (() => {});
    this.labels = opts.labels || null; // optional value → label map
    this.root = el("div", "sel");
    if (opts.width) this.root.style.width = opts.width;
    this.btn = el("button", "sel-btn");
    this.btn.type = "button";
    this.btn.setAttribute("aria-haspopup", "listbox");
    this.labelEl = el("span", "sel-label");
    this.btn.appendChild(this.labelEl);
    const chev = el("span");
    chev.innerHTML = icon("chevron");
    this.btn.appendChild(chev.firstChild);
    this.menu = el("div", "sel-menu");
    this.menu.setAttribute("role", "listbox");
    this.root.appendChild(this.btn);
    this.root.appendChild(this.menu);
    this.hoverIdx = -1;
    this.typeahead = "";
    this.typeaheadT = 0;

    this.btn.addEventListener("click", () => this.toggle());
    this.btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.open();
      }
    });
    this.menu.addEventListener("keydown", (e) => this.menuKey(e));
    this.renderLabel();
    this.renderMenu();
  }

  labelOf(v) { return (this.labels && this.labels[v]) || String(v); }

  setItems(items, keepValue) {
    this.items = items;
    if (!keepValue || !items.includes(this.value)) this.value = items[0] ?? "";
    this.renderLabel();
    this.renderMenu();
  }

  set(v) { this.value = v; this.renderLabel(); this.renderMenu(); }

  renderLabel() { this.labelEl.textContent = this.labelOf(this.value) || "—"; }

  renderMenu() {
    this.menu.textContent = "";
    this.items.forEach((v, i) => {
      const o = el("div", "sel-opt", this.labelOf(v));
      o.setAttribute("role", "option");
      if (v === this.value) o.classList.add("selected");
      o.addEventListener("click", () => this.pick(i));
      o.addEventListener("pointerenter", () => this.setHover(i));
      this.menu.appendChild(o);
    });
  }

  setHover(i) {
    this.hoverIdx = i;
    $$(".sel-opt", this.menu).forEach((o, j) => o.classList.toggle("hover", j === i));
    const o = this.menu.children[i];
    if (o) o.scrollIntoView({ block: "nearest" });
  }

  pick(i) {
    const v = this.items[i];
    if (v === undefined) return;
    const changed = v !== this.value;
    this.value = v;
    this.renderLabel();
    this.renderMenu();
    this.close();
    this.btn.focus();
    if (changed) this.onChange(v);
  }

  toggle() { this.root.classList.contains("open") ? this.close() : this.open(); }

  open() {
    if (openSelect && openSelect !== this) openSelect.close();
    openSelect = this;
    this.root.classList.add("open");
    // Flip up when the menu would clip the viewport bottom (or the footer
    // slot — read live so the heuristic tracks the configured footer).
    const footerH = parseFloat(cssVar("--footer-h")) || 0;
    const r = this.root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - footerH - r.bottom;
    this.menu.classList.toggle("up", spaceBelow < Math.min(260, this.items.length * 30 + 8));
    this.menu.tabIndex = -1;
    this.menu.focus();
    this.setHover(Math.max(0, this.items.indexOf(this.value)));
  }

  close() {
    this.root.classList.remove("open");
    if (openSelect === this) openSelect = null;
  }

  menuKey(e) {
    const n = this.items.length;
    if (e.key === "ArrowDown") { e.preventDefault(); this.setHover(Math.min(n - 1, this.hoverIdx + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.setHover(Math.max(0, this.hoverIdx - 1)); }
    else if (e.key === "Home") { e.preventDefault(); this.setHover(0); }
    else if (e.key === "End") { e.preventDefault(); this.setHover(n - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.pick(this.hoverIdx); }
    else if (e.key === "Escape") { e.preventDefault(); this.close(); this.btn.focus(); }
    else if (e.key === "Tab") { this.close(); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      // type-ahead
      const now = Date.now();
      if (now - this.typeaheadT > 800) this.typeahead = "";
      this.typeaheadT = now;
      this.typeahead += e.key.toLowerCase();
      const idx = this.items.findIndex((v) => this.labelOf(v).toLowerCase().startsWith(this.typeahead));
      if (idx >= 0) this.setHover(idx);
    }
  }
}
