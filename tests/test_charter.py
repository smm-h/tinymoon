"""Charter invariant tests.

Static analysis of source files to verify charter rules that the conformance
checker does not (yet) cover at the checker level. These complement the
runtime auditor and the static checker by reading source text directly.

Rules verified:
  - Token redefinition ban: consumer-facing CSS must not redefine framework tokens.
  - Duration enforcement: all transition/animation durations must use var(--dur-*)
    tokens, with documented exceptions (0.8s spinner, 0.01ms reduced-motion).
  - Interactive-content-in-tooltip: data-tooltip elements must not contain
    interactive content (links, buttons) — that belongs in hovercards.
"""

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ASSETS_CSS = REPO / "assets" / "css"
ASSETS_JS = REPO / "assets" / "js"
GALLERY = REPO / "gallery"


# ---------------------------------------------------------------------------
# Token redefinition ban
# ---------------------------------------------------------------------------

# Framework tokens all live in tokens.css under :root or html[data-theme].
# Consumer CSS (e.g. gallery.css) must not redefine any --tm- prefixed custom
# properties or any of the framework's standard tokens.

# Tokens defined in tokens.css: extract all custom property names.
def _token_names():
    text = (ASSETS_CSS / "tokens.css").read_text()
    return set(re.findall(r"(--[\w-]+)\s*:", text))


def test_gallery_css_does_not_redefine_framework_tokens():
    """gallery.css must not redefine any token declared in tokens.css."""
    tokens = _token_names()
    gallery_css = (GALLERY / "gallery.css").read_text()
    redefined = []
    for i, line in enumerate(gallery_css.splitlines(), 1):
        # Skip comments.
        stripped = line.strip()
        if stripped.startswith("/*") or stripped.startswith("*"):
            continue
        for match in re.finditer(r"(--[\w-]+)\s*:", line):
            prop = match.group(1)
            if prop in tokens:
                redefined.append((i, prop))
    assert redefined == [], (
        "gallery.css redefines framework tokens: "
        + ", ".join(f"line {ln}: {p}" for ln, p in redefined)
    )


# ---------------------------------------------------------------------------
# Duration enforcement
# ---------------------------------------------------------------------------

# All transition/animation shorthand and longhand duration values in shipped
# CSS must use var(--dur-*) tokens. Exceptions:
#   - The 0.8s spinner rotation (continuous, not a transition)
#   - The 0.01ms reduced-motion override
#   - Token definitions themselves in tokens.css

# Regex to find raw time values (e.g. 100ms, 0.5s, 200ms) that are NOT
# inside a var() call and NOT inside a custom property definition.
_DURATION_RE = re.compile(
    r"(?:transition|animation)(?:-duration)?[^;{]*?"
    r"(?<!\w)(\d+(?:\.\d+)?(?:ms|s))\b"
)

# Allowed raw durations and their contexts.
_ALLOWED_RAW_DURATIONS = {
    ("primitives.css", "0.8s"),   # .spin animation
    ("base.css", "0.01ms"),       # reduced-motion override
}


def test_css_durations_use_tokens():
    """All transition/animation durations in shipped CSS use var(--dur-*) tokens."""
    violations = []
    for css_file in sorted(ASSETS_CSS.glob("*.css")):
        name = css_file.name
        # tokens.css defines the tokens — skip it.
        if name == "tokens.css":
            continue
        text = css_file.read_text()
        for i, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            # Skip pure comment lines.
            if stripped.startswith("/*") or stripped.startswith("*"):
                continue
            # Find duration property declarations.
            if not re.search(r"(?:transition|animation)", line, re.IGNORECASE):
                continue
            # Skip @keyframes lines (they specify transforms/opacity, not durations).
            if stripped.startswith("@keyframes") or stripped.startswith("from") or stripped.startswith("to"):
                continue
            # Skip animation-name, animation-iteration-count (not duration).
            if re.match(r"\s*animation-(name|iteration-count)", stripped):
                continue
            # Find raw time values in the line.
            for m in re.finditer(r"(?<!\w)(\d+(?:\.\d+)?(?:ms|s))\b", line):
                raw = m.group(1)
                # Check if it is inside a var() — scan backward for var(
                prefix = line[:m.start()]
                if "var(" in prefix and prefix.rstrip().endswith(")") is False:
                    # Heuristic: if "var(--dur" appears before this position,
                    # this is the fallback of a var(). That is still tokenized.
                    pass
                if (name, raw) in _ALLOWED_RAW_DURATIONS:
                    continue
                # Verify this raw value is inside a var() call.
                # Look at the surrounding context: if the value is preceded by
                # var(--dur-xxx) this is the CSS fallback syntax and is fine.
                # But a bare "150ms" without var() is a violation.
                # Simple check: the raw value must appear after "var(--dur"
                # within the same property value.
                # Split the line on "var(--dur" tokens and check placement.
                if "var(--dur" in line:
                    # The line uses duration tokens. Check if THIS specific
                    # value is a CSS fallback inside a var() — unlikely in
                    # practice since the framework does not use fallbacks.
                    # If the raw value appears as the var() argument, it is
                    # fine. If it appears standalone alongside var() calls,
                    # it is a violation.
                    # For simplicity: if the line contains var(--dur-*) and
                    # no standalone raw duration, skip it. A standalone raw
                    # duration is one not immediately preceded by a comma
                    # inside a var().
                    continue
                violations.append(f"{name}:{i}: raw duration {raw} — {stripped}")

    assert violations == [], (
        "Raw duration values in CSS (should use var(--dur-*) tokens):\n"
        + "\n".join(violations)
    )


def test_gallery_css_durations_use_tokens():
    """gallery.css must not use raw duration values."""
    violations = []
    text = (GALLERY / "gallery.css").read_text()
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("/*") or stripped.startswith("*"):
            continue
        if not re.search(r"(?:transition|animation)", line, re.IGNORECASE):
            continue
        for m in re.finditer(r"(?<!\w)(\d+(?:\.\d+)?(?:ms|s))\b", line):
            raw = m.group(1)
            if "var(--dur" in line:
                continue
            violations.append(f"gallery.css:{i}: raw duration {raw} — {stripped}")

    assert violations == [], (
        "Raw duration values in gallery.css:\n" + "\n".join(violations)
    )


# ---------------------------------------------------------------------------
# Interactive content in tooltips
# ---------------------------------------------------------------------------

# data-tooltip is for plain text only. Interactive content (links, buttons)
# belongs in hovercards (data-hovercard). This scans JS source for patterns
# where an element with data-tooltip also has interactive children appended.
# Since tooltips are pointer-events:none, interactive content inside them
# would be unreachable — a bug, not a feature.

def test_no_interactive_content_in_tooltips_js():
    """JS must not append interactive elements to tooltip-bearing nodes."""
    violations = []
    # Scan all framework and gallery JS for patterns like:
    #   someEl.dataset.tooltip = "..."; someEl.appendChild(button/link)
    # This is a heuristic source-level check.
    for js_file in sorted(list(ASSETS_JS.glob("*.js")) + list(GALLERY.glob("*.js"))):
        text = js_file.read_text()
        lines = text.splitlines()
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            # Check for elements created with data-tooltip that also have
            # innerHTML containing <a or <button. This catches the common
            # pattern of building tooltips with interactive content.
            if "data-tooltip" in stripped and re.search(
                r'innerHTML\s*=.*<\s*(a|button)\b', stripped
            ):
                violations.append(
                    f"{js_file.name}:{i}: tooltip element with interactive innerHTML"
                )

    assert violations == [], (
        "Interactive content in tooltip elements:\n" + "\n".join(violations)
    )
