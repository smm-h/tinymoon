#!/usr/bin/env bash
# Syntax gate: run `node --check` over every shipped and gallery JS file plus
# the root entry module. Any parse error fails the whole run (non-zero exit).
# This is a hard guardrail -- there is no skip or ignore flag.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Collect target files: all .js under assets/js and gallery, plus root index.js.
mapfile -d '' files < <(
  find "$REPO/assets/js" "$REPO/gallery" -type f -name '*.js' -print0
)
files+=("$REPO/index.js")

status=0
for f in "${files[@]}"; do
  if ! node --check "$f"; then
    echo "syntax error: $f" >&2
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo "check-js-syntax: one or more files failed node --check" >&2
  exit 1
fi

echo "check-js-syntax: ${#files[@]} file(s) OK"
