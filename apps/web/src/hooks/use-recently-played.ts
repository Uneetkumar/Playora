"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";
import { queryKeys } from "../lib/query/keys";
import { useAuthStore } from "../lib/store/auth-store";
import { readRecent, recordLocalPlay, type RecentEntry } from "../lib/games/recent-local";

/**
 * Recently played, for everyone.
 *
 * Signed-in players get the `recently_played` table; everyone else gets the
 * same shape out of localStorage. Most visitors to a casual games site never
 * make an account, and "sign in to see what you played" is a worse answer than
 * remembering it locally — so the shelf works either way and the two paths
 * render from one type.
 */

/** Postgres' code for "relation does not exist". */
const UNDEFINED_TABLE = "42P01";

export interface RecentlyPlayedResult {
  entries: RecentEntry[];
  isLoading: boolean;
  /** True while the account-backed list cannot be used (see `useFavorites`). */
  usingLocalOnly: boolean;
  /** Records a play. Safe to call on every game start. */
  record: (gameSlug: string) => void;
}

interface RecentRow {
  game_slug: string;
  last_played_at: string;
  play_count: number;
}

export function useRecentlyPlayed(): RecentlyPlayedResult {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured;
  const accountBacked = configured && !!userId && !user?.isGuest;

  /*
   * Read once on mount rather than on every render.
   *
   * `readRecent()` parses JSON out of localStorage, and calling it inline
   * during render would both re-parse on every keystroke elsewhere on the page
   * and return a new array identity each time, which is a re-render loop
   * waiting to happen in any consumer that lists it as a dependency.
   */
  const [local, setLocal] = React.useState<RecentEntry[]>([]);
  React.useEffect(() => {
    setLocal(readRecent());
  }, []);

  const query = useQuery({
    queryKey: queryKeys.recentlyPlayed(userId),
    enabled: accountBacked,
    queryFn: async (): Promise<{ entries: RecentEntry[]; missingTable: boolean }> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("recently_played")
        .select("game_slug, last_played_at, play_count")
        .eq("user_id", userId!)
        .order("last_played_at", { ascending: false })
        .limit(24);

      if (error) {
        if (error.code === UNDEFINED_TABLE) return { entries: [], missingTable: true };
        throw error;
      }

      return {
        entries: ((data ?? []) as RecentRow[]).map((r) => ({
          gameSlug: r.game_slug,
          lastPlayedAt: r.last_played_at,
          playCount: r.play_count,
        })),
        missingTable: false,
      };
    },
  });

  const missingTable = query.data?.missingTable === true;
  const usingLocalOnly = !accountBacked || missingTable;

  const mutation = useMutation({
    mutationFn: async (gameSlug: string) => {
      const supabase = getSupabaseBrowserClient();
      /*
       * One statement, server-side.
       *
       * The read-add-one-write version loses plays when two tabs start a game
       * at once, and costs two round trips. `record_play` is SECURITY INVOKER,
       * so it runs behind the same RLS policies as a direct write and grants
       * nothing the caller did not already have.
       */
      const { error } = await supabase.rpc("record_play", { p_game_slug: gameSlug });
      if (error) {
        console.warn("Supabase record_play skipped (offline mode):", error.message);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recentlyPlayed(userId) });
    },
  });

  const record = React.useCallback(
    (gameSlug: string) => {
      // Always written locally: it is what a guest sees, and it keeps the
      // shelf correct on this device if the network write fails.
      setLocal(recordLocalPlay(gameSlug));
      if (accountBacked && !missingTable) mutation.mutate(gameSlug);
    },
    // `mutation` is recreated each render; `mutate` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountBacked, missingTable, mutation.mutate],
  );

  return {
    entries: usingLocalOnly ? local : (query.data?.entries ?? []),
    isLoading: accountBacked && query.isLoading,
    usingLocalOnly,
    record,
  };
}
