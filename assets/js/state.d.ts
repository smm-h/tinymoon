// tinymoon — TypeScript declarations for the state barrel: the L2 state story
// (store + bind + keyed reconciler). No declarative render layer by design.

// -- store.js: createStore ----------------------------------------------------

/**
 * A subscriber callback. Fires as `(value, previousValue, key)` — for a keyed
 * subscription `key` is that key; for an any-change subscription `key` is
 * whichever key changed.
 */
export type StoreSubscriber<T, K extends keyof T = keyof T> = (
  value: T[K],
  previousValue: T[K],
  key: K,
) => void;

/** A memoized projection of a store: `select(fn)`'s return shape. */
export interface Selection<P> {
  /** The current projection (memoized with `Object.is` while subscribed). */
  get(): P;
  /** Subscribe to projection changes; `cb(projection)` fires only when the
   * projection's identity changes. Returns an unsubscribe. */
  subscribe(cb: (projection: P) => void): () => void;
}

export interface Store<T extends Record<string, unknown>> {
  /** Read the current value for `key`. */
  get<K extends keyof T>(key: K): T[K];
  /** Write `key`. Skips notification when `Object.is(old, value)`. In-place
   * mutation of a stored object does not emit — pass a new value. */
  set<K extends keyof T>(key: K, value: T[K]): void;
  /** Functional update: `set(key, fn(get(key)))`. */
  update<K extends keyof T>(key: K, fn: (previous: T[K]) => T[K]): void;
  /** Subscribe to a specific key. `cb(value, previousValue, key)`. */
  subscribe<K extends keyof T>(key: K, cb: StoreSubscriber<T, K>): () => void;
  /** Subscribe to ANY key change with `null`. `cb(value, previousValue, key)`. */
  subscribe(key: null, cb: StoreSubscriber<T>): () => void;
  /** A memoized projection derived from a store snapshot. */
  select<P>(fn: (snapshot: T) => P): Selection<P>;
  /** A shallow copy of the current state. */
  snapshot(): T;
}

/**
 * Create a reactive key/value store. `initial` seeds the values (held in a
 * shallow copy); the store is schemaless, so `set`/`update` may add new keys.
 */
export function createStore<T extends Record<string, unknown>>(initial: T): Store<T>;

// -- store.js: bind -----------------------------------------------------------

/** The minimum a widget must expose to be bound: a `.set(v)` method. */
export interface Bindable<V> {
  set(value: V): void;
}

/**
 * Wire a store key to a widget's `.set(v)`: syncs the current value once, then
 * forwards every change. Returns an unbind function — call it in `destroy()`.
 */
export function bind<T extends Record<string, unknown>, K extends keyof T>(
  store: Store<T>,
  key: K,
  widget: Bindable<T[K]>,
): () => void;

// -- store.js: reconcile ------------------------------------------------------

/** The create/update/remove hooks for `reconcile`. */
export interface ReconcileHooks<Item, N extends Node = Node> {
  /** Build the node for a newly-seen key. Required. */
  create(item: Item): N;
  /** Update the reused node for a kept key. Optional. */
  update?(node: N, item: Item): void;
  /** Pre-detach hook for a removed key; the node is detached afterward. */
  remove?(node: N, item: Item): void;
}

/**
 * Reconcile `items` into keyed child nodes of `container`. New keys call
 * `create`, kept keys reuse their node (identity preserved) and call `update`,
 * disappeared keys call `remove` then detach. Kept nodes are reordered in
 * place to match `items`. Returns the ordered array of nodes.
 */
export function reconcile<Item, N extends Node = Node>(
  container: Node,
  items: Iterable<Item>,
  keyFn: (item: Item) => unknown,
  hooks: ReconcileHooks<Item, N>,
): N[];
