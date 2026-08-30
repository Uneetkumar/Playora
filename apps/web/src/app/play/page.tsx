"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Badge, LoadingState } from "@playora/ui";
import { ArrowLeft, Bot, Loader2, RotateCcw, WifiOff } from "lucide-react";
import { AI_LEVELS, RECOMMENDED_AI_LEVEL } from "@playora/bot-engine";
import type { AiLevel } from "@playora/bot-engine";
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

/**
 * Runs a game. It does not ask which one, or how.
 *
 * Choosing happens in exactly one place — the game's own page at
 * /games/[slug], which already carries the rules, your record and every way to
 * play. This screen used to offer the same grid of modes as well, so the
 * platform had two different pages asking the player the same question. A
 * request without a mode is sent to the one that owns the decision.
 */
function PlayPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [started, setStarted] = React.useState<Started>(null);
  const [queueing, setQueueing] = React.useState(false);

  const requested = searchParams?.get("game");
  const gameId =
    requested && PLAYABLE_GAMES.some((g) => g.id === requested) ? (requested as GameId) : null;

  const requestedMode = searchParams?.get("mode");
  const mode: LocalMode | null =
    requestedMode === "vs-ai"
      ? "vs-ai"
      : requestedMode === "pass-and-play"
        ? "pass-and-play"
        : null;

  const levelParam = Number(searchParams?.get("level"));
  const aiLevel = (AI_LEVELS as readonly number[]).includes(levelParam)
    ? (levelParam as AiLevel)
    : RECOMMENDED_AI_LEVEL;

  const quickRequested = searchParams?.get("quick") === "1";

  // Send anything ambiguous to the page that owns the choice.
  React.useEffect(() => {
    if (started || queueing) return;
    if (!gameId) {
      router.replace("/games");
      return;
    }
    if (quickRequested) {
      setQueueing(true);
      return;
    }
    if (!mode) router.replace(`/games/${gameId}`);
  }, [gameId, mode, quickRequested, started, queueing, router]);

  // Start as soon as the URL says what to start.
  React.useEffect(() => {
    if (!gameId || !mode || started) return;
    setStarted({ mode, aiLevel, gameId });
  }, [gameId, mode, aiLevel, started]);

  if (started) {
    // Leaving a game goes back to the page that owns the choice. Clearing
    // `started` would do nothing: it is derived from the URL, so the effect
    // below would set it straight back.
    const exit = () => router.push(`/games/${started.gameId}`);

    if (started.gameId === "car-race" || started.gameId === "bike-race") {
      return (
        <LocalRaceMatch
          gameId={started.gameId}
          mode={started.mode}
          aiLevel={started.aiLevel}
          onExit={exit}
        />
      );
    }
    return started.gameId === "uno" || started.gameId === "uno-no-mercy" ? (
      <LocalUnoMatch
        gameId={started.gameId}
        mode={started.mode}
        aiLevel={started.aiLevel}
        onExit={exit}
      />
    ) : (
      <LocalMatch started={started} onExit={exit} />
    );
  }

  if (queueing && gameId) {
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

  // Redirecting; nothing to draw.
  return (
    <div className="container mx-auto max-w-md px-4 py-16 sm:px-6">
      <LoadingState title="Opening" />
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
