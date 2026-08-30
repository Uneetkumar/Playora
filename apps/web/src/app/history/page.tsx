"use client";

import * as React from "react";
import { Button, LoadingState, cn } from "@playora/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useMatchHistory } from "../../hooks/use-match-history";
import { MatchRow, EmptyState } from "../../components/games/match-history-row";
import { GAME_CATALOG } from "../../lib/games/catalog";
import { isGameImplemented } from "../../lib/play/modes";

const PAGE_SIZE = 20;

export default function MatchHistoryPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [gameSlug, setGameSlug] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);

  // Changing the filter has to send you back to the first page, or you land on
  // page 3 of a list that now has one page.
  const selectGame = React.useCallback((slug: string | null) => {
    setGameSlug(slug);
    setPage(0);
  }, []);

  const { matches, isLoading, hasMore, error } = useMatchHistory(user?.id, {
    gameSlug,
    limit: PAGE_SIZE,
    page,
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Match history
        </h1>
        <p className="mt-1 text-muted-foreground">
          Every finished match, as the server recorded it.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip active={gameSlug === null} onClick={() => selectGame(null)}>
          All games
        </FilterChip>
        {GAME_CATALOG.filter((g) => isGameImplemented(g.id)).map((game) => (
          <FilterChip
            key={game.id}
            active={gameSlug === game.id}
            onClick={() => selectGame(game.id)}
          >
            {game.name}
          </FilterChip>
        ))}
      </div>

      {authLoading || isLoading ? (
        <LoadingState title="Loading your matches" />
      ) : !user ? (
        <EmptyState
          title="Sign in to see your history"
          body="Matches are recorded against your account. Guest games are kept too — as long as you keep the same guest session."
        />
      ) : error ? (
        <EmptyState title="Could not load your matches" body={error} />
      ) : matches.length === 0 ? (
        <EmptyState
          title={page > 0 ? "No more matches" : "No matches yet"}
          body={
            page > 0
              ? "You have reached the end of your history."
              : "Play an online game and it will show up here. Offline games are not recorded."
          }
          action={page === 0}
        />
      ) : (
        <ul className="space-y-2">
          {matches.map((match) => (
            <li key={match.sessionId}>
              <MatchRow match={match} />
            </li>
          ))}
        </ul>
      )}

      {(page > 0 || hasMore) && (
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Newer
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
