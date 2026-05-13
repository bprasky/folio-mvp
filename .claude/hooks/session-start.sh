#!/bin/bash
set -euo pipefail

# Folio SessionStart hook — installs dependencies so tests/linters work
# in Claude Code on the web sessions.
#
# Local sessions are skipped: developer machines manage their own
# node_modules and Prisma client lifecycle.

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "[session-start] installing npm dependencies..."
# --legacy-peer-deps: openai@5 declares peer zod@^3 while the project pins zod@^4.
# Strict resolution fails; the legacy resolver matches what the package-lock was built with.
npm install --no-audit --no-fund --legacy-peer-deps

echo "[session-start] generating Prisma client..."
npx --no-install prisma generate

echo "[session-start] done."
