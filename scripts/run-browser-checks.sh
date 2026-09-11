#!/usr/bin/env bash
set -euo pipefail
PORT=4173
LOG_DIR="${RUNNER_TEMP:-/tmp}"
python3 scripts/media_http.py --port "$PORT" --directory dist > "$LOG_DIR/portfolio-qa-server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
for attempt in $(seq 1 30); do
  kill -0 "$SERVER_PID" || { cat "$LOG_DIR/portfolio-qa-server.log"; exit 1; }
  if curl --silent --fail --max-time 1 "http://127.0.0.1:$PORT/" > /dev/null; then break; fi
  sleep 1
done
node --experimental-strip-types --test scripts/resource-queue.test.ts scripts/loading-progress.test.ts
python3 scripts/cache-smoke.py
python3 scripts/lazy-loading-smoke.py
python3 scripts/works-spacing-smoke.py
python3 scripts/home-logo-smoke.py
python3 scripts/contacts-photo-smoke.py
python3 scripts/transition-performance-smoke.py
QA_WEBKIT=1 python3 scripts/browser-smoke.py --base "http://127.0.0.1:$PORT"
