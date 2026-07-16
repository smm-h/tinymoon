import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleAnimations } from "./helpers.js";

// Context menu — verifies keyboard entry (Shift+F10), ARIA roles, arrow/Home/End
// navigation, Escape with focus restore, and the preventDefault fix (native menu
// not suppressed when no provider yields items).

async function goToWidgets(page) {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  await page.evaluate(() => { location.hash = "#/widgets"; });
  await expect(page.locator("#tm-page-title")).toHaveText("Widgets");
}

test("Shift+F10 on a data-ctx region opens context menu with menuitem roles", async ({ page }) => {
  await goToWidgets(page);

  // The gallery-demo panel has data-ctx="gallery-demo". The framework's
  // MutationObserver should have set tabindex="0" on it (it is a div, not
  // natively focusable) when the view was built.
  const panel = page.locator("[data-ctx='gallery-demo']");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("tabindex", "0");

  // Focus the panel and press Shift+F10 to open the context menu.
  // Focus must have landed before the keypress or the key goes elsewhere.
  await panel.focus();
  await expect(panel).toBeFocused();
  await page.keyboard.press("Shift+F10");

  const menu = page.locator("#tm-ctx-root.open");
  await expect(menu).toBeVisible();

  // Every actionable item should have role="menuitem".
  const menuItems = menu.locator("[role='menuitem']");
  const count = await menuItems.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // The menu root should have role="menu".
  await expect(menu).toHaveAttribute("role", "menu");
});

test("arrow keys navigate, Home/End jump, Escape closes and restores focus", async ({ page }) => {
  await goToWidgets(page);

  const panel = page.locator("[data-ctx='gallery-demo']");
  await expect(panel).toHaveAttribute("tabindex", "0");
  // Focus must have landed before the keypress or the key goes elsewhere.
  await panel.focus();
  await expect(panel).toBeFocused();
  await page.keyboard.press("Shift+F10");

  const menu = page.locator("#tm-ctx-root.open");
  await expect(menu).toBeVisible();

  const menuItems = menu.locator("[role='menuitem']");
  const count = await menuItems.count();
  expect(count).toBeGreaterThanOrEqual(2);

  // First item should be focused on open.
  const firstLabel = await menuItems.first().innerText();
  const focusedLabel = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focusedLabel).toContain(firstLabel.trim());

  // ArrowDown moves to second item.
  await page.keyboard.press("ArrowDown");
  const secondLabel = await menuItems.nth(1).innerText();
  const focused2 = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focused2).toContain(secondLabel.trim());

  // End jumps to last item.
  await page.keyboard.press("End");
  const lastLabel = await menuItems.last().innerText();
  const focusedLast = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focusedLast).toContain(lastLabel.trim());

  // Home jumps back to first item.
  await page.keyboard.press("Home");
  const focusedHome = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focusedHome).toContain(firstLabel.trim());

  // ArrowUp from first item wraps to last.
  await page.keyboard.press("ArrowUp");
  const focusedWrap = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focusedWrap).toContain(lastLabel.trim());

  // Escape closes and restores focus to the panel.
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();

  // Focus should be back on the panel (the data-ctx region).
  const restoredTag = await page.evaluate(() => document.activeElement?.dataset?.ctx);
  expect(restoredTag).toBe("gallery-demo");
});

test("right-click on area outside any data-ctx opens footer-only menu", async ({ page }) => {
  await goToWidgets(page);

  // The page title (#tm-page-title) is not inside any [data-ctx] region.
  // Since the gallery registers a global footer provider, right-clicking
  // here should still open the custom menu — but only with footer items.
  // This exercises the preventDefault fix: the framework only prevents the
  // native menu when it has items to show (from providers or footer).
  const title = page.locator("#tm-page-title");
  await expect(title).toBeVisible();

  await title.click({ button: "right" });

  // The footer provider yields items, so the custom menu should open.
  const menu = page.locator("#tm-ctx-root.open");
  await expect(menu).toBeVisible();

  // Verify the menu contains footer items (the gallery footer has
  // "tinymoon gallery" as a heading and navigation entries).
  const heading = menu.locator(".ctx-head");
  const headingCount = await heading.count();
  expect(headingCount).toBeGreaterThanOrEqual(1);
});

test("right-click on a data-ctx region opens the custom menu", async ({ page }) => {
  await goToWidgets(page);

  const panel = page.locator("[data-ctx='gallery-demo']");
  await expect(panel).toBeVisible();

  // Right-click on the panel to open the context menu.
  await panel.click({ button: "right" });

  const menu = page.locator("#tm-ctx-root.open");
  await expect(menu).toBeVisible();

  // Items should have menuitem roles.
  const menuItems = menu.locator("[role='menuitem']");
  const count = await menuItems.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test("native inputs preserve the browser context menu", async ({ page }) => {
  await goToWidgets(page);

  // Native inputs (text fields) should keep the browser menu (for paste
  // etc.) — the framework returns early without calling preventDefault.
  const input = page.locator("input[type='text']").first();
  await expect(input).toBeVisible();

  await input.click({ button: "right" });

  // The framework's custom menu should NOT be open.
  const menu = page.locator("#tm-ctx-root.open");
  await expect(menu).toHaveCount(0);
});

test("axe-core reports zero violations on the context menu", async ({ page }) => {
  await goToWidgets(page);

  const panel = page.locator("[data-ctx='gallery-demo']");
  // Focus must have landed before the keypress or the key goes elsewhere.
  await panel.focus();
  await expect(panel).toBeFocused();
  await page.keyboard.press("Shift+F10");

  const menu = page.locator("#tm-ctx-root.open");
  await expect(menu).toBeVisible();

  // Scope the axe scan to the context menu element to avoid flagging
  // pre-existing page-level issues unrelated to this component.
  await settleAnimations(page);
  const results = await new AxeBuilder({ page })
    .include("#tm-ctx-root")
    .analyze();
  expect(
    results.violations,
    "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; ")
  ).toHaveLength(0);
});
