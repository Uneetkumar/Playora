import { SupabaseTokenVerifier, type TokenVerifierConfig } from "./verify.js";
import type { VerifiedIdentity } from "./verify.js";
import { parseBearerToken } from "./session.js";

/**
 * Authenticates inbound HTTP requests by verifying the bearer token.
 *
 * Returns null rather than throwing so callers can respond with a 401 without
 * leaking which part of verification failed.
 */
export class ServerAuthVerifier {
  private verifier: SupabaseTokenVerifier;

  constructor(config: TokenVerifierConfig) {
    this.verifier = new SupabaseTokenVerifier(config);
  }

  async authenticateRequest(
    authHeader: string | null | undefined,
  ): Promise<VerifiedIdentity | null> {
    const token = parseBearerToken(authHeader);
    if (!token) return null;
    try {
      return await this.verifier.verify(token);
    } catch {
      return null;
    }
  }
}
