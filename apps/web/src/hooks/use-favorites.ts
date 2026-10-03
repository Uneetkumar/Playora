"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";
import { queryKeys } from "../lib/query/keys";
import { useAuthStore } from "../lib/store/auth-store";

/**
 * Favourites.
 *
 * Backed by the `favorites` table from migration `00010`, which is keyed
 * (user_id, game_slug) rather than an array on `profiles` — an array is one
 * row every write contends on, cannot be indexed, and grows without bound on
 * the hottest row in the database.
 *
 * Favourites are per-account and deliberately have no signed-out fallback,
 * unlike recently-played. A favourite is a statement about a library you own;
 * remembering one in localStorage and then losing it on the next device is
 * worse than saying it needs an account.
 */

/** Postgres' code for "relation does not exist". */
const UNDEFINED_TABLE = "42P01";

export interface FavoritesResult {
  slugs: Set<string>;
  isLoading: boolean;
  /**
   * True when the feature cannot work in this deployment — Supabase is not
   * configured, or migration 00010 has not been applied.
   *
   * Surfaced rather than swallowed so the UI can hide the control instead of
   * showing a heart that silently does nothing.
   */
  unavailable: boolean;
  isFavorite: (slug: string) => boolean;
  toggle: (slug: string) => void;
  isToggling: boolean;
}

interface FavoriteRow {
  game_slug: string;
}

export function useFavorites(): FavoritesResult {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured;
  // A guest has no account to attach a favourite to.
  const enabled = configured && !!userId && !user?.isGuest;

  const query = useQuery({
    queryKey: queryKeys.favorites(userId),
    enabled,
    queryFn: async (): Promise<{ slugs: string[]; missingTable: boolean }> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("favorites")
        .select("game_slug")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });

      if (error) {
        // The table not existing is a deployment state, not a failure to
        // report as an error — the UI hides the control instead.
        if (error.code === UNDEFINED_TABLE) return { slugs: [], missingTable: true };
        throw error;
      }
      return {
        slugs: ((data ?? []) as FavoriteRow[]).map((r) => r.game_slug),
        missingTable: false,
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ slug, next }: { slug: string; next: boolean }) => {
      const supabase = getSupabaseBrowserClient();
      if (next) {
        const { error } = await supabase
          .from("favorites")
          .upsert({ user_id: userId!, game_slug: slug }, { onConflict: "user_id,game_slug" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId!)
          .eq("game_slug", slug);
        if (error) throw error;
      }
    },

    /*
     * Optimistic, because a favourite is a toggle and a round trip of latency
     * on a heart icon reads as the button being broken. The snapshot is what
     * lets `onError` put it back rather than leaving the UI lying.
     */
    onMutate: async ({ slug, next }) => {
      const key = queryKeys.favorites(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ slugs: string[]; missingTable: boolean }>(key);

      queryClient.setQueryData<{ slugs: string[]; missingTable: boolean }>(key, (old) => {
        const slugs = old?.slugs ?? [];
        return {
          slugs: next ? [slug, ...slugs.filter((s) => s !== slug)] : slugs.filter((s) => s !== slug),
          missingTable: old?.missingTable ?? false,
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.favorites(userId), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites(userId) });
    },
  });

  const slugs = new Set(query.data?.slugs ?? []);

  return {
    slugs,
    isLoading: query.isLoading,
    unavailable: !enabled || query.data?.missingTable === true,
    isFavorite: (slug: string) => slugs.has(slug),
    toggle: (slug: string) => mutation.mutate({ slug, next: !slugs.has(slug) }),
    isToggling: mutation.isPending,
  };
}
