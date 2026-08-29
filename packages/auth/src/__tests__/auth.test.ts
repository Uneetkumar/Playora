import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { parseBearerToken, isSessionExpired, ServerAuthVerifier } from "../index.js";

const SECRET = "test-jwt-secret-that-is-long-enough-for-hs256";
const ISSUER = "https://testproject.supabase.co/auth/v1";

async function bearer(sub: string, secret = SECRET) {
  const token = await new SignJWT({ sub, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  return `Bearer ${token}`;
}

const verifier = () =>
  new ServerAuthVerifier({ jwtSecret: SECRET, expectedIssuer: ISSUER });

describe("parseBearerToken", () => {
  it("extracts the token regardless of scheme casing", () => {
    expect(parseBearerToken("Bearer abc.123.xyz")).toBe("abc.123.xyz");
    expect(parseBearerToken("bearer token456")).toBe("token456");
  });

  it("returns null for anything that is not a bearer header", () => {
    expect(parseBearerToken("Basic invalid")).toBe(null);
    expect(parseBearerToken(undefined)).toBe(null);
    expect(parseBearerToken(null)).toBe(null);
    expect(parseBearerToken("")).toBe(null);
    expect(parseBearerToken("Bearer")).toBe(null);
  });
});

describe("isSessionExpired", () => {
  const session = (expiresAt: number) => ({
    user: {
      id: "u1",
      username: "u",
      displayName: "u",
      avatarUrl: null,
      isGuest: false,
      provider: "google" as const,
      email: null,
      createdAt: "",
      updatedAt: "",
    },
    tokens: { accessToken: "t", expiresAt },
  });

  it("compares the expiry against now", () => {
    expect(isSessionExpired(session(Date.now() + 60_000))).toBe(false);
    expect(isSessionExpired(session(Date.now() - 60_000))).toBe(true);
  });
});

describe("ServerAuthVerifier", () => {
  it("authenticates a correctly signed bearer token", async () => {
    const identity = await verifier().authenticateRequest(await bearer("user-123"));
    expect(identity?.userId).toBe("user-123");
  });

  it("returns null for a token signed with a different secret", async () => {
    const forged = await bearer("user-123", "some-other-secret-long-enough-here");
    expect(await verifier().authenticateRequest(forged)).toBeNull();
  });

  it("returns null when the header is missing or malformed", async () => {
    expect(await verifier().authenticateRequest(null)).toBeNull();
    expect(await verifier().authenticateRequest("Bearer not-a-jwt")).toBeNull();
  });
});
