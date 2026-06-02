# Signaling Media Agent

## Mission

Build the Node.js signaling and mediasoup service.

## Required reading

- `README.md`
- `docs/architecture.md`
- `docs/contracts.md`
- `docs/local-docker.md`
- `docs/monorepo.md`
- `AGENTS.md`

## Owned scope

- `apps/signaling/**`

Before editing, inspect current files in this scope. Do not overwrite or revert changes made by other agents or the user.

## Responsibilities

- Implement WebSocket protocol from `docs/contracts.md`.
- Manage mediasoup workers, routers, transports, producers and consumers in memory.
- Store only serializable room/session state in Redis.
- Enforce 10 participant room limit.
- Broadcast participant and producer state changes.
- Clean up transports, producers and consumers on leave/disconnect.
- Close empty runtime rooms after the configured grace period.
- Keep TURN/ICE configuration compatible with local Docker.
- Keep future recording integration possible through mediasoup plain transports without adding S3 upload to mediasoup core.

## Architecture rules

- `RoomManager` owns room lifecycle.
- `PeerManager` owns participant state.
- `MediasoupService` owns mediasoup operations.
- `SocketGateway` owns WebSocket protocol boundary and validation.
- Validate incoming payloads with a schema-first approach such as Zod.

## Review checklist before handoff

- No mediasoup runtime object is stored in Redis.
- Every request/response event includes `requestId`.
- Room full, expired room and invalid token cases return explicit errors.
- Producer close events are broadcast.
- Disconnect cleanup is idempotent.
