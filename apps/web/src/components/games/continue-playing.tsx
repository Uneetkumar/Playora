"use client";

import { History } from "lucide-react";
import { GAME_CATALOG } from "../../lib/games/catalog";
import { GameTile } from "./game-tile";
import { useRecentlyPlayed } from "../../hooks/use-recently-played";

/**
 * The "jump back in" shelf.
 *
 * The single highest-value row on a casual games site: someone who played
 * yesterday is far likelier to play the same thing again than to browse the
 * catalog from scratch, and until now the home page opened identically for a
 * first-time visitor and a returning player.
 *
 * Renders nothing when there is nothing to show, rather than an empty shelf
 * with a heading — a first visit should not be told what it is missing.
 */
export function ContinuePlaying({ limit = 6 }: { limit?: number }) {
  const { entries, isLoading } = useRecentlyPlayed();

  // Entries are stored by slug; a game that has since left the catalog is
  // skipped rather than rendered as a broken tile.
  const games = entries
    .map((entry) => {
      const game = GAME_CATALOG.find((g) => g.id === entry.gameSlug);
      return game ? { game, entry } : null;
    })
    .filter((x): x is { game: (typeof GAME_CATALOG)[number]; entry: (typeof entries)[number] } => x !== null)
    .slice(0, limit);

  if (isLoading || games.length === 0) return null;

  return (
    <section aria-labelledby="continue-playing-heading">
      <div className="mb-4 flex items-center gap-3">
        <History className="h-5 w-5 text-primary-accent" aria-hidden />
        <h2
          id="continue-playing-heading"
          className="font-display text-xl font-black text-foreground"
        >
          Jump back in
        </h2>
        <span className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
          {games.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {games.map(({ game, entry }) => (
          // `GameTile` renders its own link, so this must not add another —
          // an <a> inside an <a> is invalid HTML and React reports it as a
          // hydration error rather than silently fixing it.
          <div key={game.id}>
            <GameTile game={game} />
            <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
              {/* The count is what makes the shelf feel like a record of your
                  own play rather than another recommendation row. */}
              {entry.playCount === 1 ? "Played once" : `Played ${entry.playCount} times`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
