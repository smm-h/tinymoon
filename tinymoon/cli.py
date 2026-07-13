"""tinymoon command-line interface (strictcli-based).

One command: ``tinymoon check --dir <path>`` -- the conformance checker.
It is a hard gate: any violation exits 1, and there are no bypass,
skip, or warning-mode flags by design.
"""

import sys
from pathlib import Path

import strictcli

from . import __version__
from .checker import iter_source_files, scan_dir

app = strictcli.App(
    name="tinymoon",
    version=__version__,
    help=(
        "Tooling for the tinymoon web framework. Ships the conformance "
        "checker that enforces the framework's non-negotiables (no external "
        "URLs, no native browser controls, no title= attributes, no rounded "
        "corners, no off-token colors) as hard errors."
    ),
)


@app.command(
    "check",
    help=(
        "Recursively scan the .html/.css/.js files under --dir for "
        "conformance violations: external URLs (external-url), native "
        "browser controls (native-control), title= attributes (title-attr), "
        "non-zero border-radius (border-radius), and off-token color "
        "literals (raw-color). Prints one line per violation "
        "(path:line: [rule-id] message) and a summary count. Exits 0 when "
        "clean, 1 on any violation -- there is no bypass. An optional "
        "tinymoon-allowlist.txt at the scanned directory root (one exact "
        "URL per line, # comments allowed) exempts exact URL matches from "
        "the external-url rule."
    ),
)
@strictcli.flag(
    "dir",
    type=str,
    help=(
        "Directory to scan (required -- the checker never scans the "
        "current directory implicitly)"
    ),
)
def check(dir):
    root = Path(dir)
    if not root.is_dir():
        print(f"error: --dir {dir!r} is not a directory", file=sys.stderr)
        return 2
    violations = scan_dir(root)
    file_count = sum(1 for _ in iter_source_files(root))
    for v in violations:
        print(f"{root / v.path}:{v.line}: [{v.rule}] {v.message}")
    print(f"{len(violations)} violation(s) in {file_count} file(s) scanned.")
    return 1 if violations else 0


def main():
    app.run()
