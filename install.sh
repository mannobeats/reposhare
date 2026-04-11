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

print_banner() {
  echo ""
  echo -e "${BOLD}${BLUE}"
  cat << 'EOF'
   ____                  _____ __                  
   / __ \___  ____  ____ / ___// /_  ____ _________ 
  / /_/ / _ \/ __ \/ __ \\__ \/ __ \/ __ `/ ___/ _ \
 / _, _/  __/ /_/ / /_/ /__/ / / / / /_/ / /  /  __/
/_/ |_|\___/ .___/\____/____/_/ /_/\__,_/_/   \___/ 
          /_/
EOF
  echo -e "${NC}  ${DIM}Self-hosted repository sharing${NC}"
  echo ""
}

COMMAND="${1:-install}"
DEFAULT_DIR="${REPOSHARE_DIR:-$HOME/reposhare}"
DEFAULT_IMAGE="${REPOSHARE_IMAGE:-ghcr.io/mannobeats/reposhare:latest}"
DEFAULT_PORT="${REPOSHARE_PORT:-3417}"
DOCKER_BIN="sudo docker"
COMPOSE_CMD="sudo docker compose"

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

  if ! command -v sudo >/dev/null 2>&1; then
    warn "sudo is required."
    exit 1
  fi

  if [ -r /dev/tty ]; then
    sudo -v </dev/tty
  else
    sudo -v
  fi

  if $COMPOSE_CMD version >/dev/null 2>&1; then
    return 0
  fi

  warn "Docker Compose plugin is required."
  exit 1
}

_install_docker_apt() {
  info "Installing Docker via apt (official repository)..."
  sudo apt-get update -qq
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
}

_install_docker_dnf() {
  info "Installing Docker via dnf (official repository)..."
  sudo dnf -y install dnf-plugins-core
  sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
  sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
}

_install_docker_macos() {
  echo ""
  echo -e "  ${BOLD}1)${NC} Install Docker Desktop via Homebrew ${DIM}(recommended)${NC}"
  echo -e "  ${BOLD}2)${NC} Open Docker Desktop download page"
  echo -e "  ${BOLD}3)${NC} Cancel"
  echo ""
  local choice
  prompt_value choice "$(echo -e "${CYAN}▸${NC} Select an option [1]: ")" "1"
  echo ""
  case "$choice" in
    2)
      info "Opening Docker Desktop download page..."
      open "https://www.docker.com/products/docker-desktop/" 2>/dev/null || true
      echo -e "  ${DIM}Visit: https://www.docker.com/products/docker-desktop/${NC}"
      echo -e "  ${DIM}Re-run this script after installation.${NC}"
      exit 0
      ;;
    3)
      info "Cancelled."
      exit 0
      ;;
    *)
      if ! command -v brew >/dev/null 2>&1; then
        warn "Homebrew is not installed. Install it from https://brew.sh, then re-run."
        exit 1
      fi
      info "Installing Docker Desktop via Homebrew..."
      brew install --cask docker
      echo ""
      success "Docker Desktop installed."
      info "Launch Docker Desktop from your Applications folder to start the daemon, then re-run this script."
      exit 0
      ;;
  esac
}

_install_docker_linux() {
  echo ""
  local distro_id="" distro_pretty=""
  if [ -f /etc/os-release ]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    distro_id="${ID:-}"
    distro_pretty="${PRETTY_NAME:-Linux}"
  fi
  info "Distribution: ${distro_pretty:-Unknown}"
  echo ""

  local opt2_label=""
  case "$distro_id" in
    ubuntu|debian|linuxmint|pop)         opt2_label="Install via apt (official Docker repository)" ;;
    fedora|rhel|centos|rocky|almalinux)  opt2_label="Install via dnf (official Docker repository)" ;;
    arch|manjaro|endeavouros)            opt2_label="Install via pacman" ;;
  esac

  echo -e "  ${BOLD}1)${NC} Install via Docker's convenience script ${DIM}(get.docker.com — recommended)${NC}"
  [ -n "$opt2_label" ] && echo -e "  ${BOLD}2)${NC} ${opt2_label}"
  echo -e "  ${BOLD}3)${NC} Open Docker installation docs"
  echo -e "  ${BOLD}4)${NC} Cancel"
  echo ""
  local choice
  prompt_value choice "$(echo -e "${CYAN}▸${NC} Select an option [1]: ")" "1"
  echo ""
  case "$choice" in
    2)
      case "$distro_id" in
        ubuntu|debian|linuxmint|pop)        _install_docker_apt ;;
        fedora|rhel|centos|rocky|almalinux) _install_docker_dnf ;;
        arch|manjaro|endeavouros)
          sudo pacman -Sy --noconfirm docker
          sudo systemctl enable --now docker
          ;;
        *)
          warn "No distribution-specific installer for '${distro_id}'. Use option 1 instead."
          exit 1
          ;;
      esac
      ;;
    3)
      info "Opening Docker documentation..."
      xdg-open "https://docs.docker.com/engine/install/" 2>/dev/null || true
      echo -e "  ${DIM}Visit: https://docs.docker.com/engine/install/${NC}"
      echo -e "  ${DIM}Re-run this script after installation.${NC}"
      exit 0
      ;;
    4)
      info "Cancelled."
      exit 0
      ;;
    *)
      if ! command -v curl >/dev/null 2>&1; then
        warn "curl is required to download the Docker install script."
        exit 1
      fi
      info "Running Docker convenience script from get.docker.com..."
      curl -fsSL https://get.docker.com | sh
      ;;
  esac
}

install_docker() {
  warn "Docker is not installed on this system."
  echo ""
  echo -e "  ${DIM}RepoShare requires Docker to run. Would you like to install it now?${NC}"
  echo ""
  local install_reply
  prompt_value install_reply "$(echo -e "${CYAN}▸${NC} Install Docker automatically? (Y/n): ")" "Y"
  if [[ "$install_reply" =~ ^[Nn]$ ]]; then
    echo ""
    echo -e "  ${DIM}Install Docker manually: https://docs.docker.com/get-docker/${NC}"
    exit 1
  fi
  echo ""
  local os_type
  os_type="$(uname -s)"
  case "$os_type" in
    Darwin) _install_docker_macos ;;
    Linux)  _install_docker_linux ;;
    *)
      warn "Unsupported OS: $os_type"
      echo -e "  ${DIM}Install Docker manually: https://docs.docker.com/get-docker/${NC}"
      exit 1
      ;;
  esac
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
    init: true
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
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3417/api/health').then((res)=>res.ok?res.json().then((body)=>body.ok?process.exit(0):process.exit(1)):process.exit(1)).catch(()=>process.exit(1))"]
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

wait_for_healthy() {
  local target_dir="$1"
  local service_name="${2:-app}"
  local attempts="${3:-30}"
  local delay_seconds="${4:-2}"
  local container_id=""
  local status=""

  container_id="$(run_compose "$target_dir" ps -q "$service_name" | tail -n 1)"
  if [ -z "$container_id" ]; then
    warn "Could not determine the running container for ${service_name}."
    return 1
  fi

  info "Waiting for RepoShare to become healthy..."
  for _ in $(seq 1 "$attempts"); do
    status="$($DOCKER_BIN inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    case "$status" in
      healthy|running)
        success "RepoShare is healthy."
        return 0
        ;;
      unhealthy|exited|dead)
        warn "RepoShare reported status: ${status}"
        run_compose "$target_dir" logs --tail=120 || true
        return 1
        ;;
    esac
    sleep "$delay_seconds"
  done

  warn "RepoShare did not become healthy in time."
  run_compose "$target_dir" logs --tail=120 || true
  return 1
}

install_openssl() {
  local os_type
  os_type="$(uname -s)"

  case "$os_type" in
    Darwin)
      if ! command -v brew >/dev/null 2>&1; then
        warn "openssl is required and Homebrew is not installed."
        echo -e "${DIM}Install Homebrew from https://brew.sh and re-run.${NC}"
        return 1
      fi
      info "Installing openssl via Homebrew..."
      brew install openssl
      ;;
    Linux)
      if [ -f /etc/os-release ]; then
        # shellcheck source=/dev/null
        . /etc/os-release
      fi
      case "${ID:-}" in
        ubuntu|debian|linuxmint|pop)
          info "Installing openssl via apt..."
          sudo apt-get update -qq
          sudo apt-get install -y openssl
          ;;
        fedora|rhel|centos|rocky|almalinux)
          info "Installing openssl via dnf..."
          sudo dnf -y install openssl
          ;;
        arch|manjaro|endeavouros)
          info "Installing openssl via pacman..."
          sudo pacman -Sy --noconfirm openssl
          ;;
        *)
          warn "openssl is required, but this Linux distribution is not handled automatically."
          return 1
          ;;
      esac
      ;;
    *)
      warn "openssl is required, but automatic installation is not supported on this OS."
      return 1
      ;;
  esac
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

  # Check Docker separately — offer to install if missing
  if ! check_command "docker"; then
    echo ""
    install_docker
    echo ""
    check_command "docker" || { warn "Docker is still unavailable. Please install it manually and re-run."; exit 1; }
  fi

  check_command "sudo" || missing_deps+=("sudo")
  if ! check_command "openssl"; then
    echo ""
    local install_openssl_reply
    prompt_value install_openssl_reply "$(echo -e "${CYAN}▸${NC} openssl is required. Install it now? (Y/n): ")" "Y"
    if [[ ! "$install_openssl_reply" =~ ^[Nn]$ ]]; then
      install_openssl || { warn "openssl installation failed."; exit 1; }
    fi
    check_command "openssl" || missing_deps+=("openssl")
  fi
  echo ""

  if [ ${#missing_deps[@]} -gt 0 ]; then
    warn "Missing dependencies: ${missing_deps[*]}"
    if printf '%s\n' "${missing_deps[@]}" | grep -qx "sudo"; then
      echo -e "${DIM}sudo is required for Docker administration and cannot be bootstrapped safely from this installer.${NC}"
    fi
    echo -e "${DIM}Please install the missing tools and re-run this script.${NC}"
    exit 1
  fi

  require_compose
  success "Docker Compose plugin found"
  success "Docker daemon access confirmed through sudo"

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
  if [ "$reverse_proxy_mode" = "true" ]; then
    info "Because reverse proxy mode is enabled, this must be the external URL served by your proxy."
    info "Do not use 127.0.0.1 or the server's LAN IP here unless clients will really browse through that address."
  else
    info "Leave blank to auto-detect a local URL."
  fi
  local public_url_input
  if [ "$reverse_proxy_mode" = "true" ]; then
    prompt_value public_url_input "$(echo -e "${CYAN}▸${NC} Public URL or domain served by your proxy: ")" ""
  else
    prompt_value public_url_input "$(echo -e "${CYAN}▸${NC} Public URL [${DIM}${default_public_url}${NC}]: ")" "$default_public_url"
  fi

  local public_url
  public_url="$(normalize_url "${public_url_input:-}" "$reverse_proxy_mode")"
  if [ "$reverse_proxy_mode" = "true" ]; then
    if [ -z "$public_url" ]; then
      warn "Reverse proxy mode requires an explicit external URL or domain."
      echo -e "${DIM}Example: https://share.example.com${NC}"
      exit 1
    fi
  else
    public_url="${public_url:-$default_public_url}"
  fi

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
  wait_for_healthy "$INSTALL_DIR"

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
    echo -e "${DIM}Reverse proxy reminder:${NC} RepoShare is only listening on 127.0.0.1:${port}."
    echo -e "${DIM}It will not be reachable at ${public_url} until your proxy forwards traffic to http://127.0.0.1:${port}.${NC}"
    echo -e "${DIM}Forward Host + X-Forwarded-* headers from the proxy.${NC}"
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
  wait_for_healthy "$INSTALL_DIR"
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

  info "Stopping RepoShare..."
  run_compose "$INSTALL_DIR" down || true

  mkdir -p "$INSTALL_DIR"
  rm -rf "$INSTALL_DIR/data"
  rm -f "$INSTALL_DIR/.env" "$INSTALL_DIR/docker-compose.yaml"
  tar -xzf "$backup_path" -C "$INSTALL_DIR"
  info "Restarting RepoShare..."
  run_compose "$INSTALL_DIR" up -d
  wait_for_healthy "$INSTALL_DIR"
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

print_banner

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
