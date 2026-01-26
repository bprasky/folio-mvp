#!/bin/bash
set -e

MAX_ITERATIONS=${1:-15}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Ralph for Folio"
echo "📋 Max iterations: $MAX_ITERATIONS"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "═══════════════════════════════════════"
  echo "═══ Iteration $i of $MAX_ITERATIONS ═══"
  echo "═══════════════════════════════════════"

  OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" \
    | claude --dangerously-skip-permissions 2>&1 \
    | tee /dev/stderr) || true

  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "✅ All stories complete!"
    exit 0
  fi

  sleep 3
done

echo "⚠️ Max iterations reached"
exit 1
