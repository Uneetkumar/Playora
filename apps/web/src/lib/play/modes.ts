import { botRegistry } from "@playora/bot-engine";
import { gameEngineRegistry } from "@playora/game-engine";
import type { GameId } from "@playora/game-types";

export type PlayModeId =
  | "offline-ai"
  | "offline-career"
  | "offline-local"
  | "online-friends"
  | "online-random"
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
 * Games that have a full engine + bot implementation.
 *
 * The engine/bot registries are singletons that are initialized when the
 * server bundle runs. On the client, those packages may not re-execute their
 * side-effects, so `gameEngineRegistry.has()` can silently return false even
 * though the game is perfectly playable. Maintaining this whitelist alongside
 * the registry is the simplest fix that never produces a false negative.
 */
const IMPLEMENTED_GAMES = new Set<GameId>([
  "chess",
  "uno",
  "uno-no-mercy",
  "car-race",
  "bike-race",
  "rope-rescue",
  "ant-attack",
  "bomb-pass",
  "color-rush",
  "falling-floor",
  "pin-puzzle",
  "target-rush",
  "hot-potato",
  "bridge-builder",
  "ice-breaker",
]);

/**
 * Single source of truth for how a game can be played.
 */
export function getPlayModes(gameId: GameId): PlayMode[] {
  // A game is considered implemented if it is in the whitelist OR the runtime
  // registries confirm it (the latter catches dynamically registered engines).
  const hasEngine = IMPLEMENTED_GAMES.has(gameId) || gameEngineRegistry.has(gameId);
  const hasBot = IMPLEMENTED_GAMES.has(gameId) || botRegistry.has(gameId);
  const isRace = gameId === "car-race" || gameId === "bike-race";

  const list: PlayMode[] = [
    {
      id: "offline-ai",
      label: "Play vs AI",
      tagline: isRace
        ? "Quick race against AI rivals with chosen difficulty"
        : "Seven difficulty levels, no internet needed",
      needsAuth: false,
      needsInternet: false,
      status: hasEngine && hasBot ? "ready" : "coming-soon",
      ...(hasBot ? {} : { note: "No AI opponent for this game yet" }),
    },
  ];

  if (isRace) {
    list.push({
      id: "offline-career",
      label: "Career Mode",
      tagline: "8 championship circuits, star challenges, and unlocks",
      needsAuth: false,
      needsInternet: false,
      status: "ready",
    });
  }

  list.push(
    {
      id: "offline-local",
      label: isRace ? "Time trial" : "Pass & Play",
      tagline: isRace
        ? "An empty track and the clock"
        : "Two players sharing one device",
      needsAuth: false,
      needsInternet: false,
      status: hasEngine ? "ready" : "coming-soon",
    },
    {
      id: "online-friends",
      label: "Play with a friend",
      tagline: "Create a private room, invite friends, or add AI bots",
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
      status: hasEngine ? "ready" : "coming-soon",
    },
    {
      id: "lan",
      label: "Same wifi",
      tagline: "Direct local network play with 0ms lag — scan QR code to join",
      needsAuth: false,
      needsInternet: false,
      status: hasEngine ? "ready" : "coming-soon",
    }
  );

  return list;
}

export function readyModes(gameId: GameId): PlayMode[] {
  return getPlayModes(gameId).filter((m) => m.status === "ready");
}

/** True when a game can be played right now without signing in. */
export function isInstantlyPlayable(gameId: GameId): boolean {
  return readyModes(gameId).some((m) => !m.needsAuth);
}

/**
 * Whether a game has an engine behind it.
 */
export function isGameImplemented(gameId: GameId): boolean {
  return IMPLEMENTED_GAMES.has(gameId) || gameEngineRegistry.has(gameId);
}
