// Shared helpers for the e2e suite.

// axe computes color contrast from live computed styles, so it must run only
// once entrance motion has settled. A route change restarts the .view fade
// (view-in: opacity 0 → 1 over --dur-slow) and drawers/modals fade in via
// opacity transitions. Sampling mid-fade composites the element over the page
// background, dipping the accent tab's passing 4.60:1 contrast to a failing
// 4.47:1 (accent + white at ~96% opacity over the dark bg) — the intermittent
// parallel-load flake. Wait for all finite animations/transitions to finish
// first. Infinite animations (e.g. spinners) are skipped so this never hangs.
export async function settleAnimations(page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => {
          const t = a.effect && a.effect.getTiming();
          return t && t.iterations !== Infinity;
        })
        .map((a) => a.finished.catch(() => {})),
    ),
  );
}
