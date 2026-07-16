// tinymoon — minimal fetch helpers for same-origin JSON APIs.

// ApiError — thrown by api()/post() on a non-OK response. It carries the HTTP
// `status`, the `statusText`, the request `path`, and a `detail` string
// surfaced from the response body's `detail` OR `error` field (both server
// shapes are supported). `message` is the detail when present, otherwise a
// "Error <status>" fallback, so a caller reading `err.message` (e.g. to toast
// it) always gets something meaningful. `detail` is undefined when the body
// carried neither field (or was not JSON).
export class ApiError extends Error {
  constructor(status, statusText, path, detail) {
    super(detail || "Error " + status);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.path = path;
    this.detail = detail;
  }
}

// Auth-header hook — a single module-level getter (mirrors setToastErrorHook:
// registering a second one is a hard error, never a silent overwrite).
let authHeaderGetter = null;

// setAuthHeader(getter): register a function returning a headers object (e.g.
// `{Authorization: "Bearer …"}`) merged into every api()/post() request at call
// time. Registering a second getter is a hard error.
//
// PLATFORM NOTE: only the fetch-based transports (api/post) can attach these
// headers. Browser EventSource (sse) and WebSocket (socket) — see realtime.js —
// cannot carry custom request headers, so the auth hook has no effect on them.
// Use a same-origin cookie or a query parameter for realtime auth instead. This
// is a browser-platform limitation, stated plainly rather than worked around.
export function setAuthHeader(getter) {
  if (authHeaderGetter) throw new Error("setAuthHeader: a getter is already registered");
  if (typeof getter !== "function") throw new Error("setAuthHeader: getter must be a function");
  authHeaderGetter = getter;
}

// Current auth headers, or {} when no hook is set.
function authHeaders() {
  return authHeaderGetter ? (authHeaderGetter() || {}) : {};
}

// Build an ApiError from a non-OK response, surfacing detail from the JSON
// body's `detail` or `error` field (either shape) when the body is JSON.
async function apiError(r, path) {
  const data = await r.json().catch(() => null);
  const detail = data ? (data.detail || data.error) : undefined;
  return new ApiError(r.status, r.statusText, path, detail || undefined);
}

// api(path, {signal?, headers?}) → parsed JSON body of a GET request. On a
// non-OK response it throws an ApiError (status/statusText/path/detail). The
// optional `signal` aborts the request; `headers` are merged over the auth-hook
// headers for this call.
//
// Absolute URLs are passed to fetch() mechanically — fetch accepts them, and
// whether a URL is *legal* is the conformance checker/allowlist's concern, not
// net.js's. This is decided, documented behavior (see the pinning unit test).
export async function api(path, opts) {
  const { signal, headers } = opts || {};
  const r = await fetch(path, {
    signal,
    headers: { ...authHeaders(), ...(headers || {}) },
  });
  if (!r.ok) throw await apiError(r, path);
  return r.json();
}

// post(path, body, onError?, {signal?, headers?}) → parsed JSON body of a JSON
// POST. On a non-OK response it throws an ApiError; when onError(msg, status,
// path) is given it is called with the error's message BEFORE the throw, so
// callers can surface the failure (e.g. a toast) without wrapping every call
// site in try/catch. `signal` aborts; `headers` merge over the auth-hook
// headers and the Content-Type. Absolute URLs pass through mechanically (see
// api()).
export async function post(path, body, onError, opts) {
  const { signal, headers } = opts || {};
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(headers || {}) },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const err = await apiError(r, path);
    if (onError) onError(err.message, r.status, path);
    throw err;
  }
  return r.json();
}
