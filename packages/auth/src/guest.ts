import type { AuthUser, AuthSession, GuestSignInOptions } from "./types.js";

export function generateGuestId(): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `guest_${Date.now()}_${randomSuffix}`;
}

export function createGuestUser(options?: GuestSignInOptions): AuthUser {
  const guestId = generateGuestId();
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const username = options?.preferredUsername?.trim() || `Guest_${randomDigits}`;

  return {
    id: guestId,
    username,
    displayName: username,
    avatarUrl: options?.avatarUrl ?? null,
    isGuest: true,
    provider: "guest",
    email: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createGuestSession(options?: GuestSignInOptions): AuthSession {
  const user = createGuestUser(options);
  const now = Date.now();
  // Guest tokens expire after 24 hours
  const expiresAt = now + 24 * 60 * 60 * 1000;

  return {
    user,
    tokens: {
      accessToken: `guest_token_${user.id}_${now}`,
      expiresAt,
    },
  };
}

export function isGuestUserId(userId: string): boolean {
  return userId.startsWith("guest_");
}
