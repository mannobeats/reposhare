#!/usr/bin/env bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()    { echo -e "${CYAN}▸${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${RED}▸${NC} $1"; }
header()  { echo -e "\n${BOLD}${BLUE}═══════════════════════════════════════${NC}"; echo -e "${BOLD}${BLUE}  $1${NC}"; echo -e "${BOLD}${BLUE}═══════════════════════════════════════${NC}\n"; }

DEFAULT_DIR="${REPOSHARE_DIR:-$HOME/reposhare}"
COMPOSE_CMD="sudo docker compose"
INSTALL_DIR=""

prompt_value() {
  local __result_var="$1"
  local prompt_text="$2"
  local default_value="${3:-}"
  local response=""

  if [ -r /dev/tty ]; then
    read -r -p "$prompt_text" response </dev/tty || true
  else
    read -r -p "$prompt_text" response || true
  fi

  if [ -z "$response" ]; then
    response="$default_value"
  fi

  printf -v "$__result_var" '%s' "$response"
}

prompt_install_dir() {
  prompt_value INSTALL_DIR "$(echo -e "${CYAN}▸${NC} RepoShare installation directory [${DIM}${DEFAULT_DIR}${NC}]: ")" "$DEFAULT_DIR"
}

require_compose() {
  if ! command -v docker >/dev/null 2>&1; then
    warn "docker is required."
    exit 1
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    warn "sudo is required."
    exit 1
  fi

  if [ -r /dev/tty ]; then
    sudo -v </dev/tty
  else
    sudo -v
  fi

  if ! $COMPOSE_CMD version >/dev/null 2>&1; then
    warn "Docker Compose plugin is required."
    exit 1
  fi
}

header "RepoShare Uninstaller"

info "Checking system requirements..."

require_compose
success "Docker Compose plugin found"
success "Docker daemon access confirmed through sudo"

echo ""
prompt_install_dir

if [ ! -d "$INSTALL_DIR" ]; then
  warn "No directory found at $INSTALL_DIR"
  exit 1
fi

echo ""
warn "This will stop and remove the RepoShare container and install files."
prompt_value confirm_uninstall "$(echo -e "${CYAN}▸${NC} Continue uninstalling RepoShare? (y/N): ")" ""
if [[ ! "$confirm_uninstall" =~ ^[Yy]$ ]]; then
  info "Uninstall cancelled."
  exit 0
fi

if [ -f "$INSTALL_DIR/docker-compose.yaml" ]; then
  info "Stopping and removing RepoShare..."
  (
    cd "$INSTALL_DIR"
    $COMPOSE_CMD down --remove-orphans
  )
else
  info "No docker-compose.yaml found. Skipping container shutdown."
fi

prompt_value remove_data "$(echo -e "${CYAN}▸${NC} Also delete all RepoShare data, backups, and configuration? (y/N): ")" ""

if [[ "$remove_data" =~ ^[Yy]$ ]]; then
  info "Removing ${INSTALL_DIR}..."
  rm -rf "$INSTALL_DIR"
  success "RepoShare and all stored data were removed."
else
  info "Removing install files and leaving data behind..."
  rm -f "$INSTALL_DIR/docker-compose.yaml"
  success "RepoShare was uninstalled."
  echo -e "${DIM}Data retained at:${NC} ${INSTALL_DIR}/data"
  echo -e "${DIM}Backups retained at:${NC} ${INSTALL_DIR}/backups"
  if [ -f "$INSTALL_DIR/.env" ]; then
    echo -e "${DIM}Configuration retained at:${NC} ${INSTALL_DIR}/.env"
  fi
fi
