"""Sync + schema-sanity tests for the committed token export artifact.

``assets/tokens.json`` is generated from ``assets/css/tokens.css`` by
``scripts/gen_tokens_json.py``. These tests guard two things:

- Drift: the committed artifact must byte-match what the generator produces
  right now. If the CSS changed and the artifact was not regenerated, this
  fails with the exact command to run.
- Schema sanity: both themes carry tokens, and every light-theme override
  names a token that also exists in the default block (light is an override
  layer, never introduces brand-new tokens).
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GENERATOR = REPO_ROOT / "scripts" / "gen_tokens_json.py"
ARTIFACT = REPO_ROOT / "assets" / "tokens.json"


def _load_generator():
    spec = importlib.util.spec_from_file_location("gen_tokens_json", GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gen = _load_generator()


def test_artifact_matches_generator_output():
    """The committed artifact must equal a fresh in-memory regeneration."""
    expected = gen.serialize(gen.build_document())
    actual = ARTIFACT.read_text(encoding="utf-8")
    assert actual == expected, (
        "assets/tokens.json is out of date with assets/css/tokens.css. "
        "Regenerate with: scripts/gen_tokens_json.py"
    )


def test_both_themes_have_tokens():
    """Neither theme block may be empty."""
    doc = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    default_tokens = doc["themes"]["default"]["tokens"]
    light_tokens = doc["themes"]["light"]["tokens"]
    assert len(default_tokens) > 0, "default theme has no tokens"
    assert len(light_tokens) > 0, "light theme has no tokens"


def test_light_tokens_subset_of_default():
    """Every light-theme override must name a token declared in the default."""
    doc = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    default_names = set(doc["themes"]["default"]["tokens"])
    light_names = set(doc["themes"]["light"]["tokens"])
    missing = sorted(light_names - default_names)
    assert not missing, (
        f"light theme declares tokens absent from the default block: {missing}"
    )


def test_artifact_metadata():
    """The artifact carries its source pointer and generated marker."""
    doc = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    assert doc["source"] == "assets/css/tokens.css"
    assert "regenerate" in doc["_generated"].lower()
    assert "scripts/gen_tokens_json.py" in doc["_generated"]
