import type { GameId } from "@playora/game-types";
import { FEATURED_GAME_IDS, type GameCovers } from "../../lib/games/meta";
import {
  GAME_BADGE_LABEL,
  gameView,
  type GameBadge,
  type GameView,
  type GameViewContext,
  type PlayerRange,
} from "../../lib/games/view";

/**
 * The decisions behind a game card, the rails and the hero, as plain
 * functions: which badge, which cover and where to crop it, what the
 * `sizes` attribute says, what a screen reader hears, where Play goes.
 *
 * Kept out of the components so each rule is tested once, without a DOM, and
 * so the card, the hero and the detail page cannot each grow their own idea
 * of what a card's label or a game's Play link is.
 */

export type GameCardVariant = "landscape" | "portrait" | "square" | "feature";

/**
 * `rail`: a fixed width, for a horizontally scrolling row (`shrink-0`).
 * `grid`: the full width of whatever cell it is in.
 */
export type GameCardLayout = "rail" | "grid";

export const GAME_CARD_VARIANTS: readonly GameCardVariant[] = ["landscape", "portrait", "square", "feature"];

/* ─── Badge ─────────────────────────────────────────────────────────────── */

/**
 * What the badge slot can show: the view's own badge, plus SOON (derived from
 * `playable`, which `badgeFor` does not see) and TOP (a ranking the caller
 * knows about and the catalogue does not).
 */
export type CardBadgeKind = GameBadge | "soon" | "top";

export interface CardBadge {
  kind: CardBadgeKind;
  /** What the badge says. Uppercased by the badge's own style. */
  label: string;
  /** The live count, already formatted, shown beside LIVE. */
  count?: string;
  /** The same thing as a sentence fragment, for screen readers. */
  spoken: string;
}

/**
 * Online counts as a badge shows them: exact under a thousand, then one
 * decimal of thousands, then whole thousands, then millions.
 *
 * Rounded down rather than to nearest, so a badge never claims a crowd that is
 * not there: 1,999 players reads "1.9k", not "2k".
 */
export function formatOnlineCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const whole = Math.floor(n);
  if (whole < 1_000) return String(whole);
  if (whole < 10_000) return `${trimZero(Math.floor(whole / 100) / 10)}k`;
  if (whole < 1_000_000) return `${Math.floor(whole / 1_000)}k`;
  return `${trimZero(Math.floor(whole / 100_000) / 10)}M`;
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * The one badge a card wears.
 *
 * SOON comes first because nothing else can be true of a game that cannot be
 * played: it has no players, and calling it NEW would send people to a dead
 * end. After that the view's badge stands as `badgeFor` chose it, so the card
 * never re-decides the priority (docs/DESIGN_SYSTEM.md, "Badges").
 */
export function cardBadge(game: Pick<GameView, "badge" | "playable" | "onlineCount">): CardBadge | null {
  if (!game.playable) return { kind: "soon", label: "Soon", spoken: "coming soon" };
  switch (game.badge) {
    case null:
      return null;
    case "live": {
      const count = formatOnlineCount(game.onlineCount);
      return {
        kind: "live",
        label: GAME_BADGE_LABEL.live,
        count,
        spoken: `live, ${game.onlineCount.toLocaleString("en")} playing`,
      };
    }
    default:
      return {
        kind: game.badge,
        label: GAME_BADGE_LABEL[game.badge],
        spoken: GAME_BADGE_LABEL[game.badge].toLowerCase(),
      };
  }
}

/** A TOP badge, for a rail that ranks (a leaderboard shelf, "Top this week"). */
export function topBadge(rank: number): CardBadge {
  return { kind: "top", label: `Top ${rank}`, spoken: `number ${rank}` };
}

/* ─── Cover ─────────────────────────────────────────────────────────────── */

/**
 * Where to crop a landscape cover when it has to fill a different shape.
 *
 * The art is composed for 16:9 with the subject centred, so a portrait or
 * square crop keeps the middle. The feature card sits a little high, because
 * its bottom third is under the scrim and the description.
 */
export const COVER_POSITION: Readonly<Record<GameCardVariant, string>> = {
  landscape: "50% 50%",
  feature: "50% 40%",
  portrait: "50% 45%",
  square: "50% 50%",
};

export interface CoverChoice {
  src: string;
  /** For `object-position`. */
  position: string;
  /** True when the art was drawn for another shape and is being cropped. */
  cropped: boolean;
}

/**
 * The cover for a card shape: the dedicated crop when one has been drawn,
 * otherwise the landscape cover cropped to fit (`GameCovers` promises only
 * that one).
 */
export function coverFor(covers: GameCovers, variant: GameCardVariant): CoverChoice {
  const own = variant === "portrait" ? covers.portrait : variant === "square" ? covers.square : covers.landscape;
  if (own) return { src: own, position: "50% 50%", cropped: false };
  return { src: covers.landscape, position: COVER_POSITION[variant], cropped: true };
}

/* ─── Size ──────────────────────────────────────────────────────────────── */

/**
 * Fixed widths in a rail, in px, at mobile / md (768) / xl (1280), from the
 * design system's card sizes. `RAIL_WIDTH_CLASS` is the same numbers as
 * Tailwind classes; a test holds the two together, because the `sizes`
 * attribute is computed from these and an image sized for the wrong width is
 * either blurry or wasted bytes.
 */
export const RAIL_WIDTHS: Readonly<Record<GameCardVariant, readonly [number, number, number]>> = {
  landscape: [240, 288, 320],
  portrait: [132, 176, 200],
  square: [160, 200, 220],
  feature: [320, 480, 560],
};

/* Literal strings, because Tailwind finds classes by scanning source text. */
export const RAIL_WIDTH_CLASS: Readonly<Record<GameCardVariant, string>> = {
  landscape: "w-[240px] md:w-[288px] xl:w-[320px]",
  portrait: "w-[132px] md:w-[176px] xl:w-[200px]",
  square: "w-[160px] md:w-[200px] xl:w-[220px]",
  feature: "w-[320px] md:w-[480px] xl:w-[560px]",
};

export const ASPECT_CLASS: Readonly<Record<GameCardVariant, string>> = {
  landscape: "aspect-video",
  feature: "aspect-video",
  portrait: "aspect-[2/3]",
  square: "aspect-square",
};

/**
 * The `sizes` attribute for a card's cover.
 *
 * A rail card's width is known exactly. A grid card's is not (it depends on
 * the grid), so this assumes the browse grid's columns, 2 / 3 / 4 / 5 across;
 * a page with a different grid passes its own `sizes`.
 */
export function coverSizes(variant: GameCardVariant, layout: GameCardLayout): string {
  if (layout === "rail") {
    const [base, md, xl] = RAIL_WIDTHS[variant];
    return `(min-width: 1280px) ${xl}px, (min-width: 768px) ${md}px, ${base}px`;
  }
  if (variant === "feature") return "(min-width: 768px) 50vw, 100vw";
  return "(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";
}

/* ─── Words ─────────────────────────────────────────────────────────────── */

/** "1 player", "2 players", "2 to 4 players". */
export function spokenPlayers({ min, max }: PlayerRange): string {
  if (min === max) return `${min} ${min === 1 ? "player" : "players"}`;
  return `${min} to ${max} players`;
}

/**
 * The card link's accessible name.
 *
 * The card shows its facts as a badge, icons and abbreviations ("2-4P"), none
 * of which a screen reader says well, so the link carries one sentence instead:
 * "UNO, new. Cards, 2 to 4 players. Online, vs Bot, Local."
 */
export function cardAriaLabel(
  game: Pick<GameView, "name" | "genre" | "players" | "modes">,
  badge: CardBadge | null,
): string {
  const head = badge ? `${game.name}, ${badge.spoken}.` : `${game.name}.`;
  const facts = `${game.genre}, ${spokenPlayers(game.players)}.`;
  const modes = game.modes.length > 0 ? ` ${game.modes.map((m) => m.label).join(", ")}.` : "";
  return `${head} ${facts}${modes}`;
}

/* ─── Links ─────────────────────────────────────────────────────────────── */

export function detailHref(id: GameId): string {
  return `/games/${id}`;
}

export interface PlayTarget {
  href: string;
  /**
   * True when the link starts the game itself. The caller records the play
   * (`useRecentlyPlayed().record`), as the detail page's Play button does;
   * otherwise the detail page records it when the player chooses a mode.
   */
  direct: boolean;
}

/**
 * Where "Play now" goes from outside a game's page.
 *
 * A solo game has one way to play, so Play starts it: the same
 * `/play?game=…&mode=solo` route the detail page's button uses. Anything with
 * a choice of modes goes to the detail page's play box (`#play`), which owns
 * that choice; `/play` deliberately refuses to ask it (app/play/page.tsx).
 */
export function playTarget(game: Pick<GameView, "id" | "modes">): PlayTarget {
  const solo = game.modes.length === 1 && game.modes[0]?.id === "solo";
  if (solo) return { href: `/play?game=${game.id}&mode=solo`, direct: true };
  return { href: `${detailHref(game.id)}#play`, direct: false };
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */

/** How long a hero slide stays before the next one, when nothing has paused it. */
export const HERO_ADVANCE_MS = 7_000;

/** The hero's slides: the featured rotation, in its editorial order, playable only. */
export function featuredGames(ctx: GameViewContext): GameView[] {
  return FEATURED_GAME_IDS.map((id) => gameView(id, ctx)).filter((g) => g.playable);
}

/* ─── Rail keyboard ─────────────────────────────────────────────────────── */

/**
 * The item a key moves focus to in a rail of `count` items, or `null` when
 * the key is not one the rail handles. At either end the index stays put, so
 * the caller still swallows the key rather than letting the browser nudge the
 * scroller sideways.
 */
export function railKeyTarget(key: string, index: number, count: number): number | null {
  if (count <= 0 || index < 0) return null;
  switch (key) {
    case "ArrowRight":
      return Math.min(index + 1, count - 1);
    case "ArrowLeft":
      return Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/* ─── Time ──────────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;

/**
 * Midnight UTC of the current day: the `now` every page builds its game views
 * with. A server page reads it once and hands it down (home, Browse, a game's
 * page), so the badges in the HTML are the badges the browser hydrates; a
 * component reading it for itself could land on the other side of midnight.
 *
 * NEW and UPDATED are day windows, so a day is all the precision they need,
 * and a page regenerated within the hour still agrees with itself.
 */
export function catalogDay(now: number = Date.now()): number {
  return Math.floor(now / DAY_MS) * DAY_MS;
}
