import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleAnimations } from "./helpers.js";

// Modal (native <dialog>) — verifies the dialog element, WCAG accessibility,
// focus trap, Escape dismiss with focus restore, and backdrop light dismiss.

async function openGalleryModal(page) {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  // Navigate to Widgets where the Modal button lives.
  await page.evaluate(() => { location.hash = "#/widgets"; });
  await expect(page.locator("#tm-page-title")).toHaveText("Widgets");
  // Click the "Modal" button to open the demo modal.
  const modalBtn = page.locator("button.btn", { hasText: "Modal" });
  await modalBtn.click();
  return modalBtn;
}

test("modal opens as a <dialog> with open attribute and aria-labelledby", async ({ page }) => {
  await openGalleryModal(page);
  const dialog = page.locator("dialog.tm-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("open", "");
  // aria-labelledby must point to the title element's id.
  const labelledBy = await dialog.getAttribute("aria-labelledby");
  expect(labelledBy).toBeTruthy();
  const title = page.locator("#" + labelledBy);
  await expect(title).toHaveText("Demo modal");
});

test("tab cycles only within the modal (focus trap)", async ({ page }) => {
  await openGalleryModal(page);
  const dialog = page.locator("dialog.tm-modal");
  await expect(dialog).toBeVisible();

  // Collect all focusable elements inside the dialog.
  const focusable = dialog.locator(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const count = await focusable.count();
  expect(count).toBeGreaterThanOrEqual(2);

  // Focus the first focusable element.
  await focusable.first().focus();

  // Tab through all elements + one more to verify wrap-around stays inside.
  for (let i = 0; i < count + 1; i++) {
    await page.keyboard.press("Tab");
  }

  // After count+1 tabs from the first element, focus should have wrapped
  // and still be inside the dialog (native <dialog> focus trap).
  const focused = page.locator(":focus");
  const isInDialog = await page.evaluate(() => {
    const active = document.activeElement;
    const dlg = document.querySelector("dialog.tm-modal");
    return dlg && dlg.contains(active);
  });
  expect(isInDialog, "focus should remain inside the dialog after tabbing past the last element").toBe(true);
});

test("escape closes the modal and focus returns to the trigger button", async ({ page }) => {
  const trigger = await openGalleryModal(page);
  const dialog = page.locator("dialog.tm-modal");
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");

  // Dialog should be removed from the DOM.
  await expect(dialog).toHaveCount(0);

  // Focus should return to the trigger button.
  const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focusedText).toBe("Modal");
});

test("backdrop click closes the modal", async ({ page }) => {
  await openGalleryModal(page);
  const dialog = page.locator("dialog.tm-modal");
  await expect(dialog).toBeVisible();

  // Click outside the dialog content but on the dialog element itself
  // (the backdrop area). We click at the top-left corner of the viewport
  // which is outside the centered dialog content.
  await page.mouse.click(5, 5);

  // Dialog should be removed from the DOM.
  await expect(dialog).toHaveCount(0);
});

test("axe-core reports zero violations with the modal open", async ({ page }) => {
  await openGalleryModal(page);
  await expect(page.locator("dialog.tm-modal")).toBeVisible();

  await settleAnimations(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; ")
  ).toHaveLength(0);
});
