import { test, expect } from "@playwright/test";

// RED TESTS (e2e) — each pins the FUTURE, correct behavior of a known bug and
// is expected to FAIL against the current code. They are marked test.fail()
// inside the test so Playwright treats the failure as expected and the run
// stays green. When the bug is fixed in the phase named below, remove the
// test.fail() line and the test becomes a real regression guard.

// ---------------------------------------------------------------------------
// BUG (Escape multi-close) — assets/js/select.js + assets/js/modal.js — FIX: Phase 3
// A Select opened inside an open modal: pressing Escape once closes BOTH the
// select menu and the modal. select.js handles Escape on its menu element but
// does not stopPropagation, so the keydown bubbles to modal.js's document
// listener, which closes the modal too. Correct future behavior: one Escape
// closes only the select menu; the modal stays open.
// ---------------------------------------------------------------------------
test("one Escape closes only the select menu, leaving the modal open", async ({ page }) => {
  test.fail(); // expected to fail until Phase 3 fixes Escape stacking
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
  test.fail(); // expected to fail until Phase 2 hardens the router
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
