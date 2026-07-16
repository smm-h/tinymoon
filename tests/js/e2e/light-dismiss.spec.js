import { test, expect } from "@playwright/test";

// Kernel-centralized light-dismiss: the popover and custom select ride the same
// outside-pointer registry as the drawer. These specs pin the toggle contract —
// pressing a trigger while the overlay is open closes it and it STAYS closed
// (the gesture-claim prevents a close-press from immediately reopening).

test.describe("popover light-dismiss + toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/");
    await page.locator('.nav-item[data-route="widgets"]').click();
    await expect(page.locator('[data-testid="open-popover"]')).toBeVisible();
  });

  test("opens on click, closes on an outside pointerdown", async ({ page }) => {
    await page.locator('[data-testid="open-popover"]').click();
    await expect(page.locator(".popover")).toBeVisible();
    // Press well away from both the popover and its anchor.
    await page.mouse.click(5, 5);
    await expect(page.locator(".popover")).toHaveCount(0);
  });

  test("pressing the anchor while open closes it and it stays closed", async ({ page }) => {
    const anchor = page.locator('[data-testid="open-popover"]');
    await anchor.click();
    await expect(page.locator(".popover")).toBeVisible();
    // The anchor is the registered trigger: pointerdown dismisses + claims the
    // gesture, so the anchor's own open-only click handler cannot reopen it.
    await anchor.click();
    await expect(page.locator(".popover")).toHaveCount(0);
    await page.waitForTimeout(150);
    await expect(page.locator(".popover")).toHaveCount(0);
  });
});

test.describe("select light-dismiss + toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/");
    await page.locator('.nav-item[data-route="widgets"]').click();
  });

  test("opens on click, closes on an outside pointerdown", async ({ page }) => {
    const sel = page.locator('.sel-btn[aria-label="Custom select"]');
    const menu = page.locator('.sel:has(.sel-btn[aria-label="Custom select"])');
    await sel.click();
    await expect(menu).toHaveClass(/open/);
    await page.mouse.click(5, 5);
    await expect(menu).not.toHaveClass(/open/);
  });

  test("pressing the combobox button while open closes it and it stays closed", async ({ page }) => {
    const sel = page.locator('.sel-btn[aria-label="Custom select"]');
    const menu = page.locator('.sel:has(.sel-btn[aria-label="Custom select"])');
    await sel.click();
    await expect(menu).toHaveClass(/open/);
    // The button lives inside the select root (a registered panel), so the
    // registry treats the press as "inside" and the button's own toggle closes
    // it — no close-then-reopen.
    await sel.click();
    await expect(menu).not.toHaveClass(/open/);
    await page.waitForTimeout(150);
    await expect(menu).not.toHaveClass(/open/);
  });
});
