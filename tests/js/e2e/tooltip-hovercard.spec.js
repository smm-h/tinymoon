import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E tests for the tooltip/hovercard split (Phase 3.6).
// Tooltips: plain text, non-interactive, hover + focus triggered.
// Hovercards: rich content, interactive, hover + focus + keyboard navigation.

async function goWidgets(page) {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  await page.evaluate(() => { location.hash = "#/widgets"; });
  await expect(page.locator("#tm-page-title")).toHaveText("Widgets");
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

test("tab to a data-tooltip element shows the tooltip", async ({ page }) => {
  await goWidgets(page);

  // Tab through until we reach the "hover me (tooltip)" badge.
  const badge = page.locator("span.badge", { hasText: "hover me (tooltip)" });
  await expect(badge).toBeVisible();

  // The icon buttons before the badge have data-tooltip.
  // Tab to the first icon button with a tooltip.
  const iconBtn = page.locator("button.icon-btn[data-tooltip]").first();
  await iconBtn.focus();

  // A tooltip should appear.
  const tooltip = page.locator("[id^='tm-tooltip'].show");
  await expect(tooltip).toBeVisible();

  // Tooltip content is plain text.
  const text = await tooltip.textContent();
  expect(text).toBeTruthy();
  // No HTML elements inside the tooltip (plain text only).
  const childElements = await tooltip.locator("strong, code, a").count();
  expect(childElements).toBe(0);
});

test("tooltip sets aria-describedby on the trigger", async ({ page }) => {
  await goWidgets(page);
  const iconBtn = page.locator("button.icon-btn[data-tooltip]").first();
  await iconBtn.focus();

  const tooltip = page.locator("[id^='tm-tooltip'].show");
  await expect(tooltip).toBeVisible();

  const tooltipId = await tooltip.getAttribute("id");
  const describedBy = await iconBtn.getAttribute("aria-describedby");
  expect(describedBy).toBe(tooltipId);
});

test("Escape dismisses the tooltip", async ({ page }) => {
  await goWidgets(page);
  const iconBtn = page.locator("button.icon-btn[data-tooltip]").first();
  await iconBtn.focus();

  const tooltip = page.locator("[id^='tm-tooltip'].show");
  await expect(tooltip).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(tooltip).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Hovercard
// ---------------------------------------------------------------------------

test("tab to a data-hovercard element shows the hovercard", async ({ page }) => {
  await goWidgets(page);

  const badge = page.locator("span.badge", { hasText: "hover me (hovercard)" });
  await expect(badge).toBeVisible();
  await badge.focus();

  const hovercard = page.locator("#tm-hovercard.show");
  await expect(hovercard).toBeVisible();

  // Hovercard content is rendered markdown -- should contain bold and code.
  // Use toBeAttached() for inline elements inside the already-visible
  // hovercard: during the opacity transition, tiny inline elements can
  // briefly fail toBeVisible() even though they are in the DOM.
  const body = hovercard.locator(".hc-body");
  await expect(body.locator("strong")).toBeAttached();
  await expect(body.locator("code")).toBeAttached();
});

test("ArrowDown moves focus into the hovercard", async ({ page }) => {
  await goWidgets(page);

  const badge = page.locator("span.badge", { hasText: "hover me (hovercard)" });
  await badge.focus();

  const hovercard = page.locator("#tm-hovercard.show");
  await expect(hovercard).toBeVisible();

  // Press ArrowDown to move focus into the hovercard.
  await page.keyboard.press("ArrowDown");

  // Focus should now be on a link inside the hovercard.
  const focusedInHc = await page.evaluate(() => {
    const hc = document.getElementById("tm-hovercard");
    return hc && hc.contains(document.activeElement);
  });
  expect(focusedInHc).toBe(true);
});

test("Escape closes the hovercard", async ({ page }) => {
  await goWidgets(page);

  const badge = page.locator("span.badge", { hasText: "hover me (hovercard)" });
  await badge.focus();

  const hovercard = page.locator("#tm-hovercard.show");
  await expect(hovercard).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(hovercard).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test("axe-core reports zero tooltip-related violations with tooltip visible", async ({ page }) => {
  await goWidgets(page);
  const iconBtn = page.locator("button.icon-btn[data-tooltip]").first();
  await iconBtn.focus();
  await expect(page.locator("[id^='tm-tooltip'].show")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include("[id^='tm-tooltip']")
    .analyze();
  expect(
    results.violations,
    "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; "),
  ).toHaveLength(0);
});

test("axe-core reports zero hovercard-related violations with hovercard visible", async ({ page }) => {
  await goWidgets(page);
  const badge = page.locator("span.badge", { hasText: "hover me (hovercard)" });
  await badge.focus();
  await expect(page.locator("#tm-hovercard.show")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include("#tm-hovercard")
    .analyze();
  expect(
    results.violations,
    "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; "),
  ).toHaveLength(0);
});
