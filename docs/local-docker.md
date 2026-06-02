# Local Docker

## Services for MVP

Local development should run:

- `web`: React dev server, port `5173`.
- `api`: NestJS API, port `3000`.
- `signaling`: Node.js mediasoup/WebSocket service, port `4000`.
- `redis`: room/session state, port `6379`.
- `turn`: coturn, UDP/TCP `3478`.

Future optional service:

- `recording`: recording worker for encode/mux and S3 upload. Not started for MVP.

## Compose shape

The first implementation should use one `docker-compose.yml` at repo root. This works naturally with the monorepo layout in `docs/monorepo.md`.

Recommended service boundaries:

```yaml
services:
  web:
    build:
      context: ./apps/web
      target: dev
    ports:
      - "5173:5173"
    depends_on:
      - api
      - signaling

  api:
    build:
      context: ./apps/api
      target: dev
    ports:
      - "3000:3000"
    environment:
      REDIS_URL: redis://redis:6379
      SIGNALING_PUBLIC_URL: ws://localhost:4000/ws
      WEB_PUBLIC_URL: http://localhost:5173
    depends_on:
      - redis

  signaling:
    build:
      context: ./apps/signaling
      target: dev
    ports:
      - "4000:4000"
      - "40000-40100:40000-40100/udp"
    environment:
      REDIS_URL: redis://redis:6379
      MEDIASOUP_LISTEN_IP: 0.0.0.0
      MEDIASOUP_ANNOUNCED_IP: 127.0.0.1
      MEDIASOUP_RTC_MIN_PORT: 40000
      MEDIASOUP_RTC_MAX_PORT: 40100
      TURN_URL: turn:localhost:3478
      TURN_USERNAME: conference
      TURN_PASSWORD: conference
    depends_on:
      - redis
      - turn

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  turn:
    image: coturn/coturn:latest
    ports:
      - "3478:3478/tcp"
      - "3478:3478/udp"
    command:
      - --lt-cred-mech
      - --user=conference:conference
      - --realm=conference.local
      - --no-tls
      - --no-dtls
```

## Local WebRTC notes

- Browser camera/mic works on `localhost` without HTTPS.
- For non-localhost domains HTTPS is required.
- TURN is still useful locally for testing ICE config, but real NAT/firewall behavior must be tested from separate networks.
- mediasoup RTC UDP port range should be small in local dev and explicitly exposed.
- Mobile testing from a phone cannot use browser `localhost`; use the host machine LAN IP or a local HTTPS tunnel.
- For mobile device testing, set public URLs and `MEDIASOUP_ANNOUNCED_IP` to an address reachable from the phone.
- iOS Safari and Android Chrome are the MVP mobile browser targets.

## Production notes

MVP deployment target is one dedicated server. Vercel is not used for MVP deployment. Production deployment needs:

- HTTPS for web/API.
- WSS for signaling.
- Public `MEDIASOUP_ANNOUNCED_IP`.
- TURN with TLS credentials and a real realm.
- Firewall rules for mediasoup UDP port range.
- Sticky room routing if more than one signaling/media instance is deployed.

For the MVP server, keep deployment Docker Compose based unless a later architecture decision changes it. CI/CD should deploy through a protected/manual job and must not store secrets in git.
