import { test, expect } from "@playwright/test";

// E2E test for the Forms gallery view: verifies form submission includes
// checkbox and radio values, and that all form primitives render.

test.describe("Forms view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/#/forms");
    await expect(page.locator("#tm-app")).toBeVisible();
    await expect(page.locator("#tm-page-title")).toHaveText("Forms");
  });

  test("renders all form primitives", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Switch
    await expect(view.locator("button[role='switch']")).toBeVisible();

    // Segmented control (fieldset with role=radiogroup)
    await expect(view.locator("fieldset[role='radiogroup']")).toBeVisible();

    // Checkboxes (hidden native inputs inside labels)
    const checkboxes = view.locator(".tm-checkbox");
    await expect(checkboxes).toHaveCount(2);

    // Radio group (3 radios)
    const radios = view.locator(".tm-radio");
    await expect(radios).toHaveCount(3);

    // File input
    await expect(view.locator(".tm-file")).toBeVisible();
  });

  test("form submission includes checkbox and radio values", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Submit the form with defaults (notifications checked, medium radio selected)
    await view.locator("button[type='submit']").click();

    // Wait for the toast to appear with FormData content
    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    const text = await toast.textContent();
    // "notifications" should be present (checked by default)
    expect(text).toContain("notifications");
    // "priority" radio should be present with value "medium" (default)
    expect(text).toContain("priority");
    expect(text).toContain("medium");
  });

  test("unchecking a checkbox removes it from FormData", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Uncheck the "notifications" checkbox (it starts checked)
    await view.locator(".tm-checkbox").first().click();

    // Submit
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    const text = await toast.textContent();
    // notifications should NOT be in the FormData (was unchecked)
    expect(text).not.toContain("notifications");
  });

  test("segmented control submits its value in the form", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Submit with default segmented value ("m")
    await view.locator("button[type='submit']").click();

    const toast1 = page.locator(".toast").last();
    await expect(toast1).toBeVisible();
    const text1 = await toast1.textContent();
    expect(text1).toContain("size");
    expect(text1).toContain("m");
  });

  test("clicking a segmented option changes the submitted value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Click the "XL" segmented option (last label in the fieldset)
    const segFieldset = view.locator("fieldset[role='radiogroup']");
    await segFieldset.locator("label").last().click();

    // Submit
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    const text = await toast.textContent();
    expect(text).toContain("size");
    expect(text).toContain("xl");
  });

  test("selecting a different radio changes the submitted value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Click the "High" radio
    await view.locator(".tm-radio").nth(2).click();

    // Submit
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    const text = await toast.textContent();
    expect(text).toContain("high");
  });
});
