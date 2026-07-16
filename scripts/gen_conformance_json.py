#!/usr/bin/env python3
"""Generate the portable conformance artifacts under assets/conformance/.

A reimplementation of the checker in another language (a Go server, a CI job)
must be able to conformance-test itself WITHOUT running the Python checker in
process. This script emits three committed artifacts, all derived from the real
checker and the real test fixtures so they can never drift by hand:

1. ``assets/conformance/rules.json`` -- the RULE DATA: every rule id, the banned
   input types and native tags, the skip dirs, the allowlist and quarantine
   conventions, and the load/navigation attribute-semantics table. Every value
   is read live from ``tinymoon.checker`` constants (or derived from its regexes
   exactly as tests/test_charter.py derives the native-tag ban), never
   hand-copied.

2. ``assets/conformance/corpus/`` -- a verbatim byte-for-byte copy of
   ``tests/fixtures/{clean,violations,quarantine}/``: the fixtures a
   reimplementation runs its own rules against.

3. ``assets/conformance/expectations.json`` -- the expected checker output for
   the corpus, produced by running the real checker over each corpus scan root
   exactly as tests/test_checker.py does. Per scan root, per fixture file:
   an ordered list of ``[line, rule-id]`` pairs; clean files map to ``[]``.

The corpus lives inside the framework's own packaged assets, but it is fixture
data with DELIBERATE violations, not identity surface -- the checker skips it
when self-scanning ``assets`` (see checker._skip_conformance) and scans it
normally when it is the explicit target (as this generator and the sync tests
do).

Usage::

    scripts/gen_conformance_json.py            # write the artifacts
    scripts/gen_conformance_json.py --check    # verify committed artifacts are
                                               # current (exit 1 on drift)

The generator is stdlib-only (it imports only ``tinymoon.checker``, which is
itself stdlib-only) and importable: the sync test calls its ``build_*`` and
``serialize`` helpers to regenerate in memory and compare against the committed
files.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tinymoon.checker as checker  # noqa: E402  (after sys.path setup)

FIXTURES = REPO_ROOT / "tests" / "fixtures"
CONFORMANCE = REPO_ROOT / "assets" / "conformance"
CORPUS = CONFORMANCE / "corpus"
RULES_OUTPUT = CONFORMANCE / "rules.json"
EXPECTATIONS_OUTPUT = CONFORMANCE / "expectations.json"

REGEN_COMMAND = "scripts/gen_conformance_json.py"
RULES_MARKER = (
    "generated — do not edit, regenerate via scripts/gen_conformance_json.py"
)
EXPECTATIONS_MARKER = RULES_MARKER

# The fixture categories copied verbatim into the corpus.
CORPUS_CATEGORIES = ("clean", "violations", "quarantine")


# ---------------------------------------------------------------------------
# rules.json
# ---------------------------------------------------------------------------


def _banned_native_tags() -> list[str]:
    """Native element tag names the checker bans, extracted from its own
    native-control regexes -- exactly as tests/test_charter.py derives them.
    There is no dedicated select-tag constant, so the tag alternation inside
    the regexes is the authoritative programmatic representation of the ban."""
    tags: set[str] = set()
    for pat in (checker._JS_EL_NATIVE_RE, checker._JS_CREATE_NATIVE_RE):
        for group in re.findall(r"\(([^()]+)\)", pat.pattern):
            if re.fullmatch(r"[\w|]+", group):
                tags.update(group.split("|"))
    return sorted(tags)


def _load_semantics() -> list[dict]:
    """The load-attribute rows of the semantics table, sourced from the shared
    checker constants (checker.SINGLE_URL_LOAD_ATTRS et al.)."""
    rows: list[dict] = [
        {
            "attr": "href",
            "elements": "*",
            "except_elements": list(checker.NAV_HREF_TAGS),
            "value": "single-url",
            "kind": "load",
            "note": (
                "a NAVIGATION (never a load) on <a>/<area>; a load on every"
                " other element"
            ),
        }
    ]
    for attr in checker.SINGLE_URL_LOAD_ATTRS:
        rows.append(
            {"attr": attr, "elements": "*", "value": "single-url", "kind": "load"}
        )
    for attr, tags in checker.ELEMENT_SCOPED_LOAD_ATTRS.items():
        rows.append(
            {
                "attr": attr,
                "elements": list(tags),
                "value": "single-url",
                "kind": "load",
            }
        )
    for attr in checker.SPACE_LIST_LOAD_ATTRS:
        rows.append(
            {
                "attr": attr,
                "elements": "*",
                "value": "space-separated-url-list",
                "kind": "load",
            }
        )
    for attr in checker.SRCSET_LOAD_ATTRS:
        rows.append(
            {
                "attr": attr,
                "elements": "*",
                "value": "srcset-candidate-list",
                "kind": "load",
                "note": (
                    "comma-separated candidates; the first token of each"
                    " candidate is the URL"
                ),
            }
        )
    return rows


def build_rules_document() -> dict:
    """Assemble rules.json from the checker's own constants and regexes."""
    rule_ids = [
        checker.EXTERNAL_URL,
        checker.NATIVE_CONTROL,
        checker.TITLE_ATTR,
        checker.BORDER_RADIUS,
        checker.RAW_COLOR,
        checker.ENCODING_ERROR,
        checker.UNPINNED_VENDOR,
    ]
    return {
        "_generated": RULES_MARKER,
        "source": "tinymoon/checker.py",
        "rules": rule_ids,
        "banned_input_types": list(checker._BANNED_INPUT_TYPES),
        "banned_native_tags": _banned_native_tags(),
        "source_exts": sorted(checker.SOURCE_EXTS),
        "skip_dirs": sorted(checker.SKIP_DIRS),
        "allowlist": {
            "filename": checker.ALLOWLIST_FILENAME,
            "match": "exact",
            "note": (
                "placed at the scanned directory root; one exact URL per line,"
                " '#' comments allowed; exempts only exact external-url load"
                " matches -- navigations are already legal and need no entry"
            ),
        },
        "quarantine": {
            "dirname": checker.QUARANTINE_DIRNAME,
            "manifest": checker.PROVENANCE_FILENAME,
            "note": (
                "files under the quarantine directory are exempt from all rules"
                " only when pinned by their exact sha256 in the manifest that"
                " sits beside them; every other state is an unpinned-vendor"
                " hard error"
            ),
        },
        "conformance_corpus_dirname": checker.CONFORMANCE_DIRNAME,
        "attribute_semantics": {
            "navigation_href_elements": list(checker.NAV_HREF_TAGS),
            "namespace_identifier_attrs": ["xmlns", "xmlns:*"],
            "title_attribute": {
                "rule": checker.TITLE_ATTR,
                "note": (
                    "the title= ATTRIBUTE is banned; the SVG <title> child"
                    " ELEMENT is fine"
                ),
            },
            "loads": _load_semantics(),
        },
    }


# ---------------------------------------------------------------------------
# corpus copy
# ---------------------------------------------------------------------------


def corpus_source_files() -> list[tuple[str, Path]]:
    """Return (corpus-relative posix path, absolute source path) for every
    file under the copied fixture categories, sorted for determinism."""
    out: list[tuple[str, Path]] = []
    for category in CORPUS_CATEGORIES:
        base = FIXTURES / category
        for p in sorted(base.rglob("*")):
            if p.is_file():
                rel = (Path(category) / p.relative_to(base)).as_posix()
                out.append((rel, p))
    return out


def _write_corpus() -> None:
    """Copy the fixtures into the corpus verbatim and prune stale files."""
    wanted: set[Path] = set()
    for rel, src in corpus_source_files():
        dest = CORPUS / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(src.read_bytes())
        wanted.add(dest.resolve())
    # Prune any file previously written into the corpus that is no longer a
    # source fixture, so the committed corpus mirrors the fixtures exactly.
    if CORPUS.is_dir():
        for p in sorted(CORPUS.rglob("*")):
            if p.is_file() and p.resolve() not in wanted:
                p.unlink()
        for d in sorted(CORPUS.rglob("*"), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()


# ---------------------------------------------------------------------------
# expectations.json
# ---------------------------------------------------------------------------


def corpus_scan_roots(corpus_dir: Path) -> list[tuple[str, Path]]:
    """The natural scan roots inside the corpus, mirroring how
    tests/test_checker.py invokes ``scan_dir``: ``clean`` and ``violations``
    are single roots; each immediate child of ``quarantine`` is its own root
    (each is a distinct provenance scenario)."""
    roots: list[tuple[str, Path]] = []
    for category in ("clean", "violations"):
        roots.append((category, corpus_dir / category))
    qdir = corpus_dir / "quarantine"
    if qdir.is_dir():
        for sub in sorted(p for p in qdir.iterdir() if p.is_dir()):
            roots.append((f"quarantine/{sub.name}", sub))
    return roots


def build_expectations_document(corpus_dir: Path = CORPUS) -> dict:
    """Run the real checker over each corpus scan root and record its exact
    output, keyed by scan root then by file path relative to that root."""
    roots: dict[str, dict[str, list]] = {}
    for key, path in corpus_scan_roots(corpus_dir):
        files: dict[str, list] = {}
        # Seed every scannable source file with an empty list so clean files
        # are represented explicitly.
        for f in checker.iter_source_files(path):
            files[f.relative_to(path).as_posix()] = []
        for v in checker.scan_dir(path):
            files.setdefault(v.path.replace("\\", "/"), []).append([v.line, v.rule])
        roots[key] = {k: files[k] for k in sorted(files)}
    return {
        "_generated": EXPECTATIONS_MARKER,
        "source": "tests/fixtures/ (corpus) scanned by tinymoon.checker",
        "regenerate": REGEN_COMMAND,
        "roots": roots,
    }


# ---------------------------------------------------------------------------
# shared
# ---------------------------------------------------------------------------


def serialize(document: dict) -> str:
    """Render a JSON artifact deterministically (2-space indent, trailing NL)."""
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def _check_one(path: Path, expected: str) -> list[str]:
    current = path.read_text(encoding="utf-8") if path.exists() else None
    if current == expected:
        return []
    return [str(path.relative_to(REPO_ROOT))]


def main(argv: list[str]) -> int:
    check = "--check" in argv[1:]
    unknown = [a for a in argv[1:] if a != "--check"]
    if unknown:
        sys.stderr.write(f"unknown argument(s): {' '.join(unknown)}\n")
        return 2

    rules_text = serialize(build_rules_document())

    if check:
        stale: list[str] = _check_one(RULES_OUTPUT, rules_text)
        # Corpus drift: every committed corpus file must match its fixture.
        committed = {
            p.relative_to(CORPUS).as_posix()
            for p in (CORPUS.rglob("*") if CORPUS.is_dir() else [])
            if p.is_file()
        }
        wanted: dict[str, Path] = dict(corpus_source_files())
        for rel, src in wanted.items():
            dest = CORPUS / rel
            if not dest.exists() or dest.read_bytes() != src.read_bytes():
                stale.append(f"assets/conformance/corpus/{rel}")
        for extra in sorted(committed - set(wanted)):
            stale.append(f"assets/conformance/corpus/{extra} (stale)")
        # Expectations drift: compare against a regeneration from the committed
        # corpus.
        expectations_text = serialize(build_expectations_document(CORPUS))
        stale += _check_one(EXPECTATIONS_OUTPUT, expectations_text)
        if not stale:
            print("assets/conformance/ artifacts are up to date")
            return 0
        sys.stderr.write(
            "assets/conformance/ artifacts are out of date:\n  "
            + "\n  ".join(stale)
            + f"\nregenerate with: {REGEN_COMMAND}\n"
        )
        return 1

    CONFORMANCE.mkdir(parents=True, exist_ok=True)
    RULES_OUTPUT.write_text(rules_text, encoding="utf-8")
    _write_corpus()
    # Expectations must be built AFTER the corpus is written (it scans it).
    EXPECTATIONS_OUTPUT.write_text(
        serialize(build_expectations_document(CORPUS)), encoding="utf-8"
    )
    print(
        f"wrote {RULES_OUTPUT.relative_to(REPO_ROOT)}, "
        f"{EXPECTATIONS_OUTPUT.relative_to(REPO_ROOT)}, and the corpus under "
        f"{CORPUS.relative_to(REPO_ROOT)}/"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
