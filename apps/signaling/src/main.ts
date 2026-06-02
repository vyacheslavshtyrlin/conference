import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const port = Number(process.env.PORT ?? 4000);
const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "signaling" }));
    return;
  }

  response.writeHead(404);
  response.end();
});

const wsServer = new WebSocketServer({ server, path: "/ws" });

wsServer.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "response", requestId: "health", ok: true, data: {} }));
});

server.listen(port, "0.0.0.0");
