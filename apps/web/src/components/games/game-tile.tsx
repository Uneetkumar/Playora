"use client";

import Link from "next/link";
import { Badge, cn } from "@playora/ui";
import { Play, Lock } from "lucide-react";
import { isPlayable, type CatalogGame } from "../../lib/games/catalog";
import { artFor } from "./game-art";

export function GameTile({
  game,
  size = "md",
}: {
  game: CatalogGame;
  size?: "sm" | "md" | "lg";
}) {
  const playable = isPlayable(game);
  const art = artFor(game.id);

  // Sized by aspect ratio rather than fixed pixels, so a tile fills whatever
  // cell the layout gives it. Fixed widths were why the row could not reflow
  // and quietly hid whatever did not fit.
  const dims = {
    sm: "w-full aspect-square",
    md: "w-full aspect-square",
    lg: "w-full aspect-[4/3]",
  }[size];

  return (
    <Link
      // The detail page exists for every catalogued game, playable or not: it
      // is where the rules, your record and the ways to play live, and an
      // upcoming game still has something to say for itself.
      href={`/games/${game.id}`}
      className={cn(
        "group block",
        // In a scrolling row a tile still needs a width to scroll past.
        size === "sm" ? "w-[124px] shrink-0" : size === "md" ? "w-[168px] shrink-0" : "w-full",
      )}
      aria-label={`${game.name}${playable ? "" : ` — ${game.phase}`}`}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/60 transition-transform duration-200",
          "group-hover:-translate-y-1 group-hover:border-primary/60 group-hover:shadow-raised",
          dims,
        )}
        style={{ background: art.background }}
      >
        <art.Art className="absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-[1.06]" />

        {/* Legibility scrim behind the title. */}
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" aria-hidden />

        <span className="absolute inset-x-0 bottom-0 p-2.5">
          <span className="block truncate font-display text-sm font-bold text-white">
            {game.name}
          </span>
          <span className="block truncate text-[10px] text-white/70">
            {game.minPlayers}-{game.maxPlayers} players · {game.duration}
          </span>
        </span>

        {/* A play affordance on hover, as game catalogues do. */}
        <span
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg">
            <Play className="ml-0.5 h-5 w-5 fill-black text-black" />
          </span>
        </span>

        {/* Availability stated, never implied by styling alone. */}
        <span className="absolute left-2 top-2">
          {playable ? (
            <Badge variant="success" className="gap-1 text-[10px]">
              <Play className="h-2.5 w-2.5 fill-current" aria-hidden />
              Play
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Lock className="h-2.5 w-2.5" aria-hidden />
              Soon
            </Badge>
          )}
        </span>
      </div>
    </Link>
  );
}

/** A horizontally scrolling row of tiles, as game platforms lay them out. */
export function GameRow({
  title,
  games,
  href,
  size = "md",
  emptyNote,
  wrap = false,
}: {
  title: string;
  games: CatalogGame[];
  href?: string;
  size?: "sm" | "md" | "lg";
  emptyNote?: string;
  /**
   * Wrap onto more rows instead of scrolling sideways.
   *
   * A horizontal scroller silently hides whatever does not fit, and on a wide
   * screen the fifth game sat just past the right edge with no visible
   * affordance — Bike Race shipped and was invisible. For a short, complete
   * list, showing all of it beats a row that scrolls.
   */
  wrap?: boolean;
}) {
  if (games.length === 0 && !emptyNote) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-xl font-extrabold text-foreground">{title}</h2>
        {href && (
          <Link href={href} className="text-primary transition-transform hover:translate-x-0.5" aria-label={`See all ${title}`}>
            ›
          </Link>
        )}
      </div>

      {games.length > 0 ? (
        <div
          className={
            wrap
              ? // A real grid, so tiles reflow at every breakpoint instead of
                // scrolling sideways and hiding whatever does not fit.
                "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : "-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
          }
        >
          {games.map((g) => (
            <GameTile key={g.id} game={g} size={size} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {emptyNote}
        </p>
      )}
    </section>
  );
}
