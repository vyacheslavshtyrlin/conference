import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type JoinTokenPayload = {
  roomId: string;
  participantId: string;
  displayName: string;
  isCreator: boolean;
  exp: number;
};

@Injectable()
export class RoomTokenService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  createCreatorToken(): string {
    return randomBytes(32).toString("base64url");
  }

  hashCreatorToken(token: string): string {
    return createHmac("sha256", this.creatorTokenSecret()).update(token).digest("base64url");
  }

  isCreatorTokenValid(token: string | undefined, expectedHash: string): boolean {
    if (!token) {
      return false;
    }

    const actualHash = this.hashCreatorToken(token);
    const actual = Buffer.from(actualHash);
    const expected = Buffer.from(expectedHash);

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  createJoinToken(payload: Omit<JoinTokenPayload, "exp">): string {
    const exp = Math.floor(Date.now() / 1000) + this.joinTokenTtlSeconds();
    const encodedHeader = this.base64UrlJson({ alg: "HS256", typ: "JWT" });
    const encodedPayload = this.base64UrlJson({ ...payload, exp });
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`, this.joinTokenSecret());

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private base64UrlJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  }

  private sign(input: string, secret: string): string {
    return createHmac("sha256", secret).update(input).digest("base64url");
  }

  private creatorTokenSecret(): string {
    return this.config.get<string>("CREATOR_TOKEN_SECRET") ?? this.joinTokenSecret();
  }

  private joinTokenSecret(): string {
    return this.config.get<string>("JOIN_TOKEN_SECRET") ?? "change-me-for-local-development";
  }

  private joinTokenTtlSeconds(): number {
    const raw = Number(this.config.get<string>("JOIN_TOKEN_TTL_SECONDS") ?? 300);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 300;
  }
}
