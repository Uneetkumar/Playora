"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card, LoadingState, buttonVariants, cn } from "@playora/ui";
import { rankForRating } from "@playora/progression";
import { AI_LEVELS, AI_LEVEL_LABELS, RECOMMENDED_AI_LEVEL, type AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import {
  ArrowLeft, Users, Clock, Trophy, BookOpen, Bot, Swords, Zap, WifiOff, Wifi, Lock,
} from "lucide-react";
import { GAME_CATALOG } from "../../../lib/games/catalog";
import { getPlayModes, isGameImplemented, type PlayMode } from "../../../lib/play/modes";
import { usePlayerProgression } from "../../../hooks/use-progression";
import { useMatchHistory } from "../../../hooks/use-match-history";
import { useAuthStore } from "../../../lib/store/auth-store";
import { MatchRow } from "../../../components/games/match-history-row";

const MODE_ICON: Record<string, typeof Bot> = {
  "offline-ai": Bot,
  "offline-local": Users,
  "online-friends": Swords,
  "online-random": Zap,
  "online-ai": Bot,
  lan: WifiOff,
};

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) ?? "";
  const { user } = useAuthStore();
  // Lives here because this page is now the only place a mode is chosen. It
  // used to be duplicated on /play, so the platform asked the same question
  // twice on two different screens.
  const [aiLevel, setAiLevel] = React.useState<AiLevel>(RECOMMENDED_AI_LEVEL);

  const game = GAME_CATALOG.find((g) => g.id === slug);
  const playable = game ? isGameImplemented(game.id) : false;

  const { data: progression, isLoading: progressionLoading } = usePlayerProgression(user?.id);
  const { matches } = useMatchHistory(user?.id, { gameSlug: slug, limit: 3 });

  if (!game) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">No such game</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          &ldquo;{slug}&rdquo; is not in the catalog.
        </p>
        <Link href="/games" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
          Browse games
        </Link>
      </div>
    );
  }

  const mine = progression?.ratings.find((r) => r.gameSlug === game.id) ?? null;
  const modes = getPlayModes(game.id as GameId);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/games"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mb-6 gap-2")}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All games
      </Link>

      {/* Hero. No artwork exists for these games yet, so this is a typographic
          treatment rather than a placeholder image that would look broken. */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 15% 0%, hsl(var(--primary) / 0.35), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{game.category}</Badge>
            {playable ? (
              <Badge variant="success">Playable now</Badge>
            ) : (
              <Badge variant="outline">{game.phase}</Badge>
            )}
          </div>

          <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            {game.name}
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{game.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden />
              {game.minPlayers === game.maxPlayers
                ? `${game.minPlayers} players`
                : `${game.minPlayers}–${game.maxPlayers} players`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden />
              {game.duration}
            </span>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Ways to play */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">Ways to play</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {modes.map((mode) => (
                <ModeCard
                  key={mode.id}
                  mode={mode}
                  gameId={game.id}
                  signedIn={Boolean(user)}
                  aiLevel={aiLevel}
                  onAiLevel={setAiLevel}
                  onStart={() => router.push(routeFor(mode, game.id, aiLevel))}
                />
              ))}
            </div>
          </section>

          {/* Rules */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              How it plays
            </h2>
            <Card className="border-border bg-card p-5">
              <ul className="space-y-2.5">
                {game.rules.map((rule, i) => (
                  <li key={rule} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="numeric shrink-0 font-semibold text-primary">{i + 1}</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>

        <aside className="space-y-6">
          {/* Your standing in this game */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">Your record</h2>
            <Card className="border-border bg-card p-5">
              {!user ? (
                <p className="text-sm text-muted-foreground">
                  Sign in, or just play as a guest — a rating starts the first time you finish a
                  rated match.
                </p>
              ) : progressionLoading ? (
                <LoadingState title="Loading your record" />
              ) : mine ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="numeric font-display text-3xl font-black text-foreground">
                      {mine.rating}
                    </span>
                    <Badge variant="outline">{rankForRating(mine.rating).label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Peak <span className="numeric">{mine.peakRating}</span>
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Stat label="Won" value={mine.wins} />
                    <Stat label="Lost" value={mine.losses} />
                    <Stat label="Drawn" value={mine.draws} />
                  </dl>
                  {mine.toNextRank && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      <span className="numeric">{mine.toNextRank.needed}</span> more rating to reach{" "}
                      {mine.toNextRank.tier.label}.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No rated {game.name} matches yet. Play someone online and a rating appears here —
                  games against AI stay unrated on purpose.
                </p>
              )}
            </Card>
          </section>

          {playable && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Recent</h2>
                <Link href="/history" className="text-xs text-primary hover:underline">
                  All matches
                </Link>
              </div>
              {matches.length === 0 ? (
                <Card className="border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
                  Nothing played yet.
                </Card>
              ) : (
                <ul className="space-y-2">
                  {matches.map((match) => (
                    <li key={match.sessionId}>
                      <MatchRow match={match} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <Link
            href={`/leaderboard`}
            className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2")}
          >
            <Trophy className="h-4 w-4" aria-hidden />
            {game.name} leaderboard
          </Link>
        </aside>
      </div>
    </div>
  );
}

/**
 * Where a mode actually takes you.
 *
 * Every destination carries the full decision, so /play never has to ask
 * anything: it receives the game, the mode and the difficulty and starts.
 */
function routeFor(mode: PlayMode, gameId: string, aiLevel: AiLevel): string {
  switch (mode.id) {
    case "offline-ai":
      return `/play?game=${gameId}&mode=vs-ai&level=${aiLevel}`;
    case "offline-local":
      return `/play?game=${gameId}&mode=pass-and-play`;
    case "online-friends":
    case "online-ai":
      return `/rooms?game=${gameId}`;
    case "online-random":
      return `/play?game=${gameId}&quick=1`;
    default:
      return `/games`;
  }
}

function ModeCard({
  mode,
  gameId,
  signedIn,
  aiLevel,
  onAiLevel,
  onStart,
}: {
  mode: PlayMode;
  gameId: string;
  signedIn: boolean;
  aiLevel: AiLevel;
  onAiLevel: (level: AiLevel) => void;
  onStart: () => void;
}) {
  const Icon = MODE_ICON[mode.id] ?? Zap;
  const ready = mode.status === "ready";
  // Guests are signed in as far as the platform is concerned, so this only
  // blocks someone who has not been given an identity at all yet.
  const blocked = ready && mode.needsAuth && !signedIn;

  return (
    <Card
      className={cn(
        "flex flex-col gap-2 border-border bg-card p-4",
        !ready && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-sm font-semibold text-foreground">{mode.label}</span>
        {mode.needsInternet ? (
          <Wifi className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-label="Needs internet" />
        ) : (
          <WifiOff className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-label="Works offline" />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{mode.tagline}</p>

      {ready && mode.id === "offline-ai" && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Difficulty
          </p>
          <div className="flex flex-wrap gap-1">
            {AI_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onAiLevel(level)}
                aria-pressed={level === aiLevel}
                className={cn(
                  "numeric h-7 w-7 rounded-md text-xs font-bold transition-colors",
                  level === aiLevel
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {AI_LEVEL_LABELS[aiLevel]}
            {aiLevel === RECOMMENDED_AI_LEVEL && (
              <span className="ml-1 text-success">Recommended</span>
            )}
          </p>
        </div>
      )}

      {ready ? (
        <Button size="sm" className="mt-auto gap-1.5" onClick={onStart}>
          {blocked && <Lock className="h-3 w-3" aria-hidden />}
          {mode.id === "offline-ai" ? `Play level ${aiLevel}` : mode.label}
        </Button>
      ) : (
        <p className="mt-auto text-xs text-muted-foreground">
          {mode.note ?? "Coming soon"}
        </p>
      )}
      <span className="sr-only">{gameId}</span>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 px-2 py-2">
      <dd className="numeric text-sm font-bold text-foreground">{value}</dd>
      <dt className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
    </div>
  );
}
