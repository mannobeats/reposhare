# RepoShare

RepoShare lets you share private GitHub repositories through self-hosted links for cloning and ZIP downloads.

## Quick Start

### Installer

```bash
curl -fsSL https://raw.githubusercontent.com/mannobeats/reposhare/main/install.sh | bash
```

The installer:

- checks Docker access
- can use `sudo` for Docker when needed
- asks for install path, port, reverse-proxy mode, and public URL
- generates the app secret automatically
- pulls `ghcr.io/mannobeats/reposhare:latest`
- starts RepoShare

When it finishes, open the printed URL and complete setup in the browser.

### Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/mannobeats/reposhare/main/uninstall.sh | bash
```

The uninstaller stops RepoShare, removes the container, and asks whether to also delete the stored data and config.

### Docker Compose

```bash
git clone https://github.com/mannobeats/reposhare.git
cd reposhare
cp .env.example .env
docker compose up -d
```

### Local Development

```bash
git clone https://github.com/mannobeats/reposhare.git
cd reposhare
npm install
cp .env.example .env
npm run db:init
npm run dev
```

Default local URL:

```text
http://localhost:3417
```

## Required Config

```env
PORT=3417
BIND_ADDRESS=0.0.0.0
PUBLIC_URL=http://localhost:3417
APP_SECRET=replace_with_a_long_random_secret
```

## Setup

1. Open RepoShare.
2. Create the admin account.
3. Connect the GitHub App from the dashboard.
4. Generate a share link.

## Reverse Proxy

If you run RepoShare behind your own reverse proxy, use:

```env
BIND_ADDRESS=127.0.0.1
PUBLIC_URL=https://share.example.com
```

Your proxy should forward:

- `Host`
- `X-Forwarded-For`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name share.example.com;

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

### Caddy

```caddyfile
share.example.com {
    reverse_proxy 127.0.0.1:3417 {
        header_up Host {host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
        flush_interval -1
    }
}
```

## Maintenance

```bash
bash install.sh update
bash install.sh backup
bash install.sh restore /path/to/backup.tar.gz
bash install.sh status
curl -fsSL https://raw.githubusercontent.com/mannobeats/reposhare/main/uninstall.sh | bash
```

RepoShare stores persistent state in:

- `.env`
- `./data/reposhare.db`
