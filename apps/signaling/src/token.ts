import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { SignalingError } from "./errors.js";

const joinTokenPayloadSchema = z.object({
  roomId: z.string().min(1),
  participantId: z.string().min(1),
  displayName: z.string().trim().min(1).max(80),
  isCreator: z.boolean().default(false),
  exp: z.number().int().positive().optional(),
});

export type JoinTokenPayload = z.infer<typeof joinTokenPayloadSchema>;

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function verifyJoinToken(token: string | undefined, secret: string): JoinTokenPayload {
  if (!token) {
    throw new SignalingError("INVALID_TOKEN", "Missing join token");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new SignalingError("INVALID_TOKEN", "Invalid join token format");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new SignalingError("INVALID_TOKEN", "Invalid join token format");
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new SignalingError("INVALID_TOKEN", "Invalid join token signature");
  }

  let parsed: unknown;
  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as unknown;
    const headerResult = z.object({ alg: z.literal("HS256") }).passthrough().safeParse(header);
    if (!headerResult.success) {
      throw new Error("Unsupported token algorithm");
    }

    parsed = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as unknown;
  } catch {
    throw new SignalingError("INVALID_TOKEN", "Invalid join token payload");
  }

  const payload = joinTokenPayloadSchema.safeParse(parsed);
  if (!payload.success) {
    throw new SignalingError("INVALID_TOKEN", "Invalid join token payload");
  }

  if (payload.data.exp && payload.data.exp * 1000 <= Date.now()) {
    throw new SignalingError("INVALID_TOKEN", "Join token expired");
  }

  return payload.data;
}
