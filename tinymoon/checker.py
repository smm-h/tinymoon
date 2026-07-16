"""tinymoon conformance rule engine.

The checker guards tinymoon's IDENTITY SURFACE: the first-party bytes that
render the framework's identity -- the HTML, CSS, JS, and fonts a page ships
and paints. Every rule quantifies over RESOURCE LOADS (bytes fetched into the
page) and RENDERED STYLING (how those bytes look), never over NAVIGATIONS. A
navigation is a plain hyperlink the user may follow (<a href>, <area href>);
it leaves or opens elsewhere and fetches nothing into the current page, so it
was never a purity violation. Provenance -- whether bytes are first- or
third-party -- is modeled by exactly ONE construct: the tm-embed BOUNDARY
CONTRACT (below). Outside a marked boundary, every load the checker sees is
treated as identity-surface bytes and must be vendored into the repo.

Scans .html, .css, and .js files. Five rules, each a hard error -- there is
no warning mode and no bypass:

- external-url:  no external RESOURCE LOADS (http://, https://, ws://, wss://,
  or protocol-relative //host URLs). Banned in HTML load attributes
  (src/poster/srcset/ping, <object data=>, and href on any element OTHER
  than <a>/<area>), in form submission targets (action/formaction -- a
  submission ships user data off-origin, a load-class concern), in CSS
  url()/@import, in JS import specifiers or string literals passed to
  fetch()/import()/new WebSocket() (including template literals), and in
  <script type="importmap"> JSON. LEGAL, never a violation: href on <a> and
  <area> -- these are navigations, not loads, and need no allowlist.
  Exceptions: XML namespace identifiers (xmlns/xmlns:* attributes, and
  http(s)://www.w3.org/... identifiers inside data: URIs), URLs inside
  comments, and URLs in plain HTML prose. An optional allowlist file
  (tinymoon-allowlist.txt at the scanned dir root, one exact URL per
  line, # comments allowed) exempts exact matches.
- native-control: no <select> or <input type=checkbox|radio|file> in HTML,
  and no JS creation of the same (el("select"...), createElement("select"),
  .type = "checkbox" assignments, setAttribute("type", "radio"), ...).
  <dialog> is permitted (used internally by the framework's modal).
- title-attr: no title= attributes in HTML (SVG <title> child ELEMENTS are
  fine -- only the attribute is banned), and no JS `.title =` /
  setAttribute("title", ...) on elements. `document.title` is the page
  title, not an element tooltip, and is exempt. Non-DOM receivers (route,
  config, options, etc.) are also exempt.
- border-radius: no border-radius (or borderRadius in JS) with a value
  other than 0/0px -- in CSS rules, inline style= attributes, or JS style
  assignments (including setProperty("border-radius", ...)).
- raw-color: no color literals -- hex (#fff, #ffffff, 4/8-digit),
  rgb()/rgba()/hsl()/hsla()/oklch()/oklab()/lab()/lch()/hwb()/color() --
  anywhere except CSS custom-property definitions inside `:root { }` or
  `html[data-theme="..."] { }` blocks (the token layer). Banned in all
  other CSS rules, in inline styles, and in all JS (canvas code must go
  through cssVar()). var(...) references, currentColor, transparent, and
  inherit are always fine. JS private fields (#name) and location.hash
  fragments are stripped before checking. Known limitation: named CSS
  colors (red, papayawhip, ...) are NOT checked -- matching them produces
  too many false positives on ordinary words.

The tm-embed BOUNDARY CONTRACT (provenance in HTML source):
  A `createEmbed` container carries the static marker attribute
  ``data-tm-embed`` (and the class ``tm-embed``). It renders a FOREIGN
  network surface (a sandboxed <iframe>: maps, dashboards, OAuth pages) or
  foreign DOM/CSS (a shadow root hosting vendored library UI). That content
  is provably OFF the identity surface: the sandbox/shadow isolation means it
  neither paints the framework's identity nor inherits its tokens.

  Inside the HTML subtree ROOTED at a ``data-tm-embed`` element (the marked
  element itself plus every descendant), the checker WAIVES external-url (the
  iframe src) and the four styling rules (border-radius, raw-color,
  title-attr, native-control). The waiver is scoped to that subtree in HTML
  source ONLY. It does NOT extend to .js or .css files -- provenance inside
  scripts and stylesheets is a separate, later mechanism; today a raw color
  or external URL in a .js/.css file is always a violation, even in code that
  builds embed content.

  ABUSE IS SELF-DEFEATING. Wrapping FIRST-PARTY UI in a ``data-tm-embed``
  makes the checker pass, but the wrapped UI stops working: a sandboxed
  iframe severs its scripts, storage, and same-origin access; a shadow root
  severs style inheritance so the identity tokens never reach it. The boundary
  is a promise that the content is foreign and isolated -- claiming it for
  first-party UI only breaks that UI. The checker does not police this because
  the isolation mechanics already punish the abuser; the abuse fixture
  documents it (tests/fixtures/clean/embed-abuse.html).

The FRAMEWORK-OWN allowance (native-control in tinymoon's own modules):
  tinymoon's own shipped modules legitimately create the hidden native
  <select> that backs createSelect (form participation). The checker
  suppresses its JS native-control patterns for files whose resolved path
  lies WITHIN tinymoon's own packaged assets directory -- the same location
  assets_path() returns (REPO/assets when self-scanning the source repo, the
  installed ``tinymoon/assets`` when scanning a wheel). The allowance is keyed
  on LOCATION, never on filename: a consumer file named ``select.js`` never
  qualifies. This is why select.js can write ``document.createElement("select")``
  plainly instead of obfuscating it past the scanner.

The VENDOR QUARANTINE (provenance for whole third-party FILES):
  The tm-embed boundary types provenance INSIDE HTML source. The quarantine
  is the second, file-level provenance mechanism: a consumer sometimes must
  vendor a third-party FILE verbatim -- a foreign stylesheet or script they
  did not write and cannot rewrite to obey the charter (rounded corners, raw
  colors, a native control). Rewriting it would fork it; leaving it in the
  tree would fail the checker.

  The quarantine resolves this WITHOUT a bypass flag. A directory named
  ``third_party`` (the fixed conventional name -- no configuration, conventions
  over options) is a PROVENANCE-TYPED EXCLUSION zone. Files inside it are
  exempt from all five rules IF AND ONLY IF a manifest at
  ``third_party/PROVENANCE.toml`` (beside the files) pins each one by its
  relative path, an informational upstream origin, and a sha256 of its exact
  bytes. The exemption is EARNED by proving the bytes are unmodified
  third-party code: the hash is the proof. First-party code cannot hide here,
  because the moment you edit a quarantined file to make it yours the sha256
  stops matching and the pin breaks -- editing is exactly what the pin
  forbids. The manifest can only pin files INSIDE the directory: absolute
  paths and ``..`` traversal in an entry are rejected, so the quarantine can
  never launder a file elsewhere in the tree.

  Every deviation is a HARD ERROR under the ``unpinned-vendor`` rule -- no
  warnings, no bypass:
    - a file present under ``third_party/`` with no manifest entry (including
      the case of NO manifest at all: then every file is unpinned);
    - a manifest entry whose file is missing (a stale pin);
    - a hash mismatch (the vendored file was edited);
    - a manifest entry with an absolute or traversing path.
  The manifest schema is ``[[file]]`` array-of-tables with string ``path``
  (relative to the quarantine directory), ``origin``, and ``sha256`` keys.

  RESOLUTION SCOPE: the quarantine is resolved relative to EACH scanned root,
  and any ``third_party`` directory NESTED anywhere within a scanned tree is
  ALSO honored, provided its own ``PROVENANCE.toml`` sits beside it. Scanning
  a repo root therefore honors a ``gallery/third_party`` inside it exactly as
  scanning ``gallery`` directly honors its top-level ``third_party``.

Known bypasses remaining for future work:
- HTML-in-JS-strings: innerHTML/insertAdjacentHTML string content is not
  parsed as HTML, so embedded URLs, native controls, title attributes,
  etc. in those strings are invisible to the checker.
- CSS var() resolution: the checker cannot trace var(--x) to its
  definition, so a custom property holding a raw color used in a non-token
  context is not caught.
- JS string concatenation: URLs built from string concatenation
  ("https://" + host) are not detected.
- eval/Function: dynamically constructed code is not analyzed.
"""

import hashlib
import json
import re
import tomllib
import urllib.parse
from bisect import bisect_right
from dataclasses import dataclass
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath, PureWindowsPath

# Rule ids
EXTERNAL_URL = "external-url"
NATIVE_CONTROL = "native-control"
TITLE_ATTR = "title-attr"
BORDER_RADIUS = "border-radius"
RAW_COLOR = "raw-color"
ENCODING_ERROR = "encoding-error"
UNPINNED_VENDOR = "unpinned-vendor"

SKIP_DIRS = {"node_modules", ".git", ".venv", "__pycache__", "dist"}
SOURCE_EXTS = {".html", ".css", ".js"}
ALLOWLIST_FILENAME = "tinymoon-allowlist.txt"

# Vendor quarantine: a conventionally-named directory whose contents are
# THIRD-PARTY bytes a consumer vendors verbatim and cannot rewrite (foreign
# CSS/JS). Files under it are excluded from rule scanning only when their exact
# bytes are pinned in the provenance manifest that sits beside them. See the
# VENDOR QUARANTINE section of the module docstring.
QUARANTINE_DIRNAME = "third_party"
PROVENANCE_FILENAME = "PROVENANCE.toml"
_SHA256_RE = re.compile(r"[0-9a-fA-F]{64}")

_BANNED_INPUT_TYPES = ("checkbox", "radio", "file")

# HTML attribute load/navigation semantics -- the single source of truth for
# which attributes are RESOURCE LOADS (subject to external-url) and on which
# elements. Consumed by _HTMLScanner._check_tag (the scanner) and mirrored
# verbatim into the portable rules.json artifact by
# scripts/gen_conformance_json.py, so the scanner and the artifact can never
# diverge.
#
# `href` is a load on every element EXCEPT the navigation elements below: on
# <a> and <area> it is a hyperlink the user FOLLOWS (a NAVIGATION), which
# fetches nothing into the current page and is always legal.
NAV_HREF_TAGS = ("a", "area")
# Single-URL load attributes -- a load on ANY element that carries them. `src`
# fetches bytes; `action`/`formaction` ship user data off-origin on submit
# (a load-class concern); `poster` fetches a video still.
SINGLE_URL_LOAD_ATTRS = ("src", "action", "poster", "formaction")
# Element-scoped load attributes: attr -> the tags on which it is a load.
ELEMENT_SCOPED_LOAD_ATTRS = {"data": ("object",)}
# Whitespace-separated URL list attributes (each token is a load).
SPACE_LIST_LOAD_ATTRS = ("ping",)
# srcset-style attributes: a comma-separated candidate list; the first token of
# each candidate is the URL (the rest is a density/width descriptor).
SRCSET_LOAD_ATTRS = ("srcset",)

# The static marker attribute that roots a tm-embed isolation boundary in HTML
# source. See the BOUNDARY CONTRACT section of the module docstring.
TM_EMBED_MARKER = "data-tm-embed"

# HTML void elements never have an end tag and root no subtree, so they are
# not tracked on the element stack that scopes the boundary waiver.
_VOID_TAGS = frozenset({
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
})


@lru_cache(maxsize=1)
def _framework_assets_root():
    """Resolve tinymoon's OWN packaged assets directory (the same location
    assets_path() returns), or None if it cannot be located. Cached: the
    package location does not change within a process."""
    try:
        from . import assets_path

        return assets_path().resolve()
    except Exception:
        return None


def _is_framework_own(path):
    """True if ``path`` resolves to a file inside tinymoon's own packaged
    assets directory. Keyed on LOCATION, not filename -- a consumer file never
    qualifies, whatever it is named."""
    root = _framework_assets_root()
    if root is None:
        return False
    try:
        Path(path).resolve().relative_to(root)
        return True
    except (ValueError, OSError):
        return False


# The framework ships a portable conformance CORPUS -- fixture data with
# DELIBERATE rule violations, plus rules.json/expectations.json -- under its own
# packaged assets at ``<assets>/conformance`` (see
# scripts/gen_conformance_json.py). That corpus is a self-conformance test
# payload for reimplementations, NOT identity surface, so scanning the framework
# assets from above must not fail on the corpus's intentional violations --
# exactly as tests/fixtures/ is simply never scanned as identity surface. The
# treatment mirrors the framework-own native-control allowance: keyed on
# LOCATION (the framework's own packaged assets), never on the directory name,
# so a consumer's same-named ``conformance/`` directory is scanned normally and
# can never become a bypass.
CONFORMANCE_DIRNAME = "conformance"


@lru_cache(maxsize=1)
def _framework_conformance_root():
    """Resolve tinymoon's OWN packaged conformance corpus directory
    (``<assets>/conformance``), or None if the assets root cannot be located."""
    root = _framework_assets_root()
    if root is None:
        return None
    return root / CONFORMANCE_DIRNAME


def _is_within(path, base):
    """True if ``path`` is ``base`` itself or lies inside it (resolved)."""
    try:
        Path(path).resolve().relative_to(Path(base).resolve())
        return True
    except (ValueError, OSError):
        return False


def _skip_conformance(root):
    """Whether to skip the framework's own conformance corpus for this scan.

    The corpus is skipped only when the scan ``root`` is ABOVE it (e.g. a
    self-scan of ``assets``). When the corpus, or a scan root within it, is the
    EXPLICIT target, it is scanned normally so reimplementations and the sync
    tests can run the rules over the fixtures. Returns the corpus root to skip,
    or None."""
    conf_root = _framework_conformance_root()
    if conf_root is None or _is_within(root, conf_root):
        return None
    return conf_root


@dataclass(frozen=True, order=True)
class Violation:
    """One rule violation at a specific file location.

    ``path`` is relative to the scanned root.
    """

    path: str
    line: int
    rule: str
    message: str


# ---------------------------------------------------------------------------
# Shared: external-URL logic and color regexes
# ---------------------------------------------------------------------------

_EXTERNAL_RE = re.compile(r"^(?:https?:|wss?:)?//")
_EMBEDDED_URL_RE = re.compile(r"""https?://[^\s"'<>()\\]+""")
_W3_PREFIXES = ("http://www.w3.org/", "https://www.w3.org/")

_HEX_COLOR_RE = re.compile(r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b")
_COLOR_FN_RE = re.compile(r"\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\s*\(")

_CSS_URL_FN_RE = re.compile(
    r"""url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s][^)]*))\s*\)""", re.IGNORECASE
)
_CSS_IMPORT_RE = re.compile(
    r"""@import\s+(?:url\(\s*)?["']?([^"')\s;]+)""", re.IGNORECASE
)
_BORDER_RADIUS_PROP_RE = re.compile(r"(?:-\w+-)?border[a-zA-Z-]*radius")


def _check_external_url(url, line, path, allowlist, out):
    """Append an external-url violation if ``url`` would cause a network load."""
    url = url.strip()
    if not url or url in allowlist:
        return
    if url.startswith("data:"):
        # data: URIs are not network loads themselves, but may embed URLs
        # that are (e.g. an <image href> inside an SVG data URI). XML
        # namespace identifiers (www.w3.org) are identifiers, not loads.
        decoded = urllib.parse.unquote(url)
        for m in _EMBEDDED_URL_RE.finditer(decoded):
            u = m.group(0)
            if u.startswith(_W3_PREFIXES):
                continue
            out.append(
                Violation(
                    path,
                    line,
                    EXTERNAL_URL,
                    f'external URL "{u}" embedded in data: URI'
                    " -- vendor the resource into the repo",
                )
            )
        return
    if _EXTERNAL_RE.match(url):
        out.append(
            Violation(
                path,
                line,
                EXTERNAL_URL,
                f'external URL "{url}" -- vendor the resource into the repo',
            )
        )


def _radius_value_ok(value):
    """True if a border-radius value is 0 in every component."""
    value = re.sub(r"!\s*important\s*$", "", value.strip(), flags=re.IGNORECASE)
    value = value.strip()
    if value == "":
        return True  # e.g. style.borderRadius = "" (a reset)
    tokens = [t for t in re.split(r"[\s/]+", value) if t]
    return all(t in ("0", "0px") for t in tokens)


def _check_declaration(prop, value, line, path, exempt, allowlist, out):
    """Check one CSS declaration (from a stylesheet or an inline style=).

    ``exempt`` is True when the declaration lives in a token-layer block
    (:root or html[data-theme=...]) -- only custom properties there may
    hold raw colors.
    """
    prop = prop.strip()
    value = value.strip()
    for m in _CSS_URL_FN_RE.finditer(value):
        url = next(g for g in m.groups() if g is not None)
        _check_external_url(url, line, path, allowlist, out)
    if _BORDER_RADIUS_PROP_RE.fullmatch(prop) and not _radius_value_ok(value):
        out.append(
            Violation(
                path,
                line,
                BORDER_RADIUS,
                f'"{prop}: {value}" -- corners are sharp; only 0/0px is allowed',
            )
        )
        return
    if exempt and prop.startswith("--"):
        return
    # Strip url(...) spans so encoded data-URI payloads and #fragment
    # references never masquerade as color literals.
    color_scope = _CSS_URL_FN_RE.sub(" ", value)
    m = _HEX_COLOR_RE.search(color_scope) or _COLOR_FN_RE.search(color_scope)
    if m:
        literal = m.group(0).rstrip("(").strip()
        out.append(
            Violation(
                path,
                line,
                RAW_COLOR,
                f'raw color literal "{literal}" in "{prop}"'
                " -- route colors through design tokens (var(--...))",
            )
        )


# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

_TOKEN_BLOCK_RE = re.compile(
    r""":root|html\[data-theme=("[^"]*"|'[^']*')\]"""
)


def _is_token_selector(selector):
    return _TOKEN_BLOCK_RE.fullmatch(selector.strip()) is not None


def _strip_css_comments(text):
    """Replace /* ... */ comments with spaces, preserving line structure."""
    out = []
    i, n = 0, len(text)
    while i < n:
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            end = n if j == -1 else j + 2
            out.append("".join("\n" if c == "\n" else " " for c in text[i:end]))
            i = end
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def scan_css(text, path, allowlist, line_offset=0):
    """Scan CSS source; returns a list of Violations."""
    out = []
    text = _strip_css_comments(text)
    stack = []  # selector / at-rule prelude per open block
    buf = []
    buf_line = None
    line = 1
    quote = None  # inside a "..." or '...' string
    parens = 0  # inside url(...) etc. -- ; { } are literal there

    def flush_statement():
        nonlocal buf, buf_line
        stmt = "".join(buf).strip()
        stmt_line = (buf_line or line) + line_offset
        buf = []
        buf_line = None
        if not stmt:
            return
        if stmt.lower().startswith("@import"):
            m = _CSS_IMPORT_RE.match(stmt)
            if m:
                _check_external_url(m.group(1), stmt_line, path, allowlist, out)
            return
        if stmt.startswith("@"):
            return  # other at-statements (@charset, @namespace, ...)
        if ":" not in stmt:
            return
        prop, value = stmt.split(":", 1)
        exempt = bool(stack) and _is_token_selector(stack[-1])
        _check_declaration(prop, value, stmt_line, path, exempt, allowlist, out)

    for ch in text:
        if ch == "\n":
            line += 1
        if quote is not None:
            buf.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
            buf.append(ch)
            continue
        if ch == "(":
            parens += 1
        elif ch == ")" and parens:
            parens -= 1
        if parens == 0 and ch == "{":
            stack.append("".join(buf).strip())
            buf = []
            buf_line = None
        elif parens == 0 and ch == "}":
            flush_statement()
            if stack:
                stack.pop()
        elif parens == 0 and ch == ";":
            flush_statement()
        else:
            if buf_line is None and not ch.isspace():
                buf_line = line
            buf.append(ch)
    flush_statement()
    return out


# ---------------------------------------------------------------------------
# JS
# ---------------------------------------------------------------------------


def _strip_js_comments(text):
    """Blank out // and /* */ comments, preserving strings and line structure."""
    out = []
    i, n = 0, len(text)
    state = "code"  # code | squote | dquote | template | line | block
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if state == "code":
            if c == "/" and nxt == "/":
                state = "line"
                out.append("  ")
                i += 2
                continue
            if c == "/" and nxt == "*":
                state = "block"
                out.append("  ")
                i += 2
                continue
            if c == "'":
                state = "squote"
            elif c == '"':
                state = "dquote"
            elif c == "`":
                state = "template"
            out.append(c)
            i += 1
            continue
        if state == "line":
            if c == "\n":
                state = "code"
                out.append(c)
            else:
                out.append(" ")
            i += 1
            continue
        if state == "block":
            if c == "*" and nxt == "/":
                state = "code"
                out.append("  ")
                i += 2
                continue
            out.append("\n" if c == "\n" else " ")
            i += 1
            continue
        # inside a string / template literal
        if c == "\\":
            out.append(c)
            if nxt:
                out.append(nxt)
            i += 2
            continue
        if (
            (state == "squote" and c == "'")
            or (state == "dquote" and c == '"')
            or (state == "template" and c == "`")
        ):
            state = "code"
        elif c == "\n" and state in ("squote", "dquote"):
            state = "code"  # unterminated string: recover
        out.append(c)
        i += 1
    return "".join(out)


_JS_FROM_SPEC_RE = re.compile(r"""\bfrom\s*(["'])([^"']+)\1""")
_JS_BARE_IMPORT_RE = re.compile(r"""\bimport\s*(["'])([^"']+)\1""")
_JS_CALL_URL_RE = re.compile(r"""\b(?:import|fetch)\s*\(\s*(["'])([^"']+)\1""")
_JS_CALL_TEMPLATE_URL_RE = re.compile(r"""\b(?:import|fetch)\s*\(\s*`([^`]*)`""")
_JS_WEBSOCKET_URL_RE = re.compile(
    r"""\bWebSocket\s*\(\s*(["'])([^"']+)\1"""
)

_JS_EL_NATIVE_RE = re.compile(r"""\bel\s*\(\s*(["'])(select)\1""")
_JS_CREATE_NATIVE_RE = re.compile(
    r"""\bcreateElement\s*\(\s*(["'])(select)\1""", re.IGNORECASE
)
_JS_TYPE_ASSIGN_RE = re.compile(
    r"""\.\s*type\s*=(?!=)\s*(["'])(checkbox|radio|file)\1"""
)
_JS_TYPE_SETATTR_RE = re.compile(
    r"""\bsetAttribute\s*\(\s*(["'])type\1\s*,\s*(["'])(checkbox|radio|file)\2"""
)

# Captures the trailing receiver identifier (greedy, so a leftmost match
# always grabs the whole identifier -- "mydocument" never matches as
# "document"). The exemption logic is in scan_js: `document` (page title)
# and non-DOM-looking receivers (route, config, options, etc.) are exempt.
_JS_TITLE_ASSIGN_RE = re.compile(r"""([\w$]*)\s*\.\s*title\s*=(?!=)""")
_JS_TITLE_SETATTR_RE = re.compile(r"""\bsetAttribute\s*\(\s*(["'])title\1""")

# Receivers whose .title assignment is NOT a DOM tooltip. The set covers
# common non-element variable names. The heuristic: if a receiver is
# `document` (page title), starts with one of the DOM prefixes below, or
# its identifier is NOT in this exclusion set, it fires the rule. This
# is intentionally conservative -- unknown receivers fire the rule.
_NON_DOM_TITLE_RECEIVERS = frozenset({
    "route", "config", "options", "opts", "settings", "meta",
    "item", "entry", "record", "row", "page", "tab", "section",
    "breadcrumb", "crumb", "nav", "menu", "menuItem", "menuitem",
    "chart", "series", "dataset", "column", "field", "header",
    "window",  # window.title is not a DOM attribute
})

# Patterns for stripping JS private fields and location.hash assignments
# before scanning for raw hex colors (avoids false positives).
_JS_PRIVATE_FIELD_RE = re.compile(r"#[a-zA-Z_$][\w$]*")
_JS_LOCATION_HASH_RE = re.compile(
    r"""location\s*\.\s*hash\s*=\s*(?:(["'`]).*?\1|[^;\n]+)"""
)

_JS_BR_ASSIGN_RE = re.compile(
    r"""\bborderRadius\s*[:=](?!=)\s*(?:(["'`])\s*([^"'`]*)\1|([^;,\n})]+))"""
)
_JS_BR_SETPROP_RE = re.compile(
    r"""\bsetProperty\s*\(\s*(["'])border-radius\1\s*,\s*"""
    r"""(?:(["'`])\s*([^"'`]*)\2|([^,)\n]+))"""
)


def scan_js(text, path, allowlist, line_offset=0, framework_own=False):
    """Scan JS source; returns a list of Violations.

    ``framework_own`` is True when the file lives inside tinymoon's own
    packaged assets (see _is_framework_own). For those files the native-control
    patterns are suppressed: the framework legitimately creates the hidden
    native <select> that backs createSelect. All other rules still apply.
    """
    out = []
    src = _strip_js_comments(text)
    line_starts = [0]
    for i, c in enumerate(src):
        if c == "\n":
            line_starts.append(i + 1)

    def line_of(offset):
        return bisect_right(line_starts, offset) + line_offset

    for pat in (
        _JS_FROM_SPEC_RE, _JS_BARE_IMPORT_RE, _JS_CALL_URL_RE,
        _JS_WEBSOCKET_URL_RE,
    ):
        for m in pat.finditer(src):
            _check_external_url(m.group(2), line_of(m.start()), path, allowlist, out)
    for m in _JS_CALL_TEMPLATE_URL_RE.finditer(src):
        _check_external_url(m.group(1), line_of(m.start()), path, allowlist, out)

    # Native-control creation is suppressed for tinymoon's own shipped modules
    # (framework_own): they legitimately create the hidden native <select> that
    # backs createSelect. Consumer files always fire.
    if not framework_own:
        for pat, what in (
            (_JS_EL_NATIVE_RE, lambda m: m.group(2)),
            (_JS_CREATE_NATIVE_RE, lambda m: m.group(2)),
        ):
            for m in pat.finditer(src):
                out.append(
                    Violation(
                        path,
                        line_of(m.start()),
                        NATIVE_CONTROL,
                        f"JS creates a native <{what(m)}>"
                        " -- use the framework's own primitives",
                    )
                )
        for m in _JS_TYPE_ASSIGN_RE.finditer(src):
            out.append(
                Violation(
                    path,
                    line_of(m.start()),
                    NATIVE_CONTROL,
                    f'JS sets input type "{m.group(2)}"'
                    " -- use the framework's own primitives",
                )
            )
        for m in _JS_TYPE_SETATTR_RE.finditer(src):
            out.append(
                Violation(
                    path,
                    line_of(m.start()),
                    NATIVE_CONTROL,
                    f'JS sets input type "{m.group(3)}"'
                    " -- use the framework's own primitives",
                )
            )

    for m in _JS_TITLE_ASSIGN_RE.finditer(src):
        receiver = m.group(1)
        # document.title is the page title, not an element tooltip -- exempt,
        # but only when the receiver is exactly the identifier `document`
        # (identifiers merely ending in "document", or `foo.document`, fire).
        if receiver == "document" and (
            m.start() == 0 or src[m.start() - 1] != "."
        ):
            continue
        # Non-DOM receivers: variable names that are clearly not DOM
        # elements (route.title, config.title, etc.) are exempt.
        if receiver in _NON_DOM_TITLE_RECEIVERS:
            continue
        out.append(
            Violation(
                path,
                line_of(m.start()),
                TITLE_ATTR,
                "JS assigns .title on an element"
                " -- use the tooltip primitive (data-tooltip) instead",
            )
        )
    for m in _JS_TITLE_SETATTR_RE.finditer(src):
        out.append(
            Violation(
                path,
                line_of(m.start()),
                TITLE_ATTR,
                'JS calls setAttribute("title", ...)'
                " -- use the tooltip primitive (data-tooltip) instead",
            )
        )

    for m in _JS_BR_ASSIGN_RE.finditer(src):
        value = m.group(2) if m.group(2) is not None else m.group(3)
        if not _radius_value_ok(value):
            out.append(
                Violation(
                    path,
                    line_of(m.start()),
                    BORDER_RADIUS,
                    f'JS sets borderRadius to "{value.strip()}"'
                    " -- corners are sharp; only 0/0px is allowed",
                )
            )
    for m in _JS_BR_SETPROP_RE.finditer(src):
        value = m.group(3) if m.group(3) is not None else m.group(4)
        if not _radius_value_ok(value):
            out.append(
                Violation(
                    path,
                    line_of(m.start()),
                    BORDER_RADIUS,
                    f'JS sets border-radius to "{value.strip()}"'
                    " -- corners are sharp; only 0/0px is allowed",
                )
            )

    # Strip private field references (this.#face, #deed) and location.hash
    # assignments (location.hash = "#abc123") before scanning for raw hex
    # colors -- these are not color literals.
    color_src = _JS_PRIVATE_FIELD_RE.sub(lambda m: " " * len(m.group(0)), src)
    color_src = _JS_LOCATION_HASH_RE.sub(
        lambda m: " " * len(m.group(0)), color_src
    )
    for pat in (_HEX_COLOR_RE, _COLOR_FN_RE):
        for m in pat.finditer(color_src):
            literal = m.group(0).rstrip("(").strip()
            out.append(
                Violation(
                    path,
                    line_of(m.start()),
                    RAW_COLOR,
                    f'raw color literal "{literal}" in JS'
                    " -- read colors from the token layer via cssVar()",
                )
            )
    return out


# ---------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------


class _HTMLScanner(HTMLParser):
    """Streams a document, applying attribute/tag rules and delegating
    <style>/<script> content to the CSS/JS scanners."""

    def __init__(self, path, allowlist, out, framework_own=False):
        super().__init__(convert_charrefs=True)
        self._path = path
        self._allowlist = allowlist
        self._out = out
        self._framework_own = framework_own
        self._container = None  # "style" | "script" | "importmap" | None
        # Element stack of (tagname, is_embed_boundary) for non-void tags, and
        # the count of currently-open tm-embed boundaries. When _embed_depth is
        # positive the parser is inside a marked subtree and all violations are
        # waived (the content is off the identity surface).
        self._tag_stack = []
        self._embed_depth = 0

    # -- tags ---------------------------------------------------------------

    def handle_starttag(self, tag, attrs):
        has_embed = any(name.lower() == TM_EMBED_MARKER for name, _ in attrs)
        # The marked element itself is waived, as is anything already inside a
        # boundary. Compute suppression BEFORE pushing so the marker's own
        # attributes (e.g. the iframe src it sits on) are waived too.
        suppressed = self._embed_depth > 0 or has_embed
        self._check_tag(tag, attrs, suppressed)
        tagl = tag.lower()
        if tagl not in _VOID_TAGS:
            if has_embed:
                self._embed_depth += 1
            self._tag_stack.append((tagl, has_embed))
        if tagl == "style":
            self._container = "style"
        elif tagl == "script":
            d = {k.lower(): (v or "") for k, v in attrs}
            if "src" in d:
                return
            t = d.get("type", "").lower()
            if t == "importmap":
                self._container = "importmap"
            elif t in ("", "module") or "javascript" in t:
                self._container = "script"

    def handle_startendtag(self, tag, attrs):
        # A self-closing element roots no subtree; only its own attributes are
        # waived when it carries (or sits inside) a boundary marker.
        has_embed = any(name.lower() == TM_EMBED_MARKER for name, _ in attrs)
        suppressed = self._embed_depth > 0 or has_embed
        self._check_tag(tag, attrs, suppressed)

    def handle_endtag(self, tag):
        tagl = tag.lower()
        if tagl in ("style", "script"):
            self._container = None  # clears style, script, and importmap
        # Pop the element stack back to the matching open tag, closing every
        # embed boundary that unwinds with it.
        for i in range(len(self._tag_stack) - 1, -1, -1):
            name, _is_embed = self._tag_stack[i]
            if name == tagl:
                for _, was_embed in self._tag_stack[i:]:
                    if was_embed:
                        self._embed_depth -= 1
                del self._tag_stack[i:]
                break

    def _check_tag(self, tag, attrs, suppressed):
        line = self.getpos()[0]
        tag = tag.lower()
        # Collect this element's violations into a local buffer. If the element
        # is inside a tm-embed boundary, the buffer is discarded (waived).
        local = []
        attr_map = {}
        for name, value in attrs:
            lname = name.lower()
            value = value or ""
            attr_map.setdefault(lname, value)
            if lname == "title":
                local.append(
                    Violation(
                        self._path,
                        line,
                        TITLE_ATTR,
                        f'title= attribute on <{tag}>'
                        " -- use the tooltip primitive (data-tooltip) instead",
                    )
                )
                continue
            if lname == "xmlns" or lname.startswith("xmlns:"):
                continue  # namespace identifiers, not loads
            if lname == "style":
                self._scan_inline_style(value, line, local)
                continue
            # RESOURCE-LOAD attributes (external-url). The semantics -- which
            # attributes are loads, on which elements -- come from the shared
            # constants above so the scanner and the rules.json artifact can
            # never drift apart.
            if lname == "href":
                # A NAVIGATION on <a>/<area> (a hyperlink the user follows),
                # a load on every other element (<link>, SVG <use>, ...).
                if tag not in NAV_HREF_TAGS:
                    _check_external_url(
                        value, line, self._path, self._allowlist, local
                    )
            elif lname in SINGLE_URL_LOAD_ATTRS:
                _check_external_url(
                    value, line, self._path, self._allowlist, local
                )
            elif (
                lname in ELEMENT_SCOPED_LOAD_ATTRS
                and tag in ELEMENT_SCOPED_LOAD_ATTRS[lname]
            ):
                _check_external_url(
                    value, line, self._path, self._allowlist, local
                )
            elif lname in SPACE_LIST_LOAD_ATTRS:
                for url in value.split():
                    _check_external_url(
                        url, line, self._path, self._allowlist, local
                    )
            elif lname in SRCSET_LOAD_ATTRS:
                for candidate in value.split(","):
                    candidate = candidate.strip()
                    if not candidate:
                        continue
                    url = candidate.split()[0]
                    _check_external_url(
                        url, line, self._path, self._allowlist, local
                    )
        if tag == "select":
            local.append(
                Violation(
                    self._path,
                    line,
                    NATIVE_CONTROL,
                    f"native <{tag}> -- use the framework's own primitives",
                )
            )
        elif tag == "input" and attr_map.get("type", "").lower() in _BANNED_INPUT_TYPES:
            local.append(
                Violation(
                    self._path,
                    line,
                    NATIVE_CONTROL,
                    f'native <input type="{attr_map["type"].lower()}">'
                    " -- use the framework's own primitives",
                )
            )
        if not suppressed:
            self._out.extend(local)

    def _scan_inline_style(self, style_text, line, out):
        for decl in style_text.split(";"):
            if ":" not in decl:
                continue
            prop, value = decl.split(":", 1)
            _check_declaration(
                prop, value, line, self._path, False, self._allowlist, out
            )

    # -- content ------------------------------------------------------------

    def handle_data(self, data):
        # Content inside a tm-embed boundary is off the identity surface --
        # foreign iframe/shadow bytes -- so inline <style>/<script>/importmap
        # blocks there are waived too.
        if self._embed_depth > 0:
            return
        if self._container == "style":
            offset = self.getpos()[0] - 1
            self._out.extend(
                scan_css(data, self._path, self._allowlist, line_offset=offset)
            )
        elif self._container == "importmap":
            self._scan_importmap(data)
        elif self._container == "script":
            offset = self.getpos()[0] - 1
            self._out.extend(
                scan_js(
                    data, self._path, self._allowlist, line_offset=offset,
                    framework_own=self._framework_own,
                )
            )
        # Plain prose: URLs in documentation text are not loads. Ignored.

    def _scan_importmap(self, data):
        """Check URLs in <script type="importmap"> JSON content."""
        line = self.getpos()[0]
        try:
            importmap = json.loads(data)
        except (json.JSONDecodeError, ValueError):
            return  # malformed importmap; not our problem
        if not isinstance(importmap, dict):
            return
        imports = importmap.get("imports")
        if isinstance(imports, dict):
            for url in imports.values():
                if isinstance(url, str):
                    _check_external_url(
                        url, line, self._path, self._allowlist, self._out
                    )
        scopes = importmap.get("scopes")
        if isinstance(scopes, dict):
            for scope_map in scopes.values():
                if isinstance(scope_map, dict):
                    for url in scope_map.values():
                        if isinstance(url, str):
                            _check_external_url(
                                url, line, self._path, self._allowlist,
                                self._out,
                            )

    def handle_comment(self, data):
        pass  # URLs in comments are documentation, not loads.


def scan_html(text, path, allowlist, framework_own=False):
    """Scan an HTML document; returns a list of Violations.

    ``framework_own`` is threaded to inline <script> scanning so a framework
    HTML file's scripts get the same native-control allowance as .js modules.
    """
    out = []
    parser = _HTMLScanner(path, allowlist, out, framework_own=framework_own)
    parser.feed(text)
    parser.close()
    return out


# ---------------------------------------------------------------------------
# Directory walk
# ---------------------------------------------------------------------------


def load_allowlist(root):
    """Read tinymoon-allowlist.txt at the scanned dir root, if present."""
    f = Path(root) / ALLOWLIST_FILENAME
    if not f.is_file():
        return frozenset()
    entries = set()
    for raw in f.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        entries.add(s)
    return frozenset(entries)


def iter_source_files(root):
    """Yield .html/.css/.js files under root, skipping vendored/derived dirs.

    Files inside a ``third_party`` quarantine directory are NOT yielded: they
    are governed by the provenance manifest (see ``validate_quarantine``), not
    by the ordinary rule scanners.
    """
    root = Path(root)
    skip_conf = _skip_conformance(root)
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in SOURCE_EXTS:
            continue
        if skip_conf is not None and _is_within(p, skip_conf):
            continue
        rel = p.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        if any(part == QUARANTINE_DIRNAME for part in rel.parts):
            continue
        yield p


def iter_quarantine_dirs(root):
    """Yield every ``third_party`` quarantine directory within the scanned tree.

    Both a top-level ``<root>/third_party`` and any nested one (e.g.
    ``<root>/gallery/third_party``) are yielded, so a quarantine is honored
    whether the scan root is the repo root or the sub-tree that contains it.
    Quarantine dirs inside skipped trees (node_modules, dist, ...) are ignored.
    """
    root = Path(root)
    skip_conf = _skip_conformance(root)
    for p in sorted(root.rglob(QUARANTINE_DIRNAME)):
        if not p.is_dir():
            continue
        if skip_conf is not None and _is_within(p, skip_conf):
            continue
        rel = p.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        yield p


def _quarantine_path_unsafe(rel):
    """True if a manifest entry path is absolute or escapes the quarantine dir.

    The quarantine may only pin files INSIDE ``third_party/``; an absolute
    path or any ``..`` component would let it launder a file elsewhere in the
    tree, so both are rejected (checked lexically -- independent of the
    filesystem, on both POSIX and Windows spellings).
    """
    if not rel or rel.startswith(("/", "\\")):
        return True
    normalized = rel.replace("\\", "/")
    if PurePosixPath(normalized).is_absolute() or PureWindowsPath(rel).is_absolute():
        return True
    return any(part == ".." for part in PurePosixPath(normalized).parts)


def validate_quarantine(qdir, root):
    """Validate one quarantine directory against its provenance manifest.

    Returns a list of ``unpinned-vendor`` Violations (paths relative to
    ``root``). A file is exempt from the ordinary rules exactly when the
    manifest pins it and its sha256 still matches; every other state is an
    error. The manifest itself (PROVENANCE.toml) is never required to pin
    itself.
    """
    qdir = Path(qdir)
    out = []
    manifest_path = qdir / PROVENANCE_FILENAME
    manifest_rel = str(manifest_path.relative_to(root))
    present = [
        p
        for p in sorted(qdir.rglob("*"))
        if p.is_file() and p.resolve() != manifest_path.resolve()
    ]

    if not manifest_path.is_file():
        for p in present:
            out.append(
                Violation(
                    str(p.relative_to(root)),
                    1,
                    UNPINNED_VENDOR,
                    f"vendored file under {QUARANTINE_DIRNAME}/ is unpinned"
                    f" -- there is no {PROVENANCE_FILENAME} manifest; add one"
                    " recording each file's relative path, upstream origin,"
                    " and sha256",
                )
            )
        return out

    try:
        data = tomllib.loads(manifest_path.read_text(encoding="utf-8"))
    except (tomllib.TOMLDecodeError, UnicodeDecodeError, OSError) as e:
        return [
            Violation(
                manifest_rel,
                1,
                UNPINNED_VENDOR,
                f"{PROVENANCE_FILENAME} is not readable valid TOML: {e}",
            )
        ]

    raw_entries = data.get("file", [])
    if not isinstance(raw_entries, list):
        return [
            Violation(
                manifest_rel,
                1,
                UNPINNED_VENDOR,
                f"{PROVENANCE_FILENAME} 'file' must be an array of tables"
                " ([[file]] entries)",
            )
        ]

    pinned_rel = set()  # posix rel-to-qdir paths that carry an entry
    for entry in raw_entries:
        if not isinstance(entry, dict):
            out.append(
                Violation(
                    manifest_rel, 1, UNPINNED_VENDOR,
                    "manifest entry must be a [[file]] table",
                )
            )
            continue
        rel = entry.get("path")
        sha = entry.get("sha256")
        origin = entry.get("origin")
        if not isinstance(rel, str) or not rel:
            out.append(
                Violation(
                    manifest_rel, 1, UNPINNED_VENDOR,
                    "manifest entry is missing a string 'path'",
                )
            )
            continue
        if _quarantine_path_unsafe(rel):
            out.append(
                Violation(
                    manifest_rel, 1, UNPINNED_VENDOR,
                    f'manifest entry path "{rel}" is absolute or escapes'
                    f" {QUARANTINE_DIRNAME}/ -- only files inside the"
                    " quarantine directory may be pinned",
                )
            )
            continue
        norm = PurePosixPath(rel.replace("\\", "/")).as_posix()
        pinned_rel.add(norm)
        if not isinstance(sha, str) or not _SHA256_RE.fullmatch(sha.strip()):
            out.append(
                Violation(
                    manifest_rel, 1, UNPINNED_VENDOR,
                    f'manifest entry for "{rel}" is missing a valid 64-hex'
                    " 'sha256'",
                )
            )
            continue
        if not isinstance(origin, str) or not origin.strip():
            out.append(
                Violation(
                    manifest_rel, 1, UNPINNED_VENDOR,
                    f'manifest entry for "{rel}" is missing an "origin"'
                    " (a URL or name recording where the bytes came from)",
                )
            )
            continue
        target = qdir / rel
        if not target.is_file():
            out.append(
                Violation(
                    manifest_rel, 1, UNPINNED_VENDOR,
                    f'manifest pins "{rel}" but no such file exists under'
                    f" {QUARANTINE_DIRNAME}/ -- the entry is stale",
                )
            )
            continue
        actual = hashlib.sha256(target.read_bytes()).hexdigest()
        if actual.lower() != sha.strip().lower():
            out.append(
                Violation(
                    str(target.relative_to(root)), 1, UNPINNED_VENDOR,
                    f'vendored file "{rel}" was modified -- pinned sha256'
                    f" {sha.strip()[:12]}... but it now hashes to"
                    f" {actual[:12]}...; revert it, or re-pin only if this is"
                    " an intended upstream update",
                )
            )
            continue

    for p in present:
        rel_posix = p.relative_to(qdir).as_posix()
        if rel_posix not in pinned_rel:
            out.append(
                Violation(
                    str(p.relative_to(root)), 1, UNPINNED_VENDOR,
                    f'vendored file "{rel_posix}" is not pinned in'
                    f" {PROVENANCE_FILENAME} -- add a [[file]] entry with its"
                    " relative path, upstream origin, and sha256",
                )
            )
    return out


def scan_file(path, root, allowlist):
    """Scan one file; returns a list of Violations (paths relative to root)."""
    path = Path(path)
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = str(path.relative_to(root))
    if "�" in text:
        return [
            Violation(
                rel,
                1,
                ENCODING_ERROR,
                "file contains replacement characters (U+FFFD)"
                " -- it is not valid UTF-8; fix the encoding before scanning",
            )
        ]
    framework_own = _is_framework_own(path)
    ext = path.suffix.lower()
    if ext == ".html":
        return scan_html(text, rel, allowlist, framework_own=framework_own)
    if ext == ".css":
        return scan_css(text, rel, allowlist)
    if ext == ".js":
        return scan_js(text, rel, allowlist, framework_own=framework_own)
    return []


def scan_dir(root, stderr=None):
    """Scan a directory tree; returns Violations sorted by (path, line, rule).

    When ``stderr`` is not None, skip-directory notices are written to it.
    The CLI passes ``sys.stderr``; programmatic callers can pass a
    StringIO or None (silent).
    """
    root = Path(root)
    if not root.is_dir():
        raise NotADirectoryError(f"not a directory: {root}")
    quarantine_dirs = list(iter_quarantine_dirs(root))
    if stderr is not None:
        for d in sorted(root.iterdir()):
            if d.is_dir() and d.name in SKIP_DIRS:
                print(
                    f"notice: skipping directory {d.name}/",
                    file=stderr,
                )
        for q in quarantine_dirs:
            print(
                f"notice: quarantining directory {q.relative_to(root)}/"
                f" (files exempt from rules only when pinned in"
                f" {PROVENANCE_FILENAME})",
                file=stderr,
            )
    allowlist = load_allowlist(root)
    out = []
    for f in iter_source_files(root):
        out.extend(scan_file(f, root, allowlist))
    for q in quarantine_dirs:
        out.extend(validate_quarantine(q, root))
    out.sort()
    return out
