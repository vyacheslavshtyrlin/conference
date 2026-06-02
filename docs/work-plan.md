# Work Plan

## Goal

Build the Conference MVP in a monorepo with primary focus on React/Mantine frontend and Node.js mediasoup signaling/media service. NestJS API is secondary and intentionally minimal for room creation, creator marker and join token issuing.

This plan is intentionally split into phases so agents can break each phase into smaller owned tasks.

## Phase 0 - Repository foundation

Owner: Architect + DevOps.

1. Create monorepo workspace structure.
2. Add root package manager config, recommended `pnpm`.
3. Add shared TypeScript config and lint/test conventions.
4. Create app folders:
   - `apps/web`
   - `apps/api`
   - `apps/signaling`
5. Create shared packages:
   - `packages/contracts`
   - `packages/config`
   - `packages/logger`
6. Add Docker Compose skeleton for web, API, signaling, Redis and coturn.
7. Add CI/CD foundation:
   - install dependencies from the root lockfile;
   - run typecheck for all workspaces;
   - run tests for changed or all workspaces;
   - run frontend/API/signaling builds;
   - validate Docker Compose config;
   - add protected/manual deploy job for the dedicated MVP server.
8. Document MVP server deployment assumptions:
   - one dedicated server for MVP;
   - Docker Compose based deployment;
   - no Vercel deployment for MVP;
   - HTTPS/WSS termination through reverse proxy;
   - public UDP port range for mediasoup;
   - coturn reachable from the internet;
   - secrets managed outside git.

Exit criteria:

- Workspace installs from root.
- Each app has a minimal health/start script.
- Docker Compose can start Redis and coturn.
- CI pipeline can verify install, typecheck, tests, builds and compose config.
- CD pipeline can deploy to the dedicated MVP server through a protected/manual job.
- Vercel is not part of the MVP deployment path.

## Phase 1 - Shared contracts

Owner: Architect.

1. Move REST and WebSocket payload types from `docs/contracts.md` into `packages/contracts`.
2. Add runtime validation schemas, preferably Zod.
3. Export shared error codes.
4. Keep documentation and package schemas aligned.

Exit criteria:

- API and signaling can import shared contracts.
- Contract package has typecheck coverage.

## Phase 2 - Signaling/media MVP

Owner: Signaling/media agent.

1. Scaffold Node.js TypeScript service in `apps/signaling`.
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

1. Scaffold React + Vite app in `apps/web`.
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

1. Scaffold NestJS app in `apps/api`.
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

## Phase 5 - Frontend WebRTC integration

Owner: Frontend agent + Signaling/media agent.

1. Implement pre-join device flow.
2. Store display name and device preferences in `sessionStorage`.
3. Store creator token from room creation in `sessionStorage`.
4. Redirect creator to the created room pre-join screen, not directly to live conference.
5. Implement signaling client.
6. Implement mediasoup client device and transports.
7. Implement audio/video publish.
8. Implement remote consumers and video grid.
9. Implement mute/unmute, camera on/off and leave.
10. Implement desktop screen share.
11. Feature-detect mobile screen share.
12. Show permission and device errors.

Exit criteria:

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
4. Test two desktop clients in one room.
5. Test one mobile client joining room.
6. Verify room TTL and empty-room cleanup.
7. Verify mandatory MVP scope:
   - no auth;
   - no chat;
   - no recording implementation;
   - no S3 upload implementation;
   - recording extension points remain documented.

Exit criteria:

- Reviewer verdict is Approved.
- Remaining risks are documented.

## Starting point

Start with Phase 0 and Phase 1. After that, prioritize Phase 2 Signaling/media and Phase 3 Frontend shell. Phase 4 API bridge should stay minimal and unblock room creation/join tokens only. Do not add backend features beyond the API bridge unless they are required for signaling/frontend MVP or explicitly approved in architecture docs.
