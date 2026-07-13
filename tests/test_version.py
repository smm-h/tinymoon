"""Version consistency: __version__ must match pyproject.toml.

The release tool bumps both files together; comparing them (instead of
hardcoding a version string) keeps this test green across version bumps.
A hardcoded assertion here broke CI on the release commit for 0.1.0.
"""

import tomllib
from pathlib import Path

import tinymoon


def test_version_matches_pyproject():
    pyproject = Path(__file__).resolve().parent.parent / "pyproject.toml"
    with pyproject.open("rb") as f:
        declared = tomllib.load(f)["project"]["version"]
    assert tinymoon.__version__ == declared
