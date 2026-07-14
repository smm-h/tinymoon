"""Size budgets and the zero-runtime-dependency guarantee.

"No overhead -- as a number, not a vibe": the shipped CSS and JS have hard
byte ceilings so the framework can never quietly bloat, and the runtime
must depend on nothing but itself.
"""

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Hard byte ceilings for shipped assets. Ceilings are roughly baseline + 25%
# headroom. Raising a ceiling is a deliberate decision that must happen in
# this file, in review -- never as a side effect.
#
# Baselines (re-measured after Phase 4 date picker):
#   assets/css/*.css  46,340 bytes (4 files)  -- ceiling 48,000
#   assets/js/*.js    96,362 bytes (19 files) -- ceiling 98,000
#   assets/fonts/*.woff2  97,596 bytes (4 files) -- ceiling 122,000
CSS_BUDGET_BYTES = 48_000
JS_BUDGET_BYTES = 98_000
FONT_BUDGET_BYTES = 122_000


def _total_bytes(pattern):
    files = sorted((REPO / "assets").glob(pattern))
    assert files, f"no files matched assets/{pattern}"
    return sum(f.stat().st_size for f in files), files


def test_css_size_budget():
    total, files = _total_bytes("css/*.css")
    assert total <= CSS_BUDGET_BYTES, (
        f"shipped CSS is {total} bytes across {len(files)} files, over the "
        f"{CSS_BUDGET_BYTES}-byte budget -- trim before shipping"
    )


def test_js_size_budget():
    total, files = _total_bytes("js/*.js")
    assert total <= JS_BUDGET_BYTES, (
        f"shipped JS is {total} bytes across {len(files)} files, over the "
        f"{JS_BUDGET_BYTES}-byte budget -- trim before shipping"
    )


def test_font_size_budget():
    total, files = _total_bytes("fonts/*.woff2")
    assert total <= FONT_BUDGET_BYTES, (
        f"shipped fonts are {total} bytes across {len(files)} files, over the "
        f"{FONT_BUDGET_BYTES}-byte budget -- add a new font only with review"
    )


# ---------------------------------------------------------------------------
# Zero runtime dependencies
# ---------------------------------------------------------------------------

_IMPORT_SPEC_RE = re.compile(
    r"""\b(?:import|export)\b[^;\n]*?\bfrom\s*(["'])([^"']+)\1"""
    r"""|\bimport\s*(["'])([^"']+)\3"""
    r"""|\bimport\s*\(\s*(["'])([^"']+)\5"""
)


def test_package_json_has_no_dependencies():
    pkg = json.loads((REPO / "package.json").read_text(encoding="utf-8"))
    assert not pkg.get("dependencies"), (
        "package.json declares runtime dependencies -- tinymoon ships with zero"
    )


def test_asset_js_imports_are_relative_only():
    for f in sorted((REPO / "assets" / "js").glob("*.js")):
        src = f.read_text(encoding="utf-8")
        assert "require(" not in src, f"{f.name}: require() -- ES modules only"
        for m in _IMPORT_SPEC_RE.finditer(src):
            spec = m.group(2) or m.group(4) or m.group(6)
            assert spec.startswith(("./", "../")), (
                f"{f.name}: import specifier {spec!r} is not a relative path "
                "-- shipped modules may only import each other"
            )
