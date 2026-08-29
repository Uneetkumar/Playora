"use client";

import * as React from "react";
import {
  parseMatchmakingServerMessage,
  type MatchFoundMessage,
  type QueueMode,
} from "@playora/protocol";
import { useAuthStore } from "../lib/store/auth-store";
import { env } from "../lib/env";

/**
 * Queue states, named for what the player sees (spec section 4).
 * `idle` is the resting state; everything else is a live queue session.
 */
export type QueueState =
  | "idle"
  | "connecting"
  | "searching"
  | "match_found"
  | "starting"
  | "cancelled"
  | "timeout"
  | "error";

export interface MatchmakingSnapshot {
  state: QueueState;
  waitingSeconds: number;
  poolSize: number;
  match: MatchFoundMessage | null;
  message: string;
  error: string | null;
}

/** Human-readable status, never a protocol code (spec section 50). */
function describe(state: QueueState, waitingSeconds: number): string {
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "searching":
      return waitingSeconds < 12
        ? "Looking for a player near your skill level."
        : "Still searching — widening the skill range.";
    case "match_found":
      return "Match found!";
    case "starting":
      return "Starting game…";
    case "timeout":
      return "No opponent found. Try again, or play the AI.";
    case "cancelled":
      return "Search cancelled.";
    default:
      return "";
  }
}

function wsOrigin(): string {
  const raw = env.NEXT_PUBLIC_REALTIME_WS_URL;
  const protocol = /^(https|wss)/.test(raw) ? "wss:" : "ws:";
  return `${protocol}//${raw.replace(/^(https?|wss?):\/\//, "")}`;
}

/**
 * Quick Match queue client.
 *
 * Talks to MatchmakingDurableObject, which is entirely separate from the room
 * socket: matchmaking decides who plays together and hands back a room code,
 * then the room takes over (spec section 104.8).
 */
export function useMatchmaking(gameId: string) {
  const { session, isLoading: authLoading, signInAsGuest } = useAuthStore();
  const socketRef = React.useRef<WebSocket | null>(null);
  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = React.useState<QueueState>("idle");
  const [waitingSeconds, setWaiting] = React.useState(0);
  const [poolSize, setPoolSize] = React.useState(0);
  const [match, setMatch] = React.useState<MatchFoundMessage | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const teardown = React.useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    try {
      socketRef.current?.close();
    } catch {
      /* already closed */
    }
    socketRef.current = null;
  }, []);

  React.useEffect(() => teardown, [teardown]);

  const cancel = React.useCallback(() => {
    try {
      socketRef.current?.send(JSON.stringify({ type: "QUEUE_LEAVE" }));
    } catch {
      /* socket already gone */
    }
    teardown();
    setState("cancelled");
    setWaiting(0);
  }, [teardown]);

  const search = React.useCallback(
    async (mode: QueueMode = "casual") => {
      if (authLoading) return;
      setError(null);
      setMatch(null);
      setWaiting(0);
      setState("connecting");

      // Queueing requires an identity; a guest session is created on demand.
      let active = session;
      if (!active) active = await signInAsGuest();
      if (!active) {
        setState("error");
        setError("Couldn't start a session. Check that sign-in is configured.");
        return;
      }

      teardown();
      const ws = new WebSocket(`${wsOrigin()}/matchmaking/${encodeURIComponent(gameId)}`);
      socketRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({ type: "QUEUE_JOIN", token: active.tokens.accessToken, gameId, mode }),
        );
        // Local ticker: the server only pushes status every couple of seconds.
        tickRef.current = setInterval(() => setWaiting((s) => s + 1), 1000);
      };

      ws.onmessage = (event) => {
        const parsed = parseMatchmakingServerMessage(event.data);
        if (!parsed.success) return;
        const msg = parsed.data;

        switch (msg.type) {
          case "QUEUED":
            setState("searching");
            setPoolSize(msg.poolSize);
            return;
          case "QUEUE_STATUS":
            setPoolSize(msg.poolSize);
            setWaiting(msg.waitingSeconds);
            return;
          case "MATCH_FOUND":
            setMatch(msg);
            setState("match_found");
            if (tickRef.current) clearInterval(tickRef.current);
            return;
          case "QUEUE_LEFT":
            setState(msg.reason === "timeout" ? "timeout" : "cancelled");
            teardown();
            return;
          case "MM_ERROR":
            setState("error");
            setError(msg.message);
            teardown();
            return;
        }
      };

      ws.onerror = () => {
        setState("error");
        setError("Lost connection to matchmaking. Please try again.");
      };
    },
    [authLoading, session, signInAsGuest, gameId, teardown],
  );

  const reset = React.useCallback(() => {
    teardown();
    setState("idle");
    setMatch(null);
    setError(null);
    setWaiting(0);
  }, [teardown]);

  const snapshot: MatchmakingSnapshot = {
    state,
    waitingSeconds,
    poolSize,
    match,
    message: describe(state, waitingSeconds),
    error,
  };

  return { ...snapshot, search, cancel, reset, setStarting: () => setState("starting") };
}
