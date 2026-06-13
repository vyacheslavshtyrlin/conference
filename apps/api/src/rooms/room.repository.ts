import { Inject, Injectable } from "@nestjs/common";
import type { RoomMetadata } from "@conference/contracts";
import { REDIS_CLIENT } from "../redis/redis.constants.js";
import type { RedisClient } from "../redis/redis.types.js";
import { roomExpired, roomNotFound } from "./room-errors.js";

const ROOM_TTL_SECONDS = 30 * 60;

export type CreateRoomRecord = {
  roomId: string;
  slug: string;
  mediaNodeId: string;
  signalingUrl: string;
  creatorTokenHash: string;
  createdAt: string;
  expiresAt: string;
};

export abstract class RoomRepository {
  abstract createRoom(record: CreateRoomRecord): Promise<RoomMetadata>;
  abstract getRoomBySlug(slug: string): Promise<RoomMetadata>;
  abstract getParticipantCount(roomId: string): Promise<number>;
}

@Injectable()
export class RedisRoomRepository extends RoomRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {
    super();
  }

  async createRoom(record: CreateRoomRecord): Promise<RoomMetadata> {
    const room = parseRoomMetadata({
      ...record,
      status: "active",
    });
    if (!room) {
      throw roomNotFound();
    }

    await this.redis.setEx(this.roomKey(room.roomId), ROOM_TTL_SECONDS, JSON.stringify(room));
    await this.redis.setEx(this.slugKey(room.slug), ROOM_TTL_SECONDS, room.roomId);

    return room;
  }

  async getRoomBySlug(slug: string): Promise<RoomMetadata> {
    const roomId = await this.redis.get(this.slugKey(slug));
    if (!roomId) {
      throw roomNotFound();
    }

    const raw = await this.redis.get(this.roomKey(roomId));
    if (!raw) {
      throw roomNotFound();
    }

    let roomJson: unknown;
    try {
      roomJson = JSON.parse(raw) as unknown;
    } catch {
      throw roomNotFound();
    }

    const room = parseRoomMetadata(roomJson);
    if (!room) {
      throw roomNotFound();
    }

    if (new Date(room.expiresAt).getTime() <= Date.now()) {
      throw roomExpired();
    }

    return room;
  }

  async getParticipantCount(roomId: string): Promise<number> {
    return this.redis.hLen(`room:${roomId}:participants`);
  }

  private roomKey(roomId: string): string {
    return `room:${roomId}`;
  }

  private slugKey(slug: string): string {
    return `room_slug:${slug}`;
  }

}

function parseRoomMetadata(value: unknown): RoomMetadata | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const room = {
    roomId: value.roomId,
    slug: value.slug,
    mediaNodeId: value.mediaNodeId,
    signalingUrl: value.signalingUrl,
    creatorTokenHash: value.creatorTokenHash,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    status: value.status,
  };

  if (
    typeof room.roomId !== "string" ||
    room.roomId.length === 0 ||
    typeof room.slug !== "string" ||
    room.slug.length === 0 ||
    typeof room.mediaNodeId !== "string" ||
    room.mediaNodeId.length === 0 ||
    typeof room.signalingUrl !== "string" ||
    !isUrl(room.signalingUrl) ||
    typeof room.creatorTokenHash !== "string" ||
    room.creatorTokenHash.length === 0 ||
    typeof room.createdAt !== "string" ||
    Number.isNaN(Date.parse(room.createdAt)) ||
    typeof room.expiresAt !== "string" ||
    Number.isNaN(Date.parse(room.expiresAt)) ||
    room.status !== "active"
  ) {
    return undefined;
  }

  return room as RoomMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
