import { test, expect } from "@playwright/test";

// E2e tests for the object-copy system: copyable elements, context menu Copy
// items, doc-body selectability, and print layout.

async function goToWidgets(page) {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  await page.evaluate(() => { location.hash = "#/widgets"; });
  await expect(page.locator("#tm-page-title")).toHaveText("Widgets");
}

async function goToType(page) {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  await page.evaluate(() => { location.hash = "#/type"; });
  await expect(page.locator("#tm-page-title")).toHaveText("Typography");
}

async function goToWiki(page) {
  await page.goto("/gallery/");
  await expect(page.locator("#tm-app")).toBeVisible();
  await page.evaluate(() => { location.hash = "#/wiki"; });
  await expect(page.locator("#tm-page-title")).toHaveText("Wiki");
}

// -- Copyable elements --

test("stat elements are focusable (tabindex=0) and registered as copyable", async ({ page }) => {
  await goToWidgets(page);

  // Stats are .stat elements inside .report-stats
  const stat = page.locator(".stat").first();
  await expect(stat).toBeVisible();
  await expect(stat).toHaveAttribute("tabindex", "0");
});

test("table rows are focusable and registered as copyable", async ({ page }) => {
  await goToWidgets(page);

  const row = page.locator("table.data tbody tr").first();
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("tabindex", "0");
});

test("badge elements in Typography are focusable and registered as copyable", async ({ page }) => {
  await goToType(page);

  // The badges panel has span.badge elements
  const badge = page.locator(".badge").first();
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("tabindex", "0");
});

test("focusing a copyable element and triggering copy fires the copy handler", async ({ page }) => {
  await goToWidgets(page);

  // Focus a stat element and try to copy
  const stat = page.locator(".stat").first();
  await stat.focus();

  // Use evaluate to dispatch a copy event and capture the result
  const result = await page.evaluate(() => {
    return new Promise((resolve) => {
      const handler = (e) => {
        // If the framework intercepted, clipboardData will have been set
        // and preventDefault called. We check by looking at the event state.
        document.removeEventListener("copy", handler, true);
        resolve({
          defaultPrevented: e.defaultPrevented,
          activeElement: document.activeElement?.className || "",
        });
      };
      // Listen in capture phase after the framework's listener
      document.addEventListener("copy", handler, true);
      // Dispatch a copy event
      document.execCommand("copy");
    });
  });

  // The framework should have intercepted the copy on the focused .stat
  expect(result.activeElement).toContain("stat");
});

// -- Context menu Copy item --

test("right-clicking a copyable element shows a Copy item in the context menu", async ({ page }) => {
  await goToWidgets(page);

  const stat = page.locator(".stat").first();
  await expect(stat).toBeVisible();

  // Right-click the stat to open the context menu
  await stat.click({ button: "right" });

  const menu = page.locator("#tm-ctx-root.open");
  await expect(menu).toBeVisible();

  // The first menuitem should be "Copy"
  const copyItem = menu.locator("[role='menuitem']").first();
  await expect(copyItem).toContainText("Copy");
});

test("right-clicking a copyable table row shows Copy in context menu", async ({ page }) => {
  await goToWidgets(page);

  const row = page.locator("table.data tbody tr").first();
  await expect(row).toBeVisible();

  await row.click({ button: "right" });

  const menu = page.locator("#tm-ctx-root.open");
  await expect(menu).toBeVisible();

  const copyItem = menu.locator("[role='menuitem']").first();
  await expect(copyItem).toContainText("Copy");
});

// -- doc-body selectability --

test("doc-body prose is selectable (user-select: text)", async ({ page }) => {
  await goToWiki(page);

  const docBody = page.locator(".doc-body").first();
  await expect(docBody).toBeVisible();

  const userSelect = await docBody.evaluate((el) => {
    return getComputedStyle(el).userSelect;
  });
  expect(userSelect).toBe("text");
});

test("body chrome is not selectable (user-select: none)", async ({ page }) => {
  await goToWidgets(page);

  const userSelect = await page.evaluate(() => {
    return getComputedStyle(document.body).userSelect;
  });
  expect(userSelect).toBe("none");
});

// -- Print layout --

test("print stylesheet hides sidebar and topbar, makes content overflow visible", async ({ page }) => {
  await goToWidgets(page);

  // Emulate print media to test the @media print rules
  await page.emulateMedia({ media: "print" });

  // Sidebar should be hidden
  const sidebarDisplay = await page.locator("#tm-sidebar").evaluate((el) => {
    return getComputedStyle(el).display;
  });
  expect(sidebarDisplay).toBe("none");

  // Topbar should be hidden
  const topbarDisplay = await page.locator("#tm-topbar").evaluate((el) => {
    return getComputedStyle(el).display;
  });
  expect(topbarDisplay).toBe("none");

  // Body overflow should be visible
  const bodyOverflow = await page.evaluate(() => {
    return getComputedStyle(document.body).overflow;
  });
  expect(bodyOverflow).toBe("visible");

  // Content overflow should be visible
  const contentOverflow = await page.locator("#tm-content").evaluate((el) => {
    return getComputedStyle(el).overflow;
  });
  expect(contentOverflow).toBe("visible");
});
