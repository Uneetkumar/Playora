import type { LucideIcon } from "lucide-react";
import {
  Award,
  Car,
  Crown,
  Dice5,
  Gamepad2,
  History,
  Home,
  Joystick,
  LayoutGrid,
  PartyPopper,
  Puzzle,
  Settings,
  ShieldAlert,
  Spade,
  Swords,
  Trophy,
  UserRound,
  Users,
  Wifi,
} from "lucide-react";
import type { GameGenre } from "../../lib/games/meta";
import { gamesByGenre } from "../../lib/games/browse";

/**
 * The platform's navigation, in one place.
 *
 * The sidebar, the mobile menu sheet and the bottom tab bar used to keep a
 * list each, and they had drifted: the same page was "Rooms", "Rooms &
 * Matches" and missing, depending on where you looked, and none of them
 * linked to the catalogue at all. Every surface now derives from these
 * entries, so a label or a destination changes once.
 *
 * Plain data: no React, so it can be read anywhere, including tests.
 */

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Where room is short (the bottom tab bar). Defaults to `label`. */
  shortLabel?: string;
}

export const NAV = {
  home: { id: "home", label: "Home", href: "/", icon: Home },
  browse: { id: "browse", label: "Browse", href: "/games", icon: LayoutGrid },
  rooms: { id: "rooms", label: "Play with friends", shortLabel: "Rooms", href: "/rooms", icon: Swords },
  lan: { id: "lan", label: "Same Wi-Fi", shortLabel: "Wi-Fi", href: "/lan", icon: Wifi },
  friends: { id: "friends", label: "Friends", href: "/friends", icon: Users },
  leaderboard: { id: "leaderboard", label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  achievements: { id: "achievements", label: "Achievements", href: "/achievements", icon: Award },
  history: { id: "history", label: "History", href: "/history", icon: History },
  profile: { id: "profile", label: "Profile", href: "/profile", icon: UserRound },
  settings: { id: "settings", label: "Settings", href: "/settings", icon: Settings },
  /** Only offered to staff (`useStaffRole`); the database is what enforces it. */
  staff: { id: "staff", label: "Staff", href: "/admin", icon: ShieldAlert },
} as const satisfies Record<string, NavItem>;

export interface NavSection {
  id: string;
  /** Visible heading. The first section has none: it is the app's main menu. */
  label?: string;
  items: readonly NavItem[];
}

/**
 * The main menu, as the sidebar and the menu sheet show it: where to play
 * first, then everything about you. Settings is not here because both
 * surfaces pin it to their footer, beside the theme switch.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  { id: "play", items: [NAV.home, NAV.browse, NAV.rooms, NAV.lan] },
  {
    id: "you",
    label: "You",
    items: [NAV.friends, NAV.leaderboard, NAV.achievements, NAV.history, NAV.profile],
  },
];

/** lucide icons for the browse genres, for anything that lists them. */
export const GENRE_ICONS: Readonly<Record<GameGenre, LucideIcon>> = {
  Racing: Car,
  Cards: Spade,
  Board: Dice5,
  Strategy: Crown,
  Party: PartyPopper,
  Arcade: Gamepad2,
  Puzzle: Puzzle,
  Classic: Joystick,
};

export interface GenreNavItem extends NavItem {
  genre: GameGenre;
  /** Games in the genre, shown beside the label. */
  count: number;
}

export function genreHref(genre: GameGenre): string {
  return `/games?genre=${encodeURIComponent(genre)}`;
}

/**
 * One shortcut per genre that has games, in the browse order. Built from
 * `gamesByGenre`, so a genre with nothing in it never gets a dead link.
 */
export const GENRE_NAV: readonly GenreNavItem[] = gamesByGenre().map(({ genre, games }) => ({
  id: `genre-${genre.toLowerCase()}`,
  label: genre,
  href: genreHref(genre),
  icon: GENRE_ICONS[genre],
  genre,
  count: games.length,
}));

/**
 * The bottom tab bar, phones only. Play sits in the middle and is not a
 * link: it opens the quick-play sheet, since "play what, how?" is a choice
 * rather than a page.
 */
export const BOTTOM_TABS = {
  start: [NAV.home, NAV.browse],
  end: [NAV.friends, NAV.profile],
} as const;

/**
 * Whether `item` is the page being shown.
 *
 * Home matches only itself. Browse owns the catalogue and every game page
 * under it, except while genre shortcuts are the active ones, so the sidebar
 * never lights Browse as well as a genre for one page. Browse filters by
 * several genres at once (`?genre=Cards&genre=Party`), and each selected
 * genre's shortcut is lit. Everything else matches its own path and anything
 * nested under it.
 */
export function isNavActive(
  item: Pick<NavItem, "href">,
  pathname: string,
  activeGenres: readonly GameGenre[] = [],
): boolean {
  const [path = "/", query] = item.href.split("?");
  if (query) {
    const genre = new URLSearchParams(query).get("genre");
    return pathname === path && genre !== null && activeGenres.some((g) => g === genre);
  }
  if (path === "/") return pathname === "/";
  if (path === NAV.browse.href && activeGenres.length > 0 && pathname === path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Game routes own the whole viewport: the game, its own top bar, nothing of
 * the platform around it. A room's lobby counts, since the lobby and the
 * match are one page.
 */
export function isImmersiveRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/play" ||
    pathname.startsWith("/play/") ||
    (pathname.startsWith("/rooms/") && pathname.length > "/rooms/".length)
  );
}
