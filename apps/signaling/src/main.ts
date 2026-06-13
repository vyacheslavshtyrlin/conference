import { createServer } from "node:http";
import { createLogger } from "@conference/logger";
import { createClient } from "redis";
import { WebSocketServer } from "ws";

import { readSignalingConfig } from "./config.js";
import { MediasoupService } from "./mediasoupService.js";
import { RedisRoomRepository } from "./redisRoomRepository.js";
import { RoomManager } from "./roomManager.js";
import { SocketGateway } from "./socketGateway.js";

const config = readSignalingConfig();
const logger = createLogger("signaling");

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection", { reason: String(reason) });
  process.exit(1);
});

const redis = createClient({ url: config.redisUrl });

redis.on("error", (error) => {
  logger.error("redis error", { error: error.message });
});

await redis.connect();

const repository = new RedisRoomRepository(redis);
const mediasoup = new MediasoupService(config.mediasoup, logger);
await mediasoup.init();
const roomManager = new RoomManager(repository, mediasoup, config.roomEmptyGraceMs, logger);

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "signaling" }));
    return;
  }

  if (pathname === "/ready") {
    const redisReady = redis.isReady;
    const mediasoupReady = mediasoup.isReady();
    const ready = redisReady && mediasoupReady;

    response.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        status: ready ? "ok" : "unavailable",
        service: "signaling",
        checks: {
          redis: redisReady ? "ok" : "unavailable",
          mediasoup: mediasoupReady ? "ok" : "unavailable",
        },
      }),
    );
    return;
  }

  response.writeHead(404);
  response.end();
});

const wsServer = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: config.websocket.maxPayloadBytes,
});
const gateway = new SocketGateway(wsServer, roomManager, config.joinTokenSecret, logger, config.websocket);

gateway.start();

server.listen(config.port, "0.0.0.0", () => {
  logger.info("signaling service started", { port: config.port });
});

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("signaling service stopping");
  gateway.stop();
  await closeWebSocketServer();
  await closeHttpServer();
  mediasoup.closeAll();
  await redis.quit();
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

function closeWebSocketServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    wsServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
