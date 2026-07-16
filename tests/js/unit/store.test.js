import { describe, it, expect, vi } from "vitest";
import { createStore, bind, reconcile } from "../../../assets/js/store.js";
import { el } from "../../../assets/js/dom.js";

// The L2 state story: createStore (keyed reactive store), bind (store↔widget),
// and reconcile (keyed list reconciliation). These pin the decided semantics:
// Object.is emit-skip, keyed + any-change subscriptions, memoized selections,
// initial-sync binding, and node-identity-preserving reconciliation.

describe("createStore — get/set/update", () => {
  it("seeds from initial and reads back", () => {
    const s = createStore({ count: 1, name: "a" });
    expect(s.get("count")).toBe(1);
    expect(s.get("name")).toBe("a");
  });

  it("set updates the value and notifies the key's subscribers", () => {
    const s = createStore({ count: 0 });
    const cb = vi.fn();
    s.subscribe("count", cb);
    s.set("count", 5);
    expect(s.get("count")).toBe(5);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(5, 0, "count");
  });

  it("update applies a function to the current value", () => {
    const s = createStore({ count: 10 });
    const cb = vi.fn();
    s.subscribe("count", cb);
    s.update("count", (n) => n + 1);
    expect(s.get("count")).toBe(11);
    expect(cb).toHaveBeenCalledWith(11, 10, "count");
  });

  it("snapshot returns a shallow copy of the state", () => {
    const s = createStore({ a: 1, b: 2 });
    const snap = s.snapshot();
    expect(snap).toEqual({ a: 1, b: 2 });
    s.set("a", 9);
    // The earlier snapshot is decoupled from later writes.
    expect(snap.a).toBe(1);
  });
});

describe("createStore — Object.is emit skip", () => {
  it("a no-op write (same value) notifies nobody", () => {
    const s = createStore({ count: 3 });
    const cb = vi.fn();
    s.subscribe("count", cb);
    s.set("count", 3);
    expect(cb).not.toHaveBeenCalled();
  });

  it("NaN → NaN is a no-op (Object.is treats NaN as equal to itself)", () => {
    const s = createStore({ x: NaN });
    const cb = vi.fn();
    s.subscribe("x", cb);
    s.set("x", NaN);
    expect(cb).not.toHaveBeenCalled();
  });

  it("+0 → -0 DOES emit (Object.is distinguishes them)", () => {
    const s = createStore({ x: 0 });
    const cb = vi.fn();
    s.subscribe("x", cb);
    s.set("x", -0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("in-place mutation of a stored object does not emit", () => {
    const obj = { n: 1 };
    const s = createStore({ obj });
    const cb = vi.fn();
    s.subscribe("obj", cb);
    obj.n = 2; // mutate in place — identity unchanged
    s.set("obj", obj); // same reference → Object.is skip
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("createStore — subscribe / unsubscribe", () => {
  it("unsubscribe stops further notifications", () => {
    const s = createStore({ count: 0 });
    const cb = vi.fn();
    const off = s.subscribe("count", cb);
    s.set("count", 1);
    off();
    s.set("count", 2);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("a keyed subscriber ignores changes to other keys", () => {
    const s = createStore({ a: 0, b: 0 });
    const cb = vi.fn();
    s.subscribe("a", cb);
    s.set("b", 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it("any-change subscription (null) fires for every key", () => {
    const s = createStore({ a: 0, b: 0 });
    const cb = vi.fn();
    s.subscribe(null, cb);
    s.set("a", 1);
    s.set("b", 2);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, 1, 0, "a");
    expect(cb).toHaveBeenNthCalledWith(2, 2, 0, "b");
  });

  it("unsubscribing during an emit does not corrupt iteration", () => {
    const s = createStore({ x: 0 });
    const calls = [];
    let off2;
    s.subscribe("x", () => { calls.push("one"); off2(); });
    off2 = s.subscribe("x", () => { calls.push("two"); });
    s.set("x", 1);
    // Both existing subscribers still ran for this emit; the removal takes
    // effect on the next emit.
    expect(calls).toContain("one");
    s.set("x", 2);
    expect(calls.filter((c) => c === "two").length).toBe(1);
  });
});

describe("createStore — select (memoized projection)", () => {
  it("get returns the current projection", () => {
    const s = createStore({ a: 2, b: 3 });
    const sum = s.select((snap) => snap.a + snap.b);
    expect(sum.get()).toBe(5);
    s.set("a", 10);
    expect(sum.get()).toBe(13);
  });

  it("notifies only when the projection changes", () => {
    const s = createStore({ a: 1, b: 1, c: 0 });
    const sel = s.select((snap) => snap.a + snap.b);
    const cb = vi.fn();
    sel.subscribe(cb);
    s.set("c", 99); // does not affect the projection
    expect(cb).not.toHaveBeenCalled();
    s.set("a", 2); // projection 2 -> 3
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(3);
  });

  it("an equal projection value does not re-notify", () => {
    const s = createStore({ a: 1, b: 1 });
    // Projection is min(a,b); raising the max keeps min the same.
    const sel = s.select((snap) => Math.min(snap.a, snap.b));
    const cb = vi.fn();
    sel.subscribe(cb);
    s.set("a", 5); // min(5,1) === 1, unchanged
    expect(cb).not.toHaveBeenCalled();
    s.set("b", 0); // min(5,0) === 0, changed
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(0);
  });

  it("unsubscribing the last selector subscriber detaches from the store", () => {
    const s = createStore({ a: 1 });
    const sel = s.select((snap) => snap.a);
    const cb = vi.fn();
    const off = sel.subscribe(cb);
    off();
    s.set("a", 2);
    expect(cb).not.toHaveBeenCalled();
    // get still works after detaching.
    expect(sel.get()).toBe(2);
  });
});

describe("bind — store key ↔ widget.set", () => {
  // A minimal fake widget matching the house convention (.set(v)).
  function fakeWidget() {
    const w = { values: [], set(v) { w.values.push(v); } };
    return w;
  }

  it("syncs the current value immediately on bind", () => {
    const s = createStore({ vol: 40 });
    const w = fakeWidget();
    bind(s, "vol", w);
    expect(w.values).toEqual([40]);
  });

  it("forwards subsequent changes to the widget", () => {
    const s = createStore({ vol: 40 });
    const w = fakeWidget();
    bind(s, "vol", w);
    s.set("vol", 80);
    expect(w.values).toEqual([40, 80]);
  });

  it("unbind stops forwarding", () => {
    const s = createStore({ vol: 40 });
    const w = fakeWidget();
    const off = bind(s, "vol", w);
    off();
    s.set("vol", 99);
    expect(w.values).toEqual([40]);
  });

  it("throws when the widget has no .set method", () => {
    const s = createStore({ vol: 1 });
    expect(() => bind(s, "vol", {})).toThrow(/\.set/);
  });
});

describe("reconcile — keyed list reconciliation", () => {
  const keyFn = (item) => item.id;
  const hooks = {
    create: (item) => {
      const node = el("div", "row");
      node.dataset.id = item.id;
      node.textContent = item.label;
      return node;
    },
    update: (node, item) => { node.textContent = item.label; },
  };

  it("inserts nodes for new keys in order", () => {
    const c = el("div");
    reconcile(c, [{ id: "a", label: "A" }, { id: "b", label: "B" }], keyFn, hooks);
    expect([...c.children].map((n) => n.dataset.id)).toEqual(["a", "b"]);
    expect([...c.children].map((n) => n.textContent)).toEqual(["A", "B"]);
  });

  it("removes nodes for keys that disappear", () => {
    const c = el("div");
    reconcile(c, [{ id: "a", label: "A" }, { id: "b", label: "B" }], keyFn, hooks);
    reconcile(c, [{ id: "a", label: "A" }], keyFn, hooks);
    expect([...c.children].map((n) => n.dataset.id)).toEqual(["a"]);
  });

  it("calls the remove hook before detaching, then detaches", () => {
    const c = el("div");
    const removed = [];
    const h = { ...hooks, remove: (node, item) => { removed.push([node.dataset.id, item.id, !!node.parentNode]); } };
    reconcile(c, [{ id: "a", label: "A" }, { id: "b", label: "B" }], keyFn, h);
    reconcile(c, [{ id: "a", label: "A" }], keyFn, h);
    // remove ran with the node still attached, and the item it was created for.
    expect(removed).toEqual([["b", "b", true]]);
    expect(c.querySelector('[data-id="b"]')).toBeNull();
  });

  it("updates kept keys via the update hook", () => {
    const c = el("div");
    reconcile(c, [{ id: "a", label: "A" }], keyFn, hooks);
    reconcile(c, [{ id: "a", label: "A2" }], keyFn, hooks);
    expect(c.children[0].textContent).toBe("A2");
  });

  it("preserves node identity for kept keys across reorder", () => {
    const c = el("div");
    reconcile(c, [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }], keyFn, hooks);
    // Capture references before the reorder.
    const before = new Map([...c.children].map((n) => [n.dataset.id, n]));
    reconcile(c, [{ id: "c", label: "C" }, { id: "a", label: "A" }, { id: "b", label: "B" }], keyFn, hooks);
    // Order changed to c, a, b.
    expect([...c.children].map((n) => n.dataset.id)).toEqual(["c", "a", "b"]);
    // Each kept key is the SAME node object, not a re-created one.
    for (const id of ["a", "b", "c"]) {
      expect(c.querySelector(`[data-id="${id}"]`)).toBe(before.get(id));
    }
  });

  it("handles insert + remove + reorder in one pass", () => {
    const c = el("div");
    reconcile(c, [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }], keyFn, hooks);
    const nodeA = c.querySelector('[data-id="a"]');
    // Remove b, reorder to c,a, insert d.
    reconcile(c, [{ id: "c", label: "C" }, { id: "a", label: "A" }, { id: "d", label: "D" }], keyFn, hooks);
    expect([...c.children].map((n) => n.dataset.id)).toEqual(["c", "a", "d"]);
    // a survived with its identity.
    expect(c.querySelector('[data-id="a"]')).toBe(nodeA);
  });

  it("requires keyFn and create hooks", () => {
    const c = el("div");
    expect(() => reconcile(c, [], null, hooks)).toThrow(/keyFn/);
    expect(() => reconcile(c, [], keyFn, {})).toThrow(/create/);
  });
});
