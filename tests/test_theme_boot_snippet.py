"""Byte-for-byte sync between the JS and Python THEME_BOOT_SNIPPET exports.

The pre-paint theme snippet is authored once in assets/js/settings.js as a
concatenation of string literals. The PyPI package re-exports the SAME runtime
string as tinymoon.THEME_BOOT_SNIPPET so a Python server can inline it without
importing the JS module. This test reconstructs the JS runtime value from the
source and asserts it equals the Python constant exactly -- the two can never
drift.
"""

import re
from pathlib import Path

from tinymoon import THEME_BOOT_SNIPPET

REPO = Path(__file__).resolve().parent.parent
SETTINGS_JS = REPO / "assets" / "js" / "settings.js"

# Single-quoted JS string literal (handles escaped chars, though the snippet has
# none). The snippet's inner quotes are double quotes, so no unescaping needed.
_SQ_STRING = re.compile(r"'((?:[^'\\]|\\.)*)'")


def _js_snippet_value() -> str:
    """Reconstruct the runtime value of the JS THEME_BOOT_SNIPPET export by
    concatenating the single-quoted literals in its assignment expression."""
    src = SETTINGS_JS.read_text(encoding="utf-8")
    # Anchor to a `;` at END of a line: the intra-string `;` (inside "{}");)
    # sits mid-line, so only the real statement terminator matches.
    m = re.search(
        r"export const THEME_BOOT_SNIPPET\s*=(.*?);\s*$",
        src,
        re.DOTALL | re.MULTILINE,
    )
    assert m, "THEME_BOOT_SNIPPET export not found in settings.js"
    parts = _SQ_STRING.findall(m.group(1))
    assert parts, "no string literals found in the THEME_BOOT_SNIPPET assignment"
    return "".join(parts)


def test_python_snippet_matches_js_byte_for_byte():
    assert THEME_BOOT_SNIPPET == _js_snippet_value()


def test_snippet_sets_data_theme_before_paint():
    # A couple of load-bearing substrings, so a well-intentioned edit to one
    # side that keeps them in sync but breaks intent still trips the exact match
    # above; these document what the snippet is for.
    assert "localStorage.getItem" in THEME_BOOT_SNIPPET
    assert "documentElement.dataset.theme" in THEME_BOOT_SNIPPET
    assert "prefers-color-scheme" in THEME_BOOT_SNIPPET
