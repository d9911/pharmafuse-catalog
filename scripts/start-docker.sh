#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=scripts/ui.sh
source "${SCRIPT_DIR}/ui.sh"

DRY_RUN="${DRY_RUN:-0}"
APP_PORT="${APP_PORT:-3008}"
OPEN_BROWSER="${OPEN_BROWSER:-1}"

print_plan() {
  stage 'Docker lifecycle'
  printf '%s\n' \
    '+ make docker-down' \
    '+ make port-free' \
    '+ make clean-build' \
    '+ make deps-ensure' \
    '+ make verify' \
    '+ make docker-config' \
    '+ make docker-build-clean' \
    '+ make docker-up-ready' \
    '+ make docker-health' \
    '+ make docker-smoke' \
    '+ open GraphiQL dashboard'
  success 'Dry run completed without changing Docker state'
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

on_error() {
  failure "Docker startup failed at line ${1}"
  docker compose logs --tail=100 api 2>/dev/null || true
}

if [ "${DRY_RUN}" = '1' ]; then
  print_plan
  exit 0
fi

trap 'on_error "${LINENO}"' ERR

activate_node
cd "${PROJECT_ROOT}"

stage 'Checking Docker environment'
REQUIRE_DOCKER=1 make env-check

make docker-down
make port-free
make clean-build
make deps-ensure
make verify
make docker-config
make docker-build-clean
make docker-up-ready
make docker-health
make docker-smoke
APP_PORT="${APP_PORT}" OPEN_BROWSER="${OPEN_BROWSER}" bash scripts/open-dashboard.sh

success 'Docker API is healthy and the catalog is initialized'
