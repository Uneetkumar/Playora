"use client";

import * as React from "react";
import { Badge, Input, cn } from "@playora/ui";
import { Search } from "lucide-react";
import { GAME_CATALOG, isPlayable } from "../../lib/games/catalog";
import { GameTile } from "../../components/games/game-tile";

/**
 * The catalogue.
 *
 * Driven entirely by `GAME_CATALOG` and the engine registry. This page used to
 * carry its own hardcoded list, so it still advertised UNO as "Coming in Phase
 * 5" long after it shipped and described Car Race as a top-down 2D game. A
 * second list of the games is a list that will be wrong.
 */
export default function GamesPage() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);

  const categories = React.useMemo(
    () => [...new Set(GAME_CATALOG.map((g) => g.category))],
    [],
  );

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return GAME_CATALOG.filter((game) => {
      if (category && game.category !== category) return false;
      if (!q) return true;
      return (
        game.name.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q) ||
        game.tags.some((tag) => tag.includes(q))
      );
    });
  }, [query, category]);

  const playable = matches.filter(isPlayable);
  const upcoming = matches.filter((g) => !isPlayable(g));

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          All games
        </h1>
        <p className="mt-1 text-muted-foreground">
          {GAME_CATALOG.filter(isPlayable).length} playable now · {GAME_CATALOG.length} in the
          catalogue
        </p>
      </header>

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games and categories"
          aria-label="Search games"
          className="pl-9"
        />
      </div>

      <div className="mb-7 flex flex-wrap gap-2">
        <Chip active={category === null} onClick={() => setCategory(null)}>
          All
        </Chip>
        {categories.map((name) => (
          <Chip key={name} active={category === name} onClick={() => setCategory(name)}>
            {name}
          </Chip>
        ))}
      </div>

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="font-display text-lg font-bold text-foreground">Nothing matches that</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different name, or clear the filters.
          </p>
        </div>
      ) : (
        <>
          {playable.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-display text-xl font-extrabold text-foreground">
                  Playable now
                </h2>
                <Badge variant="success" className="text-[10px]">
                  {playable.length}
                </Badge>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {playable.map((game) => (
                  <li key={game.id}>
                    <GameTile game={game} size="lg" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-extrabold text-foreground">
                On the way
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {upcoming.map((game) => (
                  <li key={game.id}>
                    <GameTile game={game} size="lg" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
