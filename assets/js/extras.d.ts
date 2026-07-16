// tinymoon — TypeScript declarations for the extras barrel: app-level modules
// (networking, settings, wiki) that sit above the core primitives.

import type { ShellView } from "./index.js";

// -- net.js -------------------------------------------------------------------

/**
 * GET `path` and return its parsed JSON body. Rejects with an `Error` carrying
 * the status code on any non-2xx response. The response type is unconstrained;
 * supply a type argument to narrow it (`api<User[]>("/users")`).
 */
export function api<T = unknown>(path: string): Promise<T>;

/**
 * POST `body` as JSON to `path` and return the parsed JSON response. On a
 * non-2xx response, `onError` (if given) is invoked with the server's `error`
 * field (or a status-code fallback) before the returned promise rejects with
 * an `Error` carrying the same message.
 */
export function post<T = unknown>(
  path: string,
  body: unknown,
  onError?: (msg: string, status: number, path: string) => void,
): Promise<T>;

// -- settings.js --------------------------------------------------------------

export interface SettingsOpts<T extends Record<string, unknown>> {
  /** localStorage key under which the settings object is persisted. */
  storageKey: string;
  /** Schema and default values: its keys are the only settable keys. */
  defaults: T;
}

export interface SettingsStore<T extends Record<string, unknown>> {
  /** Load persisted values from localStorage, ignoring unknown keys. */
  load(): void;
  /** Read a setting. Throws if `key` is not in the schema. */
  get<K extends keyof T>(key: K): T[K];
  /**
   * Persist a setting and dispatch `tm:setting`. Throws on unknown keys.
   * Setting `theme` also re-applies it. Requires a `theme` key in the schema.
   */
  set<K extends keyof T>(key: K, value: T[K]): void;
  /**
   * Subscribe to a specific setting. Identical contract to
   * `createStore.subscribe`: `cb(value, previousValue, key)`, skipped when
   * `Object.is(old, value)`. Additive to the `tm:setting` window event, which
   * still fires. Returns an unsubscribe. Throws on unknown keys.
   */
  subscribe<K extends keyof T>(
    key: K,
    cb: (value: T[K], previousValue: T[K], key: K) => void,
  ): () => void;
  /**
   * Subscribe to ANY setting change with `null`:
   * `cb(value, previousValue, key)`. Returns an unsubscribe.
   */
  subscribe(
    key: null,
    cb: <K extends keyof T>(value: T[K], previousValue: T[K], key: K) => void,
  ): () => void;
  /** Mirror the `theme` value onto `<html data-theme>` and dispatch `tm:theme`. */
  applyTheme(): void;
}

/**
 * Create a schema-parameterized settings store backed by localStorage. Both
 * `storageKey` and `defaults` are required — the store fails loudly otherwise.
 */
export function createSettings<T extends Record<string, unknown>>(
  opts: SettingsOpts<T>,
): SettingsStore<T>;

// -- wiki.js ------------------------------------------------------------------

export interface WikiSection {
  /** Stable anchor id (`#/<route>/<id>`). */
  id: string;
  /** Section heading text. */
  title: string;
  /** Section body in the doc markdown dialect. */
  md: string;
}

export interface WikiViewOpts {
  /** Hash route key the view is mounted under. */
  route: string;
  /** Sections to render, or a function returning them. */
  sections: WikiSection[] | (() => WikiSection[]);
}

/** Render a doc-markdown string to a `.doc-body` element. */
export function renderDocMd(md: string): HTMLElement;

/**
 * Build a wiki view (one long page of linkable sections plus a sticky table of
 * contents) conforming to the shell's view contract. Both `route` and
 * `sections` are required.
 */
export function createWikiView(opts: WikiViewOpts): ShellView;
