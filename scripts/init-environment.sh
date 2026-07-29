#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

# shellcheck source=scripts/ui.sh
source "${SCRIPT_DIR}/ui.sh"

NVM_VERSION='v0.40.4'
NODE_VERSION="$(tr -d '[:space:]' < "${PROJECT_ROOT}/.nvmrc")"
NPM_VERSION='11.16.0'
OS_NAME="${PHARMAFUSE_OS:-$(uname -s)}"
DISTRO="${PHARMAFUSE_DISTRO:-}"
DRY_RUN="${DRY_RUN:-0}"
CHECK_ONLY="${CHECK_ONLY:-0}"
REQUIRE_DOCKER="${REQUIRE_DOCKER:-0}"

on_error() {
  failure "Environment initialization failed at line ${1}"
}
trap 'on_error "${LINENO}"' ERR

print_plan() {
  stage "Environment plan for ${OS_NAME}"
  info "NVM ${NVM_VERSION}"
  info "Node.js ${NODE_VERSION}"
  info "npm ${NPM_VERSION}"
  info 'ShellCheck'
  info 'Docker Engine/Desktop with Compose'
  success 'Dry run completed without system changes'
}

load_nvm() {
  export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
  if [ ! -s "${NVM_DIR}/nvm.sh" ]; then
    failure "NVM is missing. Run make i."
    return 1
  fi

  # shellcheck source=/dev/null
  source "${NVM_DIR}/nvm.sh"
}

verify_environment() {
  stage 'Checking initialized environment'
  load_nvm
  nvm use "${NODE_VERSION}" >/dev/null

  [ "$(node --version)" = "v${NODE_VERSION}" ] || {
    failure "Expected Node.js ${NODE_VERSION}, got $(node --version)"
    return 1
  }
  [ "$(npm --version)" = "${NPM_VERSION}" ] || {
    failure "Expected npm ${NPM_VERSION}, got $(npm --version)"
    return 1
  }
  command -v shellcheck >/dev/null 2>&1 || {
    failure 'ShellCheck is missing. Run make i.'
    return 1
  }

  if [ "${REQUIRE_DOCKER}" = '1' ]; then
    docker compose version >/dev/null
    docker info >/dev/null
  fi

  success "Environment is ready: Node.js ${NODE_VERSION}, npm ${NPM_VERSION}"
}

install_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return
  fi

  stage 'Installing Homebrew'
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

wait_for_docker() {
  attempts=0
  until docker info >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -ge 60 ]; then
      failure 'Docker daemon did not become ready within 120 seconds'
      return 1
    fi
    sleep 2
  done
}

install_macos_tools() {
  install_homebrew

  if ! command -v shellcheck >/dev/null 2>&1; then
    stage 'Installing ShellCheck'
    brew install shellcheck
  fi

  if ! docker compose version >/dev/null 2>&1; then
    stage 'Installing Docker Desktop'
    brew install --cask docker-desktop
  fi

  if ! docker info >/dev/null 2>&1; then
    stage 'Starting Docker Desktop'
    open -a Docker
    wait_for_docker
  fi
}

load_ubuntu_release() {
  if [ -z "${DISTRO}" ] && [ -r /etc/os-release ]; then
    # shellcheck source=/dev/null
    source /etc/os-release
    DISTRO="${ID:-}"
  fi

  if [ "${DISTRO}" != 'ubuntu' ]; then
    failure "Unsupported Linux distribution: ${DISTRO:-unknown}. Ubuntu is required."
    return 1
  fi
}

configure_docker_apt_repository() {
  stage "Configuring Docker's official apt repository"
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc

  ubuntu_codename="$(
    # shellcheck source=/dev/null
    source /etc/os-release
    printf '%s' "${UBUNTU_CODENAME:-${VERSION_CODENAME}}"
  )"
  architecture="$(dpkg --print-architecture)"
  printf '%s\n' \
    'Types: deb' \
    'URIs: https://download.docker.com/linux/ubuntu' \
    "Suites: ${ubuntu_codename}" \
    'Components: stable' \
    "Architectures: ${architecture}" \
    'Signed-By: /etc/apt/keyrings/docker.asc' |
    sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
}

install_ubuntu_tools() {
  load_ubuntu_release
  stage 'Installing Ubuntu development tools'
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl git make lsof xdg-utils shellcheck

  if ! docker compose version >/dev/null 2>&1; then
    configure_docker_apt_repository
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  sudo systemctl enable --now docker
  if ! id -nG "${USER}" | tr ' ' '\n' | grep -qx docker; then
    sudo usermod -aG docker "${USER}"
    warn "User ${USER} was added to the docker group. Start a new login session before using Docker without sudo."
  fi
}

install_nvm_and_node() {
  export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
  if [ ! -s "${NVM_DIR}/nvm.sh" ]; then
    stage "Installing NVM ${NVM_VERSION}"
    curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
  fi

  # shellcheck source=/dev/null
  source "${NVM_DIR}/nvm.sh"

  stage "Installing Node.js ${NODE_VERSION} through NVM"
  nvm install "${NODE_VERSION}"
  nvm alias default "${NODE_VERSION}"
  nvm use "${NODE_VERSION}" >/dev/null

  if [ "$(npm --version)" != "${NPM_VERSION}" ]; then
    stage "Installing npm ${NPM_VERSION}"
    npm install --global "npm@${NPM_VERSION}"
  fi
}

case "${OS_NAME}" in
  Darwin)
    ;;
  Linux)
    if [ "${DRY_RUN}" != '1' ]; then
      load_ubuntu_release
    fi
    ;;
  *)
    failure "Unsupported operating system: ${OS_NAME}"
    exit 1
    ;;
esac

if [ "${DRY_RUN}" = '1' ]; then
  print_plan
  exit 0
fi

if [ "${CHECK_ONLY}" = '1' ]; then
  verify_environment
  exit 0
fi

stage "Initializing PharmaFuse on ${OS_NAME}"
if [ "${OS_NAME}" = 'Darwin' ]; then
  install_macos_tools
else
  install_ubuntu_tools
fi

install_nvm_and_node
make -C "${PROJECT_ROOT}" env
bash "${SCRIPT_DIR}/ensure-dependencies.sh"
verify_environment
success 'PharmaFuse environment initialized'
