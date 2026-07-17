import { test, expect } from "@playwright/test";

// Phase 4B e2e: the Realtime route (sse/socket lifecycle) and the Transcript
// recipe route (store + reconcile + realtime + primitives). These routes are
// not part of the gallery-characterization zero-console-errors walk on purpose:
// the realtime demo connects to a nonexistent endpoint, which logs a browser
// WebSocket connection-failure error. That console noise is expected here and
// this spec does not assert against it.

test.describe("realtime demo — socket lifecycle", () => {
  test("Connect drives the closed/reconnecting lifecycle against a nonexistent endpoint", async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
    await page.evaluate(() => { location.hash = "#/realtime"; });

    const status = page.locator('[data-testid="realtime-status"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveText("idle");

    // Connect to the nonexistent endpoint: the connection fails and the
    // framework-owned backoff schedules a reconnect, surfaced in the status.
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(status).toContainText("reconnecting", { timeout: 15000 });

    // Disconnect stops further reconnects.
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(status).toContainText("closed by user");
  });
});

test.describe("transcript recipe — store · reconcile · realtime · primitives", () => {
  test("streams, auto-scrolls to the tail, pauses on scroll-up, and collapses a block", async ({ page }) => {
    // A live 600ms ticker drives this test; under a saturated parallel run the
    // message accumulation and settle waits stretch, so allow extra headroom.
    test.slow();
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
    await page.evaluate(() => { location.hash = "#/transcript"; });

    const scroll = page.locator('[data-testid="transcript-scroll"]');
    await expect(scroll).toBeVisible();
    const blocks = scroll.locator('[data-testid="transcript-block"]');

    // (1) Streams: messages accumulate from the synthetic source.
    await expect.poll(async () => blocks.count(), { timeout: 10000 }).toBeGreaterThanOrEqual(6);

    // (2) Auto-scroll: while pinned, the viewport tracks the tail.
    await expect
      .poll(async () =>
        scroll.evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight), { timeout: 5000 })
      .toBeLessThan(24);

    // (3) Pause on scroll-up: a user scroll-up gesture reveals the resume control
    // and stops the auto-follow — new messages no longer move the viewport. The
    // recipe un-pins on the gesture (wheel), so simulate a real one: jump to the
    // top instantly (behavior:"instant", since CSS scroll-behavior:smooth would
    // otherwise animate) and fire a wheel-up. This un-pins synchronously, so the
    // pause is deterministic against the live ticker — no polling needed.
    await scroll.evaluate((e) => {
      e.scrollTo({ top: 0, behavior: "instant" });
      e.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
    });
    const resume = page.locator('[data-testid="transcript-resume"]');
    await expect(resume).toBeVisible();
    const topBefore = await scroll.evaluate((e) => e.scrollTop);
    await page.waitForTimeout(1500); // let at least two more messages append
    const topAfter = await scroll.evaluate((e) => e.scrollTop);
    expect(topAfter, "viewport stays put while paused").toBe(topBefore);

    // Resume re-pins to the tail.
    await resume.click();
    await expect(resume).toBeHidden();
    await expect
      .poll(async () =>
        scroll.evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight), { timeout: 5000 })
      .toBeLessThan(24);

    // (4) Collapse: clicking a block header collapses it (Playwright scrolls it
    // into view first). The collapsed flag lives in the store; reconcile
    // reflects it onto the reused node.
    const first = blocks.first();
    await first.locator(".transcript-head").click();
    await expect(first).toHaveClass(/collapsed/);
    await expect(first.locator(".transcript-body")).toBeHidden();
  });
});
