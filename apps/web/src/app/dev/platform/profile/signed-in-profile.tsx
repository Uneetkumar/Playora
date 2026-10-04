"use client";

import * as React from "react";
import type { AuthUser } from "@playora/auth";
import { useAuthStore } from "../../../../lib/store/auth-store";
import ProfilePage from "../../../profile/page";

const DEMO_USER: AuthUser = {
  id: "demo-profile",
  username: "ada",
  displayName: "Ada Lovelace",
  avatarUrl: null,
  isGuest: true,
  provider: "guest",
  email: null,
  createdAt: "2026-03-02T10:00:00Z",
  updatedAt: "2026-03-02T10:00:00Z",
};

/**
 * Signs the demo player in for as long as this page is open, in this tab's
 * memory only: the auth store is not persisted, and leaving the page puts back
 * whatever was there. Nothing is written to the server or to storage; matches
 * on this device, if any, are the browser's own.
 *
 * The swap happens after mount, never during render, so the server's copy of
 * the store (one per dev-server process, shared by every request) is never
 * touched.
 */
export function SignedInProfile() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const before = useAuthStore.getState();
    useAuthStore.setState({
      user: DEMO_USER,
      isAuthenticated: true,
      isGuest: true,
      isLoading: false,
      error: null,
    });
    setReady(true);
    return () =>
      useAuthStore.setState({
        user: before.user,
        session: before.session,
        isAuthenticated: before.isAuthenticated,
        isGuest: before.isGuest,
        isLoading: before.isLoading,
        error: before.error,
      });
  }, []);

  return ready ? <ProfilePage /> : null;
}
