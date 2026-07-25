#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
K6_BIN="${K6_BIN:-/snap/bin/k6}"
HARNESS_PORT="${LOAD_TEST_PORT:-3199}"
HARNESS_PID=""

cleanup() {
  echo "=== Cleaning up ==="
  if [ -n "$HARNESS_PID" ] && kill -0 "$HARNESS_PID" 2>/dev/null; then
    echo "Stopping test harness (PID $HARNESS_PID)..."
    kill "$HARNESS_PID" 2>/dev/null || true
    wait "$HARNESS_PID" 2>/dev/null || true
  fi
  echo "Done."
}
trap cleanup EXIT INT TERM

echo "=== Paperclip Flag Evaluation Engine Load Test ==="
echo ""

# 1. Build the project
echo "--- Step 1: Build server ---"
cd "$REPO_ROOT"
pnpm build 2>&1 | tail -5
echo "Build complete."
echo ""

# 2. Start the load test harness in the background
echo "--- Step 2: Start load test harness on port $HARNESS_PORT ---"
cd "$REPO_ROOT/server"
LOAD_TEST_PORT="$HARNESS_PORT" npx tsx scripts/load-test-harness.ts &
HARNESS_PID=$!
echo "Harness PID: $HARNESS_PID"

# Wait for harness to be ready
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$HARNESS_PORT/api/instance/settings/experimental" >/dev/null 2>&1; then
    echo "Harness is ready."
    break
  fi
  if ! kill -0 "$HARNESS_PID" 2>/dev/null; then
    echo "ERROR: Harness process died during startup"
    exit 1
  fi
  sleep 1
done
echo ""

# 3. Run k6
echo "--- Step 3: Run k6 load test ---"
"$K6_BIN" run \
  -e K6_BASE_URL="http://127.0.0.1:$HARNESS_PORT" \
  --out json="$REPO_ROOT/server/load-test-results.json" \
  --summary-export="$REPO_ROOT/server/load-test-summary.json" \
  "$SCRIPT_DIR/../src/__tests__/load/flag-evaluation-load-test.js"

K6_EXIT=$?
echo ""
echo "=== k6 exit code: $K6_EXIT ==="

# 4. Print summary
if [ -f "$REPO_ROOT/server/load-test-summary.json" ]; then
  echo "=== Load Test Summary ==="
  cat "$REPO_ROOT/server/load-test-summary.json" | python3 -m json.tool 2>/dev/null || cat "$REPO_ROOT/server/load-test-summary.json"
fi

exit $K6_EXIT
