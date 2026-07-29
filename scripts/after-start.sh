#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=scripts/ui.sh
source "${SCRIPT_DIR}/ui.sh"

APP_PORT="${APP_PORT:-3008}"
API_READY_ATTEMPTS="${API_READY_ATTEMPTS:-60}"
API_READY_DELAY="${API_READY_DELAY:-1}"
GRAPHQL_URL="${GRAPHQL_URL:-http://127.0.0.1:${APP_PORT}/graphql}"

cd "${PROJECT_ROOT}"
stage "Waiting for GraphQL on port ${APP_PORT}"

attempt=1
while [ "${attempt}" -le "${API_READY_ATTEMPTS}" ]; do
  if PORT="${APP_PORT}" node docker/healthcheck.mjs >/dev/null 2>&1; then
    success 'GraphQL is ready'
    GRAPHQL_URL="${GRAPHQL_URL}" node docker/smoke.mjs
    APP_PORT="${APP_PORT}" OPEN_BROWSER="${OPEN_BROWSER:-1}" bash scripts/open-dashboard.sh
    success 'Catalog is initialized and ready'
    exit 0
  fi

  sleep "${API_READY_DELAY}"
  attempt=$((attempt + 1))
done

failure "GraphQL did not become ready after ${API_READY_ATTEMPTS} attempts"
exit 1
