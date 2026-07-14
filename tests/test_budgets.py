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
# Baselines (re-measured after Phase 8 module restructure):
#   assets/css/*.css      (4 files)  -- measured elsewhere
#   assets/fonts/*.woff2  (4 files)  -- measured elsewhere
#
# JS is split into core and extras tiers:
#   Core:   93,984 bytes (15 modules)  -- ceiling 118,000
#   Extras:  8,407 bytes (4 modules)   -- ceiling 11,000
CSS_BUDGET_BYTES = 57_000
CORE_JS_BUDGET_BYTES = 118_000
EXTRAS_JS_BUDGET_BYTES = 11_000
FONT_BUDGET_BYTES = 122_000

# Core modules: dom, icons, kernel, controls, select, datepicker, modal,
# popover, tooltip, hovercard, ctxmenu, toast, markdown, shell, index barrel.
CORE_JS_MODULES = {
    "controls.js", "ctxmenu.js", "datepicker.js", "dom.js", "hovercard.js",
    "icons.js", "index.js", "kernel.js", "markdown.js", "modal.js",
    "popover.js", "select.js", "shell.js", "toast.js", "tooltip.js",
}

# Extras modules: wiki, net, settings, extras barrel.
EXTRAS_JS_MODULES = {
    "extras.js", "net.js", "settings.js", "wiki.js",
}


def _total_bytes(pattern):
    files = sorted((REPO / "assets").glob(pattern))
    assert files, f"no files matched assets/{pattern}"
    return sum(f.stat().st_size for f in files), files


def _tier_bytes(names):
    """Sum byte sizes for a set of JS module filenames."""
    js_dir = REPO / "assets" / "js"
    files = sorted(js_dir / n for n in names)
    for f in files:
        assert f.exists(), f"{f.name} not found in assets/js/"
    return sum(f.stat().st_size for f in files), files


def test_css_size_budget():
    total, files = _total_bytes("css/*.css")
    assert total <= CSS_BUDGET_BYTES, (
        f"shipped CSS is {total} bytes across {len(files)} files, over the "
        f"{CSS_BUDGET_BYTES}-byte budget -- trim before shipping"
    )


def test_core_js_size_budget():
    total, files = _tier_bytes(CORE_JS_MODULES)
    assert total <= CORE_JS_BUDGET_BYTES, (
        f"core JS is {total} bytes across {len(files)} files, over the "
        f"{CORE_JS_BUDGET_BYTES}-byte budget -- trim before shipping"
    )


def test_extras_js_size_budget():
    total, files = _tier_bytes(EXTRAS_JS_MODULES)
    assert total <= EXTRAS_JS_BUDGET_BYTES, (
        f"extras JS is {total} bytes across {len(files)} files, over the "
        f"{EXTRAS_JS_BUDGET_BYTES}-byte budget -- trim before shipping"
    )


def test_js_tier_coverage():
    """Every .js file in assets/js/ must belong to exactly one tier."""
    js_dir = REPO / "assets" / "js"
    all_js = {f.name for f in js_dir.glob("*.js")}
    classified = CORE_JS_MODULES | EXTRAS_JS_MODULES
    unclassified = all_js - classified
    assert not unclassified, (
        f"JS modules not assigned to a tier: {sorted(unclassified)}"
    )
    overlap = CORE_JS_MODULES & EXTRAS_JS_MODULES
    assert not overlap, f"modules in both tiers: {sorted(overlap)}"


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
