import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  CreateRoomResponse,
  GetRoomResponse,
  JoinRoomResponse,
  Participant,
  RoomMetadata,
} from "@conference/contracts";
import { randomBytes, randomUUID } from "node:crypto";
import { RoomRepository } from "./room.repository.js";
import { RoomTokenService } from "./room-token.service.js";

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

    return {
      roomId: room.roomId,
      slug: room.slug,
      expiresAt: room.expiresAt,
      status: room.status,
      mediaNodeId: room.mediaNodeId,
      signalingUrl: room.signalingUrl,
    };
  }

  async joinRoom(slug: string, displayName: string, creatorToken?: string): Promise<JoinRoomResponse> {
    const room = await this.repository.getRoomBySlug(slug);
    const participantId = `peer_${randomUUID()}`;
    const isCreator = this.tokens.isCreatorTokenValid(creatorToken, room.creatorTokenHash);
    const participant = this.createParticipant(room, participantId, displayName.trim(), isCreator);

    await this.repository.saveParticipant(room, participant);

    return {
      participantId,
      isCreator,
      token: this.tokens.createJoinToken({
        roomId: room.roomId,
        participantId,
        displayName: participant.displayName,
        isCreator,
      }),
      signalingUrl: room.signalingUrl,
    };
  }

  private createParticipant(
    _room: RoomMetadata,
    participantId: string,
    displayName: string,
    isCreator: boolean
  ): Participant {
    return {
      participantId,
      displayName,
      isCreator,
      joinedAt: new Date().toISOString(),
      connectionState: "online",
      media: {
        mic: "off",
        camera: "off",
        screen: "off",
      },
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
