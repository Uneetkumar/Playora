"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge, Input, cn } from "@playora/ui";
import { Search, X, CornerDownLeft } from "lucide-react";
import { GAME_CATALOG, isPlayable, searchGames, type CatalogGame } from "../../lib/games/catalog";

/**
 * Global game search.
 *
 * Keyboard-first on desktop (arrows to move, Enter to open, Escape to dismiss)
 * and touch-friendly on mobile, as the brief requires. Results state plainly
 * whether a game can be played, so search never leads somewhere that dead-ends.
 */
export function GameSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [isOpen, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // With no query, suggest what can actually be played right now.
  const results = React.useMemo<CatalogGame[]>(
    () => (query.trim() ? searchGames(query) : GAME_CATALOG.filter(isPlayable)),
    [query],
  );

  React.useEffect(() => setHighlight(0), [query]);

  React.useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const open = (game: CatalogGame) => {
    setOpen(false);
    router.push(isPlayable(game) ? `/play?game=${game.id}` : "/games");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const game = results[highlight];
      if (game) open(game);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="game-search" className="sr-only">
          Search games
        </label>
        <Input
          id="game-search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="game-search-results"
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search games..."
          className="h-11 pl-9 pr-9"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(true);
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          id="game-search-results"
          role="listbox"
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-raised"
        >
          {results.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-semibold text-foreground">No games match that</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try &ldquo;chess&rdquo;, &ldquo;cards&rdquo;, or &ldquo;racing&rdquo;.
              </p>
            </div>
          ) : (
            <>
              {!query.trim() && (
                <p className="border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Playable now
                </p>
              )}
              <ul>
                {results.map((game, i) => {
                  const playable = isPlayable(game);
                  return (
                    <li key={game.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === highlight}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => open(game)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                          i === highlight ? "bg-muted" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground">
                            {game.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {game.category} · {game.minPlayers}-{game.maxPlayers} players ·{" "}
                            {game.duration}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {/* Availability stated in words, not implied by styling. */}
                          {playable ? (
                            <Badge variant="success" className="text-[10px]">
                              Play
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              {game.phase}
                            </Badge>
                          )}
                          {i === highlight && (
                            <CornerDownLeft
                              className="hidden h-3.5 w-3.5 text-muted-foreground sm:block"
                              aria-hidden
                            />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
