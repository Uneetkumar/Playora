"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Volume2, VolumeX, Sparkles, Undo2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { readBestScore, commitBestScore } from "./scoring";
import { saveLocalMatch } from "../../hooks/use-local-history";

type Grid = number[][]; // 4x4

const TILE_STYLES: Record<number, { bg: string; text: string; glow?: string }> = {
  2: { bg: "#eee4da", text: "#1e293b" },
  4: { bg: "#ede0c8", text: "#1e293b" },
  8: { bg: "#f97316", text: "#ffffff", glow: "0 0 10px rgba(249,115,22,0.4)" },
  16: { bg: "#ea580c", text: "#ffffff", glow: "0 0 12px rgba(234,88,12,0.5)" },
  32: { bg: "#ef4444", text: "#ffffff", glow: "0 0 14px rgba(239,68,68,0.5)" },
  64: { bg: "#dc2626", text: "#ffffff", glow: "0 0 16px rgba(220,38,38,0.6)" },
  128: { bg: "#eab308", text: "#ffffff", glow: "0 0 20px rgba(234,179,8,0.6)" },
  256: { bg: "#facc15", text: "#1e293b", glow: "0 0 22px rgba(250,204,21,0.7)" },
  512: { bg: "#06b6d4", text: "#ffffff", glow: "0 0 24px rgba(6,182,212,0.7)" },
  1024: { bg: "#8b5cf6", text: "#ffffff", glow: "0 0 26px rgba(139,92,246,0.8)" },
  2048: { bg: "#ec4899", text: "#ffffff", glow: "0 0 30px rgba(236,72,153,0.9)" },
  4096: { bg: "#10b981", text: "#ffffff", glow: "0 0 32px rgba(16,185,129,0.9)" },
};

// Persistent audio context singleton
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function slide2048Line(line: number[]): { line: number[]; points: number; merged: boolean } {
  const nonZero = line.filter((x) => x !== 0);
  const result: number[] = [];
  let points = 0;
  let merged = false;

  let i = 0;
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      const val = nonZero[i]! * 2;
      result.push(val);
      points += val;
      merged = true;
      i += 2;
    } else {
      result.push(nonZero[i]!);
      i += 1;
    }
  }
  while (result.length < 4) result.push(0);
  return { line: result, points, merged };
}

export function canMake2048Move(grid: Grid): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r]![c] === 0) return true;
      if (r + 1 < 4 && grid[r]![c] === grid[r + 1]![c]) return true;
      if (c + 1 < 4 && grid[r]![c] === grid[r]![c + 1]) return true;
    }
  }
  return false;
}

function spawnRandomTile(g: Grid): boolean {
  const emptyCells: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (g[r]![c] === 0) emptyCells.push([r, c]);
    }
  }
  if (emptyCells.length === 0) return false;
  const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)]!;
  g[r]![c] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

function createInitialGrid(): Grid {
  const g = Array(4).fill(0).map(() => Array(4).fill(0));
  spawnRandomTile(g);
  spawnRandomTile(g);
  return g;
}

export function Game2048View({ onExit }: { onExit?: () => void }) {
  const [grid, setGrid] = React.useState<Grid>(() => createInitialGrid());
  const [score, setScore] = React.useState(0);
  const [prevHistory, setPrevHistory] = React.useState<{ grid: Grid; score: number } | null>(null);
  const [bestScore, setBestScore] = React.useState(() => readBestScore("game-2048"));
  const [isWon, setIsWon] = React.useState(false);
  const [keepPlaying, setKeepPlaying] = React.useState(false);
  const [isGameOver, setIsGameOver] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  // Audio synthesis
  const playSound = React.useCallback(
    (type: "slide" | "merge" | "win" | "over" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "slide") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(160, now + 0.05);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === "merge") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === "win") {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "triangle";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
            noteGain.gain.setValueAtTime(0.2, now + idx * 0.1);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.1);
            noteOsc.stop(now + idx * 0.1 + 0.3);
          });
        } else if (type === "over") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.linearRampToValueAtTime(90, now + 0.3);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
        } else if (type === "click") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
        }
      } catch {
        // audio fail
      }
    },
    [soundEnabled]
  );

  const move = React.useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (isGameOver) return;

      let changed = false;
      let totalGained = 0;
      let hasMerged = false;
      const newGrid = grid.map((r) => [...r]);

      if (direction === "left") {
        for (let r = 0; r < 4; r++) {
          const res = slide2048Line(newGrid[r]!);
          if (res.merged) hasMerged = true;
          totalGained += res.points;
          if (res.line.some((val, idx) => val !== newGrid[r]![idx])) changed = true;
          newGrid[r] = res.line;
        }
      } else if (direction === "right") {
        for (let r = 0; r < 4; r++) {
          const reversed = [...newGrid[r]!].reverse();
          const res = slide2048Line(reversed);
          if (res.merged) hasMerged = true;
          totalGained += res.points;
          const finalLine = res.line.reverse();
          if (finalLine.some((val, idx) => val !== newGrid[r]![idx])) changed = true;
          newGrid[r] = finalLine;
        }
      } else if (direction === "up") {
        for (let c = 0; c < 4; c++) {
          const col = [newGrid[0]![c]!, newGrid[1]![c]!, newGrid[2]![c]!, newGrid[3]![c]!];
          const res = slide2048Line(col);
          if (res.merged) hasMerged = true;
          totalGained += res.points;
          for (let r = 0; r < 4; r++) {
            if (newGrid[r]![c] !== res.line[r]) changed = true;
            newGrid[r]![c] = res.line[r]!;
          }
        }
      } else if (direction === "down") {
        for (let c = 0; c < 4; c++) {
          const col = [newGrid[3]![c]!, newGrid[2]![c]!, newGrid[1]![c]!, newGrid[0]![c]!];
          const res = slide2048Line(col);
          if (res.merged) hasMerged = true;
          totalGained += res.points;
          for (let r = 0; r < 4; r++) {
            const rowIdx = 3 - r;
            if (newGrid[rowIdx]![c] !== res.line[r]) changed = true;
            newGrid[rowIdx]![c] = res.line[r]!;
          }
        }
      }

      if (changed) {
        setPrevHistory({ grid: grid.map((r) => [...r]), score });
        spawnRandomTile(newGrid);
        setGrid(newGrid);

        const newScore = score + totalGained;
        setScore(newScore);
        if (newScore > bestScore) {
          setBestScore(newScore);
          commitBestScore("game-2048", newScore);
        }

        if (hasMerged) playSound("merge");
        else playSound("slide");

        // Win check (2048)
        if (!isWon && newGrid.some((row) => row.some((val) => val === 2048))) {
          setIsWon(true);
          playSound("win");
        }

        // Game over check
        const canMove = canMake2048Move(newGrid);

        if (!canMove) {
          setIsGameOver(true);
          playSound("over");
          commitBestScore("game-2048", newScore);
          if (!matchRecordedRef.current) {
            matchRecordedRef.current = true;
            const duration = Math.max(15, Math.round((Date.now() - startTimeRef.current) / 1000));
            saveLocalMatch({
              gameId: "game-2048",
              gameName: "2048",
              mode: "solo",
              outcome: "win",
              durationSeconds: duration,
              playedAt: Date.now(),
              score: newScore,
            });
          }
        }
      }
    },
    [grid, score, bestScore, isWon, isGameOver, playSound]
  );

  // Undo move
  const handleUndo = () => {
    if (!prevHistory || isGameOver) return;
    setGrid(prevHistory.grid);
    setScore(prevHistory.score);
    setPrevHistory(null);
    playSound("click");
  };

  // Reset game
  const resetGame = React.useCallback(() => {
    setGrid(createInitialGrid());
    setScore(0);
    setPrevHistory(null);
    setIsWon(false);
    setKeepPlaying(false);
    setIsGameOver(false);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    playSound("click");
  }, [playSound]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "KeyW"].includes(e.code)) {
        e.preventDefault();
        move("up");
      } else if (["ArrowDown", "KeyS"].includes(e.code)) {
        e.preventDefault();
        move("down");
      } else if (["ArrowLeft", "KeyA"].includes(e.code)) {
        e.preventDefault();
        move("left");
      } else if (["ArrowRight", "KeyD"].includes(e.code)) {
        e.preventDefault();
        move("right");
      } else if (e.key === " " || e.key === "Enter") {
        if (isGameOver) {
          e.preventDefault();
          resetGame();
        } else if (isWon && !keepPlaying) {
          e.preventDefault();
          setKeepPlaying(true);
        }
      } else if (e.key === "r" || e.key === "R") {
        resetGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move, isGameOver, isWon, keepPlaying, resetGame]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const threshold = 35;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > threshold) {
        move(dx > 0 ? "right" : "left");
      }
    } else {
      if (Math.abs(dy) > threshold) {
        move(dy > 0 ? "down" : "up");
      }
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="2048"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Control Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/10 bg-[#090A14]/90 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (score === 0 ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">2048</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
              Puzzle
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {prevHistory && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              className="gap-1 text-xs border-white/15 hover:border-white/30 text-white/90"
              title="Undo last move"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-8 w-8 p-0 text-white/60 hover:text-white"
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-white/40" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={resetGame}
            className="gap-1 text-xs border-white/15 hover:border-white/30 text-white/90"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </Button>
        </div>
      </header>

      {/* Main Arena */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Score & Best Cards */}
        <div className="mb-3 flex items-center justify-between w-full max-w-[min(90vw,70vh,480px)]">
          <div className="text-xs text-white/50 font-semibold hidden xs:block">
            Swipe or use arrow keys!
          </div>
          <div className="flex gap-2 ml-auto">
            <div className="bg-white/[0.04] px-4 py-1.5 rounded-xl border border-white/10 flex flex-col items-center shadow-lg">
              <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Score</span>
              <span className="text-base font-black text-white tabular-nums">{score}</span>
            </div>
            <div className="bg-white/[0.04] px-4 py-1.5 rounded-xl border border-white/10 flex flex-col items-center shadow-lg">
              <span className="text-[9px] font-bold text-amber-400/80 uppercase tracking-widest">Best</span>
              <span className="text-base font-black text-amber-400 tabular-nums">{bestScore}</span>
            </div>
          </div>
        </div>

        {/* 4x4 Grid Board */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative aspect-square w-full max-w-[min(90vw,70vh,480px)] p-3 sm:p-4 rounded-3xl bg-[#121428]/95 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl touch-none"
        >
          <div className="grid grid-cols-4 grid-rows-4 h-full w-full gap-2 sm:gap-2.5">
            {grid.map((row, r) =>
              row.map((val, c) => {
                const styling = val > 0 ? TILE_STYLES[val] || { bg: "#ec4899", text: "#ffffff" } : null;
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`relative flex items-center justify-center rounded-2xl font-black transition-all duration-150 select-none ${
                      val > 0
                        ? "shadow-lg scale-100 animate-in zoom-in-75 duration-100"
                        : "bg-[#181a33]/60 border border-white/5"
                    }`}
                    style={
                      styling
                        ? {
                            backgroundColor: styling.bg,
                            color: styling.text,
                            boxShadow: styling.glow ?? undefined,
                            fontSize:
                              val >= 10000 ? "1.1rem" : val >= 1000 ? "1.3rem" : val >= 100 ? "1.6rem" : "1.9rem",
                          }
                        : {}
                    }
                  >
                    {val > 0 ? val : ""}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Mobile On-Screen Arrow Controls */}
        <div className="mt-3 flex sm:hidden flex-col items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 rounded-xl bg-white/5 border-white/15 active:bg-white/20"
            onClick={() => move("up")}
            aria-label="Slide Up"
          >
            <ChevronUp className="h-5 w-5 text-white" />
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 rounded-xl bg-white/5 border-white/15 active:bg-white/20"
              onClick={() => move("left")}
              aria-label="Slide Left"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 rounded-xl bg-white/5 border-white/15 active:bg-white/20"
              onClick={() => move("down")}
              aria-label="Slide Down"
            >
              <ChevronDown className="h-5 w-5 text-white" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 rounded-xl bg-white/5 border-white/15 active:bg-white/20"
              onClick={() => move("right")}
              aria-label="Slide Right"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>

        {/* Game Over / Win Announcement */}
        {(isGameOver || (isWon && !keepPlaying)) && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="flex items-center gap-2 text-emerald-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
              <Sparkles className="h-5 w-5" />
              {isWon ? "Legendary 2048 Reached!" : "Game Over! Board Full"}
            </span>
            <div className="flex gap-2">
              {isWon && !isGameOver && (
                <Button
                  onClick={() => setKeepPlaying(true)}
                  variant="outline"
                  className="gap-2 border-white/20 text-white font-bold px-5 py-2 rounded-xl"
                >
                  Keep Going
                </Button>
              )}
              <Button
                onClick={resetGame}
                className="gap-2 bg-gradient-to-r from-amber-500 to-pink-500 text-white font-bold px-6 py-2 rounded-xl shadow-lg"
              >
                <RotateCcw className="h-4 w-4" />
                {isWon && !isGameOver ? "New Game" : "Try Again"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
