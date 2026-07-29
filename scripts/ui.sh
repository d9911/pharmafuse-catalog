#!/usr/bin/env sh

if [ -n "${NO_COLOR:-}" ] || [ ! -t 1 ]; then
  GREEN=''
  YELLOW=''
  BLUE=''
  RED=''
  CYAN=''
  MAGENTA=''
  BOLD=''
  DIM=''
  UNDERLINE=''
  NC=''
else
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  RED='\033[0;31m'
  CYAN='\033[0;36m'
  MAGENTA='\033[0;35m'
  BOLD='\033[1m'
  DIM='\033[2m'
  UNDERLINE='\033[4m'
  NC='\033[0m'
fi

export GREEN YELLOW BLUE RED CYAN MAGENTA BOLD DIM UNDERLINE NC

stage() {
  printf '%b\n' "${BLUE}${BOLD}==> $*${NC}"
}

info() {
  printf '%b\n' "${CYAN}  • $*${NC}"
}

success() {
  printf '%b\n' "${GREEN}${BOLD}  ✓ $*${NC}"
}

warn() {
  printf '%b\n' "${YELLOW}${BOLD}  ! $*${NC}" >&2
}

failure() {
  printf '%b\n' "${RED}${BOLD}  ✗ $*${NC}" >&2
}
