import type { AuthUser } from "./types.js";
import { parseBearerToken, verifyGuestToken } from "./session.js";

export interface TokenVerifier {
  verifySupabaseToken(jwt: string): Promise<AuthUser | null>;
}

export class ServerAuthVerifier {
  constructor(private tokenVerifier?: TokenVerifier) {}

  async authenticateRequest(authHeader: string | null | undefined): Promise<AuthUser | null> {
    const token = parseBearerToken(authHeader);
    if (!token) return null;

    // Check if guest token
    const guestUser = verifyGuestToken(token);
    if (guestUser) return guestUser;

    // Check if Supabase JWT
    if (this.tokenVerifier) {
      return this.tokenVerifier.verifySupabaseToken(token);
    }

    return null;
  }
}
