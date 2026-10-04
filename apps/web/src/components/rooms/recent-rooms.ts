"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";
import { isGameId } from "../../lib/games/catalog";

/**
 * Rooms this browser has been in lately, so "your rooms" can offer a way
 * back in.
 *
 * Per-viewer and best-effort: localStorage, read and written inside
 * try/catch, and an empty list whenever it is unavailable (a private window,
 * blocked storage). The room server says whether each one is still alive.
 */

const STORAGE_KEY = "playora:recent-rooms";
const MAX_RECENT = 6;
const EVENT = "playora:recent-rooms";

export interface RecentRoom {
  code: string;
  gameId: GameId;
  /** Epoch ms of the last visit. */
  at: number;
}

function read(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RecentRoom =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as RecentRoom).code === "string" &&
        isGameId((r as RecentRoom).gameId) &&
        typeof (r as RecentRoom).at === "number",
    );
  } catch {
    return [];
  }
}

/** Notes a visit. The newest visit goes first; older ones fall off the end. */
export function rememberRoom(code: string, gameId: GameId): void {
  try {
    const rest = read().filter((r) => r.code !== code);
    const next = [{ code, gameId, at: Date.now() }, ...rest].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable: nothing to remember with.
  }
}

export function forgetRoom(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(read().filter((r) => r.code !== code)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // As above.
  }
}

/** The list, newest first. Empty on the server and until the first client effect. */
export function useRecentRooms(): RecentRoom[] {
  const [rooms, setRooms] = React.useState<RecentRoom[]>([]);
  React.useEffect(() => {
    const sync = () => setRooms(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return rooms;
}
