"""Conformance checker tests.

- Violation fixtures: each file demonstrates one rule's violation variants;
  the checker must report EXACTLY the expected (line, rule-id) pairs.
- Clean fixtures: edge cases that must NOT fire (xmlns in data: URIs,
  var() colors, border-radius: 0, allowlisted URLs, SVG <title> elements,
  document.title, URLs in comments and prose, external <a>/<area> href
  navigations -- loads are banned, navigations are legal).
- Self-conformance: the shipped assets/ and the gallery/ must scan clean.
"""

from pathlib import Path

from tinymoon.checker import (
    BORDER_RADIUS,
    ENCODING_ERROR,
    EXTERNAL_URL,
    NATIVE_CONTROL,
    RAW_COLOR,
    TITLE_ATTR,
    UNPINNED_VENDOR,
    scan_dir,
    scan_file,
)
from tinymoon.cli import app

REPO = Path(__file__).resolve().parent.parent
FIXTURES = Path(__file__).resolve().parent / "fixtures"

# filename -> exact ordered list of (line, rule-id) the checker must report.
EXPECTED_VIOLATIONS = {
    "external-url.html": [
        (4, EXTERNAL_URL),  # <link href="https://...">
        (5, EXTERNAL_URL),  # <script src="http://...">
        (8, EXTERNAL_URL),  # protocol-relative //host src
        (9, EXTERNAL_URL),  # external candidate inside srcset
    ],
    "external-url.css": [
        (1, EXTERNAL_URL),  # @import url("https://...")
        (2, EXTERNAL_URL),  # @import "//host/..."
        (4, EXTERNAL_URL),  # url("https://...")
        (7, EXTERNAL_URL),  # unquoted url(//host/...)
        (10, EXTERNAL_URL),  # non-w3.org URL embedded in a data: URI
    ],
    "external-url.js": [
        (1, EXTERNAL_URL),  # import ... from "https://..."
        (2, EXTERNAL_URL),  # bare import "//host/..."
        (5, EXTERNAL_URL),  # dynamic import("https://...")
        (6, EXTERNAL_URL),  # fetch("http://...")
    ],
    "native-control.html": [
        (4, NATIVE_CONTROL),  # <select>
        (5, NATIVE_CONTROL),  # <dialog> -- consumer dialog is banned (framework openModal is exempt)
        (6, NATIVE_CONTROL),  # <input type="checkbox">
        (7, NATIVE_CONTROL),  # <input type="radio">
        (8, NATIVE_CONTROL),  # <input type="file">
        (9, NATIVE_CONTROL),  # <input type="text"> -- text is now banned (-> createInput)
    ],
    # Representative new HTML bans: text-like types, range/number/time/date,
    # a native <textarea> element, and a bare typeless <input> (defaults to text).
    "native-input-types.html": [
        (4, NATIVE_CONTROL),   # type="range"
        (5, NATIVE_CONTROL),   # type="text"
        (6, NATIVE_CONTROL),   # type="password"
        (7, NATIVE_CONTROL),   # type="email"
        (8, NATIVE_CONTROL),   # type="url"
        (9, NATIVE_CONTROL),   # type="search"
        (10, NATIVE_CONTROL),  # type="tel"
        (11, NATIVE_CONTROL),  # type="number"
        (12, NATIVE_CONTROL),  # type="time"
        (13, NATIVE_CONTROL),  # type="date"
        (14, NATIVE_CONTROL),  # <textarea>
        (15, NATIVE_CONTROL),  # bare <input> (typeless -> text)
    ],
    # New JS bans: explicit type LITERAL assignments and native <textarea>
    # creation fire; bare el("input")/createElement("input") does NOT (a known
    # JS bypass -- see the checker doctrine header).
    "native-control-js-types.js": [
        (8, NATIVE_CONTROL),   # a.type = "text"
        (10, NATIVE_CONTROL),  # b.setAttribute("type", "email")
        (12, NATIVE_CONTROL),  # c.type = "number"
        (13, NATIVE_CONTROL),  # el("textarea")
        (14, NATIVE_CONTROL),  # createElement("textarea")
        (16, NATIVE_CONTROL),  # r.type = "range"
    ],
    "native-control.js": [
        (3, NATIVE_CONTROL),  # el("select", ...)
        (4, NATIVE_CONTROL),  # createElement("dialog") -- consumer dialog is banned (framework openModal is exempt)
        (6, NATIVE_CONTROL),  # .type = "checkbox"
        (8, NATIVE_CONTROL),  # setAttribute("type", "radio")
    ],
    "title-attr.html": [
        (4, TITLE_ATTR),  # title= on <button>
        (5, TITLE_ATTR),  # title= on <a>
        # line 6 SVG <title> child element must NOT fire
    ],
    "title-attr.js": [
        (4, TITLE_ATTR),  # .title = assignment
        (5, TITLE_ATTR),  # setAttribute("title", ...)
        # line 6 document.title must NOT fire
        (7, TITLE_ATTR),  # mydocument.title = -- only bare `document` is exempt
    ],
    "border-radius.css": [
        (2, BORDER_RADIUS),  # 8px
        (5, BORDER_RADIUS),  # multi-component non-zero
        (14, BORDER_RADIUS),  # longhand border-top-left-radius
        # border-radius: 0 and 0px !important must NOT fire
    ],
    "border-radius.html": [
        (4, BORDER_RADIUS),  # inline style border-radius: 12px
        # line 5 inline border-radius: 0 must NOT fire
    ],
    "border-radius.js": [
        (4, BORDER_RADIUS),  # style.borderRadius = "6px"
        (5, BORDER_RADIUS),  # setProperty("border-radius", "50%")
        # line 7 borderRadius = "0" must NOT fire
    ],
    "raw-color.css": [
        (5, RAW_COLOR),  # #fff in a normal rule
        (6, RAW_COLOR),  # rgba() in a normal rule
        (9, RAW_COLOR),  # hsl()
        (10, RAW_COLOR),  # oklch()
        (14, RAW_COLOR),  # custom property OUTSIDE :root is not the token layer
        # line 2 :root custom property and line 11 var() must NOT fire
    ],
    "raw-color.html": [
        (4, RAW_COLOR),  # inline style hex
        (5, RAW_COLOR),  # inline style rgb()
        # line 6 inline var() must NOT fire
    ],
    "raw-color.js": [
        (4, RAW_COLOR),  # hex string
        (5, RAW_COLOR),  # rgba() string
        (6, RAW_COLOR),  # oklch() string
        # line 7 cssVar() must NOT fire
    ],
    # -- bypass-closure fixtures --
    "external-url-template.js": [
        (4, EXTERNAL_URL),  # import(`https://...`)
        (5, EXTERNAL_URL),  # fetch(`http://...`)
    ],
    "external-url-importmap.html": [
        (4, EXTERNAL_URL),  # "lodash": "https://..." in importmap
    ],
    "external-url-attrs.html": [
        (4, EXTERNAL_URL),  # action="https://..."
        (5, EXTERNAL_URL),  # poster="https://..."
        (6, EXTERNAL_URL),  # formaction="https://..."
        (7, EXTERNAL_URL),  # <object data="https://...">
        (8, EXTERNAL_URL),  # ping URL 1
        (8, EXTERNAL_URL),  # ping URL 2
    ],
    "external-url-ws.js": [
        (1, EXTERNAL_URL),  # new WebSocket("ws://...")
        (2, EXTERNAL_URL),  # new WebSocket("wss://...")
    ],
    "raw-color-extra-fns.css": [
        (1, RAW_COLOR),  # oklab()
        (2, RAW_COLOR),  # lab()
        (3, RAW_COLOR),  # lch()
        (4, RAW_COLOR),  # hwb()
        (5, RAW_COLOR),  # color()
    ],
    # A numeric character reference (&#039;) is NOT a color and must not fire;
    # a genuine hex literal in the same file still does.
    "numeric-entity.js": [
        (4, RAW_COLOR),  # const real = "#0af"; -- line 3 &#039; must NOT fire
    ],
    # -- tm-embed boundary waiver --
    "embed-boundary.html": [
        # line 5 iframe src + title= are INSIDE the data-tm-embed marker and
        # are waived (foreign, off the identity surface).
        (7, EXTERNAL_URL),  # the identical iframe OUTSIDE the marker still fires
    ],
}


def _by_file(violations):
    grouped = {}
    for v in violations:
        grouped.setdefault(Path(v.path).name, []).append((v.line, v.rule))
    return grouped


def test_violation_fixtures_exact():
    """Each fixture reports exactly the expected rule-ids and line numbers."""
    grouped = _by_file(scan_dir(FIXTURES / "violations"))
    assert grouped == EXPECTED_VIOLATIONS


def test_clean_fixtures_report_nothing():
    """Edge cases that must not fire (incl. the allowlisted URL)."""
    assert scan_dir(FIXTURES / "clean") == []


def test_allowlist_is_exact_match_only(tmp_path):
    """A URL differing from the allowlist entry still fires."""
    (tmp_path / "tinymoon-allowlist.txt").write_text(
        "https://allowed.example.com/exactly-this\n"
    )
    # A LOAD attribute (img src), not a navigation -- navigations are always
    # legal, so the allowlist only applies to loads.
    (tmp_path / "page.html").write_text(
        '<img src="https://allowed.example.com/exactly-this/other" alt="x">\n'
    )
    violations = scan_dir(tmp_path)
    assert [(v.line, v.rule) for v in violations] == [(1, EXTERNAL_URL)]


# ---------------------------------------------------------------------------
# raw-color must not match HTML numeric character references (both ways).
# ---------------------------------------------------------------------------


def test_numeric_entity_is_not_a_raw_color(tmp_path):
    """`&#039;` (an apostrophe entity) is NOT the color `#039`: the `#` belongs
    to the `&#` marker. A genuine hex literal in the same file still fires."""
    (tmp_path / "widget.js").write_text(
        'const entity = "It&#039;s fine";\n'      # line 1 -- must NOT fire
        'const also = "Ready&#8217; &#160;";\n'   # line 2 -- must NOT fire
        'const real = "#0af";\n'                  # line 3 -- fires raw-color
    )
    results = [(v.line, v.rule) for v in scan_dir(tmp_path)]
    assert results == [(3, RAW_COLOR)]


# ---------------------------------------------------------------------------
# title-attr: plain-object dot-write false-positives; bracket write is legal.
# ---------------------------------------------------------------------------


def test_plain_object_title_dot_fires_but_bracket_notation_is_legal(tmp_path):
    """The conservative dot regex fires on `fields.title = x` (an unknown
    receiver), a documented false positive. The bracket-notation idiom
    `fields["title"] = x` is the legal workaround for a non-DOM object, while a
    real `element.title = ...` still fires -- detection is not weakened."""
    (tmp_path / "dot.js").write_text('const fields = {};\nfields.title = "x";\n')
    dot = [(v.line, v.rule) for v in scan_dir(tmp_path)]
    assert dot == [(2, TITLE_ATTR)]  # false positive: fires on the plain object

    (tmp_path / "dot.js").unlink()
    (tmp_path / "bracket.js").write_text(
        'const fields = {};\nfields["title"] = "x";\n'  # the legal workaround
        'const el = document.body;\nel.title = "tip";\n'  # real DOM write STILL fires
    )
    bracket = [(v.line, v.rule) for v in scan_dir(tmp_path)]
    assert bracket == [(4, TITLE_ATTR)]


# ---------------------------------------------------------------------------
# Self-conformance: the framework must pass its own checker.
# ---------------------------------------------------------------------------


def test_assets_self_conformance():
    violations = scan_dir(REPO / "assets")
    assert violations == [], "\n".join(
        f"{v.path}:{v.line}: [{v.rule}] {v.message}" for v in violations
    )


def test_gallery_self_conformance():
    violations = scan_dir(REPO / "gallery")
    assert violations == [], "\n".join(
        f"{v.path}:{v.line}: [{v.rule}] {v.message}" for v in violations
    )


# ---------------------------------------------------------------------------
# Framework-own native-control allowance (keyed on LOCATION, not filename).
# ---------------------------------------------------------------------------


def test_framework_own_select_native_control_exempt():
    """tinymoon's own select.js creates the hidden native <select> plainly;
    the framework-own allowance suppresses the native-control rule for it."""
    root = REPO / "assets"
    violations = scan_file(root / "js" / "select.js", root, frozenset())
    assert not any(v.rule == NATIVE_CONTROL for v in violations), (
        "select.js must pass self-conformance without obfuscation: "
        + "; ".join(
            f"{v.line}: {v.message}" for v in violations if v.rule == NATIVE_CONTROL
        )
    )


def test_framework_own_visible_native_inputs_exempt():
    """tinymoon's own styled-native factories create VISIBLE native controls
    with explicit type literals -- createSlider's `range.type = "range"`,
    createNumber's `input.type = "number"`, the datepicker's text input. The
    framework-own allowance (keyed on location) suppresses native-control for
    them, exactly as for the hidden <select>/<dialog>."""
    root = REPO / "assets"
    for module in ("slider.js", "inputs.js", "datepicker.js", "timepicker.js"):
        violations = scan_file(root / "js" / module, root, frozenset())
        assert not any(v.rule == NATIVE_CONTROL for v in violations), (
            f"{module} must pass self-conformance: "
            + "; ".join(
                f"{v.line}: {v.message}"
                for v in violations
                if v.rule == NATIVE_CONTROL
            )
        )


def test_consumer_hidden_and_color_inputs_are_legal(tmp_path):
    """type="hidden" (no identity surface) and type="color" (no replacement
    factory yet -- the ban-ships-its-replacement gate forbids banning it) stay
    legal in consumer code; neither fires native-control."""
    (tmp_path / "page.html").write_text(
        '<input type="hidden" name="t">\n<input type="color" name="c">\n'
    )
    assert scan_dir(tmp_path) == []


def test_consumer_bare_input_html_fires_but_js_bare_input_does_not(tmp_path):
    """A bare <input> in HTML fires (typeless defaults to text), but a bare
    el("input")/createElement("input") in JS does NOT (a known JS bypass:
    the regex cannot see a later type="hidden" assignment)."""
    (tmp_path / "page.html").write_text("<input>\n")
    (tmp_path / "widget.js").write_text(
        'const a = el("input");\nconst b = document.createElement("input");\n'
    )
    results = {(v.path.replace("\\", "/"), v.line, v.rule) for v in scan_dir(tmp_path)}
    assert results == {("page.html", 1, NATIVE_CONTROL)}


def test_consumer_file_named_select_js_still_fires(tmp_path):
    """The allowance is keyed on LOCATION, never filename: a CONSUMER file
    literally named select.js still fires native-control."""
    (tmp_path / "select.js").write_text(
        'const s = document.createElement("select");\n'
    )
    violations = scan_dir(tmp_path)
    assert [(v.line, v.rule) for v in violations] == [(1, NATIVE_CONTROL)]


def test_consumer_el_select_still_fires(tmp_path):
    """Plain el("select") in a consumer file (any name) still fires."""
    (tmp_path / "widget.js").write_text('const s = el("select");\n')
    violations = scan_dir(tmp_path)
    assert [(v.line, v.rule) for v in violations] == [(1, NATIVE_CONTROL)]


# ---------------------------------------------------------------------------
# Provenance by identity: a VERBATIM vendored framework asset is framework-own
# wherever it lives; a MODIFIED copy is scanned normally.
# ---------------------------------------------------------------------------


def test_vendored_framework_file_passes_by_identity(tmp_path):
    """A byte-for-byte vendored copy of a framework module (select.js creates a
    native <select>) is recognized as framework-own by sha256 identity, even in
    a consumer directory, so its native-control pattern is suppressed."""
    src = (REPO / "assets" / "js" / "select.js").read_bytes()
    vendor = tmp_path / "tm" / "vendor" / "select.js"
    vendor.parent.mkdir(parents=True)
    vendor.write_bytes(src)
    violations = scan_dir(tmp_path)
    assert violations == [], "\n".join(
        f"{v.path}:{v.line}: [{v.rule}] {v.message}" for v in violations
    )


def test_modified_vendored_framework_file_fails_normally(tmp_path):
    """Editing even one byte of the vendored copy breaks the hash, so it is no
    longer framework-own and its native-control creation fires normally."""
    src = (REPO / "assets" / "js" / "select.js").read_bytes()
    vendor = tmp_path / "tm" / "vendor" / "select.js"
    vendor.parent.mkdir(parents=True)
    vendor.write_bytes(src + b"\n// consumer edit\n")
    violations = scan_dir(tmp_path)
    assert any(v.rule == NATIVE_CONTROL for v in violations), (
        "a modified vendored copy must be scanned normally (native-control fires)"
    )


def test_identity_allowance_is_not_filename_based(tmp_path):
    """A consumer file NAMED like a framework module but with DIFFERENT bytes is
    not framework-own -- identity is by hash, not by name."""
    imposter = tmp_path / "select.js"
    imposter.write_text('const s = document.createElement("select");\n')
    violations = scan_dir(tmp_path)
    assert [(v.line, v.rule) for v in violations] == [(1, NATIVE_CONTROL)]


# ---------------------------------------------------------------------------
# Vendor quarantine (hash-pinned provenance for third-party files).
# ---------------------------------------------------------------------------

QUARANTINE = FIXTURES / "quarantine"


def test_quarantine_pinned_file_is_exempt():
    """A quarantined file full of charter violations passes when it is pinned
    by sha256 -- the exemption is earned by proving the bytes are unmodified
    third-party code. The clean fixtures include such a file."""
    assert scan_dir(FIXTURES / "clean") == []


def test_quarantine_unpinned_file_no_manifest():
    """(a) A file under third_party/ with no manifest at all is unpinned:
    every file errors, located at the file itself."""
    violations = scan_dir(QUARANTINE / "nomanifest")
    assert [(v.path.replace("\\", "/"), v.line, v.rule) for v in violations] == [
        ("third_party/vendor.css", 1, UNPINNED_VENDOR)
    ]


def test_quarantine_hash_mismatch():
    """(b) A pinned file whose bytes no longer match its sha256 (an edited
    vendored file) is a hard error, located at the file."""
    violations = scan_dir(QUARANTINE / "mismatch")
    assert [(v.path.replace("\\", "/"), v.line, v.rule) for v in violations] == [
        ("third_party/vendor.css", 1, UNPINNED_VENDOR)
    ]


def test_quarantine_missing_pinned_file():
    """(c) A manifest entry pointing at a file that does not exist (a stale
    pin) is a hard error, located at the manifest."""
    violations = scan_dir(QUARANTINE / "missing")
    assert [(v.path.replace("\\", "/"), v.line, v.rule) for v in violations] == [
        ("third_party/PROVENANCE.toml", 1, UNPINNED_VENDOR)
    ]


def test_quarantine_same_file_outside_fires_ordinary_rules():
    """(d) The identical violating vendored file OUTSIDE any third_party/
    directory gets no exemption -- the ordinary rules fire normally."""
    violations = scan_dir(QUARANTINE / "outside")
    assert [(v.path.replace("\\", "/"), v.line, v.rule) for v in violations] == [
        ("vendor.css", 2, RAW_COLOR),
        ("vendor.css", 3, RAW_COLOR),
        ("vendor.css", 4, RAW_COLOR),
        ("vendor.css", 5, BORDER_RADIUS),
    ]


def test_quarantine_rejects_path_traversal():
    """A manifest entry with a traversing (``..``) or absolute path is rejected
    -- the quarantine can never launder a file outside its own directory. The
    properly-pinned sibling in the same manifest stays exempt."""
    violations = scan_dir(QUARANTINE / "traversal")
    assert [(v.path.replace("\\", "/"), v.line, v.rule) for v in violations] == [
        ("third_party/PROVENANCE.toml", 1, UNPINNED_VENDOR)
    ]


def test_quarantine_nested_dir_is_honored(tmp_path):
    """Resolution scope: a third_party/ nested anywhere within the scanned
    tree is honored (with its own PROVENANCE.toml beside it), exactly as a
    top-level one is. Proven by scanning the PARENT root."""
    import hashlib

    vendored = tmp_path / "sub" / "third_party" / "vendor.css"
    vendored.parent.mkdir(parents=True)
    body = ".x { color: #abcdef; border-radius: 9px; }\n"
    vendored.write_text(body)
    digest = hashlib.sha256(body.encode()).hexdigest()
    (vendored.parent / "PROVENANCE.toml").write_text(
        '[[file]]\npath = "vendor.css"\n'
        'origin = "nested vendored asset"\n'
        f'sha256 = "{digest}"\n'
    )
    # A first-party file elsewhere in the tree is still scanned normally.
    (tmp_path / "app.css").write_text(".btn { color: var(--accent); }\n")

    # Scanning the PARENT root honors the nested quarantine (no violations).
    assert scan_dir(tmp_path) == []

    # Editing the pinned file breaks the hash -> the nested quarantine errors
    # even when the scan root is the grandparent.
    vendored.write_text(body + ".y { color: #123456; }\n")
    violations = scan_dir(tmp_path)
    assert [(v.rule) for v in violations] == [UNPINNED_VENDOR]
    assert violations[0].path.replace("\\", "/") == "sub/third_party/vendor.css"


# ---------------------------------------------------------------------------
# CLI behavior
# ---------------------------------------------------------------------------


def test_encoding_error_on_invalid_utf8(tmp_path):
    """A file with invalid UTF-8 emits an encoding-error violation."""
    bad = tmp_path / "bad.js"
    bad.write_bytes(b'const x = "\xff\xfe invalid";\n')
    violations = scan_dir(tmp_path)
    assert [(v.line, v.rule) for v in violations] == [(1, ENCODING_ERROR)]


def test_skip_dirs_notice(tmp_path, capsys):
    """scan_dir with stderr= prints skip notices for SKIP_DIRS entries."""
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "ok.js").write_text("const x = 1;\n")
    scan_dir(tmp_path, stderr=__import__("sys").stderr)
    captured = capsys.readouterr()
    assert "skipping directory node_modules/" in captured.err


def test_cli_exit_zero_and_summary_when_clean():
    result = app.test(["check", "--dir", str(FIXTURES / "clean")])
    assert result.exit_code == 0
    assert "0 violation(s)" in result.stdout


def test_cli_exit_one_and_line_format_on_violations():
    result = app.test(["check", "--dir", str(FIXTURES / "violations")])
    assert result.exit_code == 1
    first = result.stdout.splitlines()[0]
    # path:line: [rule-id] message
    assert ": [" in first and "] " in first
    path_part, rest = first.split(": [", 1)
    assert path_part.rsplit(":", 1)[1].isdigit()
    assert rest.split("] ", 1)[0] in (
        EXTERNAL_URL,
        NATIVE_CONTROL,
        TITLE_ATTR,
        BORDER_RADIUS,
        RAW_COLOR,
        ENCODING_ERROR,
    )


def test_cli_dir_flag_is_required():
    """No implicit default: omitting --dir is a hard parse error."""
    result = app.test(["check"])
    assert result.exit_code != 0


def test_cli_nonexistent_dir_is_an_error():
    result = app.test(["check", "--dir", str(FIXTURES / "does-not-exist")])
    assert result.exit_code == 2
