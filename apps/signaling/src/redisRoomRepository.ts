import { MAX_ROOM_PARTICIPANTS, participantSchema, roomMetadataSchema } from "@conference/contracts";
import type { Participant, RoomMetadata } from "@conference/contracts";

import { SignalingError } from "./errors.js";

export type RedisClient = {
  get(key: string): Promise<string | null>;
  hExists(key: string, field: string): Promise<boolean | number>;
  hLen(key: string): Promise<number>;
  hSet(key: string, field: string, value: string): Promise<number>;
  hDel(key: string, field: string): Promise<number>;
  pExpire(key: string, milliseconds: number): Promise<boolean | number>;
  del(keys: string | string[]): Promise<number>;
};

export class RedisRoomRepository {
  constructor(private readonly redis: RedisClient) {}

  async getRoom(roomId: string): Promise<RoomMetadata> {
    const raw = await this.redis.get(`room:${roomId}`);
    if (!raw) {
      throw new SignalingError("ROOM_NOT_FOUND", "Room not found");
    }

    const parsed = roomMetadataSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) {
      throw new SignalingError("ROOM_NOT_FOUND", "Room metadata is invalid");
    }

    if (new Date(parsed.data.expiresAt).getTime() <= Date.now()) {
      throw new SignalingError("ROOM_EXPIRED", "Room expired");
    }

    return parsed.data;
  }

  async assertRoomCapacity(roomId: string, participantId: string): Promise<void> {
    const participantsKey = this.participantsKey(roomId);
    const exists = await this.redis.hExists(participantsKey, participantId);
    if (exists) {
      return;
    }

    const count = await this.redis.hLen(participantsKey);
    if (count >= MAX_ROOM_PARTICIPANTS) {
      throw new SignalingError("ROOM_FULL", "Room is full");
    }
  }

  async saveParticipant(roomId: string, expiresAt: string, participant: Participant): Promise<void> {
    const ttlMs = Math.max(new Date(expiresAt).getTime() - Date.now(), 1);
    const key = this.participantsKey(roomId);

    await this.redis.hSet(key, participant.participantId, JSON.stringify(participantSchema.parse(participant)));
    await this.redis.pExpire(key, ttlMs);
  }

  async removeParticipant(roomId: string, participantId: string): Promise<void> {
    await this.redis.hDel(this.participantsKey(roomId), participantId);
  }

  async closeRoom(room: RoomMetadata): Promise<void> {
    await this.redis.del([`room:${room.roomId}`, `room_slug:${room.slug}`, this.participantsKey(room.roomId)]);
  }

  private participantsKey(roomId: string): string {
    return `room:${roomId}:participants`;
  }
}
