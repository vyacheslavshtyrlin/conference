import { clientWebSocketEventSchema } from "@conference/contracts";
import type {
  ClientWebSocketEvent,
  ErrorCode,
  Participant,
  ServerWebSocketEvent,
} from "@conference/contracts";
import type { Logger } from "@conference/logger";
import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import { SignalingError, toContractError } from "./errors.js";
import type { RoomManager } from "./roomManager.js";
import { verifyJoinToken } from "./token.js";

type WebSocketRuntimeConfig = {
  heartbeatIntervalMs: number;
  sendBackpressureBytes: number;
  rateLimitWindowMs: number;
  rateLimitMaxMessages: number;
  allowedOrigins: string[];
};

type ClientContext = {
  socket: WebSocket;
  roomId: string;
  participantId: string;
  joined: boolean;
  isAlive: boolean;
  rateLimit: {
    windowStartedAt: number;
    messageCount: number;
  };
};

export class SocketGateway {
  private readonly clients = new Map<WebSocket, ClientContext>();
  private readonly roomSockets = new Map<string, Set<WebSocket>>();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly wsServer: WebSocketServer,
    private readonly roomManager: RoomManager,
    private readonly joinTokenSecret: string,
    private readonly logger: Logger,
    private readonly config: WebSocketRuntimeConfig,
  ) {}

  start(): void {
    this.roomManager.setParticipantEvictedCallback((roomId, participantId) => {
      this.handleParticipantEvicted(roomId, participantId);
    });

    this.wsServer.on("connection", (socket, request) => {
      void this.handleConnection(socket, request);
    });

    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatIntervalMs);
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    for (const context of this.clients.values()) {
      context.socket.close(1001, "Server shutting down");
    }
    this.roomSockets.clear();
  }

  private async handleConnection(socket: WebSocket, request: IncomingMessage): Promise<void> {
    try {
      this.assertAllowedOrigin(request);
      const url = new URL(request.url ?? "", "ws://localhost");
      const payload = verifyJoinToken(url.searchParams.get("token") ?? undefined, this.joinTokenSecret);
      const context: ClientContext = {
        socket,
        roomId: payload.roomId,
        participantId: payload.participantId,
        joined: false,
        isAlive: true,
        rateLimit: {
          windowStartedAt: Date.now(),
          messageCount: 0,
        },
      };
      this.clients.set(socket, context);

      socket.on("pong", () => {
        context.isAlive = true;
      });
      socket.on("message", (raw) => {
        void this.handleMessage(context, raw);
      });
      socket.on("close", () => {
        void this.handleDisconnect(context);
      });
      socket.on("error", (error) => {
        this.logger.warn("websocket error", { error: error.message, participantId: context.participantId });
      });

      await this.joinRoom(context, payload);
    } catch (error) {
      this.logger.error("connection rejected", { error: error instanceof Error ? error.message : String(error) });
      this.send(socket, {
        type: "response",
        requestId: "connection",
        ok: false,
        error: toContractError(error),
      });
      socket.close(1008);
    }
  }

  private assertAllowedOrigin(request: IncomingMessage): void {
    if (this.config.allowedOrigins.length === 0) {
      return;
    }

    const origin = request.headers.origin;
    if (!origin || !this.config.allowedOrigins.includes(origin)) {
      this.logger.warn("websocket origin rejected", { origin: origin ?? "missing" });
      throw new SignalingError("INVALID_TOKEN", "WebSocket origin is not allowed");
    }
  }

  private async handleMessage(context: ClientContext, raw: WebSocket.RawData): Promise<void> {
    if (this.isRateLimited(context)) {
      const requestId = this.extractRequestId(raw);
      this.logger.warn("websocket message rate limit exceeded", {
        participantId: context.participantId,
        roomId: context.roomId,
        limit: this.config.rateLimitMaxMessages,
        windowMs: this.config.rateLimitWindowMs,
      });
      this.sendError(context.socket, requestId, "INVALID_PAYLOAD", "Message rate limit exceeded");
      context.socket.close(1008, "Message rate limit exceeded");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      this.sendError(context.socket, "unknown", "INVALID_PAYLOAD", "Payload must be valid JSON");
      return;
    }

    const result = clientWebSocketEventSchema.safeParse(parsed);
    if (!result.success) {
      const requestId =
        typeof parsed === "object" && parsed !== null && "requestId" in parsed && typeof parsed.requestId === "string"
          ? parsed.requestId
          : "unknown";
      this.sendError(context.socket, requestId, "INVALID_PAYLOAD", "Payload does not match WebSocket contract");
      return;
    }

    try {
      await this.routeEvent(context, result.data);
    } catch (error) {
      this.send(context.socket, {
        type: "response",
        requestId: result.data.requestId,
        ok: false,
        error: toContractError(error),
      });
    }
  }

  private async routeEvent(context: ClientContext, event: ClientWebSocketEvent): Promise<void> {
    switch (event.type) {
      case "room:join": {
        this.assertJoined(context);
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data: {} });
        return;
      }

      case "mediasoup:getRouterRtpCapabilities": {
        this.assertJoined(context);
        const data = await this.roomManager.getRouterRtpCapabilities(context.roomId);
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data });
        return;
      }

      case "mediasoup:createWebRtcTransport": {
        this.assertJoined(context);
        const data = await this.roomManager.createTransport(context.roomId, context.participantId, event.direction);
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data });
        return;
      }

      case "mediasoup:connectTransport": {
        await this.roomManager.connectTransport(
          context.roomId,
          context.participantId,
          event.transportId,
          event.dtlsParameters,
        );
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data: {} });
        return;
      }

      case "mediasoup:produce": {
        const data = await this.roomManager.produce(
          context.roomId,
          context.participantId,
          event.transportId,
          event.kind,
          event.rtpParameters,
          event.appData.source,
          (producerId) => {
            this.broadcast(context.roomId, {
              type: "producer:closed",
              producerId,
              participantId: context.participantId,
              source: event.appData.source,
            });
          },
        );
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data });
        this.broadcast(context.roomId, {
          type: "producer:added",
          producerId: data.id,
          participantId: context.participantId,
          kind: event.kind,
          source: event.appData.source,
        });
        return;
      }

      case "mediasoup:consume": {
        const data = await this.roomManager.consume(
          context.roomId,
          context.participantId,
          event.transportId,
          event.producerId,
          event.rtpCapabilities,
        );
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data });
        return;
      }

      case "mediasoup:closeProducer": {
        await this.roomManager.closeProducer(context.roomId, context.participantId, event.producerId);
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data: {} });
        return;
      }

      case "media:setState": {
        const participant = await this.roomManager.setMedia(context.roomId, context.participantId, event.media);
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data: {} });
        this.broadcast(context.roomId, {
          type: "participant:mediaChanged",
          participantId: participant.participantId,
          media: participant.media,
        });
        return;
      }

      case "room:leave": {
        await this.leave(context);
        this.send(context.socket, { type: "response", requestId: event.requestId, ok: true, data: {} });
        context.socket.close(1000);
        return;
      }
    }
  }

  private async joinRoom(context: ClientContext, payload: Parameters<typeof this.roomManager.join>[0]): Promise<void> {
    const { room, participant, participants } = await this.roomManager.join(payload);
    context.joined = true;
    this.addRoomSocket(context.roomId, context.socket);

    this.send(context.socket, {
      type: "room:snapshot",
      roomId: room.roomId,
      participants,
    });

    for (const producer of this.roomManager.listProducers(room.roomId)) {
      this.send(context.socket, {
        type: "producer:added",
        producerId: producer.producerId,
        participantId: producer.participantId,
        kind: producer.kind,
        source: producer.source,
      });
    }

    this.broadcast(room.roomId, { type: "participant:joined", participant }, context.socket);
  }

  private async leave(context: ClientContext): Promise<Participant | undefined> {
    if (!context.joined) {
      return undefined;
    }

    context.joined = false;
    // Fix 4: remove from roomSockets before broadcasting so the leaving socket
    // cannot receive subsequent events in the window before the close event fires.
    this.removeRoomSocket(context.roomId, context.socket);
    const participant = await this.roomManager.leave(context.roomId, context.participantId);
    this.broadcast(context.roomId, { type: "participant:left", participantId: context.participantId });
    return participant;
  }

  // Called when a mediasoup worker dies and RoomManager has evicted a participant.
  private handleParticipantEvicted(roomId: string, participantId: string): void {
    // Remove the evicted socket from roomSockets BEFORE broadcasting so it does
    // not receive its own participant:left event. Search only room-scoped sockets
    // (O(room-size)) instead of scanning all connected clients.
    const roomSocketSet = this.roomSockets.get(roomId);
    if (roomSocketSet) {
      for (const socket of roomSocketSet) {
        const context = this.clients.get(socket);
        if (context?.participantId === participantId) {
          context.joined = false;
          this.removeRoomSocket(roomId, socket);
          this.clients.delete(socket);
          socket.close(1011, "Media server error");
          break;
        }
      }
    }

    this.broadcast(roomId, { type: "participant:left", participantId });
  }

  private async handleDisconnect(context: ClientContext): Promise<void> {
    this.clients.delete(context.socket);
    this.removeRoomSocket(context.roomId, context.socket);
    await this.leave(context);
  }

  private broadcast(roomId: string, event: ServerWebSocketEvent, except?: WebSocket): void {
    const sockets = this.roomSockets.get(roomId);
    if (!sockets) {
      return;
    }
    for (const socket of sockets) {
      if (socket !== except && socket.readyState === WebSocket.OPEN) {
        this.send(socket, event);
      }
    }
  }

  private addRoomSocket(roomId: string, socket: WebSocket): void {
    let sockets = this.roomSockets.get(roomId);
    if (!sockets) {
      sockets = new Set();
      this.roomSockets.set(roomId, sockets);
    }
    sockets.add(socket);
  }

  private removeRoomSocket(roomId: string, socket: WebSocket): void {
    const sockets = this.roomSockets.get(roomId);
    if (!sockets) {
      return;
    }
    sockets.delete(socket);
    if (sockets.size === 0) {
      this.roomSockets.delete(roomId);
    }
  }

  private send(socket: WebSocket, event: ServerWebSocketEvent): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (socket.bufferedAmount > this.config.sendBackpressureBytes) {
      const context = this.clients.get(socket);
      this.logger.warn("websocket send buffer exceeded", {
        bufferedAmount: socket.bufferedAmount,
        participantId: context?.participantId,
        roomId: context?.roomId,
      });
      socket.close(1013, "Backpressure limit exceeded");
      return;
    }

    socket.send(JSON.stringify(event), (error) => {
      if (error) {
        const context = this.clients.get(socket);
        this.logger.warn("websocket send failed", {
          error: error.message,
          participantId: context?.participantId,
          roomId: context?.roomId,
        });
      }
    });
  }

  private sendError(socket: WebSocket, requestId: string, code: ErrorCode, message: string): void {
    this.send(socket, {
      type: "response",
      requestId,
      ok: false,
      error: { code, message },
    });
  }

  private assertJoined(context: ClientContext): void {
    if (!context.joined) {
      throw new SignalingError("INVALID_TOKEN", "Participant is not joined");
    }
  }

  private isRateLimited(context: ClientContext): boolean {
    const now = Date.now();
    if (now - context.rateLimit.windowStartedAt >= this.config.rateLimitWindowMs) {
      context.rateLimit.windowStartedAt = now;
      context.rateLimit.messageCount = 0;
    }

    context.rateLimit.messageCount += 1;
    return context.rateLimit.messageCount > this.config.rateLimitMaxMessages;
  }

  private extractRequestId(raw: WebSocket.RawData): string {
    try {
      const parsed = JSON.parse(raw.toString()) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "requestId" in parsed &&
        typeof parsed.requestId === "string"
      ) {
        return parsed.requestId;
      }
    } catch {
      return "unknown";
    }

    return "unknown";
  }

  private checkHeartbeats(): void {
    for (const context of this.clients.values()) {
      if (context.socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (!context.isAlive) {
        this.logger.warn("websocket heartbeat timeout", {
          participantId: context.participantId,
          roomId: context.roomId,
        });
        context.socket.terminate();
        continue;
      }

      context.isAlive = false;
      context.socket.ping();
    }
  }
}
