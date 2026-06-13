# Three-Server Production Baseline

## Decision

For the **next production baseline after the DuckDNS MVP**, use **option 2**: three servers.

```text
Server 1: edge + web + API
Server 2: signaling/media + TURN
Server 3: PostgreSQL + Redis
```

This is not the immediate DuckDNS MVP deployment. It is the next runtime step before transcription, recording, S3 upload, chat and horizontal scaling.

Separate repositories are still used:

```text
conference-web
conference-api
conference-signaling
conference-contracts
conference-deploy
```

Separate repositories do not require separate servers. The deployment split is by runtime responsibility and load profile.

## Server roles

### Server 1 - Edge, web and API

Runs:

- reverse proxy: nginx or caddy;
- `conference-web` container or static build;
- `conference-api` container.

Recommended start size:

```text
2 vCPU
2-4 GB RAM
40+ GB SSD
public IPv4
```

Public ports:

```text
80/tcp
443/tcp
```

Private/internal access:

- connects to PostgreSQL on Server 3;
- connects to Redis on Server 3;
- returns `signalingUrl` that points to Server 2.

Does not run:

- mediasoup;
- coturn;
- PostgreSQL;
- Redis.

### Server 2 - Signaling/media and TURN

Runs:

- `conference-signaling`;
- mediasoup workers;
- coturn.

Recommended start size:

```text
4 vCPU
8 GB RAM
80+ GB SSD
high network bandwidth
public IPv4
```

Public ports:

```text
443/tcp or 4000/tcp for WSS/signaling, depending on proxy layout
3478/tcp
3478/udp
40000-49999/udp for mediasoup
```

Private/internal access:

- connects to Redis on Server 3;
- optionally exposes internal health/control endpoint only to Server 1/3 or deploy network.

Does not run:

- PostgreSQL;
- main API backend;
- web frontend.

### Server 3 - Data

Runs:

- PostgreSQL;
- Redis.

Recommended start size:

```text
2 vCPU
4-8 GB RAM
100+ GB SSD
private network preferred
```

Public ports:

```text
none
```

Private/internal ports:

```text
5432/tcp PostgreSQL, only from Server 1
6379/tcp Redis, only from Server 1 and Server 2
```

Must have:

- PostgreSQL backups;
- Redis persistence policy decision;
- firewall/security group denying public DB access.

## Network map

```text
Users
  |
  | HTTPS
  v
Server 1: nginx/web/API
  | \
  |  \ WSS URL returned by API
  |   \
  |    v
  |  Server 2: signaling/media/TURN
  |      ^
  |      | WebRTC UDP/TURN
  |      |
  +----> Server 3: PostgreSQL/Redis
         ^
         |
Server 2 uses Redis for room/session live state
```

## Public endpoints

Recommended domains:

```text
https://conference.example.com        -> Server 1 web
https://conference.example.com/api/v1 -> Server 1 API
wss://media-1.example.com/ws          -> Server 2 signaling
turn:turn-1.example.com:3478          -> Server 2 coturn
```

For a simpler first setup, signaling can share the main domain through reverse proxy only if routing stays room-sticky. With one media node this is acceptable:

```text
wss://conference.example.com/ws -> Server 2
```

For future multi-node, prefer explicit media node URLs:

```text
wss://media-1.example.com/ws
wss://media-2.example.com/ws
```

## Environment by server

### Server 1 - API/web

```env
NODE_ENV=production

WEB_PUBLIC_URL=https://conference.example.com
VITE_API_BASE_URL=https://conference.example.com/api/v1

POSTGRES_URL=postgres://conference:<password>@<server3-private-ip>:5432/conference
REDIS_URL=redis://<server3-private-ip>:6379

MEDIA_NODE_ID=media-1
SIGNALING_PUBLIC_URL=wss://media-1.example.com/ws

JOIN_TOKEN_SECRET=<same-as-signaling>
CREATOR_TOKEN_SECRET=<strong-secret>
JOIN_TOKEN_TTL_SECONDS=300
```

### Server 2 - signaling/media/TURN

```env
NODE_ENV=production

PORT=4000
REDIS_URL=redis://<server3-private-ip>:6379
JOIN_TOKEN_SECRET=<same-as-api>

MEDIA_NODE_ID=media-1
SIGNALING_PUBLIC_URL=wss://media-1.example.com/ws

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<server2-public-ip>
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999

MEDIASOUP_NUM_WORKERS=3
MEDIASOUP_MAX_TRANSPORTS_PER_PEER=4
MEDIASOUP_MAX_PRODUCERS_PER_PEER=3
MEDIASOUP_MAX_CONSUMERS_PER_PEER=32

WS_ALLOWED_ORIGINS=https://conference.example.com
WS_HEARTBEAT_INTERVAL_MS=30000
WS_MAX_PAYLOAD_BYTES=65536
WS_SEND_BACKPRESSURE_BYTES=262144
WS_RATE_LIMIT_WINDOW_MS=10000
WS_RATE_LIMIT_MAX_MESSAGES=60

TURN_REALM=conference.example.com
TURN_USERNAME=<turn-user>
TURN_PASSWORD=<turn-password>
```

### Server 3 - data

```env
POSTGRES_DB=conference
POSTGRES_USER=conference
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<optional-if-configured>
```

If Redis password is enabled, update `REDIS_URL` on Server 1 and Server 2.

## Mediasoup worker count

Rule:

```text
MEDIASOUP_NUM_WORKERS should be close to CPU cores reserved for media.
```

For Server 2 with 4 vCPU:

```text
MEDIASOUP_NUM_WORKERS=3
```

Reason:

- mediasoup workers use CPU heavily;
- Node.js signaling process still needs CPU;
- coturn also needs CPU/network headroom;
- the OS and Docker need headroom.

Use `4` only if Server 2 is dedicated to signaling/media and testing shows event loop and TURN are not starved.

For 1 vCPU:

```text
MEDIASOUP_NUM_WORKERS=1
```

This is acceptable only for development or a very small demo. It is not a good production target for WebRTC media.

## Firewall

### Server 1

Allow:

```text
22/tcp from admin IPs
80/tcp public
443/tcp public
5432/tcp outbound to Server 3
6379/tcp outbound to Server 3
```

Deny public access to API container ports if they are not behind reverse proxy.

### Server 2

Allow:

```text
22/tcp from admin IPs
443/tcp public if WSS terminates here
4000/tcp only from reverse proxy if WSS terminates on Server 1
3478/tcp public
3478/udp public
40000-49999/udp public
6379/tcp outbound to Server 3
```

### Server 3

Allow:

```text
22/tcp from admin IPs
5432/tcp only from Server 1
6379/tcp only from Server 1 and Server 2
```

Deny:

```text
5432/tcp public
6379/tcp public
```

## Deploy model

Each service repo builds and publishes immutable images:

```text
ghcr.io/<org>/conference-web:<git-sha>
ghcr.io/<org>/conference-api:<git-sha>
ghcr.io/<org>/conference-signaling:<git-sha>
```

`conference-deploy` pins image tags and deploys to servers.

Recommended deploy layout:

```text
conference-deploy/
  server1-edge-api/
    docker-compose.yml
    .env.example
    nginx/
  server2-media/
    docker-compose.yml
    .env.example
    coturn/
  server3-data/
    docker-compose.yml
    .env.example
    backup/
```

Deploy commands should pull images, not build source on servers:

```sh
docker compose pull
docker compose up -d
```

## Deployment order

1. Provision Server 3 and start PostgreSQL/Redis.
2. Apply PostgreSQL migrations.
3. Provision Server 2 and start signaling/TURN.
4. Check `GET /ready` on signaling.
5. Provision Server 1 and start web/API/reverse proxy.
6. Check API health.
7. Create room.
8. Join from browser.
9. Confirm WSS connects to Server 2.
10. Confirm audio/video works.
11. Confirm TURN fallback if test network requires it.

## Verification checklist

- `conference.example.com` opens over HTTPS.
- API can connect to PostgreSQL.
- API can connect to Redis.
- API returns `signalingUrl=wss://media-1.example.com/ws`.
- Signaling can connect to Redis.
- Signaling `/ready` returns OK.
- Browser connects to WSS.
- Browser receives mediasoup ICE candidates with Server 2 public IP.
- UDP range is reachable.
- TURN is reachable.
- Two users can exchange audio/video.
- Screen share works on desktop.
- Participant list uses backend-owned display names.

## Scaling path

This baseline uses one media node:

```text
media-1
```

When adding more media nodes:

1. Add rows to `media_nodes`.
2. API assigns new rooms to a media node.
3. API stores `mediaNodeId` and `signalingUrl` in room metadata.
4. All participants of one room connect to the same `signalingUrl`.
5. Do not use random WebSocket load balancing.

## What is intentionally out of scope

- transcription;
- recording;
- S3 upload;
- chat;
- AI hints;
- horizontal media scaling;
- Kubernetes;
- multi-region.
