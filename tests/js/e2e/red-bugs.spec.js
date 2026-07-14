import { test, expect } from "@playwright/test";

// RED TESTS (e2e) — each pins the FUTURE, correct behavior of a known bug and
// is expected to FAIL against the current code. They are marked test.fail()
// inside the test so Playwright treats the failure as expected and the run
// stays green. When the bug is fixed in the phase named below, remove the
// test.fail() line and the test becomes a real regression guard.

// ---------------------------------------------------------------------------
// BUG (Escape multi-close) — FIXED in Phase 2.1 (kernel overlay module).
// A Select opened inside an open modal: pressing Escape once used to close
// BOTH because select.js didn't stopPropagation and modal.js had its own
// document listener. Now both go through the kernel's pushLayer stack, and
// only the topmost layer closes per Escape press.
// ---------------------------------------------------------------------------
test("one Escape closes only the select menu, leaving the modal open", async ({ page }) => {
  await page.goto("/tests/js/e2e/fixtures/escape-stack.html");
  await page.waitForFunction(() => window.__escapeStackReady === true);

  await expect(page.locator("#tm-modal-root")).toHaveClass(/open/);
  await page.locator(".sel-btn").click();
  await expect(page.locator(".sel")).toHaveClass(/open/);

  await page.keyboard.press("Escape");

  // Future: the modal is still open after a single Escape. Fails today because
  // the same Escape bubbles up and closes the modal too.
  await expect(page.locator("#tm-modal-root")).toHaveClass(/open/, { timeout: 2000 });
});

// ---------------------------------------------------------------------------
// BUG (router malformed hash) — assets/js/shell.js — FIX: Phase 2
// Navigating to a hash whose sub-path is not valid percent-encoding (e.g.
// "#/wiki/%zz") makes decodeURIComponent throw inside the hashchange handler,
// producing an uncaught exception. Correct future behavior: a malformed hash
// is handled gracefully with no uncaught error.
// ---------------------------------------------------------------------------
test("navigating to a malformed hash does not throw an uncaught error", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();

  await page.evaluate(() => { location.hash = "#/wiki/%zz"; });
  await page.waitForTimeout(250); // let the hashchange handler run

  // Future: no uncaught error. Fails today because decodeURIComponent throws.
  expect(errors, `errors: ${errors.join(" | ")}`).toHaveLength(0);
});
