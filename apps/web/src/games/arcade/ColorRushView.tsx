"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw, Zap } from "lucide-react";

type ColorKey = "cyan" | "red" | "green" | "yellow";

const COLORS: Record<ColorKey, { name: string; hex: string; bg: string }> = {
  cyan: { name: "Cyan", hex: "#06b6d4", bg: "bg-cyan-500" },
  red: { name: "Red", hex: "#ef4444", bg: "bg-rose-500" },
  green: { name: "Green", hex: "#10b981", bg: "bg-emerald-500" },
  yellow: { name: "Yellow", hex: "#f59e0b", bg: "bg-amber-500" },
};

const COLOR_KEYS: ColorKey[] = ["cyan", "red", "green", "yellow"];

export function ColorRushView({ onExit }: { onExit?: () => void }) {
  const [score, setScore] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [currentOrbs, setCurrentOrbs] = React.useState<Array<{ id: number; color: ColorKey; y: number }>>([]);
  const [gameOver, setGameOver] = React.useState(false);

  // Spawn loop
  React.useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      const randomColor = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)]!;
      setCurrentOrbs((curr) => [...curr, { id: Date.now() + Math.random(), color: randomColor, y: 0 }]);
    }, 1100);

    return () => clearInterval(interval);
  }, [gameOver]);

  // Falling movement loop
  React.useEffect(() => {
    if (gameOver) return;

    const tick = setInterval(() => {
      setCurrentOrbs((curr) => {
        const next: Array<{ id: number; color: ColorKey; y: number }> = [];
        for (const orb of curr) {
          const nextY = orb.y + 2.5;
          if (nextY >= 75) {
            // Reached prism: verify if current matching quadrant was active
            // Missed!
            setGameOver(true);
          } else {
            next.push({ ...orb, y: nextY });
          }
        }
        return next;
      });
    }, 40);

    return () => clearInterval(tick);
  }, [gameOver]);

  const matchColor = (color: ColorKey) => {
    if (gameOver || currentOrbs.length === 0) return;

    const targetOrb = currentOrbs[0];
    if (targetOrb && targetOrb.color === color) {
      // Successful match!
      setCurrentOrbs((curr) => curr.slice(1));
      setScore((s) => s + 10 * (1 + streak * 0.2));
      setStreak((st) => st + 1);
    } else {
      // Wrong match
      setGameOver(true);
    }
  };

  const restart = () => {
    setScore(0);
    setStreak(0);
    setCurrentOrbs([]);
    setGameOver(false);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#2e1065] via-[#17072e] to-[#0b0217] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-cyan-400 uppercase tracking-widest">
            REFLEX SPEED
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">COLOR RUSH</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-black text-amber-300">
            SCORE: {score}
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-cyan-300">
            STREAK: {streak}🔥
          </div>
        </div>
      </div>

      {/* Falling Arena */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-2xl flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center p-4 sm:p-6"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(20,5,40,0.65), rgba(10,2,20,0.9)), url('/games/color-rush-thumb.jpg')`,
        }}
      >
        {/* Falling Orbs */}
        <div className="relative flex-1 w-full min-h-[220px]">
          {currentOrbs.map((orb) => (
            <div
              key={orb.id}
              style={{ top: `${orb.y}%`, left: "50%" }}
              className={cn(
                "absolute -translate-x-1/2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white shadow-[0_0_25px_currentColor] transition-all",
                COLORS[orb.color].bg
              )}
            >
              <span className="h-3 w-3 rounded-full bg-white animate-ping" />
            </div>
          ))}
        </div>

        {/* Target Prism Ring */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 bg-black/60 shadow-[0_0_30px_rgba(168,85,247,0.5)]">
          <Zap className="h-8 w-8 text-cyan-400 animate-pulse" />
        </div>

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-white mt-2">RUN COMPLETED</h3>
            <p className="text-sm text-white/70">Final Score: <strong className="text-cyan-400">{score}</strong></p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        )}
      </div>

      {/* 4 Quadrant Match Buttons */}
      <div className="grid w-full max-w-md grid-cols-4 gap-3 border-t border-white/10 pt-4">
        {COLOR_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => matchColor(k)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-2xl py-3 font-display text-xs font-black uppercase text-white shadow-xl transition-transform active:scale-90",
              COLORS[k].bg
            )}
          >
            <span>{COLORS[k].name}</span>
          </button>
        ))}
      </div>

      {/* Footer controls */}
      <div className="flex w-full items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={restart} className="gap-2 text-white/70 hover:text-white">
          <RotateCcw className="h-4 w-4" /> Restart
        </Button>
        {onExit && (
          <Button variant="outline" size="sm" onClick={onExit} className="border-white/20 text-white">
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}
