import { botRegistry } from "@playora/bot-engine";
import { gameEngineRegistry, levelsFor } from "@playora/game-engine";
import type { GameId } from "@playora/game-types";

export type PlayModeId =
  /** The whole game, for one person. Solo titles offer nothing else. */
  | "solo"
  | "offline-ai"
  | "offline-career"
  | "offline-local"
  | "online-friends"
  | "online-random"
  | "lan";

export interface PlayMode {
  id: PlayModeId;
  label: string;
  /** One factual line on the mode: what it is, not how it feels. */
  tagline: string;
  /** Sign-in required. Guest counts as signed in. */
  needsAuth: boolean;
  needsInternet: boolean;
  status: "ready" | "coming-soon";
  /** Shown when the mode is not yet playable, so the UI never dead-ends. */
  note?: string;
}

/**
 * What a game can genuinely do.
 *
 * This exists because the previous version offered every implemented game all
 * six modes — Quick Match, private rooms, LAN and an AI opponent — including
 * the ten arcade titles that are local React views with no server engine and
 * no bot behind them. Those buttons could not work: choosing Quick Match for
 * Ant Attack queued a player for a match no server knows how to run.
 *
 * A mode is offered only when something can actually service it. `online`
 * means a server-authoritative engine exists, which is what rooms, matchmaking
 * and LAN all rely on; `ai` means a bot implementation exists; `passAndPlay`
 * means handing one device between two people is a real way to play, which is
 * true of a turn-based board game and false of a reaction game.
 */
export interface GameCapabilities {
  online: boolean;
  ai: boolean;
  passAndPlay: boolean;
  /** The racing career ladder. */
  career: boolean;
}

const SOLO: GameCapabilities = { online: false, ai: false, passAndPlay: false, career: false };

/**
 * Capabilities per game.
 *
 * Deliberately an explicit table rather than something derived from the
 * catalogue's `maxPlayers`, which is a marketing number: Bomb Pass advertises
 * "2-8 players" and has no networked engine at all. A table can be checked
 * against reality; a derived guess quietly re-introduces the bug.
 */
const CAPABILITIES: Partial<Record<GameId, GameCapabilities>> = {
  // Full server engines with bots.
  chess: { online: true, ai: true, passAndPlay: true, career: false },
  uno: { online: true, ai: true, passAndPlay: true, career: false },
  "uno-no-mercy": { online: true, ai: true, passAndPlay: true, career: false },

  // Racing: networked, has AI rivals and a career ladder. Pass & play makes no
  // sense — two people cannot share one steering wheel — so it is a time trial
  // instead, which the mode list handles separately.
  "car-race": { online: true, ai: true, passAndPlay: false, career: true },
  "bike-race": { online: true, ai: true, passAndPlay: false, career: true },

  // Local arcade views. Playable and finished, but single-player: no engine
  // package, no bot, nothing for a room to run.
  "rope-rescue": SOLO,
  "ant-attack": SOLO,
  "bomb-pass": SOLO,
  "color-rush": SOLO,
  "falling-floor": SOLO,
  "pin-puzzle": SOLO,
  "target-rush": SOLO,
  "hot-potato": SOLO,
  "bridge-builder": SOLO,
  "ice-breaker": SOLO,

  // Tabletop & board games with Pass & Play and AI options
  "tic-tac-toe": { online: false, ai: true, passAndPlay: true, career: false },
  "connect-four": { online: false, ai: true, passAndPlay: true, career: false },
  "ludo": { online: false, ai: true, passAndPlay: true, career: false },
  "snake-ladder": { online: false, ai: true, passAndPlay: true, career: false },
  "checkers": { online: false, ai: true, passAndPlay: true, career: false },
  "battleship": { online: false, ai: true, passAndPlay: false, career: false },
  "pong": { online: false, ai: true, passAndPlay: true, career: false },
  "memory-match": { online: false, ai: true, passAndPlay: true, career: false },

  // Solo puzzle & arcade titles
  "game-2048": SOLO,
  "minesweeper": SOLO,
  "word-guess": SOLO,
  "flappy-bird": SOLO,
  "retro-snake": SOLO,
  "brick-breaker": SOLO,
  "whack-a-mole": SOLO,
  "simon-says": SOLO,
};

export function capabilitiesFor(gameId: GameId): GameCapabilities | null {
  return CAPABILITIES[gameId] ?? null;
}

/**
 * A game that is played alone, on this device, with no opponent of any kind.
 *
 * Derived rather than listed. The same set was previously hardcoded in both
 * `app/play/page.tsx` and `app/lan/page.tsx`, so adding a game meant
 * remembering three places — and the third, this module, disagreed with the
 * other two about what those games could do.
 */
export function isSoloGame(gameId: GameId): boolean {
  const caps = capabilitiesFor(gameId);
  return caps !== null && !caps.online && !caps.ai && !caps.passAndPlay && !caps.career;
}

/** True when the game has any form of multiplayer worth offering. */
export function isMultiplayer(gameId: GameId): boolean {
  return capabilitiesFor(gameId)?.online ?? false;
}

/**
 * Single source of truth for how a game can be played.
 *
 * Returns only modes the game can actually service. A solo title gets exactly
 * one entry — "Play" — rather than a grid of six buttons, five of which lead
 * nowhere.
 */
export function getPlayModes(gameId: GameId): PlayMode[] {
  const caps = capabilitiesFor(gameId);
  if (!caps) {
    return [
      {
        id: "solo",
        label: "Play",
        tagline: "This game is not available yet",
        needsAuth: false,
        needsInternet: false,
        status: "coming-soon",
        note: "No engine for this game yet",
      },
    ];
  }

  const isRace = gameId === "car-race" || gameId === "bike-race";
  const list: PlayMode[] = [];

  // A game with nothing but itself gets one honest button.
  if (!caps.online && !caps.ai && !caps.passAndPlay && !caps.career) {
    return [
      {
        id: "solo",
        label: "Play",
        tagline: "Plays on this device, no account needed",
        needsAuth: false,
        needsInternet: false,
        status: "ready",
      },
    ];
  }

  if (caps.ai) {
    list.push({
      id: "offline-ai",
      label: "Play vs AI",
      // Not "seven levels": several board games have a single bot, or fold
      // the seven onto their own easy / medium / hard.
      tagline: isRace
        ? "A quick race against AI rivals at the level you pick"
        : "You against the computer, on this device",
      needsAuth: false,
      needsInternet: false,
      status: "ready",
    });
  }

  if (caps.career) {
    list.push({
      id: "offline-career",
      label: "Career Mode",
      tagline: `${levelsFor(gameId).length} races against a growing field, each unlocking the next`,
      needsAuth: false,
      needsInternet: false,
      status: "ready",
    });
  }

  if (caps.passAndPlay) {
    list.push({
      id: "offline-local",
      label: "Pass & Play",
      tagline: "Two players sharing one device",
      needsAuth: false,
      needsInternet: false,
      status: "ready",
    });
  } else if (isRace) {
    // Racing's solo-on-one-device equivalent is the clock, not a shared pad.
    list.push({
      id: "offline-local",
      label: "Time trial",
      tagline: "An empty track and the clock",
      needsAuth: false,
      needsInternet: false,
      status: "ready",
    });
  }

  if (caps.online) {
    list.push(
      {
        id: "online-friends",
        label: "Play with a friend",
        tagline: "Create a private room, invite friends, or add AI bots",
        needsAuth: true,
        needsInternet: true,
        status: "ready",
      },
      {
        id: "online-random",
        label: "Quick Match",
        tagline: "Get matched with a player near your level",
        needsAuth: true,
        needsInternet: true,
        status: "ready",
      },
      {
        id: "lan",
        label: "Same Wi-Fi",
        tagline: "One device hosts on your network; the others scan its QR code to join",
        needsAuth: false,
        needsInternet: false,
        status: "ready",
      },
    );
  }

  return list;
}

/** The one-word summary of a way to play, as cards and filters show it. */
export type PlayModeChipId = "online" | "ai" | "local" | "solo" | "career";

export interface PlayModeChip {
  id: PlayModeChipId;
  label: string;
}

/** Display order is this order. */
export const PLAY_MODE_CHIPS: readonly PlayModeChip[] = [
  { id: "online", label: "Online" },
  { id: "ai", label: "vs Bot" },
  { id: "local", label: "Local" },
  { id: "solo", label: "Solo" },
  { id: "career", label: "Career" },
];

/**
 * The modes a game offers, summarised to chips for a card or a filter.
 *
 * Read from the capability table, so a chip is shown only for something that
 * can be serviced — the same rule `getPlayModes` follows. "Local" means two
 * people on one device, which is why racing does not get it: its offline
 * entry is a time trial, not a shared pad. "Solo" marks a game that is only
 * ever played alone, so it never appears beside "vs Bot".
 */
export function modeChipsFor(gameId: GameId): PlayModeChip[] {
  const caps = capabilitiesFor(gameId);
  if (!caps) return [];
  const has: Record<PlayModeChipId, boolean> = {
    online: caps.online,
    ai: caps.ai,
    local: caps.passAndPlay,
    solo: isSoloGame(gameId),
    career: caps.career,
  };
  return PLAY_MODE_CHIPS.filter((chip) => has[chip.id]);
}

export function readyModes(gameId: GameId): PlayMode[] {
  return getPlayModes(gameId).filter((m) => m.status === "ready");
}

/** True when a game can be played right now without signing in. */
export function isInstantlyPlayable(gameId: GameId): boolean {
  return readyModes(gameId).some((m) => !m.needsAuth);
}

/**
 * Whether a game has anything playable behind it.
 *
 * The registries are consulted as well as the table because they are populated
 * at runtime and can carry an engine the table has not been told about yet;
 * the table alone can never produce a false negative for the games it lists.
 */
export function isGameImplemented(gameId: GameId): boolean {
  return (
    CAPABILITIES[gameId] !== undefined ||
    gameEngineRegistry.has(gameId) ||
    botRegistry.has(gameId)
  );
}
