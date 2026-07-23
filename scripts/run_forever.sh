#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

CYCLE_SECONDS=${RUN_CYCLE_SECONDS:-21360}
SLEEP_BETWEEN=${SLEEP_BETWEEN_CYCLES:-10}

mkdir -p logs data

echo "[runner] starting infinite runner with cycle ${CYCLE_SECONDS}s"
while true; do
  echo "[runner] launching bot at $(date -u +%FT%TZ)"
  node src/index.js || true
  echo "[runner] bot exited, sleeping ${SLEEP_BETWEEN}s"
  sleep "$SLEEP_BETWEEN"
done
