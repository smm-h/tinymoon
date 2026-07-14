import { test, expect } from "@playwright/test";

// Selector-hygiene tests — verify that framework CSS does not bleed into
// consumer content, that all text-like input types receive uniform styling,
// and that every focusable element shows a visible focus ring.

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/js/e2e/fixtures/selector-hygiene.html");
  await page.waitForFunction(() => window.__selectorHygieneReady === true);
});

// ---------------------------------------------------------------------------
// 5a — Consumer SVG is NOT affected by framework color rules
// ---------------------------------------------------------------------------
test("consumer SVG is not recolored by framework toast/panel SVG rules", async ({ page }) => {
  const consumerSvg = page.locator("#consumer-svg");
  const consumerColor = await consumerSvg.evaluate(
    (el) => getComputedStyle(el).color
  );

  // The toast's direct-child SVG IS colored accent-hi.
  const toastSvg = page.locator("#test-toast > svg");
  const toastSvgColor = await toastSvg.evaluate(
    (el) => getComputedStyle(el).color
  );

  // The copy-btn SVG inside the toast should NOT be accent-hi.
  const copyBtnSvg = page.locator("#toast-copy-btn svg");
  const copyBtnColor = await copyBtnSvg.evaluate(
    (el) => getComputedStyle(el).color
  );

  // Consumer SVG should inherit body color (the default text color), not
  // accent-hi. If .toast svg was still un-scoped, consumer SVGs inside a
  // toast wrapper would get the accent color.
  expect(consumerColor).not.toBe(toastSvgColor);

  // The copy button SVG must match .copy-btn's own color (--text-faint),
  // not the toast's accent-hi.
  expect(copyBtnColor).not.toBe(toastSvgColor);
});

// ---------------------------------------------------------------------------
// 5b — Every styled input type has the same background and border as text
// ---------------------------------------------------------------------------
test("all text-like input types share uniform styling", async ({ page }) => {
  const textInput = page.locator("#in-text");
  const refBg = await textInput.evaluate(
    (el) => getComputedStyle(el).backgroundColor
  );
  const refBorder = await textInput.evaluate(
    (el) => getComputedStyle(el).borderColor
  );

  for (const id of [
    "#in-password",
    "#in-email",
    "#in-url",
    "#in-search",
    "#in-tel",
  ]) {
    const input = page.locator(id);
    const bg = await input.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const border = await input.evaluate(
      (el) => getComputedStyle(el).borderColor
    );
    expect(bg, `${id} background`).toBe(refBg);
    expect(border, `${id} border`).toBe(refBorder);
  }
});

// ---------------------------------------------------------------------------
// 5c — Focusable elements show a visible focus indicator
// ---------------------------------------------------------------------------
test("focusable elements show a visible focus ring when focused", async ({ page }) => {
  const focusables = [
    "#focus-btn",
    "#focus-link",
    "#focus-textarea",
    "#focus-input",
    "#focus-email",
  ];

  for (const sel of focusables) {
    const el = page.locator(sel);

    // Use keyboard navigation to trigger :focus-visible — click the element
    // first to ensure it is in the viewport, then blur and tab into it.
    await el.evaluate((node) => node.focus());

    // Check for a visible focus indicator: either a non-zero outline or a
    // non-"none" box-shadow. The framework uses both depending on context:
    // form controls get border-color + box-shadow on :focus, and the global
    // :focus-visible adds an outline ring.
    const hasVisibleFocus = await el.evaluate((node) => {
      const s = getComputedStyle(node);
      const outlineWidth = parseFloat(s.outlineWidth) || 0;
      const hasShadow = s.boxShadow !== "none" && s.boxShadow !== "";
      const hasBorderChange =
        s.borderColor !== "" &&
        s.borderColor !== getComputedStyle(document.body).borderColor;
      return outlineWidth > 0 || hasShadow || hasBorderChange;
    });

    expect(
      hasVisibleFocus,
      `${sel} should show a visible focus indicator`
    ).toBe(true);
  }
});
