"""tinymoon conformance rule engine.

The checker guards tinymoon's IDENTITY SURFACE: the first-party bytes that
render the framework's identity -- the HTML, CSS, JS, and fonts a page ships
and paints. Every rule quantifies over RESOURCE LOADS (bytes fetched into the
page) and RENDERED STYLING (how those bytes look), never over NAVIGATIONS. A
navigation is a plain hyperlink the user may follow (<a href>, <area href>);
it leaves or opens elsewhere and fetches nothing into the current page, so it
was never a purity violation. Provenance -- whether bytes are first- or
third-party -- is not modeled here; a later boundary construct will mark
third-party provenance explicitly. Until then, every load the checker sees is
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

import json
import re
import urllib.parse
from bisect import bisect_right
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

# Rule ids
EXTERNAL_URL = "external-url"
NATIVE_CONTROL = "native-control"
TITLE_ATTR = "title-attr"
BORDER_RADIUS = "border-radius"
RAW_COLOR = "raw-color"
ENCODING_ERROR = "encoding-error"

SKIP_DIRS = {"node_modules", ".git", ".venv", "__pycache__", "dist"}
SOURCE_EXTS = {".html", ".css", ".js"}
ALLOWLIST_FILENAME = "tinymoon-allowlist.txt"

_BANNED_INPUT_TYPES = ("checkbox", "radio", "file")


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


def scan_js(text, path, allowlist, line_offset=0):
    """Scan JS source; returns a list of Violations."""
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

    def __init__(self, path, allowlist, out):
        super().__init__(convert_charrefs=True)
        self._path = path
        self._allowlist = allowlist
        self._out = out
        self._container = None  # "style" | "script" | "importmap" | None

    # -- tags ---------------------------------------------------------------

    def handle_starttag(self, tag, attrs):
        self._check_tag(tag, attrs)
        tag = tag.lower()
        if tag == "style":
            self._container = "style"
        elif tag == "script":
            d = {k.lower(): (v or "") for k, v in attrs}
            if "src" in d:
                return
            t = d.get("type", "").lower()
            if t == "importmap":
                self._container = "importmap"
            elif t in ("", "module") or "javascript" in t:
                self._container = "script"

    def handle_startendtag(self, tag, attrs):
        self._check_tag(tag, attrs)

    def handle_endtag(self, tag):
        if tag.lower() in ("style", "script"):
            self._container = None  # clears style, script, and importmap

    def _check_tag(self, tag, attrs):
        line = self.getpos()[0]
        tag = tag.lower()
        attr_map = {}
        for name, value in attrs:
            lname = name.lower()
            value = value or ""
            attr_map.setdefault(lname, value)
            if lname == "title":
                self._out.append(
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
            if lname == "href":
                # href on <a>/<area> is a NAVIGATION (a hyperlink the user
                # follows), not a resource load -- always legal. On any other
                # element (<link>, SVG <use>, ...) href fetches bytes into the
                # page and stays a load.
                if tag not in ("a", "area"):
                    _check_external_url(
                        value, line, self._path, self._allowlist, self._out
                    )
            elif lname in ("src", "action", "poster", "formaction"):
                # src is a load; action/formaction ship user data off-origin
                # on submit -- treated as a load-class concern.
                _check_external_url(
                    value, line, self._path, self._allowlist, self._out
                )
            elif lname == "data" and tag == "object":
                _check_external_url(
                    value, line, self._path, self._allowlist, self._out
                )
            elif lname == "ping":
                # ping= is space-separated list of URLs
                for url in value.split():
                    _check_external_url(
                        url, line, self._path, self._allowlist, self._out
                    )
            elif lname == "srcset":
                for candidate in value.split(","):
                    candidate = candidate.strip()
                    if not candidate:
                        continue
                    url = candidate.split()[0]
                    _check_external_url(
                        url, line, self._path, self._allowlist, self._out
                    )
            elif lname == "style":
                self._scan_inline_style(value, line)
        if tag == "select":
            self._out.append(
                Violation(
                    self._path,
                    line,
                    NATIVE_CONTROL,
                    f"native <{tag}> -- use the framework's own primitives",
                )
            )
        elif tag == "input" and attr_map.get("type", "").lower() in _BANNED_INPUT_TYPES:
            self._out.append(
                Violation(
                    self._path,
                    line,
                    NATIVE_CONTROL,
                    f'native <input type="{attr_map["type"].lower()}">'
                    " -- use the framework's own primitives",
                )
            )

    def _scan_inline_style(self, style_text, line):
        for decl in style_text.split(";"):
            if ":" not in decl:
                continue
            prop, value = decl.split(":", 1)
            _check_declaration(
                prop, value, line, self._path, False, self._allowlist, self._out
            )

    # -- content ------------------------------------------------------------

    def handle_data(self, data):
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
                scan_js(data, self._path, self._allowlist, line_offset=offset)
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


def scan_html(text, path, allowlist):
    """Scan an HTML document; returns a list of Violations."""
    out = []
    parser = _HTMLScanner(path, allowlist, out)
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
    """Yield .html/.css/.js files under root, skipping vendored/derived dirs."""
    root = Path(root)
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in SOURCE_EXTS:
            continue
        rel = p.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        yield p


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
    ext = path.suffix.lower()
    if ext == ".html":
        return scan_html(text, rel, allowlist)
    if ext == ".css":
        return scan_css(text, rel, allowlist)
    if ext == ".js":
        return scan_js(text, rel, allowlist)
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
    if stderr is not None:
        for d in sorted(root.iterdir()):
            if d.is_dir() and d.name in SKIP_DIRS:
                print(
                    f"notice: skipping directory {d.name}/",
                    file=stderr,
                )
    allowlist = load_allowlist(root)
    out = []
    for f in iter_source_files(root):
        out.extend(scan_file(f, root, allowlist))
    out.sort()
    return out
