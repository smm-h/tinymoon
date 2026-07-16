# tinymoon

A content-first web framework: you bring plain, semantic content and small view objects; tinymoon brings the app -- shell, typography, widgets, motion. Everything ships as native ES modules and plain CSS with zero dependencies, zero build steps, and zero network loads.

tinymoon's palette is its identity. Consumer CSS must not redefine framework tokens.

## Install

npm (core + extras):

```
npm install tinymoon
```

The npm package exports two barrels: `"tinymoon"` (core primitives) and `"tinymoon/extras"` (wiki, networking, settings). Assets are available at `"tinymoon/assets/*"`.

Every shipped module is also importable by subpath -- `"tinymoon/select"`, `"tinymoon/dom"`, `"tinymoon/net"`, and so on, one per file in `assets/js/`. There is no build step and no tree-shaking, so subpaths are the way to import just what you use. Typed consumption goes through the two barrels (`.d.ts` declarations cover `"tinymoon"` and `"tinymoon/extras"`); the subpaths are for granular runtime imports and ship no per-module type declarations. `"tinymoon/auditor"` is a dev-only conformance module, not part of any barrel.

PyPI (assets + conformance checker CLI):

```
pip install tinymoon
```

`tinymoon.assets_path()` returns the directory containing `css/`, `js/`, and `fonts/`.

Go (embedded filesystem):

```go
import "github.com/smm-h/tinymoon"

// tinymoon.Assets  — embed.FS rooted at the repo root
// tinymoon.FS()    — fs.FS rooted at the assets directory
// tinymoon.Handler() — http.Handler serving the assets
```

## Quick start

Link the four CSS layers (tokens first) and import the ES modules -- no build step, no bundler:

```html
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/base.css">
<link rel="stylesheet" href="assets/css/shell.css">
<link rel="stylesheet" href="assets/css/primitives.css">

<script type="module">
import { mountShell, toast } from "./assets/js/index.js";
import { createSettings } from "./assets/js/extras.js";

const settings = createSettings({
  storageKey: "my-app",
  defaults: { theme: "dark" },
});
settings.load();
settings.applyTheme();

const shell = mountShell({
  root: document.body,
  brand: {
    name: "myapp",
    logoHTML: '<div class="wordmark">my<b>app</b></div>',
  },
  routes: {
    home: {
      title: "Home",
      icon: "library",
      view: () => HomeView,
    },
  },
  defaultRoute: "home",
});
</script>
```

With npm, use bare specifiers by adding an import map:

```html
<script type="importmap">
{ "imports": { "tinymoon": "./node_modules/tinymoon/assets/js/index.js",
               "tinymoon/extras": "./node_modules/tinymoon/assets/js/extras.js" } }
</script>
```

## Primitives

### Core (`tinymoon`)

**Shell and DOM:**

- `mountShell(opts)` -- mount the app shell with sidebar, topbar, router, and footer slot
- `el(tag, cls?, text?)` -- element factory
- `$(sel, root?)` -- querySelector shorthand
- `$$(sel, root?)` -- querySelectorAll (returns array)

**Controls:**

- `createSwitch(opts)` -- role="switch" toggle button (not form-participating)
- `createCheckbox(opts)` -- hidden-native checkbox facade (form-participating)
- `createRadio(opts)` -- hidden-native radio facade (form-participating)
- `createFileInput(opts)` -- hidden-native file input facade (form-participating)
- `createSegmented(opts)` -- segmented control with hidden radios (form-participating)
- `createTabs(opts)` -- tab bar (not form-participating)
- `createSelect(opts)` -- custom dropdown select
- `createDatePicker(opts)` -- calendar date picker
- `copyButton(getText, tip?)` -- one-click clipboard copy button
- `kebabButton(itemsFn, tip?)` -- three-dot menu button

> `copyButton` and `kebabButton` are sanctioned one-shot element utilities, not `createX` components -- they return a pre-wired `<button>` by design.

**Overlays:**

- `toast(msg, level?, opts?)` -- toast notification ("ok", "err", or plain)
- `setToastErrorHook(fn)` -- mirror error toasts into a custom hook
- `openModal(opts)` -- modal dialog (returns close function)
- `openPopover(anchor, builder)` / `closePopover()` -- positioned popover
- `registerCtx(key, provider)` / `registerCtxFooter(fn)` -- context menu regions
- `showCtxMenu(x, y, items, anchor?)` / `hideCtxMenu()` -- programmatic context menu
- `ensureTooltip(el, text)` / `hideTip()` -- tooltip lifecycle
- `ensureHovercard(el, md)` / `hideHovercard()` -- rich hovercard with markdown

**Data and utilities:**

- `ICONS` -- built-in icon set (26 icons)
- `icon(name)` -- render an icon as an SVG string
- `registerIcons(map)` -- merge consumer icons (collisions are hard errors)
- `renderMiniMd(text)` -- inline markdown to DOM fragment (bold, code, links)
- `cssVar(name)` -- read a computed CSS custom property value
- `ensureRoot()` -- ensure the root element exists
- `placeBelow(anchor, el)` -- position an element below an anchor
- `registerCopyable(el, fn)` / `unregisterCopyable(el)` -- register elements for the copy system
- `getCopyData(el)` -- retrieve copy data from a registered element

### Extras (`tinymoon/extras`)

- `api(path)` -- GET JSON from a same-origin path
- `post(path, body, onError?)` -- POST JSON to a same-origin path
- `createSettings(opts)` -- localStorage-backed settings store with schema validation
- `createWikiView(opts)` -- wiki view factory with table of contents and deep-linkable sections
- `renderDocMd(md)` -- block-level markdown to DOM (paragraphs, subheadings, lists)

## Identity

The visual identity is enforced by constraint, not offered as options:

- **Sharp corners everywhere** -- `border-radius` is 0; no exceptions.
- **Three-font system** -- brand headings (Space Grotesk), UI body (IBM Plex Sans), monospace for data (IBM Plex Mono). All vendored, no network loads.
- **Glow language** -- accent glows on active cards, focused inputs, and modals. Restrained and consistent.
- **Grain** -- a subtle SVG noise overlay on the background.
- **Motion timing** -- all transitions are 100--180ms one-shot eases. The spinner is the only continuous animation.
- **No native browser controls** -- checkbox, radio, select, file input, and date picker are all custom-drawn with hidden native elements for form participation and accessibility.
- **AA contrast** -- every text-on-background token pair passes WCAG AA 4.5:1. Enforced by CI.
- **Reduced motion** -- `prefers-reduced-motion: reduce` suppresses all animation and transition durations to near-zero. Enforced by E2E tests.

Design tokens let you re-theme and re-accent; they do not let you opt out of the identity.

## Size

No overhead -- as a number, not a vibe. Shipped CSS, JS, and fonts have hard byte ceilings enforced by CI; nothing bloats quietly.

- **Budgets are per-tier.** The JS is split into a core tier and an extras tier, each with its own ceiling. New capability tiers (widgets, state) will land as their own tiers, each carrying its own budget -- never charged against core.
- **The core tier's existing APIs are frozen against breaking change.** What core exports today keeps its shape and behavior.
- **Additive extensions are permitted.** New primitives and options can join a tier as long as they stay under its ceiling.
- **The core ceiling is never raised.** Growth happens in new tiers, not by loosening core. Raising any ceiling is a deliberate reviewed decision, never a side effect.

## Conformance checker

`tinymoon check` scans `.html`, `.css`, and `.js` files and enforces the framework's non-negotiables as hard errors:

- **external-url** -- no network loads (no `http://`, `https://`, or `//host` URLs in HTML, CSS, or JS)
- **native-control** -- no native `<select>`, `<dialog>`, or `<input type=checkbox|radio|file>`
- **title-attr** -- no `title=` attributes (use the tooltip primitive)
- **border-radius** -- no `border-radius` other than `0`/`0px`
- **raw-color** -- no color literals outside `:root`/`html[data-theme]` token definitions

```
uvx tinymoon check --dir ./web
```

One line per violation, exit non-zero on any finding. No `--skip`, `--ignore`, or warning mode. Exempt specific URLs by adding them to `tinymoon-allowlist.txt` at the scanned directory root.

## App model

**Copy system.** `registerCopyable(el, fn)` marks any element as copyable -- clicking it copies the value returned by `fn()` to the clipboard, with a toast confirmation. The `copyButton` helper wires a standalone copy button. `getCopyData(el)` retrieves registered copy data programmatically.

**Selection model.** Elements declare tooltips via `data-tooltip` (plain text) and hovercards via `data-hovercard` (markdown with bold, code, links). The framework manages hover intent, positioning, and the hover bridge automatically.

**View contract.** Routes map to view objects `{root, built, build(), refresh(), setSub?}`. The shell's router owns the lifecycle: `build()` constructs the DOM once (idempotent), `refresh()` runs on every visit, `setSub(sub)` receives deep-link tails. A string value instead of a view factory activates the content-first path -- plain HTML styled automatically with zero framework classes.

## Gallery

The gallery is a complete tinymoon app that documents every design token and primitive. Serve the repo root with a static server and open `/gallery/`:

```
python3 -m http.server
# open http://localhost:8000/gallery/
```

## Development

CI does not run until release, so the local suite is the quality gate between work phases. Run `scripts/checkpoint.sh` at every phase boundary -- it runs pytest, `npm test` (JS syntax gate + vitest), the Playwright e2e suite, `go test`, and the changelog check in order, stops at the first failure, and prints a PASS/FAIL summary. A green checkpoint is the bar for closing a phase.

```
./scripts/checkpoint.sh
```

## License

MIT
