import { test, expect } from "@playwright/test";

// Smoke test: the gallery must load, run its ES modules, and mount the shell
// (which creates #tm-app). If the module graph is broken, #tm-app never
// appears and this fails.
test("gallery loads and mounts the shell", async ({ page }) => {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
});
