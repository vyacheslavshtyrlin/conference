import * as mediasoup from "mediasoup";
import type { Logger } from "@conference/logger";
import type {
  Consumer,
  DtlsParameters,
  MediaKind,
  Producer,
  RtpCapabilities,
  RtpParameters,
  Router,
  Transport,
  WebRtcTransport,
  Worker,
} from "mediasoup/types";

import type { SignalingConfig } from "./config.js";
import { SignalingError } from "./errors.js";

type TransportRecord = {
  transport: WebRtcTransport;
  participantId: string;
  direction: "send" | "recv";
};

type ProducerRecord = {
  producer: Producer;
  participantId: string;
  source: "mic" | "camera" | "screen";
};

type ConsumerRecord = {
  consumer: Consumer;
  participantId: string;
  producerId: string;
};

type RuntimeRoom = {
  worker: Worker;
  router: Router;
  transports: Map<string, TransportRecord>;
  producers: Map<string, ProducerRecord>;
  consumers: Map<string, ConsumerRecord>;
};

const mediaCodecs = [
  {
    kind: "audio" as const,
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video" as const,
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
];

export class MediasoupService {
  private readonly rooms = new Map<string, RuntimeRoom>();

  constructor(
    private readonly config: SignalingConfig["mediasoup"],
    private readonly logger?: Logger,
  ) {}

  async ensureRoom(roomId: string): Promise<RuntimeRoom> {
    const existing = this.rooms.get(roomId);
    if (existing) {
      return existing;
    }

    const worker = await mediasoup.createWorker({
      rtcMinPort: this.config.rtcMinPort,
      rtcMaxPort: this.config.rtcMaxPort,
    });
    const router = await worker.createRouter({ mediaCodecs });
    const room: RuntimeRoom = {
      worker,
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    worker.observer.once("close", () => {
      this.rooms.delete(roomId);
    });
    worker.on("died", () => {
      this.logger?.error("mediasoup worker died", { roomId });
      this.closeDeadRoom(roomId);
    });

    this.rooms.set(roomId, room);
    return room;
  }

  async getRouterRtpCapabilities(
    roomId: string,
  ): Promise<Router["rtpCapabilities"]> {
    return (await this.ensureRoom(roomId)).router.rtpCapabilities;
  }

  async createWebRtcTransport(
    roomId: string,
    participantId: string,
    direction: "send" | "recv",
  ): Promise<{
    id: string;
    iceParameters: WebRtcTransport["iceParameters"];
    iceCandidates: WebRtcTransport["iceCandidates"];
    dtlsParameters: WebRtcTransport["dtlsParameters"];
  }> {
    const room = await this.ensureRoom(roomId);
    this.assertPeerLimit(
      room.transports,
      participantId,
      this.config.maxTransportsPerPeer,
      "Peer transport limit reached",
    );

    const transport = await room.router.createWebRtcTransport({
      listenIps: [
        {
          ip: this.config.listenIp,
          announcedIp: this.config.announcedIp,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferTcp: true,
      initialAvailableOutgoingBitrate: 1_000_000,
    });

    room.transports.set(transport.id, { transport, participantId, direction });
    transport.observer.once("close", () => {
      room.transports.delete(transport.id);
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(
    roomId: string,
    participantId: string,
    transportId: string,
    dtlsParameters: unknown,
  ) {
    const record = await this.getTransport(roomId, participantId, transportId);
    await record.transport.connect({
      dtlsParameters: dtlsParameters as DtlsParameters,
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
  ): Promise<{ id: string }> {
    const record = await this.getTransport(roomId, participantId, transportId);
    if (record.direction !== "send") {
      throw new SignalingError(
        "TRANSPORT_NOT_FOUND",
        "Send transport not found",
      );
    }
    const room = await this.ensureRoom(roomId);
    this.assertPeerLimit(
      room.producers,
      participantId,
      this.config.maxProducersPerPeer,
      "Peer producer limit reached",
    );
    if (this.hasProducerForSource(room, participantId, source)) {
      throw new SignalingError(
        "MEDIASOUP_ERROR",
        "Peer already has an active producer for this source",
      );
    }
    if (source === "screen" && this.hasActiveScreenProducer(room)) {
      throw new SignalingError(
        "MEDIASOUP_ERROR",
        "Room already has an active screen share",
      );
    }

    const producer = await record.transport.produce({
      kind,
      rtpParameters: rtpParameters as RtpParameters,
      appData: { participantId, source },
    });
    room.producers.set(producer.id, { producer, participantId, source });

    producer.observer.once("close", () => {
      room.producers.delete(producer.id);
      this.closeConsumersForProducer(room, producer.id);
      onClose(producer.id);
    });

    return { id: producer.id };
  }

  async consume(
    roomId: string,
    participantId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: unknown,
  ): Promise<{
    id: string;
    producerId: string;
    kind: MediaKind;
    rtpParameters: RtpParameters;
    participantId: string;
    source: "mic" | "camera" | "screen";
  }> {
    const room = await this.ensureRoom(roomId);
    const transportRecord = await this.getTransport(
      roomId,
      participantId,
      transportId,
    );
    if (transportRecord.direction !== "recv") {
      throw new SignalingError(
        "TRANSPORT_NOT_FOUND",
        "Receive transport not found",
      );
    }
    this.assertPeerLimit(
      room.consumers,
      participantId,
      this.config.maxConsumersPerPeer,
      "Peer consumer limit reached",
    );

    const producerRecord = room.producers.get(producerId);
    if (!producerRecord) {
      throw new SignalingError("PRODUCER_NOT_FOUND", "Producer not found");
    }

    if (
      !room.router.canConsume({
        producerId,
        rtpCapabilities: rtpCapabilities as RtpCapabilities,
      })
    ) {
      throw new SignalingError(
        "MEDIASOUP_ERROR",
        "Client cannot consume producer",
      );
    }

    const consumer = await transportRecord.transport.consume({
      producerId,
      rtpCapabilities: rtpCapabilities as RtpCapabilities,
      paused: false,
    });
    room.consumers.set(consumer.id, { consumer, participantId, producerId });
    consumer.observer.once("close", () => {
      room.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      participantId: producerRecord.participantId,
      source: producerRecord.source,
    };
  }

  async closeProducer(
    roomId: string,
    participantId: string,
    producerId: string,
  ): Promise<{ producerId: string; source: "mic" | "camera" | "screen" }> {
    const room = await this.ensureRoom(roomId);
    const record = room.producers.get(producerId);
    if (!record || record.participantId !== participantId) {
      throw new SignalingError("PRODUCER_NOT_FOUND", "Producer not found");
    }

    const { source } = record;
    record.producer.close();
    return { producerId, source };
  }

  listProducers(roomId: string): Array<{
    producerId: string;
    participantId: string;
    kind: MediaKind;
    source: "mic" | "camera" | "screen";
  }> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }

    return Array.from(room.producers.values()).map((record) => ({
      producerId: record.producer.id,
      participantId: record.participantId,
      kind: record.producer.kind,
      source: record.source,
    }));
  }

  closePeer(roomId: string, participantId: string): string[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }

    const closedProducerIds: string[] = [];
    for (const record of Array.from(room.consumers.values())) {
      if (record.participantId === participantId) {
        record.consumer.close();
      }
    }

    for (const record of Array.from(room.producers.values())) {
      if (record.participantId === participantId) {
        closedProducerIds.push(record.producer.id);
        record.producer.close();
      }
    }

    for (const record of Array.from(room.transports.values())) {
      if (record.participantId === participantId) {
        record.transport.close();
      }
    }

    return closedProducerIds;
  }

  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    room.worker.close();
    this.rooms.delete(roomId);
  }

  getRuntimeStats(): {
    rooms: number;
    transports: number;
    producers: number;
    consumers: number;
  } {
    let transports = 0;
    let producers = 0;
    let consumers = 0;

    for (const room of this.rooms.values()) {
      transports += room.transports.size;
      producers += room.producers.size;
      consumers += room.consumers.size;
    }

    return {
      rooms: this.rooms.size,
      transports,
      producers,
      consumers,
    };
  }

  isReady(): boolean {
    return true;
  }

  private async getTransport(
    roomId: string,
    participantId: string,
    transportId: string,
  ): Promise<TransportRecord> {
    const room = await this.ensureRoom(roomId);
    const record = room.transports.get(transportId);
    if (
      !record ||
      record.participantId !== participantId ||
      (record.transport as Transport).closed
    ) {
      throw new SignalingError("TRANSPORT_NOT_FOUND", "Transport not found");
    }

    return record;
  }

  private assertPeerLimit<T extends { participantId: string }>(
    records: Map<string, T>,
    participantId: string,
    max: number,
    message: string,
  ): void {
    let count = 0;
    for (const record of records.values()) {
      if (record.participantId === participantId) {
        count += 1;
      }
    }

    if (count >= max) {
      throw new SignalingError("MEDIASOUP_ERROR", message);
    }
  }

  private hasProducerForSource(
    room: RuntimeRoom,
    participantId: string,
    source: "mic" | "camera" | "screen",
  ): boolean {
    for (const record of room.producers.values()) {
      if (record.participantId === participantId && record.source === source) {
        return true;
      }
    }

    return false;
  }

  private hasActiveScreenProducer(room: RuntimeRoom): boolean {
    for (const record of room.producers.values()) {
      if (record.source === "screen") {
        return true;
      }
    }

    return false;
  }

  private closeConsumersForProducer(
    room: RuntimeRoom,
    producerId: string,
  ): void {
    for (const record of Array.from(room.consumers.values())) {
      if (record.producerId === producerId) {
        record.consumer.close();
      }
    }
  }

  private closeDeadRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    room.transports.clear();
    room.producers.clear();
    room.consumers.clear();
    this.rooms.delete(roomId);
  }
}
