// tinymoon — app shell: builds the sidebar/nav/topbar/content frame, mounts
// the framework overlay roots, and runs the hash router.
//
// mountShell(config) → {navigate(route), setBusy(msg), setTitle(title, sub),
// refreshCurrent()}
//
// config (required unless marked optional):
//   root           — container element the shell frame is appended to
//   brand          — {name, logoHTML}: name feeds the collapsed-sidebar
//                    initial (--brand-initial); logoHTML is the sidebar
//                    logo markup
//   routes         — {key: {title, icon, view, tip?, hidden?, eager?}}.
//                    view can be:
//                      () => viewObj   — factory returning a view object
//                      "<h2>…</h2>"   — HTML string (wrapped automatically)
//                      element         — a DOM Element or <template>
//                    hidden routes get no nav item but stay routable.
//                    eager: true builds the view (hidden) at mount.
//   defaultRoute   — route key used for an empty or unknown hash
//   legacyRoutes?  — {oldKey: "newRoute"}: old hashes redirect, deep-link
//                    tails are preserved
//   topbarActions? — array of nodes or {icon, tip, onClick} specs rendered
//                    into #tm-topbar-actions
//   footer?        — {height, node}: sets --footer-h and appends node to
//                    the body. Without it --footer-h stays 0.
//   onRoute?       — fn(routeKey, sub): called after the router finishes
//                    handling a route (view built, setSub applied, refresh
//                    run, title set), including the initial route during
//                    mount. routeKey is the resolved route key (post
//                    legacy-redirect); sub is the deep-link tail or null.
//
// View contract: {root, built, build(), refresh(), setSub?(sub)}. The router
// creates each view's section element (section.view) inside #tm-content and
// assigns it to view.root before the first build() — views never pre-declare
// HTML. build() must be idempotent (guard on .built); refresh() runs on
// every visit; setSub(sub) receives the deep-link tail ("#/key/a/b" → "a/b")
// before refresh().
//
// Declarative shorthand: view can also be a string (HTML fragment) or an
// Element (e.g. a <template>'s content or any DOM node). The shell wraps
// these in a minimal view object automatically. The full object contract
// still works — this is an addition, not a replacement.

import { $$, el } from "./dom.js";
import { icon } from "./icons.js";
import { ensureTooltip } from "./tooltip.js";
import { ensureRoot } from "./kernel.js";
import { swipeToClose } from "./drawer.js";

// Live handles to the mounted shell's #tm-page-sub and aria-live announcer,
// backing setPageSub()/announce() (used by the createView ctx). No-op unmounted.
let _pageSub = null;
let _announcer = null;

export function setPageSub(text) { if (_pageSub) _pageSub.textContent = text || ""; }
export function announce(msg) { if (_announcer) _announcer.textContent = msg || ""; }

// Wrap a declarative view value (string HTML or Element) into a view object,
// cached by identity so repeated calls return the same instance.
const _declCache = new Map();
function resolveView(viewSpec) {
  if (typeof viewSpec === "function") return viewSpec();
  // declarative: string or Element — wrap once, cache by identity
  if (_declCache.has(viewSpec)) return _declCache.get(viewSpec);
  const wrapper = {
    root: null,
    built: false,
    build() {
      if (this.built) return;
      this.built = true;
      if (typeof viewSpec === "string") {
        this.root.innerHTML = viewSpec;
      } else if (viewSpec instanceof Element) {
        // Clone if it's a <template>, otherwise move the node
        if (viewSpec.content) {
          this.root.appendChild(viewSpec.content.cloneNode(true));
        } else {
          this.root.appendChild(viewSpec.cloneNode(true));
        }
      }
    },
    refresh() {},
  };
  _declCache.set(viewSpec, wrapper);
  return wrapper;
}

function need(cond, msg) { if (!cond) throw new Error("mountShell: " + msg); }

export function mountShell(config) {
  const { root, brand, routes, defaultRoute, legacyRoutes, topbarActions, footer, onRoute } = config || {};
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

  // Hamburger button: visible only at <=768px (CSS hides it above that).
  // Toggles .sidebar-open on #tm-app to slide the drawer in/out.
  const hamburger = el("button", "tm-hamburger");
  hamburger.type = "button";
  hamburger.setAttribute("aria-label", "Toggle navigation");
  hamburger.innerHTML = icon("menu");
  hamburger.addEventListener("click", () => {
    app.classList.toggle("sidebar-open");
  });
  topbar.appendChild(hamburger);

  const pageTitle = el("h1");
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
  const content = el("main");
  content.id = "tm-content";
  content.tabIndex = 0;
  main.appendChild(topbar);
  main.appendChild(content);

  // Skip link: visually hidden until focused, jumps to main content
  const skip = el("a", "tm-skip-link", "Skip to content");
  skip.href = "#tm-content";
  skip.addEventListener("click", (e) => {
    e.preventDefault();
    content.focus();
  });

  // Route-change announcer: screen readers announce the new page title
  const announcer = el("div", "tm-sr-only");
  announcer.setAttribute("aria-live", "polite");
  announcer.setAttribute("aria-atomic", "true");
  // Expose the subtitle + announcer to the standalone setPageSub()/announce().
  _pageSub = pageSub;
  _announcer = announcer;

  app.prepend(skip);
  app.appendChild(sidebar);
  app.appendChild(main);
  app.appendChild(announcer);
  root.appendChild(app);

  // Clicking the main content area (backdrop or content) closes the drawer.
  main.addEventListener("click", () => { app.classList.remove("sidebar-open"); });
  // Swipe the mobile nav drawer left (toward its edge) to close it.
  swipeToClose(sidebar, () => app.classList.remove("sidebar-open"), { edge: "left" });

  // Framework overlay mount points (primitives also create these lazily via
  // kernel.ensureRoot; mounting them here keeps stacking order deterministic).
  // The modal uses a native <dialog> (top-layer) created per-open — no root.
  ensureRoot("tm-ctx-root", { role: "menu" });
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
    document.title = title ? title + " — " + brand.name : brand.name;
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
    // Close the mobile drawer on every route change
    app.classList.remove("sidebar-open");
    // Routes can carry a sub-path (deep link): #/key/<tail>.
    const parts = raw.split("/");
    const key = parts[0];
    if (legacyRoutes && legacyRoutes[key] !== undefined) {
      // Old bookmarks keep working; the tail rides along.
      const tail = parts.length > 1 ? "/" + parts.slice(1).join("/") : "";
      location.replace("#/" + legacyRoutes[key] + tail);
      return;
    }
    let sub;
    try {
      sub = parts.length > 1 ? parts.slice(1).map(decodeURIComponent).join("/") : "";
    } catch (err) {
      console.warn("mountShell: malformed hash ignored:", location.hash, err.message);
      location.replace("#/" + defaultRoute);
      return;
    }
    const r = routes[key] || routes[defaultRoute];
    const name = routes[key] ? key : defaultRoute;
    const sameView = currentRoute === name;
    currentRoute = name;

    $$(".nav-item", nav).forEach((b) => {
      const isActive = b.dataset.route === name;
      b.classList.toggle("active", isActive);
      if (isActive) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    setTitle(r.title, "");
    $$(".view", content).forEach((v) => v.classList.add("hidden"));
    const view = resolveView(r.view);
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
    // Announce the new page title to screen readers
    announcer.textContent = r.title;
    // Last, so routing state is fully consistent when the hook observes it.
    if (onRoute) onRoute(name, sub || null);
  }

  // Eager routes: create the root and build() at mount (hidden). build() is
  // idempotent, so the router's build() on first visit is a no-op.
  for (const [, r] of Object.entries(routes)) {
    if (!r.eager) continue;
    const view = resolveView(r.view);
    if (!view.root) {
      view.root = el("section", "view hidden");
      content.appendChild(view.root);
    }
    view.build();
  }

  window.addEventListener("hashchange", route);
  route();

  return {
    navigate(r) { location.hash = "#/" + r; },
    setBusy,
    setTitle,
    announce,
    // Re-run the current view's refresh() in place: no rebuild, no entry
    // animation. No-op before the first route or if the view isn't built.
    refreshCurrent() {
      if (!currentRoute) return;
      const view = resolveView(routes[currentRoute].view);
      if (view.built) view.refresh();
    },
  };
}
