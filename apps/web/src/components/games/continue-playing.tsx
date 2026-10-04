"use client";

import * as React from "react";
import { History } from "lucide-react";
import type { GameId } from "@playora/game-types";
import { isGameId } from "../../lib/games/catalog";
import { gameView } from "../../lib/games/view";
import { useRecentlyPlayed } from "../../hooks/use-recently-played";
import type { RecentEntry } from "../../lib/games/recent-local";
import { GameCard } from "./game-card";
import { Rail } from "./rail";

/**
 * The "jump back in" shelf.
 *
 * The single highest-value row on a casual games site: someone who played
 * yesterday is far likelier to play the same thing again than to browse the
 * catalog from scratch, and until now the home page opened identically for a
 * first-time visitor and a returning player.
 *
 * Renders nothing when there is nothing to show, rather than an empty shelf
 * with a heading — a first visit should not be told what it is missing. That
 * includes while an account's list is loading: a skeleton row that then
 * vanishes for a player with no history is worse than a row that appears.
 */
export function ContinuePlaying({
  now,
  title = "Jump back in",
  limit = 10,
  bleed = false,
  className,
}: {
  /** The page's clock for badges (`catalogDay()`, read once by the server page). */
  now: number;
  title?: string;
  limit?: number;
  /** Passed to the rail: let the row run to the page edges. */
  bleed?: boolean;
  className?: string;
}) {
  const { entries, isLoading } = useRecentlyPlayed();

  // Entries are stored by slug; a game that has since left the catalog is
  // skipped rather than rendered as a broken card.
  const shelf = React.useMemo(
    () =>
      entries
        .filter((entry) => isGameId(entry.gameSlug))
        .slice(0, limit)
        .map((entry) => ({ entry, game: gameView(entry.gameSlug as GameId, { now }) })),
    [entries, limit, now],
  );

  if (isLoading || shelf.length === 0) return null;

  return (
    <Rail title={title} icon={<History />} count={shelf.length} bleed={bleed} className={className}>
      {shelf.map(({ entry, game }) => (
        <div key={game.id} className="flex flex-col gap-2">
          <GameCard game={game} variant="landscape" layout="rail" />
          {/* The count is what makes the shelf feel like a record of your own
              play rather than another recommendation row. */}
          <p className="numeric px-1 text-meta text-muted-foreground">{playedLabel(entry)}</p>
        </div>
      ))}
    </Rail>
  );
}

function playedLabel(entry: RecentEntry): string {
  return entry.playCount === 1 ? "Played once" : `Played ${entry.playCount} times`;
}
