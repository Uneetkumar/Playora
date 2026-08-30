"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, Badge, LoadingState } from "@playora/ui";
import {
  Users,
  Bot,
  WifiOff,
  RotateCcw,
  ArrowLeft,
  Loader2,
  Shuffle,
  UserPlus,
  Radio,
  Lock,
  Clock,
  Zap,
} from "lucide-react";
import { AI_LEVELS, AI_LEVEL_LABELS, RECOMMENDED_AI_LEVEL } from "@playora/bot-engine";
import type { AiLevel } from "@playora/bot-engine";
import { getPlayModes, type PlayMode, type PlayModeId } from "../../lib/play/modes";
import { GAME_CATALOG, isPlayable } from "../../lib/games/catalog";
import { ChessGameView } from "../../games/chess/ChessGameView";
import { useLocalGame, type LocalMode } from "../../lib/local/use-local-game";
import { useLocalUno } from "../../lib/local/use-local-uno";
import { MatchResult } from "../../components/games/match-result";
import dynamic from "next/dynamic";

/**
 * Three.js is around half a megabyte, and only two of the five games need it.
 * Loading it lazily keeps it off every other page on the platform, and it can
 * never render on the server because it needs a WebGL context.
 */
const RaceGameView = dynamic(
  () => import("../../games/racing/RaceGameView").then((m) => m.RaceGameView),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-border bg-[#140a2e]">
        <LoadingState title="Building the track" />
      </div>
    ),
  },
);
import { UnoGameView } from "../../games/uno/UnoGameView";
import type { GameId } from "@playora/game-types";
import { QuickMatch } from "../../components/play/quick-match";

const MODE_ICONS: Record<PlayModeId, React.ComponentType<{ className?: string }>> = {
  "offline-ai": Bot,
  "offline-local": Users,
  "online-friends": UserPlus,
  "online-random": Shuffle,
  "online-ai": Bot,
  lan: Radio,
};

type Started = { mode: LocalMode; aiLevel: AiLevel; gameId: GameId } | null;

/**
 * Playable games, derived from the shared catalog.
 *
 * This was a hardcoded pair, so registering a new engine did not make it
 * appear here — exactly the drift the shared catalog exists to prevent.
 */
const PLAYABLE_GAMES: Array<{ id: GameId; name: string }> = GAME_CATALOG.filter(isPlayable).map(
  (g) => ({ id: g.id, name: g.name }),
);

export default function PlayPage() {
  return (
    <React.Suspense fallback={null}>
      <PlayPageContent />
    </React.Suspense>
  );
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const [started, setStarted] = React.useState<Started>(null);
  const [queueing, setQueueing] = React.useState(false);

  // Honour ?game= so opening a game from the catalog selects that game rather
  // than silently defaulting to chess.
  const requested = searchParams?.get("game");
  const isExplicit = Boolean(requested && PLAYABLE_GAMES.some((g) => g.id === requested));

  const [gameId, setGameId] = React.useState<GameId | null>(
    isExplicit ? (requested as GameId) : null,
  );

  if (started) {
    if (started.gameId === "car-race" || started.gameId === "bike-race") {
      return (
        <LocalRaceMatch
          gameId={started.gameId}
          mode={started.mode}
          aiLevel={started.aiLevel}
          onExit={() => setStarted(null)}
        />
      );
    }
    return started.gameId === "uno" || started.gameId === "uno-no-mercy" ? (
      <LocalUnoMatch
        gameId={started.gameId}
        mode={started.mode}
        aiLevel={started.aiLevel}
        onExit={() => setStarted(null)}
      />
    ) : (
      <LocalMatch started={started} onExit={() => setStarted(null)} />
    );
  }

  // Arrived with no game in mind: choose one first rather than guessing.
  if (!gameId) {
    return <GameChooser onChoose={setGameId} />;
  }

  if (queueing) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 sm:px-6">
        <QuickMatch
          gameId={gameId}
          gameName={PLAYABLE_GAMES.find((g) => g.id === gameId)?.name ?? "Chess"}
          onClose={() => setQueueing(false)}
          onPlayAi={() => {
            setQueueing(false);
            setStarted({ mode: "vs-ai", aiLevel: RECOMMENDED_AI_LEVEL, gameId });
          }}
        />
      </div>
    );
  }

  return (
    <PlayHub
      gameId={gameId}
      lockedToGame={isExplicit}
      onStartLocal={(mode, aiLevel) => setStarted({ mode, aiLevel, gameId })}
      onQuickMatch={() => setQueueing(true)}
    />
  );
}

function PlayHub({
  gameId,
  lockedToGame,
  onStartLocal,
  onQuickMatch,
}: {
  gameId: GameId;
  /** True when the player picked this game deliberately, so no switcher. */
  lockedToGame: boolean;
  onStartLocal: (mode: LocalMode, aiLevel: AiLevel) => void;
  onQuickMatch: () => void;
}) {
  const router = useRouter();
  const [aiLevel, setAiLevel] = React.useState<AiLevel>(RECOMMENDED_AI_LEVEL);
  const modes = React.useMemo(() => getPlayModes(gameId), [gameId]);
  const gameName = PLAYABLE_GAMES.find((g) => g.id === gameId)?.name ?? "Chess";

  const ready = modes.filter((m) => m.status === "ready");
  const later = modes.filter((m) => m.status !== "ready");

  const launch = (mode: PlayMode) => {
    switch (mode.id) {
      case "offline-ai":
        onStartLocal("vs-ai", aiLevel);
        return;
      case "offline-local":
        onStartLocal("pass-and-play", aiLevel);
        return;
      case "online-friends":
        router.push(`/rooms?game=${gameId}`);
        return;
      case "online-random":
        onQuickMatch();
        return;
      default:
        return;
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="pb-8">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Play {gameName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pick how you want to play. The offline modes need no account and no internet.
        </p>
      </header>

      {/* No switcher: the player already chose this game, so showing the others
          alongside it is noise. A quiet way back to the catalog is enough. */}
      <div className="mb-8">
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {lockedToGame ? "Choose a different game" : "All games"}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ready.map((mode) => {
          const Icon = MODE_ICONS[mode.id];
          const isAi = mode.id === "offline-ai";
          return (
            <Card key={mode.id} className="border-border bg-card/70">
              <CardContent className="flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white">{mode.label}</h2>
                      <p className="text-xs text-muted-foreground">{mode.tagline}</p>
                    </div>
                  </div>
                  {!mode.needsAuth && (
                    <Badge variant="success" className="shrink-0 gap-1">
                      <WifiOff className="h-3 w-3" />
                      Offline
                    </Badge>
                  )}
                </div>

                {isAi && (
                  <fieldset className="mt-5">
                    <legend className="text-xs font-semibold text-foreground">Difficulty</legend>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {AI_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setAiLevel(level)}
                          aria-pressed={level === aiLevel}
                          title={AI_LEVEL_LABELS[level]}
                          className={`h-9 w-9 rounded-lg border text-sm font-bold transition ${
                            level === aiLevel
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-background/60 text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {AI_LEVEL_LABELS[aiLevel]}
                      {aiLevel === RECOMMENDED_AI_LEVEL && (
                        <span className="ml-2 text-emerald-400">Recommended</span>
                      )}
                    </p>
                  </fieldset>
                )}

                <div className="mt-auto pt-5">
                  <Button className="w-full gap-2 h-11" onClick={() => launch(mode)}>
                    {mode.needsAuth ? <UserPlus className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    <span>{isAi ? `Play level ${aiLevel}` : mode.label}</span>
                  </Button>
                  {mode.needsAuth && (
                    <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      Sign in or continue as guest
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {later.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Coming soon
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {later.map((mode) => {
              const Icon = MODE_ICONS[mode.id];
              return (
                <div
                  key={mode.id}
                  className="rounded-xl border border-border/70 bg-card/30 p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">{mode.label}</h3>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{mode.note ?? mode.tagline}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Offline games are unrated and are not saved to your history.
      </p>
    </div>
  );
}

function LocalMatch({ started, onExit }: { started: NonNullable<Started>; onExit: () => void }) {
  const game = useLocalGame({ mode: started.mode, aiLevel: started.aiLevel });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" className="gap-2" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
          All modes
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1.5">
            <WifiOff className="h-3 w-3" />
            Offline
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            {started.mode === "vs-ai" ? (
              <>
                <Bot className="h-3 w-3" />
                AI level {started.aiLevel}
              </>
            ) : (
              "Pass & Play"
            )}
          </Badge>
          <Button variant="outline" size="sm" className="gap-2" onClick={game.restart}>
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
        </div>
      </div>

      {game.error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200"
        >
          {game.error}
        </div>
      )}

      {game.isThinking && (
        <div role="status" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>AI is thinking…</span>
        </div>
      )}

      {game.result && (
        <div className="mb-6">
          <MatchResult
            result={game.result}
            players={game.players}
            currentUserId={game.currentUserId}
            onRematch={game.restart}
            rematchLabel="Play again"
            onExit={onExit}
          />
        </div>
      )}

      <ChessGameView
        gameState={game.view}
        players={game.players}
        currentUserId={game.currentUserId}
        lastResult={null}
        onMakeMove={game.makeMove}
        onResign={game.resign}
        onOfferDraw={game.offerDraw}
        onAcceptDraw={game.acceptDraw}
        onDeclineDraw={game.declineDraw}
        onRematch={game.restart}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Want a rated game?{" "}
        <Link href="/rooms?game=chess" className="text-primary hover:underline">
          Play online with a friend
        </Link>
      </p>
    </div>
  );
}


function LocalUnoMatch({
  gameId,
  mode,
  aiLevel,
  onExit,
}: {
  gameId: GameId;
  mode: LocalMode;
  aiLevel: AiLevel;
  onExit: () => void;
}) {
  const game = useLocalUno({ playerCount: 2, gameId, mode, aiLevel });
  const vsAi = mode === "vs-ai";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" className="gap-2" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All modes
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1.5">
            <WifiOff className="h-3 w-3" aria-hidden />
            Offline
          </Badge>
          {gameId === "uno-no-mercy" && <Badge variant="secondary">No Mercy</Badge>}
          <Badge variant="secondary">
            {vsAi ? `AI level ${aiLevel}` : "Pass & Play"}
          </Badge>
          <Button variant="outline" size="sm" className="gap-2" onClick={game.restart}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Restart
          </Button>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Offline games are unrated and are not saved to your history.
        {vsAi ? " You are Player 1." : " Pass the device on each turn."}
      </p>

      {game.error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-foreground"
        >
          {game.error}
        </div>
      )}

      {game.result && (
        <div className="mb-6">
          <MatchResult
            result={game.result}
            players={game.players}
            currentUserId={game.currentUserId}
            onRematch={game.restart}
            rematchLabel="Play again"
            onExit={onExit}
          />
        </div>
      )}

      <UnoGameView
        gameState={game.view}
        players={game.players}
        currentUserId={game.currentUserId}
        isOpponentThinking={game.isThinking}
        lastResult={null}
        onPlayCard={game.playCard}
        onDrawCard={game.drawCard}
        onPass={game.pass}
        onRematch={game.restart}
      />
    </div>
  );
}


/**
 * Shown only when someone lands on /play with no game in mind.
 *
 * Arriving from the catalog or search always carries ?game=, so this never
 * appears in front of a player who has already decided.
 */
function GameChooser({ onChoose }: { onChoose: (id: GameId) => void }) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
        What do you want to play?
      </h1>
      <p className="mt-2 text-muted-foreground">Pick a game to see how you can play it.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PLAYABLE_GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => onChoose(game.id)}
            className="group rounded-xl border border-border bg-card p-6 text-left transition-colors hover:border-primary"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                <Zap className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <span>
                <span className="block font-display text-lg font-bold text-foreground">
                  {game.name}
                </span>
                <span className="block text-xs text-muted-foreground">Ready to play</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <Link
        href="/games"
        className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        Browse the full catalog
      </Link>
    </div>
  );
}

function LocalRaceMatch({
  gameId,
  mode,
  aiLevel,
  onExit,
}: {
  gameId: GameId;
  mode: LocalMode;
  aiLevel: AiLevel;
  onExit: () => void;
}) {
  const isBike = gameId === "bike-race";
  // Pass-and-play makes no sense in a race — two people cannot share one
  // steering input — so that mode becomes a time trial against the clock.
  const raceMode = mode === "vs-ai" ? "vs-ai" : "time-trial";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" className="gap-2" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All modes
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1.5">
            <WifiOff className="h-3 w-3" aria-hidden />
            Offline
          </Badge>
          <Badge variant="secondary">{isBike ? "Bike Race" : "Car Race"}</Badge>
          <Badge variant="secondary">
            {raceMode === "vs-ai" ? `AI level ${aiLevel}` : "Time trial"}
          </Badge>
        </div>
      </div>

      <RaceGameView gameId={gameId} mode={raceMode} aiLevel={aiLevel} onExit={onExit} />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Offline races are unrated and are not saved to your history.
      </p>
    </div>
  );
}
