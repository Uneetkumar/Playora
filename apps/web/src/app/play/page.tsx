"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Badge } from "@playden/ui";
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
} from "lucide-react";
import { AI_LEVELS, AI_LEVEL_LABELS, RECOMMENDED_AI_LEVEL } from "@playden/bot-engine";
import type { AiLevel } from "@playden/bot-engine";
import { getPlayModes, type PlayMode, type PlayModeId } from "../../lib/play/modes";
import { ChessGameView } from "../../games/chess/ChessGameView";
import { useLocalGame, type LocalMode } from "../../lib/local/use-local-game";

const MODE_ICONS: Record<PlayModeId, React.ComponentType<{ className?: string }>> = {
  "offline-ai": Bot,
  "offline-local": Users,
  "online-friends": UserPlus,
  "online-random": Shuffle,
  "online-ai": Bot,
  lan: Radio,
};

type Started = { mode: LocalMode; aiLevel: AiLevel } | null;

export default function PlayPage() {
  const [started, setStarted] = React.useState<Started>(null);

  if (started) {
    return <LocalMatch started={started} onExit={() => setStarted(null)} />;
  }
  return <PlayHub onStartLocal={(mode, aiLevel) => setStarted({ mode, aiLevel })} />;
}

function PlayHub({
  onStartLocal,
}: {
  onStartLocal: (mode: LocalMode, aiLevel: AiLevel) => void;
}) {
  const router = useRouter();
  const [aiLevel, setAiLevel] = React.useState<AiLevel>(RECOMMENDED_AI_LEVEL);
  const modes = React.useMemo(() => getPlayModes("chess"), []);

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
        router.push("/rooms?game=chess");
        return;
      default:
        return;
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="pb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Play Chess
        </h1>
        <p className="mt-2 text-slate-400">
          Pick how you want to play. The first two need no account and no internet.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {ready.map((mode) => {
          const Icon = MODE_ICONS[mode.id];
          const isAi = mode.id === "offline-ai";
          return (
            <Card key={mode.id} className="border-slate-800 bg-slate-900/70">
              <CardContent className="flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20">
                      <Icon className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white">{mode.label}</h2>
                      <p className="text-xs text-slate-400">{mode.tagline}</p>
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
                    <legend className="text-xs font-semibold text-slate-300">Difficulty</legend>
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
                              ? "border-indigo-400 bg-indigo-600 text-white"
                              : "border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-500"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
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
                    <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
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
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Coming soon
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {later.map((mode) => {
              const Icon = MODE_ICONS[mode.id];
              return (
                <div
                  key={mode.id}
                  className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-300">{mode.label}</h3>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">{mode.note ?? mode.tagline}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
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
        <div role="status" className="mb-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>AI is thinking…</span>
        </div>
      )}

      <ChessGameView
        gameState={game.view}
        players={game.players}
        currentUserId={game.currentUserId}
        lastResult={game.result}
        onMakeMove={game.makeMove}
        onResign={game.resign}
        onOfferDraw={game.offerDraw}
        onAcceptDraw={game.acceptDraw}
        onDeclineDraw={game.declineDraw}
        onRematch={game.restart}
      />

      <p className="mt-6 text-center text-xs text-slate-500">
        Want a rated game?{" "}
        <Link href="/rooms?game=chess" className="text-indigo-400 hover:underline">
          Play online with a friend
        </Link>
      </p>
    </div>
  );
}
