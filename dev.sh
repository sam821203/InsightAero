#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Start backend in background (assumes .venv and deps already set up)
(
  cd backend
  if [ -d .venv ]; then
    source .venv/bin/activate
  fi
  exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) &
BKPID=$!

cleanup() {
  kill "$BKPID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start frontend in foreground
(
  cd frontend
  npm run dev
)
cleanup
