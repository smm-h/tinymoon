import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleAnimations } from "./helpers.js";

// Shell semantics: landmark structure, document.title sync, skip link,
// aria-current="page", and axe-core accessibility scan.

test.describe("shell semantics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
  });

  test("document.title updates on route navigation", async ({ page }) => {
    // Default route is "tokens" — title should contain "Tokens"
    await expect(page).toHaveTitle(/Tokens.*tinymoon/);

    // Navigate to wiki
    await page.locator('.nav-item[data-route="wiki"]').click();
    await expect(page).toHaveTitle(/Wiki.*tinymoon/);

    // Navigate to widgets
    await page.locator('.nav-item[data-route="widgets"]').click();
    await expect(page).toHaveTitle(/Widgets.*tinymoon/);
  });

  test("skip link appears on Tab and jumps focus to main content", async ({ page }) => {
    const skip = page.locator(".tm-skip-link");

    // Skip link should be offscreen initially
    const initialTop = await skip.evaluate(
      (el) => getComputedStyle(el).top
    );
    expect(parseInt(initialTop)).toBeLessThan(0);

    // Press Tab to focus the skip link
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();

    // After focus, it should be visible (top >= 0)
    const focusedTop = await skip.evaluate(
      (el) => getComputedStyle(el).top
    );
    expect(parseInt(focusedTop)).toBeGreaterThanOrEqual(0);

    // Press Enter to activate it
    await page.keyboard.press("Enter");

    // Focus should move to #tm-content (the main element)
    const focused = await page.evaluate(() => document.activeElement.id);
    expect(focused).toBe("tm-content");
  });

  test("active nav item has aria-current='page'", async ({ page }) => {
    // Default route is "tokens"
    const tokensBtn = page.locator('.nav-item[data-route="tokens"]');
    await expect(tokensBtn).toHaveAttribute("aria-current", "page");

    // Other nav items should NOT have aria-current
    const wikiBtn = page.locator('.nav-item[data-route="wiki"]');
    await expect(wikiBtn).not.toHaveAttribute("aria-current");

    // Navigate to wiki
    await wikiBtn.click();
    await expect(wikiBtn).toHaveAttribute("aria-current", "page");
    await expect(tokensBtn).not.toHaveAttribute("aria-current");
  });

  test("#tm-content is a <main> element", async ({ page }) => {
    const tag = await page.locator("#tm-content").evaluate(
      (el) => el.tagName.toLowerCase()
    );
    expect(tag).toBe("main");
  });

  test("#tm-page-title is an <h1> element", async ({ page }) => {
    const tag = await page.locator("#tm-page-title").evaluate(
      (el) => el.tagName.toLowerCase()
    );
    expect(tag).toBe("h1");
  });

  test("route-change announcer has aria-live='polite'", async ({ page }) => {
    const announcer = page.locator(".tm-sr-only[aria-live='polite']");
    await expect(announcer).toBeAttached();

    // Navigate and check announcer text updates
    await page.locator('.nav-item[data-route="wiki"]').click();
    await expect(announcer).toHaveText("Wiki");
  });

  test("axe-core reports zero violations on the gallery", async ({ page }) => {
    await settleAnimations(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations,
      "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; ")
    ).toHaveLength(0);
  });
});
