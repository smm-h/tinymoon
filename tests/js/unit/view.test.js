import { describe, it, expect, beforeEach } from "vitest";
import { createView } from "../../../assets/js/view.js";
import { mountShell, announce, setPageSub } from "../../../assets/js/shell.js";

// createView + the shell wiring it depends on (setPageSub via ctx.setSub,
// announce via the route announcer, and the eager route flag).

beforeEach(() => {
  document.body.innerHTML = "";
  location.hash = "";
});

describe("createView", () => {
  it("returns a contract-conforming view object", () => {
    const v = createView({ build() {} });
    expect(v.root).toBeNull();
    expect(v.built).toBe(false);
    expect(typeof v.build).toBe("function");
    expect(typeof v.refresh).toBe("function");
  });

  it("build is idempotent and guards on built", () => {
    let builds = 0;
    const v = createView({ build() { builds++; } });
    v.root = document.createElement("section");
    v.build();
    v.build();
    v.build();
    expect(builds).toBe(1);
    expect(v.built).toBe(true);
  });

  it("passes ctx {root, setSub} to build and refresh", () => {
    let buildCtx = null;
    let refreshCtx = null;
    const v = createView({
      build(ctx) { buildCtx = ctx; },
      refresh(ctx) { refreshCtx = ctx; },
    });
    const root = document.createElement("section");
    v.root = root;
    v.build();
    v.refresh();
    expect(buildCtx.root).toBe(root);
    expect(refreshCtx).toBe(buildCtx); // same ctx instance
    expect(typeof buildCtx.setSub).toBe("function");
  });

  it("ctx.setSub writes the shell page subtitle without touching the node", () => {
    // Mount a shell so #tm-page-sub exists and _pageSub is wired.
    mountShell({
      root: document.body,
      brand: { name: "T", logoHTML: "<b>T</b>" },
      routes: { a: { title: "A", icon: "library", view: () => createView({ build() {} }) } },
      defaultRoute: "a",
    });
    const v = createView({ build(ctx) { ctx.setSub("hello sub"); } });
    v.root = document.createElement("section");
    v.build();
    expect(document.getElementById("tm-page-sub").textContent).toBe("hello sub");
  });

  it("setSub option is the deep-link handler and receives the tail + ctx", () => {
    let seen = null;
    const v = createView({
      build() {},
      setSub(sub, ctx) { seen = { sub, ctx }; },
    });
    const root = document.createElement("section");
    v.root = root;
    v.build();
    v.setSub("a/b");
    expect(seen.sub).toBe("a/b");
    expect(seen.ctx.root).toBe(root);
  });

  it("throws without a build function", () => {
    expect(() => createView({})).toThrow(/build/);
  });
});

describe("shell.announce", () => {
  it("standalone announce writes the mounted route announcer", () => {
    mountShell({
      root: document.body,
      brand: { name: "T", logoHTML: "<b>T</b>" },
      routes: { a: { title: "A", icon: "library", view: "<h2>A</h2>" } },
      defaultRoute: "a",
    });
    announce("region says hi");
    const live = document.querySelector('[aria-live="polite"]');
    expect(live.textContent).toBe("region says hi");
  });

  it("shell instance exposes announce()", () => {
    const shell = mountShell({
      root: document.body,
      brand: { name: "T", logoHTML: "<b>T</b>" },
      routes: { a: { title: "A", icon: "library", view: "<h2>A</h2>" } },
      defaultRoute: "a",
    });
    expect(typeof shell.announce).toBe("function");
    shell.announce("via instance");
    expect(document.querySelector('[aria-live="polite"]').textContent).toBe("via instance");
  });

  it("announce/setPageSub are no-ops before a shell mounts", () => {
    // No shell mounted in this fresh body — should not throw.
    expect(() => announce("x")).not.toThrow();
    expect(() => setPageSub("y")).not.toThrow();
  });
});

describe("eager routes", () => {
  it("build() runs at mount for eager routes, hidden until visited", () => {
    let built = false;
    const eagerView = createView({ build(ctx) { built = true; ctx.root.appendChild(document.createElement("p")); } });
    mountShell({
      root: document.body,
      brand: { name: "T", logoHTML: "<b>T</b>" },
      routes: {
        home: { title: "Home", icon: "library", view: "<h2>Home</h2>" },
        lazy: { title: "Lazy", icon: "library", view: () => eagerView, eager: true },
      },
      defaultRoute: "home",
    });
    // Eager view was built at mount even though home is the default route.
    expect(built).toBe(true);
    expect(eagerView.built).toBe(true);
    expect(eagerView.root).not.toBeNull();
    // It is present but hidden (home is the visible route).
    expect(eagerView.root.classList.contains("hidden")).toBe(true);
  });

  it("non-eager routes are NOT built until first visit", () => {
    let built = false;
    const lazyView = createView({ build() { built = true; } });
    mountShell({
      root: document.body,
      brand: { name: "T", logoHTML: "<b>T</b>" },
      routes: {
        home: { title: "Home", icon: "library", view: "<h2>Home</h2>" },
        other: { title: "Other", icon: "library", view: () => lazyView },
      },
      defaultRoute: "home",
    });
    expect(built).toBe(false);
  });
});

function mountOne(view) {
  return mountShell({
    root: document.body,
    brand: { name: "T", logoHTML: "<b>T</b>" },
    routes: { a: { title: "A", icon: "library", view } },
    defaultRoute: "a",
  });
}
const flush = () => new Promise((r) => setTimeout(r));

describe("shell router — deep-link query", () => {
  it("parses the hash query into ctx.query for build and refresh", () => {
    let buildQ = null;
    let refreshQ = null;
    const v = createView({
      build(ctx) { buildQ = ctx.query; },
      refresh(ctx) { refreshQ = ctx.query; },
    });
    location.hash = "#/a?panel=metrics&range=7d";
    mountOne(() => v);
    expect(buildQ).toEqual({ panel: "metrics", range: "7d" });
    expect(refreshQ).toEqual({ panel: "metrics", range: "7d" });
  });

  it("ctx.query is an empty object when the route carries no query", () => {
    let seen = null;
    const v = createView({ build(ctx) { seen = ctx.query; } });
    location.hash = "#/a";
    mountOne(() => v);
    expect(seen).toEqual({});
  });

  it("delivers both the deep-link tail (setSub) and the query together", () => {
    let sub = null;
    let q = null;
    const v = createView({
      build() {},
      setSub(s, ctx) { sub = s; q = ctx.query; },
    });
    location.hash = "#/a/x/y?k=1";
    mountOne(() => v);
    expect(sub).toBe("x/y");
    expect(q).toEqual({ k: "1" });
  });

  it("URI-decodes query values", () => {
    let seen = null;
    const v = createView({ build(ctx) { seen = ctx.query; } });
    location.hash = "#/a?q=" + encodeURIComponent("a b&c");
    mountOne(() => v);
    expect(seen.q).toBe("a b&c");
  });
});

describe("shell router — async view factory", () => {
  it("shows a loadingBlock placeholder, then mounts the resolved view", async () => {
    const inner = createView({
      build(ctx) { const h = document.createElement("h2"); h.textContent = "Loaded async"; ctx.root.appendChild(h); },
    });
    let resolveFn;
    location.hash = "#/a";
    mountOne(() => new Promise((res) => { resolveFn = res; }));
    // Synchronously after mount: the loading placeholder is in the DOM.
    expect(document.querySelector(".tm-state-loading")).not.toBeNull();
    resolveFn(inner);
    await flush();
    expect(document.querySelector(".tm-state-loading")).toBeNull();
    expect(document.body.textContent).toContain("Loaded async");
  });

  it("shows an errorBlock when the factory rejects (no silent failure)", async () => {
    let rejectFn;
    location.hash = "#/a";
    mountOne(() => new Promise((_, rej) => { rejectFn = rej; }));
    rejectFn(new Error("could not load"));
    await flush();
    const err = document.querySelector(".tm-state-error");
    expect(err).not.toBeNull();
    expect(err.textContent).toContain("could not load");
  });

  it("delivers a queued deep-link query to the async view once it resolves", async () => {
    let seen = null;
    const inner = createView({ build(ctx) { seen = ctx.query; } });
    let resolveFn;
    location.hash = "#/a?x=1&y=2";
    mountOne(() => new Promise((res) => { resolveFn = res; }));
    resolveFn(inner);
    await flush();
    expect(seen).toEqual({ x: "1", y: "2" });
  });
});
