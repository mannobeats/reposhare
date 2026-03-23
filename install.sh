#!/usr/bin/env bash
# ============================================================
# RepoShare — Interactive Installer
# One-liner: curl -fsSL https://raw.githubusercontent.com/mannobeats/reposhare/main/install.sh | bash
# ============================================================

set -euo pipefail

# ── Colors & helpers ────────────────────────────────────────
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

# ── Preflight checks ───────────────────────────────────────
header "RepoShare Installer v1.0.0"

check_command() {
  if ! command -v "$1" &>/dev/null; then
    warn "$1 is not installed."
    return 1
  fi
  success "$1 found: $(command -v "$1")"
  return 0
}

MISSING_DEPS=()

info "Checking system requirements..."
echo ""

check_command "docker" || MISSING_DEPS+=("docker")
check_command "docker" && {
  if docker compose version &>/dev/null; then
    success "Docker Compose plugin found"
  elif command -v docker-compose &>/dev/null; then
    success "docker-compose (standalone) found"
  else
    warn "Docker Compose is not available"
    MISSING_DEPS+=("docker-compose")
  fi
}
check_command "git" || MISSING_DEPS+=("git")
check_command "curl" || MISSING_DEPS+=("curl")
check_command "openssl" || MISSING_DEPS+=("openssl")

echo ""

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
  warn "Missing dependencies: ${MISSING_DEPS[*]}"
  echo ""
  echo -e "${DIM}Please install the missing tools and re-run this script.${NC}"
  echo -e "${DIM}  Docker: https://docs.docker.com/get-docker/${NC}"
  echo -e "${DIM}  Git:    https://git-scm.com/downloads${NC}"
  exit 1
fi

success "All dependencies satisfied!"
echo ""

# ── Installation directory ──────────────────────────────────
header "Configuration"

DEFAULT_DIR="$HOME/reposhare"
read -rp "$(echo -e "${CYAN}▸${NC} Installation directory [${DIM}${DEFAULT_DIR}${NC}]: ")" INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_DIR}"

if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yaml" ]; then
  warn "Existing RepoShare installation detected at $INSTALL_DIR"
  read -rp "$(echo -e "${CYAN}▸${NC} Overwrite? (y/N): ")" OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
    info "Aborting. Your existing installation is untouched."
    exit 0
  fi
fi

# ── Port configuration ──────────────────────────────────────
read -rp "$(echo -e "${CYAN}▸${NC} Port to expose RepoShare on [${DIM}3000${NC}]: ")" PORT
PORT="${PORT:-3000}"

# ── Public URL (optional) ───────────────────────────────────
echo ""
info "If you have a domain pointing to this server (e.g. https://share.example.com),"
info "enter it below. Leave blank for localhost access only."
echo ""
read -rp "$(echo -e "${CYAN}▸${NC} Public URL [${DIM}http://localhost:${PORT}${NC}]: ")" PUBLIC_URL
PUBLIC_URL="${PUBLIC_URL:-http://localhost:${PORT}}"

# ── Generate secrets ────────────────────────────────────────
NEXTAUTH_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

echo ""
header "Installing RepoShare"

# ── Clone repository ────────────────────────────────────────
info "Downloading RepoShare..."
if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR"
  git pull --quiet origin main 2>/dev/null || true
else
  git clone --quiet --depth 1 https://github.com/mannobeats/reposhare.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
success "Source code ready"

# ── Create .env file ────────────────────────────────────────
info "Generating configuration..."

cat > "$INSTALL_DIR/.env" <<EOF
# ============================================================
# RepoShare Environment Configuration
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ============================================================

# Database
POSTGRES_USER=reposhare
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=reposhare

# Application
DATABASE_URL=postgresql://reposhare:${POSTGRES_PASSWORD}@db:5432/reposhare
NEXTAUTH_URL=${PUBLIC_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
PUBLIC_URL=${PUBLIC_URL}
PORT=${PORT}
EOF

success "Environment file created"

# ── Build & Start ───────────────────────────────────────────
info "Building Docker images (this may take a few minutes)..."
echo ""

if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD build --quiet 2>&1 | while IFS= read -r line; do
  echo -e "  ${DIM}${line}${NC}"
done

success "Docker images built"

info "Starting services..."
$COMPOSE_CMD up -d

# Wait for health
info "Waiting for database to be ready..."
sleep 5

# Run migrations
info "Applying database migrations..."
$COMPOSE_CMD exec -T app npx prisma migrate deploy 2>/dev/null || {
  warn "Migrations not yet created — running db push instead..."
  $COMPOSE_CMD exec -T app npx prisma db push 2>/dev/null || true
}

success "Database schema applied"

echo ""
header "Installation Complete! 🎉"

echo -e "${GREEN}RepoShare is running at:${NC} ${BOLD}${PUBLIC_URL}${NC}"
echo ""
echo -e "${DIM}Next steps:${NC}"
echo -e "  1. Open ${BOLD}${PUBLIC_URL}${NC} in your browser"
echo -e "  2. Create your admin account on the setup page"
echo -e "  3. Connect your GitHub App"
echo -e "  4. Start sharing repositories!"
echo ""
echo -e "${DIM}Useful commands:${NC}"
echo -e "  ${CYAN}cd ${INSTALL_DIR}${NC}"
echo -e "  ${CYAN}${COMPOSE_CMD} logs -f${NC}        ${DIM}# View logs${NC}"
echo -e "  ${CYAN}${COMPOSE_CMD} down${NC}            ${DIM}# Stop services${NC}"
echo -e "  ${CYAN}${COMPOSE_CMD} up -d${NC}            ${DIM}# Start services${NC}"
echo -e "  ${CYAN}${COMPOSE_CMD} pull && ${COMPOSE_CMD} up -d --build${NC}  ${DIM}# Update${NC}"
echo ""
echo -e "${DIM}Installation directory: ${INSTALL_DIR}${NC}"
echo -e "${DIM}Configuration file:     ${INSTALL_DIR}/.env${NC}"
echo ""
