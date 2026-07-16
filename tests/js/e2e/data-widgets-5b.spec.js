import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E for the Phase 5B data-display widgets on the gallery Data route: the APG
// tree keyboard walk, filter bar + chips composition, load-more against a
// synthetic paged source, the live feed's pause-on-scroll-up + jump-to-latest,
// sparkline + chart rendering from token colors in both themes, and an
// axe-clean sweep of the whole route.

test.beforeEach(async ({ page }) => {
  await page.goto("/gallery/#/data");
  await expect(page.locator("#tm-app")).toBeVisible();
  await expect(page.locator("#tm-page-title")).toHaveText("Data");
});

// Own label of the currently focused treeitem (its first .tm-tree-label, which
// is the node's own label — not a nested descendant's).
function focusedTreeLabel(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    const own = a && a.querySelector ? a.querySelector(".tm-tree-label") : null;
    return own ? own.textContent.trim() : null;
  });
}

test.describe("tree view — APG keyboard walk", () => {
  test("arrows expand/enter/collapse/exit and Home/End jump", async ({ page }) => {
    const tree = page.locator('[data-testid="data-tree"]');
    await expect(tree).toHaveAttribute("role", "tree");

    // Focus the first treeitem (roving tabindex 0).
    await tree.locator('[role="treeitem"]').first().focus();
    await expect.poll(() => focusedTreeLabel(page)).toBe("assets");

    // assets is open -> ArrowRight enters its first child (js).
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => focusedTreeLabel(page)).toBe("js");

    // js is open -> ArrowRight enters its first child (index.js).
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => focusedTreeLabel(page)).toBe("index.js");

    // On a leaf, ArrowLeft climbs to the parent (js).
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => focusedTreeLabel(page)).toBe("js");

    // On an expanded parent, ArrowLeft collapses it (focus stays on js).
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => focusedTreeLabel(page)).toBe("js");
    await expect.poll(() =>
      page.evaluate(() => document.activeElement.getAttribute("aria-expanded")),
    ).toBe("false");

    // Home jumps back to the first item, End to the last (a top-level leaf).
    await page.keyboard.press("Home");
    await expect.poll(() => focusedTreeLabel(page)).toBe("assets");
    await page.keyboard.press("End");
    await expect.poll(() => focusedTreeLabel(page)).toBe("package.json");

    // Enter on the focused leaf activates onSelect (a toast fires).
    await page.keyboard.press("Enter");
    await expect(page.locator(".toast").filter({ hasText: "Selected: package.json" })).toBeVisible();
  });

  test("the tree is axe-clean", async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('[data-testid="data-tree"]').analyze();
    expect(
      results.violations,
      "axe: " + results.violations.map((v) => v.id).join("; "),
    ).toHaveLength(0);
  });
});

test.describe("filter bar + chips composition", () => {
  test("the bar lays out controls; chips remove and clear-all over caller state", async ({ page }) => {
    const bar = page.locator('[data-testid="data-filterbar"]');
    // The bar holds the caller's controls (a segmented + a search field).
    await expect(bar.locator(".tm-filterbar-slot")).toHaveCount(2);

    const chips = page.locator('[data-testid="data-chips"]');
    await expect(chips.locator(".tm-chip")).toHaveCount(2);
    // >1 chip -> Clear-all is present.
    await expect(chips.locator(".tm-chips-clear")).toBeVisible();

    // Remove one chip -> caller updates state -> one chip, Clear-all gone.
    await chips.locator(".tm-chip .tm-chip-x").first().click();
    await expect(chips.locator(".tm-chip")).toHaveCount(1);
    await expect(chips.locator(".tm-chips-clear")).toHaveCount(0);
  });

  test("clear-all empties the strip", async ({ page }) => {
    const dash = page.locator('[data-testid="data-dashboard"]');
    const chips = dash.locator(".tm-chips");
    await expect(chips.locator(".tm-chip")).toHaveCount(2);
    await chips.locator(".tm-chips-clear").click();
    await expect(chips.locator(".tm-chip")).toHaveCount(0);
  });
});

test.describe("load more — synthetic paged source", () => {
  test("each click appends a page; the button hides at the end", async ({ page }) => {
    const lm = page.locator('[data-testid="data-loadmore"]');
    const btn = lm.locator(".tm-loadmore-btn");
    const list = page.locator('[data-testid="data-loaded-list"]');

    await expect(list.locator("li")).toHaveCount(0);
    await btn.click();
    await expect(list.locator("li")).toHaveCount(4);
    await btn.click();
    await expect(list.locator("li")).toHaveCount(8);
    await btn.click(); // third page -> nextCursor null
    await expect(list.locator("li")).toHaveCount(12);
    await expect(btn).toBeHidden();
    await expect(lm.locator(".tm-loadmore-end")).toBeVisible();
  });
});

test.describe("live feed — pause-on-scroll-up and jump-to-latest", () => {
  test("scrolling up pauses autoscroll and reveals jump-to-latest", async ({ page }) => {
    const feed = page.locator('[data-testid="data-feed"]');
    const emit = page.locator('[data-testid="data-feed-emit"]');
    const jump = feed.locator(".tm-feed-jump");

    // Emit enough lines to make the feed scrollable.
    for (let i = 0; i < 24; i++) await emit.click();
    await expect(jump).toBeHidden();

    // Scroll to the top -> paused, jump appears.
    await feed.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
    await expect(jump).toBeVisible();

    // Emit while paused -> no autoscroll yank (stays near the top).
    await emit.click();
    expect(await feed.evaluate((el) => el.scrollTop)).toBeLessThan(20);

    // Jump re-pins to the bottom and hides the affordance.
    await jump.click();
    await expect(jump).toBeHidden();
    expect(await feed.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 4)).toBe(true);
  });

  test("rows carry the caller's data-level for severity styling", async ({ page }) => {
    const feed = page.locator('[data-testid="data-feed"]');
    await expect(feed.locator('.tm-feed-item[data-level="error"]').first()).toBeAttached();
  });
});

test.describe("sparkline + chart — token colors in both themes", () => {
  async function accent(page) {
    return page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  }

  test("the chart bars are filled from the --accent token, and repaint on theme change", async ({ page }) => {
    const chart = page.locator('[data-testid="data-chart"]');
    await expect(chart.locator("svg rect").first()).toBeVisible();

    const darkAccent = await accent(page);
    const darkFill = await chart.locator("svg rect").first().getAttribute("fill");
    expect(darkFill).toBe(darkAccent);

    // Toggle to light: the chart redraws on tm:theme; the fill still equals the
    // (live) token value.
    await page.locator("button[aria-label='Toggle theme']").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const lightAccent = await accent(page);
    const lightFill = await chart.locator("svg rect").first().getAttribute("fill");
    expect(lightFill).toBe(lightAccent);
  });

  test("sparklines render token-colored inline SVG with no color literals", async ({ page }) => {
    const spark = page.locator('[data-testid="data-sparkline"] svg.tm-spark').first();
    await expect(spark).toBeVisible();
    await expect(spark.locator("polyline.tm-spark-line")).toHaveCount(1);
    const html = await spark.evaluate((el) => el.outerHTML);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html.toLowerCase()).not.toContain("fill=");
    expect(html.toLowerCase()).not.toContain("stroke=");
  });
});

test.describe("breadcrumbs — trail with ellipsis collapse", () => {
  test("collapses beyond the threshold and expands on demand", async ({ page }) => {
    const crumbs = page.locator('[data-testid="data-breadcrumbs"]');
    await expect(crumbs).toHaveAttribute("aria-label", "Breadcrumb");
    // 7 items -> collapsed to first + ellipsis + last 4 = 6 li.
    await expect(crumbs.locator("ol > li")).toHaveCount(6);
    await expect(crumbs.locator("[aria-current='page']")).toHaveText("Load report");
    await crumbs.locator(".tm-crumb-more").click();
    await expect(crumbs.locator("ol > li")).toHaveCount(7);
  });
});

test.describe("the whole Data route is axe-clean in both themes", () => {
  async function scan(page) {
    return new AxeBuilder({ page }).include("#tm-content").analyze();
  }
  test("dark", async ({ page }) => {
    const results = await scan(page);
    expect(results.violations, results.violations.map((v) => v.id + ": " + v.description).join("; ")).toHaveLength(0);
  });
  test("light", async ({ page }) => {
    await page.locator("button[aria-label='Toggle theme']").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const results = await scan(page);
    expect(results.violations, results.violations.map((v) => v.id + ": " + v.description).join("; ")).toHaveLength(0);
  });
});
