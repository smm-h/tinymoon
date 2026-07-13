// tinymoon — minimal fetch helpers for same-origin JSON APIs.

// api(path) → parsed JSON body of a GET request.
export const api = (path) => fetch(path).then((r) => r.json());

// post(path, body, onError?) → parsed JSON body of a JSON POST. A non-2xx
// response rejects with an Error carrying the server's `error` field (or the
// status code). When onError(msg, status, path) is given it is called before
// the rejection, so callers can surface the failure (e.g. a toast) without
// wrapping every call site in try/catch.
export async function post(path, body, onError) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data.error || "Error " + r.status;
    if (onError) onError(msg, r.status, path);
    throw new Error(msg);
  }
  return data;
}
