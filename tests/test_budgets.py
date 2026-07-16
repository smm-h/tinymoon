"""Size budgets and the zero-runtime-dependency guarantee.

"No overhead -- as a number, not a vibe": the shipped CSS and JS have hard
byte ceilings so the framework can never quietly bloat, and the runtime
must depend on nothing but itself.

Ceilings and tier memberships live in ONE table-driven registry (BUDGETS)
below. Adding a new JS tier or CSS sheet with its own ceiling requires only
appending a registry row -- the size test, the coverage tests, and every
error message derive from the registry automatically.
"""

import json
import re
from collections import namedtuple
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# The budget registry
# ---------------------------------------------------------------------------
#
# Hard byte ceilings for shipped assets. Ceilings are roughly baseline + 25%
# headroom. Raising a ceiling is a deliberate decision that must happen in
# this file, in review -- never as a side effect.
#
# Baselines (re-measured after Phase 8 module restructure):
#   assets/css/*.css      (4 base sheets + widgets)  -- measured elsewhere
#   assets/fonts/*.woff2  (4 files)  -- measured elsewhere
#
# JS is split into core and extras tiers:
#   Core:    93,984 bytes (15 modules)  -- ceiling 118,000
#   Extras:  25,115 bytes (6 modules)   -- ceiling 32,000
#   State:   10,281 bytes (2 modules)   -- ceiling 13,000
#   Widgets: 56,565 bytes (12 modules)  -- ceiling 70,000
#
# Each row is a BudgetRow:
#   name     -- human-readable tier/sheet name; names the test parameter
#   kind     -- "js" | "css" | "font"; picks the assets/<subdir> and extension
#   members  -- either an explicit set of basenames, or a glob string
#               (relative to assets/) resolved at test time
#   ceiling  -- byte ceiling for the size budget, or None when uncounted
#   counted  -- whether the row participates in the size budget. A row may be
#               classified (appears in coverage) without being size-counted;
#               the dev tier is uncounted-but-classified.
BudgetRow = namedtuple("BudgetRow", "name kind members ceiling counted")

_SUBDIR = {"js": "js", "css": "css", "font": "fonts"}
_EXT = {"js": "*.js", "css": "*.css", "font": "*.woff2"}

# Core modules: dom, icons, kernel, controls, inputs, slider, select, embed,
# datepicker, modal, popover, tooltip, hovercard, ctxmenu, toast, markdown,
# shell, index barrel. This is the ORIGINAL frozen set that the README "Size"
# promise refers to -- its ceiling is never raised. New-generation control
# modules land in the separate controls-js row below, never here.
_CORE_JS = frozenset({
    "controls.js", "ctxmenu.js", "datepicker.js", "dom.js", "embed.js",
    "hovercard.js", "icons.js", "index.js", "inputs.js", "kernel.js",
    "markdown.js", "modal.js", "popover.js", "select.js", "shell.js",
    "slider.js", "toast.js", "tooltip.js",
})

# New-generation control modules (Phase 3B): the time picker, the typeahead
# combobox + multi-select, and the accordion. These are still exported from the
# core barrel (index.js, additive API), but their BYTES are budgeted here rather
# than against the frozen core-js row, honoring the README Size promise that the
# core ceiling is never raised -- growth happens in new tiers.
_CONTROLS_JS = frozenset({
    "accordion.js", "combobox.js", "timepicker.js",
})

# Extras modules: wiki, net, realtime, format, settings, extras barrel.
_EXTRAS_JS = frozenset({
    "extras.js", "net.js", "realtime.js", "format.js", "settings.js", "wiki.js",
})

# State-story modules (Phase 4A): the reactive store + bind + keyed reconciler
# (store.js) and its barrel (state.js). Exported from the separate "tinymoon/
# state" barrel, never the core barrel, so they budget in their own tier rather
# than against the frozen core-js row.
_STATE_JS = frozenset({
    "state.js", "store.js",
})

# Data-display widget modules. Phase 5A: the badge one-shot factory, the stat
# tile + row builder, the keyboard-navigable data table, the fixed-height
# virtual list. Phase 5B completion: the APG tree view, the filter bar + chips,
# the transport-agnostic load-more control, the router-agnostic breadcrumbs,
# the token-colored sparkline, the renderer-agnostic chart container, and the
# presentation-only live feed. All exported from the separate "tinymoon/widgets"
# barrel (and per-module subpaths), never the core barrel, so they budget in
# their own tier. Ceiling raised ONCE for the Phase 5B data-display completion:
# measured new baseline 56,565 bytes (was 19,783); ceiling is +25% of the
# initial 55,776 measurement, rounded clean (70,000) -- ~24% headroom retained.
_WIDGETS_JS = frozenset({
    "badge.js", "stats.js", "table.js", "virtuallist.js", "widgets.js",
    "tree.js", "filterbar.js", "paginate.js", "breadcrumbs.js",
    "sparkline.js", "chart.js", "feed.js",
})

# Dev-only modules: not shipped in any barrel, not counted in size budgets.
# Consumers import these directly during development. Classified for coverage
# so every assets/js/*.js still belongs to exactly one row.
_DEV_JS = frozenset({
    "auditor.js",
})

# CSS sheets: base, primitives, shell, tokens -- the four base sheets every
# app links. The data-display widget layer (widgets.css) is split into its own
# "widgets-css" row below, since apps that render no data widgets can omit it.
_CSS_SHEETS = frozenset({
    "base.css", "primitives.css", "shell.css", "tokens.css",
})

# Data-display widget layer: badges, cards, stats + data tables, empty state,
# and the Phase 5B additions (tree, filter bar + chips, load-more, breadcrumbs,
# sparkline, chart container, live feed). Optional fifth sheet -- linked after
# primitives.css only by apps that render these widgets. Ceiling raised again
# for the Phase 5B data-display completion. Measured new baseline 18,059 bytes
# (was 9,893); ceiling is +25% clean of the 17,740 measurement (23,000).
_WIDGETS_CSS = frozenset({"widgets.css"})

BUDGETS = [
    BudgetRow("core-js", "js", _CORE_JS, 118_000, True),
    # controls-js: Phase 3B new-generation control modules. Measured baseline
    # 36,692 bytes (accordion + combobox + timepicker); ceiling is baseline +
    # 25% rounded clean. Core-js stays frozen per the README Size promise --
    # these modules budget here, not against core.
    BudgetRow("controls-js", "js", _CONTROLS_JS, 46_000, True),  # baseline 36,692
    # extras-js: raised ONCE for the Phase 4 realtime/net/format additions
    # (sse + socket wrappers in realtime.js, ApiError + auth-hook + request
    # options in net.js, and the restored fmtTime + relativeTime +
    # liveRelativeTime in format.js). Measured new baseline 25,115 bytes (was
    # 10,404 across 4 modules); ceiling is new-baseline + 25% rounded clean.
    BudgetRow("extras-js", "js", _EXTRAS_JS, 32_000, True),  # baseline 25,115
    # state-js: Phase 4A state story (store.js + state.js barrel). Measured
    # baseline 10,281 bytes; ceiling is baseline + 25% rounded clean.
    BudgetRow("state-js", "js", _STATE_JS, 13_000, True),  # baseline 10,281
    # widgets-js: Phase 5A + 5B data-display widgets. Raised ONCE for the
    # Phase 5B completion (tree, filterbar+chips, load-more, breadcrumbs,
    # sparkline, chart container, feed). Measured new baseline 56,565 bytes;
    # ceiling is +25% clean of the initial 55,776 measurement. Its own tier --
    # core stays frozen.
    BudgetRow("widgets-js", "js", _WIDGETS_JS, 70_000, True),  # baseline 56,565
    BudgetRow("dev-js", "js", _DEV_JS, None, False),
    # css: raised ONCE for the Phase 3 form-control additions (number stepper,
    # time picker, combobox, multi-select, accordion). Measured new baseline
    # 62,999 bytes (was 54,407); ceiling is new-baseline + 25% rounded clean.
    BudgetRow("css", "css", _CSS_SHEETS, 79_000, True),  # baseline 62,999
    BudgetRow("widgets-css", "css", _WIDGETS_CSS, 23_000, True),  # baseline 18,059
    BudgetRow("fonts", "font", "fonts/*.woff2", 122_000, True),
]


def _resolve(row):
    """Return the sorted list of files a registry row covers."""
    if isinstance(row.members, str):
        files = sorted((REPO / "assets").glob(row.members))
        assert files, f"no files matched assets/{row.members} (row {row.name})"
        return files
    subdir = _SUBDIR[row.kind]
    files = sorted((REPO / "assets" / subdir) / n for n in row.members)
    for f in files:
        assert f.exists(), f"{f.name} not found in assets/{subdir}/ (row {row.name})"
    return files


def _row_basenames(row):
    return {f.name for f in _resolve(row)}


# ---------------------------------------------------------------------------
# Size budgets: one parametrized test per counted registry row
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "row", [r for r in BUDGETS if r.counted], ids=lambda r: r.name
)
def test_size_budget(row):
    files = _resolve(row)
    total = sum(f.stat().st_size for f in files)
    assert total <= row.ceiling, (
        f"{row.name} is {total} bytes across {len(files)} files, over the "
        f"{row.ceiling}-byte budget -- trim before shipping (raising the "
        f"ceiling is a deliberate reviewed decision in this file)"
    )


# ---------------------------------------------------------------------------
# Coverage: every shipped file belongs to exactly one registry row of its kind
# ---------------------------------------------------------------------------


def _assert_exact_partition(kind):
    disk = {f.name for f in (REPO / "assets" / _SUBDIR[kind]).glob(_EXT[kind])}
    assigned = {}
    for row in BUDGETS:
        if row.kind != kind:
            continue
        for name in _row_basenames(row):
            assigned.setdefault(name, []).append(row.name)
    overlaps = {n: rows for n, rows in assigned.items() if len(rows) > 1}
    assert not overlaps, f"{kind} files assigned to multiple rows: {overlaps}"
    classified = set(assigned)
    unclassified = disk - classified
    assert not unclassified, (
        f"{kind} files not assigned to any registry row: {sorted(unclassified)}"
    )
    phantom = classified - disk
    assert not phantom, (
        f"registry rows list nonexistent {kind} files: {sorted(phantom)}"
    )


def test_js_tier_coverage():
    """Every .js file in assets/js/ belongs to exactly one JS row (incl. dev)."""
    _assert_exact_partition("js")


def test_css_sheet_coverage():
    """Every .css file in assets/css/ belongs to exactly one CSS row."""
    _assert_exact_partition("css")


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
