import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lazyMount } from "../../../assets/js/lazy.js";

// happy-dom has no IntersectionObserver; install a controllable fake that
// records instances and lets tests fire intersections synchronously.
class FakeIO {
  constructor(cb, opts) {
    this.cb = cb;
    this.opts = opts;
    this.observed = new Set();
    this.disconnected = false;
    FakeIO.instances.push(this);
  }
  observe(el) { this.observed.add(el); }
  unobserve(el) { this.observed.delete(el); }
  disconnect() { this.observed.clear(); this.disconnected = true; }
  // Fire an intersection for the given elements (in order).
  enter(els) { this.cb(els.map((target) => ({ target, isIntersecting: true }))); }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  FakeIO.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIO);
});
afterEach(() => vi.unstubAllGlobals());

function makeEls(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = document.createElement("div");
    d.dataset.i = String(i);
    return d;
  });
}

describe("lazyMount", () => {
  it("requires a loadFn", () => {
    expect(() => lazyMount(document.createElement("div"), null)).toThrow(/loadFn is required/);
  });

  it("observes each target element and passes root/rootMargin through", () => {
    const els = makeEls(3);
    lazyMount(els, () => {}, { root: null, rootMargin: "200px", concurrency: 2 });
    const io = FakeIO.instances.at(-1);
    expect(io.observed.size).toBe(3);
    expect(io.opts.root).toBe(null);
    expect(io.opts.rootMargin).toBe("200px");
  });

  it("accepts a single Element target", () => {
    lazyMount(document.createElement("div"), () => {});
    expect(FakeIO.instances.at(-1).observed.size).toBe(1);
  });

  it("loads only visible elements, one-shot (unobserve on load)", async () => {
    const loaded = [];
    const els = makeEls(3);
    lazyMount(els, (el) => { loaded.push(el.dataset.i); }, { root: null });
    const io = FakeIO.instances.at(-1);
    io.enter([els[1]]);
    await flush();
    expect(loaded).toEqual(["1"]);
    expect(io.observed.has(els[1])).toBe(false); // unobserved after claim
    // A second intersection for the same element does not re-load it.
    io.enter([els[1]]);
    await flush();
    expect(loaded).toEqual(["1"]);
  });

  it("runs at most `concurrency` loadFns at once, draining in visibility order", async () => {
    const started = [];
    const resolvers = [];
    const loadFn = (el) => {
      started.push(el.dataset.i);
      return new Promise((res) => resolvers.push(res));
    };
    const els = makeEls(5);
    lazyMount(els, loadFn, { concurrency: 2, root: null });
    const io = FakeIO.instances.at(-1);
    io.enter(els); // all five become visible at once
    await flush();
    expect(started).toEqual(["0", "1"]); // only 2 in flight
    resolvers[0](); // finish #0 → #2 starts
    await flush();
    expect(started).toEqual(["0", "1", "2"]);
    resolvers[1](); resolvers[2]();
    await flush();
    expect(started).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("a rejected load does not stall the pump", async () => {
    const started = [];
    const loadFn = (el) => { started.push(el.dataset.i); return Promise.reject(new Error("x")); };
    const els = makeEls(3);
    lazyMount(els, loadFn, { concurrency: 1, root: null });
    FakeIO.instances.at(-1).enter(els);
    await flush(); await flush(); await flush();
    expect(started).toEqual(["0", "1", "2"]);
  });

  it("cancel() disconnects the observer and drops queued candidates", async () => {
    const started = [];
    const resolvers = [];
    const loadFn = (el) => { started.push(el.dataset.i); return new Promise((r) => resolvers.push(r)); };
    const els = makeEls(4);
    const cancel = lazyMount(els, loadFn, { concurrency: 1, root: null });
    const io = FakeIO.instances.at(-1);
    io.enter(els);
    await flush();
    expect(started).toEqual(["0"]);
    cancel();
    expect(io.disconnected).toBe(true);
    resolvers[0](); // finishing the in-flight load must not pump the dropped queue
    await flush(); await flush();
    expect(started).toEqual(["0"]);
  });

  it("auto-resolves the shell content scroller as the default root", () => {
    const scroller = document.createElement("main");
    scroller.id = "tm-content";
    document.body.appendChild(scroller);
    lazyMount(document.createElement("div"), () => {});
    expect(FakeIO.instances.at(-1).opts.root).toBe(scroller);
    scroller.remove();
  });
});
