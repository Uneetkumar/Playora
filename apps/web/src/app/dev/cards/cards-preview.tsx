"use client";

import * as React from "react";
import { Flame, LayoutGrid, Sparkles, Swords } from "lucide-react";
import { Button, Kbd } from "@playora/ui";
import type { GameId } from "@playora/game-types";
import { gameViews, type GameView } from "../../../lib/games/view";
import { sortGames } from "../../../lib/games/browse";
import { applyTheme, REDUCE_MOTION_CLASS } from "../../../lib/theme";
import { GameCard, GameCardSkeleton, type FavoriteControl } from "../../../components/games/game-card";
import { Rail } from "../../../components/games/rail";
import { HeroCarousel, type FavoriteSource } from "../../../components/games/hero-carousel";
import { ContinuePlaying } from "../../../components/games/continue-playing";
import { featuredGames, topBadge, type GameCardVariant } from "../../../components/games/card-logic";

/*
 * Made-up live counts, so LIVE shows next to the badges the real data gives
 * (NEW, UPDATED, HOT). The real ones come from the presence service.
 */
const DEMO_ONLINE: Partial<Record<GameId, number>> = {
  uno: 128,
  chess: 1_240,
  "car-race": 12_650,
};

/**
 * Favourites need an account, which a dev server usually lacks, so the
 * workbench keeps its own set to show the heart in both states.
 */
function useDemoFavorites(): FavoriteSource & { control: (id: GameId) => FavoriteControl } {
  const [ids, setIds] = React.useState<ReadonlySet<string>>(() => new Set(["chess", "ludo"]));
  const toggle = React.useCallback(
    (id: string) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );
  return {
    unavailable: false,
    isFavorite: (id: string) => ids.has(id),
    toggle,
    control: (id: GameId) => ({ active: ids.has(id), onToggle: () => toggle(id) }),
  };
}

export function CardsPreview({ now }: { now: number }) {
  const favorites = useDemoFavorites();
  const views = React.useMemo(() => gameViews({ now, onlineCounts: DEMO_ONLINE }), [now]);
  const hero = React.useMemo(() => featuredGames({ now }), [now]);
  const trending = React.useMemo(() => sortGames(views, "popular", { onlineCounts: DEMO_ONLINE }), [views]);
  const tabletop = views.filter((g) => g.genre === "Board" || g.genre === "Cards" || g.genre === "Strategy");

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-10 px-4 py-6 sm:px-6 lg:space-y-12 lg:px-8">
      <Toolbar />

      <HeroCarousel games={hero} favorites={favorites} />

      <ContinuePlaying now={now} />

      <Rail
        title="Trending now"
        icon={<Flame />}
        count={trending.length}
        description="Landscape, rail widths 240 / 288 / 320"
        seeAllHref="/games?sort=popular"
      >
        {trending.map((g) => (
          <GameCard key={g.id} game={g} layout="rail" favorite={favorites.control(g.id)} />
        ))}
      </Rail>

      <Rail title="Tabletop" icon={<Swords />} description="Portrait, rail widths 132 / 176 / 200" seeAllHref="/games?genre=Board">
        {tabletop.map((g) => (
          <GameCard key={g.id} game={g} variant="portrait" layout="rail" favorite={favorites.control(g.id)} />
        ))}
      </Rail>

      <Rail title="Top this week" description="Square, with TOP badges" seeAllHref="/leaderboard">
        {trending.slice(0, 10).map((g, i) => (
          <GameCard key={g.id} game={g} variant="square" layout="rail" badge={topBadge(i + 1)} favorite={false} />
        ))}
      </Rail>

      <Rail title="Spotlight" icon={<Sparkles />} description="Feature cards">
        {hero.map((g) => (
          <GameCard key={g.id} game={g} variant="feature" layout="rail" favorite={favorites.control(g.id)} />
        ))}
      </Rail>

      <Rail title="Loading, landscape" loading />
      <Rail title="Loading, portrait" loading skeleton={{ variant: "portrait", count: 9 }} />

      <Rail
        title="Play with friends"
        empty={
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No open rooms right now. Start one and it shows up here.
          </p>
        }
      />

      <Grid title="All games, landscape" variant="landscape" games={views} favorites={favorites} />
      <Grid title="All games, portrait crop" variant="portrait" games={views} favorites={favorites} />
      <Grid title="All games, square crop" variant="square" games={views} favorites={favorites} />

      <section className="space-y-4">
        <h2 className="font-display text-rail text-foreground">Skeletons</h2>
        <div className="flex flex-wrap items-end gap-4">
          {(["landscape", "portrait", "square", "feature"] as const).map((v) => (
            <GameCardSkeleton key={v} variant={v} layout="rail" />
          ))}
        </div>
      </section>
    </div>
  );
}

const GRID_CLASS: Record<GameCardVariant, string> = {
  landscape: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  feature: "grid-cols-1 md:grid-cols-2",
  portrait: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
  square: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
};

function Grid({
  title,
  variant,
  games,
  favorites,
}: {
  title: string;
  variant: GameCardVariant;
  games: GameView[];
  favorites: ReturnType<typeof useDemoFavorites>;
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-rail text-foreground">
        <LayoutGrid aria-hidden className="h-5 w-5 text-primary-accent" />
        {title}
        <span className="numeric text-sm text-muted-foreground">{games.length}</span>
      </h2>
      <ul role="list" className={`grid gap-3 lg:gap-4 ${GRID_CLASS[variant]}`}>
        {games.map((g) => (
          <li key={g.id}>
            <GameCard
              game={g}
              variant={variant}
              sizes={variant === "landscape" ? undefined : "(min-width: 1280px) 12vw, (min-width: 1024px) 16vw, 33vw"}
              favorite={favorites.control(g.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Toolbar() {
  const toggle = (cls: string) => {
    const root = document.documentElement;
    if (cls === "light") applyTheme(root.classList.contains("light") ? "dark" : "light");
    else root.classList.toggle(cls);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">Card workbench</span>
      <span className="hidden sm:inline">
        Tab into a rail, then <Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>Home</Kbd> <Kbd>End</Kbd>
      </span>
      <span className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={() => toggle("light")}>
          Toggle theme
        </Button>
        <Button variant="outline" size="sm" onClick={() => toggle(REDUCE_MOTION_CLASS)}>
          Toggle reduce motion
        </Button>
      </span>
    </div>
  );
}
