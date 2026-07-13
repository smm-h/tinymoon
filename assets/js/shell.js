// tinymoon — app shell: builds the sidebar/nav/topbar/content frame, mounts
// the framework overlay roots, and runs the hash router.
//
// mountShell(config) → {navigate(route), setBusy(msg), setTitle(title, sub)}
//
// config (required unless marked optional):
//   root           — container element the shell frame is appended to
//   brand          — {name, logoHTML}: name feeds the collapsed-sidebar
//                    initial (--brand-initial); logoHTML is the sidebar
//                    logo markup
//   routes         — {key: {title, icon, view: () => viewObj, tip?,
//                    hidden?}}. hidden routes get no nav item but stay
//                    routable.
//   defaultRoute   — route key used for an empty or unknown hash
//   legacyRoutes?  — {oldKey: "newRoute"}: old hashes redirect, deep-link
//                    tails are preserved
//   topbarActions? — array of nodes or {icon, tip, onClick} specs rendered
//                    into #tm-topbar-actions
//   footer?        — {height, node}: sets --footer-h and appends node to
//                    the body. Without it --footer-h stays 0.
//
// View contract: {root, built, build(), refresh(), setSub?(sub)}. The router
// creates each view's section element (section.view) inside #tm-content and
// assigns it to view.root before the first build() — views never pre-declare
// HTML. build() must be idempotent (guard on .built); refresh() runs on
// every visit; setSub(sub) receives the deep-link tail ("#/key/a/b" → "a/b")
// before refresh().

import { $$, el } from "./dom.js";
import { icon } from "./icons.js";
import { ensureTooltip } from "./tooltip.js";

function need(cond, msg) { if (!cond) throw new Error("mountShell: " + msg); }

function ensureRoot(id) {
  let node = document.getElementById(id);
  if (!node) {
    node = el("div");
    node.id = id;
    document.body.appendChild(node);
  }
  return node;
}

export function mountShell(config) {
  const { root, brand, routes, defaultRoute, legacyRoutes, topbarActions, footer } = config || {};
  need(root && root.appendChild, "root element is required");
  need(brand && brand.name && brand.logoHTML, "brand {name, logoHTML} is required");
  need(routes && Object.keys(routes).length, "routes is required");
  need(defaultRoute && routes[defaultRoute], "defaultRoute must name a route");
  if (footer) need(footer.node && footer.height, "footer requires {height, node}");

  // ---------- frame ----------

  const app = el("div");
  app.id = "tm-app";

  const sidebar = el("aside");
  sidebar.id = "tm-sidebar";
  const logo = el("div");
  logo.id = "tm-logo";
  logo.innerHTML = brand.logoHTML;
  // The collapsed sidebar shows only the brand's first letter (see
  // shell.css); CSS content needs a quoted string, hence JSON.stringify.
  document.documentElement.style.setProperty("--brand-initial", JSON.stringify(brand.name.charAt(0)));
  const nav = el("nav");
  nav.id = "tm-nav";
  nav.setAttribute("aria-label", "Main");
  for (const [key, r] of Object.entries(routes)) {
    if (r.hidden) continue;
    const b = el("button", "nav-item");
    b.dataset.route = key;
    b.innerHTML = icon(r.icon);
    b.appendChild(el("span", "nav-label", r.title));
    if (r.tip) b.dataset.tooltip = r.tip;
    b.addEventListener("click", () => { location.hash = "#/" + key; });
    nav.appendChild(b);
  }
  sidebar.appendChild(logo);
  sidebar.appendChild(nav);

  const main = el("div");
  main.id = "tm-main";
  const topbar = el("header");
  topbar.id = "tm-topbar";
  const pageTitle = el("span");
  pageTitle.id = "tm-page-title";
  const pageSub = el("span");
  pageSub.id = "tm-page-sub";
  const busy = el("span", "hidden");
  busy.id = "tm-busy";
  const actions = el("div");
  actions.id = "tm-topbar-actions";
  for (const a of topbarActions || []) {
    if (a instanceof Node) { actions.appendChild(a); continue; }
    const b = el("button", "icon-btn");
    b.type = "button";
    b.innerHTML = icon(a.icon);
    if (a.tip) b.dataset.tooltip = a.tip;
    b.addEventListener("click", a.onClick);
    actions.appendChild(b);
  }
  topbar.appendChild(pageTitle);
  topbar.appendChild(pageSub);
  topbar.appendChild(busy);
  topbar.appendChild(actions);
  const content = el("div");
  content.id = "tm-content";
  main.appendChild(topbar);
  main.appendChild(content);

  app.appendChild(sidebar);
  app.appendChild(main);
  root.appendChild(app);

  // Framework overlay mount points (primitives also create these lazily;
  // mounting them here keeps stacking order deterministic).
  ensureRoot("tm-ctx-root").setAttribute("role", "menu");
  ensureRoot("tm-modal-root");
  ensureRoot("tm-toast-root");
  ensureTooltip();

  if (footer) {
    const h = typeof footer.height === "number" ? footer.height + "px" : footer.height;
    document.documentElement.style.setProperty("--footer-h", h);
    document.body.appendChild(footer.node);
  }

  // ---------- topbar API ----------

  function setTitle(title, sub) {
    pageTitle.textContent = title || "";
    pageSub.textContent = sub || "";
  }

  function setBusy(msg) {
    if (!msg) { busy.classList.add("hidden"); busy.textContent = ""; return; }
    busy.innerHTML = icon("spinner");
    busy.appendChild(el("span", null, msg));
    busy.classList.remove("hidden");
  }

  // ---------- hash router ----------

  let currentRoute = null;
  let currentHash = null;

  function route() {
    const raw = location.hash.replace(/^#\//, "") || defaultRoute;
    if (currentHash === raw) return;
    currentHash = raw;
    // Routes can carry a sub-path (deep link): #/key/<tail>.
    const parts = raw.split("/");
    const key = parts[0];
    if (legacyRoutes && legacyRoutes[key] !== undefined) {
      // Old bookmarks keep working; the tail rides along.
      const tail = parts.length > 1 ? "/" + parts.slice(1).join("/") : "";
      location.replace("#/" + legacyRoutes[key] + tail);
      return;
    }
    const sub = parts.length > 1 ? parts.slice(1).map(decodeURIComponent).join("/") : "";
    const r = routes[key] || routes[defaultRoute];
    const name = routes[key] ? key : defaultRoute;
    const sameView = currentRoute === name;
    currentRoute = name;

    $$(".nav-item", nav).forEach((b) => b.classList.toggle("active", b.dataset.route === name));
    setTitle(r.title, "");
    $$(".view", content).forEach((v) => v.classList.add("hidden"));
    const view = r.view();
    if (!view.root) {
      view.root = el("section", "view hidden");
      content.appendChild(view.root);
    }
    view.build();
    if (sub && view.setSub) view.setSub(sub);
    view.root.classList.remove("hidden");
    if (!sameView) {
      // retrigger the entry animation
      view.root.style.animation = "none";
      void view.root.offsetWidth;
      view.root.style.animation = "";
      content.scrollTop = 0;
    }
    view.refresh();
  }

  window.addEventListener("hashchange", route);
  route();

  return {
    navigate(r) { location.hash = "#/" + r; },
    setBusy,
    setTitle,
  };
}
