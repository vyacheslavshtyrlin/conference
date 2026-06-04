# MVP Server Deployment

This document describes the expected MVP deployment path: one dedicated server, Docker Compose, coturn, and a host reverse proxy for HTTPS/WSS. Vercel is not used for MVP deployment.

## Deployment Shape

Run these services on one server:

- `web`: frontend container.
- `api`: NestJS API container.
- `signaling`: WebSocket/mediasoup container.
- `redis`: room/session state.
- `turn`: coturn.
- reverse proxy on the host: Nginx or Caddy.

Recommended public entrypoints:

- `https://conference.example.com` -> web.
- `https://conference.example.com/api/v1` -> API.
- `wss://conference.example.com/ws` -> signaling.
- `turn:conference.example.com:3478` -> coturn, direct public TCP/UDP port.
- `40000-40100/udp` -> mediasoup RTP port range, direct public UDP ports.

Do not expose production secrets in git. Put server values in the server `.env` file and GitHub Actions secrets.

## DNS

Create DNS records before issuing certificates:

```text
conference.example.com A <server-public-ip>
```

Using one domain with `/api/v1` and `/ws` paths is enough for the MVP. Separate domains can be added later if needed.

## Server Prerequisites

Install Docker, Docker Compose plugin, Git, and a reverse proxy.

Example for Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx
```

Install Docker using the official Docker package source for the target OS. After install, verify:

```bash
docker --version
docker compose version
```

## Firewall

Open only the public ports needed by the MVP:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 40000:40100/udp
sudo ufw enable
sudo ufw status
```

If the server is in a cloud provider, open the same ports in the provider firewall/security group.

Keep app ports `5173`, `3000`, and `4000` closed to the public internet when the reverse proxy is configured. Public traffic should enter through HTTPS/WSS and TURN/UDP ports only.

For production, bind app ports to localhost or apply equivalent host/cloud firewall rules. A simple production override can be added on the server as `docker-compose.prod.yml`:

```yaml
services:
  web:
    ports:
      - "127.0.0.1:5173:5173"

  api:
    ports:
      - "127.0.0.1:3000:3000"

  signaling:
    ports:
      - "127.0.0.1:4000:4000"
      - "40000-40100:40000-40100/udp"

  redis:
    ports:
      - "127.0.0.1:6379:6379"
```

Then use both compose files:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

On Linux, Docker port publishing can interact with firewall rules in ways that surprise `ufw`, so localhost binding is the preferred production baseline for web/API/signaling app ports.

## Initial Server Checkout

Create a deployment directory and clone the repository:

```bash
sudo mkdir -p /opt/conference
sudo chown "$USER":"$USER" /opt/conference
git clone git@github.com:<owner>/<repo>.git /opt/conference
cd /opt/conference
cp .env.example .env
```

Edit `.env` for the server:

```env
NODE_ENV=production

WEB_PUBLIC_URL=https://conference.example.com
API_PUBLIC_URL=https://conference.example.com
MEDIA_NODE_ID=local
SIGNALING_PUBLIC_URL=wss://conference.example.com/ws

REDIS_URL=redis://redis:6379

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<server-public-ip>
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100

TURN_URL=turn:conference.example.com:3478
TURN_USERNAME=<turn-username>
TURN_PASSWORD=<strong-turn-password>
TURN_REALM=conference.example.com

JOIN_TOKEN_SECRET=<strong-random-secret>
WS_HEARTBEAT_INTERVAL_MS=30000
WS_MAX_PAYLOAD_BYTES=65536
WS_SEND_BACKPRESSURE_BYTES=262144
WS_RATE_LIMIT_WINDOW_MS=10000
WS_RATE_LIMIT_MAX_MESSAGES=60
WS_ALLOWED_ORIGINS=https://conference.example.com
MEDIASOUP_MAX_TRANSPORTS_PER_PEER=4
MEDIASOUP_MAX_PRODUCERS_PER_PEER=3
MEDIASOUP_MAX_CONSUMERS_PER_PEER=32
```

Phase 0 compose is a skeleton and currently uses development targets. Before production traffic, either switch compose app build targets to production or add a production compose override. Redis, coturn, port ranges, and reverse-proxy assumptions remain the same.

## Start Docker Compose

From the deployment directory:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose ps
```

Health checks for the Phase 0 placeholders:

```bash
curl http://127.0.0.1:3000/api/v1/health
curl http://127.0.0.1:4000/health
```

TURN starts from the existing `turn` service in `docker-compose.yml`. Production credentials should be changed from development values before public use.

## Nginx HTTPS/WSS

Create an Nginx site:

```nginx
server {
  listen 80;
  server_name conference.example.com;

  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/v1/ {
    proxy_pass http://127.0.0.1:3000/api/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /ws {
    proxy_pass http://127.0.0.1:4000/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable the site and issue a certificate:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d conference.example.com
sudo nginx -t
sudo systemctl reload nginx
```

After this, the browser should use:

```text
https://conference.example.com
wss://conference.example.com/ws
```

TURN remains direct on `3478/tcp` and `3478/udp`; it is not proxied by this Nginx HTTP config.

## GitHub Actions CD

The repository has a manual deploy job in `.github/workflows/ci.yml`. Configure GitHub before relying on it:

1. Create an environment named `mvp-production`.
2. Add required reviewers to that environment.
3. Add Actions secrets:
   - `MVP_DEPLOY_HOST`: server IP or DNS name.
   - `MVP_DEPLOY_USER`: SSH user.
   - `MVP_DEPLOY_PATH`: `/opt/conference` or the chosen checkout path.
   - `MVP_DEPLOY_SSH_KEY`: private SSH key with access to the server.
4. Add the public key to the server user's `~/.ssh/authorized_keys`.
5. Ensure the server checkout can pull from GitHub.

The deploy job runs only through `workflow_dispatch` on `main`. It SSHes into the server and runs:

```bash
cd "$MVP_DEPLOY_PATH"
git pull --ff-only
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
else
  docker compose up -d --build
fi
```

CI still runs automatically on pull requests and pushes to `main`.

## Post-Deploy Checks

Run these after a deploy:

```bash
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 signaling
docker compose logs --tail=100 turn
curl https://conference.example.com/api/v1/health
curl https://conference.example.com
```

For media connectivity, verify:

- `MEDIASOUP_ANNOUNCED_IP` is the public server IP.
- `40000-40100/udp` is open on host and cloud firewall.
- `3478/tcp` and `3478/udp` are open for TURN.
- `SIGNALING_PUBLIC_URL` uses `wss://`.
- `MEDIA_NODE_ID` identifies the media node assigned to newly created rooms. In a single-node MVP deployment, keep it as `local`.
- Signaling keeps dead WebSocket connections bounded through heartbeat checks and closes clients whose send buffer exceeds `WS_SEND_BACKPRESSURE_BYTES`.
- Signaling enforces per-socket WebSocket message rate limits using `WS_RATE_LIMIT_MAX_MESSAGES` per `WS_RATE_LIMIT_WINDOW_MS`.
- Signaling rejects browser WebSocket connections whose `Origin` is not listed in `WS_ALLOWED_ORIGINS`.
- Use `/health` for liveness and `/ready` for readiness. `/ready` should be used by production routing/orchestration because it checks Redis and mediasoup initialization.
- mediasoup resource limits should stay finite in production. The default producer limit allows one mic, one camera and one screen-share producer per participant.
- Browser access uses HTTPS, not plain HTTP.

## Rollback

The simple MVP rollback is a git checkout plus compose rebuild:

```bash
cd /opt/conference
git log --oneline -5
git checkout <previous-commit-sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Return to `main` after investigation:

```bash
git checkout main
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
