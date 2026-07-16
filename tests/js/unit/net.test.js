import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unit tests for net.js: ApiError shape + detail extraction from both the
// `detail` and `error` fields, onError ordering, abort-signal passthrough, the
// absolute-URL passthrough (decided, documented behavior), and the single-hook
// setAuthHeader with header injection + per-call override.
//
// A fresh module is imported per test (vi.resetModules) so the module-level
// auth-header getter is reset between tests — mirrors the toast.js singleton
// test pattern.

// Build a fake Response. `body` is returned from json(); a `null` body makes
// json() reject (simulating a non-JSON body), exercising the raw-fallback path.
function fakeResponse({ ok = true, status = 200, statusText = "OK", body = {} } = {}) {
  return {
    ok,
    status,
    statusText,
    json: () =>
      body === null ? Promise.reject(new Error("not json")) : Promise.resolve(body),
  };
}

describe("net", () => {
  let api, post, ApiError, setAuthHeader, fetchMock;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../../../assets/js/net.js");
    api = mod.api;
    post = mod.post;
    ApiError = mod.ApiError;
    setAuthHeader = mod.setAuthHeader;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -- api() happy path --

  it("api() returns the parsed JSON body of a GET", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: { id: 7 } }));
    const out = await api("/thing");
    expect(out).toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledWith("/thing", expect.objectContaining({}));
  });

  // -- ApiError shape + detail extraction --

  it("api() throws an ApiError carrying status/statusText/path", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ ok: false, status: 404, statusText: "Not Found", body: {} }),
    );
    let err;
    try {
      await api("/missing");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(404);
    expect(err.statusText).toBe("Not Found");
    expect(err.path).toBe("/missing");
    // No detail/error field → detail undefined, message falls back to status.
    expect(err.detail).toBeUndefined();
    expect(err.message).toBe("Error 404");
  });

  it("ApiError.detail is surfaced from the `detail` field", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ ok: false, status: 400, statusText: "Bad Request", body: { detail: "Name required" } }),
    );
    const err = await api("/x").catch((e) => e);
    expect(err.detail).toBe("Name required");
    expect(err.message).toBe("Name required");
  });

  it("ApiError.detail is surfaced from the `error` field (alternate shape)", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ ok: false, status: 500, statusText: "Server Error", body: { error: "Boom" } }),
    );
    const err = await api("/x").catch((e) => e);
    expect(err.detail).toBe("Boom");
    expect(err.message).toBe("Boom");
  });

  it("ApiError falls back to Error <status> when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ ok: false, status: 503, statusText: "Unavailable", body: null }),
    );
    const err = await api("/x").catch((e) => e);
    expect(err.detail).toBeUndefined();
    expect(err.message).toBe("Error 503");
  });

  // -- post() onError ordering --

  it("post() sends JSON and returns the parsed body", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: { ok: true } }));
    const out = await post("/echo", { a: 1 });
    expect(out).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("post() calls onError(msg, status, path) BEFORE throwing the ApiError", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ ok: false, status: 422, statusText: "Unprocessable", body: { error: "Nope" } }),
    );
    const seen = [];
    const err = await post("/x", { a: 1 }, (msg, status, path) => seen.push([msg, status, path])).catch((e) => e);
    expect(seen).toEqual([["Nope", 422, "/x"]]);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.detail).toBe("Nope");
  });

  // -- abort signal passthrough --

  it("api() passes an AbortSignal through to fetch", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: {} }));
    const ctrl = new AbortController();
    await api("/thing", { signal: ctrl.signal });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBe(ctrl.signal);
  });

  it("post() passes an AbortSignal through to fetch", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: {} }));
    const ctrl = new AbortController();
    await post("/thing", { a: 1 }, undefined, { signal: ctrl.signal });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBe(ctrl.signal);
  });

  // -- absolute-URL passthrough (decided, documented behavior) --

  it("api() passes an absolute URL through to fetch mechanically", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: {} }));
    await api("https://example.com/data");
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/data");
  });

  it("post() passes an absolute URL through to fetch mechanically", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: {} }));
    await post("https://example.com/data", { a: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/data");
  });

  // -- setAuthHeader: single registration + header injection --

  it("setAuthHeader is a single hook: a second registration is a hard error", () => {
    setAuthHeader(() => ({ Authorization: "Bearer a" }));
    expect(() => setAuthHeader(() => ({ Authorization: "Bearer b" }))).toThrow(
      "already registered",
    );
  });

  it("setAuthHeader throws when the getter is not a function", () => {
    expect(() => setAuthHeader("nope")).toThrow("must be a function");
  });

  it("auth-hook headers are injected into api() requests", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: {} }));
    setAuthHeader(() => ({ Authorization: "Bearer tok" }));
    await api("/thing");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("auth-hook headers are injected into post() requests alongside Content-Type", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: {} }));
    setAuthHeader(() => ({ Authorization: "Bearer tok" }));
    await post("/thing", { a: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("per-call headers merge over (and can override) the auth-hook headers", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: {} }));
    setAuthHeader(() => ({ Authorization: "Bearer base", "X-Base": "1" }));
    await api("/thing", { headers: { Authorization: "Bearer override", "X-Call": "2" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer override");
    expect(init.headers["X-Base"]).toBe("1");
    expect(init.headers["X-Call"]).toBe("2");
  });

  it("with no hook registered, no Authorization header is added", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: {} }));
    await api("/thing");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});
