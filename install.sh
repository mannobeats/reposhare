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

COMMAND="${1:-install}"
DEFAULT_DIR="${REPOSHARE_DIR:-$HOME/reposhare}"
DEFAULT_IMAGE="${REPOSHARE_IMAGE:-ghcr.io/mannobeats/reposhare:latest}"
DEFAULT_PORT="${REPOSHARE_PORT:-3417}"

check_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    warn "$1 is not installed."
    return 1
  fi

  success "$1 found: $(command -v "$1")"
  return 0
}

require_compose() {
  if ! command -v docker >/dev/null 2>&1; then
    warn "docker is required."
    exit 1
  fi

  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    return 0
  fi

  warn "Docker Compose plugin is required."
  exit 1
}

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
  local prompt_label="${1:-Installation directory}"
  prompt_value INSTALL_DIR "$(echo -e "${CYAN}▸${NC} ${prompt_label} [${DIM}${DEFAULT_DIR}${NC}]: ")" "$DEFAULT_DIR"
}

detect_local_ip() {
  local detected_ip=""

  if command -v ip >/dev/null 2>&1; then
    detected_ip="$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i = 1; i <= NF; i++) if ($i == "src") {print $(i+1); exit}}')"
  fi

  if [ -z "$detected_ip" ] && command -v hostname >/dev/null 2>&1; then
    detected_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  if [ -z "$detected_ip" ] && command -v ifconfig >/dev/null 2>&1; then
    detected_ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')"
  fi

  if [ -z "$detected_ip" ]; then
    detected_ip="localhost"
  fi

  printf '%s' "$detected_ip"
}

normalize_url() {
  local raw="${1:-}"
  local reverse_proxy="${2:-false}"

  raw="$(printf '%s' "$raw" | tr -d '[:space:]')"
  if [ -z "$raw" ]; then
    return 0
  fi

  if [[ "$raw" =~ ^https?:// ]]; then
    printf '%s' "${raw%/}"
    return 0
  fi

  if [ "$reverse_proxy" = "true" ]; then
    printf 'https://%s' "${raw%/}"
  else
    printf 'http://%s' "${raw%/}"
  fi
}

write_compose_file() {
  local target_dir="$1"
  cat > "$target_dir/docker-compose.yaml" <<'EOF'
services:
  app:
    image: ${REPOSHARE_IMAGE:-ghcr.io/mannobeats/reposhare:latest}
    container_name: reposhare
    restart: unless-stopped
    ports:
      - "${BIND_ADDRESS:-0.0.0.0}:${PORT:-3417}:3417"
    environment:
      NODE_ENV: production
      PORT: 3417
      DATABASE_URL: file:/data/reposhare.db
      PUBLIC_URL: ${PUBLIC_URL:-}
      APP_SECRET: ${APP_SECRET:-}
    volumes:
      - ./data:/data
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3417/api/health >/dev/null 2>&1 || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s
EOF
}

write_env_file() {
  local target_dir="$1"
  local image="$2"
  local port="$3"
  local bind_address="$4"
  local public_url="$5"
  local app_secret="$6"

  cat > "$target_dir/.env" <<EOF
REPOSHARE_IMAGE=${image}
PORT=${port}
BIND_ADDRESS=${bind_address}
PUBLIC_URL=${public_url}
APP_SECRET=${app_secret}
EOF
}

run_compose() {
  local target_dir="$1"
  shift
  (
    cd "$target_dir"
    $COMPOSE_CMD "$@"
  )
}

ensure_install_files() {
  local target_dir="$1"
  mkdir -p "$target_dir" "$target_dir/data" "$target_dir/backups"
  write_compose_file "$target_dir"
}

command_install() {
  header "RepoShare Installer"

  local missing_deps=()

  info "Checking system requirements..."
  echo ""

  check_command "docker" || missing_deps+=("docker")
  if command -v docker >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
      success "Docker Compose plugin found"
    else
      warn "Docker Compose plugin is required"
      missing_deps+=("docker compose")
    fi
  fi
  check_command "openssl" || missing_deps+=("openssl")
  echo ""

  if [ ${#missing_deps[@]} -gt 0 ]; then
    warn "Missing dependencies: ${missing_deps[*]}"
    echo -e "${DIM}Please install the missing tools and re-run this script.${NC}"
    exit 1
  fi

  require_compose

  header "Configuration"
  prompt_install_dir

  local port
  prompt_value port "$(echo -e "${CYAN}▸${NC} RepoShare port [${DIM}${DEFAULT_PORT}${NC}]: ")" "$DEFAULT_PORT"

  echo ""
  info "If you're putting RepoShare behind your own reverse proxy on this same server,"
  info "the installer can bind the app to localhost only."
  local reverse_proxy_reply
  prompt_value reverse_proxy_reply "$(echo -e "${CYAN}▸${NC} Bind only to localhost for a reverse proxy? (y/N): ")" ""

  local bind_address="0.0.0.0"
  local reverse_proxy_mode="false"
  if [[ "$reverse_proxy_reply" =~ ^[Yy]$ ]]; then
    bind_address="127.0.0.1"
    reverse_proxy_mode="true"
  fi

  local local_ip
  local_ip="$(detect_local_ip)"
  local default_public_url="http://${local_ip}:${port}"

  echo ""
  info "Enter the public URL or domain RepoShare should use for share links and GitHub callbacks."
  info "Examples: share.example.com, https://share.example.com, http://192.168.1.50:${port}"
  info "Leave blank to auto-detect a local URL."
  local public_url_input
  prompt_value public_url_input "$(echo -e "${CYAN}▸${NC} Public URL [${DIM}${default_public_url}${NC}]: ")" "$default_public_url"

  local public_url
  public_url="$(normalize_url "${public_url_input:-}" "$reverse_proxy_mode")"
  public_url="${public_url:-$default_public_url}"

  local app_secret
  app_secret="$(openssl rand -base64 48 | tr -d '\n')"

  if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yaml" ]; then
    warn "Existing RepoShare installation detected at $INSTALL_DIR"
    local replace_reply
    prompt_value replace_reply "$(echo -e "${CYAN}▸${NC} Replace install files and keep existing data/config? (Y/n): ")" "Y"
    if [[ "$replace_reply" =~ ^[Nn]$ ]]; then
      info "Aborting. Existing installation left untouched."
      exit 0
    fi
  fi

  header "Installing RepoShare"
  ensure_install_files "$INSTALL_DIR"

  if [ ! -f "$INSTALL_DIR/.env" ]; then
    info "Writing configuration..."
    write_env_file "$INSTALL_DIR" "$DEFAULT_IMAGE" "$port" "$bind_address" "$public_url" "$app_secret"
  else
    info "Keeping existing .env configuration."
  fi

  info "Pulling image..."
  run_compose "$INSTALL_DIR" pull

  info "Starting RepoShare..."
  run_compose "$INSTALL_DIR" up -d

  success "RepoShare is installed and starting up."
  echo ""
  echo -e "${GREEN}Public URL:${NC} ${BOLD}${public_url}${NC}"
  echo -e "${GREEN}Bind address:${NC} ${bind_address}"
  echo -e "${GREEN}Image:${NC} ${DEFAULT_IMAGE}"
  echo -e "${GREEN}Config file:${NC} ${INSTALL_DIR}/.env"
  echo ""
  echo -e "${DIM}Useful commands:${NC}"
  echo -e "  ${CYAN}bash install.sh update${NC}"
  echo -e "  ${CYAN}bash install.sh backup${NC}"
  echo -e "  ${CYAN}bash install.sh status${NC}"
  echo -e "  ${CYAN}cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f${NC}"
  echo ""

  if [ "$reverse_proxy_mode" = "true" ]; then
    echo -e "${DIM}Reverse proxy reminder:${NC} Proxy to http://127.0.0.1:${port} and forward Host + X-Forwarded-* headers."
  fi
}

command_update() {
  header "RepoShare Update"
  require_compose
  prompt_install_dir "Existing RepoShare directory"

  if [ ! -f "$INSTALL_DIR/docker-compose.yaml" ]; then
    warn "No RepoShare installation found at $INSTALL_DIR"
    exit 1
  fi

  ensure_install_files "$INSTALL_DIR"
  info "Pulling the latest RepoShare image..."
  run_compose "$INSTALL_DIR" pull
  info "Restarting RepoShare..."
  run_compose "$INSTALL_DIR" up -d
  success "RepoShare has been updated."
}

command_backup() {
  header "RepoShare Backup"
  require_compose
  prompt_install_dir "Existing RepoShare directory"

  if [ ! -f "$INSTALL_DIR/docker-compose.yaml" ]; then
    warn "No RepoShare installation found at $INSTALL_DIR"
    exit 1
  fi

  mkdir -p "$INSTALL_DIR/backups"
  local backup_path="$INSTALL_DIR/backups/reposhare-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

  info "Creating backup archive..."
  tar -czf "$backup_path" -C "$INSTALL_DIR" .env data docker-compose.yaml
  success "Backup created at $backup_path"
}

command_restore() {
  header "RepoShare Restore"
  require_compose
  prompt_install_dir "Existing RepoShare directory"

  if [ ! -f "$INSTALL_DIR/docker-compose.yaml" ]; then
    warn "No RepoShare installation found at $INSTALL_DIR"
    exit 1
  fi

  local backup_path="${2:-}"
  if [ -z "$backup_path" ]; then
    prompt_value backup_path "$(echo -e "${CYAN}▸${NC} Backup archive path: ")" ""
  fi

  if [ ! -f "$backup_path" ]; then
    warn "Backup archive not found: $backup_path"
    exit 1
  fi

  warn "This will replace the current install files, .env, and ./data contents."
  local confirm_restore
  prompt_value confirm_restore "$(echo -e "${CYAN}▸${NC} Continue with restore? (y/N): ")" ""
  if [[ ! "$confirm_restore" =~ ^[Yy]$ ]]; then
    info "Restore cancelled."
    exit 0
  fi

  mkdir -p "$INSTALL_DIR"
  tar -xzf "$backup_path" -C "$INSTALL_DIR"
  info "Restarting RepoShare..."
  run_compose "$INSTALL_DIR" up -d
  success "Restore completed."
}

command_status() {
  header "RepoShare Status"
  require_compose
  prompt_install_dir "Existing RepoShare directory"

  if [ ! -f "$INSTALL_DIR/docker-compose.yaml" ]; then
    warn "No RepoShare installation found at $INSTALL_DIR"
    exit 1
  fi

  if [ -f "$INSTALL_DIR/.env" ]; then
    info "Current configuration:"
    grep -E '^(REPOSHARE_IMAGE|PUBLIC_URL|PORT|BIND_ADDRESS)=' "$INSTALL_DIR/.env" || true
    echo ""
  fi

  run_compose "$INSTALL_DIR" ps
}

case "$COMMAND" in
  install)
    command_install
    ;;
  update)
    command_update
    ;;
  backup)
    command_backup
    ;;
  restore)
    command_restore "$@"
    ;;
  status)
    command_status
    ;;
  *)
    warn "Unknown command: $COMMAND"
    echo "Usage: bash install.sh [install|update|backup|restore|status]"
    exit 1
    ;;
esac
