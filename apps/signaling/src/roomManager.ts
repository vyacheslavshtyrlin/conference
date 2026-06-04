import { MAX_ROOM_PARTICIPANTS } from "@conference/contracts";
import type { MediaKind, Participant, ParticipantMedia, RoomMetadata } from "@conference/contracts";
import { Mutex } from "async-mutex";

import { SignalingError } from "./errors.js";
import type { MediasoupService } from "./mediasoupService.js";
import { PeerManager } from "./peerManager.js";
import type { RedisRoomRepository } from "./redisRoomRepository.js";
import type { JoinTokenPayload } from "./token.js";

type RuntimeRoomState = {
  metadata: RoomMetadata;
  peers: PeerManager;
  cleanupTimer?: NodeJS.Timeout;
};

export class RoomManager {
  private readonly rooms = new Map<string, RuntimeRoomState>();
  private readonly roomLocks = new Map<string, Mutex>();

  constructor(
    private readonly repository: RedisRoomRepository,
    private readonly mediasoup: MediasoupService,
    private readonly emptyGraceMs: number,
  ) {}

  async join(payload: JoinTokenPayload): Promise<{ room: RoomMetadata; participant: Participant; participants: Participant[] }> {
    return this.runExclusive(payload.roomId, async () => {
      const metadata = await this.repository.getRoom(payload.roomId);
      const state = await this.ensureRuntimeRoom(metadata);

      if (!state.peers.getPeer(payload.participantId) && state.peers.count() >= MAX_ROOM_PARTICIPANTS) {
        throw new SignalingError("ROOM_FULL", "Room is full");
      }

      await this.repository.assertRoomCapacity(metadata.roomId, payload.participantId);
      const participant = state.peers.addPeer(payload);
      await this.repository.saveParticipant(metadata.roomId, participant);

      if (state.cleanupTimer) {
        clearTimeout(state.cleanupTimer);
        state.cleanupTimer = undefined;
      }

      await this.mediasoup.ensureRoom(metadata.roomId);
      return { room: metadata, participant, participants: state.peers.list() };
    });
  }

  getParticipants(roomId: string): Participant[] {
    return this.requireRuntimeRoom(roomId).peers.list();
  }

  getParticipant(roomId: string, participantId: string): Participant | undefined {
    return this.requireRuntimeRoom(roomId).peers.getPeer(participantId);
  }

  async setMedia(roomId: string, participantId: string, media: ParticipantMedia): Promise<Participant> {
    return this.runExclusive(roomId, async () => {
      const state = this.requireRuntimeRoom(roomId);
      const participant = state.peers.setMedia(participantId, media);
      if (!participant) {
        throw new SignalingError("INVALID_TOKEN", "Participant is not joined");
      }

      await this.repository.saveParticipant(roomId, participant);
      return participant;
    });
  }

  async getRouterRtpCapabilities(roomId: string) {
    return this.runExclusive(roomId, async () => this.mediasoup.getRouterRtpCapabilities(roomId));
  }

  async createTransport(roomId: string, participantId: string, direction: "send" | "recv") {
    return this.runExclusive(roomId, async () => {
      this.assertJoined(roomId, participantId);
      return this.mediasoup.createWebRtcTransport(roomId, participantId, direction);
    });
  }

  async connectTransport(roomId: string, participantId: string, transportId: string, dtlsParameters: unknown) {
    return this.runExclusive(roomId, async () => {
      this.assertJoined(roomId, participantId);
      return this.mediasoup.connectTransport(roomId, participantId, transportId, dtlsParameters);
    });
  }

  async produce(
    roomId: string,
    participantId: string,
    transportId: string,
    kind: MediaKind,
    rtpParameters: unknown,
    source: "mic" | "camera" | "screen",
    onClose: (producerId: string) => void,
  ) {
    return this.runExclusive(roomId, async () => {
      this.assertJoined(roomId, participantId);
      if ((source === "mic" && kind !== "audio") || (source !== "mic" && kind !== "video")) {
        throw new SignalingError("INVALID_PAYLOAD", "Producer kind does not match media source");
      }

      return this.mediasoup.produce(roomId, participantId, transportId, kind, rtpParameters, source, onClose);
    });
  }

  async consume(roomId: string, participantId: string, transportId: string, producerId: string, rtpCapabilities: unknown) {
    return this.runExclusive(roomId, async () => {
      this.assertJoined(roomId, participantId);
      return this.mediasoup.consume(roomId, participantId, transportId, producerId, rtpCapabilities);
    });
  }

  async closeProducer(roomId: string, participantId: string, producerId: string) {
    return this.runExclusive(roomId, async () => {
      this.assertJoined(roomId, participantId);
      return this.mediasoup.closeProducer(roomId, participantId, producerId);
    });
  }

  listProducers(roomId: string) {
    return this.mediasoup.listProducers(roomId);
  }

  async leave(roomId: string, participantId: string): Promise<Participant | undefined> {
    return this.runExclusive(roomId, async () => {
      const state = this.rooms.get(roomId);
      if (!state) {
        return undefined;
      }

      this.mediasoup.closePeer(roomId, participantId);
      const participant = state.peers.removePeer(participantId);
      await this.repository.removeParticipant(roomId, participantId);

      if (state.peers.count() === 0) {
        state.cleanupTimer = setTimeout(() => {
          void this.closeEmptyRoom(roomId);
        }, this.emptyGraceMs);
      }

      return participant;
    });
  }

  private async ensureRuntimeRoom(metadata: RoomMetadata): Promise<RuntimeRoomState> {
    const existing = this.rooms.get(metadata.roomId);
    if (existing) {
      return existing;
    }

    const state: RuntimeRoomState = {
      metadata,
      peers: new PeerManager(),
    };
    this.rooms.set(metadata.roomId, state);
    return state;
  }

  private requireRuntimeRoom(roomId: string): RuntimeRoomState {
    const state = this.rooms.get(roomId);
    if (!state) {
      throw new SignalingError("ROOM_NOT_FOUND", "Runtime room not found");
    }

    return state;
  }

  private assertJoined(roomId: string, participantId: string): void {
    if (!this.getParticipant(roomId, participantId)) {
      throw new SignalingError("INVALID_TOKEN", "Participant is not joined");
    }
  }

  private async closeEmptyRoom(roomId: string): Promise<void> {
    await this.runExclusive(roomId, async () => {
      const state = this.rooms.get(roomId);
      if (!state || state.peers.count() > 0) {
        return;
      }

      this.mediasoup.closeRoom(roomId);
      this.rooms.delete(roomId);
      await this.repository.closeRoom(state.metadata);
    });
  }

  private runExclusive<T>(roomId: string, operation: () => Promise<T>): Promise<T> {
    return this.getRoomLock(roomId).runExclusive(operation);
  }

  private getRoomLock(roomId: string): Mutex {
    const existing = this.roomLocks.get(roomId);
    if (existing) {
      return existing;
    }

    const lock = new Mutex();
    this.roomLocks.set(roomId, lock);
    return lock;
  }
}
