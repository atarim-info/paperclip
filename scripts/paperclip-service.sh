#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/vladimir/develop/paperclip"
ENV_FILE="$REPO_DIR/.env"
PID_FILE="/home/vladimir/.paperclip/paperclip-server.pid"
LOG_DIR="/home/vladimir/.paperclip/logs"
SERVER_LOG="$LOG_DIR/server.log"
SERVER_PATTERN="pnpm.*--filter.*@paperclipai/server dev|tsx.*src/index\.ts"

cd "$REPO_DIR"
mkdir -p "$LOG_DIR"

load_env() {
  if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
  fi
}

get_pid() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi
  local pid
  pid=$(pgrep -f "$SERVER_PATTERN" 2>/dev/null | head -1 || echo "")
  if [ -n "$pid" ]; then
    echo "$pid"
    return 0
  fi
  echo ""
  return 1
}

kill_proc_tree() {
  local pid="$1"
  # kill children first
  local children
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  for child in $children; do
    kill_proc_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

case "${1:-status}" in
  start)
    if pid=$(get_pid); then
      echo "Paperclip is already running (PID $pid)"
      exit 0
    fi
    echo "Starting Paperclip..."
    load_env
    export PAPERCLIP_UI_DEV_MIDDLEWARE=true
    export PAPERCLIP_MIGRATION_AUTO_APPLY=true
    setsid nohup pnpm --filter @paperclipai/server dev >> "$SERVER_LOG" 2>&1 &
    echo $! > "$PID_FILE"
    echo "Paperclip server starting (PID $(cat "$PID_FILE"))"
    echo "Logs: $SERVER_LOG"
    ;;

  stop)
    if pid=$(get_pid); then
      echo "Stopping Paperclip (PID $pid)..."
      # Kill entire process tree + process group
      kill_proc_tree "$pid" || true
      kill -- -$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ') 2>/dev/null || true
      # Also kill any orphaned server processes
      pkill -f "tsx.*src/index\.ts" 2>/dev/null || true
      pkill -f "pnpm.*@paperclipai/server" 2>/dev/null || true
      for i in $(seq 1 15); do
        if ! kill -0 "$pid" 2>/dev/null; then
          break
        fi
        sleep 1
      done
      rm -f "$PID_FILE"
      echo "Paperclip stopped"
    else
      echo "Paperclip is not running"
    fi
    ;;

  status)
    if pid=$(get_pid); then
      echo "Paperclip is running (PID $pid)"
      if [ -n "$(command -v curl 2>/dev/null)" ]; then
        port="${PORT:-3100}"
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:$port/api/health" 2>/dev/null || echo "no response")
        echo "Health: HTTP $http_code"
      fi
    else
      echo "Paperclip is not running"
    fi
    ;;

  restart)
    "$0" stop
    sleep 2
    "$0" start
    ;;

  logs)
    tail -f "$SERVER_LOG"
    ;;

  *)
    echo "Usage: $0 {start|stop|status|restart|logs}"
    exit 1
    ;;
esac
