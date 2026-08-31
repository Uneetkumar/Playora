"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw, Clock } from "lucide-react";

interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
  type: "bullseye" | "gold" | "tnt";
}

export function TargetRushView({ onExit }: { onExit?: () => void }) {
  const [score, setScore] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(45);
  const [combo, setCombo] = React.useState(0);
  const [targets, setTargets] = React.useState<Target[]>([]);
  const [gameOver, setGameOver] = React.useState(false);

  // Timer loop
  React.useEffect(() => {
    if (gameOver) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameOver]);

  // Target spawning loop
  React.useEffect(() => {
    if (gameOver) return;

    const spawner = setInterval(() => {
      setTargets((curr) => {
        if (curr.length >= 6) return curr;
        const isGold = Math.random() < 0.2;
        const isTnt = Math.random() < 0.15;
        const newTarget: Target = {
          id: Date.now() + Math.random(),
          x: Math.random() * 75 + 12,
          y: Math.random() * 65 + 15,
          size: isGold ? 36 : isTnt ? 42 : 48,
          type: isGold ? "gold" : isTnt ? "tnt" : "bullseye",
        };
        return [...curr, newTarget];
      });
    }, 650);

    return () => clearInterval(spawner);
  }, [gameOver]);

  const shootTarget = (target: Target) => {
    if (gameOver) return;

    setTargets((curr) => curr.filter((t) => t.id !== target.id));

    if (target.type === "tnt") {
      setScore((s) => Math.max(0, s - 50));
      setCombo(0);
    } else if (target.type === "gold") {
      setScore((s) => s + 75 * (1 + combo * 0.1));
      setCombo((c) => c + 2);
    } else {
      setScore((s) => s + 25 * (1 + combo * 0.1));
      setCombo((c) => c + 1);
    }
  };

  const restart = () => {
    setScore(0);
    setTimeLeft(45);
    setCombo(0);
    setTargets([]);
    setGameOver(false);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#3b0764] via-[#1e053a] to-[#0f021f] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-widest">
            SHOOTING RANGE
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">TARGET RUSH</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-white">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-400" />
            {timeLeft}s
          </div>
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-black text-purple-300">
            SCORE: {score}
          </div>
          <div className="hidden sm:block rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-amber-300">
            x{combo}🔥
          </div>
        </div>
      </div>

      {/* Main Shooting Range */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-4xl cursor-crosshair items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(25,10,40,0.65), rgba(10,3,20,0.9)), url('/games/target-rush-thumb.jpg')`,
        }}
      >
        {targets.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => shootTarget(t)}
            style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.size}px`, height: `${t.size}px` }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform active:scale-125 shadow-xl flex items-center justify-center animate-pulse",
              t.type === "gold"
                ? "border-amber-300 bg-amber-400 text-amber-950"
                : t.type === "tnt"
                ? "border-rose-500 bg-rose-600 text-white"
                : "border-white bg-gradient-to-br from-rose-500 via-white to-rose-600 text-black font-black"
            )}
          >
            {t.type === "gold" ? "⭐" : t.type === "tnt" ? "💣" : "🎯"}
          </button>
        ))}

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-white mt-2">TIME UP!</h3>
            <p className="text-sm text-white/70">Final Score: <strong className="text-purple-400">{score}</strong></p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Play Again
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">Pop targets quickly to build streaks. Avoid hitting TNT bombs!</p>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={restart} className="gap-2 text-white/70 hover:text-white">
            <RotateCcw className="h-4 w-4" /> Restart
          </Button>
          {onExit && (
            <Button variant="outline" onClick={onExit} className="border-white/20 text-white">
              Exit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
