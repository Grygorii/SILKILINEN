#!/bin/bash
# SessionStart hook — install backend + frontend dependencies so tests
# (backend: vitest) and the linter (frontend: eslint) work in Claude Code on
# the web, where the container starts without node_modules. Idempotent and
# non-interactive; safe to re-run.
set -euo pipefail

# Only needed in the remote (web) environment — locally you already have deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "[session-start] installing backend dependencies…"
( cd "$ROOT/backend" && npm install --no-audit --no-fund )

echo "[session-start] installing frontend dependencies…"
( cd "$ROOT/frontend" && npm install --no-audit --no-fund )

echo "[session-start] dependencies ready."
