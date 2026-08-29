import { create } from "zustand";
import type { AuthState, AuthUser, AuthSession, GuestSignInOptions } from "@playden/auth";
import { ClientAuthManager } from "@playden/auth";

interface AuthActions {
  initialize: () => void;
  signInAsGuest: (options?: GuestSignInOptions) => AuthSession;
  setUser: (user: AuthUser | null, session: AuthSession | null) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isGuest: false,

  initialize: () => {
    const savedGuest = ClientAuthManager.getStoredGuestSession();
    if (savedGuest) {
      set({
        user: savedGuest.user,
        session: savedGuest,
        isLoading: false,
        isAuthenticated: true,
        isGuest: true,
      });
    } else {
      set({ isLoading: false });
    }
  },

  signInAsGuest: (options) => {
    const session = ClientAuthManager.loginAsGuest(options);
    set({
      user: session.user,
      session,
      isLoading: false,
      isAuthenticated: true,
      isGuest: true,
    });
    return session;
  },

  setUser: (user, session) => {
    set({
      user,
      session,
      isLoading: false,
      isAuthenticated: !!user,
      isGuest: user?.isGuest ?? false,
    });
  },

  signOut: () => {
    ClientAuthManager.clearGuestSession();
    set({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      isGuest: false,
    });
  },
}));
