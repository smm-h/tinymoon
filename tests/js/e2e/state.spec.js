import { test, expect } from "@playwright/test";

// The State route exercises the L2 state story end to end: a store mutated by a
// ticker, a bound widget, and a keyed reconciled list. This proves two things
// in a real browser: (1) the demo is LIVE — the store's count keeps rising and
// the readout tracks it; (2) reconcile PRESERVES NODE IDENTITY across reorders
// — each row is stamped with a create-sequence at create time, and that stamp
// survives every reorder because the reconciler reuses the node rather than
// re-creating it.

test.describe("state demo — store · bind · reconcile", () => {
  test("live store updates and reconcile preserves node identity on reorder", async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator("#tm-app")).toBeVisible();

    // Navigate to the State route (hash router).
    await page.evaluate(() => { location.hash = "#/state"; });

    const list = page.locator('[data-testid="state-list"]');
    await expect(list).toBeVisible();
    const rows = list.locator(".state-row");
    await expect(rows).toHaveCount(4);

    // (1) Live: the readout count keeps changing.
    const readout = page.locator('[data-testid="state-readout"]');
    const firstText = await readout.textContent();
    await expect
      .poll(async () => (await readout.textContent()) !== firstText, { timeout: 5000 })
      .toBe(true);

    // Snapshot key -> createSeq and the current key order.
    async function snap() {
      return rows.evaluateAll((els) =>
        els.map((e) => ({ key: e.dataset.key, seq: e.dataset.createSeq })));
    }
    const before = await snap();
    const orderBefore = before.map((r) => r.key).join(",");

    // (2) Wait until the reconciler reorders the list.
    await expect
      .poll(async () => (await snap()).map((r) => r.key).join(","), { timeout: 5000 })
      .not.toBe(orderBefore);

    const after = await snap();
    const beforeSeq = new Map(before.map((r) => [r.key, r.seq]));

    // Every key that existed before still carries its ORIGINAL create-seq: the
    // node was reused, never re-created, across the reorder.
    for (const row of after) {
      expect(row.seq, `create-seq for key ${row.key} must survive reorder`).toBe(
        beforeSeq.get(row.key),
      );
    }
    // Same four keys, only the order changed.
    expect(after.map((r) => r.key).sort()).toEqual(["alpha", "beta", "delta", "gamma"]);
    expect(after.map((r) => r.key).join(",")).not.toBe(orderBefore);
  });
});
