import { test, expect } from "@playwright/test";

// Proves the createEmbed shadow boundary is a REAL isolation boundary in a
// browser: foreign CSS sealed inside the shadow root cannot restyle elements
// outside it, and the framework's identity CSS outside cannot restyle elements
// inside it. Uses the documented test-only seam (openForTest -> open shadow
// root, exposed as instance.shadowRoot) to read computed styles across the
// boundary.

const FIXTURE = "/tests/js/e2e/fixtures/embed-isolation.html";

const MAGENTA = "rgb(255, 0, 255)";
const LIME = "rgb(0, 255, 0)";

// Read a computed style property of an element inside the OPEN shadow root,
// reached through the exposed test seam.
function insideStyle(page, id, prop) {
  return page.evaluate(
    ([id, prop]) => {
      const el = window.__embed.shadowRoot.getElementById(id);
      return getComputedStyle(el)[prop];
    },
    [id, prop],
  );
}

function outsideStyle(page, id, prop) {
  return page.evaluate(
    ([id, prop]) => getComputedStyle(document.getElementById(id))[prop],
    [id, prop],
  );
}

test.describe("createEmbed shadow isolation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await expect(page.locator("#outside-btn")).toBeVisible();
  });

  test("foreign CSS applies INSIDE the shadow root", async ({ page }) => {
    // Sanity: the garish rule really is in effect inside the boundary.
    expect(await insideStyle(page, "inside-foreign", "backgroundColor")).toBe(MAGENTA);
    expect(await insideStyle(page, "inside-foreign", "borderTopLeftRadius")).toBe("18px");
  });

  test("foreign CSS does NOT leak OUT to restyle outside elements", async ({ page }) => {
    // The outside element shares the class name "foreign" but is in the light
    // DOM; the shadow's .foreign rule must not reach it.
    const bg = await outsideStyle(page, "outside-foreign", "backgroundColor");
    expect(bg).not.toBe(MAGENTA);
    const border = await outsideStyle(page, "outside-foreign", "borderTopColor");
    expect(border).not.toBe(LIME);
  });

  test("outside identity CSS is preserved (not overridden by the embed)", async ({ page }) => {
    // base.css enforces `* { border-radius: 0 !important }` in the light DOM.
    expect(await outsideStyle(page, "outside-btn", "borderTopLeftRadius")).toBe("0px");
  });

  test("outside CSS does NOT reach IN to the shadow root", async ({ page }) => {
    // The light-DOM `* { border-radius: 0 !important }` reset would flatten the
    // foreign 18px corner IF author styles crossed the boundary. They do not,
    // so the foreign radius survives -- proving outside CSS cannot restyle in.
    expect(await insideStyle(page, "inside-foreign", "borderTopLeftRadius")).toBe("18px");
    // A .btn inside the shadow gets NONE of primitives.css's .btn styling: its
    // background stays the UA default, not the framework surface token.
    const insideBtnBg = await insideStyle(page, "inside-btn", "backgroundColor");
    const outsideBtnBg = await outsideStyle(page, "outside-btn", "backgroundColor");
    expect(insideBtnBg).not.toBe(outsideBtnBg);
  });
});
