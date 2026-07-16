// tinymoon — TypeScript declarations for the extras barrel: app-level modules
// (networking, settings, wiki) that sit above the core primitives.

import type { ShellView } from "./index.js";

// -- net.js -------------------------------------------------------------------

/**
 * Thrown by {@link api} and {@link post} on any non-OK (non-2xx) response. It
 * carries the HTTP `status`, the `statusText`, the request `path`, and a
 * `detail` surfaced from the response body's `detail` OR `error` field (both
 * server shapes supported). `message` is the detail when present, else an
 * "Error <status>" fallback. `detail` is `undefined` when the body carried
 * neither field (or was not JSON).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly path: string;
  readonly detail?: string;
  constructor(status: number, statusText: string, path: string, detail?: string);
}

/** Per-request options common to {@link api} and {@link post}. */
export interface RequestOpts {
  /** An `AbortSignal` to cancel the request. */
  signal?: AbortSignal;
  /** Extra headers, merged over the auth-hook headers for this call. */
  headers?: Record<string, string>;
}

/**
 * GET `path` and return its parsed JSON body. Throws an {@link ApiError} on any
 * non-OK response. The response type is unconstrained; supply a type argument
 * to narrow it (`api<User[]>("/users")`). Absolute URLs are passed to `fetch`
 * mechanically — URL legality is the conformance checker's concern, not this
 * function's.
 */
export function api<T = unknown>(path: string, opts?: RequestOpts): Promise<T>;

/**
 * POST `body` as JSON to `path` and return the parsed JSON response. On a
 * non-OK response, `onError` (if given) is invoked with the error's message
 * before the returned promise rejects with an {@link ApiError}.
 */
export function post<T = unknown>(
  path: string,
  body: unknown,
  onError?: (msg: string, status: number, path: string) => void,
  opts?: RequestOpts,
): Promise<T>;

/**
 * Register a single module-level getter returning a headers object merged into
 * every {@link api}/{@link post} request. Registering a second getter is a hard
 * error, never a silent overwrite.
 *
 * PLATFORM NOTE: only the fetch-based transports (api/post) attach these
 * headers. Browser `EventSource` ({@link sse}) and `WebSocket` ({@link socket})
 * cannot carry custom request headers, so the auth hook has no effect on them —
 * use a same-origin cookie or a query parameter for realtime auth instead.
 */
export function setAuthHeader(getter: () => Record<string, string>): void;

// -- realtime.js --------------------------------------------------------------

/** Options for {@link sse}. */
export interface SseOpts {
  /** Default `message` events: `data` is auto-parsed as JSON (raw-string fallback). */
  onMessage: (data: unknown, event: MessageEvent) => void;
  /** The `error` event handler. */
  onError?: (event: Event) => void;
  /** The `open` event handler. */
  onOpen?: (event: Event) => void;
  /** Named server events; each handler gets the same auto-JSON `data`. */
  events?: Record<string, (data: unknown, event: MessageEvent) => void>;
}

/** The handle {@link sse} returns. */
export interface SseHandle {
  /** Close the EventSource. */
  close(): void;
}

/**
 * Wrap an `EventSource` for a same-origin SSE endpoint. `path` must be relative
 * (throws on an absolute/external URL). Reconnection is browser-native: the
 * browser resends the last event id in the `Last-Event-ID` header so a server
 * that stamps events with `id:` can resume the stream.
 */
export function sse(path: string, opts: SseOpts): SseHandle;

/** Options for {@link socket}. */
export interface SocketOpts {
  /** Incoming frames: `data` is auto-parsed as JSON (raw-string fallback). */
  onMessage: (data: unknown, event: MessageEvent) => void;
  /** The `error` event handler. */
  onError?: (event: Event) => void;
  /** The `open` event handler (fires on the first connect and every reconnect). */
  onOpen?: (event: Event) => void;
  /** Fires after a SUCCESSFUL reconnection (not the first connect) so the caller can resync. */
  onReconnect?: (event: Event) => void;
  /** Reconnect on abnormal close with exponential backoff (default `true`). */
  reconnect?: boolean;
  /** WebSocket subprotocol(s). */
  protocols?: string | string[];
}

/** The handle {@link socket} returns. */
export interface SocketHandle {
  /** Send a frame: objects are JSON-stringified, strings pass through. Throws while closed. */
  send(data: unknown): void;
  /** Close for good and cancel any pending reconnect. */
  close(): void;
}

/**
 * Wrap a `WebSocket` for a same-origin endpoint. `path` must be relative
 * ("/ws/x", throws on absolute/external); the scheme (ws/wss) and host are
 * resolved from `location`. On an abnormal close the socket reconnects with
 * framework-owned exponential backoff — 1000ms first, ×2 each attempt, capped
 * at 30000ms — unless `reconnect: false`. `send()` while not open THROWS (no
 * silent buffering).
 */
export function socket(path: string, opts: SocketOpts): SocketHandle;

// -- format.js ----------------------------------------------------------------

/**
 * Format a media duration in seconds as "m:ss" (under an hour) or "h:mm:ss" (at
 * or above). Negative/fractional inputs are clamped and floored.
 */
export function fmtTime(seconds: number): string;

/**
 * A localized relative-time string ("3 minutes ago", "in 2 hours", "now") via
 * `Intl.RelativeTimeFormat`. `date` is a `Date` or ms timestamp; `now` (ms)
 * overrides the reference point for deterministic output.
 */
export function relativeTime(date: Date | number, now?: number): string;

/**
 * Register `el` so its `textContent` tracks the relative time to `date`,
 * repainted once a second by a single shared ticker (started on the first
 * registration, stopped when the last leaves). Returns an unregister function.
 */
export function liveRelativeTime(el: HTMLElement, date: Date | number): () => void;

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
  /**
   * Apply the `theme` value to `<html data-theme>` and dispatch `tm:theme`. A
   * stored `"system"` value is resolved to the concrete OS theme (light/dark)
   * via `matchMedia`, and re-resolved live whenever the OS preference changes
   * while the stored value remains `"system"`. Requires a `theme` key.
   */
  applyTheme(): void;
}

/**
 * Create a schema-parameterized settings store backed by localStorage. Both
 * `storageKey` and `defaults` are required — the store fails loudly otherwise.
 */
export function createSettings<T extends Record<string, unknown>>(
  opts: SettingsOpts<T>,
): SettingsStore<T>;

/**
 * Cycle a settings store's `theme` through dark → light → system → dark and
 * return the new value. Persists via `store.set("theme", …)`, which re-applies
 * the theme (resolving `"system"`).
 */
export function cycleTheme(
  store: { get(key: "theme"): string; set(key: "theme", value: string): void },
): string;

/**
 * An inline pre-paint script (drop into a `<script>` in `<head>`, before your
 * stylesheets) that reads the persisted settings blob, resolves a stored
 * `"system"` theme against the OS, and sets `<html data-theme>` before the first
 * paint to avoid a theme flash. Assumes the default storage key `"tm-settings"`;
 * replace that literal if your `storageKey` differs.
 */
export const THEME_BOOT_SNIPPET: string;

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
