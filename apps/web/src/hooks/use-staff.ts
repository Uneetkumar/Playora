"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";

export type StaffRole = "moderator" | "admin";

/**
 * Whether the signed-in person is staff.
 *
 * **This is not the security boundary.** Every admin table enforces access in
 * Postgres through `is_staff()` (migration 00008), so a player who forces this
 * hook to return true sees a page whose every query returns nothing. The hook
 * exists so the interface does not offer controls that would fail, not to
 * decide who may use them.
 */
export function useStaffRole(userId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["staff-role", userId],
    enabled: Boolean(userId) && isSupabaseConfigured,
    queryFn: async (): Promise<StaffRole | null> => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .maybeSingle();

      const row = data as { role: StaffRole } | null;
      return row?.role ?? null;
    },
  });

  return {
    role: query.data ?? null,
    isStaff: query.data === "moderator" || query.data === "admin",
    isAdmin: query.data === "admin",
    isLoading: query.isPending && query.fetchStatus !== "idle",
  };
}
