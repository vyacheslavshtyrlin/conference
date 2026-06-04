import { Inject, Injectable } from "@nestjs/common";
import type { Participant, RoomMetadata } from "@conference/contracts";
import { REDIS_CLIENT } from "../redis/redis.constants.js";
import type { RedisClient } from "../redis/redis.types.js";
import { roomExpired, roomFull, roomNotFound } from "./room-errors.js";

const ROOM_TTL_SECONDS = 30 * 60;
const MAX_ROOM_PARTICIPANTS = 10;

// Atomically checks participant count and adds the participant in one round-trip.
// Returns 1 on success, 0 if the room is already at capacity.
const SAVE_PARTICIPANT_SCRIPT = `
local key = KEYS[1]
local max = tonumber(ARGV[1])
local count = redis.call('HLEN', key)
if count >= max then return 0 end
redis.call('HSET', key, ARGV[2], ARGV[3])
redis.call('PEXPIRE', key, tonumber(ARGV[4]))
return 1
`;

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
  abstract saveParticipant(room: RoomMetadata, participant: Participant): Promise<void>;
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

  async saveParticipant(room: RoomMetadata, participant: Participant): Promise<void> {
    const key = this.participantsKey(room.roomId);
    const ttlMs = Math.max(new Date(room.expiresAt).getTime() - Date.now(), 1);

    const result = await this.redis.eval(SAVE_PARTICIPANT_SCRIPT, {
      keys: [key],
      arguments: [
        String(MAX_ROOM_PARTICIPANTS),
        participant.participantId,
        JSON.stringify(participant),
        String(Math.floor(ttlMs)),
      ],
    });

    if (result === 0) {
      throw roomFull();
    }
  }

  private roomKey(roomId: string): string {
    return `room:${roomId}`;
  }

  private slugKey(slug: string): string {
    return `room_slug:${slug}`;
  }

  private participantsKey(roomId: string): string {
    return `room:${roomId}:participants`;
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
