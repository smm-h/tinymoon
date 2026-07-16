#!/usr/bin/env bash
# Phase checkpoint gate for tinymoon.
#
# CI does not run until release, so this local suite is the quality gate
# between work phases. It runs every test surface in order, stops at the first
# failure (fail-fast), and prints a PASS/FAIL/SKIP summary at the end.
#
# Gates, in order:
#   a) uv run pytest                -- Python unit/conformance tests
#   b) npm test                     -- JS syntax gate + vitest
#   c) npx playwright test          -- browser e2e (config auto-starts server)
#   d) go test ./...                -- Go module tests
#   e) rlsbl check --tag changelog  -- changelog coverage
#
# Exit code is non-zero if any gate fails.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# Parallel arrays: human label and the command to run for each gate.
labels=(
  "pytest"
  "npm test (syntax + vitest)"
  "playwright e2e"
  "go test"
  "rlsbl changelog check"
)
commands=(
  "uv run pytest"
  "npm test"
  "npx playwright test"
  "go test ./..."
  "rlsbl check --tag changelog"
)

results=()
overall=0
next_skipped=-1

for i in "${!labels[@]}"; do
  label="${labels[$i]}"
  cmd="${commands[$i]}"
  echo
  echo "==> gate $((i + 1))/${#labels[@]}: ${label}"
  echo "    \$ ${cmd}"
  # `if` disables set -e for the condition, so a failing gate is captured
  # rather than aborting the script before the summary prints.
  if bash -c "${cmd}"; then
    results+=("PASS  ${label}")
  else
    results+=("FAIL  ${label}")
    overall=1
    next_skipped=$((i + 1))
    break
  fi
done

# Gates never reached because fail-fast stopped early are marked SKIP.
if [ "${next_skipped}" -ge 0 ]; then
  for ((j = next_skipped; j < ${#labels[@]}; j++)); do
    results+=("SKIP  ${labels[$j]}")
  done
fi

echo
echo "================ checkpoint summary ================"
for line in "${results[@]}"; do
  echo "  ${line}"
done
echo "==================================================="
if [ "${overall}" -eq 0 ]; then
  echo "checkpoint: ALL GATES PASSED"
else
  echo "checkpoint: FAILED"
fi

exit "${overall}"
