import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Phase 6A shell & chrome primitives, end to end on the real gallery:
// createView ctx.setSub, shell.announce, openDrawer (light + modal, Escape,
// outside-click, swipe), and createTabPanels keyboard per APG — all axe-clean.

test.describe("createView ctx + announce", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
  });

  test("migrated Tokens view writes the page subtitle via ctx.setSub", async ({ page }) => {
    // Default route is tokens; its refresh(ctx) calls ctx.setSub("N tokens").
    await expect(page.locator("#tm-page-sub")).toHaveText(/\d+ tokens/);
    // Leaving the route clears the subtitle (router setTitle(title, "")).
    await page.locator('.nav-item[data-route="wiki"]').click();
    await expect(page.locator("#tm-page-sub")).toHaveText("");
  });

  test("shell.announce pushes into the aria-live route announcer", async ({ page }) => {
    await page.locator('.nav-item[data-route="chrome"]').click();
    const announcer = page.locator(".tm-sr-only[aria-live='polite']");
    await page.locator('[data-testid="announce-btn"]').click();
    await expect(announcer).toHaveText(/Chrome demo announcement/);
  });
});

test.describe("openDrawer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/");
    await page.locator('.nav-item[data-route="chrome"]').click();
    await expect(page.locator('[data-testid="open-light-drawer"]')).toBeVisible();
  });

  test("light drawer opens, Escape closes it, focus restored", async ({ page }) => {
    const trigger = page.locator('[data-testid="open-light-drawer"]');
    await trigger.click();
    const drawer = page.locator(".tm-drawer[role='dialog']");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "false");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    // Focus returns to the trigger button.
    await expect(trigger).toBeFocused();
  });

  test("light drawer closes on an outside pointerdown", async ({ page }) => {
    await page.locator('[data-testid="open-light-drawer"]').click();
    const drawer = page.locator(".tm-drawer[role='dialog']");
    await expect(drawer).toBeVisible();
    // Pointerdown far to the right, well clear of the left-anchored panel
    // (which spans x=0..420), so it registers as an outside dismissal.
    await page.mouse.click(1000, 400);
    await expect(drawer).toHaveCount(0);
  });

  test("the drawer trigger toggles: pressing it while open closes and stays closed", async ({ page }) => {
    // The right-anchored toggle drawer keeps its trigger clear of the panel, so
    // the trigger stays clickable while open (unlike the left demo drawer).
    const trigger = page.locator('[data-testid="open-toggle-drawer"]');
    // Open via the registerOverlayTrigger toggle.
    await trigger.click();
    await expect(page.locator(".tm-drawer[role='dialog']")).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Press the trigger again: the gesture-claim dismisses on pointerdown and
    // suppresses the trailing click, so it closes and does NOT reopen.
    await trigger.click();
    await expect(page.locator(".tm-drawer[role='dialog']")).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Confirm it stays closed (no close-then-reopen flicker).
    await page.waitForTimeout(150);
    await expect(page.locator(".tm-drawer[role='dialog']")).toHaveCount(0);
  });

  test("modal drawer is a dialog and Escape closes it", async ({ page }) => {
    await page.locator('[data-testid="open-modal-drawer"]').click();
    const dialog = page.locator("dialog.tm-drawer");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveJSProperty("open", true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("axe is clean with a drawer open", async ({ page }) => {
    await page.locator('[data-testid="open-light-drawer"]').click();
    await expect(page.locator(".tm-drawer")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations,
      "axe: " + results.violations.map((v) => v.id).join(", "),
    ).toHaveLength(0);
  });
});

test.describe("mobile nav drawer swipe-to-close", () => {
  test.use({ viewport: { width: 360, height: 720 } });

  test("swiping the open nav drawer toward its edge closes it", async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();
    const app = page.locator("#tm-app");
    // Open the drawer via the hamburger (visible only <=768px).
    await page.locator(".tm-hamburger").click();
    await expect(app).toHaveClass(/sidebar-open/);
    // Wait for the slide-in to settle so the sidebar occupies x=0..240 before
    // we swipe (mid-animation it is still off-canvas at those coordinates).
    await page.waitForFunction(
      () => document.getElementById("tm-sidebar").getBoundingClientRect().left === 0,
    );
    // Swipe left across the sidebar: pointerdown at x=200, pointerup at x=90.
    await page.mouse.move(200, 360);
    await page.mouse.down();
    await page.mouse.move(90, 360);
    await page.mouse.up();
    await expect(app).not.toHaveClass(/sidebar-open/);
  });
});

test.describe("createTabPanels keyboard (APG)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/");
    await page.locator('.nav-item[data-route="chrome"]').click();
  });

  test("arrow keys move selection and activate the matching panel", async ({ page }) => {
    const tablist = page.locator(".tm-tabpanels [role='tablist']").first();
    const tabs = tablist.locator("[role='tab']");
    // Focus the first (selected) tab.
    await tabs.nth(0).focus();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    // ArrowRight → second tab selected and its panel shown.
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");
    const panelId = await tabs.nth(1).getAttribute("aria-controls");
    const panel = page.locator("#" + panelId);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("aria-labelledby", await tabs.nth(1).getAttribute("id"));
    // Home → back to the first tab.
    await page.keyboard.press("Home");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  });

  test("switching tabs preserves panel state (hide, not destroy)", async ({ page }) => {
    const tablist = page.locator(".tm-tabpanels [role='tablist']").first();
    const tabs = tablist.locator("[role='tab']");
    // Activate the "Counter" tab (3rd) and increment.
    await tabs.nth(2).click();
    const counterPanel = page.locator("#" + (await tabs.nth(2).getAttribute("aria-controls")));
    await counterPanel.getByRole("button", { name: "increment" }).click();
    await expect(counterPanel.locator("p")).toHaveText("clicks: 1");
    // Switch away and back — the count survived.
    await tabs.nth(0).click();
    await tabs.nth(2).click();
    await expect(counterPanel.locator("p")).toHaveText("clicks: 1");
  });

  test("axe is clean on the chrome route", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations,
      "axe: " + results.violations.map((v) => v.id).join(", "),
    ).toHaveLength(0);
  });
});
