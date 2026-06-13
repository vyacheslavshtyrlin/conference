# Service Repositories

## Decision

The **current MVP can be deployed from this combined repository** to move quickly.

The **future production project should not remain a monorepo**.

Frontend, API backend and signaling/media must be treated as separate services with separate repositories, separate CI/CD pipelines and explicit versioned contracts between them.

This file keeps the historical name `monorepo.md` because it is referenced by the agent guide and older docs. Its current content separates the immediate MVP deployment path from the future repository target.

## Current MVP repository mode

Current workspace:

```text
apps/web
apps/api
apps/signaling
packages/contracts
packages/config
packages/logger
docker-compose.yml
docker-compose.prod.yml
```

For the current DuckDNS MVP deployment, building from this repository on one server is acceptable.

This is temporary and should not be treated as the final production architecture.

## Target repository layout

Recommended future production repositories:

```text
conference-web/          React + Vite + Mantine browser client
conference-api/          NestJS HTTP API or future backend implementation
conference-signaling/    Node.js WebSocket + mediasoup service
conference-contracts/    Shared REST/WebSocket/Redis/token contracts
conference-deploy/       Docker Compose, reverse proxy, TURN and server deployment
conference-docs/         Product, architecture and operations docs, optional
```

Future optional repository:

```text
conference-recording/    Recording worker, encode/mux and S3 upload
```

The current workspace contains `apps/web`, `apps/api`, `apps/signaling` and `packages/contracts` while the MVP is being shaped. Those paths are valid for the current quick deploy, but must not be treated as the future production repository boundary.

## Service ownership

| Repository | Owns | Must not own |
|---|---|---|
| `conference-web` | UI, pre-join, REST client, WebSocket client, mediasoup-client flow | token signing, Redis, room authority |
| `conference-api` | room create/get/join HTTP API, creator marker, join token issuing, room metadata writes | WebSocket sessions, mediasoup runtime |
| `conference-signaling` | WebSocket protocol, token validation, live participants, mediasoup runtime, room cleanup | public room creation, product backend features |
| `conference-contracts` | versioned schemas, DTOs, event payloads, error codes, token/Redis shape docs | service runtime code |
| `conference-deploy` | Compose files, reverse proxy, TURN config, env templates, rollout scripts | application business logic |
| `conference-recording` | future recording pipeline and S3 upload | core signaling responsibility |

## Shared contracts

Cross-service payloads must not be copied informally.

Use one of these approaches:

1. Preferred: publish `conference-contracts` as a private package, for example `@conference/contracts`.
2. Acceptable for early MVP: keep `conference-contracts` as a Git submodule/subtree or pinned source dependency.
3. Temporary only: duplicate generated schemas into service repos, but pin the source contract version and remove manual drift quickly.

The contracts repository should contain:

- REST request/response schemas;
- WebSocket client/server event schemas;
- shared error codes;
- Redis key/value shape;
- join token header/payload/signature rules;
- semantic version and changelog.

Each service must still validate external inputs locally. A shared package is not a substitute for runtime validation at service boundaries.

## Contract versioning

Recommended version policy:

- Patch: clarifications, comments, docs, non-behavioral fixes.
- Minor: backwards-compatible fields/events.
- Major: breaking payload, token, Redis or lifecycle changes.

Production services should pin an exact contract version or a narrow range. Deploy should verify compatibility before rollout.

## Deployment model

The immediate MVP deploy is one repository and one server.

The future project is multi-repo but still multi-service.

Immediate MVP deployment target:

- one dedicated server;
- DuckDNS domain;
- Docker Compose from this repository;
- host nginx/certbot;
- Redis and coturn in Compose.

Future deployment target:

- `web` container from `conference-web`;
- `api` container from `conference-api`;
- `signaling` container from `conference-signaling`;
- `redis` infrastructure container;
- `turn` coturn infrastructure container;
- reverse proxy;
- optional future `recording` container.

`conference-deploy` owns the future production Compose files and pulls immutable image tags built by each service repository.

Example image naming:

```text
ghcr.io/<org>/conference-web:<git-sha>
ghcr.io/<org>/conference-api:<git-sha>
ghcr.io/<org>/conference-signaling:<git-sha>
```

Avoid future production Compose builds from local source checkouts. The current DuckDNS MVP can build on the server as a temporary shortcut.

## Local development

Local development can be done in either mode:

1. Clone all service repositories side by side and run a dev Compose file from `conference-deploy`.
2. Use the current combined workspace only as a convenience prototype, not as the target architecture.

Recommended side-by-side layout:

```text
conference/
  conference-web/
  conference-api/
  conference-signaling/
  conference-contracts/
  conference-deploy/
```

`conference-deploy/docker-compose.dev.yml` can mount local source folders from sibling repositories.

## Release coordination

Because services live in separate repos, releases need explicit coordination:

1. Update `conference-contracts`.
2. Release/publish contract version.
3. Update API/signaling/frontend dependencies.
4. Run service tests.
5. Build images with immutable tags.
6. Update `conference-deploy` image tags.
7. Run integration verification.
8. Deploy through protected/manual production job.

Breaking changes require a compatibility plan:

- deploy additive contract support first;
- update consumers;
- remove old contract only after all services are migrated.

## Source of truth

Architecture and contracts are source-of-truth documents, regardless of repository split:

- `docs/architecture.md`
- `docs/contracts.md`
- `docs/local-docker.md`
- `docs/deployment.md`
- `docs/work-plan.md`
- `docs/obsidian/*`

If docs live in a separate `conference-docs` repo later, service repos should link to exact docs versions or commits.
