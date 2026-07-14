import { defineConfig, devices } from "@playwright/test";

// E2E tests load the gallery from a static server rooted at the repo root, so
// ES module imports resolve exactly as they do for a real consumer. The
// gallery lives at /gallery/. Only chromium runs for now; broader browser
// coverage arrives in a later phase.
export default defineConfig({
  testDir: "tests/js/e2e",
  use: {
    baseURL: "http://localhost:4173",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "python3 -m http.server 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
