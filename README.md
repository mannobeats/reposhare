# RepoShare

Self-hosted private repository sharing for people who should be able to clone or download a repo without needing their own GitHub access.

RepoShare sits between GitHub and your recipients:

- You install RepoShare once on your own server.
- You connect a GitHub App to the repositories you want to share.
- RepoShare creates share links for cloning and ZIP downloads.
- Recipients use the link. GitHub credentials never leave your server.

## What Changed

RepoShare now ships with a simpler hosting model on purpose:

- One container
- One SQLite database file
- One `data/` directory to back up
- No PostgreSQL
- No external database setup

This makes the default deployment much better for home labs, small VPSs, and single-instance self-hosting.

## Architecture

```text
Git client / browser
        |
        v
 RepoShare (Next.js app + SQLite)
        |
        v
     GitHub API
```

## Quick Start

### Option 1: One-liner installer

```bash
curl -fsSL https://raw.githubusercontent.com/mannobeats/reposhare/main/install.sh | bash
```

The installer:

- auto-detects a usable local URL if you do not provide one
- lets you choose direct access or reverse-proxy mode
- generates strong secrets automatically
- writes a minimal `.env`
- pulls and starts RepoShare from `ghcr.io/mannobeats/reposhare`

After install, open the printed URL and finish the setup wizard.

### Option 2: Docker Compose

```bash
git clone https://github.com/mannobeats/reposhare.git
cd reposhare
cp .env.example .env
docker compose up -d
```

That is enough for a working install. RepoShare initializes the SQLite database automatically on container start.

### Option 3: Local development

```bash
git clone https://github.com/mannobeats/reposhare.git
cd reposhare
npm install
cp .env.example .env
npm run db:init
npm run dev
```

Local development uses `./prisma/dev.db`.

## Configuration

RepoShare is intentionally small now. Most installs only need these settings:

```env
PORT=3417
BIND_ADDRESS=0.0.0.0
PUBLIC_URL=http://localhost:3417
APP_SECRET=replace_with_a_long_random_secret
```

### Variable reference

- `PUBLIC_URL`
  Used for share links, GitHub callback URLs, and webhook URLs. If you leave it blank in development, RepoShare can infer the current request origin.
- `APP_SECRET`
  Main signing secret for sessions and auth.
- `DATABASE_URL`
  SQLite file location. Use `file:/data/reposhare.db` in Docker and `file:./prisma/dev.db` for local development.
- `BIND_ADDRESS`
  Use `127.0.0.1` when you run RepoShare behind a reverse proxy on the same host.

## Setup Flow

### 1. Create the admin account

On first boot, RepoShare opens a setup page where you:

1. create the first admin account
2. optionally confirm or override the public URL

### 2. Create the GitHub App

From the dashboard:

1. click the GitHub App setup button
2. GitHub runs the App Manifest flow
3. RepoShare stores the returned app credentials
4. install the GitHub App on the account or organization that owns the repositories

### 3. Create share links

From the dashboard:

1. pick a repository
2. generate a share link
3. send the link to the recipient

Recipients can:

- `git clone https://your-host/share/<id>.git`
- open the public share page
- download a ZIP snapshot

## Deployment Modes

### Direct access on a LAN or VPS

Use:

```env
BIND_ADDRESS=0.0.0.0
PUBLIC_URL=http://your-server-ip:3417
```

This is the simplest mode when you do not need HTTPS termination inside RepoShare itself.

### Behind your own reverse proxy

Use:

```env
BIND_ADDRESS=127.0.0.1
PUBLIC_URL=https://share.example.com
```

RepoShare does not include a reverse proxy. That is intentional. Bring your own Nginx, Caddy, Traefik, or tunnel.

Your proxy must:

- forward `Host`
- forward `X-Forwarded-For`
- forward `X-Forwarded-Host`
- forward `X-Forwarded-Proto`
- disable buffering for Git HTTP traffic when possible

#### Nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name share.example.com;

    ssl_certificate     /etc/letsencrypt/live/share.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/share.example.com/privkey.pem;

    client_max_body_size 0;
    proxy_request_buffering off;
    proxy_buffering off;

    location / {
        proxy_pass http://127.0.0.1:3417;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

#### Caddy example

```caddyfile
share.example.com {
    request_body {
        max_size 0
    }

    reverse_proxy 127.0.0.1:3417 {
        header_up Host {host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
        flush_interval -1
    }
}
```

### Tunnel-based access

You can also keep RepoShare private on the host and expose it through a tunnel:

- Cloudflare Tunnel
- Tailscale Funnel
- ngrok

In those cases, set `PUBLIC_URL` to the final external URL the recipient will use.

## Backups and Restore

RepoShare keeps all state in:

- `./data/reposhare.db`
- `.env`

That means backup is simple:

```bash
bash install.sh backup
```

Restore is simple too:

```bash
bash install.sh restore /path/to/backup.tar.gz
```

## Installer Commands

The installer script also works as a maintenance tool:

```bash
bash install.sh install
bash install.sh update
bash install.sh backup
bash install.sh restore /path/to/backup.tar.gz
bash install.sh status
```

## Health Check

RepoShare exposes:

```text
/api/health
```

The Docker Compose file uses this endpoint for container health checks.

## Development Notes

- RepoShare is optimized for a single-instance deployment model.
- SQLite is the only supported database.
- The app uses checked-in SQL migrations plus a lightweight SQLite migration runner at startup.
- `npm run db:init` applies local migrations without requiring a separate database service.
- Production installs are image-based and pull from `ghcr.io/mannobeats/reposhare`.

## Why SQLite Only

This product is a natural fit for SQLite:

- single-node deployment
- low write volume
- simple backup story
- fewer things for self-hosters to manage

If RepoShare ever needs clustered or multi-writer deployments later, database strategy can be revisited. For the current product shape, SQLite keeps the deployment honest and dramatically simpler.
