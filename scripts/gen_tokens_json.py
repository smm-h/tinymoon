#!/usr/bin/env python3
"""Generate assets/tokens.json from assets/css/tokens.css.

The CSS file is the single source of truth for design tokens. This script
parses the DECLARED values verbatim -- it does not resolve, compute, or
normalize anything. color-mix(), var() references, rgba(), and raw hex are all
emitted as the exact strings the CSS declares. Consumers that need resolved
values must resolve them at runtime (the gallery reads live computed styles);
the artifact is a machine-readable mirror of what the CSS says, nothing more.

Two theme blocks are captured:

- ``default``: the ``:root`` block (the dark/default theme).
- ``light``: the ``html[data-theme="light"]`` block (the light overrides;
  only the properties the light theme actually redeclares appear here).

Output ordering follows CSS declaration order, so a token added to the CSS
shows up in a predictable place and diffs stay meaningful.

Usage::

    scripts/gen_tokens_json.py            # write assets/tokens.json
    scripts/gen_tokens_json.py --check    # verify the committed file is current
                                          # (exit 1 on drift, prints the fix)

The generator is stdlib-only and importable: tests call ``build_document()``
and ``serialize()`` to regenerate in memory and compare against the committed
file.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "assets" / "css" / "tokens.css"
OUTPUT = REPO_ROOT / "assets" / "tokens.json"

# Path recorded inside the artifact and printed in drift messages. Relative to
# the repo root so it is stable across machines.
SOURCE_REL = "assets/css/tokens.css"
REGEN_COMMAND = "scripts/gen_tokens_json.py"
MARKER = (
    "generated — do not edit, regenerate via scripts/gen_tokens_json.py"
)

# (theme key, CSS selector) in the order they should appear in the artifact.
THEME_BLOCKS = [
    ("default", ":root"),
    ("light", 'html[data-theme="light"]'),
]

_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)


def _strip_comments(css: str) -> str:
    """Remove every ``/* ... */`` comment (including multi-line ones)."""
    return _COMMENT_RE.sub("", css)


def _extract_block_body(css: str, selector: str) -> str:
    """Return the text between the braces of ``selector { ... }``.

    Token blocks contain no nested braces, so the first ``}`` after the
    opening ``{`` closes the block.
    """
    start = css.find(selector)
    if start == -1:
        raise ValueError(f"selector {selector!r} not found in {SOURCE_REL}")
    open_brace = css.find("{", start)
    if open_brace == -1:
        raise ValueError(f"no opening brace after {selector!r}")
    close_brace = css.find("}", open_brace)
    if close_brace == -1:
        raise ValueError(f"no closing brace for {selector!r}")
    return css[open_brace + 1 : close_brace]


def _parse_declarations(body: str) -> tuple[str | None, dict[str, str]]:
    """Parse a block body into (color_scheme, {token_name: declared_value}).

    Declarations are separated by ``;`` -- token values never contain a
    semicolon. The ``color-scheme`` property (not a custom property) is pulled
    out as theme metadata; every ``--name`` declaration becomes a token with
    its value preserved verbatim.
    """
    color_scheme: str | None = None
    tokens: dict[str, str] = {}
    for raw in body.split(";"):
        decl = raw.strip()
        if not decl or ":" not in decl:
            continue
        name, value = decl.split(":", 1)
        name = name.strip()
        value = value.strip()
        if name == "color-scheme":
            color_scheme = value
        elif name.startswith("--"):
            tokens[name] = value
    return color_scheme, tokens


def build_document() -> dict:
    """Parse the source CSS and return the artifact as an ordered dict."""
    css = _strip_comments(SOURCE.read_text(encoding="utf-8"))

    themes: dict[str, dict] = {}
    for key, selector in THEME_BLOCKS:
        body = _extract_block_body(css, selector)
        color_scheme, tokens = _parse_declarations(body)
        themes[key] = {
            "selector": selector,
            "color_scheme": color_scheme,
            "tokens": tokens,
        }

    return {
        "_generated": MARKER,
        "source": SOURCE_REL,
        "themes": themes,
    }


def serialize(document: dict) -> str:
    """Render the artifact deterministically (2-space indent, trailing NL)."""
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str]) -> int:
    check = "--check" in argv[1:]
    unknown = [a for a in argv[1:] if a != "--check"]
    if unknown:
        sys.stderr.write(f"unknown argument(s): {' '.join(unknown)}\n")
        return 2

    text = serialize(build_document())

    if check:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else None
        if current == text:
            print(f"{OUTPUT.relative_to(REPO_ROOT)} is up to date")
            return 0
        sys.stderr.write(
            f"{OUTPUT.relative_to(REPO_ROOT)} is out of date; "
            f"regenerate with: {REGEN_COMMAND}\n"
        )
        return 1

    OUTPUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
