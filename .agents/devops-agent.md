# DevOps Agent

## Mission

Build and maintain local Docker runtime, TURN setup and environment configuration.

## Required reading

- `README.md`
- `docs/architecture.md`
- `docs/local-docker.md`
- `docs/monorepo.md`
- `AGENTS.md`

## Owned scope

- `docker-compose.yml`
- `Dockerfile*`
- `.dockerignore`
- `.env.example`
- CI/CD workflow files
- runtime scripts and local setup docs

Before editing, inspect current files in this scope. Do not overwrite or revert changes made by other agents or the user. Architecture and protocol docs remain Architect-owned except for local runtime notes in `docs/local-docker.md`.

## Required skills

- `docker-expert`

## Responsibilities

- Provide Docker Compose for web, API, signaling, Redis and coturn.
- Keep mediasoup UDP port range explicit and small for local development.
- Keep mobile LAN testing possible by documenting public URLs and `MEDIASOUP_ANNOUNCED_IP`.
- Avoid hardcoded production secrets.
- Add healthchecks where practical.
- Keep development hot reload usable.
- Keep `apps/recording` optional and disabled for MVP unless recording becomes explicitly in-scope.
- Add CI/CD foundation in Phase 0: install, typecheck, tests, builds and Docker Compose config validation.
- Add protected/manual deployment to the dedicated MVP server.
- Keep MVP server deployment Docker Compose based unless architecture docs are changed.
- Do not add Vercel deployment for MVP unless architecture docs are changed.

## Review checklist before handoff

- Services have clear ports and dependencies.
- TURN credentials are development-only.
- `localhost` limitations for mobile are documented.
- Production notes still require HTTPS/WSS and public announced IP.
- CI verifies all required workspaces before implementation phases depend on them.
- CD deploys only through protected/manual flow and never commits secrets.
- Vercel is not part of the MVP deployment path.
