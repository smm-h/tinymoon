// tinymoon — chrome barrel: the Phase 6B framework-wave modules (async-state
// blocks, lazy mounting, keyboard shortcuts, command palette). Import from
// "tinymoon/chrome" (npm) or "./chrome.js" (standalone), or reach any single
// module by its subpath ("tinymoon/palette", "tinymoon/shortcuts", …).
//
// These live in their own barrel rather than the core index barrel purely for
// size discipline: the frozen core-js byte ceiling has no headroom for the
// extra re-export lines, so per the project's Size promise the new capability
// is surfaced here. The Phase 6A structural chrome (createView, openDrawer,
// createTabPanels, createGrid, iconButton) stays on the core barrel where it
// already shipped.

export { loadingBlock, emptyBlock, errorBlock, renderAsync } from "./states.js";
export { lazyMount } from "./lazy.js";
export { registerShortcut } from "./shortcuts.js";
export { registerPaletteSource, openPalette, installPalette, score } from "./palette.js";
export { registerLightDismiss, registerOverlayTrigger } from "./dismiss.js";
