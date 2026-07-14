import { defineConfig } from "vitest/config";

// Unit tests run in a happy-dom environment so shipped modules that touch
// document/window work without a real browser. E2E tests live under
// tests/js/e2e and are driven by Playwright, not Vitest.
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/js/unit/**/*.test.js"],
  },
});
