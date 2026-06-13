# DuckDNS Single-Server MVP Deployment

## Decision

For the **current MVP**, deploy the existing combined repository to one public server using DuckDNS.

This is a fast validation deployment, not the final production topology.

Future target:

- split repositories;
- immutable images per service;
- three-server baseline from `docs/deployment-three-server.md`;
- PostgreSQL-backed users/rooms/participants.

Current MVP target:

```text
one server
  nginx + certbot
  web
  api
  signaling/media
  redis
  coturn
```

## Requirements

Server:

```text
Ubuntu 22.04 or 24.04
minimum: 2 vCPU / 4 GB RAM for demo
recommended: 4 vCPU / 8 GB RAM
public IPv4
```

DNS:

```text
<name>.duckdns.org -> server public IP
```

Open ports:

```text
22/tcp
80/tcp
443/tcp
3478/tcp
3478/udp
40000-40100/udp
```

The current compose file exposes mediasoup `40000-40100` for the MVP server. Wider ranges can be configured later.

## Current MVP server

Concrete values for the first MVP deployment are documented in Russian in
[`deployment-mvp-start.md`](deployment-mvp-start.md).

Current known values:

```text
server IPv4: 45.151.102.212
domain: commmmet.duckdns.org
repository: git@github.com:vyacheslavshtyrlin/conference.git
deploy path: /opt/conference
recommended deploy user: deploy
recommended mediasoup workers for this 2-core server: 1
```

## DuckDNS setup

1. Create a DuckDNS subdomain:

```text
commmmet.duckdns.org
```

2. Point it to the server public IPv4.

3. Verify from your local machine:

```sh
nslookup commmmet.duckdns.org
```

It must resolve to the server public IP.

## Server setup

Create a non-root deploy user first if the server only has `root`:

```sh
adduser deploy
usermod -aG sudo deploy
su - deploy
```

Install packages as `deploy`:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
exit
ssh deploy@45.151.102.212

docker --version
docker compose version
```

Clone current repository:

```sh
sudo mkdir -p /opt/conference
sudo chown "$USER":"$USER" /opt/conference
git clone git@github.com:vyacheslavshtyrlin/conference.git /opt/conference
cd /opt/conference
```

## Environment

Create `.env` on the server:

```sh
cp .env.example .env
nano .env
```

Set these values:

```env
NODE_ENV=production

DOMAIN=commmmet.duckdns.org
CERTBOT_EMAIL=admin@example.com

WEB_PUBLIC_URL=https://commmmet.duckdns.org
MEDIA_NODE_ID=local
SIGNALING_PUBLIC_URL=wss://commmmet.duckdns.org/ws

VITE_API_BASE_URL=https://commmmet.duckdns.org/api/v1
VITE_SIGNALING_URL=wss://commmmet.duckdns.org/ws

REDIS_URL=redis://redis:6379

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<server-public-ip>
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100
MEDIASOUP_NUM_WORKERS=1

TURN_URL=turn:commmmet.duckdns.org:3478
TURN_USERNAME=<change-me>
TURN_PASSWORD=<change-me-strong>
TURN_REALM=commmmet.duckdns.org

JOIN_TOKEN_SECRET=<openssl-rand-hex-32>

WS_ALLOWED_ORIGINS=https://commmmet.duckdns.org
WS_HEARTBEAT_INTERVAL_MS=30000
WS_MAX_PAYLOAD_BYTES=65536
WS_SEND_BACKPRESSURE_BYTES=262144
WS_RATE_LIMIT_WINDOW_MS=10000
WS_RATE_LIMIT_MAX_MESSAGES=60
```

Generate a token secret:

```sh
openssl rand -hex 32
```

Important:

- `MEDIASOUP_ANNOUNCED_IP` must be the server public IPv4.
- `JOIN_TOKEN_SECRET` must be the same for API and signaling.
- `VITE_*` values are baked into the web production build, so set `.env` before building.

## Nginx and TLS

Install the nginx site:

```sh
export DOMAIN=commmmet.duckdns.org

envsubst '$DOMAIN' < /opt/conference/nginx/conference.conf \
  | sudo tee /etc/nginx/sites-available/conference

sudo ln -sf /etc/nginx/sites-available/conference /etc/nginx/sites-enabled/conference
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

Issue certificate:

```sh
sudo certbot --nginx -d commmmet.duckdns.org
```

After certbot, verify:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

## Start stack

From `/opt/conference`:

```sh
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
docker compose ps
```

Check services:

```sh
curl https://commmmet.duckdns.org
curl https://commmmet.duckdns.org/api/v1/health
curl http://127.0.0.1:4000/ready
```

## Verification

Minimum smoke test:

1. Open `https://commmmet.duckdns.org`.
2. Create a room.
3. Confirm creator lands on pre-join.
4. Join as creator.
5. Open public link in a second browser/device.
6. Join as guest.
7. Confirm WebSocket connects over WSS.
8. Confirm audio/video works.
9. Confirm desktop screen share works.
10. Leave both participants.

If media does not connect:

- verify UDP `40000-40100` is open in host firewall and cloud firewall;
- verify `MEDIASOUP_ANNOUNCED_IP` is the public server IP;
- check signaling logs:

```sh
docker compose logs --tail=200 signaling
```

## Update deployment

For quick MVP updates:

```sh
cd /opt/conference
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker compose ps
```

This builds on the server from the current monorepo. That is acceptable for the current MVP, but should be replaced later by immutable image deployment.

## Known limits

- Single server is not high availability.
- Redis is the only live room state store in the MVP.
- PostgreSQL/auth/user profile integration is not part of this deploy yet.
- TURN credentials in compose must be hardened before broad public testing.
- No chat, recording, transcription, S3 upload or moderation.
- Future split repositories are documented in `docs/monorepo.md`.
