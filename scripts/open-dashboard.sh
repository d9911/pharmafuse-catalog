#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/ui.sh
source "${SCRIPT_DIR}/ui.sh"

APP_PORT="${APP_PORT:-3008}"
OPEN_BROWSER="${OPEN_BROWSER:-1}"
OS_NAME="${PHARMAFUSE_OS:-$(uname -s)}"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:${APP_PORT}/graphiql}"

printf '%b\n' "${MAGENTA}${BOLD}GraphiQL dashboard:${NC} ${UNDERLINE}${DASHBOARD_URL}${NC}"

if [ "${OPEN_BROWSER}" = '0' ]; then
  info 'Automatic browser opening is disabled'
  exit 0
fi

case "${OS_NAME}" in
  Darwin)
    open "${DASHBOARD_URL}"
    success 'GraphiQL opened in the default browser'
    ;;
  Linux)
    if { [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; } && command -v xdg-open >/dev/null 2>&1; then
      xdg-open "${DASHBOARD_URL}" >/dev/null 2>&1 &
      success 'GraphiQL opened in the default browser'
    else
      warn 'No graphical Linux session detected; open the printed URL manually'
    fi
    ;;
  *)
    warn "Browser opening is unsupported on ${OS_NAME}; open the printed URL manually"
    ;;
esac
