import { test, expect } from "@playwright/test";

// Runtime conformance: load the gallery with the auditor active and verify
// zero charter violations are reported during a full route walk.

const ROUTES = [
  ["tokens", "Tokens"],
  ["type", "Typography"],
  ["widgets", "Widgets"],
  ["forms", "Forms"],
  ["wiki", "Wiki"],
  ["custom", "Custom component"],
  ["embed", "Embed"],
  ["content", "Content-first"],
];

async function goRoute(page, key, title) {
  await page.evaluate((k) => { location.hash = "#/" + k; }, key);
  await expect(page.locator("#tm-page-title")).toHaveText(title);
}

test("gallery with auditor reports zero charter violations across all routes", async ({ page }) => {
  // Collect console.error calls from the auditor.
  const auditorErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("[tinymoon/auditor]")) {
      auditorErrors.push(msg.text());
    }
  });

  await page.goto("/tests/js/e2e/fixtures/auditor-gallery.html");
  await expect(page.locator("#tm-app")).toBeVisible();

  // Walk all routes to exercise every view's build() + refresh().
  for (const [key, title] of ROUTES) {
    await goRoute(page, key, title);
    // Give the auditor time to process mutations.
    await page.waitForTimeout(200);
  }

  // Also read the JS-side error array for completeness.
  const jsErrors = await page.evaluate(() => window.__tmAuditorErrors || []);

  expect(
    auditorErrors,
    "Auditor console errors: " + auditorErrors.join(" | ")
  ).toHaveLength(0);
  expect(
    jsErrors.map((e) => e.message),
    "Auditor JS errors: " + jsErrors.map((e) => e.message).join(" | ")
  ).toHaveLength(0);
});

test("gallery with auditor makes zero external network requests", async ({ page }) => {
  const offOrigin = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!/^https?:/i.test(url)) return;
    if (!url.startsWith("http://localhost:4173")) offOrigin.push(url);
  });

  await page.goto("/tests/js/e2e/fixtures/auditor-gallery.html");
  await expect(page.locator("#tm-app")).toBeVisible();

  for (const [key, title] of ROUTES) {
    await goRoute(page, key, title);
  }

  expect(offOrigin, "off-origin requests: " + offOrigin.join(", ")).toHaveLength(0);
});
