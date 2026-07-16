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
    scan_dir,
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
        # line 5 <dialog> is permitted (used by the framework's modal)
        (6, NATIVE_CONTROL),  # <input type="checkbox">
        (7, NATIVE_CONTROL),  # <input type="radio">
        (8, NATIVE_CONTROL),  # <input type="file">
        # line 9 <input type="text"> must NOT fire
    ],
    "native-control.js": [
        (3, NATIVE_CONTROL),  # el("select", ...)
        # line 4 createElement("dialog") is permitted (used by the framework's modal)
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
