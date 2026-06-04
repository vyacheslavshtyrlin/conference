import "reflect-metadata";

import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Participant, RoomMetadata } from "@conference/contracts";
import { roomFull, roomNotFound } from "./room-errors.js";
import type { CreateRoomRecord } from "./room.repository.js";
import { RoomRepository } from "./room.repository.js";
import { RoomTokenService } from "./room-token.service.js";
import { RoomsController } from "./rooms.controller.js";
import { RoomsService } from "./rooms.service.js";

class InMemoryRoomRepository extends RoomRepository {
  readonly rooms = new Map<string, RoomMetadata>();
  readonly slugs = new Map<string, string>();
  readonly participants = new Map<string, Participant[]>();

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

  async saveParticipant(room: RoomMetadata, participant: Participant): Promise<void> {
    const participants = this.participants.get(room.roomId) ?? [];
    if (participants.length >= 10) {
      throw roomFull();
    }

    participants.push(participant);
    this.participants.set(room.roomId, participants);
  }
}

describe("RoomsController", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        RoomsService,
        RoomTokenService,
        {
          provide: RoomRepository,
          useClass: InMemoryRoomRepository,
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JOIN_TOKEN_SECRET: "test-secret",
            WEB_PUBLIC_URL: "http://web.test",
            SIGNALING_PUBLIC_URL: "ws://signaling.test/ws",
          }),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      })
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("supports create, lookup and creator/guest join HTTP flow", async () => {
    const createResponse = await request(app.getHttpServer()).post("/api/v1/rooms").send({}).expect(201);

    expect(createResponse.body).toMatchObject({
      roomId: expect.stringMatching(/^room_/),
      slug: expect.any(String),
      creatorToken: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(createResponse.body.joinUrl).toBe(`http://web.test/r/${createResponse.body.slug}`);
    expect(createResponse.body.joinUrl).not.toContain(createResponse.body.creatorToken);
    expect(createResponse.body.mediaNodeId).toBe("local");
    expect(createResponse.body.signalingUrl).toBe("ws://signaling.test/ws");

    await request(app.getHttpServer())
      .get(`/api/v1/rooms/${createResponse.body.slug}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          roomId: createResponse.body.roomId,
          slug: createResponse.body.slug,
          status: "active",
          mediaNodeId: "local",
          signalingUrl: "ws://signaling.test/ws",
        });
      });

    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${createResponse.body.slug}/join`)
      .send({ displayName: "Alex", creatorToken: createResponse.body.creatorToken })
      .expect(201)
      .expect(({ body }) => {
        expect(body.isCreator).toBe(true);
        expect(body.signalingUrl).toBe("ws://signaling.test/ws");
        expect(body.token).toEqual(expect.any(String));
      });

    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${createResponse.body.slug}/join`)
      .send({ displayName: "Sam" })
      .expect(201)
      .expect(({ body }) => {
        expect(body.isCreator).toBe(false);
      });
  });

  it("rejects invalid join DTO payloads", async () => {
    const createResponse = await request(app.getHttpServer()).post("/api/v1/rooms").send({}).expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${createResponse.body.slug}/join`)
      .send({ displayName: "" })
      .expect(400);
  });
});
