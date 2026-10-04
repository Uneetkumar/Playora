"use client";

import * as React from "react";

/** What the room server says about one room right now. */
export interface LiveRoomStatus {
  exists: boolean;
  status: "waiting" | "starting" | "in_game" | "finished" | "abandoned" | null;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number | null;
}

const POLL_MS = 15_000;

/** The realtime Worker's HTTP origin, from the socket URL the room page uses. */
export function realtimeHttpBase(): string {
  const ws = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "ws://localhost:8787";
  return ws.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/+$/, "");
}

/**
 * Live seat counts for a handful of rooms, read from the room server itself.
 *
 * The room directory in the database does not track who is seated (the room
 * object never writes back), so its counts would always read zero. This asks
 * each room's Durable Object instead, every fifteen seconds while the tab is
 * visible. A room the server cannot be reached for simply has no entry, and
 * the list shows no count for it rather than a made-up one.
 */
export function useLiveRoomStatus(codes: readonly string[]): Record<string, LiveRoomStatus> {
  const [statuses, setStatuses] = React.useState<Record<string, LiveRoomStatus>>({});
  // A stable key, so a new array with the same codes does not restart polling.
  const key = [...new Set(codes)].sort().join(",");

  React.useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    let cancelled = false;
    const base = realtimeHttpBase();

    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      const results = await Promise.all(
        list.map(async (code) => {
          try {
            const res = await fetch(`${base}/rooms/${encodeURIComponent(code)}/status`, {
              cache: "no-store",
            });
            if (!res.ok) return null;
            return [code, (await res.json()) as LiveRoomStatus] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setStatuses(Object.fromEntries(results.filter((r): r is NonNullable<typeof r> => r !== null)));
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key]);

  return statuses;
}
