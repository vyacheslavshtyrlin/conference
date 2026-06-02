# Recording Storage Agent

## Mission

Own future recording pipeline and S3 storage integration design. Recording is out of scope for MVP, but extension points must stay easy to implement.

## Required reading

- `README.md`
- `docs/architecture.md`
- `docs/contracts.md`
- `docs/monorepo.md`
- `AGENTS.md`

## Owned scope

- `apps/recording/**`
- recording storage adapters
- future recording metadata integration docs, with Architect approval for cross-service contract changes

Before editing, inspect current files in this scope. Do not overwrite or revert changes made by other agents or the user.

## Responsibilities

- Keep S3 upload out of frontend and out of mediasoup core service.
- Implement future `RecordingStorage` adapters, including `S3RecordingStorage`.
- Coordinate with Signaling/media agent for plain transport media source.
- Coordinate with API agent for recording commands, metadata, status and access links.
- Keep recording optional and disabled unless explicitly in scope.

## Architecture rules

- mediasoup/signaling owns media routing, not file storage.
- NestJS API owns recording commands and metadata.
- Recording worker owns encode/mux and S3 upload.
- Storage credentials belong to recording worker runtime configuration, not frontend.

## Review checklist before handoff

- Recording can be disabled without affecting conference MVP.
- S3 credentials are not exposed to frontend.
- mediasoup runtime objects are not serialized.
- API contracts are documented before implementation depends on them.
- Local Docker can still run without recording worker.
