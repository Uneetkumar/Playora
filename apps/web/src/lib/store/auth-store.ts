"use client";

import { create } from "zustand";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import type { AuthSession, AuthState, AuthUser } from "@playora/auth";
import { getSupabaseBrowserClient } from "../supabase/client";
import { isSupabaseConfigured } from "../env";

/** Maps a Supabase session onto the platform's auth shape. */
function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return { user: toAuthUser(session.user), tokens: toTokens(session) };
}

function toTokens(session: Session) {
  return {
    accessToken: session.access_token,
    ...(session.refresh_token ? { refreshToken: session.refresh_token } : {}),
    // Supabase reports expiry in seconds; the platform works in milliseconds.
    expiresAt: (session.expires_at ?? 0) * 1000,
  };
}

function toAuthUser(user: SupabaseUser): AuthUser {
  const meta = user.user_metadata ?? {};
  const isGuest = user.is_anonymous === true;
  const displayName =
    (meta["full_name"] as string | undefined) ??
    (meta["name"] as string | undefined) ??
    (isGuest
      ? `Guest ${user.id.slice(0, 4).toUpperCase()}`
      : (user.email?.split("@")[0] ?? "Player"));

  return {
    id: user.id,
    username: displayName,
    displayName,
    avatarUrl:
      (meta["avatar_url"] as string | undefined) ?? (meta["picture"] as string | undefined) ?? null,
    isGuest,
    provider: isGuest ? "guest" : ((user.app_metadata?.provider as "google") ?? "email"),
    email: user.email ?? null,
    createdAt: user.created_at,
    updatedAt: user.updated_at ?? user.created_at,
  };
}

interface AuthActions {
  initialize: () => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInAsGuest: (displayName?: string) => Promise<AuthSession | null>;
  /** Upgrades an anonymous account to Google without losing history (spec section 12). */
  linkGoogleAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  setError: (message: string | null) => void;
}

export interface AuthStoreState extends AuthState {
  error: string | null;
  isConfigured: boolean;
}

let subscribed = false;

export const useAuthStore = create<AuthStoreState & AuthActions>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isGuest: false,
  error: null,
  isConfigured: isSupabaseConfigured,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      set({ isLoading: false, isConfigured: false });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    applySession(set, data.session);

    // Keeps the store in step with token refreshes and sign-outs in other tabs.
    if (!subscribed) {
      subscribed = true;
      supabase.auth.onAuthStateChange((_event, session) => applySession(set, session));
    }
  },

  signInWithGoogle: async (redirectTo = "/") => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) set({ error: error.message });
  },

  signInAsGuest: async (displayName?: string) => {
    if (!isSupabaseConfigured) return null;
    const supabase = getSupabaseBrowserClient();
    const trimmed = displayName?.trim();
    const { data, error } = await supabase.auth.signInAnonymously(
      trimmed ? { options: { data: { full_name: trimmed } } } : undefined,
    );
    if (error) {
      set({ error: error.message });
      return null;
    }
    applySession(set, data.session);
    return toAuthSession(data.session);
  },

  linkGoogleAccount: async () => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    // linkIdentity keeps the same user id, so ratings and history survive.
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/profile` },
    });
    if (error) set({ error: error.message });
  },

  signOut: async () => {
    if (!isSupabaseConfigured) return;
    await getSupabaseBrowserClient().auth.signOut();
    set({
      user: null,
      session: null,
      isAuthenticated: false,
      isGuest: false,
      isLoading: false,
    });
  },

  setError: (message) => set({ error: message }),
}));

type Setter = (partial: Partial<AuthStoreState>) => void;

function applySession(set: Setter, session: Session | null): void {
  const authSession = toAuthSession(session);
  set({
    session: authSession,
    user: authSession?.user ?? null,
    isAuthenticated: authSession !== null,
    isGuest: authSession?.user.isGuest ?? false,
    isLoading: false,
  });
}
