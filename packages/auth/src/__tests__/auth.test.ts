import { describe, it, expect } from "vitest";
import {
  createGuestSession,
  isGuestUserId,
  verifyGuestToken,
  parseBearerToken,
  isSessionExpired,
  ServerAuthVerifier,
} from "../index.js";

describe("Auth Package", () => {
  it("creates valid guest sessions", () => {
    const session = createGuestSession({ preferredUsername: "SpeedyPlayer" });
    expect(session.user.isGuest).toBe(true);
    expect(session.user.username).toBe("SpeedyPlayer");
    expect(session.user.provider).toBe("guest");
    expect(isGuestUserId(session.user.id)).toBe(true);
    expect(session.tokens.accessToken).toContain("guest_token_");
    expect(isSessionExpired(session)).toBe(false);
  });

  it("parses bearer authorization headers", () => {
    expect(parseBearerToken("Bearer abc.123.xyz")).toBe("abc.123.xyz");
    expect(parseBearerToken("bearer token456")).toBe("token456");
    expect(parseBearerToken("Basic invalid")).toBe(null);
    expect(parseBearerToken(undefined)).toBe(null);
  });

  it("verifies guest tokens on server", async () => {
    const session = createGuestSession();
    const verifier = new ServerAuthVerifier();
    const verifiedUser = await verifier.authenticateRequest(`Bearer ${session.tokens.accessToken}`);

    expect(verifiedUser).not.toBeNull();
    expect(verifiedUser?.isGuest).toBe(true);
  });

  it("rejects invalid or forged guest tokens", () => {
    expect(verifyGuestToken("guest_token_invalid")).toBe(null);
    expect(verifyGuestToken("malicious_token")).toBe(null);
  });
});
