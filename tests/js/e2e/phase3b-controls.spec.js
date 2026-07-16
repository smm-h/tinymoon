import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleAnimations } from "./helpers.js";

// E2E coverage for the Phase 3B controls in the gallery Forms/Widgets views:
// number stepper, time picker, typeahead combobox, chip multi-select, and the
// accordion. Verifies keyboard patterns, FormData participation, and that every
// new control (plus the now-fixed file input) is axe-clean.

test.describe("Phase 3B form controls (Forms view)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/#/forms");
    await expect(page.locator("#tm-app")).toBeVisible();
    await expect(page.locator("#tm-page-title")).toHaveText("Forms");
  });

  test("all new controls render", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    await expect(view.locator(".tm-number input[type='number'][name='quantity']")).toBeVisible();
    await expect(view.locator(".tm-timepicker")).toBeVisible();
    await expect(view.locator(".tm-combobox input[role='combobox'][name='']")).toHaveCount(0); // name is on hidden input
    await expect(view.locator(".tm-combobox")).toBeVisible();
    await expect(view.locator(".tm-multiselect")).toBeVisible();
    // Hidden native <select multiple> backs the multi-select for FormData.
    await expect(view.locator(".tm-multiselect select[multiple][name='tags']")).toHaveCount(1);
  });

  test("number stepper: +/- buttons and native arrow keys change the value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const input = view.locator("input[name='quantity']");
    await expect(input).toHaveValue("3");

    await view.locator("[aria-label='Increase Quantity']").click();
    await expect(input).toHaveValue("4");
    await view.locator("[aria-label='Decrease Quantity']").click();
    await expect(input).toHaveValue("3");

    // Native keyboard stepping still works (the input is a real input[type=number]).
    // Focus must have landed before the keypress or the key goes elsewhere.
    await input.focus();
    await expect(input).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(input).toHaveValue("4");
  });

  test("number stepper respects max (clamps)", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const input = view.locator("input[name='quantity']");
    const up = view.locator("[aria-label='Increase Quantity']");
    // Value starts at 3, max is 20: click up many times and confirm it never exceeds 20.
    for (let i = 0; i < 25; i++) await up.click();
    await expect(input).toHaveValue("20");
  });

  test("time picker: open, pick an hour and minute, value updates", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const tp = view.locator(".tm-timepicker");
    const hidden = tp.locator("input[type='hidden']");
    await expect(hidden).toHaveValue("09:30");

    await tp.locator(".tm-timepicker-toggle").click();
    const popover = tp.locator(".tm-timepicker-popover");
    await expect(popover).toBeVisible();

    // Pick hour "8" (data-value=8) and minute "45".
    const cols = popover.locator(".tm-timepicker-col");
    await cols.nth(0).locator("[role='option'][data-value='8']").click();
    await cols.nth(1).locator("[role='option'][data-value='45']").click();
    await expect(hidden).toHaveValue("08:45");

    await page.keyboard.press("Escape");
    await expect(popover).not.toBeVisible();
  });

  test("time picker: typing text parses on blur", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const tp = view.locator(".tm-timepicker");
    const text = tp.locator("input[type='text']");
    const hidden = tp.locator("input[type='hidden']");

    await text.click();
    await text.fill("3:45 PM");
    await text.blur();
    await expect(hidden).toHaveValue("15:45");
  });

  test("combobox: APG keyboard navigation selects an item", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const cb = view.locator(".tm-combobox");
    const input = cb.locator("input[role='combobox']");
    const hidden = cb.locator("input[type='hidden']");

    await input.click();
    await input.fill("united");
    await expect(cb.locator("[role='option']")).toHaveCount(2);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown"); // move to the second match
    await page.keyboard.press("Enter");

    // aria-expanded collapses and a value is committed.
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(hidden).not.toHaveValue("");
  });

  test("combobox: pointer selection commits the value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const cb = view.locator(".tm-combobox");
    const input = cb.locator("input[role='combobox']");
    const hidden = cb.locator("input[type='hidden']");

    await input.click();
    await input.fill("france");
    await cb.locator("[role='option']").first().click();
    await expect(hidden).toHaveValue("fr");
    await expect(input).toHaveValue("France");
  });

  test("multi-select: add a chip via the menu and remove one via its ×", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const ms = view.locator(".tm-multiselect");
    // Starts with one chip ("Backend").
    await expect(ms.locator(".tm-chip")).toHaveCount(1);

    const input = ms.locator("input[role='combobox']");
    await input.click();
    await input.fill("design");
    await ms.locator("[role='option']").first().click();
    await expect(ms.locator(".tm-chip")).toHaveCount(2);

    // Remove the first chip via its × button.
    await ms.locator(".tm-chip-remove").first().click();
    await expect(ms.locator(".tm-chip")).toHaveCount(1);
  });

  test("multi-select: Backspace on empty input removes the last chip", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const ms = view.locator(".tm-multiselect");
    await expect(ms.locator(".tm-chip")).toHaveCount(1);
    const input = ms.locator("input[role='combobox']");
    await input.click();
    await page.keyboard.press("Backspace");
    await expect(ms.locator(".tm-chip")).toHaveCount(0);
  });

  test("FormData includes number, time, combobox, and multi-select values", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Bump quantity to 4 for a deterministic assertion.
    await view.locator("[aria-label='Increase Quantity']").click();

    await view.locator("button[type='submit']").click();
    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("quantity: 4");
    await expect(toast).toContainText("start-time: 09:30");
    await expect(toast).toContainText("country: de");
    await expect(toast).toContainText("tags: backend");
  });

  test("axe: every new control and the fixed file input is clean", async ({ page }) => {
    // Scoped to the new-control roots (and the previously-inaccessible file
    // input), matching the existing forms axe scan. A whole-view scan would
    // instead surface a separate, pre-existing grain-overlay contrast issue on
    // faint 10px labels/hashes that predates this phase.
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .include(".tm-number")
      .include(".tm-timepicker")
      .include(".tm-combobox")
      .include(".tm-multiselect")
      .include(".tm-file")
      .analyze();
    expect(
      results.violations,
      "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; "),
    ).toHaveLength(0);
  });

  test("axe: the hidden file input now has an accessible name", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    // The regression guard for the Phase 3B a11y fix: the native input carries
    // an aria-label mirroring the trigger label.
    await expect(view.locator(".tm-file input[type='file']")).toHaveAttribute("aria-label", "Choose file");
  });
});

test.describe("Accordion (Widgets view)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/#/widgets");
    await expect(page.locator("#tm-app")).toBeVisible();
    await expect(page.locator("#tm-page-title")).toHaveText("Widgets");
  });

  test("single-open: opening one header collapses the others", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const acc = view.locator(".tm-accordion");
    const headers = acc.locator(".tm-accordion-header");

    // First item starts open (item.open: true).
    await expect(headers.nth(0)).toHaveAttribute("aria-expanded", "true");
    await expect(headers.nth(1)).toHaveAttribute("aria-expanded", "false");

    // Open the second: it expands, the first collapses.
    await headers.nth(1).click();
    await expect(headers.nth(1)).toHaveAttribute("aria-expanded", "true");
    await expect(headers.nth(0)).toHaveAttribute("aria-expanded", "false");

    // Toggle the second closed again.
    await headers.nth(1).click();
    await expect(headers.nth(1)).toHaveAttribute("aria-expanded", "false");
  });

  test("keyboard: Enter on a focused header toggles it", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const headers = view.locator(".tm-accordion .tm-accordion-header");
    await headers.nth(1).focus();
    // Focus must have landed before the keypress or the key goes elsewhere.
    await expect(headers.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(headers.nth(1)).toHaveAttribute("aria-expanded", "true");
  });
});
