import type { GameId } from "@playora/game-types";
import { GAME_CATALOG, getCatalogGame, isPlayable, type CatalogGame } from "./catalog";
import { GAME_META, type GameMeta } from "./meta";
import { isSoloGame, modeChipsFor, type PlayModeChip } from "../play/modes";

/**
 * One view-model per game, so a card, a rail, the hero and the detail page all
 * render from the same derived values instead of each re-deriving (and
 * disagreeing about) players, modes and badges.
 */

/** At most one per card, chosen by `badgeFor`. */
export type GameBadge = "live" | "new" | "updated" | "hot";

export const GAME_BADGE_LABEL: Readonly<Record<GameBadge, string>> = {
  live: "Live",
  new: "New",
  updated: "Updated",
  hot: "Hot",
};

/** A game is NEW for this many days after `releasedAt`. */
export const NEW_WINDOW_DAYS = 30;
/** And UPDATED for this many days after `updatedAt`. */
export const UPDATED_WINDOW_DAYS = 14;

export interface GameViewContext {
  /**
   * The moment NEW and UPDATED are judged against.
   *
   * Passed in, never read from the clock here: a view-model that called
   * `Date.now()` itself would let the server and the hydrating client disagree
   * about a badge, and could not be tested at a boundary.
   */
  now: Date | number;
  /** Players in this game right now, when known. Anything above zero shows LIVE. */
  onlineCount?: number;
}

export interface PlayerRange {
  min: number;
  max: number;
}

export interface GameView extends CatalogGame, GameMeta {
  /** Summary chips in display order: Online, vs Bot, Local, Solo, Career. */
  modes: PlayModeChip[];
  /** How many people can actually play, which is not always the catalog's numbers. */
  players: PlayerRange;
  /** `players` as a card shows it: "1P", "2P", "2-4P". */
  playersLabel: string;
  badge: GameBadge | null;
  onlineCount: number;
  playable: boolean;
}

/**
 * The player count a game really supports.
 *
 * The catalog's `minPlayers`/`maxPlayers` are the game's own description, and
 * for the solo arcade titles they describe a party game that has not been
 * built: Bomb Pass says 2-8 and has no networked engine. A card that repeats
 * that number sends people looking for a lobby that does not exist, so a game
 * the capability table says is solo reads as one player here.
 */
export function playerRange(id: GameId): PlayerRange {
  const game = getCatalogGame(id);
  if (!game || isSoloGame(id)) return { min: 1, max: 1 };
  return { min: game.minPlayers, max: game.maxPlayers };
}

export function formatPlayers({ min, max }: PlayerRange): string {
  return min === max ? `${min}P` : `${min}-${max}P`;
}

const DAY_MS = 86_400_000;

/** True when `isoDate` falls in the `days` before `now`. A future date is never inside. */
function withinDays(isoDate: string, now: number, days: number): boolean {
  const age = (now - Date.parse(isoDate)) / DAY_MS;
  return age >= 0 && age < days;
}

/**
 * The single badge a card shows.
 *
 * LIVE beats everything because it is the only one that says something about
 * right now; NEW beats UPDATED because a game a month old has, trivially, been
 * updated recently; HOT is the editorial fallback for featured games that are
 * neither. An unparseable date or `now` simply fails every window.
 */
export function badgeFor(
  meta: Pick<GameMeta, "releasedAt" | "updatedAt" | "featured">,
  { now, onlineCount = 0 }: GameViewContext,
): GameBadge | null {
  if (onlineCount > 0) return "live";
  const t = typeof now === "number" ? now : now.getTime();
  if (withinDays(meta.releasedAt, t, NEW_WINDOW_DAYS)) return "new";
  if (withinDays(meta.updatedAt, t, UPDATED_WINDOW_DAYS)) return "updated";
  if (meta.featured) return "hot";
  return null;
}

/**
 * Everything a component needs to render one game.
 *
 * Pure: the same id and context always give the same view, on the server and
 * in the browser. Throws for an id missing from the catalog, which the catalog
 * tests make impossible for any `GameId`; validate route params with
 * `isGameId` first.
 */
export function gameView(id: GameId, ctx: GameViewContext): GameView {
  const game = getCatalogGame(id);
  if (!game) throw new Error(`gameView: "${id}" is not in GAME_CATALOG`);

  const meta = GAME_META[id];
  const onlineCount =
    typeof ctx.onlineCount === "number" && Number.isFinite(ctx.onlineCount) && ctx.onlineCount > 0
      ? Math.floor(ctx.onlineCount)
      : 0;
  const players = playerRange(id);

  return {
    ...game,
    ...meta,
    modes: modeChipsFor(id),
    players,
    playersLabel: formatPlayers(players),
    badge: badgeFor(meta, { now: ctx.now, onlineCount }),
    onlineCount,
    playable: isPlayable(game),
  };
}

/** Every game's view, in catalog order, with live counts where they are known. */
export function gameViews({
  now,
  onlineCounts = {},
}: {
  now: Date | number;
  onlineCounts?: Partial<Record<GameId, number>>;
}): GameView[] {
  return GAME_CATALOG.map((g) => gameView(g.id, { now, onlineCount: onlineCounts[g.id] }));
}
