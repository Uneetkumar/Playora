import type { AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import type { PlayMode, PlayModeId } from "../../../lib/play/modes";

/**
 * The play box's decisions as plain functions: where each way to play goes,
 * what its toggle and its Play button say, and which presets apply to it.
 *
 * Kept out of the component so the routes can be pinned by a test. They are
 * the contract between this page and everything it launches (/play, /rooms,
 * /lan), and the redesign moved every button that produces them; the test is
 * what says none of them changed.
 */

export function isRacingGame(id: GameId): boolean {
  return id === "car-race" || id === "bike-race";
}

export interface PlaySetup {
  aiLevel: AiLevel;
  /**
   * The racing scenery (`TrackOption.themeKey`), which the race canvas reads
   * back from the URL. Ignored for every other game.
   */
  trackTheme?: string;
}

/**
 * Where Play goes for a mode.
 *
 * `/play` reads `mode` and `level`, and the race canvas reads `theme`;
 * `/rooms` and `/lan` take the game and set everything else up themselves.
 * Racing carries its scenery on every /play route, quick match included,
 * exactly as the page always has.
 */
export function playHref(modeId: PlayModeId, gameId: GameId, { aiLevel, trackTheme }: PlaySetup): string {
  const theme = isRacingGame(gameId) && trackTheme ? `&theme=${trackTheme}` : "";
  switch (modeId) {
    // A solo title has one way in, the same route its card's Play uses.
    case "solo":
      return `/play?game=${gameId}&mode=solo${theme}`;
    case "offline-ai":
      return `/play?game=${gameId}&mode=vs-ai&level=${aiLevel}${theme}`;
    case "offline-career":
      return `/play?game=${gameId}&mode=career${theme}`;
    // Racing's "Time trial" shares this mode id and route: /play turns
    // pass-and-play into a time trial for a race.
    case "offline-local":
      return `/play?game=${gameId}&mode=pass-and-play${theme}`;
    case "online-friends":
      return `/rooms?game=${gameId}`;
    case "online-random":
      return `/play?game=${gameId}&quick=1${theme}`;
    case "lan":
      return `/lan?game=${gameId}&role=host`;
  }
}

export interface ModeCopy {
  /** The mode toggle's label. Short: two of them share a 160px row. */
  option: string;
  /** The Play button's label, which says what pressing it does. */
  action: string;
  /**
   * One sentence on what happens next. Written here rather than read from
   * `PlayMode.tagline`, which describes the mode in general rather than
   * what this button does.
   */
  hint: string;
}

export function modeCopy(modeId: PlayModeId, gameId: GameId): ModeCopy {
  const racing = isRacingGame(gameId);
  switch (modeId) {
    case "solo":
      return { option: "Solo", action: "Play now", hint: "Starts straight away on this device." };
    case "offline-ai":
      return racing
        ? { option: "vs Bot", action: "Race the bots", hint: "A quick race against AI rivals, on this device." }
        : { option: "vs Bot", action: "Play vs bot", hint: "You against a bot, on this device." };
    case "offline-career":
      return {
        option: "Career",
        action: "Start career",
        hint: "Work up the championship ladder: star challenges and unlocks.",
      };
    case "offline-local":
      return racing
        ? { option: "Time trial", action: "Start time trial", hint: "An empty track and the clock." }
        : { option: "Pass & Play", action: "Start pass & play", hint: "Two players take turns on this device." };
    case "online-friends":
      return {
        option: "Private room",
        action: "Create room",
        hint: "Opens a private room you can invite friends or add bots to.",
      };
    case "online-random":
      return { option: "Quick match", action: "Find match", hint: "Pairs you with someone online who is looking for a game." };
    case "lan":
      return {
        option: "Same Wi-Fi",
        action: "Host on Wi-Fi",
        hint: "Hosts a game on this network. Others join by scanning a QR code.",
      };
  }
}

/**
 * The mode selected when the page opens: the first one that works, which is
 * what the page's single Play button has always started. For every game with
 * a bot that is vs Bot, so Play works with no account and no connection.
 */
export function defaultMode(modes: readonly PlayMode[]): PlayMode | undefined {
  return modes.find((m) => m.status === "ready") ?? modes[0];
}

/** Modes that play against a bot whose level the player picks here. */
export function usesBotLevel(modeId: PlayModeId): boolean {
  return modeId === "offline-ai";
}

/**
 * Modes whose race is drawn on this device, so the chosen scenery shows.
 * Quick match still carries `theme` in its URL, but the match itself happens
 * in a room, which never reads it; offering the picker there would be a
 * control that changes nothing.
 */
export function usesTrackTheme(gameId: GameId, modeId: PlayModeId): boolean {
  return (
    isRacingGame(gameId) &&
    (modeId === "offline-ai" || modeId === "offline-career" || modeId === "offline-local")
  );
}

/**
 * Chess's clock, as every way of playing it runs today.
 *
 * Not a choice yet: ChessEngine defaults to 600 seconds and no increment, the
 * local game passes the same 600 (lib/local/use-local-game.ts), and neither
 * rooms, matchmaking nor /play carry a time control to change it. A preset
 * grid here would be buttons that do nothing, so the page states the fact.
 */
export const CHESS_CLOCK = { minutes: 10, incrementSeconds: 0 } as const;
