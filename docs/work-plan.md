# Work Plan

## Goal

Build the Conference MVP with primary focus on React/Mantine frontend and Node.js mediasoup signaling/media service. The immediate deployment path is a quick DuckDNS single-server deploy from the current combined repository. After MVP validation, split services into separate repositories.

This plan is intentionally split into phases so agents can break each phase into smaller owned tasks.

## Phase 0 - Quick MVP deployment foundation

Owner: Architect + DevOps.

1. Keep the current combined repository for MVP validation.
2. Use existing Dockerfiles for `web`, `api` and `signaling`.
3. Use `docker-compose.prod.yml` as the standalone MVP server compose file.
4. Deploy to one public server with DuckDNS.
5. Terminate HTTPS/WSS through host nginx + certbot.
6. Expose mediasoup UDP range and coturn.
7. Set production `.env` values before building web:
   - `WEB_PUBLIC_URL`;
   - `VITE_API_BASE_URL`;
   - `VITE_SIGNALING_URL`;
   - `SIGNALING_PUBLIC_URL`;
   - `MEDIASOUP_ANNOUNCED_IP`;
   - `JOIN_TOKEN_SECRET`;
   - `WS_ALLOWED_ORIGINS`.
8. Document deployment in `docs/deployment-duckdns.md`.

Exit criteria:

- One DuckDNS domain points to the MVP server.
- Full MVP stack starts through Compose.
- Web opens over HTTPS.
- API health works through HTTPS.
- Signaling connects over WSS.
- Browser media uses the server public IP in ICE candidates.
- Two users can join and exchange audio/video.
- Vercel is not part of the MVP deployment path.

## Phase 0.5 - Future repository split foundation

Owner: Architect + DevOps.

1. Create or split target repositories:
   - `conference-web`
   - `conference-api`
   - `conference-signaling`
   - `conference-contracts`
   - `conference-deploy`
2. Add per-repository package manager config and lockfile.
3. Add per-service TypeScript config and lint/test conventions.
4. Add shared contracts package or pinned contracts source dependency.
5. Add Dockerfiles in service repositories.
6. Add Docker Compose skeleton in `conference-deploy` for web, API, signaling, Redis and coturn.
7. Add CI/CD foundation per repository:
   - install dependencies from the service lockfile;
   - run typecheck for the service;
   - run tests for the service;
   - build service image with immutable tag;
   - publish image to registry.
8. Add deployment pipeline in `conference-deploy`:
   - validate Docker Compose config;
   - pin service image tags;
   - add protected/manual deploy job for the dedicated MVP server.

## Phase 1 - Shared contracts

Owner: Architect.

1. Move REST and WebSocket payload types from `docs/contracts.md` into the `conference-contracts` repository/package.
2. Add runtime validation schemas, preferably Zod.
3. Export shared error codes.
4. Keep documentation and package schemas aligned.

Exit criteria:

- API, signaling and frontend can import or generate from shared contracts.
- Contract package/repository has typecheck and schema validation coverage.

## Phase 2 - Signaling/media MVP

Owner: Signaling/media agent.

1. Scaffold Node.js TypeScript service in `conference-signaling`.
2. Add WebSocket server and token validation.
3. Add `RoomManager`, `PeerManager`, `MediasoupService`, `SocketGateway`.
4. Create mediasoup worker/router per active room.
5. Implement transport create/connect.
6. Implement produce/consume for audio, camera video and screen video.
7. Broadcast participant and producer events.
8. Enforce 10 participant limit.
9. Add cleanup on leave/disconnect.

Exit criteria:

- Two desktop clients can join one room and exchange audio/video.
- Producer close events update all clients.
- Empty room cleanup works.
- No mediasoup runtime object is stored in Redis.

## Phase 3 - Frontend shell and Mantine system

Owner: Frontend agent.

1. Scaffold React + Vite app in `conference-web`.
2. Install and configure Mantine UI.
3. Add Mantine provider, theme, notifications and global styles.
4. Add routing for:
   - create room page
   - pre-join page
   - conference room page
5. Add API client and TanStack Query.
6. Add Zustand stores for local media and room state.

Exit criteria:

- UI uses Mantine consistently.
- Theme is centralized.
- Mobile layout works at small viewport widths.
- No WebRTC logic is embedded in presentational Mantine components.

## Phase 4 - Minimal API bridge

Owner: API agent.

1. Scaffold NestJS app in `conference-api`.
2. Add `RoomsModule` and `HealthModule`.
3. Add Redis provider/repository.
4. Implement `POST /api/v1/rooms`.
5. Implement `GET /api/v1/rooms/:slug`.
6. Implement `POST /api/v1/rooms/:slug/join`.
7. Generate private creator token on room creation and store only its hash/server-safe marker.
8. Mark joined participant as `isCreator` when valid creator token is provided.
9. Generate short-lived signed join tokens.
10. Add DTO validation and focused tests.

Exit criteria:

- API scope remains limited to room metadata, creator marker and signaling join tokens.
- Room creation returns join URL.
- Room creation returns private creator token separately from public join URL.
- Room TTL is 30 minutes.
- Join rejects missing/expired rooms.
- Creator join returns `isCreator: true`; guest join returns `isCreator: false`.
- Response shapes match `docs/contracts.md`.

## Phase 5 - Frontend API and WebRTC integration

Owner: Frontend agent + API agent + Signaling/media agent.

1. Implement pre-join device flow.
2. Store display name and device preferences in `sessionStorage`.
3. Store creator token from room creation in `sessionStorage`.
4. Redirect creator to the created room pre-join screen, not directly to live conference.
5. Wire create room UI to `POST /api/v1/rooms`.
6. Wire room lookup/pre-join route to `GET /api/v1/rooms/:slug`.
7. Wire Join button to `POST /api/v1/rooms/:slug/join`.
8. Pass `creatorToken` only for the creator join flow.
9. Store `participantId`, `isCreator`, signaling token and `signalingUrl` after successful join.
10. Implement signaling client connection using API-issued signaling token.
11. Implement mediasoup client device and transports.
12. Implement audio/video publish.
13. Implement remote consumers and video grid.
14. Implement mute/unmute, camera on/off and leave.
15. Implement desktop screen share.
16. Feature-detect mobile screen share.
17. Show permission, room, API and signaling errors.

Exit criteria:

- Create room button calls API and redirects creator to created room pre-join.
- Public room link opens pre-join and loads room metadata from API.
- Join button calls API, receives signaling token and then connects WebSocket.
- Guest join works without `creatorToken`.
- Creator join sends private `creatorToken` and receives `isCreator: true`.
- Desktop audio/video/screen share works.
- Creator reaches pre-join first and becomes live only after explicit Join.
- Creator is displayed as creator through `isCreator` metadata.
- Mobile join/audio/video/controls work.
- Mobile screen share button is hidden or disabled when unsupported.
- Participant list reflects server state.

## Phase 6 - Local Docker and mobile testing

Owner: DevOps agent.

1. Add Dockerfiles for each app.
2. Complete Docker Compose.
3. Configure mediasoup UDP port range.
4. Configure coturn for local development.
5. Add `.env.example`.
6. Document LAN IP / HTTPS tunnel workflow for phone testing.

Exit criteria:

- Full MVP stack starts locally.
- Browser can use camera/mic on localhost.
- Mobile testing path is documented and works with reachable host IP or tunnel.

## Phase 7 - End-to-end verification

Owner: Reviewer agent with implementation agents.

1. Run API tests.
2. Run signaling tests or integration checks.
3. Run frontend typecheck/build.
4. Test create room -> creator pre-join -> join -> signaling connect.
5. Test guest public link -> pre-join -> join -> signaling connect.
6. Test two desktop clients in one room.
7. Test one mobile client joining room.
8. Verify room TTL and empty-room cleanup.
9. Verify mandatory MVP scope:
   - no auth;
   - no chat;
   - no recording implementation;
   - no S3 upload implementation;
   - recording extension points remain documented.

Exit criteria:

- Reviewer verdict is Approved.
- Remaining risks are documented.

## Starting point

Start with Phase 0 and Phase 1. After that, prioritize Phase 2 Signaling/media and Phase 3 Frontend shell. Phase 4 API bridge should stay minimal and unblock Phase 5 frontend API/WebRTC integration only. Do not add backend features beyond the API bridge unless they are required for signaling/frontend MVP or explicitly approved in architecture docs.

## Production roadmap

Подробный план перехода из MVP в полноценное production-решение вынесен в Obsidian-документ:

- `docs/obsidian/08-production-roadmap.md`

Короткий порядок работ:

1. Разделить сервисы на отдельные репозитории.
2. Версионировать REST/WebSocket/Redis/token контракты.
3. Собрать production deploy baseline на immutable Docker images.
4. Добавить observability: logs, metrics, alerts, frontend error reporting.
5. Добавить reconnect/resume flow.
6. Добавить active speaker и улучшить conference UX.
7. Добавить chat через product/backend boundary, не в mediasoup core.
8. Добавить room-aware транскрибацию и AI-подсказки в чат.
9. Ввести identity, permissions и host actions.
10. Добавить PostgreSQL для durable product state.
11. Добавить recording отдельным worker.
12. Подготовить horizontal scaling с room-sticky media nodes.
13. Провести security hardening.
14. Закрыть quality gates: contract, integration, E2E, mobile и load checks.

---

## Known issues — signaling service (post-Phase 5 review, 2026-06-04)

These were found during a structured code review of the signaling service improvements (worker pool, broadcast index, mutex leak fix, saveParticipant optimization).

### 🔴 P1 — Worker death does not propagate to RoomManager or SocketGateway

**File:** `apps/signaling/src/mediasoupService.ts` (`closeDeadRoom`, line ~492)

When a mediasoup worker dies, `closeDeadRoom` removes the room only from `MediasoupService.rooms`. `RoomManager.rooms` keeps a stale `RuntimeRoomState` with all participants. `SocketGateway.roomSockets` keeps the dead WebSocket references. No `participant:left` is broadcast; Redis participant keys are never removed.

Any subsequent signaling operation for those participants throws `TRANSPORT_NOT_FOUND` or `PRODUCER_NOT_FOUND` until the room eventually TTL-expires in Redis.

**Fix:** `MediasoupService` must expose a callback/event (`onRoomDead`) that `RoomManager` registers during initialization. When a worker dies, `RoomManager` calls `leave` for each affected participant and lets `SocketGateway` broadcast the disconnects normally.

---

### 🔴 P1 — `roomLocks.delete` race with concurrent join in `closeEmptyRoom`

**File:** `apps/signaling/src/roomManager.ts` (line ~185)

`closeEmptyRoom` deletes the room's mutex from `roomLocks` before `repository.closeRoom` completes. During the `await`, a concurrent `join` for the same room finds no entry in `roomLocks`, creates a fresh uncontested mutex, and proceeds — concurrently with the still-running `closeEmptyRoom`.

**Scenario:** `join` writes to `RoomManager.rooms` and Redis while `closeEmptyRoom` simultaneously deletes the room from Redis. The participant ends up joined in-memory to a room that was just deleted.

**Fix:** Move `this.roomLocks.delete(roomId)` to *after* the `await this.repository.closeRoom(...)` call, so the lock is held for the full duration of the operation.

---

### 🟠 P2 — `saveParticipant` silently clamps expired TTL to 1ms

**File:** `apps/signaling/src/redisRoomRepository.ts` (line ~51), `apps/signaling/src/roomManager.ts` `setMedia`

The optimization that removed the extra Redis `getRoom` call in `saveParticipant` also removed the `ROOM_EXPIRED` guard that `getRoom` provided. `setMedia` on a near-expired room now writes the participant hash with `Math.max(negativeMs, 1) = 1ms` TTL — the entry expires immediately after being written. The old code threw `ROOM_EXPIRED` in this path.

**Fix:** Add a lightweight expiry check in `setMedia` using the in-memory `state.metadata.expiresAt`:
```ts
if (new Date(state.metadata.expiresAt).getTime() <= Date.now()) {
  throw new SignalingError("ROOM_EXPIRED", "Room has expired");
}
```

---

### 🟡 P3 — Voluntary `room:leave` socket stays in `roomSockets` until close event

**File:** `apps/signaling/src/socketGateway.ts` (`routeEvent` room:leave handler, line ~261)

After `leave()` is called on a voluntary `room:leave`, the socket is not removed from `roomSockets` until the async `close` event fires. In the window between `leave()` returning and `socket.close(1000)` completing, subsequent broadcasts (e.g. `producer:added` from another participant) are delivered to the already-departed client.

**Fix:** Call `removeRoomSocket(context.roomId, context.socket)` inside `leave()` (or immediately before `socket.close(1000)` in the `room:leave` handler), not only in `handleDisconnect`.

---

### 🟡 P3 — `unhandledRejection` handler uses `console.error` instead of structured logger

**File:** `apps/signaling/src/main.ts` (line ~12)

The handler is registered before `createLogger()`, but both `readSignalingConfig()` and `createLogger()` are synchronous. Moving the handler three lines down gives it access to the structured logger at zero risk. As written, crash events bypass log aggregators that parse structured JSON.

**Fix:**
```ts
const config = readSignalingConfig();
const logger = createLogger("signaling");

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection", { reason: String(reason) });
  process.exit(1);
});
```
