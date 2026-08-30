"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, LoadingState, cn } from "@playora/ui";
import { rankForRating } from "@playora/progression";
import { Trophy, Medal, Users, Globe2, Info, CalendarClock } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useLeaderboard, type LeaderboardEntry, type LeaderboardScope } from "../../hooks/use-leaderboard";
import { GAME_CATALOG } from "../../lib/games/catalog";
import { isGameImplemented } from "../../lib/play/modes";
import { useSeason } from "../../hooks/use-season";

const RATED_GAMES = GAME_CATALOG.filter((g) => isGameImplemented(g.id));

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [gameSlug, setGameSlug] = React.useState<string>(RATED_GAMES[0]?.id ?? "chess");
  const [scope, setScope] = React.useState<LeaderboardScope>("global");

  const { entries, me, isLoading, error } = useLeaderboard(user?.id, { gameSlug, scope });
  const season = useSeason(user?.id, gameSlug);
  const activeGame = RATED_GAMES.find((g) => g.id === gameSlug);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Leaderboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Rating is per game, so every board here is for one game at a time.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {RATED_GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => setGameSlug(game.id)}
            aria-pressed={gameSlug === game.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              gameSlug === game.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {game.name}
          </button>
        ))}
      </div>

      {season.season && (
        <div className="mb-4 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-sm font-bold text-foreground">{season.season.name}</p>
            <p className="text-xs font-medium text-muted-foreground">{season.remainingLabel}</p>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(season.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${season.season.name} progress`}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${season.progress * 100}%` }}
            />
          </div>
          {season.standing && (
            <p className="mt-2 text-xs text-muted-foreground">
              {season.standing.rank !== null ? (
                <>
                  You are <span className="font-semibold text-foreground">#{season.standing.rank}</span>{" "}
                  this season at {season.standing.rating}.
                </>
              ) : (
                <>
                  {season.standing.gamesToPlacement} more rated{" "}
                  {season.standing.gamesToPlacement === 1 ? "match" : "matches"} to be ranked this
                  season.
                </>
              )}
            </p>
          )}
        </div>
      )}

      <div
        role="tablist"
        aria-label="Leaderboard scope"
        className="mb-6 inline-flex rounded-lg border border-border p-1"
      >
        {(
          [
            { id: "global" as const, label: "Global", icon: Globe2 },
            { id: "season" as const, label: "Season", icon: CalendarClock },
            { id: "friends" as const, label: "Friends", icon: Users },
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={scope === tab.id}
            onClick={() => setScope(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              scope === tab.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="h-3.5 w-3.5" aria-hidden />
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState title={`Loading the ${activeGame?.name ?? "game"} leaderboard`} />
      ) : error ? (
        <Empty title="Could not load the leaderboard" body={error} />
      ) : entries.length === 0 ? (
        <Empty
          title={
            scope === "friends"
              ? "No ranked friends yet"
              : scope === "season"
                ? "Nobody has qualified this season"
                : "Nobody is ranked yet"
          }
          body={
            scope === "friends"
              ? "Add friends and play a rated match together — their standing will show up here."
              : scope === "season"
                ? `A season board only lists players with 10 or more rated ${activeGame?.name ?? "game"} matches, so one good run cannot outrank a whole season of play.`
                : `Be the first: play a rated ${activeGame?.name ?? "game"} against another player. Matches against AI are unrated.`
          }
        />
      ) : (
        <>
          <ol className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.userId}>
                <Row entry={entry} />
              </li>
            ))}
          </ol>

          {me && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your standing
              </p>
              <Row entry={me} />
            </div>
          )}
        </>
      )}

      <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Only rated matches count — games against AI and offline games are excluded, and a
          player appears once they have finished at least one rated match. A regional board
          needs a region on your profile, which Playora does not collect yet.
        </span>
      </p>
    </div>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const tier = rankForRating(entry.rating);
  const podium = entry.rank <= 3;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        entry.isMe ? "border-primary/50 bg-primary/5" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "numeric flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
          entry.rank === 1
            ? "bg-warning/20 text-warning"
            : entry.rank === 2
              ? "bg-muted text-foreground"
              : entry.rank === 3
                ? "bg-warning/10 text-warning/80"
                : "text-muted-foreground",
        )}
      >
        {podium ? (
          entry.rank === 1 ? (
            <Trophy className="h-4 w-4" aria-hidden />
          ) : (
            <Medal className="h-4 w-4" aria-hidden />
          )
        ) : (
          entry.rank
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/profile?user=${entry.username}`}
            className="truncate text-sm font-semibold text-foreground hover:underline"
          >
            {entry.displayName}
          </Link>
          {entry.isMe && <span className="text-xs text-muted-foreground">(you)</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="numeric">{entry.wins}</span>W ·{" "}
          <span className="numeric">{entry.losses}</span>L ·{" "}
          <span className="numeric">{entry.draws}</span>D over{" "}
          <span className="numeric">{entry.gamesPlayed}</span>
        </p>
      </div>

      <div className="shrink-0 text-right">
        <div className="numeric text-sm font-bold text-foreground">{entry.rating}</div>
        <Badge variant="outline" className="mt-0.5 text-[10px]">
          {tier.label}
        </Badge>
      </div>

      {podium && entry.rank === 1 && <span className="sr-only">Ranked first</span>}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
      <Trophy className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-display text-lg font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
