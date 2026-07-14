import { test, expect } from "@playwright/test";

// CSP conformance: serve the gallery with a strict Content-Security-Policy
// and verify zero violations during a full route walk. This empirically
// proves the "zero external network loads" claim.

const ROUTES = [
  ["tokens", "Tokens"],
  ["type", "Typography"],
  ["widgets", "Widgets"],
  ["forms", "Forms"],
  ["wiki", "Wiki"],
  ["custom", "Custom component"],
  ["content", "Content-first"],
];

async function goRoute(page, key, title) {
  await page.evaluate((k) => { location.hash = "#/" + k; }, key);
  await expect(page.locator("#tm-page-title")).toHaveText(title);
}

test("gallery produces zero CSP violations under a strict policy", async ({ page }) => {
  const cspViolations = [];

  // Intercept CSP violation reports by listening for securitypolicyviolation
  // events inside the page. We inject a listener before the gallery loads.
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push({
        directive: e.violatedDirective,
        blocked: e.blockedURI,
        source: e.sourceFile,
        line: e.lineNumber,
      });
    });
  });

  // Set up route interception to add CSP headers to gallery responses.
  await page.route("**/*", async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers() };
    // Strict CSP: only allow same-origin resources, inline styles (needed
    // for computed style assignments), data: URIs for the grain SVG, and
    // block all external connections.
    headers["content-security-policy"] =
      "default-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "script-src 'self'";
    await route.fulfill({
      response,
      headers,
    });
  });

  // Also collect console errors related to CSP.
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && /content.security.policy/i.test(text)) {
      cspViolations.push(text);
    }
  });

  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();

  // Walk all routes.
  for (const [key, title] of ROUTES) {
    await goRoute(page, key, title);
    await page.waitForTimeout(100);
  }

  // Read violations collected by the in-page listener.
  const pageViolations = await page.evaluate(() => window.__cspViolations || []);

  expect(
    pageViolations,
    "CSP violations: " + JSON.stringify(pageViolations, null, 2)
  ).toHaveLength(0);
  expect(
    cspViolations,
    "CSP console errors: " + cspViolations.join(" | ")
  ).toHaveLength(0);
});
