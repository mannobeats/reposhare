<div align="center">

# 🔗 RepoShare

**Securely share private GitHub repositories via proxy URLs.**

[![CI](https://github.com/mannobeats/reposhare/actions/workflows/ci.yaml/badge.svg)](https://github.com/mannobeats/reposhare/actions/workflows/ci.yaml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](docker-compose.yaml)

*Self-hosted platform that creates shareable proxy URLs for your private GitHub repositories — without exposing credentials.*

</div>

---

## ✨ What is RepoShare?

RepoShare acts as a **Git proxy bridge** between your private GitHub repositories and anyone you want to share them with. When you create a share link, RepoShare:

1. Generates a unique URL for your private repository
2. Proxies Git Smart HTTP protocol requests through your server
3. Authenticates with GitHub using short-lived Installation Access Tokens
4. Anyone with the link can `git clone` the repo — no GitHub account needed

```bash
# Your collaborator runs this — no GitHub credentials required
git clone https://share.yourdomain.com/share/abc123-def456.git
```

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Git Client  │────▶│   RepoShare      │────▶│  GitHub API  │
│  or Browser  │◀────│   (Your Server)  │◀────│  (Private)   │
└─────────────┘     └──────────────────┘     └─────────────┘
                         │         ▲
                         ▼         │
                    ┌──────────────┐
                    │  PostgreSQL  │
                    └──────────────┘
```

**Key Features:**
- 🔐 **Proxy-based sharing** — credentials never leave your server
- 📦 **Git clone + ZIP download** — full flexibility for recipients
- ⏰ **Expiring links** — set time-limited access
- 🏠 **Self-hosted** — runs on your infrastructure (home lab, VPS, cloud)
- 🐳 **Docker-ready** — one command deployment
- 📊 **Analytics** — track views, clones, and downloads per link

---

## 🚀 Quick Start

### Option 1: One-Liner Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/mannobeats/reposhare/main/install.sh | bash
```

The interactive installer will:
- ✅ Check for Docker & Git
- ✅ Prompt for installation directory, port, and domain
- ✅ Generate secure passwords and secrets
- ✅ Build and start all services
- ✅ Apply database migrations

### Option 2: Docker Compose (Manual)

```bash
# Clone the repository
git clone https://github.com/mannobeats/reposhare.git
cd reposhare

# Create your environment file
cp .env.example .env
# Edit .env with your settings (see Configuration section below)

# Start services
docker compose up -d

# Apply database schema
docker compose exec app npx prisma db push
```

### Option 3: Local Development

```bash
# Clone and install
git clone https://github.com/mannobeats/reposhare.git
cd reposhare
npm install

# Setup environment
cp .env.example .env
# Edit .env — set your DATABASE_URL to a local PostgreSQL instance

# Initialize database
npx prisma db push

# Start dev server
npm run dev
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root (or use the installer):

```env
# ── Database ─────────────────────────────────────────────────
POSTGRES_USER=reposhare
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=reposhare
DATABASE_URL=postgresql://reposhare:your_secure_password_here@db:5432/reposhare

# ── Application ──────────────────────────────────────────────
# Public URL where RepoShare is accessible (used for clone URLs and GitHub webhooks)
# Examples:
#   - https://share.yourdomain.com  (production with reverse proxy)
#   - http://192.168.1.100:3000     (home lab, LAN access)
#   - http://localhost:3000          (local development)
PUBLIC_URL=http://localhost:3000

# Auth secret — auto-generated if not specified
# Generate one: openssl rand -base64 32
NEXTAUTH_SECRET=

# Port to expose (default: 3000)
PORT=3000
```

### `.env.example`

A template is included in the repository. Copy it and fill in your values:

```bash
cp .env.example .env
```

---

## 🔧 Setup Guide

### 1. First-Time Setup

After starting RepoShare, navigate to `http://your-server:3000` in your browser. You'll be greeted by the **setup wizard** where you:

1. **Create your admin account** (email + password)
2. **Set the public URL** (optional — required for GitHub webhooks)

### 2. Connect GitHub

From the dashboard:

1. Click **"Create GitHub App"** — this redirects to GitHub's App Manifest flow
2. GitHub will ask you to confirm the app creation
3. You'll be redirected back — the app credentials are saved automatically
4. **Install the app** on your GitHub account or organization
5. Select which repositories to grant access to

### 3. Create Share Links

1. Go to the **"Proxy Endpoints"** tab
2. Select a repository from the dropdown
3. Optionally set an expiration period
4. Click **"Generate Proxy Link"**
5. Share the generated URL with anyone!

---

## 🌐 Deployment Scenarios

### Public Server (VPS / Cloud)

The recommended production deployment uses a reverse proxy for HTTPS:

```
Internet → Nginx/Caddy (HTTPS) → RepoShare (:3000) → GitHub API
```

#### With Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name share.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/share.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/share.yourdomain.com/privkey.pem;

    # Important: disable request buffering for git operations
    proxy_request_buffering off;
    proxy_buffering off;
    client_max_body_size 0;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

#### With Caddy (auto-HTTPS)

```Caddyfile
share.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Set your `.env`:
```env
PUBLIC_URL=https://share.yourdomain.com
```

### Home Lab (LAN Only)

RepoShare works great on a home lab for sharing within your local network:

```env
PUBLIC_URL=http://192.168.1.100:3000
```

> **Note:** GitHub webhooks won't reach your server without a public URL, but this is non-critical. The dashboard fetches installation data directly from the GitHub API.

### Home Lab + Tunnel (External Access)

For sharing outside your LAN without exposing ports, use a tunnel service:

#### Cloudflare Tunnel (Recommended)

```bash
# Install cloudflared
brew install cloudflared  # or your package manager

# Create tunnel
cloudflared tunnel create reposhare
cloudflared tunnel route dns reposhare share.yourdomain.com

# Run tunnel
cloudflared tunnel run --url http://localhost:3000 reposhare
```

#### Tailscale Funnel

```bash
tailscale funnel 3000
```

#### ngrok

```bash
ngrok http 3000
```

Update `PUBLIC_URL` in `.env` to match the tunnel URL.

---

## 📁 Project Structure

```
reposhare/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth.js authentication
│   │   │   ├── download/      # ZIP download endpoint
│   │   │   └── github/        # GitHub App setup & webhooks
│   │   ├── dashboard/         # Admin dashboard
│   │   ├── setup/             # First-time setup wizard
│   │   └── share/[id]/        # Public share page + Git proxy
│   │       ├── page.tsx       # Share page UI
│   │       ├── info/refs/     # Git Smart HTTP refs endpoint
│   │       └── git-upload-pack/ # Git Smart HTTP pack endpoint
│   ├── components/ui/         # Reusable UI components
│   └── lib/                   # Shared utilities (Prisma, GitHub)
├── prisma/
│   └── schema.prisma          # Database schema
├── docker-compose.yaml        # Docker Compose configuration
├── Dockerfile                 # Multi-stage production build
├── install.sh                 # One-liner interactive installer
└── .github/workflows/         # CI/CD pipeline
```

---

## 🔒 Security

RepoShare is designed with security in mind:

- **Short-lived tokens** — GitHub Installation Access Tokens expire after 1 hour
- **No credential sharing** — GitHub credentials never leave your server
- **Auth-protected dashboard** — all admin actions require authentication
- **Ownership verification** — users can only manage their own share links
- **Setup guard** — the setup page is locked after initial configuration
- **Non-root Docker** — the container runs as an unprivileged user

### Security Best Practices

1. **Always use HTTPS** in production (via reverse proxy)
2. **Set a strong `NEXTAUTH_SECRET`** — the installer generates one automatically
3. **Use a strong PostgreSQL password** — never use defaults in production
4. **Keep RepoShare updated** — pull the latest version regularly

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev

# Run linter
npm run lint

# Build for production
npm run build
```

### Database Migrations

```bash
# Create a migration
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using Next.js, Prisma, and PostgreSQL**

[Report a Bug](https://github.com/mannobeats/reposhare/issues) · [Request a Feature](https://github.com/mannobeats/reposhare/issues)

</div>
