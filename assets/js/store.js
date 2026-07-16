// tinymoon — the state story (L2): a tiny reactive store, a store↔widget
// binder, and a keyed list reconciler. By design there is NO declarative
// render layer: you build the DOM once (el(), the primitives) and mutate it in
// place. These three functions are the house pattern for keeping that mutation
// centralized, minimal, and correct.
//
//   createStore(initial) — a keyed value store with per-key and any-change
//                          subscriptions plus memoized projections.
//   bind(store, key, w)  — wire a store key to a widget's .set(v).
//   reconcile(...)       — reconcile a keyed collection into DOM nodes,
//                          reusing and reordering existing nodes by key.
//
// No virtual DOM, no diffing of attributes — reconcile only owns child node
// identity and order; what a node contains is the create/update hooks' job.

// ---------------------------------------------------------------------------
// createStore — a keyed value store
// ---------------------------------------------------------------------------

/**
 * createStore(initial) → a reactive key/value store.
 *
 * The store is schemaless: `initial` seeds the values, but `set`/`update` may
 * introduce new keys later. Values are held in a shallow copy of `initial`.
 *
 * Emission model (decided):
 *   - `set(key, value)` skips the emit entirely when `Object.is(old, value)`
 *     is true — a no-op write notifies nobody.
 *   - In-place MUTATION of a stored object/array does NOT emit: the store only
 *     sees identity changes through `set`/`update`. To signal a change, pass a
 *     new value (or a fresh copy) to `set`/`update`.
 *
 * Returns `{get, set, update, subscribe, select, snapshot}`.
 */
export function createStore(initial) {
  const state = { ...(initial || {}) };
  // key -> Set<cb>. The `null` any-change subscribers live in `anyChange`.
  const keyed = new Map();
  const anyChange = new Set();

  // Notify a specific key's subscribers, then the any-change subscribers.
  // Snapshots of the subscriber sets are taken so a callback may unsubscribe
  // (itself or others) mid-emit without corrupting the iteration.
  function emit(key, value, old) {
    const subs = keyed.get(key);
    if (subs) for (const cb of [...subs]) cb(value, old, key);
    for (const cb of [...anyChange]) cb(value, old, key);
  }

  /** Read the current value for `key` (undefined if never set). */
  function get(key) {
    return state[key];
  }

  /**
   * Write `key`. Skips the emit when `Object.is(old, value)`. Subscribers are
   * invoked as `cb(value, previousValue, key)`.
   */
  function set(key, value) {
    const old = state[key];
    if (Object.is(old, value)) return;
    state[key] = value;
    emit(key, value, old);
  }

  /** Functional update: `set(key, fn(get(key)))`. Same Object.is skip. */
  function update(key, fn) {
    set(key, fn(state[key]));
  }

  /**
   * subscribe(key, cb) → unsubscribe.
   *
   * When `key` is `null` (or `undefined`), `cb` fires on ANY key change; when
   * `key` is a specific key, `cb` fires only for that key. Either way the
   * signature is identical: `cb(value, previousValue, key)`. The returned
   * function removes the subscription and is idempotent.
   */
  function subscribe(key, cb) {
    if (typeof cb !== "function") throw new Error("subscribe: cb must be a function");
    if (key === null || key === undefined) {
      anyChange.add(cb);
      return () => anyChange.delete(cb);
    }
    let subs = keyed.get(key);
    if (!subs) { subs = new Set(); keyed.set(key, subs); }
    subs.add(cb);
    return () => {
      const g = keyed.get(key);
      if (g) g.delete(cb);
    };
  }

  /** A shallow copy of the current state. Nested objects are shared by
   * reference — do not mutate them (see the emission model above). */
  function snapshot() {
    return { ...state };
  }

  /**
   * select(fn) → `{get, subscribe}`: a memoized projection of the store.
   *
   * `fn(snapshot)` computes a derived value from a fresh snapshot. The
   * projection is memoized with `Object.is`: subscribers are notified only
   * when the projection's identity changes, so a store write that doesn't
   * affect the projection is silent. `subscribe(cb)` calls `cb(projection)` on
   * each change and returns an unsubscribe. The projection lazily subscribes to
   * the store while it has at least one subscriber, and detaches when the last
   * one leaves, so a selector never leaks a store subscription.
   */
  function select(fn) {
    let cached;
    let has = false;
    const subs = new Set();
    let unsubStore = null;

    // Recompute the projection. Returns true when it changed (Object.is).
    function compute() {
      const next = fn(snapshot());
      if (has && Object.is(next, cached)) return false;
      cached = next;
      has = true;
      return true;
    }

    return {
      /** The current projection (memoized when a subscription is active). */
      get() {
        // With no active store subscription, recompute on demand so a caller
        // reading between writes still sees fresh data; `has`/`cached` keep
        // identity stable across reads when nothing changed.
        if (!unsubStore) compute();
        return cached;
      },
      /** subscribe(cb) → unsubscribe. `cb(projection)` on each change. */
      subscribe(cb) {
        if (typeof cb !== "function") throw new Error("select.subscribe: cb must be a function");
        subs.add(cb);
        if (!unsubStore) {
          compute();
          unsubStore = subscribe(null, () => {
            if (compute()) for (const s of [...subs]) s(cached);
          });
        }
        return () => {
          subs.delete(cb);
          if (subs.size === 0 && unsubStore) {
            unsubStore();
            unsubStore = null;
          }
        };
      },
    };
  }

  return { get, set, update, subscribe, select, snapshot };
}

// ---------------------------------------------------------------------------
// bind — wire a store key to a widget's .set(v)
// ---------------------------------------------------------------------------

/**
 * bind(store, key, widget) → unbind.
 *
 * Calls `widget.set(store.get(key))` once for the initial sync, then keeps the
 * widget in sync by subscribing to `key` and forwarding every new value to
 * `widget.set(value)` (the house widget-update convention). Returns an unbind
 * function — call it in the owner's `destroy()` to stop the subscription.
 */
export function bind(store, key, widget) {
  if (!store || typeof store.subscribe !== "function" || typeof store.get !== "function") {
    throw new Error("bind: store must be a createStore instance");
  }
  if (!widget || typeof widget.set !== "function") {
    throw new Error("bind: widget must expose a .set(v) method");
  }
  widget.set(store.get(key));
  return store.subscribe(key, (value) => widget.set(value));
}

// ---------------------------------------------------------------------------
// reconcile — keyed list reconciliation
// ---------------------------------------------------------------------------

// container -> Map<key, {node, item}>. Per-container so the reconciler can
// find the nodes it produced on the previous call without stamping expando
// state onto the DOM nodes themselves.
const registries = new WeakMap();

/**
 * reconcile(container, items, keyFn, {create, update, remove}) → node[].
 *
 * Reconciles `items` into direct child nodes of `container`, keyed by
 * `keyFn(item)`:
 *   - a key seen for the first time calls `create(item)` (must return a node);
 *   - a key kept from the previous call reuses its node and calls
 *     `update(node, item)` if provided — node IDENTITY is preserved;
 *   - a key that disappears calls `remove(node, item)` (if provided) as a
 *     pre-detach hook, then the node is detached. With no `remove` hook the
 *     node is simply detached (plain removal).
 * Kept nodes are reordered in place with `insertBefore` to match `items`
 * order; moving a node preserves its identity (no clone, no re-create). There
 * is no virtual DOM and no attribute diffing — `create`/`update` own a node's
 * contents; the reconciler owns only which nodes exist and in what order.
 *
 * `keyFn` and `create` are required (hard error). Returns the ordered array of
 * child nodes.
 */
export function reconcile(container, items, keyFn, hooks) {
  if (!container) throw new Error("reconcile: container is required");
  if (typeof keyFn !== "function") throw new Error("reconcile: keyFn is required");
  const { create, update, remove } = hooks || {};
  if (typeof create !== "function") throw new Error("reconcile: create hook is required");

  const prev = registries.get(container) || new Map();
  const next = new Map();

  // Resolve the desired node for every item, reusing kept nodes.
  const ordered = [];
  for (const item of items) {
    const key = keyFn(item);
    const existing = prev.get(key);
    let node;
    if (existing) {
      node = existing.node;
      if (update) update(node, item);
    } else {
      node = create(item);
    }
    next.set(key, { node, item });
    ordered.push(node);
  }

  // Detach nodes whose keys are gone (remove hook runs before detach).
  for (const [key, { node, item }] of prev) {
    if (!next.has(key)) {
      if (remove) remove(node, item);
      if (node.parentNode) node.parentNode.removeChild(node);
    }
  }

  // Reorder / insert to match `ordered`. After the removals above, the
  // container holds only kept nodes in their old relative order; this loop
  // moves kept nodes and inserts new ones into their final positions.
  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i];
    const atPos = container.childNodes[i];
    if (atPos !== node) container.insertBefore(node, atPos || null);
  }

  registries.set(container, next);
  return ordered;
}
