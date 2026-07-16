# tinymoon

A content-first web framework: you bring plain, semantic content and small view objects; tinymoon brings the app -- shell, typography, widgets, motion. Everything ships as native ES modules and plain CSS with zero dependencies, zero build steps, and zero network loads.

tinymoon's palette is its identity. Consumer CSS must not redefine framework tokens.

## Install

npm (core + extras):

```
npm install tinymoon
```

The npm package exports barrels: `"tinymoon"` (core primitives), `"tinymoon/extras"` (wiki, networking, settings), `"tinymoon/state"` (store + reconciler), `"tinymoon/widgets"` (data-display), and `"tinymoon/chrome"` (async-state blocks, lazy mounting, shortcuts, command palette, light-dismiss engine + overlay-trigger invoker). Assets are available at `"tinymoon/assets/*"`.

Every shipped module is also importable by subpath -- `"tinymoon/select"`, `"tinymoon/dom"`, `"tinymoon/net"`, and so on, one per file in `assets/js/`. There is no build step and no tree-shaking, so subpaths are the way to import just what you use. Typed consumption goes through the barrels (`.d.ts` declarations cover `"tinymoon"`, `"tinymoon/extras"`, `"tinymoon/state"`, `"tinymoon/widgets"`, and `"tinymoon/chrome"`); the subpaths are for granular runtime imports and ship no per-module type declarations. `"tinymoon/auditor"` is a dev-only conformance module, not part of any barrel.

### Types even when you serve the assets yourself

You do not have to load the runtime from `node_modules` to get types. A common setup for a no-backend or server-rendered app is to **serve the CSS/JS from a vendor directory** (say `/tm`, copied from `tinymoon.assets_path()` or `node_modules/tinymoon/assets`) and still install `tinymoon` as a **devDependency purely for its `.d.ts` declarations**:

```
npm install --save-dev tinymoon
```

Then author against the barrel types (`import type { TableOptions } from "tinymoon/widgets"`) while your pages `<script type="module">` from `/tm/js/…`. The type declarations and the served runtime are the same version, so they stay in step. Vendored copies also pass tinymoon's own conformance checker automatically -- a served asset whose bytes match a packaged framework file is recognized as framework-own by identity (see [Vendored third-party code](#vendored-third-party-code)), so no quarantine is needed for tinymoon's own files.

Because the barrels re-export from per-file modules, each type's real runtime module is its subpath -- e.g. `createTable` is declared in the `tinymoon/widgets` barrel but its module is `tinymoon/table`; `createGrid` is in the `tinymoon` core barrel but its module is `tinymoon/grid`. The `index.d.ts` comments annotate each re-export with its real module path so you can pick the granular subpath import when you want it.

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

Link the CSS layers (tokens first) and import the ES modules -- no build step, no bundler:

```html
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/base.css">
<link rel="stylesheet" href="assets/css/shell.css">
<link rel="stylesheet" href="assets/css/primitives.css">
<link rel="stylesheet" href="assets/css/widgets.css">

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

`widgets.css` is the data-display layer -- it styles badges, cards, stats, data tables, and the empty state. Only apps that render those widgets need it; content-first apps and pure-control apps can omit it and link just the first four sheets. When you do link it, keep it fifth, after `primitives.css`.

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

- `mountShell(opts)` -- mount the app shell with sidebar, topbar, router, and footer slot (routes accept `eager: true` to build at mount instead of first visit)
- `createView(opts)` -- build a contract-conforming route view with managed `built`; `build`/`refresh` receive a ctx `{root, setSub(text)}`
- `announce(msg)` -- push a message into the shell's aria-live route announcer (also on the shell instance as `shell.announce`)
- `el(tag, cls?, text?)` -- element factory
- `$(sel, root?)` -- querySelector shorthand
- `$$(sel, root?)` -- querySelectorAll (returns array)

**Controls:**

- `createSwitch(opts)` -- role="switch" toggle button (not form-participating)
- `createInput(opts)` -- styled-native text input in a labeled field (form-participating; text/password/email/url/search/tel only)
- `createTextarea(opts)` -- styled-native textarea in a labeled field (form-participating)
- `createField(opts)` -- labeled `.field` wrapper with optional hint and inline `setError`
- `createCheckbox(opts)` -- hidden-native checkbox facade (form-participating)
- `createRadio(opts)` -- hidden-native radio facade (form-participating)
- `createFileInput(opts)` -- hidden-native file input facade (form-participating)
- `createNumber(opts)` -- number stepper wrapping a native `input[type=number]` with custom +/- buttons (form-participating)
- `createSegmented(opts)` -- segmented control with hidden radios (form-participating)
- `createSlider(opts)` -- styled-native range slider (form-participating; onInput = live, onChange = commit; `variant: "seek"` is an invisible position scrubber for app-drawn waveform/timeline visuals)
- `createTabs(opts)` -- tab bar (not form-participating)
- `createSelect(opts)` -- custom dropdown select
- `createCombobox(opts)` -- typeahead combobox with debounced async `onFilter` and stale-response discard (form-participating)
- `createMultiSelect(opts)` -- multi-value typeahead with removable chips over a hidden `<select multiple>` (form-participating)
- `createDatePicker(opts)` -- calendar date picker
- `createTimePicker(opts)` -- HH:MM time picker with locale display and an hours/minutes popover (form-participating)
- `createAccordion(opts)` -- stacked disclosure panels (single- or multi-open)
- `createTabPanels(opts)` -- tab bar composed with lazy, state-preserving panels (completes the APG tabs pattern)
- `createGrid(opts)` -- CSS-first preset rectangular layout (`1x1`/`2x1`/`1x2`/`2x2`); a content primitive, not a shell mode
- `iconButton(opts)` -- stateful topbar icon button instance (`setActive`/`setIcon`); pass `.el` to `topbarActions`
- `copyButton(getText, tip?)` -- one-click clipboard copy button
- `kebabButton(itemsFn, tip?)` -- three-dot menu button

> `copyButton` and `kebabButton` are sanctioned one-shot element utilities, not `createX` components -- they return a pre-wired `<button>` by design.

**Overlays:**

- `toast(msg, level?, opts?)` -- toast notification ("ok", "err", or plain)
- `setToastErrorHook(fn)` -- mirror error toasts into a custom hook
- `openModal(opts)` -- modal dialog (returns close function)
- `openDrawer(opts)` -- edge-anchored overlay drawer, light-dismiss or `modal: true` (returns `{el, close}`); pass a `trigger` (or wrap with `registerOverlayTrigger`) for a proper toggle button
- `openPopover(anchor, builder)` / `closePopover()` -- positioned popover
- `registerCtx(key, provider)` / `registerCtxFooter(fn)` -- context menu regions
- `showCtxMenu(x, y, items, anchor?)` / `hideCtxMenu()` -- programmatic context menu
- `ensureTooltip(el, text)` / `hideTip()` -- tooltip lifecycle
- `ensureHovercard(el, md)` / `hideHovercard()` -- rich hovercard with markdown

**Data and utilities:**

- `ICONS` -- built-in icon set (29 icons)
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
- `put(path, body, onError?)` -- PUT JSON to a same-origin path (mirrors `post`)
- `patch(path, body, onError?)` -- PATCH JSON to a same-origin path (mirrors `post`)
- `del(path, onError?)` -- DELETE a same-origin path (no body; mirrors `post`'s error handling)
- `createSettings(opts)` -- localStorage-backed settings store with schema validation (the returned store exposes `.subscribe(key, cb)` like any state store)
- `cycleTheme(store)` -- cycle a settings store's theme `dark -> light -> system` (the tri-state theme: `applyTheme()` resolves a stored `"system"` to the OS light/dark preference and re-resolves live on OS change, while storing `"system"`)
- `THEME_BOOT_SNIPPET` -- an exported inline pre-paint script string; drop it into a `<script>` in `<head>` **before** your stylesheets so `<html data-theme>` is set before the first paint (no light/dark flash). It resolves a stored `"system"` value against the OS and assumes the default storage key `"tm-settings"` (replace that one literal if your `storageKey` differs). Touches only `localStorage`/`matchMedia`/`documentElement` -- nothing the conformance scanners flag.
- `createWikiView(opts)` -- wiki view factory with table of contents and deep-linkable sections
- `renderDocMd(md)` -- block-level markdown to DOM (paragraphs, subheadings, lists)

### Chrome (`tinymoon/chrome`)

The Phase 6B framework wave. A separate barrel (not the core `tinymoon` index) purely for size discipline -- the frozen core byte ceiling has no room for the extra re-export lines. Each module is also importable by its own subpath (`tinymoon/palette`, `tinymoon/shortcuts`, ...).

- `loadingBlock(opts?)` / `emptyBlock(opts)` / `errorBlock(opts)` -- one-shot async-state element blocks (static-first, reduced-motion-safe, built on the `.empty` widgets.css style)
- `renderAsync(container, promise, opts)` -- swap loading/data/empty/error blocks into a container as a promise settles
- `lazyMount(target, loadFn, opts?)` -- IntersectionObserver-gated loader with a concurrency pump (default 3-wide), draining in visibility order; returns `cancel()`
- `registerShortcut(combo, handler, opts?)` -- keyboard shortcut binder on one shared listener ("mod+k" combos, overlay-aware suppression, `global`/`allowInInputs` opts, duplicate-combo hard error)
- `registerPaletteSource(fn)` / `openPalette()` / `installPalette(opts?)` -- opt-in command palette: source aggregation, debounced + stale-discarding querying, built-in subsequence match/rank, and (via `installPalette`) a global toggle shortcut seeded from the shell's routes
- `registerLightDismiss(opts)` -- register a light-dismiss overlay layer on the kernel's central outside-pointer registry (one document capture-phase `pointerdown` listener over a LIFO stack; only the topmost layer is consulted per press). `{panels, dismiss, trigger?}`; a press on a registered `trigger` dismisses and claims the pointer gesture so a close-press cannot immediately reopen the overlay. Returns an unregister function
- `registerOverlayTrigger(triggerEl, opener)` -- declarative invoker contract: the framework owns the trigger's click handler and open/closed state, sets `aria-expanded` (and `aria-controls`), and wires the gesture-claim. Backs the drawer toggle and the shell hamburger; double-registering the same element is a hard error

### State (`tinymoon/state`)

The L2 state story: build the DOM once and mutate it in place. There is no declarative render layer by design -- these helpers keep that mutation centralized.

- `createStore(initial)` -- reactive key/value store; the returned store exposes `get`, `set`, `update`, `subscribe(key, cb)` (pass `null` for any-change), `select(fn)`, and `snapshot()`
- `bind(store, key, widget)` -- wire a store key to a widget's `.set(v)`; syncs once, then forwards every change; returns an unbind function
- `reconcile(container, items, keyFn, hooks)` -- keyed child reconciler: new keys `create`, kept keys reuse their node and `update`, gone keys `remove` then detach; returns the ordered node array

### Widgets (`tinymoon/widgets`)

The data-display story: badges, stats, tables, trees, and charts. Optional -- linked alongside `widgets.css` only by apps that render data. Each widget is also importable by its own subpath (`tinymoon/table`, `tinymoon/tree`, ...).

- `badge(text, variant?)` -- one-shot status chip (bare `<span>`, not a component). It returns a plain element with no instance methods; to change it, mutate the node directly (`node.textContent = "…"`) or replace it with a fresh `badge(…)`. This is by design -- badges are cheap to recreate, so no update API is shipped.
- `createStat(opts)` -- single metric tile with an optional trend delta
- `renderStats(items)` -- a row of stat tiles from an array
- `createTable(opts)` -- keyboard-navigable data table with client-side column sort, `rowClass`/`cellClass` hooks, and `onRowClick`/`onRowHover` row pointer hooks
- `createVirtualList(opts)` -- windowed list for large datasets. **Fixed row height is a decided constraint** -- every row is the same `rowHeight`, which is what makes the windowing math exact and cheap. Variable-height rows are intentionally out of scope.
- `createTree(opts)` -- APG-pattern tree view with keyboard navigation
- `createFilterBar(opts)` -- slot container for filter controls
- `createChips(opts)` -- removable filter chips
- `createLoadMore(opts)` -- transport-agnostic cursor pagination control
- `createBreadcrumbs(opts)` -- router-agnostic breadcrumb trail
- `createSparkline(opts)` -- inline token-colored SVG sparkline
- `createChartContainer(opts)` -- renderer-agnostic sized chart shell with token access
- `createFeed(opts)` -- presentation-only live feed with a capped item buffer

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

- **Budgets are per-tier.** Every shipped file belongs to exactly one budgeted tier, each with its own hard ceiling. New capability tiers land as their own tiers, each carrying its own budget -- never charged against core. The full tier set: **JS** -- `core` (the original frozen module set), `controls-js` (new-generation controls: time picker, combobox, multi-select, accordion), `state-js` (store + reconciler), `widgets-js` (data-display widgets), `chrome-js` (shell-and-chrome modules: the Phase 6A view factory, drawer, tab panels, icon button, and preset grid, plus the Phase 6B async-state blocks, lazy mounting, keyboard shortcuts, and command palette, plus the light-dismiss engine and overlay-trigger invoker), and `dev` (dev-only modules, classified but uncounted); **CSS** -- `css` (the four base sheets) and `widgets-css` (the optional data-display sheet); plus **`fonts`** (the four vendored woff2 files). New-generation modules budget in their own tier even when they are still exported from the core barrel.
- **The core tier's existing APIs are frozen against breaking change.** What core exports today keeps its shape and behavior.
- **Additive extensions are permitted.** New primitives and options can join a tier as long as they stay under its ceiling.
- **The core ceiling is never raised.** Growth happens in new tiers, not by loosening core. Raising any ceiling is a deliberate reviewed decision, never a side effect.

## Conformance checker

`tinymoon check` scans `.html`, `.css`, and `.js` files and enforces the framework's non-negotiables as hard errors:

- **external-url** -- no external resource loads (no `http://`, `https://`, or `//host` URLs fetched into the page from HTML, CSS, or JS; form `action`/`formaction` count as loads). Plain `<a>`/`<area>` hyperlink navigations are legal
- **native-control** -- no native `<select>`, `<dialog>`, `<textarea>`, or `<input>` of a type that has a shipped replacement factory. A bare `<input>` with no `type` also fires (a typeless input defaults to `text`). Every banned control maps to a framework primitive:

  | Banned native | Replacement factory |
  | --- | --- |
  | `<input type=text\|password\|email\|url\|search\|tel>` | `createInput` |
  | `<input>` (typeless -- defaults to text) | `createInput` |
  | `<input type=number>` | `createNumber` |
  | `<input type=range>` | `createSlider` |
  | `<input type=time>` | `createTimePicker` |
  | `<input type=date>` | `createDatePicker` |
  | `<input type=checkbox>` | `createCheckbox` |
  | `<input type=radio>` | `createRadio` |
  | `<input type=file>` | `createFileInput` |
  | `<textarea>` | `createTextarea` |
  | `<select>` | `createSelect` |
  | `<dialog>` | `openModal` |

  `type="hidden"` stays legal (it renders nothing, so it has no identity surface -- the datepicker/timepicker/combobox carry their value in one). `type="color"` also stays legal for now: there is no replacement factory yet, and a ban may never ship without its replacement (when a color primitive ships, `color` joins the ban). tinymoon's own modules that legitimately create these natives (e.g. `openModal` builds on a native `<dialog>`; `createInput` wraps a visible native `<input>`) are exempt via the framework-own allowance, keyed on location so a consumer's `<dialog>` or bare `<input>` always fires. JS creation is caught for element tags and explicit `type` literals; a bare `el("input")`/`createElement("input")` with no literal type assignment is a known JS bypass (the tree-sitter rewrite closes it)
- **title-attr** -- no `title=` attributes (use the tooltip primitive). The JS `.title =` detector is a conservative regex with no flow analysis, so a plain-object field write like `fields.title = x` is a known false positive (an unknown receiver deliberately fires -- better a false positive than a missed tooltip). Write the property with bracket notation -- `fields["title"] = x` -- which the dot-based regex never matches and is always legal, while `element.title = "tip"` on a real DOM node still fires.
- **border-radius** -- no `border-radius` other than `0`/`0px`
- **raw-color** -- no color literals outside `:root`/`html[data-theme]` token definitions

```
uvx tinymoon check --dir ./web
```

One line per violation, exit non-zero on any finding. No `--skip`, `--ignore`, or warning mode. Exempt specific URLs by adding them to `tinymoon-allowlist.txt` at the scanned directory root.

### Vendoring tinymoon's own assets

A no-backend or self-hosting consumer often copies tinymoon's `css/`, `js/`, and `fonts/` out of the package into its own tree (e.g. `/tm`) and serves them directly. Those copies are tinymoon's own bytes, but the checker's framework-own allowance keys on the *installed* package location, so a naively-vendored copy would fail the checker's own native-control rule (`select.js` creating a `<select>`, etc.).

Vendored framework assets are recognized by **identity**, not location: a file whose bytes `sha256`-match a packaged framework asset is framework-own wherever you put it, with zero configuration and no `third_party/` quarantine. Keep the copies **verbatim** -- the intended workflow is an update script that re-copies from `node_modules/tinymoon/assets` (or `tinymoon.assets_path()`) on each upgrade, never a hand-edit. The hash is the proof: editing a vendored file to make it yours breaks the match, and it is then scanned as ordinary consumer code. The `third_party/` quarantine below remains for genuinely foreign code you did not write.

### Vendored third-party code

Sometimes you must vendor a third-party file verbatim -- a foreign stylesheet or script you did not write and cannot rewrite to obey the charter (it may use rounded corners, raw colors, or a native control). Rewriting it would fork it; leaving it in the tree would fail the checker.

Put such files in a directory named `third_party/` (the fixed conventional name -- there is no flag) and pin each one in a manifest at `third_party/PROVENANCE.toml` that sits beside them:

```toml
[[file]]
path = "foreign-widget.css"                 # relative to third_party/
origin = "https://example.com/widget@2.1"   # a URL or name; informational
sha256 = "a6d96b3a999b17010ce541dcf9c427648e9e929f5e5c89b96047e6c4c46a294f"
```

A quarantined file is exempt from all five rules **if and only if** it is pinned and its bytes still hash to the recorded `sha256`. The exemption is earned by provenance: the hash proves the bytes are unmodified third-party code. First-party code cannot hide here -- the moment you edit a quarantined file to make it yours, the hash stops matching and the check fails.

Every other state is a hard `unpinned-vendor` error (no bypass): a file present with no manifest entry (or no manifest at all), a manifest entry whose file is missing, a hash mismatch, or an entry whose path is absolute or escapes the directory with `..`. A quarantine directory nested anywhere inside the scanned tree is honored as long as its own `PROVENANCE.toml` sits beside it, so scanning a repo root and scanning a sub-tree agree.

Generate the `sha256` for an entry with coreutils:

```
sha256sum third_party/foreign-widget.css
```

The gallery is the mechanism's own first consumer: its Embed route's garish foreign CSS lives in `gallery/third_party/foreign-widget.css`, pinned by `gallery/third_party/PROVENANCE.toml`, and is loaded into a shadow root where its styling is sealed.

### Conformance from non-Python CI

The rules live in one place -- the Python checker. To let a reimplementation (a Go server, a CI job in any language) test itself instead of re-deriving the rules by hand and drifting, tinymoon ships two portable, machine-readable artifacts inside the packaged assets (wheel, npm tarball, and Go embed all carry them):

- **`assets/conformance/rules.json`** -- the rule data: every rule id, the banned input types and native control tags, the skip dirs, the allowlist and quarantine conventions, and the load-vs-navigation attribute-semantics table. Generated straight from the checker's own constants, so it can never drift from the enforced rules.
- **`assets/conformance/corpus/`** -- a byte-for-byte copy of the checker's own fixtures (`clean/`, `violations/`, `quarantine/`), paired with **`assets/conformance/expectations.json`**, the exact expected findings (per scan root, per file: ordered `[line, rule-id]` pairs; clean files map to `[]`).

A reimplementation runs its own rule over the corpus and asserts its findings match `expectations.json` for that rule id. The Go side does exactly this as a worked example: [`tinymoon_conformance_test.go`](tinymoon_conformance_test.go) loads the artifacts from the embedded FS, implements the `title-attr` rule natively, runs it over the corpus, and requires an exact match. It is a demonstration of the consumption pattern -- deliberately one tiny rule, not a full Go checker.

For **full scanning** from any CI -- not just conformance-testing a reimplementation -- invoke the shipped CLI; it is the single source of truth and needs no local Python setup:

```
uvx tinymoon check --dir <dir>
```

The corpus is fixture data with deliberate violations, so it is not part of the identity surface: the checker skips its own packaged corpus when self-scanning `assets`, and scans it normally only when it is the explicit target. Regenerate the artifacts after changing the checker or the fixtures with `scripts/gen_conformance_json.py`.

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

Before a release, also run the opt-in stress gate. It runs the interaction-heavy e2e specs (chrome, light-dismiss, tooltip-hovercard, datepicker, forms, ctxmenu) under a load profile -- `--repeat-each=10 --workers=6` -- which exercises timing-sensitive overlay behavior (close/reopen, focus, dismissal ordering) and surfaces load-dependent races that unloaded single-pass runs miss. Nothing invokes it automatically; it is an explicit pre-release step.

```
./scripts/checkpoint.sh --stress
```

## License

MIT
