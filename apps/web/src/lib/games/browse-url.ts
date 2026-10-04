import type { GameId } from "@playora/game-types";
import { GAME_GENRES, GAME_META, type GameGenre } from "./meta";
import {
  filterGames,
  isGameSort,
  isModeFilter,
  isPlayersFilter,
  sortGames,
  type GameSort,
  type ModeFilter,
  type PlayersFilter,
} from "./browse";

/**
 * The browse page's state as it lives in the URL, so a filtered catalogue can
 * be bookmarked, shared, and reached from anywhere that links to it: the
 * sidebar's genre shortcuts (`?genre=Racing`), the home page's shelves
 * (`?genre=Cards&genre=Party`), the site search action (`?q=`).
 *
 * Plain functions over plain data, so the page, the home shelves and the tests
 * all agree on one spelling of every link.
 */

export interface BrowseState {
  /** In `GAME_GENRES` order, without repeats. Empty means every genre. */
  genres: GameGenre[];
  players: PlayersFilter | null;
  mode: ModeFilter | null;
  /**
   * The order the player chose. `null` is the default: search relevance while
   * there is a query, Popular otherwise.
   */
  sort: GameSort | null;
  q: string;
}

export const EMPTY_BROWSE: BrowseState = {
  genres: [],
  players: null,
  mode: null,
  sort: null,
  q: "",
};

/** Anything longer is not a game name, and would only bloat a shared link. */
export const MAX_QUERY_LENGTH = 64;

/** The part of `URLSearchParams` (and Next's read-only version) this reads. */
export interface ParamReader {
  get(name: string): string | null;
  getAll(name: string): string[];
}

const GENRE_BY_LOWER: ReadonlyMap<string, GameGenre> = new Map(
  GAME_GENRES.map((g) => [g.toLowerCase(), g])
);

/**
 * State from the URL. Lenient about what people type or paste: genres in any
 * case, repeated or comma-separated; anything unknown is dropped rather than
 * failing the page, because a stale shared link should still land somewhere.
 */
export function parseBrowseParams(params: ParamReader | null | undefined): BrowseState {
  if (!params) return EMPTY_BROWSE;

  const asked = new Set(
    params
      .getAll("genre")
      .flatMap((v) => v.split(","))
      .map((v) => GENRE_BY_LOWER.get(v.trim().toLowerCase()))
      .filter((g): g is GameGenre => g !== undefined)
  );
  const players = params.get("players");
  const mode = params.get("mode");
  const sort = params.get("sort");

  return {
    genres: GAME_GENRES.filter((g) => asked.has(g)),
    players: isPlayersFilter(players) ? players : null,
    mode: isModeFilter(mode) ? mode : null,
    sort: isGameSort(sort) ? sort : null,
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
  };
}

/** The order results are actually in. */
export function effectiveSort(state: Pick<BrowseState, "sort" | "q">): GameSort | "relevance" {
  return state.sort ?? (state.q.trim() ? "relevance" : "popular");
}

/**
 * The query string for a state, without the `?`, in a fixed order so equal
 * states always give equal URLs. Defaults are left out: an untouched page is
 * plain `/games`, and Popular is only written when a search would otherwise
 * have ordered by relevance.
 */
export function serializeBrowseState(state: BrowseState): string {
  const params = new URLSearchParams();
  const q = state.q.trim().slice(0, MAX_QUERY_LENGTH);
  if (q) params.set("q", q);
  for (const genre of GAME_GENRES) if (state.genres.includes(genre)) params.append("genre", genre);
  if (state.players) params.set("players", state.players);
  if (state.mode) params.set("mode", state.mode);
  if (state.sort && !(state.sort === "popular" && !q)) params.set("sort", state.sort);
  return params.toString();
}

export function browseHref(state: Partial<BrowseState> = {}): string {
  const query = serializeBrowseState({ ...EMPTY_BROWSE, ...state });
  return query ? `/games?${query}` : "/games";
}

/** True when anything narrows the list. The order is not a filter. */
export function hasFilters(state: BrowseState): boolean {
  return (
    state.genres.length > 0 ||
    state.players !== null ||
    state.mode !== null ||
    state.q.trim() !== ""
  );
}

/** Adds the genre if it is off, removes it if it is on, keeping `GAME_GENRES` order. */
export function toggleGenre(genres: readonly GameGenre[], genre: GameGenre): GameGenre[] {
  const next = new Set(genres);
  if (next.has(genre)) next.delete(genre);
  else next.add(genre);
  return GAME_GENRES.filter((g) => next.has(g));
}

interface HasId {
  id: GameId;
  name: string;
}

/**
 * The games a state shows, in the order it shows them.
 *
 * Genres are an "any of" set, applied here; everything else is `filterGames`,
 * so the page cannot drift from what the rails and search consider a match.
 */
export function browseResults<T extends HasId>(state: BrowseState, list: readonly T[]): T[] {
  const inGenres =
    state.genres.length === 0
      ? list
      : list.filter((g) => state.genres.includes(GAME_META[g.id].genre));
  const matched = filterGames({ players: state.players, mode: state.mode, q: state.q }, inGenres);
  const sort = effectiveSort(state);
  return sort === "relevance" ? matched : sortGames(matched, sort);
}

/**
 * How many games each genre chip would show with the other filters as they
 * are, so a count never promises games the grid will not have.
 */
export function genreCounts(state: BrowseState, list: readonly HasId[]): Record<GameGenre, number> {
  const counts = Object.fromEntries(GAME_GENRES.map((g) => [g, 0])) as Record<GameGenre, number>;
  for (const game of filterGames({ players: state.players, mode: state.mode, q: state.q }, list)) {
    counts[GAME_META[game.id].genre] += 1;
  }
  return counts;
}
