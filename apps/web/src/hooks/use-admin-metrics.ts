"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";

export interface AdminMetrics {
  players: number;
  guests: number;
  matchesToday: number;
  matchesWeek: number;
  activeRooms: number;
  openReports: number;
  averageMatchSeconds: number;
  /** Matches that produced a result, against rooms that started a game. */
  completionRate: number;
}

const since = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/**
 * The numbers on the admin dashboard (spec v2 section 79).
 *
 * Counted with head-only queries rather than by fetching rows and measuring
 * the array — on a platform of any size the second approach downloads the
 * table to display a single integer.
 *
 * Every read here goes through the same RLS as any other client, so this is
 * safe to run in the browser: a non-staff caller gets zeroes rather than data.
 */
export function useAdminMetrics(enabled: boolean) {
  const query = useQuery({
    queryKey: ["admin-metrics"],
    enabled: enabled && isSupabaseConfigured,
    // The dashboard is looked at, not watched. A minute-old count is fine and
    // a query per render is not.
    staleTime: 60_000,
    queryFn: async (): Promise<AdminMetrics> => {
      const supabase = getSupabaseBrowserClient();

      // Head-only counts: the server returns a number in a header and no
      // rows at all. Fetching the rows to measure `data.length` would download
      // the table to display one integer.
      const head = { count: "exact" as const, head: true };

      const [players, guests, today, week, rooms, reports, sessions] = await Promise.all([
        supabase.from("profiles").select("id", head),
        supabase.from("profiles").select("id", head).eq("is_guest", true),
        supabase.from("game_results").select("id", head).gte("created_at", since(1)),
        supabase.from("game_results").select("id", head).gte("created_at", since(7)),
        supabase.from("rooms").select("id", head).in("status", ["waiting", "in_game"]),
        supabase.from("reports").select("id", head).eq("status", "open"),
        supabase.from("game_sessions").select("id", head),
      ]);

      // Average duration is a real read, but bounded: the newest 200 matches
      // describe the current shape of play without scanning the table.
      const { data: durations } = await supabase
        .from("game_results")
        .select("duration_seconds")
        .order("created_at", { ascending: false })
        .limit(200);

      const rows = (durations ?? []) as Array<{ duration_seconds: number }>;
      const averageMatchSeconds =
        rows.length > 0
          ? Math.round(rows.reduce((sum, r) => sum + r.duration_seconds, 0) / rows.length)
          : 0;

      const totalSessions = sessions.count ?? 0;
      const totalResults = (today.count ?? 0) + (week.count ?? 0);

      return {
        players: players.count ?? 0,
        guests: guests.count ?? 0,
        matchesToday: today.count ?? 0,
        matchesWeek: week.count ?? 0,
        activeRooms: rooms.count ?? 0,
        openReports: reports.count ?? 0,
        averageMatchSeconds,
        // A session that produced no result was abandoned rather than played
        // out. Clamped, because sessions and results are counted over
        // different windows and the ratio can otherwise exceed one.
        completionRate:
          totalSessions > 0 ? Math.min(1, totalResults / totalSessions) : 0,
      };
    },
  });

  return { metrics: query.data ?? null, isLoading: query.isPending && query.fetchStatus !== "idle" };
}
