import type { LucideIcon } from "lucide-react";
import { Car, Dice5, Gamepad2, PartyPopper, Puzzle } from "lucide-react";
import type { GameId } from "@playora/game-types";
import { GAME_META, type GameGenre } from "../../lib/games/meta";
import { sortGames } from "../../lib/games/browse";
import { browseHref } from "../../lib/games/browse-url";
import type { GameView } from "../../lib/games/view";
import type { GameCardVariant } from "../games/card-logic";

/**
 * The home page's genre shelves, as data.
 *
 * Eight browse genres is too many rails for a front page and several hold two
 * or three games, which reads as a broken row. So the shelves pair genres that
 * people come for together: UNO sits with the party games, chess with the
 * board games. Every genre is on exactly one shelf, so nothing in the
 * catalogue is missing from the page, and each shelf's "See all" opens Browse
 * with the same pair of genres selected.
 */

export interface HomeShelfDef {
  id: string;
  title: string;
  genres: readonly GameGenre[];
  icon: LucideIcon;
  /**
   * Racing is two games: as feature cards they fill a desktop row edge to
   * edge, where two small cards would leave most of it empty.
   */
  variant: GameCardVariant;
}

export const HOME_SHELVES: readonly HomeShelfDef[] = [
  { id: "racing", title: "Racing", genres: ["Racing"], icon: Car, variant: "feature" },
  {
    id: "cards-party",
    title: "Cards & Party",
    genres: ["Cards", "Party"],
    icon: PartyPopper,
    variant: "landscape",
  },
  {
    id: "board-strategy",
    title: "Board & Strategy",
    genres: ["Board", "Strategy"],
    icon: Dice5,
    variant: "landscape",
  },
  {
    id: "arcade",
    title: "Arcade & Classics",
    genres: ["Arcade", "Classic"],
    icon: Gamepad2,
    variant: "landscape",
  },
  { id: "puzzle", title: "Puzzle", genres: ["Puzzle"], icon: Puzzle, variant: "landscape" },
];

export interface HomeShelf<T> extends HomeShelfDef {
  games: T[];
  /** Browse, filtered to this shelf's genres. */
  href: string;
}

interface HasId {
  id: GameId;
  name: string;
}

/**
 * The shelves with their games, featured first and then in the catalogue's
 * editorial order (Browse's Popular). A shelf with nothing on it is left out
 * rather than shown as a heading over a gap.
 */
export function homeShelves<T extends HasId>(list: readonly T[]): HomeShelf<T>[] {
  return HOME_SHELVES.map((def) => ({
    ...def,
    games: sortGames(
      list.filter((g) => def.genres.includes(GAME_META[g.id].genre)),
      "popular"
    ),
    href: browseHref({ genres: [...def.genres] }),
  })).filter((shelf) => shelf.games.length > 0);
}

/** How many cards the "New & updated" shelf holds before "See all". */
export const FRESH_LIMIT = 12;

/**
 * Games wearing a NEW or UPDATED badge, newest release first: the shelf a
 * returning player scans for what changed since last time. Read from the
 * view's badge, so the shelf and the cards on it can never disagree.
 */
export function freshGames(views: readonly GameView[], limit = FRESH_LIMIT): GameView[] {
  return sortGames(
    views.filter((g) => g.playable && (g.badge === "new" || g.badge === "updated")),
    "new"
  ).slice(0, limit);
}
