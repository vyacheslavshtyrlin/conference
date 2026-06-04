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
- Treat each room as owned by exactly one signaling/media instance.
- Reject architecture that relies on random round-robin WebSocket routing for participants of the same room.
- Enforce 10 participant room limit.
- Broadcast participant and producer state changes.
- Clean up transports, producers and consumers on leave/disconnect.
- Close empty runtime rooms after the configured grace period.
- Enforce WebSocket heartbeat, maximum payload size and send-buffer backpressure limits.
- Enforce per-socket WebSocket message rate limits.
- Enforce browser WebSocket Origin allow-listing before token processing.
- Enforce finite mediasoup resource limits per participant for transports, producers and consumers.
- Enforce only one active screen share producer per room.
- Keep TURN/ICE configuration compatible with local Docker.
- Keep future recording integration possible through mediasoup plain transports without adding S3 upload to mediasoup core.

## Architecture rules

- `RoomManager` owns room lifecycle.
- `PeerManager` owns participant state.
- `MediasoupService` owns mediasoup operations.
- `SocketGateway` owns WebSocket protocol boundary and validation.
- Validate incoming payloads with a schema-first approach such as Zod.
- Serialize room-scoped mutations and mediasoup operations with `async-mutex`; operations for different rooms may remain parallel.
- mediasoup runtime objects are process-local and must never be stored in Redis.
- Redis room metadata includes the assigned `mediaNodeId` and `signalingUrl`.
- Multi-node deployments require room-sticky routing or explicit client connection to the assigned `signalingUrl`.

## Review checklist before handoff

- No mediasoup runtime object is stored in Redis.
- Room ownership is preserved: all participants of a room connect to the assigned media node.
- Every request/response event includes `requestId`.
- Dead WebSocket connections are terminated by heartbeat.
- Oversized payloads and slow consumers are bounded by configured limits.
- Message floods are bounded by per-socket rate limits.
- WebSocket `Origin` is checked against the configured allow-list.
- `/ready` reports Redis and mediasoup readiness separately from `/health` liveness.
- Concurrent room operations are serialized per room.
- Producer close also closes related consumers.
- Worker death is handled by removing the affected runtime room from memory.
- Per-peer mediasoup transport/producer/consumer limits are enforced.
- At most one active `screen` producer exists per room.
- Room full, expired room and invalid token cases return explicit errors.
- Producer close events are broadcast.
- Disconnect cleanup is idempotent.
