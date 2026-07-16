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
#
# --stress (opt-in): instead of the normal phase suite, run only the
# interaction-heavy e2e specs (chrome, light-dismiss, tooltip-hovercard,
# datepicker, forms, ctxmenu) under a load profile -- --repeat-each=10
# --workers=6. That profile stresses timing-sensitive overlay behavior
# (close/reopen, focus, dismissal ordering) and surfaces load-dependent races
# that unloaded single-pass runs miss. Nothing invokes this automatically; it is
# an explicit pre-release step. Usage:
#   scripts/checkpoint.sh --stress
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# Argument parsing: the only accepted flag is --stress.
STRESS=0
for arg in "$@"; do
  case "$arg" in
    --stress) STRESS=1 ;;
    *) echo "checkpoint: unknown argument: ${arg} (only --stress is accepted)" >&2; exit 2 ;;
  esac
done

# Stress mode: the load-profile e2e gate. Runs the interaction-heavy specs with
# repeat + parallel workers so timing-sensitive overlay races show up locally
# instead of only on a loaded CI runner.
if [ "${STRESS}" -eq 1 ]; then
  stress_cmd="npx playwright test \
    tests/js/e2e/chrome.spec.js \
    tests/js/e2e/light-dismiss.spec.js \
    tests/js/e2e/tooltip-hovercard.spec.js \
    tests/js/e2e/datepicker.spec.js \
    tests/js/e2e/forms.spec.js \
    tests/js/e2e/ctxmenu.spec.js \
    --repeat-each=10 --workers=6"
  echo
  echo "==> stress gate: interaction-heavy e2e under load (--repeat-each=10 --workers=6)"
  echo "    \$ ${stress_cmd}"
  if bash -c "${stress_cmd}"; then
    echo
    echo "checkpoint(stress): PASSED"
    exit 0
  else
    echo
    echo "checkpoint(stress): FAILED"
    exit 1
  fi
fi

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
