"""Sync + consistency tests for the committed conformance artifacts.

``assets/conformance/rules.json``, ``assets/conformance/corpus/``, and
``assets/conformance/expectations.json`` are generated from the checker and the
real fixtures by ``scripts/gen_conformance_json.py``. These tests guard:

- Drift: the committed rules.json / expectations.json must byte-match a fresh
  regeneration, and every corpus file must byte-match its source fixture (with
  no stale extras). If a fixture or a rule constant changed and the artifacts
  were not regenerated, the failure names the exact command to run.
- Structural binding: the ``violations`` scan root's expectations must equal
  ``test_checker.EXPECTED_VIOLATIONS`` (the authoritative per-file structure),
  so the corpus can never silently diverge from the checker's own tests.
- Internal consistency: every expectations entry names an existing corpus file
  (forward), and every scannable corpus source file has an expectations entry
  (backward), and every rule id used in expectations exists in rules.json.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from tinymoon import checker
from test_checker import EXPECTED_VIOLATIONS

REPO_ROOT = Path(__file__).resolve().parent.parent
GENERATOR = REPO_ROOT / "scripts" / "gen_conformance_json.py"
CONFORMANCE = REPO_ROOT / "assets" / "conformance"
RULES = CONFORMANCE / "rules.json"
EXPECTATIONS = CONFORMANCE / "expectations.json"
CORPUS = CONFORMANCE / "corpus"

REGEN = "scripts/gen_conformance_json.py"


def _load_generator():
    spec = importlib.util.spec_from_file_location("gen_conformance_json", GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gen = _load_generator()


# ---------------------------------------------------------------------------
# Drift
# ---------------------------------------------------------------------------


def test_rules_artifact_matches_generator_output():
    expected = gen.serialize(gen.build_rules_document())
    actual = RULES.read_text(encoding="utf-8")
    assert actual == expected, (
        f"assets/conformance/rules.json is out of date. Regenerate with: {REGEN}"
    )


def test_expectations_artifact_matches_generator_output():
    expected = gen.serialize(gen.build_expectations_document(CORPUS))
    actual = EXPECTATIONS.read_text(encoding="utf-8")
    assert actual == expected, (
        "assets/conformance/expectations.json is out of date. "
        f"Regenerate with: {REGEN}"
    )


def test_corpus_matches_fixtures_byte_for_byte():
    """Every corpus file mirrors its source fixture; no missing or stale files."""
    wanted = dict(gen.corpus_source_files())
    problems = []
    for rel, src in wanted.items():
        dest = CORPUS / rel
        if not dest.exists():
            problems.append(f"missing corpus file: {rel}")
        elif dest.read_bytes() != src.read_bytes():
            problems.append(f"corpus file differs from fixture: {rel}")
    committed = {
        p.relative_to(CORPUS).as_posix()
        for p in CORPUS.rglob("*")
        if p.is_file()
    }
    for extra in sorted(committed - set(wanted)):
        problems.append(f"stale corpus file (no source fixture): {extra}")
    assert not problems, (
        "conformance corpus is out of sync with tests/fixtures/:\n  "
        + "\n  ".join(problems)
        + f"\nRegenerate with: {REGEN}"
    )


# ---------------------------------------------------------------------------
# Structural binding
# ---------------------------------------------------------------------------


def test_violations_expectations_match_test_checker_structure():
    """The corpus's ``violations`` expectations equal the checker's own
    authoritative EXPECTED_VIOLATIONS (files with no violations map to [])."""
    doc = json.loads(EXPECTATIONS.read_text(encoding="utf-8"))
    got = {
        name: [tuple(pair) for pair in pairs]
        for name, pairs in doc["roots"]["violations"].items()
        if pairs
    }
    expected = {
        name: [tuple(p) for p in pairs]
        for name, pairs in EXPECTED_VIOLATIONS.items()
    }
    assert got == expected


# ---------------------------------------------------------------------------
# Internal consistency
# ---------------------------------------------------------------------------


def _root_key_to_path(root_key: str) -> Path:
    return CORPUS / root_key


def test_every_expectations_entry_has_a_corpus_file():
    """Forward consistency: each (root, file) key resolves to a real file."""
    doc = json.loads(EXPECTATIONS.read_text(encoding="utf-8"))
    missing = []
    for root_key, files in doc["roots"].items():
        base = _root_key_to_path(root_key)
        for rel in files:
            if not (base / rel).is_file():
                missing.append(f"{root_key}/{rel}")
    assert not missing, "expectations reference nonexistent corpus files: " + ", ".join(
        missing
    )


def test_every_scannable_corpus_source_has_an_expectation():
    """Backward consistency: every scannable source file (as iter_source_files
    yields) under each scan root has an expectations entry."""
    doc = json.loads(EXPECTATIONS.read_text(encoding="utf-8"))
    missing = []
    for root_key, base in gen.corpus_scan_roots(CORPUS):
        keys = set(doc["roots"].get(root_key, {}))
        for f in checker.iter_source_files(base):
            rel = f.relative_to(base).as_posix()
            if rel not in keys:
                missing.append(f"{root_key}/{rel}")
    assert not missing, (
        "scannable corpus source files without an expectations entry: "
        + ", ".join(missing)
    )


def test_expectations_rule_ids_exist_in_rules_json():
    """Every rule id used in expectations is declared in rules.json."""
    rules = set(json.loads(RULES.read_text(encoding="utf-8"))["rules"])
    doc = json.loads(EXPECTATIONS.read_text(encoding="utf-8"))
    used = {
        pair[1]
        for files in doc["roots"].values()
        for pairs in files.values()
        for pair in pairs
    }
    assert used <= rules, f"expectations use rule ids absent from rules.json: {used - rules}"


def test_rules_json_metadata_and_shape():
    doc = json.loads(RULES.read_text(encoding="utf-8"))
    assert doc["source"] == "tinymoon/checker.py"
    assert "regenerate" in doc["_generated"].lower()
    assert REGEN in doc["_generated"]
    # Rule ids include the quarantine rule explicitly.
    assert checker.UNPINNED_VENDOR in doc["rules"]
    assert doc["banned_input_types"] == list(checker._BANNED_INPUT_TYPES)
    assert "select" in doc["banned_native_tags"]
    assert "dialog" in doc["banned_native_tags"]
