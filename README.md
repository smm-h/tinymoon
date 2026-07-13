# tinymoon

A lean web framework that turns plain, semantic web content into a polished-looking web app.

> **Status:** `0.0.1` is a name reservation. The framework itself — shell, tokens, primitives, and conformance checker — lands in upcoming releases.

## Philosophy

**Content-first.** You bring plain, semantic content; tinymoon brings the app: shell, typography, widgets, motion. A page of tables and forms dropped into the shell should look like a finished product before you write a line of custom CSS.

**Zero build, zero dependencies, zero network.** Native ES modules and plain CSS. No bundler, no transpiler, no framework runtime, no `npm install` to use it, no CDN, no external fonts — everything is vendored. These are enforced by tests, not promised.

**No overhead — as a number, not a vibe.** No virtual DOM, no reactivity engine, no diffing. Views build their DOM once and mutate data in place; expensive work is cached and lazily loaded. Size budgets are checked in CI so the framework can never quietly bloat.

**Gorgeous and coherent — by constraint, not by option.** The visual identity is a short list of non-negotiables: sharp corners everywhere, no native browser widgets, a three-font system with monospace for data, a restrained glow language, motion limited to 100–180ms eases. Design tokens let you re-theme and re-accent; they do not let you opt out of the identity. Coherence survives because these are not configurable.

**Modular and DRY.** Every primitive is an independently importable ES module. Design tokens are the single source of truth for color, spacing, and type — including inside canvas rendering.

**You define components; tinymoon defines the language.** tinymoon is not a component library you exhaust — it is a component language: an element factory, tokens, a small view contract, a namespaced event bus, and explicit extension points (routes, context-menu providers, settings schema, footer slot). A well-written consumer component is indistinguishable from a built-in.

**Very strict.** Hard errors over warnings, no escape hatches, fewer options and more opinions. tinymoon ships a conformance checker that consumer projects run as a hard CI gate — external URLs, native widgets, `title=` attributes, rounded corners, and off-token colors are build failures, not style suggestions. Strictness is what keeps consumer-defined components coherent.

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
