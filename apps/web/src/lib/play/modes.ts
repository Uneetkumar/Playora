import { botRegistry } from "@playden/bot-engine";
import { gameEngineRegistry } from "@playden/game-engine";
import type { GameId } from "@playden/game-types";

export type PlayModeId =
  | "offline-ai"
  | "offline-local"
  | "online-friends"
  | "online-random"
  | "online-ai"
  | "lan";

export interface PlayMode {
  id: PlayModeId;
  label: string;
  tagline: string;
  /** Sign-in required. Guest counts as signed in. */
  needsAuth: boolean;
  needsInternet: boolean;
  status: "ready" | "coming-soon";
  /** Shown when the mode is not yet playable, so the UI never dead-ends. */
  note?: string;
}

/**
 * Single source of truth for how a game can be played.
 *
 * Home, the games list and the play hub all read from here, so a mode is never
 * advertised in one place and missing in another. Availability is derived from
 * the registries rather than hardcoded per screen.
 */
export function getPlayModes(gameId: GameId): PlayMode[] {
  const hasEngine = gameEngineRegistry.has(gameId);
  const hasBot = botRegistry.has(gameId);

  return [
    {
      id: "offline-ai",
      label: "Play vs AI",
      tagline: "Seven difficulty levels, no internet needed",
      needsAuth: false,
      needsInternet: false,
      status: hasEngine && hasBot ? "ready" : "coming-soon",
      ...(hasBot ? {} : { note: "No AI opponent for this game yet" }),
    },
    {
      id: "offline-local",
      label: "Pass & Play",
      tagline: "Two players sharing one device",
      needsAuth: false,
      needsInternet: false,
      status: hasEngine ? "ready" : "coming-soon",
    },
    {
      id: "online-friends",
      label: "Play with a friend",
      tagline: "Share a room code and play online",
      needsAuth: true,
      needsInternet: true,
      status: hasEngine ? "ready" : "coming-soon",
    },
    {
      id: "online-random",
      label: "Quick Match",
      tagline: "Get matched with a player near your level",
      needsAuth: true,
      needsInternet: true,
      status: "coming-soon",
      note: "Matchmaking is not live yet",
    },
    {
      id: "online-ai",
      label: "Online vs AI",
      tagline: "Add an AI opponent to your room",
      needsAuth: true,
      needsInternet: true,
      status: hasEngine && hasBot ? "ready" : "coming-soon",
    },
    {
      id: "lan",
      label: "Same wifi",
      tagline: "Play nearby with no internet at all",
      needsAuth: false,
      needsInternet: false,
      status: "coming-soon",
      note: "Coming later — connects two devices by QR code",
    },
  ];
}

export function readyModes(gameId: GameId): PlayMode[] {
  return getPlayModes(gameId).filter((m) => m.status === "ready");
}

/** True when a game can be played right now without signing in. */
export function isInstantlyPlayable(gameId: GameId): boolean {
  return readyModes(gameId).some((m) => !m.needsAuth);
}
