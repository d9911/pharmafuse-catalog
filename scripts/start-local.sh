#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=scripts/ui.sh
source "${SCRIPT_DIR}/ui.sh"

DRY_RUN="${DRY_RUN:-0}"
APP_PORT="${APP_PORT:-3008}"
OPEN_BROWSER="${OPEN_BROWSER:-1}"
helper_pid=''
dev_pid=''

print_plan() {
  stage 'Local development lifecycle'
  printf '%s\n' \
    '+ make docker-down (when Docker is running)' \
    '+ make port-free' \
    '+ make clean-build' \
    '+ make deps-ensure' \
    '+ make migrate' \
    '+ make verify' \
    '+ start readiness/import/browser helper' \
    '+ make dev'
  success 'Dry run completed without starting the application'
}

activate_node() {
  export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
  if [ ! -s "${NVM_DIR}/nvm.sh" ]; then
    failure 'NVM is missing. Run make i.'
    return 1
  fi

  # shellcheck source=/dev/null
  source "${NVM_DIR}/nvm.sh"
  node_version="$(tr -d '[:space:]' < "${PROJECT_ROOT}/.nvmrc")"
  nvm use "${node_version}" >/dev/null
}

# ShellCheck cannot follow function references passed to trap.
# shellcheck disable=SC2329
terminate_tree() {
  pid="$1"
  [ -n "${pid}" ] || return 0
  kill -0 "${pid}" 2>/dev/null || return 0
  pkill -TERM -P "${pid}" 2>/dev/null || true
  kill -TERM "${pid}" 2>/dev/null || true
}

# shellcheck disable=SC2329
cleanup() {
  terminate_tree "${helper_pid}"
  terminate_tree "${dev_pid}"
}

# shellcheck disable=SC2329
handle_signal() {
  warn 'Stopping local development'
  exit 130
}

if [ "${DRY_RUN}" = '1' ]; then
  print_plan
  exit 0
fi

trap cleanup EXIT
trap handle_signal INT TERM

activate_node
cd "${PROJECT_ROOT}"

stage 'Checking local environment'
make env-check

if docker info >/dev/null 2>&1; then
  stage 'Stopping the project Docker stack'
  make docker-down
else
  info 'Docker is not running; no project container to stop'
fi

make port-free
make clean-build
make deps-ensure
make migrate
make verify

stage 'Starting local NestJS development'
APP_PORT="${APP_PORT}" OPEN_BROWSER="${OPEN_BROWSER}" bash scripts/after-start.sh &
helper_pid="$!"
make dev &
dev_pid="$!"

while :; do
  if ! kill -0 "${dev_pid}" 2>/dev/null; then
    set +e
    wait "${dev_pid}"
    dev_status="$?"
    set -e
    dev_pid=''
    exit "${dev_status}"
  fi

  if [ -n "${helper_pid}" ] && ! kill -0 "${helper_pid}" 2>/dev/null; then
    set +e
    wait "${helper_pid}"
    helper_status="$?"
    set -e
    helper_pid=''

    if [ "${helper_status}" -ne 0 ]; then
      failure 'Readiness, catalog initialization, or dashboard opening failed'
      exit "${helper_status}"
    fi

    success 'Local development is ready; press Ctrl+C to stop'
    break
  fi

  sleep 1
done

set +e
wait "${dev_pid}"
dev_status="$?"
set -e
dev_pid=''
exit "${dev_status}"
