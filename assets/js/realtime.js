// tinymoon — realtime transports: a same-origin EventSource (SSE) wrapper and a
// same-origin WebSocket wrapper. Both handle JSON automatically, and the socket
// wrapper owns its reconnection policy.
//
// RELATIVE PATHS ONLY. Both helpers take a relative, same-origin path (e.g.
// "/events", "/ws/chat") and THROW on an absolute or external URL. This is
// deliberate, not a limitation: routing every realtime connection through a
// relative path keeps consumer code conformance-clean (the checker bans
// external ws://, wss://, and http(s):// literals as identity-surface loads),
// and there is no legitimate cross-origin realtime case the framework serves.
// The socket wrapper resolves the scheme (ws/wss) and host from `location`
// internally, so callers never write a `new WebSocket("wss://…")` literal.
//
// AUTH NOTE: the setAuthHeader() hook in net.js does NOT reach these transports.
// Browser EventSource and WebSocket cannot carry custom request headers, so the
// auth hook has no effect here. Use a same-origin cookie or a query parameter
// for realtime auth. This is a browser-platform limitation, stated plainly
// rather than worked around.

// Reject anything that carries a scheme or a host — only a same-origin relative
// path is allowed. `//host` (protocol-relative) and `scheme://host` both fail.
function requireRelative(path, who) {
  if (typeof path !== "string" || !path) {
    throw new Error(who + ": path is required");
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//")) {
    throw new Error(
      who + ': path "' + path + '" must be relative and same-origin (no'
      + " scheme, no host) — realtime connections route through a same-origin"
      + " path to stay conformance-clean",
    );
  }
}

// Parse an event payload as JSON, falling back to the raw string when it is not
// valid JSON. Both are passed to the handler: handler(data, event).
function parsePayload(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

// sse(path, {onMessage, onError?, onOpen?, events?}) → {close()}.
//
// Wraps EventSource for a same-origin SSE endpoint. Each default `message`
// event's `data` is auto-parsed as JSON (raw-string fallback) and delivered as
// `onMessage(data, event)`. Named server events are subscribed via the `events`
// map ({eventName: (data, event) => …}), each with the same auto-JSON handling.
//
// Reconnection is browser-native: EventSource reconnects automatically after a
// drop, and the browser resends the last event id in the `Last-Event-ID`
// request header, so a server that stamps events with `id:` can resume the
// stream from where the client left off. The wrapper adds no reconnection of
// its own — this is the one place the platform already does the right thing.
export function sse(path, opts) {
  const { onMessage, onError, onOpen, events } = opts || {};
  requireRelative(path, "sse");
  if (typeof onMessage !== "function") {
    throw new Error("sse: onMessage is required");
  }
  const es = new EventSource(path);
  es.addEventListener("message", (event) => onMessage(parsePayload(event.data), event));
  if (onOpen) es.addEventListener("open", onOpen);
  if (onError) es.addEventListener("error", onError);
  if (events) {
    for (const [name, handler] of Object.entries(events)) {
      es.addEventListener(name, (event) => handler(parsePayload(event.data), event));
    }
  }
  return {
    close() {
      es.close();
    },
  };
}

// Framework-owned WebSocket reconnection backoff (documented, fixed):
//   first retry after 1000ms, doubling each attempt, capped at 30000ms.
const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_FACTOR = 2;
const BACKOFF_CAP_MS = 30000;

// socket(path, {onMessage, onError?, onOpen?, onReconnect?, reconnect?,
// protocols?}) → {send(data), close()}.
//
// Wraps WebSocket for a same-origin endpoint. The path is relative ("/ws/x");
// the scheme (ws for http, wss for https) and host are resolved from
// `location`. Incoming frames are auto-parsed as JSON (raw-string fallback):
// onMessage(data, event). send() stringifies objects and passes strings through
// unchanged.
//
// RECONNECTION (framework-owned): on an ABNORMAL close (one the peer did not
// close cleanly), the socket reconnects with exponential backoff — 1000ms
// first, ×2 each attempt, capped at 30000ms — resetting the backoff on a
// successful open. `reconnect: false` opts out entirely. A clean close and an
// explicit close() never reconnect. `onReconnect(event)` fires after a
// SUCCESSFUL reconnection (not the first connect), so the caller can resync
// application state — resync protocols (replay from a cursor, refetch a
// snapshot) are application-level, so the framework only signals the moment and
// leaves the strategy to you.
//
// send() while the socket is not open THROWS. There is deliberately no silent
// buffering: the same call must behave the same way every time, so a caller
// that sends before open (or during a reconnect gap) gets a hard error rather
// than a queue that may or may not flush. Gate sends on onOpen/onReconnect.
export function socket(path, opts) {
  const {
    onMessage, onError, onOpen, onReconnect,
    reconnect = true, protocols,
  } = opts || {};
  requireRelative(path, "socket");
  if (typeof onMessage !== "function") {
    throw new Error("socket: onMessage is required");
  }

  // Resolve the same-origin ws/wss URL from the relative path.
  const u = new URL(path, location.href);
  u.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = u.href;

  let ws = null;
  let closedByUser = false;
  let hasConnectedOnce = false;
  let attempts = 0;
  let reconnectTimer = null;

  function scheduleReconnect() {
    const delay = Math.min(
      BACKOFF_INITIAL_MS * Math.pow(BACKOFF_FACTOR, attempts),
      BACKOFF_CAP_MS,
    );
    attempts += 1;
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    reconnectTimer = null;
    ws = protocols !== undefined ? new WebSocket(url, protocols) : new WebSocket(url);
    ws.addEventListener("open", (event) => {
      const wasReconnect = hasConnectedOnce;
      hasConnectedOnce = true;
      attempts = 0;
      if (onOpen) onOpen(event);
      if (wasReconnect && onReconnect) onReconnect(event);
    });
    ws.addEventListener("message", (event) => onMessage(parsePayload(event.data), event));
    if (onError) ws.addEventListener("error", onError);
    ws.addEventListener("close", (event) => {
      // User-initiated or opted-out: stay closed. A clean peer close (wasClean)
      // is intentional and also does not reconnect. Only an abnormal drop does.
      if (closedByUser || !reconnect || (event && event.wasClean)) return;
      scheduleReconnect();
    });
  }

  connect();

  return {
    // send(data): objects are JSON-stringified, strings pass through. Throws
    // when the socket is not open — no silent buffering.
    send(data) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error(
          "socket.send: connection is not open — no silent buffering; wait for"
          + " onOpen/onReconnect before sending",
        );
      }
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
    },
    // close(): closes for good and cancels any pending reconnect.
    close() {
      closedByUser = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) ws.close();
    },
  };
}
