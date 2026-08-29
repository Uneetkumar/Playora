import type { User } from "@playora/game-types";

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export interface AuthUser extends User {
  email?: string | null;
  /** "guest" corresponds to a Supabase anonymous session. */
  provider: "google" | "guest" | "email";
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

export type OAuthProvider = "google";

export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
}
