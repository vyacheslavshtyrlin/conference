import { readEnv, readNumberEnv } from "@conference/config";

export type SignalingConfig = {
  port: number;
  redisUrl: string;
  joinTokenSecret: string;
  roomEmptyGraceMs: number;
  websocket: {
    heartbeatIntervalMs: number;
    maxPayloadBytes: number;
    sendBackpressureBytes: number;
    rateLimitWindowMs: number;
    rateLimitMaxMessages: number;
    allowedOrigins: string[];
  };
  mediasoup: {
    listenIp: string;
    announcedIp?: string;
    rtcMinPort: number;
    rtcMaxPort: number;
    maxTransportsPerPeer: number;
    maxProducersPerPeer: number;
    maxConsumersPerPeer: number;
  };
};

export function readSignalingConfig(): SignalingConfig {
  const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP;

  return {
    port: readNumberEnv("PORT", 4000),
    redisUrl: readEnv("REDIS_URL", "redis://localhost:6379"),
    joinTokenSecret: readEnv("JOIN_TOKEN_SECRET", "change-me-for-local-development"),
    roomEmptyGraceMs: readNumberEnv("ROOM_EMPTY_GRACE_MS", 60_000),
    websocket: {
      heartbeatIntervalMs: readPositiveNumberEnv("WS_HEARTBEAT_INTERVAL_MS", 30_000),
      maxPayloadBytes: readPositiveNumberEnv("WS_MAX_PAYLOAD_BYTES", 64 * 1024),
      sendBackpressureBytes: readPositiveNumberEnv("WS_SEND_BACKPRESSURE_BYTES", 256 * 1024),
      rateLimitWindowMs: readPositiveNumberEnv("WS_RATE_LIMIT_WINDOW_MS", 10_000),
      rateLimitMaxMessages: readPositiveNumberEnv("WS_RATE_LIMIT_MAX_MESSAGES", 60),
      allowedOrigins: readCsvEnv("WS_ALLOWED_ORIGINS", "http://localhost:5173"),
    },
    mediasoup: {
      listenIp: readEnv("MEDIASOUP_LISTEN_IP", "0.0.0.0"),
      announcedIp: announcedIp && announcedIp.length > 0 ? announcedIp : undefined,
      rtcMinPort: readNumberEnv("MEDIASOUP_RTC_MIN_PORT", 40000),
      rtcMaxPort: readNumberEnv("MEDIASOUP_RTC_MAX_PORT", 40100),
      maxTransportsPerPeer: readPositiveNumberEnv("MEDIASOUP_MAX_TRANSPORTS_PER_PEER", 4),
      maxProducersPerPeer: readPositiveNumberEnv("MEDIASOUP_MAX_PRODUCERS_PER_PEER", 3),
      maxConsumersPerPeer: readPositiveNumberEnv("MEDIASOUP_MAX_CONSUMERS_PER_PEER", 32),
    },
  };
}

function readPositiveNumberEnv(name: string, fallback: number): number {
  const value = readNumberEnv(name, fallback);
  if (value <= 0) {
    throw new Error(`Environment variable ${name} must be greater than 0`);
  }

  return value;
}

function readCsvEnv(name: string, fallback: string): string[] {
  return readEnv(name, fallback)
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
