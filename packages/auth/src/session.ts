import type { AuthSession } from "./types.js";

export function isSessionExpired(session: AuthSession): boolean {
  return Date.now() >= session.tokens.expiresAt;
}

/** Extracts a bearer token from an Authorization header. */
export function parseBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.trim().split(" ");
  if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
    return parts[1] ?? null;
  }
  return null;
}
