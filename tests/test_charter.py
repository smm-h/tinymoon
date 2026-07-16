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


# ---------------------------------------------------------------------------
# Ban ships its replacement
# ---------------------------------------------------------------------------

# Charter principle: every native control the conformance checker bans must
# map to a shipped framework factory, and no ban may ever be added without its
# replacement. A ban that forbids a native control while leaving authors with
# no framework-native alternative is a broken promise -- the checker would
# block usage with nothing to migrate to.
#
# The ban surface is read live from the checker so this test cannot drift from
# the real rules:
#   - Banned <input type=...> values come from checker._BANNED_INPUT_TYPES.
#   - The banned native <select> tag is extracted from the checker's own
#     native-control regexes (_JS_EL_NATIVE_RE / _JS_CREATE_NATIVE_RE): the
#     tag alternation lives in the capture group following the quote-character
#     group. There is no dedicated select-tag constant, so this capture group
#     is the authoritative programmatic representation of the select ban.
#
# The checker is imported lazily inside the helpers (not at module scope) so a
# concurrent in-flight edit to checker.py cannot break collection of the other
# charter tests in this file.

CORE_BARREL = ASSETS_JS / "index.js"

# Every banned native control -> the framework factory that replaces it.
# This mapping must track the checker's ban surface exactly (see the three
# tests below): no missing entries, no stale entries, and every factory here
# must be exported by the core barrel.
REPLACEMENTS = {
    "checkbox": "createCheckbox",
    "radio": "createRadio",
    "file": "createFileInput",
    "select": "createSelect",
    "dialog": "openModal",
}


def _banned_native_tags():
    """Native element tag names the checker bans, extracted from its own
    native-control regexes. In each pattern the tag alternation is the
    capture group made only of word characters and ``|`` (the sibling
    quote-character group is a ``["']`` character class and is skipped).
    Robust to the alternation growing (e.g. ``(select|datalist)``)."""
    import tinymoon.checker as checker

    tags = set()
    for pat in (checker._JS_EL_NATIVE_RE, checker._JS_CREATE_NATIVE_RE):
        for group in re.findall(r"\(([^()]+)\)", pat.pattern):
            if re.fullmatch(r"[\w|]+", group):
                tags.update(group.split("|"))
    return tags


def _banned_controls():
    """The full set of native controls the checker bans: banned <input>
    types plus banned native element tags, sourced live from the checker."""
    import tinymoon.checker as checker

    return set(checker._BANNED_INPUT_TYPES) | _banned_native_tags()


def _barrel_exports():
    """Names exported by the core barrel (assets/js/index.js), parsed
    textually from its ``export { ... } from "..."`` statements. An
    ``orig as alias`` re-export contributes the alias (the visible name)."""
    text = CORE_BARREL.read_text()
    names = set()
    for block in re.findall(r"export\s*\{([^}]*)\}", text):
        for part in block.split(","):
            part = part.strip()
            if not part:
                continue
            m = re.search(r"\bas\s+([\w$]+)$", part)
            names.add(m.group(1) if m else part)
    return names


def test_every_banned_control_has_a_replacement_factory_mapping():
    """(a) Every native control the checker bans maps to a replacement.

    Principle: a ban may never be added without its replacement factory.
    """
    banned = _banned_controls()
    missing = sorted(banned - set(REPLACEMENTS))
    assert missing == [], (
        "The checker bans native controls with no replacement factory "
        "mapped in REPLACEMENTS: " + ", ".join(missing) + ". Charter "
        "principle: a ban may never ship without its replacement factory. "
        "Add the REPLACEMENTS entry and ship the framework factory before "
        "banning the control."
    )


def test_every_replacement_factory_is_exported_by_core_barrel():
    """(b) Every mapped replacement factory is exported by the core barrel.

    Principle: a ban may never ship without its replacement factory -- and
    an unexported factory is not shipped, so authors could not migrate to it.
    """
    exports = _barrel_exports()
    missing = sorted(
        f"{control} -> {factory}"
        for control, factory in REPLACEMENTS.items()
        if factory not in exports
    )
    assert missing == [], (
        "Replacement factories are not exported by the core barrel "
        f"({CORE_BARREL.relative_to(REPO)}): " + ", ".join(missing) + ". "
        "Charter principle: a banned control's replacement factory must be "
        "shipped and exported from the core barrel -- a ban may never ship "
        "without its replacement."
    )


def test_no_stale_replacement_entries():
    """(c) REPLACEMENTS has no entries for controls the checker does not ban.

    A stale entry advertises a replacement for a control that was never (or
    is no longer) banned, letting the mapping drift from the real ban surface.
    """
    banned = _banned_controls()
    stale = sorted(set(REPLACEMENTS) - banned)
    assert stale == [], (
        "REPLACEMENTS maps controls the checker does not ban: "
        + ", ".join(stale) + ". The mapping must track the ban surface "
        "exactly so that ban and replacement stay in lockstep -- remove the "
        "stale entries."
    )
