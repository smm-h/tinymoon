import { test, expect } from "@playwright/test";

// Verify that prefers-reduced-motion: reduce suppresses all visible
// animation and transition durations to at most 1ms (0.01ms in practice).

test.use({ reducedMotion: "reduce" });

test("reduced-motion: no animation or transition exceeds 1ms", async ({ page }) => {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();

  // Navigate to the widgets route to exercise the most primitives (buttons,
  // toggles, toasts, modals, cards, etc.).
  await page.evaluate(() => { location.hash = "#/widgets"; });
  await expect(page.locator("#tm-page-title")).toHaveText("Widgets");

  // Scan every element in the document for computed animation-duration and
  // transition-duration. Both are returned as comma-separated lists of
  // time values (e.g. "0s, 0.15s"). Parse each and assert <= 1ms.
  const violations = await page.evaluate(() => {
    const bad = [];
    const parseMs = (v) => {
      if (v.endsWith("ms")) return parseFloat(v);
      return parseFloat(v) * 1000; // seconds to ms
    };
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      for (const prop of ["animationDuration", "transitionDuration"]) {
        const raw = cs[prop];
        if (!raw) continue;
        for (const part of raw.split(",")) {
          const ms = parseMs(part.trim());
          if (ms > 1) {
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : "";
            const cls = el.className ? `.${[...el.classList].join(".")}` : "";
            bad.push(`${tag}${id}${cls} ${prop}=${part.trim()}`);
          }
        }
      }
    }
    return bad;
  });
  expect(violations, `elements with animation/transition > 1ms:\n${violations.join("\n")}`).toHaveLength(0);
});

test("reduced-motion: scroll-behavior is auto on #tm-content", async ({ page }) => {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();

  const scrollBehavior = await page.locator("#tm-content").evaluate(
    (el) => getComputedStyle(el).scrollBehavior
  );
  expect(scrollBehavior).toBe("auto");
});
