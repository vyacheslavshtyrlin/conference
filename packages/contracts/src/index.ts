import { z } from "zod";

export const CONTRACTS_PACKAGE = "@conference/contracts";

export const MAX_ROOM_PARTICIPANTS = 10;
export const ROOM_TTL_SECONDS = 30 * 60;

export const serviceNameSchema = z.enum(["web", "api", "signaling"]);

export const healthStatusSchema = z.object({
  status: z.literal("ok"),
  service: serviceNameSchema,
});

export type ServiceName = z.infer<typeof serviceNameSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const roomStatusSchema = z.literal("active");

export const createRoomRequestSchema = z.object({}).strict();

export const createRoomResponseSchema = z.object({
  roomId: z.string().min(1),
  slug: z.string().min(1),
  joinUrl: z.string().url(),
  creatorToken: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export const getRoomResponseSchema = z.object({
  roomId: z.string().min(1),
  slug: z.string().min(1),
  expiresAt: z.string().datetime(),
  status: roomStatusSchema,
});

export const joinRoomRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  creatorToken: z.string().min(1).optional(),
});

export const joinRoomResponseSchema = z.object({
  participantId: z.string().min(1),
  isCreator: z.boolean(),
  token: z.string().min(1),
  signalingUrl: z.string().url(),
});

export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;
export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;
export type GetRoomResponse = z.infer<typeof getRoomResponseSchema>;
export type JoinRoomRequest = z.infer<typeof joinRoomRequestSchema>;
export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;

export const mediaStateValueSchema = z.enum(["on", "off", "muted", "error"]);
export const mediaSourceSchema = z.enum(["mic", "camera", "screen"]);
export const connectionStateSchema = z.literal("online");
export const transportDirectionSchema = z.enum(["send", "recv"]);
export const mediaKindSchema = z.enum(["audio", "video"]);

export const participantMediaSchema = z.object({
  mic: mediaStateValueSchema,
  camera: mediaStateValueSchema,
  screen: mediaStateValueSchema,
});

export const participantSchema = z.object({
  participantId: z.string().min(1),
  displayName: z.string().min(1),
  isCreator: z.boolean(),
  joinedAt: z.string().datetime(),
  connectionState: connectionStateSchema,
  media: participantMediaSchema,
});

export type MediaStateValue = z.infer<typeof mediaStateValueSchema>;
export type MediaSource = z.infer<typeof mediaSourceSchema>;
export type ConnectionState = z.infer<typeof connectionStateSchema>;
export type TransportDirection = z.infer<typeof transportDirectionSchema>;
export type MediaKind = z.infer<typeof mediaKindSchema>;
export type ParticipantMedia = z.infer<typeof participantMediaSchema>;
export type Participant = z.infer<typeof participantSchema>;

export const errorCodeSchema = z.enum([
  "ROOM_NOT_FOUND",
  "ROOM_EXPIRED",
  "ROOM_FULL",
  "INVALID_TOKEN",
  "INVALID_PAYLOAD",
  "TRANSPORT_NOT_FOUND",
  "PRODUCER_NOT_FOUND",
  "MEDIASOUP_ERROR",
]);

export const ERROR_CODES = errorCodeSchema.options;

export const contractErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ContractError = z.infer<typeof contractErrorSchema>;

const requestIdSchema = z.string().min(1);
const mediasoupParametersSchema = z.record(z.string(), z.unknown());

export const roomJoinRequestEventSchema = z.object({
  type: z.literal("room:join"),
  requestId: requestIdSchema,
});

export const getRouterRtpCapabilitiesRequestEventSchema = z.object({
  type: z.literal("mediasoup:getRouterRtpCapabilities"),
  requestId: requestIdSchema,
});

export const createWebRtcTransportRequestEventSchema = z.object({
  type: z.literal("mediasoup:createWebRtcTransport"),
  requestId: requestIdSchema,
  direction: transportDirectionSchema,
});

export const connectTransportRequestEventSchema = z.object({
  type: z.literal("mediasoup:connectTransport"),
  requestId: requestIdSchema,
  transportId: z.string().min(1),
  dtlsParameters: mediasoupParametersSchema,
});

export const produceRequestEventSchema = z.object({
  type: z.literal("mediasoup:produce"),
  requestId: requestIdSchema,
  transportId: z.string().min(1),
  kind: mediaKindSchema,
  rtpParameters: mediasoupParametersSchema,
  appData: z.object({
    source: mediaSourceSchema,
  }),
});

export const consumeRequestEventSchema = z.object({
  type: z.literal("mediasoup:consume"),
  requestId: requestIdSchema,
  transportId: z.string().min(1),
  producerId: z.string().min(1),
  rtpCapabilities: mediasoupParametersSchema,
});

export const setMediaStateRequestEventSchema = z.object({
  type: z.literal("media:setState"),
  requestId: requestIdSchema,
  media: participantMediaSchema,
});

export const roomLeaveRequestEventSchema = z.object({
  type: z.literal("room:leave"),
  requestId: requestIdSchema,
});

export const clientWebSocketEventSchema = z.discriminatedUnion("type", [
  roomJoinRequestEventSchema,
  getRouterRtpCapabilitiesRequestEventSchema,
  createWebRtcTransportRequestEventSchema,
  connectTransportRequestEventSchema,
  produceRequestEventSchema,
  consumeRequestEventSchema,
  setMediaStateRequestEventSchema,
  roomLeaveRequestEventSchema,
]);

export type RoomJoinRequestEvent = z.infer<typeof roomJoinRequestEventSchema>;
export type GetRouterRtpCapabilitiesRequestEvent = z.infer<
  typeof getRouterRtpCapabilitiesRequestEventSchema
>;
export type CreateWebRtcTransportRequestEvent = z.infer<
  typeof createWebRtcTransportRequestEventSchema
>;
export type ConnectTransportRequestEvent = z.infer<typeof connectTransportRequestEventSchema>;
export type ProduceRequestEvent = z.infer<typeof produceRequestEventSchema>;
export type ConsumeRequestEvent = z.infer<typeof consumeRequestEventSchema>;
export type SetMediaStateRequestEvent = z.infer<typeof setMediaStateRequestEventSchema>;
export type RoomLeaveRequestEvent = z.infer<typeof roomLeaveRequestEventSchema>;
export type ClientWebSocketEvent = z.infer<typeof clientWebSocketEventSchema>;

export const responseSuccessEventSchema = z.object({
  type: z.literal("response"),
  requestId: requestIdSchema,
  ok: z.literal(true),
  data: z.unknown(),
});

export const responseErrorEventSchema = z.object({
  type: z.literal("response"),
  requestId: requestIdSchema,
  ok: z.literal(false),
  error: contractErrorSchema,
});

export const responseEventSchema = z.discriminatedUnion("ok", [
  responseSuccessEventSchema,
  responseErrorEventSchema,
]);

export const roomSnapshotEventSchema = z.object({
  type: z.literal("room:snapshot"),
  roomId: z.string().min(1),
  participants: z.array(participantSchema),
});

export const participantJoinedEventSchema = z.object({
  type: z.literal("participant:joined"),
  participant: participantSchema,
});

export const participantLeftEventSchema = z.object({
  type: z.literal("participant:left"),
  participantId: z.string().min(1),
});

export const participantMediaChangedEventSchema = z.object({
  type: z.literal("participant:mediaChanged"),
  participantId: z.string().min(1),
  media: participantMediaSchema,
});

export const producerAddedEventSchema = z.object({
  type: z.literal("producer:added"),
  producerId: z.string().min(1),
  participantId: z.string().min(1),
  kind: mediaKindSchema,
  source: mediaSourceSchema,
});

export const producerClosedEventSchema = z.object({
  type: z.literal("producer:closed"),
  producerId: z.string().min(1),
  participantId: z.string().min(1),
  source: mediaSourceSchema,
});

export const serverWebSocketEventSchema = z.union([
  responseEventSchema,
  roomSnapshotEventSchema,
  participantJoinedEventSchema,
  participantLeftEventSchema,
  participantMediaChangedEventSchema,
  producerAddedEventSchema,
  producerClosedEventSchema,
]);

export type ResponseSuccessEvent = z.infer<typeof responseSuccessEventSchema>;
export type ResponseErrorEvent = z.infer<typeof responseErrorEventSchema>;
export type ResponseEvent = z.infer<typeof responseEventSchema>;
export type RoomSnapshotEvent = z.infer<typeof roomSnapshotEventSchema>;
export type ParticipantJoinedEvent = z.infer<typeof participantJoinedEventSchema>;
export type ParticipantLeftEvent = z.infer<typeof participantLeftEventSchema>;
export type ParticipantMediaChangedEvent = z.infer<typeof participantMediaChangedEventSchema>;
export type ProducerAddedEvent = z.infer<typeof producerAddedEventSchema>;
export type ProducerClosedEvent = z.infer<typeof producerClosedEventSchema>;
export type ServerWebSocketEvent = z.infer<typeof serverWebSocketEventSchema>;

export const roomMetadataSchema = z.object({
  roomId: z.string().min(1),
  slug: z.string().min(1),
  creatorTokenHash: z.string().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: roomStatusSchema,
});

export type RoomMetadata = z.infer<typeof roomMetadataSchema>;
