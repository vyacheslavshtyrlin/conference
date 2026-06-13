import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  CreateRoomResponse,
  GetRoomResponse,
  JoinRoomResponse,
} from "@conference/contracts";
import { MAX_ROOM_PARTICIPANTS } from "@conference/contracts";
import { randomBytes, randomUUID } from "node:crypto";
import { RoomRepository } from "./room.repository.js";
import { RoomTokenService } from "./room-token.service.js";
import { roomFull } from "./room-errors.js";

@Injectable()
export class RoomsService {
  constructor(
    @Inject(RoomRepository) private readonly repository: RoomRepository,
    @Inject(RoomTokenService) private readonly tokens: RoomTokenService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  async createRoom(): Promise<CreateRoomResponse> {
    const roomId = `room_${randomUUID()}`;
    const slug = this.createSlug();
    const creatorToken = this.tokens.createCreatorToken();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
    const mediaNode = this.selectMediaNode();

    const room = await this.repository.createRoom({
      roomId,
      slug,
      mediaNodeId: mediaNode.mediaNodeId,
      signalingUrl: mediaNode.signalingUrl,
      creatorTokenHash: this.tokens.hashCreatorToken(creatorToken),
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    return {
      roomId: room.roomId,
      slug: room.slug,
      joinUrl: `${this.webPublicUrl()}/r/${room.slug}`,
      creatorToken,
      mediaNodeId: room.mediaNodeId,
      signalingUrl: room.signalingUrl,
      expiresAt: room.expiresAt,
    };
  }

  async getRoom(slug: string): Promise<GetRoomResponse> {
    const room = await this.repository.getRoomBySlug(slug);
    const participantCount = await this.repository.getParticipantCount(room.roomId);

    return {
      roomId: room.roomId,
      slug: room.slug,
      expiresAt: room.expiresAt,
      status: room.status,
      mediaNodeId: room.mediaNodeId,
      signalingUrl: room.signalingUrl,
      participantCount,
    };
  }

  async joinRoom(slug: string, displayName: string, creatorToken?: string): Promise<JoinRoomResponse> {
    const room = await this.repository.getRoomBySlug(slug);

    const count = await this.repository.getParticipantCount(room.roomId);
    if (count >= MAX_ROOM_PARTICIPANTS) {
      throw roomFull();
    }

    const participantId = `peer_${randomUUID()}`;
    const isCreator = this.tokens.isCreatorTokenValid(creatorToken, room.creatorTokenHash);

    return {
      participantId,
      isCreator,
      token: this.tokens.createJoinToken({
        roomId: room.roomId,
        participantId,
        displayName: displayName.trim(),
        isCreator,
      }),
      signalingUrl: room.signalingUrl,
    };
  }

  private createSlug(): string {
    return randomBytes(5).toString("base64url").toLowerCase().replace(/_/g, "-").slice(0, 7);
  }

  private webPublicUrl(): string {
    return (this.config.get<string>("WEB_PUBLIC_URL") ?? "http://localhost:5173").replace(/\/$/, "");
  }

  private signalingPublicUrl(): string {
    return this.config.get<string>("SIGNALING_PUBLIC_URL") ?? "ws://localhost:4000/ws";
  }

  private selectMediaNode(): { mediaNodeId: string; signalingUrl: string } {
    return {
      mediaNodeId: this.config.get<string>("MEDIA_NODE_ID") ?? "local",
      signalingUrl: this.signalingPublicUrl(),
    };
  }
}
