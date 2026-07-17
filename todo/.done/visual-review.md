# Visual review of palette and new primitives (split from v0.4.0-loose-ends.md, consciously deferred)

Deferred by explicit decision at the 0.5.0 release gate: the release proceeded on the automated gates (contrast harness, axe scans, characterization e2e, both-theme walks) without a human visual pass. The item remains valid for a future session.

### Visual review of palette and new primitives

The v0.4.0 palette changes and new primitives have never been seen by a human. Changes that need visual sign-off:

- `--text-faint` brighter in both themes (dark: `#64646c` -> `#8a8a94`, light: `#8d93a0` -> `#636b7a`)
- `--accent` darker (`#2d7ff9` -> `#2d6cf4`)
- `--border-2` significantly brighter (dark: `#2b2b2b` -> `#646464`, light: `#cfd3db` -> `#8e9298`)
- New primitives: checkbox, radio, file input, date picker, hovercard, tabs, segmented (with hidden radios)
- Responsive: drawer nav at 768px, touch targets at 44px, toast full-width on narrow screens
- RTL: sidebar, toast, switch in dir=rtl

Serve the gallery (`python3 -m http.server` at repo root, open `/gallery/`) and walk all routes in both themes at desktop, tablet (768px), and phone (360px) widths.

Effort: 30 minutes of looking

(Note: since this was filed, the 0.5.0 augmentation added many more primitives — forms, data widgets, chrome, gold token, seek slider — which a future visual pass should cover too.)
