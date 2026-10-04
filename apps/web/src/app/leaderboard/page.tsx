"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { GameId } from "@playora/game-types";
import { Button, Card, ToggleGroup, ToggleGroupItem } from "@playora/ui";
import { CalendarClock, Globe2, Info, Swords, Trophy, Users, WifiOff } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useLeaderboard, type LeaderboardScope } from "../../hooks/use-leaderboard";
import { useSeason } from "../../hooks/use-season";
import { GAME_CATALOG, isGameId } from "../../lib/games/catalog";
import { isMultiplayer } from "../../lib/play/modes";
import { isSupabaseConfigured } from "../../lib/env";
import { queryKeys } from "../../lib/query/keys";
import { PageContainer, PageHeader } from "../../components/page/page-header";
import { EmptyState } from "../../components/page/empty-state";
import { ProgressBar } from "../../components/page/stat";
import { GameSelect } from "../../components/page/game-select";
import { BoardRow, BoardSkeleton, BoardTable, Podium } from "./board";

/**
 * Only games a rating can exist for: the ones with a server engine, which is
 * what a rated match needs. The board used to offer all thirty-one games,
 * and every solo title's board was empty by construction.
 */
const RATED_GAMES: GameId[] = GAME_CATALOG.filter((g) => isMultiplayer(g.id)).map((g) => g.id);
const DEFAULT_GAME: GameId = RATED_GAMES[0] ?? "chess";

/** A `?game=` worth honouring: a rated game. Anything else falls back to the default board. */
function ratedGameFrom(param: string | null | undefined): GameId | null {
  return isGameId(param) && RATED_GAMES.includes(param) ? param : null;
}

const SCOPES: Array<{ id: LeaderboardScope; label: string; icon: typeof Globe2 }> = [
  { id: "global", label: "All time", icon: Globe2 },
  { id: "season", label: "This season", icon: CalendarClock },
  { id: "friends", label: "Friends", icon: Users },
];

/**
 * The board, with `?game=` choosing the game (a detail page's "Full board"
 * links here with it). Picking a game answers from local state at once and
 * the URL follows, so the board can be shared or reloaded as it is; a link
 * to another board while this one is open replaces the choice.
 */
function LeaderboardContent({ requested }: { requested: GameId | null }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [gameSlug, setGameSlug] = React.useState<GameId>(requested ?? DEFAULT_GAME);
  // The game this page last wrote; it coming back through the URL is not news.
  const written = React.useRef(requested);
  React.useEffect(() => {
    if (!requested || requested === written.current) return;
    written.current = requested;
    setGameSlug(requested);
  }, [requested]);

  const chooseGame = (id: GameId) => {
    setGameSlug(id);
    written.current = id;
    router.replace(`/leaderboard?game=${id}`, { scroll: false });
  };
  const [scope, setScope] = React.useState<LeaderboardScope>("global");

  const { entries, me, isLoading, error } = useLeaderboard(user?.id, { gameSlug, scope });
  const season = useSeason(user?.id, gameSlug);
  const gameName = GAME_CATALOG.find((g) => g.id === gameSlug)?.name ?? "this game";

  const podium = entries.filter((e) => e.rank <= 3);
  const rest = entries.filter((e) => e.rank > 3);

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        icon={<Trophy />}
        title="Leaderboard"
        description="Ratings are kept per game, so every board ranks one game. Only rated matches against people count."
        action={
          <Button asChild>
            <Link href={`/games/${gameSlug}`}>
              <Swords className="h-4 w-4" aria-hidden />
              Play {gameName}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GameSelect
          games={RATED_GAMES}
          value={gameSlug}
          onValueChange={(v) => v !== "all" && chooseGame(v)}
          label="Game"
        />
        <ToggleGroup
          type="single"
          value={scope}
          // A board always has a scope: ignore Radix's "unselect" on a second press.
          onValueChange={(v) => v && setScope(v as LeaderboardScope)}
          aria-label="Which players to rank"
          className="w-full sm:w-auto"
        >
          {SCOPES.map(({ id, label, icon: Icon }) => (
            <ToggleGroupItem key={id} value={id} className="flex-1 sm:flex-none">
              <Icon aria-hidden />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {season.season && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
              <CalendarClock className="h-4 w-4 text-primary-accent" aria-hidden />
              {season.season.name}
            </p>
            <p className="numeric text-xs font-medium text-muted-foreground">
              {season.remainingLabel}
            </p>
          </div>
          <ProgressBar
            value={season.progress}
            label={`${season.season.name} progress`}
            size="sm"
            className="mt-3"
          />
          {season.standing && (
            <p className="mt-3 text-sm text-muted-foreground">
              {season.standing.rank !== null ? (
                <>
                  You are{" "}
                  <span className="font-mono-num font-bold text-foreground">
                    #{season.standing.rank}
                  </span>{" "}
                  this season at{" "}
                  <span className="font-mono-num font-bold text-foreground">
                    {season.standing.rating}
                  </span>
                  .
                </>
              ) : (
                <>
                  <span className="font-mono-num font-bold text-foreground">
                    {season.standing.gamesToPlacement}
                  </span>{" "}
                  more rated {season.standing.gamesToPlacement === 1 ? "match" : "matches"} to be
                  ranked this season.
                </>
              )}
            </p>
          )}
        </Card>
      )}

      <section aria-label={`${gameName} rankings`} className="space-y-6">
        {!isSupabaseConfigured ? (
          <EmptyState
            icon={<WifiOff />}
            title="Rankings are offline"
            body="This copy of Playora is not connected to its database, so there is no board to show. Games against the AI and on the same Wi-Fi still work."
            action={
              <Button asChild variant="secondary">
                <Link href="/games">Browse games</Link>
              </Button>
            }
          />
        ) : isLoading ? (
          <BoardSkeleton />
        ) : error ? (
          <EmptyState
            icon={<Info />}
            title="Could not load the leaderboard"
            body={error}
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  void queryClient.invalidateQueries({
                    queryKey: queryKeys.leaderboard(gameSlug, scope, user?.id),
                  })
                }
              >
                Try again
              </Button>
            }
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={scope === "friends" ? <Users /> : <Trophy />}
            title={
              scope === "friends"
                ? "No ranked friends yet"
                : scope === "season"
                  ? "Nobody has qualified this season"
                  : "Nobody is ranked yet"
            }
            body={
              scope === "friends"
                ? `Add friends and play rated ${gameName} together; their standing shows up here.`
                : scope === "season"
                  ? `A season board lists players with 10 or more rated ${gameName} matches, so one good run cannot outrank a season of play.`
                  : `Be the first: play a rated ${gameName} match against another player. Matches against the AI are unrated.`
            }
            action={
              scope === "friends" ? (
                <Button asChild>
                  <Link href="/friends">Find friends</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href={`/games/${gameSlug}`}>Play {gameName}</Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <Podium entries={podium} />
            <BoardTable entries={rest} caption={`${gameName} rankings below the top three`} />
            {me && (
              <div>
                <p className="mb-2 text-tag uppercase text-muted-foreground">Your standing</p>
                <BoardRow entry={me} standalone />
              </div>
            )}
          </>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Games against the AI and offline games are not rated, and a player appears once they have
          finished one rated match. There is no regional board: Playora does not ask where you live.
        </span>
      </p>
    </PageContainer>
  );
}

function LeaderboardFromUrl() {
  return <LeaderboardContent requested={ratedGameFrom(useSearchParams()?.get("game"))} />;
}

export default function LeaderboardPage() {
  // `useSearchParams` suspends a statically rendered page; the default board
  // stands in until the query is known.
  return (
    <React.Suspense fallback={<LeaderboardContent requested={null} />}>
      <LeaderboardFromUrl />
    </React.Suspense>
  );
}
