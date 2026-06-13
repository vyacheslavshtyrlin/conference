import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { RoomMetadata } from "@conference/contracts";
import { ROOM_TTL_SECONDS } from "@conference/contracts";
import { roomNotFound } from "./room-errors.js";
import type { CreateRoomRecord } from "./room.repository.js";
import { RoomRepository } from "./room.repository.js";
import { RoomTokenService } from "./room-token.service.js";
import { RoomsService } from "./rooms.service.js";

class InMemoryRoomRepository extends RoomRepository {
  readonly rooms = new Map<string, RoomMetadata>();
  readonly slugs = new Map<string, string>();
  readonly participantCounts = new Map<string, number>();
  async createRoom(record: CreateRoomRecord): Promise<RoomMetadata> {
    const room: RoomMetadata = { ...record, status: "active" };
    this.rooms.set(room.roomId, room);
    this.slugs.set(room.slug, room.roomId);
    return room;
  }

  async getRoomBySlug(slug: string): Promise<RoomMetadata> {
    const roomId = this.slugs.get(slug);
    const room = roomId ? this.rooms.get(roomId) : undefined;

    if (!room) {
      throw roomNotFound();
    }

    return room;
  }

  async getParticipantCount(roomId: string): Promise<number> {
    return this.participantCounts.get(roomId) ?? 0;
  }

}

function createService() {
  const repository = new InMemoryRoomRepository();
  const config = new ConfigService({
    JOIN_TOKEN_SECRET: "test-secret",
    WEB_PUBLIC_URL: "http://web.test",
    SIGNALING_PUBLIC_URL: "ws://signaling.test/ws",
  });
  const tokenService = new RoomTokenService(config);

  return {
    repository,
    service: new RoomsService(repository, tokenService, config),
    tokenService,
  };
}

describe("RoomsService", () => {
  it("creates a room with a public join URL and private creator token", async () => {
    const { repository, service } = createService();

    const room = await service.createRoom();
    const stored = await repository.getRoomBySlug(room.slug);

    expect(room.joinUrl).toBe(`http://web.test/r/${room.slug}`);
    expect(room.joinUrl).not.toContain(room.creatorToken);
    expect(room.mediaNodeId).toBe("local");
    expect(room.signalingUrl).toBe("ws://signaling.test/ws");
    expect(stored.creatorTokenHash).not.toBe(room.creatorToken);
    expect(stored.mediaNodeId).toBe("local");
    expect(stored.signalingUrl).toBe("ws://signaling.test/ws");
    expect(new Date(room.expiresAt).getTime() - Date.now()).toBeGreaterThan((ROOM_TTL_SECONDS - 5) * 1000);
  });

  it("returns creator metadata only for a valid creator token", async () => {
    const { service } = createService();
    const room = await service.createRoom();

    const creatorJoin = await service.joinRoom(room.slug, "Alex", room.creatorToken);
    const guestJoin = await service.joinRoom(room.slug, "Sam");

    expect(creatorJoin.isCreator).toBe(true);
    expect(guestJoin.isCreator).toBe(false);
    expect(creatorJoin.signalingUrl).toBe("ws://signaling.test/ws");
  });

  it("returns the signaling URL assigned when the room was created", async () => {
    const { repository, service } = createService();
    const room = await service.createRoom();
    const stored = await repository.getRoomBySlug(room.slug);
    repository.rooms.set(stored.roomId, {
      ...stored,
      mediaNodeId: "media-2",
      signalingUrl: "wss://media-2.test/ws",
    });

    const join = await service.joinRoom(room.slug, "Alex", room.creatorToken);

    expect(join.signalingUrl).toBe("wss://media-2.test/ws");
  });

  it("returns live participant count in room lookup", async () => {
    const { repository, service } = createService();
    const room = await service.createRoom();
    repository.participantCounts.set(room.roomId, 3);

    await expect(service.getRoom(room.slug)).resolves.toMatchObject({
      roomId: room.roomId,
      participantCount: 3,
    });
  });

  it("issues signaling tokens accepted by the signaling token verifier", async () => {
    const { service } = createService();
    const room = await service.createRoom();

    const join = await service.joinRoom(room.slug, "Alex", room.creatorToken);
    const [, encodedPayload] = join.token.split(".");
    const payload = JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8")) as {
      roomId: string;
      participantId: string;
      displayName: string;
      isCreator: boolean;
      exp: number;
    };

    expect(payload.roomId).toBe(room.roomId);
    expect(payload.participantId).toBe(join.participantId);
    expect(payload.displayName).toBe("Alex");
    expect(payload.isCreator).toBe(true);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
