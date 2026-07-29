#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/ui.sh
source "${SCRIPT_DIR}/ui.sh"

APP_PORT="${APP_PORT:-3008}"

if ! [[ "${APP_PORT}" =~ ^[0-9]+$ ]] || [ "${APP_PORT}" -lt 1 ] || [ "${APP_PORT}" -gt 65535 ]; then
  failure 'APP_PORT must be an integer between 1 and 65535'
  exit 2
fi

listener_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -tiTCP:"${APP_PORT}" -sTCP:LISTEN 2>/dev/null | sort -u || true
    return
  fi

  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "${APP_PORT}" 2>/dev/null | tr ' ' '\n' | sed '/^$/d' | sort -u || true
    return
  fi

  failure 'Neither lsof nor fuser is available. Run make i.'
  return 1
}

pids="$(listener_pids)"
if [ -z "${pids}" ]; then
  success "Port ${APP_PORT} is already free"
  exit 0
fi

stage "Freeing TCP port ${APP_PORT}"
info "Listening process IDs: $(printf '%s' "${pids}" | tr '\n' ' ')"

while IFS= read -r pid; do
  [ -n "${pid}" ] || continue
  kill -TERM "${pid}" 2>/dev/null || true
done <<< "${pids}"

attempt=0
while [ "${attempt}" -lt 5 ]; do
  remaining="$(listener_pids)"
  [ -z "${remaining}" ] && break
  sleep 1
  attempt=$((attempt + 1))
done

remaining="$(listener_pids)"
if [ -n "${remaining}" ]; then
  warn "Processes ignored TERM; sending KILL: $(printf '%s' "${remaining}" | tr '\n' ' ')"
  while IFS= read -r pid; do
    [ -n "${pid}" ] || continue
    kill -KILL "${pid}" 2>/dev/null || true
  done <<< "${remaining}"
  sleep 1
fi

if [ -n "$(listener_pids)" ]; then
  failure "Port ${APP_PORT} is still occupied"
  exit 1
fi

success "Port ${APP_PORT} is free"
