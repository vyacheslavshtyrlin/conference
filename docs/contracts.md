# API and WebSocket Contracts

## HTTP API

Base path: `/api/v1`.

### Create room

`POST /rooms`

Request:

```json
{}
```

Response:

```json
{
  "roomId": "room_01H...",
  "slug": "x7k2q9",
  "joinUrl": "http://localhost:5173/r/x7k2q9",
  "creatorToken": "short-lived-private-creator-token",
  "mediaNodeId": "local",
  "signalingUrl": "ws://localhost:4000/ws",
  "expiresAt": "2026-06-02T12:30:00.000Z"
}
```

`creatorToken` is private client state for the room creator. It must be stored in `sessionStorage` and must not be included in the public `joinUrl`.

### Get room

`GET /rooms/:slug`

Response:

```json
{
  "roomId": "room_01H...",
  "slug": "x7k2q9",
  "expiresAt": "2026-06-02T12:30:00.000Z",
  "status": "active",
  "mediaNodeId": "local",
  "signalingUrl": "ws://localhost:4000/ws"
}
```

### Join room

`POST /rooms/:slug/join`

Request:

```json
{
  "displayName": "Alex",
  "creatorToken": "short-lived-private-creator-token"
}
```

`creatorToken` is optional. Guests do not send it.

Response:

```json
{
  "participantId": "peer_01H...",
  "isCreator": true,
  "token": "signed-short-lived-token",
  "signalingUrl": "ws://localhost:4000/ws"
}
```

## WebSocket

Client connects:

```text
ws://localhost:4000/ws?token=<join-token>
```

### Server state model

Participant:

```json
{
  "participantId": "peer_01H...",
  "displayName": "Alex",
  "isCreator": true,
  "joinedAt": "2026-06-02T12:00:00.000Z",
  "connectionState": "online",
  "media": {
    "mic": "on",
    "camera": "off",
    "screen": "off"
  }
}
```

Media state values:

- `on`
- `off`
- `muted`
- `error`

### Client to server events

#### room:join

Sent after socket connection if token does not already complete the join.

```json
{
  "type": "room:join",
  "requestId": "req_1"
}
```

#### mediasoup:getRouterRtpCapabilities

```json
{
  "type": "mediasoup:getRouterRtpCapabilities",
  "requestId": "req_2"
}
```

#### mediasoup:createWebRtcTransport

```json
{
  "type": "mediasoup:createWebRtcTransport",
  "requestId": "req_3",
  "direction": "send"
}
```

`direction` is `send` or `recv`.

#### mediasoup:connectTransport

```json
{
  "type": "mediasoup:connectTransport",
  "requestId": "req_4",
  "transportId": "transport-id",
  "dtlsParameters": {}
}
```

#### mediasoup:produce

```json
{
  "type": "mediasoup:produce",
  "requestId": "req_5",
  "transportId": "transport-id",
  "kind": "video",
  "rtpParameters": {},
  "appData": {
    "source": "camera"
  }
}
```

`appData.source` is `mic`, `camera`, or `screen`.

Only one active `screen` producer is allowed per room. If another participant is already sharing a screen, `mediasoup:produce` for `appData.source: "screen"` returns an error response with code `MEDIASOUP_ERROR`.

#### mediasoup:consume

```json
{
  "type": "mediasoup:consume",
  "requestId": "req_6",
  "transportId": "transport-id",
  "producerId": "producer-id",
  "rtpCapabilities": {}
}
```

#### mediasoup:closeProducer

```json
{
  "type": "mediasoup:closeProducer",
  "requestId": "req_7",
  "producerId": "producer-id"
}
```

The signaling/media service verifies that the producer belongs to the requesting participant. Closing a `screen` producer releases the room screen-share slot and emits `producer:closed`.

#### media:setState

```json
{
  "type": "media:setState",
  "requestId": "req_8",
  "media": {
    "mic": "muted",
    "camera": "off",
    "screen": "off"
  }
}
```

#### room:leave

```json
{
  "type": "room:leave",
  "requestId": "req_9"
}
```

### Server to client events

#### response

All request/response commands return:

```json
{
  "type": "response",
  "requestId": "req_3",
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "type": "response",
  "requestId": "req_3",
  "ok": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room not found"
  }
}
```

#### room:snapshot

```json
{
  "type": "room:snapshot",
  "roomId": "room_01H...",
  "participants": []
}
```

#### participant:joined

```json
{
  "type": "participant:joined",
  "participant": {}
}
```

#### participant:left

```json
{
  "type": "participant:left",
  "participantId": "peer_01H..."
}
```

#### participant:mediaChanged

```json
{
  "type": "participant:mediaChanged",
  "participantId": "peer_01H...",
  "media": {
    "mic": "muted",
    "camera": "on",
    "screen": "off"
  }
}
```

#### producer:added

```json
{
  "type": "producer:added",
  "producerId": "producer-id",
  "participantId": "peer_01H...",
  "kind": "video",
  "source": "camera"
}
```

#### producer:closed

```json
{
  "type": "producer:closed",
  "producerId": "producer-id",
  "participantId": "peer_01H...",
  "source": "camera"
}
```

## Error codes

- `ROOM_NOT_FOUND`
- `ROOM_EXPIRED`
- `ROOM_FULL`
- `INVALID_TOKEN`
- `INVALID_PAYLOAD`
- `TRANSPORT_NOT_FOUND`
- `PRODUCER_NOT_FOUND`
- `MEDIASOUP_ERROR`

## Redis keys

Room metadata:

```text
room:{roomId}
```

Value:

```json
{
  "roomId": "room_01H...",
  "slug": "x7k2q9",
  "mediaNodeId": "local",
  "signalingUrl": "ws://localhost:4000/ws",
  "creatorTokenHash": "hash",
  "createdAt": "2026-06-02T12:00:00.000Z",
  "expiresAt": "2026-06-02T12:30:00.000Z",
  "status": "active"
}
```

Slug lookup:

```text
room_slug:{slug} -> roomId
```

Participants:

```text
room:{roomId}:participants
```

Hash field: `participantId`.

TTL: same as room, or removed immediately when the room is closed.
