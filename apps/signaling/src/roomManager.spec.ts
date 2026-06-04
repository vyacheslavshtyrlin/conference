import type { Participant, RoomMetadata } from "@conference/contracts";
import { describe, expect, it } from "vitest";

import type { MediasoupService } from "./mediasoupService.js";
import type { RedisRoomRepository } from "./redisRoomRepository.js";
import { RoomManager } from "./roomManager.js";
import type { JoinTokenPayload } from "./token.js";

const room: RoomMetadata = {
  roomId: "room_1",
  slug: "room-one",
  mediaNodeId: "local",
  signalingUrl: "ws://localhost:4000/ws",
  creatorTokenHash: "creator-token-hash",
  createdAt: new Date(Date.now() - 1_000).toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  status: "active",
};

class FakeRepository {
  activeGetRoomCalls = 0;
  maxConcurrentGetRoomCalls = 0;
  readonly participants = new Map<string, Participant>();

  async getRoom(): Promise<RoomMetadata> {
    this.activeGetRoomCalls += 1;
    this.maxConcurrentGetRoomCalls = Math.max(this.maxConcurrentGetRoomCalls, this.activeGetRoomCalls);
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.activeGetRoomCalls -= 1;
    return room;
  }

  async assertRoomCapacity(): Promise<void> {}

  async saveParticipant(_roomId: string, participant: Participant): Promise<void> {
    this.participants.set(participant.participantId, participant);
  }

  async removeParticipant(_roomId: string, participantId: string): Promise<void> {
    this.participants.delete(participantId);
  }

  async closeRoom(): Promise<void> {}
}

class FakeMediasoupService {
  ensureRoomCalls = 0;

  async ensureRoom(): Promise<void> {
    this.ensureRoomCalls += 1;
  }
}

function createPayload(participantId: string): JoinTokenPayload {
  return {
    roomId: room.roomId,
    participantId,
    displayName: participantId,
    isCreator: false,
  };
}

describe("RoomManager", () => {
  it("serializes concurrent room joins for one room", async () => {
    const repository = new FakeRepository();
    const mediasoup = new FakeMediasoupService();
    const manager = new RoomManager(
      repository as unknown as RedisRoomRepository,
      mediasoup as unknown as MediasoupService,
      60_000,
    );

    await Promise.all([
      manager.join(createPayload("peer_1")),
      manager.join(createPayload("peer_2")),
      manager.join(createPayload("peer_3")),
    ]);

    expect(repository.maxConcurrentGetRoomCalls).toBe(1);
    expect(repository.participants.size).toBe(3);
    expect(mediasoup.ensureRoomCalls).toBe(3);
  });
});
