import type { AuthSession, AuthState, GuestSignInOptions } from "./types.js";
import { createGuestSession } from "./guest.js";

export const INITIAL_AUTH_STATE: AuthState = {
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isGuest: false,
};

const GUEST_STORAGE_KEY = "game_platform_guest_session";

function getLocalStorage(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
} | null {
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

export class ClientAuthManager {
  static getStoredGuestSession(): AuthSession | null {
    const storage = getLocalStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(GUEST_STORAGE_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (Date.now() >= session.tokens.expiresAt) {
        storage.removeItem(GUEST_STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  static saveGuestSession(session: AuthSession): void {
    const storage = getLocalStorage();
    if (!storage) return;
    try {
      storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore quota errors
    }
  }

  static clearGuestSession(): void {
    const storage = getLocalStorage();
    if (!storage) return;
    try {
      storage.removeItem(GUEST_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  static loginAsGuest(options?: GuestSignInOptions): AuthSession {
    const session = createGuestSession(options);
    this.saveGuestSession(session);
    return session;
  }
}
