"use client";

import * as React from "react";
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
import { ArcadeGameView } from "../../games/arcade/ArcadeGameView";
import type { GameId } from "@playora/game-types";
import { QuickMatch } from "../../components/play/quick-match";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

const ARCADE_GAMES = new Set<GameId>([
  "rope-rescue",
  "ant-attack",
  "bomb-pass",
  "color-rush",
  "falling-floor",
  "pin-puzzle",
  "target-rush",
  "hot-potato",
  "bridge-builder",
  "ice-breaker",
]);


type Started = { mode: LocalMode | "career"; aiLevel: AiLevel; gameId: GameId } | null;

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
  const mode: LocalMode | "career" | null =
    requestedMode === "vs-ai"
      ? "vs-ai"
      : requestedMode === "pass-and-play"
        ? "pass-and-play"
        : requestedMode === "career"
          ? "career"
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
    if (ARCADE_GAMES.has(gameId)) {
      setStarted({ mode: "vs-ai", aiLevel: 1, gameId });
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
    if (!gameId || started) return;
    if (ARCADE_GAMES.has(gameId)) {
      setStarted({ mode: "vs-ai", aiLevel: 1, gameId });
      return;
    }
    if (!mode) return;
    setStarted({ mode, aiLevel, gameId });
  }, [gameId, mode, aiLevel, started]);

  if (started) {
    // Leaving a game goes back to the page that owns the choice. Clearing
    // `started` would do nothing: it is derived from the URL, so the effect
    // below would set it straight back.
    const exit = () => router.push(`/games/${started.gameId}`);

    if (ARCADE_GAMES.has(started.gameId)) {
      return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14]">
          <ArcadeGameView gameId={started.gameId} onExit={exit} />
        </div>
      );
    }
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
    const localMode: LocalMode = started.mode === "pass-and-play" ? "pass-and-play" : "vs-ai";
    return started.gameId === "uno" || started.gameId === "uno-no-mercy" ? (
      <LocalUnoMatch
        gameId={started.gameId}
        mode={localMode}
        aiLevel={started.aiLevel}
        onExit={exit}
      />
    ) : (
      <LocalMatch
        started={{ ...started, mode: localMode }}
        onExit={exit}
      />
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

function LocalMatch({
  started,
  onExit,
}: {
  started: { mode: LocalMode; aiLevel: AiLevel; gameId: GameId };
  onExit: () => void;
}) {
  const game = useLocalGame({ mode: started.mode, aiLevel: started.aiLevel });
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const savedRef = React.useRef(false);

  // Persist finished game to local history so /history shows it
  React.useEffect(() => {
    if (!game.result || savedRef.current) return;
    savedRef.current = true;
    const meScore = game.result.scores.find((s) => s.userId === game.currentUserId);
    const gameName = GAME_CATALOG.find((g) => g.id === started.gameId)?.name ?? started.gameId;
    saveLocalMatch({
      gameId: started.gameId,
      gameName,
      mode: started.mode === "vs-ai" ? "vs-ai" : "local",
      outcome:
        game.result.reason === "draw"
          ? "draw"
          : game.result.winnerId === game.currentUserId
          ? "win"
          : "loss",
      durationSeconds: game.result.durationSeconds,
      playedAt: game.result.completedAt,
      aiLevel: started.mode === "vs-ai" ? started.aiLevel : undefined,
      score: meScore?.score,
    });
  }, [game.result, game.currentUserId, started]);

  const handleBackClick = () => {
    if (game.result) {
      onExit();
    } else {
      setShowExitConfirm(true);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14]">
      {/* Exit Confirmation Dialog */}
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Chess"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Top Floating Control Bar */}
      <div className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2 sm:py-2.5 border-b border-white/5 bg-[#090A14]/90 backdrop-blur-md">
        <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 border-white/10 text-white hover:bg-white/10 text-xs sm:text-sm" onClick={handleBackClick}>
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">All modes</span>
          <span className="sm:hidden">Exit</span>
        </Button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Badge variant="success" className="hidden sm:inline-flex gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px]">
            <WifiOff className="h-3 w-3" />
            Offline
          </Badge>
          <Badge variant="secondary" className="gap-1 bg-white/10 text-white border border-white/10 text-[11px]">
            {started.mode === "vs-ai" ? (
              <>
                <Bot className="h-3 w-3 text-[#A855F7]" />
                Level {started.aiLevel}
              </>
            ) : (
              "Pass & Play"
            )}
          </Badge>
          <Button variant="outline" size="sm" className="gap-1.5 border-white/10 text-white hover:bg-white/10 text-xs sm:text-sm px-2.5 sm:px-3" onClick={game.restart}>
            <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Restart</span>
          </Button>
        </div>
      </div>

      {game.error && (
        <div
          role="alert"
          className="absolute top-14 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-red-900/60 bg-red-950/90 p-3 text-sm text-red-200 shadow-2xl"
        >
          {game.error}
        </div>
      )}

      {game.isThinking && (
        <div role="status" className="absolute top-14 right-6 z-50 flex items-center gap-2 rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/40 px-3 py-1 text-xs font-bold text-[#C084FC] shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>AI is thinking…</span>
        </div>
      )}

      {game.result && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md px-4">
            <MatchResult
              result={game.result}
              players={game.players}
              currentUserId={game.currentUserId}
              onRematch={game.restart}
              rematchLabel="Play again"
              onExit={onExit}
            />
          </div>
        </div>
      )}

      {/* Main Full-Screen Game View */}
      <div className="relative flex flex-1 w-full h-full overflow-y-auto">
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
      </div>
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
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const savedRef = React.useRef(false);

  // Persist finished game to local history
  React.useEffect(() => {
    if (!game.result || savedRef.current) return;
    savedRef.current = true;
    const meScore = game.result.scores.find((s) => s.userId === game.currentUserId);
    const gameName = GAME_CATALOG.find((g) => g.id === gameId)?.name ?? gameId;
    saveLocalMatch({
      gameId,
      gameName,
      mode: mode === "vs-ai" ? "vs-ai" : "local",
      outcome:
        game.result.reason === "draw"
          ? "draw"
          : game.result.winnerId === game.currentUserId
          ? "win"
          : "loss",
      durationSeconds: game.result.durationSeconds,
      playedAt: game.result.completedAt,
      aiLevel: mode === "vs-ai" ? aiLevel : undefined,
      score: meScore?.score,
    });
  }, [game.result, game.currentUserId, gameId, mode, aiLevel]);
  const isNoMercy = gameId === "uno-no-mercy";

  const handleBackClick = () => {
    if (game.result) {
      onExit();
    } else {
      setShowExitConfirm(true);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14]">
      {/* Exit Confirmation Dialog */}
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName={isNoMercy ? "UNO No Mercy" : "UNO"}
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {game.error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-xs text-destructive shadow-lg">
          {game.error}
        </div>
      )}

      {game.result && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md px-4">
            <MatchResult
              result={game.result}
              players={game.players}
              currentUserId={game.currentUserId}
              onRematch={game.restart}
              rematchLabel="Play again"
              onExit={onExit}
            />
          </div>
        </div>
      )}

      <UnoGameView
        gameState={game.view}
        players={game.players}
        currentUserId={game.currentUserId}
        isOpponentThinking={game.isThinking}
        noMercy={isNoMercy}
        lastResult={null}
        onPlayCard={game.playCard}
        onDrawCard={game.drawCard}
        onPass={game.pass}
        onRematch={game.restart}
        onExit={handleBackClick}
      />
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
  mode: LocalMode | "career";
  aiLevel: AiLevel;
  onExit: () => void;
}) {
  const isBike = gameId === "bike-race";
  const raceMode = mode === "career" ? "career" : mode === "vs-ai" ? "vs-ai" : "time-trial";
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14]">
      {/* Exit Confirmation Dialog */}
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName={isBike ? "Bike Race" : "Car Race"}
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Top Floating Control Bar */}
      <div className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2 sm:py-2.5 border-b border-white/5 bg-[#090A14]/90 backdrop-blur-md">
        <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 border-white/10 text-white hover:bg-white/10 text-xs sm:text-sm" onClick={() => setShowExitConfirm(true)}>
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">All modes</span>
          <span className="sm:hidden">Exit</span>
        </Button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Badge variant="success" className="hidden sm:inline-flex gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px]">
            <WifiOff className="h-3 w-3" />
            Offline
          </Badge>
          <Badge variant="secondary" className="bg-white/10 text-white border border-white/10 text-[11px]">{isBike ? "Bike Race" : "Car Race"}</Badge>
          <Badge variant="secondary" className="hidden sm:inline-flex bg-white/10 text-white border border-white/10 text-[11px]">
            {raceMode === "career"
              ? "Career"
              : raceMode === "vs-ai"
              ? `AI ${aiLevel}`
              : "Time trial"}
          </Badge>
        </div>
      </div>

      <div className="relative flex flex-1 w-full h-full overflow-hidden">
        <RaceGameView
          gameId={gameId}
          mode={raceMode}
          aiLevel={aiLevel}
          onExit={() => setShowExitConfirm(true)}
        />
      </div>
    </div>
  );
}
