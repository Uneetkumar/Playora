"use client";

import Link from "next/link";
import { Badge, cn } from "@playora/ui";
import { Play, Lock } from "lucide-react";
import { isPlayable, type CatalogGame } from "../../lib/games/catalog";

/**
 * Artwork tiles per game, in the absence of real art.
 *
 * Each game gets a distinct, deliberate treatment rather than one shared
 * gradient — a wall of identical tiles is exactly what makes a catalogue look
 * unfinished. Swap these for real artwork when it exists.
 */
const ART: Record<string, { bg: string; glyph: string; tint: string }> = {
  chess: {
    bg: "linear-gradient(150deg,#2A2118,#5B4326 55%,#8A6A3B)",
    glyph: "♞",
    tint: "text-[#F0D9A7]",
  },
  uno: {
    bg: "linear-gradient(150deg,#7A1512,#D4362B 55%,#F0A03C)",
    glyph: "🎴",
    tint: "text-white",
  },
  "uno-no-mercy": {
    bg: "linear-gradient(150deg,#1A0B22,#5B1240 55%,#B3184F)",
    glyph: "💥",
    tint: "text-white",
  },
  "car-race": {
    bg: "linear-gradient(150deg,#0B1C33,#124B7A 55%,#2C93D6)",
    glyph: "🏎️",
    tint: "text-white",
  },
  "bike-race": {
    bg: "linear-gradient(150deg,#12240F,#2A5F1E 55%,#57A83A)",
    glyph: "🏍️",
    tint: "text-white",
  },
};

export function GameTile({
  game,
  size = "md",
}: {
  game: CatalogGame;
  size?: "sm" | "md" | "lg";
}) {
  const playable = isPlayable(game);
  const art = ART[game.id] ?? ART.chess!;

  const dims = {
    sm: "w-[120px] h-[120px]",
    md: "w-[168px] h-[168px]",
    lg: "w-[260px] h-[168px]",
  }[size];

  return (
    <Link
      // The detail page exists for every catalogued game, playable or not: it
      // is where the rules, your record and the ways to play live, and an
      // upcoming game still has something to say for itself.
      href={`/games/${game.id}`}
      className="group block shrink-0"
      aria-label={`${game.name}${playable ? "" : ` — ${game.phase}`}`}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/60 transition-transform duration-200",
          "group-hover:-translate-y-1 group-hover:border-primary/60 group-hover:shadow-raised",
          dims,
        )}
        style={{ background: art.bg }}
      >
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-6xl drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)]",
            art.tint,
          )}
          aria-hidden
        >
          {art.glyph}
        </span>

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
}: {
  title: string;
  games: CatalogGame[];
  href?: string;
  size?: "sm" | "md" | "lg";
  emptyNote?: string;
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
        // Horizontal scroll keeps rows dense without wrapping into a grid.
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
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
