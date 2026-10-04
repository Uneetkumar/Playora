"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Clock, Heart, Share2, Trophy, Users } from "lucide-react";
import { Button, cn, toast } from "@playora/ui";
import type { GameView } from "../../../lib/games/view";
import type { FavoritesResult } from "../../../hooks/use-favorites";
import type { GameRating } from "../../../hooks/use-progression";
import { GameBadge } from "../../../components/games/game-badges";
import { ModeChips } from "../../../components/games/mode-chips";
import { RankBadge } from "../../../components/progression/rank-badge";
import { GENRE_ICONS, genreHref } from "../../../components/shell/nav";

/**
 * The top of a game's page: the cover as a full-bleed backdrop, and the
 * game's name, facts and the player's own standing over it.
 *
 * Two pieces because they sit in different layout boxes. The art spans the
 * whole content column, under the page grid; the words sit in the grid's
 * first column, so on a desktop they can never run under the play box, which
 * rises into the hero's corner from the column beside them.
 */

/**
 * The cover, edge to edge.
 *
 * On a phone it is a block at the top of the page that fades out at the
 * bottom, and the title starts over the faded part, as the home hero does.
 * From `lg` it is a backdrop behind the header row, fading out on the left,
 * where the words are, and at the bottom. The play box stands in the hero's
 * right column, so the picture itself ends under the box's left edge (4rem
 * in, then faded): its subject, centred in every cover, sits between the
 * title and the box rather than behind the box. That end is worked out as
 * the page grid does: the gutter (2rem), the box column (22rem, 24rem from
 * `xl`), and whatever the 1400px grid leaves either side on a wide screen.
 * The left fade is measured on the whole width, as it was when the art ran
 * to the edge, so the words keep the contrast they were tuned for.
 *
 * The fades are masks on the art, not page-coloured gradients laid over it:
 * the art itself turns transparent, so whatever is behind it (the page, the
 * shell's ambient wash) shows through evenly on both sides of its edge, in
 * either theme. A gradient to the page colour drew a visible seam wherever
 * the page behind was not exactly that colour.
 */
const ART_MASK = cn(
  "[mask-image:linear-gradient(to_bottom,black_35%,transparent_88%)]",
  "lg:[mask-image:linear-gradient(to_right,transparent_28%,black_68%),linear-gradient(to_bottom,black_45%,transparent)]",
  "lg:[-webkit-mask-composite:source-in] lg:[mask-composite:intersect]",
);

export function HeroArt({ game }: { game: GameView }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none relative h-[56vw] max-h-[26rem] min-h-[13rem] overflow-hidden",
        "lg:absolute lg:inset-x-0 lg:top-0 lg:h-[calc(var(--hero-h)+7rem)] lg:max-h-none",
      )}
    >
      <div className={cn("absolute inset-0", ART_MASK)}>
        {/* High priority without `priority`, inside <picture>: as on the home
            hero, React would otherwise preload it in a Link header whose
            srcset the browser cannot read, and it fetched the 3840w file. */}
        <picture
          className={cn(
            "absolute inset-0 lg:left-[28%] lg:[mask-image:linear-gradient(to_left,transparent,black_6rem)]",
            "lg:right-[calc(max(0px,(100%_-_1400px)/2)_+_20rem)] xl:right-[calc(max(0px,(100%_-_1400px)/2)_+_22rem)]",
          )}
        >
          <Image
            src={game.covers.landscape}
            alt=""
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1024px) 62vw, 100vw"
            className="object-cover object-[50%_35%]"
          />
        </picture>
      </div>
      {/* The game's colour, faintly, from the top left: the page reads as
          this game's on the left where no art shows. */}
      <span className="absolute inset-0 hidden bg-gradient-to-br from-game-accent-soft via-transparent via-40% to-transparent lg:block" />
    </div>
  );
}

function playersText({ min, max }: GameView["players"]): string {
  if (min === max) return `${min} ${min === 1 ? "player" : "players"}`;
  return `${min}–${max} players`;
}

export function DetailHeader({
  game,
  rated,
  best,
  favorites,
}: {
  game: GameView;
  /** The account's rating here, once a rated game has moved it. */
  rated: GameRating | null;
  /** The best score on this device, for a game where scores mean something. */
  best: number | null;
  favorites: FavoritesResult;
}) {
  const GenreIcon = GENRE_ICONS[game.genre];
  const favourite = favorites.isFavorite(game.id);

  return (
    <header className="relative z-10 -mt-12 flex flex-col gap-4 sm:-mt-24 lg:mt-0 lg:min-h-[var(--hero-h)] lg:pb-14 lg:pt-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <li>
            <Link href="/games" className="rounded-sm transition-colors duration-hover hover:text-foreground">
              Games
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="h-3.5 w-3.5 text-subtle" />
          </li>
          <li>
            <Link href={genreHref(game.genre)} className="rounded-sm transition-colors duration-hover hover:text-foreground">
              {game.genre}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-4 lg:mt-auto lg:max-w-xl">
        <GameBadge game={game} className="self-start" />
        <div className="space-y-2">
          <h1 className="text-balance font-display text-display text-foreground">{game.name}</h1>
          <p className="max-w-lg text-base text-muted-foreground sm:text-lg">{game.heroTagline}</p>
        </div>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-medium text-foreground">
          <li className="inline-flex items-center gap-1.5">
            <GenreIcon aria-hidden className="h-4 w-4 text-muted-foreground" />
            {game.genre}
          </li>
          <li className="numeric inline-flex items-center gap-1.5">
            <Users aria-hidden className="h-4 w-4 text-muted-foreground" />
            {playersText(game.players)}
          </li>
          <li className="numeric inline-flex items-center gap-1.5">
            <Clock aria-hidden className="h-4 w-4 text-muted-foreground" />
            {game.duration.replace("-", "–")}
          </li>
        </ul>

        <ModeChips modes={game.modes} />

        {(rated || best !== null) && (
          <ul aria-label="Your standing" className="flex flex-wrap items-center gap-2">
            {rated && (
              <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 py-1 pl-3 pr-1.5 text-sm shadow-card">
                <span className="text-muted-foreground">Your rating</span>
                <span className="numeric font-bold text-foreground">{rated.rating.toLocaleString("en")}</span>
                <RankBadge tier={rated.rank} size="sm" />
              </li>
            )}
            {best !== null && (
              <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-sm shadow-card">
                <Trophy aria-hidden className="h-4 w-4 text-reward" />
                <span className="text-muted-foreground">Your best</span>
                <span className="numeric font-bold text-foreground">{best.toLocaleString("en")}</span>
              </li>
            )}
          </ul>
        )}

        <div className="flex items-center gap-2">
          {/*
            * Shown only when it can do something. `unavailable` covers a
            * guest, an unconfigured Supabase and an unapplied migration — a
            * heart that silently does nothing is worse than no heart.
            */}
          {!favorites.unavailable && (
            <Button
              variant="secondary"
              aria-pressed={favourite}
              aria-label={favourite ? `Remove ${game.name} from favourites` : `Add ${game.name} to favourites`}
              onClick={() => favorites.toggle(game.id)}
            >
              <Heart aria-hidden className={cn("h-4 w-4", favourite && "fill-current text-primary-accent")} />
              {favourite ? "Favourited" : "Favourite"}
            </Button>
          )}
          <ShareButton game={game} />
        </div>
      </div>
    </header>
  );
}

/**
 * The system share sheet where there is one (phones, and desktop Safari and
 * Edge), otherwise the link copied to the clipboard. Either way it shares the
 * game's page, never whatever query or hash this visit happens to carry.
 */
function ShareButton({ game }: { game: Pick<GameView, "id" | "name" | "heroTagline"> }) {
  const share = async () => {
    const url = new URL(`/games/${game.id}`, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${game.name} on Playora`, text: game.heroTagline, url });
        return;
      } catch (error) {
        // Closing the sheet is a choice, not a failure to fall back from.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: url });
    } catch {
      toast.error("Couldn't copy the link", { description: url });
    }
  };

  return (
    <Button variant="outline" aria-label={`Share ${game.name}`} onClick={() => void share()}>
      <Share2 aria-hidden className="h-4 w-4" />
      Share
    </Button>
  );
}
