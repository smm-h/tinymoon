# tinymoon

A lean web framework that turns plain, semantic web content into a polished-looking web app.

## Usage

Link the four CSS layers (tokens first) and import the ES modules — no build step, no bundler:

```html
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/base.css">
<link rel="stylesheet" href="assets/css/shell.css">
<link rel="stylesheet" href="assets/css/primitives.css">
```

```js
import { mountShell, createSettings, toast } from "tinymoon";
// or import primitives standalone: import { toast } from "tinymoon/assets/js/toast.js";

const settings = createSettings({ storageKey: "my-app", defaults: { theme: "dark" } });
settings.load();
settings.applyTheme();

const shell = mountShell({
  root: document.body,
  brand: { name: "myapp", logoHTML: '<div class="wordmark">my<b>app</b></div>' },
  routes: {
    home: { title: "Home", icon: "library", view: () => HomeView },
  },
  defaultRoute: "home",
});
```

`mountShell` also accepts an optional `onRoute(routeKey, sub)` callback fired after every route is handled (including the initial one), and the returned shell exposes `refreshCurrent()` to re-run the current view's `refresh()` in place.

Consumer apps can extend the built-in icon set with `registerIcons({name: svgString})` — colliding with an existing icon name is a hard error, never a silent overwrite. Error toasts can be mirrored into a log with `setToastErrorHook(fn)` — the hook receives each error toast's message and its opts object (`{}` when the caller passed none), and registering a second hook is a hard error.

Views are plain objects following the contract `{root, built, build(), refresh(), setSub?}` — the [gallery](gallery/) is a complete working app and documents every token, primitive, and extension point (serve the repo root with a static server and open `/gallery/`).

From Go, the assets ship as an embedded filesystem:

```go
import "github.com/smm-h/tinymoon" // tinymoon.Assets, tinymoon.FS(), tinymoon.Handler()
```

From Python, the wheel carries the assets; `tinymoon.assets_path()` returns their directory.

## Philosophy

**Content-first.** You bring plain, semantic content; tinymoon brings the app: shell, typography, widgets, motion. A page of tables and forms dropped into the shell should look like a finished product before you write a line of custom CSS.

**Zero build, zero dependencies, zero network.** Native ES modules and plain CSS. No bundler, no transpiler, no framework runtime, no `npm install` to use it, no CDN, no external fonts — everything is vendored. These are enforced by tests, not promised.

**No overhead — as a number, not a vibe.** No virtual DOM, no reactivity engine, no diffing. Views build their DOM once and mutate data in place; expensive work is cached and lazily loaded. Size budgets are checked in CI so the framework can never quietly bloat.

**Gorgeous and coherent — by constraint, not by option.** The visual identity is a short list of non-negotiables: sharp corners everywhere, no native browser widgets, a three-font system with monospace for data, a restrained glow language, motion limited to 100–180ms eases. Design tokens let you re-theme and re-accent; they do not let you opt out of the identity. Coherence survives because these are not configurable.

**Modular and DRY.** Every primitive is an independently importable ES module. Design tokens are the single source of truth for color, spacing, and type — including inside canvas rendering.

**You define components; tinymoon defines the language.** tinymoon is not a component library you exhaust — it is a component language: an element factory, tokens, a small view contract, a namespaced event bus, and explicit extension points (routes, context-menu providers, settings schema, footer slot). A well-written consumer component is indistinguishable from a built-in.

**Very strict.** Hard errors over warnings, no escape hatches, fewer options and more opinions. tinymoon ships a conformance checker that consumer projects run as a hard CI gate — external URLs, native widgets, `title=` attributes, rounded corners, and off-token colors are build failures, not style suggestions. Strictness is what keeps consumer-defined components coherent.

## Conformance

`tinymoon check` scans a directory's `.html`, `.css`, and `.js` files and enforces the framework's non-negotiables as hard errors:

- **external-url** — no network loads: no `http://`, `https://`, or protocol-relative `//host` URLs in HTML `src`/`href`/`srcset`, CSS `url()`/`@import`, or JS import specifiers and `fetch()`/`import()` literals (XML namespace identifiers and URLs in comments/prose are fine).
- **native-control** — no native `<select>`, `<dialog>`, or `<input type=checkbox|radio|file>`, in markup or created from JS; use the framework's primitives.
- **title-attr** — no `title=` attributes (SVG `<title>` child elements are fine); use the tooltip primitive instead.
- **border-radius** — no `border-radius` (or `borderRadius` in JS) other than `0`/`0px`; corners are sharp everywhere.
- **raw-color** — no color literals (hex, `rgb()`/`rgba()`/`hsl()`/`hsla()`/`oklch()`) outside custom-property definitions in `:root`/`html[data-theme=...]` blocks; everything else goes through `var(--token)` or `cssVar()`. (Named CSS colors are not checked.)

Run it against your project's web directory:

```
uvx tinymoon check --dir ./web
```

or install it once with `uv tool install tinymoon` and run `tinymoon check --dir ./web`. The `--dir` flag is required — the checker never scans the current directory implicitly.

It prints one line per violation (`path:line: [rule-id] message`) plus a summary, and exits non-zero if anything is found. There is deliberately no `--skip`, `--ignore`, warning mode, or any other bypass — a violation is a build failure.

If a specific URL genuinely must be exempt, add it to a `tinymoon-allowlist.txt` file at the scanned directory root — one exact URL per line, `#` comments allowed. The allowlist is a reviewable file in your repo, not a CLI flag.

Use it as a hard gate in CI:

```yaml
- run: uvx tinymoon check --dir ./web
```

The step fails the build on any violation; there is nothing to configure and nothing to bypass.

## Install

npm:

```
npm install tinymoon
```

PyPI:

```
pip install tinymoon
```

## License

MIT
