import { test, expect } from "@playwright/test";

// E2E tests for toast system: ARIA live region, dismiss button, sticky toast.

async function navigateToWidgets(page) {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  await page.evaluate(() => { location.hash = "#/widgets"; });
  await expect(page.locator("#tm-page-title")).toHaveText("Widgets");
}

test("toast creates an aria-live region with content", async ({ page }) => {
  await navigateToWidgets(page);
  const toastBtn = page.locator("button.btn", { hasText: "Toast" }).first();
  await toastBtn.click();

  // The toast root should exist with role=status and aria-live=polite.
  const root = page.locator("#tm-toast-root");
  await expect(root).toHaveAttribute("role", "status");
  await expect(root).toHaveAttribute("aria-live", "polite");

  // A toast should be visible inside it.
  const toast = root.locator(".toast");
  await expect(toast).toBeVisible();
  await expect(toast.locator(".toast-msg")).toHaveText("Everything is fine");
});

test("error toast has role=alert for assertive announcement", async ({ page }) => {
  await navigateToWidgets(page);
  const errBtn = page.locator("button.btn", { hasText: "Error toast" });
  await errBtn.click();

  const toast = page.locator("#tm-toast-root .toast.err");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("role", "alert");
});

test("dismiss button removes the toast", async ({ page }) => {
  await navigateToWidgets(page);
  const toastBtn = page.locator("button.btn", { hasText: "Toast" }).first();
  await toastBtn.click();

  const toast = page.locator("#tm-toast-root .toast");
  await expect(toast).toBeVisible();

  // Click the dismiss button.
  const dismiss = toast.locator(".toast-dismiss");
  await dismiss.click();

  // Toast should be gone.
  await expect(page.locator("#tm-toast-root .toast")).toHaveCount(0);
});

test("sticky toast (duration 0) persists until dismissed", async ({ page }) => {
  await navigateToWidgets(page);
  const stickyBtn = page.locator("button.btn", { hasText: "Sticky toast" });
  await stickyBtn.click();

  const toast = page.locator("#tm-toast-root .toast");
  await expect(toast).toBeVisible();

  // Wait longer than any default auto-dismiss duration.
  await page.waitForTimeout(4000);

  // Still visible.
  await expect(toast).toBeVisible();

  // Dismiss it.
  await toast.locator(".toast-dismiss").click();
  await expect(page.locator("#tm-toast-root .toast")).toHaveCount(0);
});

test("each toast has a dismiss button with aria-label", async ({ page }) => {
  await navigateToWidgets(page);
  const toastBtn = page.locator("button.btn", { hasText: "Toast" }).first();
  await toastBtn.click();

  const dismiss = page.locator("#tm-toast-root .toast .toast-dismiss");
  await expect(dismiss).toBeVisible();
  await expect(dismiss).toHaveAttribute("aria-label", "Dismiss");
});
