# Agents Guide

This repository is a Conference MVP project. Agents working here must use the project documentation as the source of truth before changing code.

## Source of truth

Read these documents before implementation:

- `README.md` - MVP scope and out-of-scope decisions.
- `docs/architecture.md` - service boundaries, lifecycle, patterns, extension points.
- `docs/contracts.md` - HTTP API, WebSocket protocol, Redis keys.
- `docs/local-docker.md` - Docker, TURN and local WebRTC notes.
- `docs/monorepo.md` - monorepo layout, workspaces and local/deploy model.
- `docs/work-plan.md` - implementation phases and task sequencing.

If a task conflicts with these documents, stop and update the architecture/contracts first or ask for an explicit product decision.

## Fixed stack

- Web app: React, TypeScript, Vite, Mantine UI.
- Frontend state: Zustand for room/media state, TanStack Query for REST state.
- API: NestJS, TypeScript, minimal bridge for room creation and join token issuing.
- Signaling/media: Node.js, TypeScript, mediasoup, WebSocket.
- State: Redis.
- Local runtime: Docker Compose.
- MVP deploy target: one dedicated server with Docker Compose based deployment.
- Vercel is not used for MVP deployment.
- TURN/STUN: coturn.

## Required skills by work type

- Frontend UI and UX: `frontend-design`, `react-state-management`.
- Routing or URL state: `tanstack-router-best-practices`.
- Tables/lists with complex state: `tanstack-table`.
- NestJS API: `nestjs-best-practices`.
- Docker and TURN runtime: `docker-expert`.
- Web app visual implementation: `frontend-design`.

These skills are expected to be used when available in the Codex environment. Do not install new skills without a concrete missing capability or an explicit skill name.

## Agent roles

Use the role files in `.agents/`:

- `.agents/architect.md`
- `.agents/frontend-agent.md`
- `.agents/signaling-media-agent.md`
- `.agents/api-agent.md`
- `.agents/devops-agent.md`
- `.agents/recording-storage-agent.md`
- `.agents/reviewer-agent.md`

Each implementation task should assign one owning agent and one reviewing agent. Large tasks can be split across agents only when write scopes are disjoint.

Agents are not alone in this repository. Before editing, inspect the current files in the assigned scope. Do not overwrite, revert or discard changes made by other agents or the user. If another agent has touched the same file, adapt to the existing changes or coordinate before continuing.

## Development workflow

1. Read the source-of-truth documents.
2. Identify the owning agent and required skills.
3. Define the write scope before editing files.
4. Inspect current changes in the assigned scope.
5. Implement the smallest coherent slice.
6. Run relevant verification.
7. Run mandatory review with `.agents/reviewer-agent.md`.
8. Fix review findings or document why a finding is not applicable.
9. Update docs when architecture, contracts, ports, state model or lifecycle changes.

## Mandatory review

Review is required before a task is considered complete.

The reviewer must check:

- The implementation follows MVP scope.
- Mobile support is not broken.
- Screen share remains desktop-required and mobile-optional.
- WebSocket and REST payloads match `docs/contracts.md`.
- Room lifecycle and Redis TTL behavior match `docs/architecture.md`.
- mediasoup runtime objects are not stored in Redis.
- Frontend UI has touch-friendly controls and no hover-only required actions.
- Frontend UI uses Mantine as the base component library unless a custom component is justified.
- Creator pre-join flow is preserved: room creation does not create a live participant until explicit Join.
- Creator metadata is preserved: creator can be marked as `isCreator` without adding host permissions in MVP.
- Frontend/API integration is verified: create room, room lookup, join token issuing and signaling connect work as one flow.
- Docker/TURN changes remain compatible with `docs/local-docker.md`.
- Tests or verification are appropriate for the risk.

Implementation agents must not self-approve their own work.

## Code ownership guidelines

- Frontend agent owns `apps/web/**`.
- API agent owns `apps/api/**`.
- Signaling/media agent owns `apps/signaling/**`.
- DevOps agent owns Dockerfiles, compose files, env examples and local runtime docs. DevOps may update `docs/local-docker.md` when runtime behavior changes, but architecture and protocol contract changes remain Architect-owned.
- DevOps agent owns CI/CD workflow files and must keep Phase 0 verification runnable from the monorepo root.
- Recording/storage agent owns future recording worker, recording storage adapters and S3 upload integration.
- Architect owns docs, contracts and cross-service decisions.
- Reviewer can inspect all files and should avoid unrelated edits unless fixing a clear review finding.

## Current MVP decisions

- Max participants per room: 10.
- No auth for MVP.
- User enters display name before joining.
- Room creator is distinguished with `isCreator`, but host permissions are out of scope for MVP.
- MVP implementation focus is Signaling/media and Frontend. Backend remains secondary and minimal.
- Room expires after 30 minutes or closes after everyone leaves.
- Redis is required for room/session state.
- PostgreSQL is deferred until persistence, analytics, users or recordings are needed.
- Chat, recording, S3 upload, roles and moderation are out of scope for MVP.
- Recording extension points should remain possible.
- S3 upload is future recording-worker responsibility, not frontend and not mediasoup core responsibility.
- Mobile support is required for join, audio, video, mute/unmute, camera on/off and participant list.
- Mobile screen share is optional and feature-detected.
- Mantine UI is the default component library for the React app.
