"use client";

import * as React from "react";
import { Button } from "@playora/ui";
import { Trophy, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

interface IceRacer {
  id: string;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  alive: boolean;
  color: string;
}

export function IceBreakerView({ onExit }: { onExit?: () => void }) {
  const [racers, setRacers] = React.useState<IceRacer[]>([
    { id: "p1", name: "You", isBot: false, x: 50, y: 50, alive: true, color: "#06b6d4" },
    { id: "p2", name: "BlizzardBot", isBot: true, x: 25, y: 35, alive: true, color: "#ef4444" },
    { id: "p3", name: "FrostKing", isBot: true, x: 75, y: 35, alive: true, color: "#a855f7" },
    { id: "p4", name: "PolarAce", isBot: true, x: 50, y: 75, alive: true, color: "#f59e0b" },
  ]);

  const [iceRadius, setIceRadius] = React.useState(42);
  const [gameOver, setGameOver] = React.useState(false);
  const [winner, setWinner] = React.useState<string | null>(null);

  // Shrinking iceberg loop
  React.useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      setIceRadius((r) => Math.max(18, r - 0.5));
    }, 1200);

    return () => clearInterval(interval);
  }, [gameOver]);

  // Physics check: if outside iceRadius -> eliminated into water!
  React.useEffect(() => {
    if (gameOver) return;

    setRacers((curr) => {
      const next = curr.map((racer) => {
        if (!racer.alive) return racer;
        const dx = racer.x - 50;
        const dy = racer.y - 50;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > iceRadius) {
          return { ...racer, alive: false };
        }
        return racer;
      });

      const aliveRemaining = next.filter((r) => r.alive);
      if (aliveRemaining.length <= 1) {
        setGameOver(true);
        setWinner(aliveRemaining[0]?.name ?? "Nobody");
      }

      return next;
    });
  }, [iceRadius, racers, gameOver]);

  // AI bots move & bump
  React.useEffect(() => {
    if (gameOver) return;

    const aiLoop = setInterval(() => {
      setRacers((curr) =>
        curr.map((racer) => {
          if (!racer.alive || !racer.isBot) return racer;
          // Random nudge towards center or player
          const dx = (Math.random() - 0.5) * 6;
          const dy = (Math.random() - 0.5) * 6;
          return {
            ...racer,
            x: Math.max(10, Math.min(90, racer.x + dx)),
            y: Math.max(10, Math.min(90, racer.y + dy)),
          };
        })
      );
    }, 400);

    return () => clearInterval(aiLoop);
  }, [gameOver]);

  const movePlayer = (dx: number, dy: number) => {
    if (gameOver) return;
    setRacers((curr) =>
      curr.map((racer) => {
        if (racer.id !== "p1" || !racer.alive) return racer;
        const nextX = Math.max(5, Math.min(95, racer.x + dx));
        const nextY = Math.max(5, Math.min(95, racer.y + dy));

        // Push opponents if close (bump!)
        return { ...racer, x: nextX, y: nextY };
      })
    );

    // Bump nearby bots
    setRacers((curr) => {
      const player = curr.find((r) => r.id === "p1");
      if (!player || !player.alive) return curr;

      return curr.map((racer) => {
        if (racer.id === "p1" || !racer.alive) return racer;
        const dist = Math.hypot(racer.x - player.x, racer.y - player.y);
        if (dist < 10) {
          // Bump away!
          return {
            ...racer,
            x: racer.x + dx * 2.2,
            y: racer.y + dy * 2.2,
          };
        }
        return racer;
      });
    });
  };

  const restart = () => {
    setRacers([
      { id: "p1", name: "You", isBot: false, x: 50, y: 50, alive: true, color: "#06b6d4" },
      { id: "p2", name: "BlizzardBot", isBot: true, x: 25, y: 35, alive: true, color: "#ef4444" },
      { id: "p3", name: "FrostKing", isBot: true, x: 75, y: 35, alive: true, color: "#a855f7" },
      { id: "p4", name: "PolarAce", isBot: true, x: 50, y: 75, alive: true, color: "#f59e0b" },
    ]);
    setIceRadius(42);
    setGameOver(false);
    setWinner(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#0369a1] via-[#075985] to-[#082f49] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-cyan-300 uppercase tracking-widest">
            ARCTIC BUMPER ARENA
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">ICE BREAKER</h2>
        </div>

        <div className="rounded-xl border border-cyan-400/30 bg-cyan-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-cyan-300">
          ICEBERG: {Math.round(iceRadius * 2)}%
        </div>
      </div>

      {/* Main Arctic Arena Viewport */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 aspect-square max-h-[380px] sm:max-h-[460px] w-full max-w-xl items-center justify-center overflow-hidden rounded-full border-4 border-cyan-300/40 shadow-2xl bg-cover bg-center select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(5,50,85,0.65), rgba(2,20,40,0.9)), url('/games/ice-breaker-thumb.jpg')`,
        }}
      >
        {/* Floating Iceberg Disc */}
        <div
          style={{ width: `${iceRadius * 2}%`, height: `${iceRadius * 2}%` }}
          className="relative flex items-center justify-center rounded-full border-2 border-white/80 bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] shadow-[0_0_40px_rgba(255,255,255,0.4)] transition-all duration-700"
        >
          {/* Fissure Cracks */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>

        {/* Racers */}
        {racers.map((racer) => {
          if (!racer.alive) {
            return (
              <div
                key={racer.id}
                style={{ left: `${racer.x}%`, top: `${racer.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-cyan-200 opacity-40"
              >
                🌊 {racer.name}
              </div>
            );
          }

          return (
            <div
              key={racer.id}
              style={{ left: `${racer.x}%`, top: `${racer.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-all duration-100"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-xl text-sm"
                style={{ backgroundColor: racer.color }}
              >
                {racer.id === "p1" ? "🛷" : "🐧"}
              </div>
              <span className="text-[9px] font-black text-black bg-white/80 px-1 rounded shadow-sm">
                {racer.name}
              </span>
            </div>
          );
        })}

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md rounded-full">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-white mt-2">WINNER: {winner}</h3>
            <p className="text-sm text-white/70">Last survivor standing on the arctic floe!</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Play Again
            </Button>
          </div>
        )}
      </div>

      {/* Directional Pad */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">Use direction keys to ram opponents off the ice!</p>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => movePlayer(-6, 0)} className="border-white/20 text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="sm" onClick={() => movePlayer(0, -6)} className="border-white/20 text-white">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => movePlayer(0, 6)} className="border-white/20 text-white">
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => movePlayer(6, 0)} className="border-white/20 text-white">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {onExit && (
          <Button variant="outline" onClick={onExit} className="border-white/20 text-white">
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}
