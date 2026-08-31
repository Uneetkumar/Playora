"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw } from "lucide-react";

interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  alive: boolean;
  color: string;
}

export function BombPassView({ onExit }: { onExit?: () => void }) {
  const [players, setPlayers] = React.useState<PlayerState[]>([
    { id: "p1", name: "You", isBot: false, x: 25, y: 70, alive: true, color: "#06b6d4" },
    { id: "p2", name: "ApexBot", isBot: true, x: 75, y: 30, alive: true, color: "#f59e0b" },
    { id: "p3", name: "CyberAce", isBot: true, x: 30, y: 30, alive: true, color: "#a855f7" },
    { id: "p4", name: "Shadow", isBot: true, x: 70, y: 70, alive: true, color: "#10b981" },
  ]);

  const [bombHolderId, setBombHolderId] = React.useState<string>("p1");
  const [fuseTime, setFuseTime] = React.useState<number>(8.0);
  const [round, setRound] = React.useState<number>(1);
  const [gameOver, setGameOver] = React.useState<boolean>(false);
  const [winner, setWinner] = React.useState<string | null>(null);

  // Fuse countdown
  React.useEffect(() => {
    if (gameOver) return;

    const timer = setInterval(() => {
      setFuseTime((t) => {
        if (t <= 0.1) {
          // Explode current holder!
          setPlayers((curr) => {
            const next = curr.map((p) => (p.id === bombHolderId ? { ...p, alive: false } : p));
            const aliveRemaining = next.filter((p) => p.alive);

            if (aliveRemaining.length <= 1) {
              setGameOver(true);
              setWinner(aliveRemaining[0]?.name ?? "None");
            } else {
              // Pass bomb to random remaining alive player
              const nextHolder = aliveRemaining[Math.floor(Math.random() * aliveRemaining.length)]!;
              setBombHolderId(nextHolder.id);
            }
            return next;
          });
          setRound((r) => r + 1);
          return 7.0;
        }
        return Math.max(0, t - 0.1);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [gameOver, bombHolderId]);

  // AI Bot movement & auto-pass
  React.useEffect(() => {
    if (gameOver) return;

    const aiLoop = setInterval(() => {
      if (bombHolderId !== "p1") {
        // AI has the bomb! Chase another player to pass
        setPlayers((curr) => {
          const alive = curr.filter((p) => p.alive && p.id !== bombHolderId);
          if (alive.length > 0 && Math.random() < 0.35) {
            const target = alive[Math.floor(Math.random() * alive.length)]!;
            setBombHolderId(target.id);
          }
          return curr;
        });
      }
    }, 1200);

    return () => clearInterval(aiLoop);
  }, [gameOver, bombHolderId]);

  const passBombTo = (targetId: string) => {
    if (bombHolderId !== "p1" || gameOver) return;
    setBombHolderId(targetId);
  };

  const restart = () => {
    setPlayers([
      { id: "p1", name: "You", isBot: false, x: 25, y: 70, alive: true, color: "#06b6d4" },
      { id: "p2", name: "ApexBot", isBot: true, x: 75, y: 30, alive: true, color: "#f59e0b" },
      { id: "p3", name: "CyberAce", isBot: true, x: 30, y: 30, alive: true, color: "#a855f7" },
      { id: "p4", name: "Shadow", isBot: true, x: 70, y: 70, alive: true, color: "#10b981" },
    ]);
    setBombHolderId("p1");
    setFuseTime(8.0);
    setRound(1);
    setGameOver(false);
    setWinner(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#450a0a] via-[#1c0505] to-[#0c0202] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-widest">
            PARTY ELIMINATION
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">BOMB PASS</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-3 sm:px-4 py-1 sm:py-1.5 font-display text-base sm:text-xl font-black text-rose-400 animate-pulse">
            💥 {fuseTime.toFixed(1)}s
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-white/80">
            ROUND {round}
          </div>
        </div>
      </div>

      {/* Main Arena */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(25,5,5,0.7), rgba(10,2,2,0.9)), url('/games/bomb-pass-thumb.jpg')`,
        }}
      >
        {players.map((p) => {
          const hasBomb = bombHolderId === p.id;
          if (!p.alive) {
            return (
              <div
                key={p.id}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 opacity-30 text-xs font-bold text-slate-500 line-through"
              >
                💀 {p.name}
              </div>
            );
          }

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => passBombTo(p.id)}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95",
                hasBomb
                  ? "border-rose-400 bg-rose-950/80 shadow-[0_0_30px_rgba(244,63,94,0.8)] scale-110 animate-bounce"
                  : "border-white/15 bg-black/60 hover:border-white/40"
              )}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lg text-lg font-bold"
                style={{ borderColor: p.color, backgroundColor: `${p.color}30` }}
              >
                {hasBomb ? "💣" : p.isBot ? "🤖" : "👑"}
              </div>
              <span className="text-[11px] font-bold text-white">{p.name}</span>
              {hasBomb && (
                <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[8px] font-black text-white uppercase animate-pulse">
                  HOT BOMB!
                </span>
              )}
              {bombHolderId === "p1" && p.id !== "p1" && (
                <span className="rounded bg-cyan-500 px-1.5 py-0.2 text-[8px] font-bold text-black uppercase">
                  TAP TO PASS
                </span>
              )}
            </button>
          );
        })}

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-white mt-2">WINNER: {winner}</h3>
            <p className="text-sm text-white/70">Last player standing survived the blast!</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Play Again
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">
          {bombHolderId === "p1"
            ? "⚠️ YOU HAVE THE BOMB! Tap any player to pass it before time expires!"
            : "Keep distance and survive until the bomb explodes!"}
        </p>

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
