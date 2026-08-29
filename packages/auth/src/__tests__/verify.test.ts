import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { SupabaseTokenVerifier, TokenVerificationError } from "../verify.js";

const SECRET = "test-jwt-secret-that-is-long-enough-for-hs256";
const ATTACKER_SECRET = "attacker-secret-that-is-also-long-enough-here";
const ISSUER = "https://testproject.supabase.co/auth/v1";

const key = (s: string) => new TextEncoder().encode(s);

function verifier() {
  return new SupabaseTokenVerifier({
    jwtSecret: SECRET,
    expectedIssuer: ISSUER,
  });
}

async function sign(
  claims: Record<string, unknown>,
  opts: { secret?: string; expiresIn?: string; issuer?: string; audience?: string } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? "authenticated")
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign(key(opts.secret ?? SECRET));
}

async function expectRejection(token: string, code: string) {
  await expect(verifier().verify(token)).rejects.toThrow(TokenVerificationError);
  await expect(verifier().verify(token)).rejects.toMatchObject({ code });
}

describe("SupabaseTokenVerifier", () => {
  it("requires at least one key source", () => {
    expect(() => new SupabaseTokenVerifier({})).toThrow(TokenVerificationError);
  });

  describe("valid tokens", () => {
    it("accepts a Google-authenticated user and derives the display name", async () => {
      const token = await sign({
        sub: "11111111-1111-4111-8111-111111111111",
        email: "player@example.com",
        role: "authenticated",
        user_metadata: { full_name: "Real Player", avatar_url: "https://cdn/a.png" },
      });

      const identity = await verifier().verify(token);

      expect(identity.userId).toBe("11111111-1111-4111-8111-111111111111");
      expect(identity.email).toBe("player@example.com");
      expect(identity.isGuest).toBe(false);
      expect(identity.displayName).toBe("Real Player");
      expect(identity.avatarUrl).toBe("https://cdn/a.png");
      expect(identity.expiresAt).toBeGreaterThan(Date.now());
    });

    it("marks Supabase anonymous sessions as guests", async () => {
      const token = await sign({
        sub: "22222222-2222-4222-8222-222222222222",
        role: "authenticated",
        is_anonymous: true,
      });

      const identity = await verifier().verify(token);

      expect(identity.isGuest).toBe(true);
      expect(identity.email).toBeNull();
      expect(identity.displayName).toMatch(/^Guest /);
    });

    it("falls back to the email local-part when no metadata name exists", async () => {
      const token = await sign({
        sub: "33333333-3333-4333-8333-333333333333",
        email: "kasparov@example.com",
      });

      expect((await verifier().verify(token)).displayName).toBe("kasparov");
    });
  });

  describe("rejects forged and invalid tokens", () => {
    // The core anti-impersonation guarantee: a token minted by anyone who does
    // not hold the signing key is refused, no matter how well-formed.
    it("rejects a token signed with a different secret", async () => {
      const forged = await sign(
        { sub: "victim-user-id", role: "authenticated" },
        { secret: ATTACKER_SECRET },
      );
      await expectRejection(forged, "TOKEN_INVALID_SIGNATURE");
    });

    it("rejects an unsigned (alg: none) token", async () => {
      const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
      const body = btoa(JSON.stringify({ sub: "victim", aud: "authenticated", iss: ISSUER }));
      await expectRejection(`${header}.${body}.`, "TOKEN_INVALID_SIGNATURE");
    });

    it("rejects an expired token", async () => {
      const token = await sign({ sub: "someone" }, { expiresIn: "-1h" });
      await expectRejection(token, "TOKEN_EXPIRED");
    });

    it("rejects a token from an unexpected issuer", async () => {
      const token = await sign({ sub: "someone" }, { issuer: "https://evil.example.com/auth/v1" });
      await expectRejection(token, "TOKEN_INVALID_CLAIMS");
    });

    it("rejects a token with the wrong audience", async () => {
      const token = await sign({ sub: "someone" }, { audience: "some-other-service" });
      await expectRejection(token, "TOKEN_INVALID_CLAIMS");
    });

    it("rejects a token with no subject claim", async () => {
      const token = await sign({ role: "authenticated" });
      await expectRejection(token, "TOKEN_INVALID_CLAIMS");
    });

    it.each([
      ["empty string", ""],
      ["not a jwt", "definitely-not-a-token"],
      ["two segments", "aaa.bbb"],
    ])("rejects a malformed token (%s)", async (_label, token) => {
      await expectRejection(token, "TOKEN_MISSING");
    });

    it("rejects null and undefined", async () => {
      await expect(verifier().verify(null)).rejects.toMatchObject({ code: "TOKEN_MISSING" });
      await expect(verifier().verify(undefined)).rejects.toMatchObject({ code: "TOKEN_MISSING" });
    });
  });
});
