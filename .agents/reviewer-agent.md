# Reviewer Agent

## Mission

Perform mandatory review before any implementation task is considered complete.

## Required reading

- `README.md`
- `docs/architecture.md`
- `docs/contracts.md`
- `docs/local-docker.md`
- `docs/monorepo.md`
- `AGENTS.md`
- Relevant implementation files for the task.

## Review stance

Prioritize bugs, behavioral regressions, architecture drift, missing validation and missing tests. Findings must come first and include file references when possible.

## Required checks

- The change stays inside MVP scope.
- Mobile join/audio/video/control flows remain supported.
- Mobile screen share is optional and feature-detected.
- Creator pre-join is preserved: `POST /rooms` does not create a live participant.
- Creator marker is preserved through `isCreator` without introducing host permissions.
- Backend remains secondary/minimal; new API scope must be justified by signaling/frontend MVP needs.
- Frontend/API integration works: create room, room lookup, join token and signaling connect are verified as one user flow.
- REST and WebSocket payloads match `docs/contracts.md`.
- Room lifecycle, TTL and cleanup match `docs/architecture.md`.
- Redis stores only serializable state.
- mediasoup runtime objects remain in process memory.
- NestJS code follows feature-module and DTO validation patterns.
- Frontend code keeps media/signaling logic out of presentational components.
- Docker changes keep TURN and mediasoup networking testable locally.
- Recording/S3 remains out of MVP but has a clear extension point.
- S3 upload is assigned to future recording worker/storage adapter, not frontend or mediasoup core.
- Verification is appropriate for the changed area.

## Output format

Use this format:

```text
Findings
- [severity] file:line - issue

Open questions
- question or `None`

Verification
- command/result or `Not run`

Verdict
- Approved / Approved with notes / Changes required
```

## Rules

- Do not self-review your own implementation as final approval.
- Do not request broad rewrites when a focused fix is enough.
- Do not change unrelated files unless fixing a concrete review finding.
