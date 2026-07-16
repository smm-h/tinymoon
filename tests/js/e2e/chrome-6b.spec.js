import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Phase 6B framework wave, end to end on the real gallery: the command palette
// (open via mod+k, type, navigate, run), the tri-state theme cycle (dark →
// light → system with live OS resolution), the async-state route (renderAsync
// loading → data / error), lazyMount, and the toast action button.

test.describe("command palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
  });

  test("opens via mod+k, filters, and runs a nav command", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.locator("dialog.tm-palette");
    await expect(palette).toBeVisible();
    // Seeded from the shell nav: type to filter down to the Wiki route.
    await page.locator(".tm-palette-input").fill("wiki");
    // Wait for the debounced query to settle to the single Wiki match.
    await expect(page.locator(".tm-palette-item")).toHaveCount(1);
    await expect(page.locator(".tm-palette-item.active .tm-palette-label")).toHaveText("Wiki");
    // Enter runs the top (active) item — navigating to the wiki route.
    await page.keyboard.press("Enter");
    await expect(palette).toHaveCount(0);
    await expect(page).toHaveURL(/#\/wiki/);
  });

  test("mod+k toggles the palette closed while it is open", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator("dialog.tm-palette")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator("dialog.tm-palette")).toHaveCount(0);
  });

  test("arrow keys move the active option and Escape closes", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator("dialog.tm-palette")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".tm-palette-item.active")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.tm-palette")).toHaveCount(0);
  });

  test("the open palette is axe-clean", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator("dialog.tm-palette")).toBeVisible();
    const results = await new AxeBuilder({ page }).include("dialog.tm-palette").analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("tri-state theme cycle", () => {
  test("cycles dark → light → system, resolving system against the OS", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/gallery/");
    const html = page.locator("html");
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("tinymoon-gallery")).theme);
    const btn = page.locator('[data-testid="theme-cycle"]');

    // Default theme is dark (explicit). localStorage is not written until the
    // first set(), so only the resolved attribute is asserted here.
    await expect(html).toHaveAttribute("data-theme", "dark");

    // dark → light
    await btn.click();
    await expect(html).toHaveAttribute("data-theme", "light");
    expect(await stored()).toBe("light");

    // light → system, resolved to dark (OS emulated dark)
    await btn.click();
    expect(await stored()).toBe("system");
    await expect(html).toHaveAttribute("data-theme", "dark");

    // Live re-resolution: flip the OS to light while stored is system.
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html).toHaveAttribute("data-theme", "light");

    // system → dark (explicit)
    await btn.click();
    expect(await stored()).toBe("dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("async states + lazyMount", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/");
    await page.locator('.nav-item[data-route="async"]').click();
    await expect(page.locator('[data-async="data"]')).toBeVisible();
  });

  test("renderAsync shows a loading block, then the resolved data", async ({ page }) => {
    const results = page.locator("[data-async-results]");
    await page.locator('[data-async="data"]').click();
    // The loading block is visible while the fetch is in flight.
    await expect(results.locator("[aria-busy='true']")).toBeVisible();
    // Then the resolved list replaces it.
    await expect(results.locator("li")).toHaveCount(4);
  });

  test("renderAsync shows an empty block for an empty result", async ({ page }) => {
    await page.locator('[data-async="empty"]').click();
    await expect(page.locator("[data-async-results] .empty-title")).toHaveText("No results");
  });

  test("renderAsync shows an error block (role=alert) on failure", async ({ page }) => {
    await page.locator('[data-async="error"]').click();
    await expect(page.locator("[data-async-results] [role='alert']")).toBeVisible();
  });

  test("lazyMount loads the first cards and more as you scroll", async ({ page }) => {
    const scroller = page.locator(".lazy-scroller");
    // The topmost cards load once mounted/visible.
    await expect(page.locator('.lazy-card.loaded').first()).toBeVisible();
    const before = await page.locator(".lazy-card.loaded").count();
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect.poll(async () => page.locator(".lazy-card.loaded").count()).toBeGreaterThan(before);
  });
});

test.describe("toast action", () => {
  test("shows a persistent action toast; clicking the action dismisses it", async ({ page }) => {
    await page.goto("/gallery/");
    await page.locator('.nav-item[data-route="async"]').click();
    await page.locator('[data-testid="toast-action-btn"]').click();
    const toast = page.locator(".toast").filter({ hasText: "Saved a draft" });
    await expect(toast).toBeVisible();
    const action = toast.locator(".toast-action");
    await expect(action).toHaveText("Undo");
    // It persists (no auto-dismiss) — still there after the default lifetime.
    await page.waitForTimeout(600);
    await expect(toast).toBeVisible();
    await action.click();
    await expect(toast).toHaveCount(0);
    // The action fired its own confirmation toast.
    await expect(page.locator(".toast").filter({ hasText: "Undone" })).toBeVisible();
  });
});
