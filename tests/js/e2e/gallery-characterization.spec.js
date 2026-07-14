import { test, expect } from "@playwright/test";

// Characterization baseline for the gallery as a whole, pinning current
// behavior before the Phase 2/3 refactors: every route renders, nothing is
// fetched from off-origin, and a normal route walk produces no console errors.

// The five gallery routes and their topbar titles.
const ROUTES = [
  ["tokens", "Tokens"],
  ["type", "Typography"],
  ["widgets", "Widgets"],
  ["wiki", "Wiki"],
  ["custom", "Custom component"],
];

async function goRoute(page, key, title) {
  await page.evaluate((k) => { location.hash = "#/" + k; }, key);
  await expect(page.locator("#tm-page-title")).toHaveText(title);
}

test("all five gallery routes render a visible view with content", async ({ page }) => {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  for (const [key, title] of ROUTES) {
    await goRoute(page, key, title);
    const view = page.locator("#tm-content section.view:not(.hidden)");
    await expect(view).toBeVisible();
    const text = (await view.textContent()) || "";
    expect(text.trim().length, `route #/${key} should render non-empty content`).toBeGreaterThan(0);
  }
});

test("a full gallery load and route walk makes zero off-origin requests", async ({ page }) => {
  const offOrigin = [];
  page.on("request", (req) => {
    const url = req.url();
    // Only network-scheme requests matter; data:/blob: are not network loads.
    if (!/^https?:/i.test(url)) return;
    if (!url.startsWith("http://localhost:4173")) offOrigin.push(url);
  });
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  for (const [key, title] of ROUTES) {
    await goRoute(page, key, title);
  }
  expect(offOrigin, `off-origin requests: ${offOrigin.join(", ")}`).toHaveLength(0);
});

test("a full gallery load and route walk produces zero console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  for (const [key, title] of ROUTES) {
    await goRoute(page, key, title);
  }
  expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
});
