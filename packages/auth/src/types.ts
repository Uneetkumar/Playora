import type { User } from "@playden/game-types";

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthUser extends User {
  email?: string | null;
  provider: "google" | "guest" | "email";
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

export type OAuthProvider = "google";

export interface SignInWithOAuthOptions {
  provider: OAuthProvider;
  redirectTo?: string;
}

export interface GuestSignInOptions {
  preferredUsername?: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
}
