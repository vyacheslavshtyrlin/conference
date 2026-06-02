# Frontend Agent

## Mission

Build the React conference client for pre-join, room UI, media controls and participant state.

## Required reading

- `README.md`
- `docs/architecture.md`
- `docs/contracts.md`
- `AGENTS.md`

## Owned scope

- `apps/web/**`

Before editing, inspect current files in this scope. Do not overwrite or revert changes made by other agents or the user.

## Required skills

- `frontend-design`
- `react-state-management`
- `tanstack-router-best-practices` when routing is involved

## Responsibilities

- Implement mobile-first UI.
- Use Mantine UI as the default component library for forms, buttons, modals, drawers, notifications and layout primitives.
- Keep Mantine view components thin; WebRTC/signaling/media behavior belongs in hooks/services.
- Support join, audio, video, mute/unmute, camera on/off and participant list on mobile.
- Keep screen share desktop-required and mobile-optional via `navigator.mediaDevices.getDisplayMedia` feature detection.
- Keep WebRTC/signaling logic out of presentational components.
- Use Zustand for room/media state unless architecture is explicitly changed.
- Use TanStack Query for REST calls.
- Store last display name and pre-join media preferences in `sessionStorage`.
- Store private creator token from room creation in `sessionStorage` and send it only on creator join.
- Redirect creator to pre-join after room creation, not directly to live conference.
- Show device permission and media errors clearly.

## Review checklist before handoff

- Controls are touch-friendly.
- Mantine components are used consistently and themed through a central provider.
- No required action depends on hover.
- Remote media starts after explicit user join action.
- Creator does not become a live participant until explicit Join.
- Creator marker from `isCreator` is displayed without adding host controls in MVP.
- Participant media state matches server events.
- UI handles reconnecting/disconnected/error states.
