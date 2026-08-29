import type { AuthSession, AuthUser } from "./types.js";
import { isGuestUserId } from "./guest.js";

export function isSessionExpired(session: AuthSession): boolean {
  return Date.now() >= session.tokens.expiresAt;
}

export function parseBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.trim().split(" ");
  if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
    return parts[1] ?? null;
  }
  return null;
}

export function verifyGuestToken(token: string): AuthUser | null {
  if (!token.startsWith("guest_token_")) return null;
  const parts = token.split("_");
  // Format: guest_token_guest_{timestamp}_{suffix}_{issuedAt}
  if (parts.length < 5) return null;
  const guestId = `${parts[2]}_${parts[3]}_${parts[4]}`;
  if (!isGuestUserId(guestId)) return null;

  return {
    id: guestId,
    username: `Guest_${guestId.slice(-4)}`,
    displayName: `Guest ${guestId.slice(-4)}`,
    avatarUrl: null,
    isGuest: true,
    provider: "guest",
    email: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
