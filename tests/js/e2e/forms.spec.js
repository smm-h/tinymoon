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

    // Select (combobox with listbox)
    await expect(view.locator("button[role='combobox']")).toBeVisible();
  });

  test("form submission includes checkbox and radio values", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Submit the form with defaults (notifications checked, medium radio selected)
    await view.locator("button[type='submit']").click();

    // Wait for the toast to appear with FormData content
    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    // Auto-retrying assertions re-resolve the toast locator and re-read its
    // text on each poll, tolerant of the appear transition and the auto-dismiss
    // timer, instead of a single racy textContent() snapshot.
    // "notifications" should be present (checked by default)
    await expect(toast).toContainText("notifications");
    // "priority" radio should be present with value "medium" (default)
    await expect(toast).toContainText("priority");
    await expect(toast).toContainText("medium");
  });

  test("unchecking a checkbox removes it from FormData", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Uncheck the "notifications" checkbox (it starts checked)
    await view.locator(".tm-checkbox").first().click();

    // Submit
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    // Anchor on a field that is always submitted so the toast body is fully
    // rendered before asserting the negative, then assert absence with an
    // auto-retrying matcher instead of a one-shot textContent() snapshot.
    await expect(toast).toContainText("priority");
    // notifications should NOT be in the FormData (was unchecked)
    await expect(toast).not.toContainText("notifications");
  });

  test("segmented control submits its value in the form", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Submit with default segmented value ("m")
    await view.locator("button[type='submit']").click();

    const toast1 = page.locator(".toast").last();
    await expect(toast1).toBeVisible();
    await expect(toast1).toContainText("size");
    await expect(toast1).toContainText("m");
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
    await expect(toast).toContainText("size");
    await expect(toast).toContainText("xl");
  });

  test("selecting a different radio changes the submitted value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Click the "High" radio
    await view.locator(".tm-radio").nth(2).click();

    // Submit
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("high");
  });

  test("select submits its value via hidden native select", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Submit with default select value ("us-east")
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("region");
    await expect(toast).toContainText("us-east");
  });

  test("changing select value updates the submitted form value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Open the select by clicking the combobox button
    await view.locator("button[role='combobox']").click();
    // Click "EU West" option
    await view.locator("[role='option']").nth(2).click();

    // Submit the form
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("region");
    await expect(toast).toContainText("eu-west");
  });
});
