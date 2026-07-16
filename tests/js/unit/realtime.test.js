import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sse, socket } from "../../../assets/js/realtime.js";

// Unit tests for realtime.js. happy-dom does not ship EventSource or WebSocket,
// so we install test-local mocks here (never shims in shipped code) and drive
// their lifecycle by hand. Fake timers assert the reconnect backoff schedule.

// -- test-local WebSocket mock ------------------------------------------------

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    this._listeners = {};
    MockWebSocket.instances.push(this);
  }
  addEventListener(type, cb) {
    (this._listeners[type] = this._listeners[type] || []).push(cb);
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
  _emit(type, event) {
    for (const cb of this._listeners[type] || []) cb(event);
  }
  _open() {
    this.readyState = MockWebSocket.OPEN;
    this._emit("open", {});
  }
  _message(data) {
    this._emit("message", { data });
  }
  _dropAbnormal() {
    this.readyState = MockWebSocket.CLOSED;
    this._emit("close", { wasClean: false });
  }
  _closeClean() {
    this.readyState = MockWebSocket.CLOSED;
    this._emit("close", { wasClean: true });
  }
}

// -- test-local EventSource mock ----------------------------------------------

class MockEventSource {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.closed = false;
    this._listeners = {};
    MockEventSource.instances.push(this);
  }
  addEventListener(type, cb) {
    (this._listeners[type] = this._listeners[type] || []).push(cb);
  }
  close() {
    this.closed = true;
  }
  _emit(type, event) {
    for (const cb of this._listeners[type] || []) cb(event);
  }
  _message(data) {
    this._emit("message", { data });
  }
  _named(name, data) {
    this._emit(name, { data });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  MockEventSource.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// -- relative-path enforcement ------------------------------------------------

describe("realtime: relative-path enforcement", () => {
  it("sse throws on an absolute http(s) URL", () => {
    expect(() => sse("https://x.example/events", { onMessage() {} })).toThrow("must be relative");
  });
  it("socket throws on an absolute wss URL", () => {
    expect(() => socket("wss://x.example/ws", { onMessage() {} })).toThrow("must be relative");
  });
  it("socket throws on a protocol-relative //host URL", () => {
    expect(() => socket("//x.example/ws", { onMessage() {} })).toThrow("must be relative");
  });
  it("throws when path is empty", () => {
    expect(() => socket("", { onMessage() {} })).toThrow("path is required");
  });
  it("throws when onMessage is missing", () => {
    expect(() => socket("/ws/x", {})).toThrow("onMessage is required");
    expect(() => sse("/events", {})).toThrow("onMessage is required");
  });
  it("accepts a relative same-origin path", () => {
    expect(() => sse("/events", { onMessage() {} })).not.toThrow();
    expect(() => socket("/ws/x", { onMessage() {} })).not.toThrow();
  });
});

// -- sse ----------------------------------------------------------------------

describe("realtime: sse", () => {
  it("auto-parses JSON message data and passes (data, event)", () => {
    const got = [];
    sse("/events", { onMessage: (data, event) => got.push([data, event]) });
    const es = MockEventSource.instances[0];
    es._message(JSON.stringify({ a: 1 }));
    expect(got[0][0]).toEqual({ a: 1 });
    expect(got[0][1]).toMatchObject({ data: JSON.stringify({ a: 1 }) });
  });

  it("falls back to the raw string when data is not JSON", () => {
    const got = [];
    sse("/events", { onMessage: (data) => got.push(data) });
    MockEventSource.instances[0]._message("plain text");
    expect(got[0]).toBe("plain text");
  });

  it("subscribes named events via the events map with auto-JSON", () => {
    const ticks = [];
    sse("/events", {
      onMessage() {},
      events: { tick: (data) => ticks.push(data) },
    });
    MockEventSource.instances[0]._named("tick", JSON.stringify({ n: 5 }));
    expect(ticks[0]).toEqual({ n: 5 });
  });

  it("close() closes the underlying EventSource", () => {
    const handle = sse("/events", { onMessage() {} });
    handle.close();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });
});

// -- socket: connection, JSON, send ------------------------------------------

describe("realtime: socket connection + JSON", () => {
  it("resolves a ws:// URL from a relative path and fires onOpen (not onReconnect) on first connect", () => {
    const events = [];
    socket("/ws/chat", {
      onMessage() {},
      onOpen: () => events.push("open"),
      onReconnect: () => events.push("reconnect"),
    });
    const ws = MockWebSocket.instances[0];
    expect(ws.url.startsWith("ws://") || ws.url.startsWith("wss://")).toBe(true);
    ws._open();
    expect(events).toEqual(["open"]);
  });

  it("auto-parses JSON frames with raw-string fallback", () => {
    const got = [];
    socket("/ws/x", { onMessage: (data) => got.push(data) });
    const ws = MockWebSocket.instances[0];
    ws._open();
    ws._message(JSON.stringify({ hello: "world" }));
    ws._message("not json");
    expect(got[0]).toEqual({ hello: "world" });
    expect(got[1]).toBe("not json");
  });

  it("send() stringifies objects and passes strings through", () => {
    const handle = socket("/ws/x", { onMessage() {} });
    const ws = MockWebSocket.instances[0];
    ws._open();
    handle.send({ a: 1 });
    handle.send("raw");
    expect(ws.sent).toEqual([JSON.stringify({ a: 1 }), "raw"]);
  });

  it("send() throws while the socket is not open (no silent buffering)", () => {
    const handle = socket("/ws/x", { onMessage() {} });
    // Not opened yet → CONNECTING.
    expect(() => handle.send({ a: 1 })).toThrow("not open");
    // After an abnormal drop the socket is closed → still throws.
    const ws = MockWebSocket.instances[0];
    ws._open();
    ws._dropAbnormal();
    expect(() => handle.send("x")).toThrow("not open");
  });

  it("passes protocols to the WebSocket constructor", () => {
    socket("/ws/x", { onMessage() {}, protocols: ["v1", "v2"] });
    expect(MockWebSocket.instances[0].protocols).toEqual(["v1", "v2"]);
  });
});

// -- socket: reconnection backoff --------------------------------------------

describe("realtime: socket reconnection", () => {
  it("reconnects on abnormal close with exponential backoff (1000 → 2000 → 4000, capped at 30000)", () => {
    vi.useFakeTimers();
    socket("/ws/x", { onMessage() {} });
    expect(MockWebSocket.instances.length).toBe(1);
    MockWebSocket.instances[0]._open();
    MockWebSocket.instances[0]._dropAbnormal();

    // First retry after exactly 1000ms.
    vi.advanceTimersByTime(999);
    expect(MockWebSocket.instances.length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances.length).toBe(2);

    // Drop again (never opened) → next retry after 2000ms.
    MockWebSocket.instances[1]._dropAbnormal();
    vi.advanceTimersByTime(1999);
    expect(MockWebSocket.instances.length).toBe(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances.length).toBe(3);

    // Drop again → 4000ms.
    MockWebSocket.instances[2]._dropAbnormal();
    vi.advanceTimersByTime(3999);
    expect(MockWebSocket.instances.length).toBe(3);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances.length).toBe(4);
  });

  it("caps the backoff at 30000ms", () => {
    vi.useFakeTimers();
    socket("/ws/x", { onMessage() {} });
    // Drive enough drops that the uncapped delay (1000·2^n) exceeds 30000.
    // Delays: 1000, 2000, 4000, 8000, 16000, then capped 30000.
    const delays = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
    MockWebSocket.instances[0]._open();
    let idx = 0;
    for (const delay of delays) {
      MockWebSocket.instances[idx]._dropAbnormal();
      vi.advanceTimersByTime(delay - 1);
      expect(MockWebSocket.instances.length).toBe(idx + 1);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(idx + 2);
      idx += 1;
    }
  });

  it("resets the backoff after a successful reconnect", () => {
    vi.useFakeTimers();
    socket("/ws/x", { onMessage() {} });
    MockWebSocket.instances[0]._open();
    MockWebSocket.instances[0]._dropAbnormal();
    vi.advanceTimersByTime(1000);
    // instance[1] created; open it → backoff resets.
    MockWebSocket.instances[1]._open();
    MockWebSocket.instances[1]._dropAbnormal();
    // Next retry is back to 1000ms, not 2000ms.
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(3);
  });

  it("onReconnect fires only after a SUCCESSFUL reconnection, not the first connect", () => {
    vi.useFakeTimers();
    const events = [];
    socket("/ws/x", {
      onMessage() {},
      onOpen: () => events.push("open"),
      onReconnect: () => events.push("reconnect"),
    });
    MockWebSocket.instances[0]._open(); // first connect
    MockWebSocket.instances[0]._dropAbnormal();
    vi.advanceTimersByTime(1000);
    MockWebSocket.instances[1]._open(); // reconnect
    expect(events).toEqual(["open", "open", "reconnect"]);
  });

  it("reconnect:false opts out entirely", () => {
    vi.useFakeTimers();
    socket("/ws/x", { onMessage() {}, reconnect: false });
    MockWebSocket.instances[0]._open();
    MockWebSocket.instances[0]._dropAbnormal();
    vi.advanceTimersByTime(60000);
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("a clean close never reconnects", () => {
    vi.useFakeTimers();
    socket("/ws/x", { onMessage() {} });
    MockWebSocket.instances[0]._open();
    MockWebSocket.instances[0]._closeClean();
    vi.advanceTimersByTime(60000);
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("close() cancels a pending reconnect", () => {
    vi.useFakeTimers();
    const handle = socket("/ws/x", { onMessage() {} });
    MockWebSocket.instances[0]._open();
    MockWebSocket.instances[0]._dropAbnormal(); // schedules a reconnect at 1000ms
    handle.close();
    vi.advanceTimersByTime(60000);
    expect(MockWebSocket.instances.length).toBe(1);
  });
});
