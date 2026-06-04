import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignalingError } from "./errors.js";
import { MediasoupService } from "./mediasoupService.js";

const { createWorker } = vi.hoisted(() => ({
  createWorker: vi.fn(),
}));

vi.mock("mediasoup", () => ({
  createWorker,
}));

type FakeProducer = {
  id: string;
  kind: "audio" | "video";
  observer: EventEmitter;
  close: () => void;
};

type FakeConsumer = {
  id: string;
  kind: "audio" | "video";
  rtpParameters: Record<string, unknown>;
  observer: EventEmitter;
  close: () => void;
};

let transportCounter = 0;
let producerCounter = 0;
let consumerCounter = 0;

function createFakeWorker() {
  const worker = new EventEmitter() as EventEmitter & {
    observer: EventEmitter;
    close: () => void;
    createRouter: () => Promise<ReturnType<typeof createFakeRouter>>;
  };
  worker.observer = new EventEmitter();
  worker.close = () => {
    worker.observer.emit("close");
  };
  worker.createRouter = async () => createFakeRouter();
  return worker;
}

function createFakeRouter() {
  return {
    rtpCapabilities: {},
    canConsume: () => true,
    createWebRtcTransport: async () => createFakeTransport(),
  };
}

function createFakeTransport() {
  const id = `transport_${++transportCounter}`;
  return {
    id,
    iceParameters: {},
    iceCandidates: [],
    dtlsParameters: {},
    observer: new EventEmitter(),
    closed: false,
    connect: async () => {},
    produce: async ({ kind }: { kind: "audio" | "video" }) => createFakeProducer(kind),
    consume: async ({ producerId }: { producerId: string }) => createFakeConsumer(producerId),
    close() {
      this.closed = true;
      this.observer.emit("close");
    },
  };
}

function createFakeProducer(kind: "audio" | "video"): FakeProducer {
  const producer: FakeProducer = {
    id: `producer_${++producerCounter}`,
    kind,
    observer: new EventEmitter(),
    close: () => {
      producer.observer.emit("close");
    },
  };
  return producer;
}

function createFakeConsumer(_producerId: string): FakeConsumer {
  const consumer: FakeConsumer = {
    id: `consumer_${++consumerCounter}`,
    kind: "video",
    rtpParameters: {},
    observer: new EventEmitter(),
    close: () => {
      consumer.observer.emit("close");
    },
  };
  return consumer;
}

function createService(overrides: Partial<ConstructorParameters<typeof MediasoupService>[0]> = {}) {
  return new MediasoupService({
    listenIp: "127.0.0.1",
    rtcMinPort: 40000,
    rtcMaxPort: 40100,
    maxTransportsPerPeer: 4,
    maxProducersPerPeer: 3,
    maxConsumersPerPeer: 32,
    ...overrides,
  });
}

describe("MediasoupService", () => {
  beforeEach(() => {
    transportCounter = 0;
    producerCounter = 0;
    consumerCounter = 0;
    createWorker.mockResolvedValue(createFakeWorker());
  });

  it("closes consumers for a producer when the producer owner leaves", async () => {
    const service = createService();
    const sendTransport = await service.createWebRtcTransport("room_1", "peer_1", "send");
    const recvTransport = await service.createWebRtcTransport("room_1", "peer_2", "recv");
    const producer = await service.produce("room_1", "peer_1", sendTransport.id, "video", {}, "camera", () => {});

    await service.consume("room_1", "peer_2", recvTransport.id, producer.id, {});

    expect(service.getRuntimeStats()).toMatchObject({ producers: 1, consumers: 1 });

    service.closePeer("room_1", "peer_1");

    expect(service.getRuntimeStats()).toMatchObject({ producers: 0, consumers: 0 });
  });

  it("enforces per-peer producer limits", async () => {
    const service = createService({ maxProducersPerPeer: 1 });
    const sendTransport = await service.createWebRtcTransport("room_1", "peer_1", "send");

    await service.produce("room_1", "peer_1", sendTransport.id, "audio", {}, "mic", () => {});

    await expect(
      service.produce("room_1", "peer_1", sendTransport.id, "video", {}, "camera", () => {}),
    ).rejects.toMatchObject(new SignalingError("MEDIASOUP_ERROR", "Peer producer limit reached"));
  });

  it("allows only one active screen share producer per room", async () => {
    const service = createService();
    const firstTransport = await service.createWebRtcTransport("room_1", "peer_1", "send");
    const secondTransport = await service.createWebRtcTransport("room_1", "peer_2", "send");

    await service.produce("room_1", "peer_1", firstTransport.id, "video", {}, "screen", () => {});

    await expect(
      service.produce("room_1", "peer_2", secondTransport.id, "video", {}, "screen", () => {}),
    ).rejects.toMatchObject(new SignalingError("MEDIASOUP_ERROR", "Room already has an active screen share"));

    service.closePeer("room_1", "peer_1");

    await expect(
      service.produce("room_1", "peer_2", secondTransport.id, "video", {}, "screen", () => {}),
    ).resolves.toMatchObject({ id: expect.stringMatching(/^producer_/) });
  });

  it("releases the screen share slot when the active producer is closed", async () => {
    const service = createService();
    const firstTransport = await service.createWebRtcTransport("room_1", "peer_1", "send");
    const secondTransport = await service.createWebRtcTransport("room_1", "peer_2", "send");
    const firstProducer = await service.produce("room_1", "peer_1", firstTransport.id, "video", {}, "screen", () => {});

    await service.closeProducer("room_1", "peer_1", firstProducer.id);

    await expect(
      service.produce("room_1", "peer_2", secondTransport.id, "video", {}, "screen", () => {}),
    ).resolves.toMatchObject({ id: expect.stringMatching(/^producer_/) });
  });
});
