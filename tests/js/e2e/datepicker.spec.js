import { test, expect } from "@playwright/test";

// E2E tests for the date picker in the Forms gallery view.

test.describe("Date picker", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery/#/forms");
    await expect(page.locator("#tm-app")).toBeVisible();
    await expect(page.locator("#tm-page-title")).toHaveText("Forms");
  });

  test("renders in the forms view with initial value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const datepicker = view.locator(".tm-datepicker");
    await expect(datepicker).toBeVisible();

    // Label
    await expect(datepicker.locator(".tm-datepicker-label")).toHaveText("Event date");

    // Text input shows formatted date
    const textInput = datepicker.locator("input[type='text']");
    await expect(textInput).toHaveValue("Jul 14, 2026");

    // Toggle button exists
    const toggleBtn = datepicker.locator(".tm-datepicker-toggle");
    await expect(toggleBtn).toBeVisible();
  });

  test("clicking toggle button opens the calendar popover", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const datepicker = view.locator(".tm-datepicker");
    const toggleBtn = datepicker.locator(".tm-datepicker-toggle");

    await toggleBtn.click();

    // Calendar popover should be visible
    const popover = datepicker.locator(".tm-datepicker-popover");
    await expect(popover).toBeVisible();

    // Month label should show July 2026
    await expect(popover.locator(".tm-datepicker-month")).toHaveText("July 2026");

    // Grid should have day-of-week headers
    const headers = popover.locator("table th");
    await expect(headers).toHaveCount(7);
  });

  test("selecting a date via click updates the form value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const datepicker = view.locator(".tm-datepicker");

    // Open calendar
    await datepicker.locator(".tm-datepicker-toggle").click();
    const popover = datepicker.locator(".tm-datepicker-popover");
    await expect(popover).toBeVisible();

    // Click day 20
    const day20 = popover.locator("button.tm-datepicker-day", { hasText: /^20$/ });
    await day20.click();

    // Popover should close
    await expect(popover).not.toBeVisible();

    // Text input should show new date
    const textInput = datepicker.locator("input[type='text']");
    await expect(textInput).toHaveValue("Jul 20, 2026");

    // Hidden input should have ISO value
    const hiddenInput = datepicker.locator("input[type='hidden']");
    await expect(hiddenInput).toHaveValue("2026-07-20");
  });

  test("form submission includes the date picker value", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Submit with default date value (2026-07-14)
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    const text = await toast.textContent();
    expect(text).toContain("event-date");
    expect(text).toContain("2026-07-14");
  });

  test("navigating months with prev/next buttons", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const datepicker = view.locator(".tm-datepicker");

    // Open calendar
    await datepicker.locator(".tm-datepicker-toggle").click();
    const popover = datepicker.locator(".tm-datepicker-popover");
    await expect(popover).toBeVisible();

    // Click previous month
    const prevBtn = popover.locator("button[aria-label='Previous month']");
    await prevBtn.click();
    await expect(popover.locator(".tm-datepicker-month")).toHaveText("June 2026");

    // Click next month twice to get to August
    const nextBtn = popover.locator("button[aria-label='Next month']");
    await nextBtn.click();
    await nextBtn.click();
    await expect(popover.locator(".tm-datepicker-month")).toHaveText("August 2026");
  });

  test("keyboard: Enter on day selects it", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const datepicker = view.locator(".tm-datepicker");

    // Open calendar
    await datepicker.locator(".tm-datepicker-toggle").click();
    const popover = datepicker.locator(".tm-datepicker-popover");
    await expect(popover).toBeVisible();

    // Wait for focus to land on a day button (openCalendar focuses via rAF —
    // pressing before it lands sends Enter to the still-focused toggle), then
    // Enter selects the focused day.
    await expect(popover.locator("button.tm-datepicker-day[data-date='2026-07-14']")).toBeFocused();
    await page.keyboard.press("Enter");

    // Popover should close
    await expect(popover).not.toBeVisible();
  });

  test("keyboard: arrow keys move focus between days", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const datepicker = view.locator(".tm-datepicker");

    // Open calendar
    await datepicker.locator(".tm-datepicker-toggle").click();
    const popover = datepicker.locator(".tm-datepicker-popover");
    await expect(popover).toBeVisible();

    // The focused day should be 14 (the initial value)
    const day14 = popover.locator("button.tm-datepicker-day[data-date='2026-07-14']");
    await expect(day14).toBeFocused();

    // ArrowRight moves to day 15
    await page.keyboard.press("ArrowRight");
    const day15 = popover.locator("button.tm-datepicker-day[data-date='2026-07-15']");
    await expect(day15).toBeFocused();

    // ArrowDown moves forward 7 days to day 22
    await page.keyboard.press("ArrowDown");
    const day22 = popover.locator("button.tm-datepicker-day[data-date='2026-07-22']");
    await expect(day22).toBeFocused();
  });

  test("keyboard: PageUp navigates to previous month", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const datepicker = view.locator(".tm-datepicker");

    // Open calendar
    await datepicker.locator(".tm-datepicker-toggle").click();
    const popover = datepicker.locator(".tm-datepicker-popover");
    await expect(popover).toBeVisible();

    // Wait for focus to land on a day button (openCalendar uses rAF)
    const day14 = popover.locator("button.tm-datepicker-day[data-date='2026-07-14']");
    await expect(day14).toBeFocused();

    // Press PageUp to go to June
    await page.keyboard.press("PageUp");
    await expect(popover.locator(".tm-datepicker-month")).toHaveText("June 2026");
  });

  test("keyboard: Escape closes the calendar", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const datepicker = view.locator(".tm-datepicker");

    // Open calendar
    const toggleBtn = datepicker.locator(".tm-datepicker-toggle");
    await toggleBtn.click();
    const popover = datepicker.locator(".tm-datepicker-popover");
    await expect(popover).toBeVisible();

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(popover).not.toBeVisible();
  });
});
