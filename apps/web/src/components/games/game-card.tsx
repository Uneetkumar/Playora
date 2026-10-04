"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Play, Users } from "lucide-react";
import { Skeleton, cn, focusRingClass } from "@playora/ui";
import type { GameView } from "../../lib/games/view";
import { gameAccentStyle } from "../../lib/games/meta";
import { useFavorites } from "../../hooks/use-favorites";
import { useReducedMotionPref } from "../../lib/motion";
import { GameBadge } from "./game-badges";
import { ModeChips } from "./mode-chips";
import {
  ASPECT_CLASS,
  RAIL_WIDTH_CLASS,
  cardAriaLabel,
  cardBadge,
  coverFor,
  coverSizes,
  detailHref,
  type CardBadge,
  type GameCardLayout,
  type GameCardVariant,
} from "./card-logic";

/**
 * The game card: the catalogue's one way of showing a game in a rail, a grid
 * or a shelf (docs/DESIGN_SYSTEM.md, "Game card anatomy").
 *
 * The card is a single link. The favourite heart is a sibling of that link,
 * laid over its corner, never a child of it: a <button> inside an <a> is
 * invalid HTML, gives keyboard users two stops that fight over one click, and
 * makes every click on the heart a navigation the handler has to cancel.
 *
 * So the root is a plain box that owns the hover and focus state for both:
 * `hover:` and `has-[:focus-visible]:` lift it, and its children read the same
 * state through `group-…/card`. Every hover effect has that focus twin, and
 * nothing is reachable by hover alone: the heart shows on touch screens
 * (`hover: none`) and whenever it is set.
 *
 * Motion is a lift of 4px and 2% over 200ms. Under reduced motion the lift
 * classes are not rendered at all; the ring, the glow and the play glyph still
 * appear, because they are state, not movement.
 */

export interface FavoriteControl {
  active: boolean;
  onToggle: () => void;
  /** A write is in flight. Announced, not blocking: the toggle is optimistic. */
  pending?: boolean;
}

export interface GameCardProps {
  game: GameView;
  variant?: GameCardVariant;
  layout?: GameCardLayout;
  /** Defaults to the game's page, which owns the choice of mode. */
  href?: string;
  /** Load the cover eagerly at high priority: the first row above the fold. */
  priority?: boolean;
  /** Overrides the computed `sizes`, for a grid whose columns differ from browse's. */
  sizes?: string;
  /**
   * The heart. Omitted, the card asks `useFavorites` itself and shows nothing
   * when favourites cannot work here (signed out, no Supabase). A control
   * hands it in from a parent that already has the list; `false` hides it.
   */
  favorite?: FavoriteControl | false;
  /** Overrides the view's badge (`topBadge(n)` on a ranked rail). `null` shows none. */
  badge?: CardBadge | null;
  className?: string;
}

const LIFT =
  "transition-transform duration-hover ease-out-expo hover:-translate-y-1 hover:scale-[1.02] has-[:focus-visible]:-translate-y-1 has-[:focus-visible]:scale-[1.02]";

/** Shown while the card's group is hovered or holds keyboard focus. */
const ON_ACTIVE = "group-hover/card:opacity-100 group-has-[:focus-visible]/card:opacity-100";

export function GameCard({
  game,
  variant = "landscape",
  layout = "grid",
  href,
  priority = false,
  sizes,
  favorite,
  badge: badgeOverride,
  className,
}: GameCardProps) {
  const reduced = useReducedMotionPref();
  const badge = badgeOverride !== undefined ? badgeOverride : cardBadge(game);
  const cover = coverFor(game.covers, variant);
  const feature = variant === "feature";
  // A 132px portrait card has room for a LIVE count or the full meta row
  // beside the heart, not both, so it tightens its corners and drops the
  // mode icons (the link's label still says them).
  const compact = variant === "portrait";

  return (
    <div
      data-game-card={game.id}
      className={cn(
        "group/card relative isolate",
        layout === "rail" ? RAIL_WIDTH_CLASS[variant] : "w-full",
        !reduced && LIFT,
        className,
      )}
      style={gameAccentStyle(game.id)}
    >
      {/* Elevation and glow, as layers that fade in: opacity is cheap to
          animate where a changing box-shadow repaints every frame. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-xl opacity-0 shadow-card-hover transition-opacity duration-hover ease-out-expo",
          ON_ACTIVE,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-xl opacity-0 shadow-glow transition-opacity duration-hover ease-out-expo",
          ON_ACTIVE,
        )}
      />

      <Link
        href={href ?? detailHref(game.id)}
        prefetch={false}
        aria-label={cardAriaLabel(game, badge)}
        // A size container, so the badge can answer the card's own width
        // (a portrait card is 132px in a phone's rail, wider in a grid).
        className={cn(
          "relative block overflow-hidden rounded-xl bg-muted shadow-card [container-type:inline-size]",
          ASPECT_CLASS[variant],
        )}
      >
        {/* The art carries no text, and the link's label says everything the
            card shows, so the image is decorative. */}
        <Image
          src={cover.src}
          alt=""
          fill
          sizes={sizes ?? coverSizes(variant, layout)}
          priority={priority}
          className="object-cover"
          style={{ objectPosition: cover.position }}
        />

        {/* Dark in both themes, with light words on it: art is art, and a
            page-coloured scrim made light theme's covers a white haze. */}
        <span
          aria-hidden
          className={cn("pointer-events-none absolute inset-x-0 bottom-0 scrim-art", feature ? "h-full" : "h-3/4")}
        />
        {/* The scrim alone is under half strength at the title's height, which
            is not enough over busy art; this deepens it behind the words only. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-art-scrim/70 via-art-scrim/30 to-transparent",
            feature ? "h-1/2" : "h-24",
          )}
        />
        {/* Inner edge: keeps a dark cover from dissolving into a dark page, and
            a pale one into a white page. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-foreground/10"
        />

        {badge && (
          <GameBadge
            badge={badge}
            className={cn("absolute z-10", compact ? "left-2 top-2" : "left-2.5 top-2.5")}
            // "LIVE 1.2K" and the heart do not both fit across a card under
            // 160px; the count gives way (the link's label still says it).
            countClassName="[@container(max-width:159px)]:hidden"
          />
        )}

        {game.playable && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 top-[42%] z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full",
              "bg-background/70 text-foreground shadow-raised ring-1 ring-foreground/15 backdrop-blur-sm",
              "opacity-0 transition-[opacity,transform] duration-hover ease-out-expo",
              ON_ACTIVE,
              feature ? "h-14 w-14" : variant === "portrait" ? "h-10 w-10" : "h-12 w-12",
              !reduced && "scale-90 group-hover/card:scale-100 group-has-[:focus-visible]/card:scale-100",
            )}
          >
            <Play className={cn("ml-0.5 fill-current", feature ? "h-6 w-6" : "h-5 w-5")} />
          </span>
        )}

        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 z-10 flex flex-col text-halo-art",
            feature ? "gap-2 p-4 sm:p-5" : variant === "portrait" ? "gap-1 p-2.5" : "gap-1 p-3",
          )}
        >
          <span
            className={cn(
              "truncate font-display text-art-foreground",
              feature ? "text-h2" : "text-card-title",
            )}
          >
            {game.name}
          </span>
          {feature && (
            <span className="line-clamp-2 max-w-prose text-sm text-art-muted-foreground">{game.description}</span>
          )}
          <CardMeta game={game} compact={compact} />
        </span>
      </Link>

      {favorite === false ? null : favorite ? (
        <FavoriteHeart name={game.name} compact={compact} {...favorite} />
      ) : (
        <AutoFavoriteHeart id={game.id} name={game.name} compact={compact} />
      )}
    </div>
  );
}

/**
 * Players, ways to play and genre, in one line that gives way from the right:
 * the genre truncates first, the counts never do.
 */
function CardMeta({ game, compact }: { game: GameView; compact: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-meta text-art-muted-foreground">
      <span className="numeric inline-flex shrink-0 items-center gap-1">
        <Users aria-hidden className="h-3.5 w-3.5" />
        {game.playersLabel}
      </span>
      {!compact && <ModeChips modes={game.modes} variant="icons" />}
      <span aria-hidden className="shrink-0">
        ·
      </span>
      <span className="truncate">{game.genre}</span>
    </span>
  );
}

function AutoFavoriteHeart({ id, name, compact }: { id: string; name: string; compact: boolean }) {
  const favorites = useFavorites();
  // `unavailable` covers a guest, an unconfigured Supabase and an unapplied
  // migration: a heart that silently does nothing is worse than no heart.
  if (favorites.unavailable) return null;
  return (
    <FavoriteHeart
      name={name}
      compact={compact}
      active={favorites.isFavorite(id)}
      pending={favorites.isToggling}
      onToggle={() => favorites.toggle(id)}
    />
  );
}

/**
 * The heart over the card's top-right corner. A 40px target (the smallest the
 * design allows) around a 32px disc, or a 28px one tucked into the corner on a
 * compact card. Its label stays "Favourite <game>" in both states;
 * `aria-pressed` is what says whether it is on.
 */
function FavoriteHeart({
  name,
  active,
  onToggle,
  pending,
  compact = false,
}: FavoriteControl & { name: string; compact?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-busy={pending || undefined}
      aria-label={`Favourite ${name}`}
      onClick={(event) => {
        // Not inside the link, but a caller may still have wrapped the card
        // in something clickable.
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "absolute z-20 grid h-10 w-10 place-items-center rounded-full",
        compact ? "right-0 top-0" : "right-1 top-1",
        "transition-opacity duration-hover ease-out-expo",
        focusRingClass,
        active
          ? "opacity-100"
          : cn("opacity-0 focus-visible:opacity-100 [@media(hover:none)]:opacity-100", ON_ACTIVE),
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid place-items-center rounded-full bg-background/75 shadow-raised ring-1 ring-foreground/15 backdrop-blur-sm",
          compact ? "h-7 w-7" : "h-8 w-8",
          "transition-colors duration-hover ease-out-expo",
          active ? "text-primary-accent" : "text-foreground hover:text-primary-accent",
        )}
      >
        <Heart className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", active && "fill-current")} />
      </span>
    </button>
  );
}

/** The card's shape while its data loads: same box, same corners, a slow sweep. */
export function GameCardSkeleton({
  variant = "landscape",
  layout = "grid",
  className,
}: {
  variant?: GameCardVariant;
  layout?: GameCardLayout;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted",
        ASPECT_CLASS[variant],
        layout === "rail" ? RAIL_WIDTH_CLASS[variant] : "w-full",
        className,
      )}
    >
      <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
      <span className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-2/3 rounded-sm" />
        <Skeleton className="h-3 w-2/5 rounded-sm" />
      </span>
    </div>
  );
}
