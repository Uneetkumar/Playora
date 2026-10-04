"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { gameViews } from "../../lib/games/view";
import { browseHref } from "../../lib/games/browse-url";
import { useMediaQuery } from "../../hooks/use-media-query";
import { HeroCarousel } from "../games/hero-carousel";
import { GameCard } from "../games/game-card";
import { Rail } from "../games/rail";
import { ContinuePlaying } from "../games/continue-playing";
import { featuredGames } from "../games/card-logic";
import { GenreChips } from "./genre-chips";
import { PlayerStatus } from "./player-status";
import { PlayWithFriends } from "./play-with-friends";
import { HomeCta } from "./home-cta";
import { freshGames, homeShelves } from "./home-shelves";

/**
 * The front page: the featured games, then shortcuts into the catalogue,
 * your own recent games, the ways to play with people, a shelf per family of
 * genres, what is new, and a way out to everything else.
 *
 * Everything on it is derived from the catalogue at one moment, `now`, which
 * the server page reads and hands down, so the badges the server renders are
 * the badges the browser hydrates. The only data fetched here is personal
 * (recently played, level, favourites) or live (open rooms), and each of
 * those shows nothing until it has something, rather than a placeholder that
 * may turn out to be empty.
 */
export function HomeView({ now }: { now: number }) {
  const views = React.useMemo(() => gameViews({ now }), [now]);
  const featured = React.useMemo(() => featuredGames({ now }), [now]);
  const shelves = React.useMemo(() => homeShelves(views), [views]);
  const fresh = React.useMemo(() => freshGames(views), [views]);
  // A feature card's description needs the width of a tablet; on a phone it
  // covers most of a 320px card and the art behind it, so phones get the
  // ordinary landscape card. The server renders the phone layout.
  const roomy = useMediaQuery("(min-width: 768px)");

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      {/* Outside the spaced column: an sr-only element still takes a margin. */}
      <h1 className="sr-only">Playora: free games to play in your browser</h1>

      <div className="space-y-10 lg:space-y-12">
        <div className="space-y-4 lg:space-y-5">
          <HeroCarousel games={featured} />
          <div className="flex items-center gap-3">
            <GenreChips className="flex-1" />
            <PlayerStatus />
          </div>
        </div>

        <ContinuePlaying now={now} title="Continue playing" bleed />

        <PlayWithFriends />

        {shelves.map((shelf) => {
          const Icon = shelf.icon;
          return (
            <Rail
              key={shelf.id}
              title={shelf.title}
              icon={<Icon />}
              count={shelf.games.length}
              seeAllHref={shelf.href}
              bleed
            >
              {shelf.games.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  variant={shelf.variant === "feature" && !roomy ? "landscape" : shelf.variant}
                  layout="rail"
                />
              ))}
            </Rail>
          );
        })}

        <Rail
          title="New & updated"
          icon={<Sparkles />}
          description="Fresh releases and games that changed in the last two weeks."
          seeAllHref={browseHref({ sort: "new" })}
          bleed
        >
          {fresh.map((game) => (
            <GameCard key={game.id} game={game} variant="landscape" layout="rail" />
          ))}
        </Rail>

        <HomeCta />
      </div>
    </div>
  );
}
