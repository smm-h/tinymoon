# Number input spinner buttons (split from v0.4.0-loose-ends.md)

### Number input spinner buttons

`input[type="number"]` is styled (Phase 11 fix) but the native spinner arrows were hidden by `appearance: none` without a custom stepper replacement. Keyboard increment/decrement still works; the visual up/down affordance is missing. Add custom +/- buttons or styled pseudo-element arrows.

Affected files: `assets/css/primitives.css`, possibly `assets/js/controls.js` if JS buttons are needed
Effort: 1 hour
