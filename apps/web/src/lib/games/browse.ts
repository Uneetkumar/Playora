import type { GameId } from "@playora/game-types";
import { GAME_CATALOG, getCatalogGame, searchGames, type CatalogGame } from "./catalog";
import { GAME_GENRES, GAME_META, type GameGenre } from "./meta";
import { playerRange, type PlayerRange } from "./view";
import { PLAY_MODE_CHIPS, modeChipsFor, type PlayModeChip, type PlayModeChipId } from "../play/modes";

/**
 * Filtering, sorting and grouping for rails and the browse page.
 *
 * Every helper takes the list it works on (the whole catalog by default) and
 * returns a new array, so a page can chain filter → sort over catalog games or
 * over `GameView`s alike without either being mutated.
 */

export const PLAYERS_FILTERS = [
  { id: "1p", label: "1P" },
  { id: "2p", label: "2P" },
  { id: "2-4p", label: "2-4P" },
  { id: "party", label: "Party" },
] as const;

export type PlayersFilter = (typeof PLAYERS_FILTERS)[number]["id"];

/**
 * Who can sit down to play, judged on the real player range (`playerRange`),
 * not the catalog's advertised one.
 *
 * The buckets are group sizes: on your own, a duel, a small group, a crowd.
 * "2-4P" is a game that takes three or four, so a two-only game like chess
 * lives under 2P rather than turning up in every bucket. "Party" is five or
 * more — which is why the solo party-themed arcade games do not appear there:
 * none of them can actually seat five people yet.
 */
const PLAYERS_MATCH: Record<PlayersFilter, (r: PlayerRange) => boolean> = {
  "1p": (r) => r.min === 1,
  "2p": (r) => r.min <= 2 && r.max >= 2,
  "2-4p": (r) => r.min <= 4 && r.max >= 3,
  party: (r) => r.max >= 5,
};

/**
 * The mode filters are the mode chips without Career, which only the two
 * racing games have and the Racing genre already finds.
 */
export type ModeFilter = Exclude<PlayModeChipId, "career">;

export const MODE_FILTERS: readonly (PlayModeChip & { id: ModeFilter })[] = PLAY_MODE_CHIPS.filter(
  (chip): chip is PlayModeChip & { id: ModeFilter } => chip.id !== "career",
);

export const GAME_SORTS = [
  { id: "popular", label: "Popular" },
  { id: "new", label: "New" },
  { id: "az", label: "A–Z" },
] as const;

export type GameSort = (typeof GAME_SORTS)[number]["id"];

/* Guards for values read back from the URL. */

export function isPlayersFilter(value: unknown): value is PlayersFilter {
  return PLAYERS_FILTERS.some((f) => f.id === value);
}

export function isModeFilter(value: unknown): value is ModeFilter {
  return MODE_FILTERS.some((f) => f.id === value);
}

export function isGameSort(value: unknown): value is GameSort {
  return GAME_SORTS.some((s) => s.id === value);
}

/** Absent, null and empty all mean "any", so URL params can be passed straight in. */
export interface GameFilters {
  genre?: GameGenre | null;
  players?: PlayersFilter | null;
  mode?: ModeFilter | null;
  q?: string | null;
}

interface HasId {
  id: GameId;
}

const CATALOG_INDEX: ReadonlyMap<GameId, number> = new Map(GAME_CATALOG.map((g, i) => [g.id, i]));

/** The catalog's own order, which is editorial, as the last tie-breaker everywhere. */
function byCatalogOrder(a: HasId, b: HasId): number {
  return (CATALOG_INDEX.get(a.id) ?? Infinity) - (CATALOG_INDEX.get(b.id) ?? Infinity);
}

/**
 * The games matching every filter given.
 *
 * With a query, results come back in search relevance order (the same ranking
 * the header search uses); without one, in the order of `list`.
 */
export function filterGames(filters: GameFilters): CatalogGame[];
export function filterGames<T extends HasId>(filters: GameFilters, list: readonly T[]): T[];
export function filterGames(filters: GameFilters, list: readonly HasId[] = GAME_CATALOG): HasId[] {
  const { genre, players, mode } = filters;
  const q = filters.q?.trim() ?? "";

  const matched = list.filter(
    (g) =>
      (!genre || GAME_META[g.id].genre === genre) &&
      (!players || PLAYERS_MATCH[players](playerRange(g.id))) &&
      (!mode || modeChipsFor(g.id).some((chip) => chip.id === mode)),
  );
  if (!q) return matched;

  const rank = new Map(searchGames(q).map((g, i) => [g.id, i]));
  return matched
    .filter((g) => rank.has(g.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

export interface SortContext {
  /** Live player counts, when known. They lead "popular". */
  onlineCounts?: Partial<Record<GameId, number>>;
}

/**
 * A sorted copy of `list`.
 *
 * "popular" has no play-count data behind it yet, so it is live players where
 * the caller has them, then featured games, then the catalog's editorial
 * order. "new" is by release, newest first; "az" by name, with numbers in
 * numeric order.
 */
export function sortGames<T extends HasId & { name: string }>(
  list: readonly T[],
  sort: GameSort,
  { onlineCounts = {} }: SortContext = {},
): T[] {
  const sorted = [...list];
  switch (sort) {
    case "az":
      return sorted.sort(
        (a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }) ||
          byCatalogOrder(a, b),
      );
    case "new":
      return sorted.sort(
        (a, b) =>
          GAME_META[b.id].releasedAt.localeCompare(GAME_META[a.id].releasedAt) ||
          GAME_META[b.id].updatedAt.localeCompare(GAME_META[a.id].updatedAt) ||
          byCatalogOrder(a, b),
      );
    case "popular":
      return sorted.sort(
        (a, b) =>
          (onlineCounts[b.id] ?? 0) - (onlineCounts[a.id] ?? 0) ||
          Number(GAME_META[b.id].featured) - Number(GAME_META[a.id].featured) ||
          byCatalogOrder(a, b),
      );
  }
}

export interface GenreShelf<T> {
  genre: GameGenre;
  games: T[];
}

/** One shelf per genre, in `GAME_GENRES` order. Empty genres are left out so no rail renders bare. */
export function gamesByGenre(): GenreShelf<CatalogGame>[];
export function gamesByGenre<T extends HasId>(list: readonly T[]): GenreShelf<T>[];
export function gamesByGenre(list: readonly HasId[] = GAME_CATALOG): GenreShelf<HasId>[] {
  return GAME_GENRES.map((genre) => ({
    genre,
    games: list.filter((g) => GAME_META[g.id].genre === genre),
  })).filter((shelf) => shelf.games.length > 0);
}

/** Overlap over union: 1 for identical sets, 0 for disjoint ones. */
function jaccard<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): number {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** The same, for two inclusive player ranges. */
function rangeOverlap(a: PlayerRange, b: PlayerRange): number {
  const shared = Math.min(a.max, b.max) - Math.max(a.min, b.min) + 1;
  const union = Math.max(a.max, b.max) - Math.min(a.min, b.min) + 1;
  return shared > 0 ? shared / union : 0;
}

/**
 * The `n` games most like `id`, for the detail page's "Similar games" rail.
 *
 * Genre counts most (4), then each shared tag (1), then how alike the ways to
 * play are (up to 3) and how alike the player counts are (up to 2). Modes and
 * players are compared as overlap ratios rather than counted, because the
 * tags alone over-reward generic words: by tags, Memory Match ("cards",
 * "casual", "family") is closer to UNO than UNO No Mercy is, and nobody
 * looking at UNO wants a solo memory game before the online one.
 *
 * Always fills `n` while there are games left, because a rail with two cards
 * in it looks broken; never includes the game itself.
 */
export function similarGames(id: GameId, n = 6): CatalogGame[] {
  const self = getCatalogGame(id);
  if (!self || n <= 0) return [];

  const genre = GAME_META[id].genre;
  const tags = new Set(self.tags);
  const modes = new Set(modeChipsFor(id).map((chip) => chip.id));
  const range = playerRange(id);

  const score = (g: CatalogGame): number =>
    (GAME_META[g.id].genre === genre ? 4 : 0) +
    g.tags.filter((t) => tags.has(t)).length +
    3 * jaccard(modes, new Set(modeChipsFor(g.id).map((chip) => chip.id))) +
    2 * rangeOverlap(range, playerRange(g.id));

  return GAME_CATALOG.filter((g) => g.id !== id)
    .map((game) => ({ game, score: score(game) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(GAME_META[b.game.id].featured) - Number(GAME_META[a.game.id].featured) ||
        byCatalogOrder(a.game, b.game),
    )
    .slice(0, n)
    .map((s) => s.game);
}
