import type {
  ErrorCode,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  ParticipantMediaChangedEvent,
  ParticipantActiveSpeakerChangedEvent,
  ProducerAddedEvent,
  ProducerClosedEvent,
  RoomSnapshotEvent,
} from "@conference/contracts";
import { serverWebSocketEventSchema } from "@conference/contracts";

type EventMap = {
  "room:snapshot": RoomSnapshotEvent;
  "participant:joined": ParticipantJoinedEvent;
  "participant:left": ParticipantLeftEvent;
  "participant:mediaChanged": ParticipantMediaChangedEvent;
  "participant:activeSpeakerChanged": ParticipantActiveSpeakerChangedEvent;
  "producer:added": ProducerAddedEvent;
  "producer:closed": ProducerClosedEvent;
  disconnect: { code: number; reason: string };
};

type AnyListener = (event: unknown) => void;

type PendingRequest = {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
};

type RequestPayload = {
  type: string;
  [key: string]: unknown;
};

export class SignalingRequestError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = "SignalingRequestError";
  }
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private reqCounter = 0;
  private readonly listeners = new Map<string, Set<AnyListener>>();

  connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = new URL(url);
      wsUrl.searchParams.set("token", token);

      const ws = new WebSocket(wsUrl.toString());
      this.ws = ws;
      let resolved = false;

      ws.onmessage = (ev) => {
        const data = ev.data as string;
        this.onMessage(data);
        // Resolve only after room:snapshot — server-side joinRoom is guaranteed complete
        if (!resolved) {
          try {
            const msg = JSON.parse(data) as { type?: string };
            if (msg.type === "room:snapshot") {
              resolved = true;
              resolve();
            }
          } catch {
            // ignore
          }
        }
      };

      ws.onclose = (ev) => {
        if (!resolved) reject(new Error("WebSocket connection failed"));
        this.rejectPending(new Error("Disconnected"));
        this.emit("disconnect", { code: ev.code, reason: ev.reason });
      };

      ws.onerror = () => {
        if (!resolved) reject(new Error("WebSocket connection error"));
      };
    });
  }

  private onMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const result = serverWebSocketEventSchema.safeParse(parsed);
    if (!result.success) return;
    const event = result.data;

    if (event.type === "response") {
      const p = this.pending.get(event.requestId);
      if (p) {
        this.pending.delete(event.requestId);
        if (event.ok) {
          p.resolve(event.data);
        } else {
          p.reject(new SignalingRequestError(event.error.message, event.error.code));
        }
      }
      return;
    }

    this.emit(event.type, event);
  }

  request<T = unknown>(payload: RequestPayload): Promise<T> {
    const requestId = `req_${++this.reqCounter}`;
    const msg = { ...payload, requestId };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket is not connected"));
    }

    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (data) => resolve(data as T),
        reject,
      });
      this.ws!.send(JSON.stringify(msg));
    });
  }

  on<K extends keyof EventMap>(type: K, listener: (event: EventMap[K]) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as AnyListener);
    return () => {
      this.listeners.get(type)?.delete(listener as AnyListener);
    };
  }

  private emit(type: string, event: unknown): void {
    this.listeners.get(type)?.forEach((l) => l(event));
  }

  private rejectPending(error: Error): void {
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }

  close(code = 1000, reason = ""): void {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close(code, reason);
    }
    this.ws = null;
  }
}
