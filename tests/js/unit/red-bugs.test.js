import { describe, it, expect, vi } from "vitest";
import { icon } from "../../../assets/js/icons.js";
import { registerCtx } from "../../../assets/js/ctxmenu.js";
import { renderMiniMd } from "../../../assets/js/markdown.js";
import { api } from "../../../assets/js/net.js";
import { copyButton } from "../../../assets/js/controls.js";

// RED TESTS — each pins the FUTURE, correct behavior of a known bug and is
// expected to FAIL against the current code. They are marked it.fails(...) so
// the suite stays green overall while documenting the defect. When the bug is
// fixed in the phase named below, remove the .fails and the test turns into a
// real regression guard.

// ---------------------------------------------------------------------------
// BUG (copyButton success-lie) — assets/js/controls.js — FIX: Phase 2
// The click handler calls navigator.clipboard.writeText() but never awaits it.
// On a rejected write (clipboard denied) it still swaps to the success/check
// icon and adds the "copied" class, lying that the copy succeeded. Correct
// future behavior: no success state when the write fails.
// ---------------------------------------------------------------------------
describe("controls.copyButton", () => {
  it.fails("does not show the success state when the clipboard write fails", () => {
    // A pre-caught rejected promise: writeText rejects, but attaching the
    // catch here prevents an unhandled-rejection warning (the SUT never
    // awaits or catches the promise itself — that is the bug).
    const rejected = Promise.reject(new Error("clipboard denied"));
    rejected.catch(() => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(() => rejected) },
      configurable: true,
      writable: true,
    });

    const b = copyButton(() => "payload", "Copy");
    document.body.appendChild(b);
    b.dispatchEvent(new Event("click"));

    // Future: a failed write must NOT flash "copied". Fails today because the
    // button optimistically shows success before the write settles.
    expect(b.classList.contains("copied")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BUG (icon unknown name) — assets/js/icons.js — FIX: Phase 2
// icon() of an unregistered name currently returns "" (silent empty). Correct
// future behavior: an unknown icon name is a hard error, not a silent blank.
// ---------------------------------------------------------------------------
describe("icons.icon", () => {
  it.fails("throws on an unknown icon name instead of returning an empty string", () => {
    expect(() => icon("no-such-icon-name")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// BUG (registerCtx duplicate key) — assets/js/ctxmenu.js — FIX: Phase 2
// registerCtx silently overwrites an existing provider for the same key.
// Correct future behavior: a duplicate key is a hard error, mirroring
// registerIcons' collision guard.
// ---------------------------------------------------------------------------
describe("ctxmenu.registerCtx", () => {
  it.fails("throws when the same context key is registered twice", () => {
    registerCtx("tm-red-dup-key", () => []);
    expect(() => registerCtx("tm-red-dup-key", () => [])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// BUG (renderMiniMd external link target) — assets/js/markdown.js — FIX: Phase 2
// The dialect claims links are internal hash navigations only, but a target
// like https://evil.example is accepted and produces an anchor with that
// external href. Correct future behavior: non-# targets are refused (hard
// error), keeping the framework's zero-network guarantee.
// ---------------------------------------------------------------------------
describe("markdown.renderMiniMd", () => {
  it.fails("rejects a link target that is not an internal hash", () => {
    expect(() => renderMiniMd("[click](https://evil.example)")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// BUG (api ignores response status) — assets/js/net.js — FIX: Phase 2
// api() is `fetch(path).then(r => r.json())` — it never checks r.ok, so a 500
// with a JSON body resolves as if it succeeded. Correct future behavior: a
// non-2xx response rejects (as post() already does).
// ---------------------------------------------------------------------------
describe("net.api", () => {
  it.fails("rejects on a non-2xx response instead of resolving the error body", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "boom" }),
      }),
    );
    await expect(api("/broken")).rejects.toThrow();
  });
});
