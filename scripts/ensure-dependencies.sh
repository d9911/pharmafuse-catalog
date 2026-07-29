#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

# shellcheck source=scripts/ui.sh
source "${SCRIPT_DIR}/ui.sh"

LOCKFILE="${PROJECT_ROOT}/package-lock.json"
MARKER_DIR="${PROJECT_ROOT}/.cache"
MARKER_FILE="${MARKER_DIR}/package-lock.sha256"

hash_lockfile() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${LOCKFILE}" | awk '{print $1}'
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${LOCKFILE}" | awk '{print $1}'
    return
  fi

  failure 'SHA-256 utility not found (shasum or sha256sum is required)'
  return 1
}

if [ ! -f "${LOCKFILE}" ]; then
  failure "Lockfile not found: ${LOCKFILE}"
  exit 1
fi

current_hash="$(hash_lockfile)"
installed_hash=''
if [ -f "${MARKER_FILE}" ]; then
  installed_hash="$(tr -d '[:space:]' < "${MARKER_FILE}")"
fi

if [ -d "${PROJECT_ROOT}/node_modules" ] && [ "${installed_hash}" = "${current_hash}" ]; then
  success 'npm dependencies are already synchronized'
  exit 0
fi

stage 'Installing exact npm dependencies'
(
  cd "${PROJECT_ROOT}"
  npm ci
)

mkdir -p "${MARKER_DIR}"
printf '%s\n' "${current_hash}" > "${MARKER_FILE}"
success 'npm dependencies synchronized'
