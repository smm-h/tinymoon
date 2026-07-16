# CLAUDE.md

These rules are mandatory for every AI session working in this repo. They derive from the project philosophy in `README.md` and are not negotiable.

## Shipped assets (the framework itself — HTML/CSS/JS/fonts)

- Keep shipped assets pure vanilla: native ES modules and plain CSS only. Never introduce a build step, bundler, transpiler, minifier, or preprocessor for shipped assets. Never add a runtime dependency.
- Never load anything from the network at runtime: no CDNs, no external fonts, scripts, styles, or images. Vendor everything into the repo.
- Never use native browser controls (checkbox, radio, select, file input, dialog) or `title=` attributes in framework HTML/JS. Use the framework's own primitives. (The framework's own primitives — modal, palette, drawer — may wrap these native elements internally under the checker's location-keyed framework-own allowance; that allowance is scoped to the primitives' source only. Consumer code must always use the primitives and is itself banned from the native controls, dialog included.)
- `border-radius` is `0` everywhere. The identity constants — three-font system, mono-for-data, glow language, 100–180ms motion timing, grain — are non-negotiable. Never add options that disable them.
- Route all colors, spacing, and typography through design tokens. Never hardcode palette values in CSS or in canvas-rendering JS. Add or derive a token instead.

## Tooling side (checker CLI, tests, dev scripts)

- Dev-time tooling and own-ecosystem dependencies are permitted for the tooling side only — never for shipped assets.
- Enforce with hard errors: conformance checks block and exit non-zero. Never add warn-and-continue behavior, `--skip`, `--ignore`, or any bypass flag for a guardrail.

## General

- Never reference other private projects by name in any file in this repo.
- This repo is rlsbl-managed: follow the standard changelog and release discipline. Never push manually.
