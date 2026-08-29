import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

/**
 * Identity established by cryptographically verifying an access token.
 *
 * This is the ONLY legitimate source of identity on the server. Nothing that
 * arrives from a client — query strings, message bodies, headers — may be
 * treated as identity. See spec sections 63, 83 and 104.1.
 */
export interface VerifiedIdentity {
  /** Supabase user id (JWT `sub`). Stable across sessions and devices. */
  userId: string;
  email: string | null;
  /** True for Supabase anonymous ("guest") sessions. */
  isGuest: boolean;
  displayName: string;
  avatarUrl: string | null;
  /** Token expiry, epoch milliseconds. */
  expiresAt: number;
}

export type TokenVerificationErrorCode =
  | "TOKEN_MISSING"
  | "TOKEN_MALFORMED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID_SIGNATURE"
  | "TOKEN_INVALID_CLAIMS"
  | "VERIFIER_MISCONFIGURED";

export class TokenVerificationError extends Error {
  constructor(
    readonly code: TokenVerificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TokenVerificationError";
  }
}

export interface TokenVerifierConfig {
  /**
   * Supabase project URL, e.g. https://abc.supabase.co
   * Used to derive both the JWKS endpoint and the expected issuer.
   */
  supabaseUrl?: string;
  /**
   * Legacy HS256 shared secret (Supabase "JWT Secret"). Used only when the
   * project has not migrated to asymmetric signing keys. Prefer JWKS.
   */
  jwtSecret?: string;
  /**
   * Expected `iss` claim. Derived from supabaseUrl when omitted; set explicitly
   * to validate the issuer without configuring a JWKS endpoint.
   */
  expectedIssuer?: string;
  /** Defaults to "authenticated", which is what Supabase issues. */
  expectedAudience?: string;
  /** Leeway for clock skew between the edge and Supabase. */
  clockToleranceSeconds?: number;
}

interface SupabaseJWTPayload extends JWTPayload {
  email?: string;
  role?: string;
  is_anonymous?: boolean;
  user_metadata?: {
    full_name?: string;
    name?: string;
    user_name?: string;
    preferred_username?: string;
    avatar_url?: string;
    picture?: string;
  };
}

/**
 * Verifies Supabase-issued access tokens at the edge.
 *
 * Prefers asymmetric verification via the project's JWKS endpoint, so no shared
 * secret ever needs to be deployed to the Worker. Falls back to the legacy
 * HS256 project secret when that is how the project is configured.
 */
export class SupabaseTokenVerifier {
  private readonly issuer: string | undefined;
  private readonly audience: string;
  private readonly clockTolerance: number;
  private readonly jwks: JWTVerifyGetKey | undefined;
  private readonly symmetricKey: Uint8Array | undefined;

  constructor(config: TokenVerifierConfig) {
    const base = config.supabaseUrl?.replace(/\/+$/, "");
    this.issuer = config.expectedIssuer ?? (base ? `${base}/auth/v1` : undefined);
    this.audience = config.expectedAudience ?? "authenticated";
    this.clockTolerance = config.clockToleranceSeconds ?? 5;

    if (base) {
      // jose caches the key set and refreshes on unknown `kid`.
      this.jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
    }
    if (config.jwtSecret) {
      this.symmetricKey = new TextEncoder().encode(config.jwtSecret);
    }

    if (!this.jwks && !this.symmetricKey) {
      throw new TokenVerificationError(
        "VERIFIER_MISCONFIGURED",
        "SupabaseTokenVerifier requires either supabaseUrl (JWKS) or jwtSecret (HS256).",
      );
    }
  }

  async verify(token: string | null | undefined): Promise<VerifiedIdentity> {
    if (!token || typeof token !== "string" || token.split(".").length !== 3) {
      throw new TokenVerificationError("TOKEN_MISSING", "No access token supplied.");
    }

    const options = {
      audience: this.audience,
      clockTolerance: this.clockTolerance,
      ...(this.issuer ? { issuer: this.issuer } : {}),
    };

    let payload: SupabaseJWTPayload | undefined;
    let lastError: unknown;

    // Asymmetric first; HS256 only as a configured fallback.
    if (this.jwks) {
      try {
        payload = (await jwtVerify(token, this.jwks, options)).payload as SupabaseJWTPayload;
      } catch (err) {
        lastError = err;
      }
    }
    if (!payload && this.symmetricKey) {
      try {
        payload = (await jwtVerify(token, this.symmetricKey, options))
          .payload as SupabaseJWTPayload;
      } catch (err) {
        lastError = err;
      }
    }

    if (!payload) throw toVerificationError(lastError);
    return toIdentity(payload);
  }
}

function toVerificationError(err: unknown): TokenVerificationError {
  const code = (err as { code?: string } | undefined)?.code ?? "";
  const message = err instanceof Error ? err.message : "Token verification failed.";

  if (code === "ERR_JWT_EXPIRED") {
    return new TokenVerificationError("TOKEN_EXPIRED", "Access token has expired.");
  }
  if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || code === "ERR_JWKS_NO_MATCHING_KEY") {
    return new TokenVerificationError(
      "TOKEN_INVALID_SIGNATURE",
      "Access token signature is not valid.",
    );
  }
  if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
    return new TokenVerificationError("TOKEN_INVALID_CLAIMS", message);
  }
  if (code === "ERR_JWS_INVALID" || code === "ERR_JWT_INVALID") {
    return new TokenVerificationError("TOKEN_MALFORMED", message);
  }
  return new TokenVerificationError("TOKEN_INVALID_SIGNATURE", message);
}

function toIdentity(payload: SupabaseJWTPayload): VerifiedIdentity {
  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) {
    throw new TokenVerificationError("TOKEN_INVALID_CLAIMS", "Token has no subject claim.");
  }

  const meta = payload.user_metadata ?? {};
  const isGuest = payload.is_anonymous === true;
  const email = typeof payload.email === "string" && payload.email ? payload.email : null;

  const displayName =
    meta.full_name ??
    meta.name ??
    meta.preferred_username ??
    meta.user_name ??
    (isGuest ? `Guest ${userId.slice(0, 4).toUpperCase()}` : (email?.split("@")[0] ?? "Player"));

  return {
    userId,
    email,
    isGuest,
    displayName,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
    expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : 0,
  };
}
