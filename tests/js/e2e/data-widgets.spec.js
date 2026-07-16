import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleAnimations } from "./helpers.js";

// E2E for the Phase 5A data-display widgets on the gallery Data route:
// the sortable/keyboard-navigable data table, the 10,000-row virtual list,
// and the badges + stats (axe-clean in both themes).

test.describe("data table (Data view)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/#/data");
    await expect(page.locator("#tm-app")).toBeVisible();
    await expect(page.locator("#tm-page-title")).toHaveText("Data");
  });

  test("sortable header cycles aria-sort and the caller re-sorts the rows", async ({ page }) => {
    const table = page.locator('[data-testid="data-table"]');
    const nameTh = table.locator("thead th").first();
    await expect(nameTh).toHaveAttribute("aria-sort", "none");

    // Click 1: ascending. The caller sorts by name; first shown row is first
    // alphabetically across ALL rows (maxRows shows the first five).
    await nameTh.click();
    await expect(nameTh).toHaveAttribute("aria-sort", "ascending");
    await expect(table.locator("tbody tr td:first-child").first()).toHaveText("auditor.js");

    // Click 2: descending. First shown row is last alphabetically.
    await nameTh.click();
    await expect(nameTh).toHaveAttribute("aria-sort", "descending");
    await expect(table.locator("tbody tr td:first-child").first()).toHaveText("widgets.css");

    // Click 3: back to none — original order restored by the caller.
    await nameTh.click();
    await expect(nameTh).toHaveAttribute("aria-sort", "none");
    await expect(table.locator("tbody tr td:first-child").first()).toHaveText("tokens.css");
  });

  test("only one sortable header is active at a time", async ({ page }) => {
    const table = page.locator('[data-testid="data-table"]');
    const headers = table.locator("thead th");
    await headers.nth(0).click(); // Name ascending
    await expect(headers.nth(0)).toHaveAttribute("aria-sort", "ascending");
    await headers.nth(1).click(); // Kind ascending — Name resets to none
    await expect(headers.nth(1)).toHaveAttribute("aria-sort", "ascending");
    await expect(headers.nth(0)).toHaveAttribute("aria-sort", "none");
  });

  test("maxRows caps the body and shows the footer note", async ({ page }) => {
    const table = page.locator('[data-testid="data-table"]');
    await expect(table.locator("tbody tr")).toHaveCount(5);
    await expect(table.locator("tfoot .tm-table-more td")).toHaveText("2 more rows not shown");
  });

  test("a Status cell holds a live badge element (node formatter)", async ({ page }) => {
    const table = page.locator('[data-testid="data-table"]');
    // Every body row's last cell contains a .badge span produced by format().
    await expect(table.locator("tbody tr:first-child td:last-child .badge")).toBeVisible();
  });

  test("roving-tabindex grid: arrows move cell focus, Enter sorts a header", async ({ page }) => {
    const table = page.locator('[data-testid="data-table"]');
    // Focus the first header cell (it carries tabindex 0).
    await table.locator("thead th").first().focus();
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Name");

    // ArrowRight -> the next header cell.
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Kind");

    // ArrowDown -> a body cell in the same column.
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("gridcell");

    // Back up to the Name header, then Enter cycles its sort.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await expect(table.locator("thead th").first()).toHaveAttribute("aria-sort", "ascending");
  });

  test("the table is axe-clean", async ({ page }) => {
    await settleAnimations(page);
    const results = await new AxeBuilder({ page }).include('[data-testid="data-table"]').analyze();
    expect(
      results.violations,
      "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; "),
    ).toHaveLength(0);
  });
});

test.describe("virtual list (Data view)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/#/data");
    await expect(page.locator("#tm-app")).toBeVisible();
  });

  test("renders 10,000 items with a bounded DOM, reaching the last row on scroll", async ({ page }) => {
    const list = page.locator('[data-testid="data-vlist"]');
    await expect(list).toBeVisible();
    const rows = list.locator(".tm-vlist-row");

    // Far fewer than 10,000 nodes exist — the window plus overscan only.
    const initial = await rows.count();
    expect(initial).toBeGreaterThan(0);
    expect(initial).toBeLessThanOrEqual(30);

    // Scroll to the very bottom; the last row becomes live and the count stays
    // bounded (windowed, never the full 10,000).
    await list.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(list.getByText("row 9999", { exact: true })).toBeVisible();
    expect(await rows.count()).toBeLessThanOrEqual(30);

    // Scroll back to the top; the first row returns and the count stays bounded.
    await list.evaluate((el) => { el.scrollTop = 0; });
    await expect(list.getByText("row 0", { exact: true })).toBeVisible();
    expect(await rows.count()).toBeLessThanOrEqual(30);
  });
});

test.describe("badges + stats (Data view) — both themes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/#/data");
    await expect(page.locator("#tm-app")).toBeVisible();
  });

  test("all badge variants and stat tiles render", async ({ page }) => {
    await expect(page.locator('[data-testid="data-badges"] .badge')).toHaveCount(5);
    await expect(page.locator('[data-testid="data-badges"] .badge-warn')).toBeVisible();
    const stats = page.locator('[data-testid="data-stats"] .stat');
    await expect(stats).toHaveCount(4);
    // Explicit trends render as trend-* classes (non-text delta indicators).
    await expect(page.locator('[data-testid="data-stats"] .stat.trend-good')).toHaveCount(1);
    await expect(page.locator('[data-testid="data-stats"] .stat.trend-bad')).toHaveCount(1);
    await expect(page.locator('[data-testid="data-stats"] .stat.trend-neutral')).toHaveCount(1);
  });

  async function scanBadgesAndStats(page) {
    await settleAnimations(page);
    return new AxeBuilder({ page })
      .include('[data-testid="data-badges"]')
      .include('[data-testid="data-stats"]')
      .analyze();
  }

  test("badges + stats are axe-clean in the dark theme", async ({ page }) => {
    const results = await scanBadgesAndStats(page);
    expect(
      results.violations,
      "dark axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; "),
    ).toHaveLength(0);
  });

  test("badges + stats are axe-clean in the light theme", async ({ page }) => {
    // Toggle to light via the topbar theme button.
    await page.locator('[data-testid="theme-cycle"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const results = await scanBadgesAndStats(page);
    expect(
      results.violations,
      "light axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; "),
    ).toHaveLength(0);
  });
});
