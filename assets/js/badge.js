// tinymoon — badge: a one-shot status-chip element factory. Like copyButton
// and kebabButton, it returns a bare, pre-styled element (a <span>), NOT a
// stateful {el, ...} component: a badge has nothing to update and nothing to
// tear down, so wrapping it in an instance would be ceremony. Compose it into
// cards, table cells, stat rows — anywhere a small labelled status marker
// belongs. Sharp corners come from the global border-radius:0 identity rule.

import { el } from "./dom.js";

// The five sanctioned variants. Each maps to a semantic status color in
// widgets.css: ok→green, warn→gold, err→red, muted→faint border, neutral→the
// bare outline chip. An unknown variant is a hard error — no silent fallback.
const BADGE_VARIANTS = new Set(["ok", "warn", "err", "muted", "neutral"]);

// badge(text, variant?) → <span class="badge badge-<variant>">. `variant`
// defaults to "neutral" (the bare outline chip). `text` is coerced to a string;
// null/undefined render an empty chip.
export function badge(text, variant = "neutral") {
  if (!BADGE_VARIANTS.has(variant)) {
    throw new Error(
      "badge: unknown variant " + JSON.stringify(variant) +
        " — expected one of ok, warn, err, muted, neutral",
    );
  }
  return el("span", "badge badge-" + variant, text == null ? "" : String(text));
}
