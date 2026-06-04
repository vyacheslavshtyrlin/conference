# Local Docker

## Services for MVP

Local development runs:

- `web`: React Vite dev server, port `5173`.
- `api`: NestJS API, port `3000`.
- `signaling`: Node.js mediasoup/WebSocket service, port `4000`, UDP `40000-40100`.
- `redis`: room/session state, port `6379`.
- `turn`: coturn STUN/TURN, TCP/UDP `3478`.

Future optional service:

- `recording`: recording worker for encode/mux and S3 upload. Not started for MVP.

## Starting the stack

```sh
# First time or after dependency changes
docker compose build

# Start all services
docker compose up

# Rebuild and start together
docker compose up --build
```

The startup order is enforced by health checks: redis must be healthy before api and signaling start; api and signaling must be healthy before the web dev server starts. Allow 30–60 seconds for the first startup.

## Hot reload in development

Source directories are mounted as volumes in the dev targets. Changes to host files are immediately visible inside containers:

| Service   | Mounted paths                                                |
|-----------|--------------------------------------------------------------|
| web       | `apps/web/src`, `index.html`, `vite.config.ts`, `tsconfig.json` |
| api       | `apps/api/src`                                               |
| signaling | `apps/signaling/src`                                         |

Shared packages (`packages/`) are compiled into the image at `docker compose build` time. If you change a shared package, rebuild the affected service:

```sh
docker compose build api signaling web
```

## Compose shape

```yaml
services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: dev
    ports:
      - "5173:5173"

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: dev
    ports:
      - "3000:3000"
    environment:
      REDIS_URL: redis://redis:6379
      MEDIA_NODE_ID: local
      SIGNALING_PUBLIC_URL: ws://localhost:4000/ws   # returned to browser in join response
      WEB_PUBLIC_URL: http://localhost:5173           # used for CORS and join URL

  signaling:
    build:
      context: .
      dockerfile: apps/signaling/Dockerfile
      target: dev
    ports:
      - "4000:4000"
      - "40000-40100:40000-40100/udp"
    environment:
      REDIS_URL: redis://redis:6379
      MEDIASOUP_LISTEN_IP: 0.0.0.0
      MEDIASOUP_ANNOUNCED_IP: 127.0.0.1  # IP included in WebRTC ICE candidates
      MEDIASOUP_RTC_MIN_PORT: 40000
      MEDIASOUP_RTC_MAX_PORT: 40100
      MEDIASOUP_MAX_TRANSPORTS_PER_PEER: 4
      MEDIASOUP_MAX_PRODUCERS_PER_PEER: 3
      MEDIASOUP_MAX_CONSUMERS_PER_PEER: 32
      WS_HEARTBEAT_INTERVAL_MS: 30000
      WS_MAX_PAYLOAD_BYTES: 65536
      WS_SEND_BACKPRESSURE_BYTES: 262144
      WS_RATE_LIMIT_WINDOW_MS: 10000
      WS_RATE_LIMIT_MAX_MESSAGES: 60
      WS_ALLOWED_ORIGINS: http://localhost:5173

  redis:
    image: redis:7-alpine

  turn:
    image: coturn/coturn:4.6-alpine
    ports:
      - "3478:3478/tcp"
      - "3478:3478/udp"
```

## Local WebRTC notes

- Browser camera/mic works on `localhost` without HTTPS.
- For non-localhost origins HTTPS is required (iOS Safari enforces this strictly).
- mediasoup UDP port range must be small and explicitly exposed in local dev.
- The signaling service announces ICE candidates using `MEDIASOUP_ANNOUNCED_IP`. Set this to an IP reachable from the browser.
- The signaling service limits mediasoup resource allocation per participant. Defaults are `MEDIASOUP_MAX_TRANSPORTS_PER_PEER=4`, `MEDIASOUP_MAX_PRODUCERS_PER_PEER=3` and `MEDIASOUP_MAX_CONSUMERS_PER_PEER=32`.
- `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` are reserved for when the signaling service sends ICE server config to clients. coturn is running but ICE server injection is not yet wired in signaling — direct ICE candidates are used for now.
- The signaling WebSocket server uses heartbeat checks, payload size limits, send-buffer backpressure limits, per-socket message rate limits and browser Origin allow-listing. Defaults are `WS_HEARTBEAT_INTERVAL_MS=30000`, `WS_MAX_PAYLOAD_BYTES=65536`, `WS_SEND_BACKPRESSURE_BYTES=262144`, `WS_RATE_LIMIT_WINDOW_MS=10000`, `WS_RATE_LIMIT_MAX_MESSAGES=60` and `WS_ALLOWED_ORIGINS=http://localhost:5173`.
- The signaling service exposes `/health` for process liveness and `/ready` for readiness. `/ready` returns `503` until Redis is connected and the mediasoup service is initialized.
- For local LAN testing, direct UDP between the phone and host usually works without TURN relay.

## Mobile testing — LAN IP method

A phone cannot use the host machine's `localhost`. Use the host LAN IP instead.

### 1. Find your LAN IP

```sh
# macOS / Linux
ipconfig getifaddr en0        # macOS Wi-Fi
ip addr show | grep 'inet '   # Linux

# Windows
ipconfig | findstr "IPv4"
```

Example result: `192.168.1.100`

### 2. Create your .env

```sh
cp .env.example .env
```

Edit `.env` and set the LAN IP overrides (uncomment the block at the bottom):

```sh
MEDIASOUP_ANNOUNCED_IP=192.168.1.100
WEB_PUBLIC_URL=http://192.168.1.100:5173
MEDIA_NODE_ID=local
SIGNALING_PUBLIC_URL=ws://192.168.1.100:4000/ws
WS_ALLOWED_ORIGINS=http://192.168.1.100:5173
VITE_API_BASE_URL=http://192.168.1.100:3000/api/v1
VITE_SIGNALING_URL=ws://192.168.1.100:4000/ws
TURN_URL=turn:192.168.1.100:3478
```

> **Note on CORS**: `WEB_PUBLIC_URL` is the single allowed CORS origin for the API. While testing mobile with the LAN IP, access the web app from your desktop browser at `http://192.168.1.100:5173` too, not `http://localhost:5173`, so CORS matches. Alternatively, update the API CORS config to allow multiple origins.

### 3. Rebuild and start

```sh
docker compose down
docker compose up --build
```

### 4. Open on the phone

Navigate to `http://192.168.1.100:5173` in iOS Safari or Android Chrome. Both browser and API must use the same LAN IP as the origin.

### Why `MEDIASOUP_ANNOUNCED_IP` matters

mediasoup includes this IP in WebRTC ICE candidates sent to browsers. If it is `127.0.0.1`, a phone cannot reach the media server. Setting it to the LAN IP makes ICE negotiation succeed across devices on the same network.

---

## Mobile testing — HTTPS tunnel method

Use this when:
- You need HTTPS on a custom domain (required by some device restrictions).
- You are testing from a different network (e.g., cellular).
- The LAN method does not work due to network isolation.

### Option A: Cloudflare Tunnel (free, persistent URL)

```sh
# Install cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# Expose the web dev server with a temporary public URL
cloudflared tunnel --url http://localhost:5173
```

Cloudflare prints a public HTTPS URL like `https://abc123.trycloudflare.com`.

Update `.env`:
```sh
VITE_API_BASE_URL=https://abc123.trycloudflare.com/api/v1
VITE_SIGNALING_URL=wss://abc123.trycloudflare.com/ws
```

You will also need to tunnel the API and signaling ports or configure a reverse proxy. For the simplest setup, tunnel only the web port and let the browser hit the LAN IP for API/signaling.

### Option B: ngrok

```sh
# Install ngrok: https://ngrok.com/download
ngrok http 5173
```

ngrok prints a public HTTPS URL. Apply the same env var overrides as Option A.

### Tunnel limitations

- WebSocket tunneling is supported by both Cloudflare Tunnel and ngrok.
- mediasoup UDP transport does NOT work through a TCP-only tunnel. The phone needs direct UDP access to the host for WebRTC media.
- For media over a tunnel, you would need a TURN server reachable from the internet with public UDP relay ports.
- For MVP mobile testing, the LAN method is recommended because it allows direct UDP.

---

## Production notes

MVP deployment target is one dedicated server. Vercel is not used for MVP deployment. Production deployment needs:

- HTTPS for web/API (Let's Encrypt or similar).
- WSS for signaling.
- Public `MEDIASOUP_ANNOUNCED_IP` (server's public IP).
- TURN with TLS credentials and a real realm.
- Firewall rules open for mediasoup UDP port range (`40000-40100` or adjusted range).
- coturn relay port range open in the firewall.
- Sticky room routing if more than one signaling/media instance is deployed.

If more than one signaling/media instance is deployed, do not put WebSocket traffic behind random round-robin balancing. Each room must be assigned to one media node, and all participants of that room must connect to that node's `signalingUrl`. In the MVP single-node deployment this is represented by `MEDIA_NODE_ID=local` and `SIGNALING_PUBLIC_URL`.

For the MVP server, keep deployment Docker Compose based unless a later architecture decision changes it. CI/CD should deploy through a protected/manual job and must not store secrets in git.

See [MVP Server Deployment](deployment.md) for server setup, firewall, reverse proxy, TURN and GitHub Actions deployment steps.
