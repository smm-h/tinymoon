"""WCAG 2.x contrast ratio enforcement for design tokens.

Parses tokens.css, extracts custom property values from :root (dark theme)
and html[data-theme="light"] (light theme), and verifies:
  - Text-on-background pairs meet 4.5:1 (AA normal text)
  - Non-text UI component pairs meet 3:1 (AA non-text, SC 1.4.11)

This is a hard gate: any pair below threshold is a test failure.
"""

import re
from pathlib import Path

import pytest

TOKENS_CSS = (
    Path(__file__).resolve().parent.parent / "assets" / "css" / "tokens.css"
)


# ---------------------------------------------------------------------------
# WCAG 2.x helpers
# ---------------------------------------------------------------------------


def _srgb_to_linear(c: float) -> float:
    """Convert an 8-bit sRGB channel (0-255) to linear-light."""
    c = c / 255.0
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(r: int, g: int, b: int) -> float:
    return (
        0.2126 * _srgb_to_linear(r)
        + 0.7152 * _srgb_to_linear(g)
        + 0.0722 * _srgb_to_linear(b)
    )


def contrast_ratio(rgb1: tuple[int, int, int], rgb2: tuple[int, int, int]) -> float:
    l1 = relative_luminance(*rgb1)
    l2 = relative_luminance(*rgb2)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


# ---------------------------------------------------------------------------
# CSS parser
# ---------------------------------------------------------------------------


_HEX_RE = re.compile(r"^#([0-9a-fA-F]{3,8})$")


def _parse_hex(value: str) -> tuple[int, int, int]:
    m = _HEX_RE.match(value.strip())
    if not m:
        raise ValueError(f"not a hex color: {value!r}")
    h = m.group(1)
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    elif len(h) == 4:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2  # ignore alpha
    elif len(h) == 8:
        h = h[:6]  # ignore alpha
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _parse_tokens(css: str) -> dict[str, dict[str, str]]:
    """Return {'dark': {name: value, ...}, 'light': {name: value, ...}}."""
    themes: dict[str, dict[str, str]] = {"dark": {}, "light": {}}

    # Find :root { ... } block
    root_match = re.search(r":root\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}", css)
    if not root_match:
        raise ValueError("no :root block found")
    _extract_props(root_match.group(1), themes["dark"])

    # Find html[data-theme="light"] { ... } block
    light_match = re.search(
        r'html\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}', css
    )
    if not light_match:
        raise ValueError("no light theme block found")
    # Start from dark as base, override with light
    themes["light"] = dict(themes["dark"])
    _extract_props(light_match.group(1), themes["light"])

    return themes


def _extract_props(block: str, out: dict[str, str]) -> None:
    for line in block.splitlines():
        line = line.strip()
        if not line.startswith("--"):
            continue
        # handle comments after the value
        if "/*" in line:
            line = line[: line.index("/*")]
        m = re.match(r"--([\w-]+)\s*:\s*(.+?)\s*;?\s*$", line)
        if m:
            out[m.group(1)] = m.group(2).rstrip(";").strip()


# ---------------------------------------------------------------------------
# Contrast pair definitions
# ---------------------------------------------------------------------------

# (foreground_token, background_token, min_ratio)
# Text pairs: 4.5:1 (WCAG AA normal text)
TEXT_PAIRS = [
    ("text", "bg", 4.5),
    ("text-dim", "bg", 4.5),
    ("text-faint", "bg", 4.5),
    ("text", "surface", 4.5),
    ("text", "surface-2", 4.5),
    ("text-dim", "surface-2", 4.5),
    ("text-faint", "surface-2", 4.5),
    ("on-accent", "accent", 4.5),
]

# Non-text UI component pairs: 3:1 (WCAG AA SC 1.4.11)
UI_PAIRS = [
    ("border-2", "surface", 3.0),
    ("border-2", "input-bg", 3.0),
]

ALL_PAIRS = TEXT_PAIRS + UI_PAIRS


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def themes():
    css = TOKENS_CSS.read_text()
    return _parse_tokens(css)


def _pair_id(fg: str, bg: str, ratio: float) -> str:
    return f"{fg}/{bg} (>={ratio})"


@pytest.mark.parametrize(
    "fg_token, bg_token, min_ratio",
    ALL_PAIRS,
    ids=[_pair_id(fg, bg, r) for fg, bg, r in ALL_PAIRS],
)
def test_dark_theme_contrast(themes, fg_token, bg_token, min_ratio):
    dark = themes["dark"]
    fg_val = dark[fg_token]
    bg_val = dark[bg_token]
    fg_rgb = _parse_hex(fg_val)
    bg_rgb = _parse_hex(bg_val)
    cr = contrast_ratio(fg_rgb, bg_rgb)
    assert cr >= min_ratio, (
        f"DARK {fg_token} ({fg_val}) on {bg_token} ({bg_val}): "
        f"{cr:.2f}:1 < {min_ratio}:1"
    )


@pytest.mark.parametrize(
    "fg_token, bg_token, min_ratio",
    ALL_PAIRS,
    ids=[_pair_id(fg, bg, r) for fg, bg, r in ALL_PAIRS],
)
def test_light_theme_contrast(themes, fg_token, bg_token, min_ratio):
    light = themes["light"]
    fg_val = light[fg_token]
    bg_val = light[bg_token]
    fg_rgb = _parse_hex(fg_val)
    bg_rgb = _parse_hex(bg_val)
    cr = contrast_ratio(fg_rgb, bg_rgb)
    assert cr >= min_ratio, (
        f"LIGHT {fg_token} ({fg_val}) on {bg_token} ({bg_val}): "
        f"{cr:.2f}:1 < {min_ratio}:1"
    )
