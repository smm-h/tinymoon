import { test, expect } from "@playwright/test";

// Router polish (Phase 6C): async view factories and deep-link query parsing,
// exercised through the gallery's "Async route" (#/deferred). The route's view
// factory returns a Promise (resolved after a short delay), and the resolved
// view reads ctx.query — the parsed deep-link query — into a <pre>.

test.describe("router — async view factory", () => {
  test("resolves the async route: the deferred view mounts in place", async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
    await page.evaluate(() => { location.hash = "#/deferred"; });

    // The factory returned a Promise; the router resolves it and mounts the view.
    await expect(page.getByRole("heading", { name: "Deferred view" })).toBeVisible();
    // With no query, the panel says so.
    await expect(page.locator('[data-testid="deferred-query"]')).toContainText("no query params");
  });
});

test.describe("router — deep-link query", () => {
  test("a deep-link query reaches the view via ctx.query", async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
    await page.evaluate(() => { location.hash = "#/deferred?panel=metrics&range=7d"; });

    const out = page.locator('[data-testid="deferred-query"]');
    await expect(out).toContainText("panel = metrics");
    await expect(out).toContainText("range = 7d");
  });

  test("changing only the query re-renders the same view live", async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
    await page.evaluate(() => { location.hash = "#/deferred?panel=metrics"; });
    const out = page.locator('[data-testid="deferred-query"]');
    await expect(out).toContainText("panel = metrics");

    await page.evaluate(() => { location.hash = "#/deferred?panel=logs&range=1h"; });
    await expect(out).toContainText("panel = logs");
    await expect(out).toContainText("range = 1h");
  });
});
