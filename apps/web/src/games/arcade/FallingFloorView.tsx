"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

interface HexTile {
  id: number;
  row: number;
  col: number;
  layer: number;
  state: "intact" | "shaking" | "collapsed";
}

export function FallingFloorView({ onExit }: { onExit?: () => void }) {
  const [playerLayer, setPlayerLayer] = React.useState(1);
  const [playerRow, setPlayerRow] = React.useState(2);
  const [playerCol, setPlayerCol] = React.useState(2);
  const [tiles, setTiles] = React.useState<HexTile[]>([]);
  const [survivedSecs, setSurvivedSecs] = React.useState(0);
  const [gameOver, setGameOver] = React.useState(false);

  // Initialize grid tiles across 3 layers
  React.useEffect(() => {
    const grid: HexTile[] = [];
    let idCounter = 1;
    for (let layer = 1; layer <= 3; layer++) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          grid.push({
            id: idCounter++,
            row: r,
            col: c,
            layer,
            state: "intact",
          });
        }
      }
    }
    setTiles(grid);
  }, []);

  // Timer loop
  React.useEffect(() => {
    if (gameOver) return;
    const timer = setInterval(() => {
      setSurvivedSecs((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [gameOver]);

  // Handle player standing on tile -> trigger collapse
  React.useEffect(() => {
    if (gameOver || tiles.length === 0) return;

    const currentTile = tiles.find(
      (t) => t.layer === playerLayer && t.row === playerRow && t.col === playerCol
    );

    if (!currentTile || currentTile.state === "collapsed") {
      // Fallen through hole!
      if (playerLayer < 3) {
        setPlayerLayer((l) => l + 1);
      } else {
        // Fallen into abyss!
        setGameOver(true);
      }
      return;
    }

    if (currentTile.state === "intact") {
      // Start shaking
      setTiles((curr) =>
        curr.map((t) => (t.id === currentTile.id ? { ...t, state: "shaking" } : t))
      );

      // Collapse after 800ms
      setTimeout(() => {
        setTiles((curr) =>
          curr.map((t) => (t.id === currentTile.id ? { ...t, state: "collapsed" } : t))
        );
      }, 800);
    }
  }, [playerLayer, playerRow, playerCol, tiles, gameOver]);

  const move = (dr: number, dc: number) => {
    if (gameOver) return;
    const nextR = Math.max(0, Math.min(4, playerRow + dr));
    const nextC = Math.max(0, Math.min(4, playerCol + dc));
    setPlayerRow(nextR);
    setPlayerCol(nextC);
  };

  const restart = () => {
    setPlayerLayer(1);
    setPlayerRow(2);
    setPlayerCol(2);
    setSurvivedSecs(0);
    setGameOver(false);
    setTiles((curr) => curr.map((t) => ({ ...t, state: "intact" })));
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#311042] via-[#180824] to-[#0c0412] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-purple-400 uppercase tracking-widest">
            SURVIVAL KNOCKOUT
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">FALLING FLOOR</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-purple-300">
            LAYER {playerLayer}/3
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-black text-cyan-300">
            TIME: {survivedSecs}s
          </div>
        </div>
      </div>

      {/* Hex Grid Arena */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-2xl items-center justify-center rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center p-3 sm:p-6 select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(20,5,35,0.75), rgba(8,2,15,0.9)), url('/games/falling-floor-thumb.jpg')`,
        }}
      >
        <div className="grid grid-cols-5 gap-2 sm:gap-4 p-2 sm:p-4 rounded-2xl bg-black/60 backdrop-blur-xl border border-purple-500/30 shadow-2xl">
          {Array.from({ length: 5 }).map((_, r) =>
            Array.from({ length: 5 }).map((_, c) => {
              const tile = tiles.find(
                (t) => t.layer === playerLayer && t.row === r && t.col === c
              );
              const isPlayerHere = playerRow === r && playerCol === c;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => {
                    setPlayerRow(r);
                    setPlayerCol(c);
                  }}
                  className={cn(
                    "relative flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-2xl border-2 transition-all duration-300 font-bold backdrop-blur-sm",
                    tile?.state === "collapsed"
                      ? "border-transparent bg-transparent opacity-5 pointer-events-none scale-75"
                      : tile?.state === "shaking"
                      ? "border-rose-400 bg-gradient-to-br from-rose-600/90 to-rose-950/90 shadow-[0_0_25px_rgba(244,63,94,0.9)] animate-bounce"
                      : "border-purple-400/40 bg-gradient-to-br from-purple-900/60 via-purple-950/80 to-black/90 hover:border-purple-300 shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:scale-105",
                    isPlayerHere && "ring-4 ring-cyan-400 ring-offset-4 ring-offset-black shadow-[0_0_30px_#22d3ee]"
                  )}
                >
                  {/* Hexagon internal energy icon */}
                  {tile?.state !== "collapsed" && !isPlayerHere && (
                    <span className="text-[9px] font-mono tracking-tighter text-purple-400/50 uppercase">
                      L{playerLayer}
                    </span>
                  )}
                  {isPlayerHere && (
                    <div className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-cyan-300 text-black text-2xl sm:text-3xl shadow-[0_0_20px_#22d3ee] animate-pulse">
                      🏃
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
            <Trophy className="h-14 w-14 text-amber-400 animate-bounce drop-shadow-[0_0_20px_#f59e0b]" />
            <h3 className="font-display text-4xl font-black text-white mt-3 tracking-tight">FALLEN INTO ABYSS</h3>
            <p className="text-base text-white/70 mt-1">Survived: <strong className="text-cyan-400 font-black">{survivedSecs} seconds</strong></p>
            <Button onClick={restart} className="mt-5 gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-8 py-3 text-base font-black shadow-[0_0_25px_rgba(124,58,237,0.6)]">
              <RotateCcw className="h-5 w-5" /> Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Directional Pad */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">Use arrow controls or click tiles to stay alive!</p>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => move(0, -1)} className="border-white/20 text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="sm" onClick={() => move(-1, 0)} className="border-white/20 text-white">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => move(1, 0)} className="border-white/20 text-white">
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => move(0, 1)} className="border-white/20 text-white">
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
