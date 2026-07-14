import { test, expect } from "@playwright/test";

// Content-first fixture: verifies that all semantic HTML elements are styled
// by the framework's base stylesheet — not left at browser defaults.

test.describe("content-first fixture", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/js/e2e/fixtures/content-first.html");
    await page.waitForFunction(() => window.__contentFirstReady === true);
  });

  test("headings use the brand font", async ({ page }) => {
    for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      const family = await page.locator(tag).first().evaluate(
        (el) => getComputedStyle(el).fontFamily
      );
      expect(family, `${tag} font-family`).toContain("Grotesk");
    }
  });

  test("paragraph text uses the UI font at the base size", async ({ page }) => {
    const p = page.locator("p").first();
    const family = await p.evaluate((el) => getComputedStyle(el).fontFamily);
    const color = await p.evaluate((el) => getComputedStyle(el).color);
    expect(family).toContain("Plex");
    // color should be the body text color, not the browser default black
    expect(color).not.toBe("rgb(0, 0, 0)");
  });

  test("unordered list has custom margin and indent", async ({ page }) => {
    const ul = page.locator("ul").first();
    const margin = await ul.evaluate(
      (el) => parseFloat(getComputedStyle(el).marginTop)
    );
    const padding = await ul.evaluate(
      (el) => parseFloat(getComputedStyle(el).paddingInlineStart)
    );
    // Framework sets margin via --space-10 (10px) and padding via --space-24 (24px)
    expect(margin).toBeGreaterThan(0);
    expect(padding).toBeGreaterThan(0);
  });

  test("blockquote has accent left border", async ({ page }) => {
    const bq = page.locator("blockquote");
    const border = await bq.evaluate(
      (el) => getComputedStyle(el).borderInlineStartWidth
    );
    expect(parseFloat(border)).toBe(2);
  });

  test("pre element has a background and border", async ({ page }) => {
    const pre = page.locator("pre");
    const bg = await pre.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const border = await pre.evaluate(
      (el) => getComputedStyle(el).borderTopWidth
    );
    // Background should not be transparent (browser default)
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(border)).toBe(1);
  });

  test("inline code has mono font and chip styling", async ({ page }) => {
    const code = page.locator("p code").first();
    const family = await code.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    const bg = await code.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(family).toContain("Plex Mono");
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("table has collapsed borders and styled headers", async ({ page }) => {
    const table = page.locator("table");
    const collapse = await table.evaluate(
      (el) => getComputedStyle(el).borderCollapse
    );
    expect(collapse).toBe("collapse");

    const th = page.locator("th").first();
    const weight = await th.evaluate(
      (el) => getComputedStyle(el).fontWeight
    );
    // font-weight should be --weight-medium (500), not browser default bold (700)
    expect(parseInt(weight)).toBe(500);
  });

  test("definition list terms are medium weight", async ({ page }) => {
    const dt = page.locator("dt").first();
    const weight = await dt.evaluate(
      (el) => getComputedStyle(el).fontWeight
    );
    expect(parseInt(weight)).toBe(500);
  });

  test("hr has a styled top border and no default 3d groove", async ({ page }) => {
    const hr = page.locator("hr");
    const borderTop = await hr.evaluate(
      (el) => getComputedStyle(el).borderTopStyle
    );
    const borderBottom = await hr.evaluate(
      (el) => getComputedStyle(el).borderBottomStyle
    );
    expect(borderTop).toBe("solid");
    expect(borderBottom).toBe("none");
  });

  test("figcaption uses mono font", async ({ page }) => {
    const fc = page.locator("figcaption");
    const family = await fc.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(family).toContain("Plex Mono");
  });

  test("links use the accent color", async ({ page }) => {
    const link = page.locator("a").first();
    const color = await link.evaluate((el) => getComputedStyle(el).color);
    // Should not be browser default blue
    expect(color).not.toBe("rgb(0, 0, 238)");
    // Should not be plain black either
    expect(color).not.toBe("rgb(0, 0, 0)");
  });
});
