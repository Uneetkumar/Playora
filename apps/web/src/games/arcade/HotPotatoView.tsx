"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw, Flame } from "lucide-react";

interface PotatoPlayer {
  id: string;
  name: string;
  isBot: boolean;
  avatar: string;
  eliminated: boolean;
}

export function HotPotatoView({ onExit }: { onExit?: () => void }) {
  const [players, setPlayers] = React.useState<PotatoPlayer[]>([
    { id: "p1", name: "You", isBot: false, avatar: "😎", eliminated: false },
    { id: "p2", name: "SpudLord", isBot: true, avatar: "🤠", eliminated: false },
    { id: "p3", name: "ChefPip", isBot: true, avatar: "👨‍🍳", eliminated: false },
    { id: "p4", name: "TaterTot", isBot: true, avatar: "🥔", eliminated: false },
    { id: "p5", name: "ButterAce", isBot: true, avatar: "🧈", eliminated: false },
  ]);

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [, setTimerSeconds] = React.useState(7.0);
  const [gameOver, setGameOver] = React.useState(false);
  const [winner, setWinner] = React.useState<string | null>(null);

  // Hidden countdown timer
  React.useEffect(() => {
    if (gameOver) return;

    const timer = setInterval(() => {
      setTimerSeconds((t) => {
        if (t <= 0.1) {
          // Explode on active holder!
          setPlayers((curr) => {
            const next = curr.map((p, idx) => (idx === currentIndex ? { ...p, eliminated: true } : p));
            const remaining = next.filter((p) => !p.eliminated);

            if (remaining.length <= 1) {
              setGameOver(true);
              setWinner(remaining[0]?.name ?? "None");
            }
            return next;
          });

          // Pick next remaining player
          setCurrentIndex((idx) => (idx + 1) % 5);
          return Math.random() * 6 + 4; // Reset to random 4-10s
        }
        return Math.max(0, t - 0.1);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [gameOver, currentIndex]);

  // AI bot auto-pass
  React.useEffect(() => {
    if (gameOver) return;

    const activePlayer = players[currentIndex];
    if (activePlayer && activePlayer.isBot && !activePlayer.eliminated) {
      const delay = Math.random() * 800 + 400;
      const t = setTimeout(() => {
        passPotato();
      }, delay);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [currentIndex, players, gameOver]);

  const passPotato = () => {
    if (gameOver) return;
    let nextIdx = (currentIndex + 1) % players.length;
    while (players[nextIdx]?.eliminated) {
      nextIdx = (nextIdx + 1) % players.length;
    }
    setCurrentIndex(nextIdx);
  };

  const restart = () => {
    setPlayers([
      { id: "p1", name: "You", isBot: false, avatar: "😎", eliminated: false },
      { id: "p2", name: "SpudLord", isBot: true, avatar: "🤠", eliminated: false },
      { id: "p3", name: "ChefPip", isBot: true, avatar: "👨‍🍳", eliminated: false },
      { id: "p4", name: "TaterTot", isBot: true, avatar: "🥔", eliminated: false },
      { id: "p5", name: "ButterAce", isBot: true, avatar: "🧈", eliminated: false },
    ]);
    setCurrentIndex(0);
    setTimerSeconds(7.0);
    setGameOver(false);
    setWinner(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#451a03] via-[#270d02] to-[#120501] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-widest">
            PARTY CIRCLE GAME
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">HOT POTATO</h2>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5 animate-pulse">
          <Flame className="h-4 w-4 text-amber-400" /> SIZZLING!
        </div>
      </div>

      {/* Circle Arena */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 aspect-square max-h-[380px] sm:max-h-[460px] w-full max-w-xl items-center justify-center rounded-full border-4 border-amber-500/30 shadow-2xl bg-cover bg-center p-4 sm:p-6 select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(40,15,5,0.65), rgba(15,5,2,0.9)), url('/games/hot-potato-thumb.jpg')`,
        }}
      >
        {players.map((p, idx) => {
          const angle = (idx / players.length) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + 36 * Math.cos(angle);
          const y = 50 + 36 * Math.sin(angle);
          const isHolding = currentIndex === idx;

          if (p.eliminated) {
            return (
              <div
                key={p.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 opacity-30 text-xs line-through text-slate-500"
              >
                💥 {p.name}
              </div>
            );
          }

          return (
            <div
              key={p.id}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 rounded-2xl border p-2.5 transition-all",
                isHolding
                  ? "border-amber-400 bg-amber-950/80 shadow-[0_0_25px_rgba(245,158,11,0.8)] scale-110 animate-bounce"
                  : "border-white/15 bg-black/60"
              )}
            >
              <div className="text-2xl">{isHolding ? "🥔🔥" : p.avatar}</div>
              <span className="text-[10px] font-bold text-white">{p.name}</span>
            </div>
          );
        })}

        {/* Center Prompt */}
        <div className="flex flex-col items-center text-center">
          {currentIndex === 0 && !players[0]?.eliminated ? (
            <button
              type="button"
              onClick={passPotato}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 font-display text-sm font-black uppercase text-white shadow-2xl transition-all active:scale-90 animate-pulse"
            >
              🔥 TOSS POTATO! 🔥
            </button>
          ) : (
            <span className="text-xs font-bold text-white/50">Passing in circle...</span>
          )}
        </div>

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md rounded-full">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-white mt-2">WINNER: {winner}</h3>
            <p className="text-sm text-white/70">Survived the sizzling potato party!</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Play Again
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">Tap Toss Potato quickly when it reaches your hands!</p>

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
