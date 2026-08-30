"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";
import { queryKeys } from "../lib/query/keys";

export interface FriendProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  isGuest: boolean;
}

export interface FriendRequest extends FriendProfile {
  /** The friendships row, needed to accept, decline or withdraw. */
  friendshipId: string;
  requestedAt: string;
}

export interface FriendsState {
  friends: FriendProfile[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

interface FriendshipRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  level: number | null;
  is_guest: boolean;
}

const EMPTY: FriendsState = { friends: [], incoming: [], outgoing: [] };

/**
 * The friends list, and the requests either side of it.
 *
 * A friendship is a single row with a direction: `user_id` asked, `friend_id`
 * was asked. That makes "incoming" and "outgoing" a matter of which column you
 * are in, and it is why accepting is only ever available to the recipient —
 * enforced by RLS in migration 00007, not merely by this UI.
 */
export function useFriends(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.friends(userId),
    enabled: Boolean(userId) && isSupabaseConfigured,
    queryFn: async (): Promise<FriendsState> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("friendships")
        .select("id,user_id,friend_id,status,created_at")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as FriendshipRow[];
      const otherIds = [
        ...new Set(rows.map((r) => (r.user_id === userId ? r.friend_id : r.user_id))),
      ];
      const profiles = await loadProfiles(supabase, otherIds);

      const next: FriendsState = { friends: [], incoming: [], outgoing: [] };
      for (const row of rows) {
        const otherId = row.user_id === userId ? row.friend_id : row.user_id;
        const profile = profiles[otherId];
        // A profile can be missing if the account was deleted between the two
        // queries. Skipping is right: there is no person left to show.
        if (!profile) continue;

        if (row.status === "accepted") next.friends.push(profile);
        else if (row.status === "pending") {
          const request = { ...profile, friendshipId: row.id, requestedAt: row.created_at };
          if (row.friend_id === userId) next.incoming.push(request);
          else next.outgoing.push(request);
        }
        // 'blocked' is deliberately not surfaced anywhere yet.
      }

      next.friends.sort((a, b) => a.displayName.localeCompare(b.displayName));
      return next;
    },
  });

  // Every mutation ends by invalidating the list rather than patching it by
  // hand: the server decides what a friendship is, and re-reading is both
  // simpler and correct when two people act at once.
  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends(userId) });
  }, [queryClient, userId]);

  /** Sends a request by username. Returns an error message, or null on success. */
  const sendRequest = React.useCallback(
    async (username: string): Promise<string | null> => {
      if (!userId) return "Sign in to add friends.";
      const handle = username.trim().replace(/^@/, "");
      if (!handle) return "Enter a username.";

      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from("profiles")
          .select("id,username,is_guest")
          .ilike("username", handle)
          .limit(1);

        const target = ((data ?? []) as Array<{ id: string; username: string; is_guest: boolean }>)[0];
        if (!target) return `No player called "${handle}".`;
        if (target.id === userId) return "You cannot add yourself.";
        if (target.is_guest) {
          // A guest account disappears with its browser session; a friendship
          // with one would break the first time they cleared their storage.
          return "That player is a guest and cannot be added yet.";
        }

        const { error } = await supabase
          .from("friendships")
          .insert({ user_id: userId, friend_id: target.id, status: "pending" });

        if (error) {
          // The unique constraint is the normal way to hit this, and "already
          // asked" is a better thing to say than a database message.
          if (error.code === "23505") return "You have already asked them.";
          return error.message;
        }

        refresh();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Could not send that request.";
      }
    },
    [userId, refresh],
  );

  const respond = React.useCallback(
    async (friendshipId: string, accept: boolean): Promise<string | null> => {
      try {
        const supabase = getSupabaseBrowserClient();
        // Declining deletes the row rather than storing a refusal: there is no
        // reason to keep a record that someone said no, and it lets them ask
        // again later.
        const { error } = accept
          ? await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId)
          : await supabase.from("friendships").delete().eq("id", friendshipId);

        if (error) return error.message;
        refresh();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Could not update that request.";
      }
    },
    [refresh],
  );

  const remove = React.useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!userId) return "Sign in first.";
      try {
        const supabase = getSupabaseBrowserClient();
        // The row could be in either direction, so match both.
        const { error } = await supabase
          .from("friendships")
          .delete()
          .or(
            `and(user_id.eq.${userId},friend_id.eq.${otherUserId}),` +
              `and(user_id.eq.${otherUserId},friend_id.eq.${userId})`,
          );
        if (error) return error.message;
        refresh();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Could not remove that friend.";
      }
    },
    [userId, refresh],
  );

  return {
    ...(query.data ?? EMPTY),
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.error instanceof Error ? query.error.message : null,
    sendRequest,
    respond,
    remove,
    refresh,
  };
}

type SupabaseClient = ReturnType<typeof getSupabaseBrowserClient>;

async function loadProfiles(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, FriendProfile>> {
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,level,is_guest")
    .in("id", ids);

  const out: Record<string, FriendProfile> = {};
  for (const p of (data ?? []) as ProfileRow[]) {
    out[p.id] = {
      userId: p.id,
      username: p.username,
      displayName: p.display_name || p.username,
      avatarUrl: p.avatar_url,
      level: p.level ?? 1,
      isGuest: p.is_guest,
    };
  }
  return out;
}
