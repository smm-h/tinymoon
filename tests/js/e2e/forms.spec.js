import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleAnimations } from "./helpers.js";

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
    // Click "EU West" option. Scoped to the select's own listbox: the Forms
    // view now also hosts combobox/multi-select/time-picker options.
    await view.locator(".sel-menu [role='option']").nth(2).click();

    // Submit the form
    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("region");
    await expect(toast).toContainText("eu-west");
  });

  test("renders the styled-native text controls and slider", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    // createInput / createTextarea are real, visible native elements in a field.
    await expect(view.locator("input.tm-input[name='username']")).toBeVisible();
    await expect(view.locator("textarea.tm-textarea[name='bio']")).toBeVisible();
    // createSlider wraps a native range inside a .tm-slider frame.
    await expect(view.locator(".tm-slider input[type='range'][name='volume']")).toBeVisible();
  });

  test("composed form submits createInput/createTextarea/createSlider via FormData", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // Fill the text controls; the slider keeps its default value of 40.
    await view.locator("input.tm-input[name='username']").fill("alice");
    await view.locator("textarea.tm-textarea[name='bio']").fill("hello world");

    await view.locator("button[type='submit']").click();

    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    // Names and values reach FormData through the real native form elements.
    await expect(toast).toContainText("username: alice");
    await expect(toast).toContainText("bio: hello world");
    await expect(toast).toContainText("volume: 40");
  });

  test("setError blocks submit and renders an inline field error", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");

    // A too-short username triggers the setError affordance and aborts submit.
    await view.locator("input.tm-input[name='username']").fill("al");
    await view.locator("button[type='submit']").click();

    const error = view.locator(".field-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText("at least 3 characters");
    // The control is wired for assistive tech.
    const input = view.locator("input.tm-input[name='username']");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute("aria-describedby", await error.getAttribute("id"));

    // Fixing the value clears the error and lets the form submit.
    await input.fill("alice");
    await view.locator("button[type='submit']").click();
    await expect(view.locator(".field-error")).toHaveCount(0);
    const toast = page.locator(".toast").last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("username: alice");
  });

  test("slider supports the native keyboard pattern (arrows / Home / End)", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const range = view.locator(".tm-slider input[type='range'][name='volume']");

    await range.focus();
    // Default value is 40; ArrowRight steps up by 1.
    await page.keyboard.press("ArrowRight");
    await expect(range).toHaveValue("41");
    await page.keyboard.press("ArrowLeft");
    await expect(range).toHaveValue("40");
    // Home jumps to min, End to max.
    await page.keyboard.press("Home");
    await expect(range).toHaveValue("0");
    await page.keyboard.press("End");
    await expect(range).toHaveValue("100");
  });

  test("seek-variant slider overlays the waveform strip and is keyboard-seekable", async ({ page }) => {
    const view = page.locator("#tm-content section.view:not(.hidden)");
    const strip = view.locator(".seek-demo");
    await expect(strip).toBeVisible();
    // The app-drawn waveform canvas is decorative (hidden from the a11y tree).
    await expect(strip.locator("canvas.seek-wave")).toHaveAttribute("aria-hidden", "true");

    // The seek variant is a .tm-slider that also carries the .tm-slider-seek
    // identity class — same native-range mechanics, blanked chrome.
    const wrap = view.locator("[data-testid='seek-slider']");
    await expect(wrap).toHaveClass(/tm-slider/);
    await expect(wrap).toHaveClass(/tm-slider-seek/);

    // The overlay input is a real range with slider ARIA (role + accessible name).
    const range = wrap.locator("input[type='range'][name='seek-position']");
    await expect(range).toHaveAttribute("aria-label", "Seek position");
    await expect(range).toHaveJSProperty("value", "30");

    // Keyboard seeking works exactly like a chromed slider.
    await range.focus();
    await page.keyboard.press("ArrowRight");
    await expect(range).toHaveValue("31");
    await page.keyboard.press("Home");
    await expect(range).toHaveValue("0");
    await page.keyboard.press("End");
    await expect(range).toHaveValue("100");
  });

  test("axe-core reports zero violations on the seek-slider overlay", async ({ page }) => {
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .include(".seek-demo")
      .analyze();
    expect(
      results.violations,
      "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; "),
    ).toHaveLength(0);
  });

  test("axe-core reports zero violations on the Phase 3A controls", async ({ page }) => {
    // Scoped to the `.field` wrappers, which in this view belong solely to the
    // controls this phase adds: createInput, createTextarea, and the
    // createField-wrapped createSlider. (A whole-view scan also surfaces a
    // separate, pre-existing gap in createFileInput's hidden native input,
    // which is outside Phase 3A's scope.)
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .include(".field")
      .analyze();
    expect(
      results.violations,
      "axe violations: " + results.violations.map((v) => v.id + ": " + v.description).join("; "),
    ).toHaveLength(0);
  });
});
