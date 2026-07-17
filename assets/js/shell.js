// tinymoon — app shell: builds the sidebar/nav/topbar/content frame, mounts
// the framework overlay roots, and runs the hash router.
//
// mountShell(config) → {navigate, setBusy, setTitle, refreshCurrent, announce}.
// Full option/type docs live in index.d.ts; the highlights:
//   root           — container the shell frame is appended to
//   brand          — {name, logoHTML}: name feeds --brand-initial
//   routes         — {key: {title, icon, view, tip?, hidden?, eager?}}. view is
//                    a () => viewObj factory, an HTML string, or an Element. The
//                    factory MAY return a Promise<viewObj> (async view): the
//                    router shows a loadingBlock placeholder while it resolves,
//                    then mounts the resolved view, or an errorBlock on reject.
//                    hidden routes stay routable with no nav item; eager: true
//                    builds the view (hidden) at mount.
//   defaultRoute   — route key for an empty or unknown hash
//   legacyRoutes?  — {oldKey: "newRoute"}: old hashes redirect, tail+query kept
//   topbarActions? — nodes or {icon, tip, onClick} specs for #tm-topbar-actions
//   footer?        — {height, node}: sets --footer-h and appends node to body
//   onRoute?       — fn(routeKey, sub): runs after each route is handled
//                    (view built, setSub applied, refresh run, title set),
//                    including the initial mount route.
//
// Deep links carry an optional query: "#/key/tail?a=1&b=2". The path segments
// after the key are the setSub tail ("tail"); the query parses into an object
// pushed onto the view via setQuery before build/refresh (ctx.query in a
// createView view), so a link can address a view AND parameterize it.
//
// View contract: {root, built, build(), refresh(), setSub?(sub), setQuery?(q)}.
// The router creates each view's section.view inside #tm-content and assigns
// view.root before the first build() (views never pre-declare HTML). build()
// must be idempotent (guard on .built); refresh() runs every visit; setSub(sub)
// gets the deep-link tail ("#/key/a/b" → "a/b") and setQuery(q) the parsed
// query, both before refresh(). The createView factory (view.js) builds a
// conforming object for you and surfaces the query as ctx.query.
//
// Declarative shorthand: view can also be an HTML string or an Element (e.g. a
// <template>'s content); the shell wraps it in a minimal view object. Additive
// — the full object contract still works.

import { $$, el } from "./dom.js";
import { icon } from "./icons.js";
import { ensureTooltip } from "./tooltip.js";
import { ensureRoot } from "./kernel.js";
import { swipeToClose } from "./drawer.js";
import { registerOverlayTrigger, registerLightDismiss } from "./dismiss.js";
import { loadingBlock, errorBlock } from "./states.js";

// Live handles to the mounted shell's #tm-page-sub and aria-live announcer,
// backing setPageSub()/announce() (used by the createView ctx). No-op unmounted.
let _pageSub = null;
let _announcer = null;

export function setPageSub(text) { if (_pageSub) _pageSub.textContent = text || ""; }
export function announce(msg) { if (_announcer) _announcer.textContent = msg || ""; }

// parseQuery("a=1&b=2") → {a: "1", b: "2"}. Empty string → {}. Values are
// URI-decoded (URLSearchParams handles "+" and "%xx"); repeated keys keep the
// last. The parsed object is handed to views via ctx.query and setSub.
function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  for (const [k, v] of new URLSearchParams(qs)) out[k] = v;
  return out;
}

// makeAsyncView(promise) — wrap a view-factory Promise into a synchronous view
// object the router can use at once: build() shows a loadingBlock placeholder in
// its root, awaits the promise, then builds the resolved view into the SAME root
// (clearing the placeholder). A rejection swaps in an errorBlock — no silent
// failure. Any setQuery/setSub/refresh the router issues before resolution is
// queued and flushed once the inner view mounts, so a deep link that lands on a
// cold async route still delivers its query and tail.
function makeAsyncView(promise) {
  let inner = null;
  let pendingQuery;
  let pendingSub;
  let refreshQueued = false;

  const wrapper = {
    root: null,
    built: false,
    setQuery(query) {
      if (inner) inner.setQuery && inner.setQuery(query);
      else pendingQuery = query;
    },
    setSub(sub) {
      if (inner) inner.setSub && inner.setSub(sub);
      else pendingSub = sub;
    },
    build() {
      if (this.built) return;
      this.built = true;
      const root = this.root;
      root.appendChild(loadingBlock({ label: "Loading…" }));
      Promise.resolve(promise).then(
        (resolved) => {
          if (!resolved || typeof resolved.build !== "function") {
            throw new Error("mountShell: async route factory must resolve to a view object");
          }
          inner = resolved;
          root.textContent = "";
          inner.root = root;
          if (pendingQuery !== undefined && inner.setQuery) inner.setQuery(pendingQuery);
          inner.build();
          if (pendingSub !== undefined && inner.setSub) inner.setSub(pendingSub);
          if (refreshQueued) inner.refresh();
        },
        (err) => {
          root.textContent = "";
          root.appendChild(errorBlock({ message: (err && err.message) || String(err) }));
        },
      );
    },
    refresh() {
      if (inner) inner.refresh();
      else refreshQueued = true;
    },
  };
  return wrapper;
}

// Wrap a declarative view value (string HTML or Element) into a view object,
// cached by identity so repeated calls return the same instance.
const _declCache = new Map();
// Async factories resolve to a persistent async-wrapper (keyed by the factory
// fn), so a re-route or refreshCurrent() reuses the loaded view — the promise
// is awaited once, never re-fired.
const _asyncCache = new Map();
function resolveView(viewSpec) {
  if (typeof viewSpec === "function") {
    if (_asyncCache.has(viewSpec)) return _asyncCache.get(viewSpec);
    const out = viewSpec();
    if (out && typeof out.then === "function") {
      const wrapper = makeAsyncView(out);
      _asyncCache.set(viewSpec, wrapper);
      return wrapper;
    }
    return out;
  }
  if (viewSpec instanceof Object && !(viewSpec instanceof Element))
    throw new Error("mountShell: route view is an object, not a factory -- wrap it: () => view");
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

  // Hamburger (visible only <=768px): toggles .sidebar-open via the invoker
  // contract; light-dismiss closes it on an outside press. closeNav = one path.
  let closeNav = null;
  const hamburger = el("button", "tm-hamburger");
  hamburger.type = "button";
  hamburger.setAttribute("aria-label", "Toggle navigation");
  hamburger.innerHTML = icon("menu");
  registerOverlayTrigger(hamburger, ({ trigger, onClose }) => {
    app.classList.add("sidebar-open");
    const removeDismiss = registerLightDismiss({
      panels: [sidebar], dismiss: () => closeNav && closeNav(), trigger,
    });
    closeNav = () => {
      removeDismiss();
      app.classList.remove("sidebar-open");
      closeNav = null;
      onClose();
    };
    return { el: sidebar, close: () => closeNav && closeNav() };
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

  // Swipe the mobile nav drawer toward its edge to close it (via closeNav).
  swipeToClose(sidebar, () => { if (closeNav) closeNav(); }, { edge: "left" });

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

  // mountView: resolve + first-mount root + push query + build. The query is set
  // BEFORE build() so ctx.query is current on the first (idempotent) build too.
  function mountView(spec, query) {
    const view = resolveView(spec);
    if (!view.root) { view.root = el("section", "view hidden"); content.appendChild(view.root); }
    if (view.setQuery) view.setQuery(query || {});
    view.build();
    return view;
  }

  function route() {
    const raw = location.hash.replace(/^#\//, "") || defaultRoute;
    if (currentHash === raw) return;
    currentHash = raw;
    // Close the mobile nav drawer on route change.
    if (closeNav) closeNav();
    // A deep link is "#/key/<tail>?<query>": split the query off the path first,
    // then segment the path. The query parses into an object handed to the view.
    const qIndex = raw.indexOf("?");
    const pathRaw = qIndex === -1 ? raw : raw.slice(0, qIndex);
    const queryStr = qIndex === -1 ? "" : raw.slice(qIndex + 1);
    const query = parseQuery(queryStr);
    const parts = pathRaw.split("/");
    const key = parts[0];
    if (legacyRoutes && legacyRoutes[key] !== undefined) {
      // Old bookmarks keep working; the tail AND the query ride along.
      const tail = parts.length > 1 ? "/" + parts.slice(1).join("/") : "";
      const qs = queryStr ? "?" + queryStr : "";
      location.replace("#/" + legacyRoutes[key] + tail + qs);
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
    const view = mountView(r.view, query);
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

  // Eager routes: build the view (hidden) at mount. build() is idempotent, so
  // the router's build() on first visit is a no-op.
  for (const [, r] of Object.entries(routes)) {
    if (r.eager) mountView(r.view);
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
