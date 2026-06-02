# Monorepo

## Decision

Use a monorepo for the MVP. It keeps frontend, API, signaling/media, shared contracts and Docker runtime in one repository while preserving service boundaries for deployment.

## Recommended layout

```text
apps/
  web/          React + Vite + Mantine UI client
  api/          NestJS HTTP API
  signaling/    Node.js WebSocket + mediasoup service
  recording/    Future recording worker, not implemented in MVP
packages/
  contracts/    Shared TypeScript types and validation schemas
  config/       Shared config helpers
  logger/       Shared logging helpers
docs/
  architecture.md
  contracts.md
  local-docker.md
  monorepo.md
```

`apps/recording` is reserved for future recording/S3 integration. It should not be implemented in MVP unless recording becomes in-scope.

## Package manager

Use one workspace-aware package manager at the repo root. Recommended: `pnpm` workspaces.

Reasons:

- fast installs;
- clear workspace dependencies;
- easy shared packages;
- straightforward Docker build targets per app.

If the team prefers npm workspaces, the architecture still works. The important rule is one root lockfile and explicit app packages.

## Deployment model

The monorepo does not mean one runtime process. Each app remains deployable as a separate service:

- `apps/web` -> static web build or frontend container;
- `apps/api` -> NestJS API container;
- `apps/signaling` -> mediasoup/WebSocket container with UDP port range;
- `apps/recording` -> future worker container;
- Redis and coturn remain infrastructure services.

Docker Compose can build all services from one repository for local development and small deployments.

For MVP, deployment target is one dedicated server. Vercel is not used for MVP deployment. The expected deployment shape is Docker Compose from this monorepo with separate service containers for web, API, signaling, Redis and coturn.

## Localhost support

Localhost remains supported:

- web: `http://localhost:5173`;
- API: `http://localhost:3000`;
- signaling: `ws://localhost:4000/ws`;
- Redis: `localhost:6379`;
- TURN: `localhost:3478`;
- mediasoup UDP range: `40000-40100/udp`.

Browser camera and mic work on `localhost` without HTTPS. For mobile testing from a physical phone, use the host LAN IP or a local HTTPS tunnel because the phone's `localhost` is the phone itself.

## Shared contracts

Shared REST/WebSocket payload types should live in `packages/contracts`. Runtime validation schemas should be shared where practical, but each service must still validate its own external inputs.

Do not let shared packages hide service ownership:

- API owns room creation/join HTTP contracts.
- Signaling owns WebSocket/media contracts.
- Recording worker owns future file upload/storage contracts.
- Frontend consumes contracts but does not own backend protocol decisions.
