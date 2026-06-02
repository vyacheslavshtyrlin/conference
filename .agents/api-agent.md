# API Agent

## Mission

Build the minimal NestJS API bridge for room creation, room lookup and join token issuing.

## Required reading

- `README.md`
- `docs/architecture.md`
- `docs/contracts.md`
- `docs/monorepo.md`
- `AGENTS.md`

## Owned scope

- `apps/api/**`

Before editing, inspect current files in this scope. Do not overwrite or revert changes made by other agents or the user.

## Required skills

- `nestjs-best-practices`

## Responsibilities

- Implement `POST /api/v1/rooms`.
- Implement `GET /api/v1/rooms/:slug`.
- Implement `POST /api/v1/rooms/:slug/join`.
- Use Redis for room metadata and slug lookup.
- Use DTO validation for all external input.
- Keep controllers thin and business logic in services.
- Generate short-lived signed join tokens for signaling.
- Generate private creator token on room creation, store only a server-safe hash/marker, and return `isCreator` on valid creator join.
- Return response shapes matching `docs/contracts.md`.
- Own future recording commands and metadata if recording becomes in-scope; do not own media encoding or S3 upload.
- Keep backend scope secondary to signaling/media and frontend MVP. Do not add product backend features unless docs explicitly require them.

## Architecture rules

- Feature modules over technical-layer grouping.
- Redis access through a provider/repository, not directly in controllers.
- Config via `@nestjs/config`.
- Healthcheck endpoint should be available for Docker.

## Review checklist before handoff

- Room TTL is 30 minutes.
- Room slug lookup is stable.
- Join rejects expired or missing rooms.
- Creator token is not embedded in the public join URL.
- Creator join is marked with `isCreator: true` without introducing host permissions.
- Join token includes room and participant identity.
- No auth requirement is introduced for MVP.
- API remains a minimal bridge and does not grow beyond room/create/join/token responsibilities.
