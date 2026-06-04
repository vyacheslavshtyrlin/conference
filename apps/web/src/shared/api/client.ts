import {
  createRoomResponseSchema,
  getRoomResponseSchema,
  joinRoomResponseSchema,
  type CreateRoomResponse,
  type GetRoomResponse,
  type JoinRoomRequest,
  type JoinRoomResponse,
} from "@conference/contracts";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1").replace(
  /\/$/,
  ""
);

type JsonBody = Record<string, unknown>;

async function request<T>(path: string, options: RequestInit, parse: (value: unknown) => T): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
        ? body.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parse(body);
}

export function createRoom(): Promise<CreateRoomResponse> {
  return request(
    "/rooms",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    (value) => createRoomResponseSchema.parse(value)
  );
}

export function getRoom(slug: string): Promise<GetRoomResponse> {
  return request(`/rooms/${encodeURIComponent(slug)}`, { method: "GET" }, (value) =>
    getRoomResponseSchema.parse(value)
  );
}

export function joinRoom(slug: string, payload: JoinRoomRequest): Promise<JoinRoomResponse> {
  const body: JsonBody = payload.creatorToken
    ? { displayName: payload.displayName, creatorToken: payload.creatorToken }
    : { displayName: payload.displayName };

  return request(
    `/rooms/${encodeURIComponent(slug)}/join`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    (value) => joinRoomResponseSchema.parse(value)
  );
}
