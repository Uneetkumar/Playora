"use client";

import * as React from "react";
import { isValidRoomCode, normalizeRoomCode } from "@playora/game-types";
import type { GameId, RoomSummary } from "@playora/game-types";

interface ApiRoom {
  id: string;
  code: string;
  name: string;
  status: string;
  is_private: boolean;
  max_players: number;
  created_at: string;
  games?: { slug: string; name: string } | null;
}

function toSummary(room: ApiRoom): RoomSummary {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    hostUsername: "",
    gameId: (room.games?.slug ?? "chess") as GameId,
    status: room.status as RoomSummary["status"],
    playerCount: 0,
    maxPlayers: room.max_players,
    isPrivate: room.is_private,
    createdAt: new Date(room.created_at).getTime(),
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

/**
 * Room discovery and creation, backed by the room API.
 *
 * Codes are generated server-side and rooms are persisted, so a room exists
 * before anyone connects to it. The page previously invented a code in the
 * browser and navigated, which meant rooms had no server-side existence,
 * no capacity limit and no privacy enforcement.
 */
export function useRoomResolver() {
  const [error, setError] = React.useState<string | null>(null);

  /** Validates a code and confirms the room is joinable before navigating. */
  const resolveCode = React.useCallback(async (raw: string) => {
    const code = normalizeRoomCode(raw);
    if (!isValidRoomCode(code)) {
      setError("That doesn't look like a valid room code.");
      return null;
    }
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) {
        setError(await readError(res));
        return null;
      }
      const body = (await res.json()) as { isFull: boolean; canSpectate: boolean };
      if (body.isFull && !body.canSpectate) {
        setError("That room is already full.");
        return null;
      }
      setError(null);
      return code;
    } catch {
      setError("Couldn't reach that room. Check your connection.");
      return null;
    }
  }, []);

  return { resolveCode, error, setError };
}

export function useRooms(
  gameFilter?: string | null,
  options?: { autoFetch?: boolean },
) {
  const autoFetch = options?.autoFetch ?? true;
  const [rooms, setRooms] = React.useState<RoomSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(autoFetch);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const query = gameFilter ? `?game=${encodeURIComponent(gameFilter)}` : "";
      const res = await fetch(`/api/rooms${query}`);
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const body = (await res.json()) as { rooms: ApiRoom[] };
      setRooms((body.rooms ?? []).map(toSummary));
      setError(null);
    } catch {
      setError("Couldn't load rooms. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [gameFilter]);

  React.useEffect(() => {
    if (autoFetch) {
      void refresh();
    }
  }, [refresh, autoFetch]);

  /** Returns the new room's code, or null if creation failed. */
  const createRoom = React.useCallback(
    async (input: { gameSlug: string; name?: string; isPrivate: boolean }) => {
      setIsCreating(true);
      setError(null);
      try {
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          setError(await readError(res));
          return null;
        }
        const body = (await res.json()) as { room: ApiRoom };
        return body.room.code;
      } catch {
        setError("Couldn't create the room. Check your connection.");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  /** Validates a code and confirms the room is joinable before navigating. */
  const resolveCode = React.useCallback(async (raw: string) => {
    const code = normalizeRoomCode(raw);
    if (!isValidRoomCode(code)) {
      setError("That doesn't look like a valid room code.");
      return null;
    }
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) {
        setError(await readError(res));
        return null;
      }
      const body = (await res.json()) as { isFull: boolean; canSpectate: boolean };
      if (body.isFull && !body.canSpectate) {
        setError("That room is already full.");
        return null;
      }
      setError(null);
      return code;
    } catch {
      setError("Couldn't reach that room. Check your connection.");
      return null;
    }
  }, []);

  return { rooms, isLoading, isCreating, error, setError, refresh, createRoom, resolveCode };
}

export interface RoomInfo {
  gameSlug: GameId;
  status: string;
  isFull: boolean;
  canSpectate: boolean;
  /** False when the code has no persisted room (someone typed a code directly). */
  exists: boolean;
}

/**
 * Resolves a room code to its game *before* a socket is opened.
 *
 * Without this the room page had to guess, and defaulted to chess — so a room
 * created for any other game silently became a chess room. The game a room is
 * for is server state, not something the client can assume.
 */
export function useRoomInfo(code: string) {
  const [info, setInfo] = React.useState<RoomInfo | null>(null);
  const [isResolving, setIsResolving] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsResolving(true);

    (async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
        if (cancelled) return;
        if (!res.ok) {
          // An unpersisted code is still playable as an ad-hoc chess room.
          setInfo({
            gameSlug: "chess",
            status: "waiting",
            isFull: false,
            canSpectate: false,
            exists: false,
          });
          return;
        }
        const body = (await res.json()) as {
          room: { status: string; games?: { slug: string } | null };
          isFull: boolean;
          canSpectate: boolean;
        };
        if (cancelled) return;
        setInfo({
          gameSlug: (body.room.games?.slug ?? "chess") as GameId,
          status: body.room.status,
          isFull: body.isFull,
          canSpectate: body.canSpectate,
          exists: true,
        });
      } catch {
        if (!cancelled) {
          setInfo({
            gameSlug: "chess",
            status: "waiting",
            isFull: false,
            canSpectate: false,
            exists: false,
          });
        }
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return { info, isResolving };
}
