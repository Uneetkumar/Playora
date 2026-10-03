"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Volume2, VolumeX, Flag, Bomb, Clock, Sparkles } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

export interface MinesweeperCell {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

export type Cell = MinesweeperCell;

export function createEmptyMinesweeperGrid(size: number): MinesweeperCell[][] {
  return Array(size).fill(null).map((_, r) =>
    Array(size).fill(null).map((_, c) => ({
      r,
      c,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      neighborMines: 0,
    }))
  );
}

export function populateMinesweeperGrid(
  safeR: number,
  safeC: number,
  gridSize: number,
  totalMines: number,
  currentGrid: MinesweeperCell[][]
): MinesweeperCell[][] {
  const newGrid = currentGrid.map((row) => row.map((cell) => ({ ...cell })));
  let placed = 0;
  const maxPossible = Math.max(1, gridSize * gridSize - 9);
  const targetMines = Math.min(totalMines, maxPossible);
  let attempts = 0;
  while (placed < targetMines && attempts < 1000) {
    attempts++;
    const r = Math.floor(Math.random() * gridSize);
    const c = Math.floor(Math.random() * gridSize);
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    if (!newGrid[r]![c]!.isMine) {
      newGrid[r]![c]!.isMine = true;
      placed++;
    }
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!newGrid[r]![c]!.isMine) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize && newGrid[nr]![nc]!.isMine) {
              count++;
            }
          }
        }
        newGrid[r]![c]!.neighborMines = count;
      }
    }
  }
  return newGrid;
}

export function cascadeReveal(
  r: number,
  c: number,
  gridSize: number,
  activeGrid: MinesweeperCell[][]
): void {
  if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return;
  const cell = activeGrid[r]?.[c];
  if (!cell || cell.isRevealed || cell.isFlagged) return;

  cell.isRevealed = true;
  if (cell.neighborMines === 0 && !cell.isMine) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr !== 0 || dc !== 0) {
          cascadeReveal(r + dr, c + dc, gridSize, activeGrid);
        }
      }
    }
  }
}

export function checkMinesweeperVictory(
  gridSize: number,
  currentGrid: MinesweeperCell[][]
): boolean {
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const item = currentGrid[r]![c]!;
      if (!item.isMine && !item.isRevealed) return false;
    }
  }
  return true;
}

const NUMBER_COLORS: Record<number, string> = {
  1: "#38bdf8", // blue
  2: "#4ade80", // green
  3: "#f87171", // red
  4: "#a855f7", // purple
  5: "#fb923c", // orange
  6: "#2dd4bf", // teal
  7: "#f472b6", // pink
  8: "#cbd5e1", // white/gray
};

type BoardPreset = "easy" | "medium" | "hard";

const PRESETS: Record<BoardPreset, { size: number; mines: number; label: string }> = {
  easy: { size: 8, mines: 10, label: "8x8" },
  medium: { size: 10, mines: 16, label: "10x10" },
  hard: { size: 12, mines: 25, label: "12x12" },
};

// Persistent Web Audio context
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

export function MinesweeperView({ onExit }: { onExit?: () => void }) {
  const [preset, setPreset] = React.useState<BoardPreset>("easy");
  const { size: gridSize, mines: totalMines } = PRESETS[preset];

  const [grid, setGrid] = React.useState<Cell[][]>(() => createEmptyMinesweeperGrid(gridSize));
  const [firstClickDone, setFirstClickDone] = React.useState(false);
  const [isFlagMode, setIsFlagMode] = React.useState(false);
  const [isGameOver, setIsGameOver] = React.useState(false);
  const [isWon, setIsWon] = React.useState(false);
  const [timerSeconds, setTimerSeconds] = React.useState(0);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const didLongPressRef = React.useRef(false);
  const matchRecordedRef = React.useRef(false);

  // Audio synthesis
  const playSound = React.useCallback(
    (type: "click" | "flag" | "boom" | "win" | "chord") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "click") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(780, now + 0.04);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
        } else if (type === "flag") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(580, now);
          osc.frequency.exponentialRampToValueAtTime(920, now + 0.06);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.06);
          osc.start(now);
          osc.stop(now + 0.06);
        } else if (type === "chord") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.exponentialRampToValueAtTime(1040, now + 0.07);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.07);
          osc.start(now);
          osc.stop(now + 0.07);
        } else if (type === "boom") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(130, now);
          osc.frequency.linearRampToValueAtTime(35, now + 0.35);
          gain.gain.setValueAtTime(0.28, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === "win") {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "triangle";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
            noteGain.gain.setValueAtTime(0.18, now + idx * 0.1);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.1);
            noteOsc.stop(now + idx * 0.1 + 0.3);
          });
        }
      } catch {
        // audio fail
      }
    },
    [soundEnabled]
  );

  // Timer tick
  React.useEffect(() => {
    if (!firstClickDone || isGameOver || isWon) return;
    const interval = setInterval(() => {
      setTimerSeconds((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [firstClickDone, isGameOver, isWon]);

  // Match history recording on game over or victory (covers both direct clicks and chord actions)
  React.useEffect(() => {
    if ((!isWon && !isGameOver) || matchRecordedRef.current) return;
    matchRecordedRef.current = true;
    saveLocalMatch({
      gameId: "minesweeper",
      gameName: "Minesweeper",
      mode: "solo",
      outcome: isWon ? "win" : "loss",
      durationSeconds: Math.max(1, timerSeconds),
      playedAt: Date.now(),
      score: isWon ? Math.max(10, 600 - timerSeconds * 2) : 0,
    });
  }, [isWon, isGameOver, timerSeconds]);

  // Generate mines with safe initial radius
  const populateMines = (safeR: number, safeC: number, currentGrid: Cell[][]): Cell[][] => {
    return populateMinesweeperGrid(safeR, safeC, gridSize, totalMines, currentGrid);
  };

  // Cascade flood fill for empty cells
  const revealCell = (r: number, c: number, activeGrid: Cell[][]) => {
    cascadeReveal(r, c, gridSize, activeGrid);
  };

  // Check victory
  const checkVictory = (currentGrid: Cell[][]): boolean => {
    return checkMinesweeperVictory(gridSize, currentGrid);
  };

  // Chord click on revealed number cell: if flags count equals number, reveal rest
  const handleChord = (r: number, c: number) => {
    const cell = grid[r]?.[c];
    if (!cell || !cell.isRevealed || cell.neighborMines === 0) return;

    let flagCount = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize && grid[nr]![nc]!.isFlagged) {
          flagCount++;
        }
      }
    }

    if (flagCount === cell.neighborMines) {
      let hitMine = false;
      const nextGrid = grid.map((row) => row.map((item) => ({ ...item })));

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
            const neighbor = nextGrid[nr]![nc]!;
            if (!neighbor.isFlagged && !neighbor.isRevealed) {
              if (neighbor.isMine) {
                hitMine = true;
                neighbor.isRevealed = true;
              } else {
                revealCell(nr, nc, nextGrid);
              }
            }
          }
        }
      }

      if (hitMine) {
        setIsGameOver(true);
        playSound("boom");
        const revealedAll = nextGrid.map((row) =>
          row.map((item) => (item.isMine ? { ...item, isRevealed: true } : item))
        );
        setGrid(revealedAll);
      } else {
        playSound("chord");
        setGrid(nextGrid);
        if (checkVictory(nextGrid)) {
          setIsWon(true);
          playSound("win");
        }
      }
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (isGameOver || isWon) return;

    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    const cell = grid[r]?.[c];
    if (cell && cell.isRevealed) {
      handleChord(r, c);
      return;
    }

    if (isFlagMode) {
      toggleFlag(r, c);
      return;
    }

    let activeGrid = grid;
    if (!firstClickDone) {
      activeGrid = populateMines(r, c, grid);
      setFirstClickDone(true);
    }

    const target = activeGrid[r]?.[c];
    if (!target || target.isFlagged || target.isRevealed) return;

    if (target.isMine) {
      target.isRevealed = true;
      setIsGameOver(true);
      playSound("boom");
      const revealedGrid = activeGrid.map((row) =>
        row.map((cell) => (cell.isMine ? { ...cell, isRevealed: true } : cell))
      );
      setGrid(revealedGrid);
      return;
    }

    const nextGrid = activeGrid.map((row) => row.map((cell) => ({ ...cell })));
    revealCell(r, c, nextGrid);
    playSound("click");
    setGrid(nextGrid);

    if (checkVictory(nextGrid)) {
      setIsWon(true);
      playSound("win");
    }
  };

  const toggleFlag = (r: number, c: number) => {
    if (isGameOver || isWon) return;
    const cell = grid[r]?.[c];
    if (!cell || cell.isRevealed) return;

    playSound("flag");
    const nextGrid = grid.map((row) =>
      row.map((item) =>
        item.r === r && item.c === c ? { ...item, isFlagged: !item.isFlagged } : item
      )
    );
    setGrid(nextGrid);
  };

  const handlePointerDown = (r: number, c: number) => {
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      toggleFlag(r, c);
      longPressTimerRef.current = null;
    }, 450);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

  const flaggedCount = grid.flat().filter((c) => c.isFlagged).length;
  const remainingMines = Math.max(0, totalMines - flaggedCount);

  const resetGame = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setGrid(createEmptyMinesweeperGrid(gridSize));
    setFirstClickDone(false);
    setIsGameOver(false);
    setIsWon(false);
    setTimerSeconds(0);
    setIsFlagMode(false);
    matchRecordedRef.current = false;
  }, [gridSize]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetGame();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setIsFlagMode((prev) => !prev);
      } else if ((e.key === " " || e.key === "Enter") && (isGameOver || isWon)) {
        e.preventDefault();
        resetGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGameOver, isWon, resetGame]);

  const changePreset = (newPreset: BoardPreset) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPreset(newPreset);
    setGrid(createEmptyMinesweeperGrid(PRESETS[newPreset].size));
    setFirstClickDone(false);
    setIsGameOver(false);
    setIsWon(false);
    setTimerSeconds(0);
    setIsFlagMode(false);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Minesweeper"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/10 bg-[#090A14]/90 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (!firstClickDone || isGameOver || isWon ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Minesweeper</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
              {preset}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Difficulty Preset Pills */}
          <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10 text-xs font-semibold">
            {(["easy", "medium", "hard"] as BoardPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => changePreset(p)}
                className={`px-2.5 py-1 rounded-md transition capitalize ${
                  preset === p ? "bg-primary text-white shadow" : "text-white/60 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

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
        {/* Status Dashboard */}
        <div className="mb-3 flex items-center justify-between w-full max-w-[min(90vw,74vh,540px)] bg-white/[0.04] px-5 py-2.5 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md">
          {/* Mine counter */}
          <div className="flex items-center gap-1.5 font-mono text-xl font-black text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">
            <Bomb className="h-4 w-4" />
            <span>{String(remainingMines).padStart(2, "0")}</span>
          </div>

          {/* Smiley Status Button */}
          <button
            type="button"
            onClick={resetGame}
            aria-label="Restart round"
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/10 border border-white/15 text-2xl hover:scale-105 active:scale-95 transition shadow-md"
          >
            {isWon ? "😎" : isGameOver ? "😵" : "🙂"}
          </button>

          {/* Timer */}
          <div className="flex items-center gap-1.5 font-mono text-xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
            <Clock className="h-4 w-4" />
            <span>{String(Math.min(999, timerSeconds)).padStart(3, "0")}</span>
          </div>
        </div>

        {/* Flag Mode Toggle Button (Mobile & Quick-flag) */}
        <div className="mb-3 flex items-center gap-2">
          <Button
            variant={isFlagMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFlagMode(!isFlagMode)}
            className={`gap-1.5 text-xs font-bold transition-all ${
              isFlagMode
                ? "bg-rose-500 text-white hover:bg-rose-600 shadow-md shadow-rose-500/30 ring-2 ring-rose-400"
                : "border-white/15 text-white/80 hover:bg-white/10"
            }`}
          >
            <Flag className="h-3.5 w-3.5" />
            Flag Mode: {isFlagMode ? "ARMED" : "OFF"}
          </Button>
          <span className="text-[11px] text-white/40 hidden sm:inline">
            (Right click or long-press to flag)
          </span>
        </div>

        {/* Minesweeper Grid */}
        <div className="relative aspect-square w-full max-w-[min(90vw,74vh,540px)] p-2 sm:p-3 rounded-3xl bg-[#111322] border-2 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <div
            className="grid h-full w-full gap-1"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
            }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleFlag(r, c);
                  }}
                  onPointerDown={() => handlePointerDown(r, c)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  disabled={isGameOver || isWon}
                  aria-label={`Row ${r + 1}, Column ${c + 1}`}
                  className={`relative flex items-center justify-center rounded-lg font-mono font-black transition-all duration-100 select-none ${
                    cell.isRevealed
                      ? cell.isMine
                        ? "bg-rose-600 border border-rose-400 text-white"
                        : "bg-[#181a30]/80 border border-white/5 shadow-inner"
                      : "bg-[#232845] border border-white/15 hover:bg-[#2d3356] active:scale-95 shadow-sm"
                  }`}
                  style={{
                    fontSize: gridSize <= 8 ? "1.2rem" : gridSize <= 10 ? "1.0rem" : "0.85rem",
                    color: cell.neighborMines > 0 ? NUMBER_COLORS[cell.neighborMines] : undefined,
                  }}
                >
                  {cell.isRevealed ? (
                    cell.isMine ? (
                      <Bomb className="h-4 w-4 text-white animate-bounce" />
                    ) : cell.neighborMines > 0 ? (
                      cell.neighborMines
                    ) : (
                      ""
                    )
                  ) : cell.isFlagged ? (
                    <Flag className="h-4 w-4 text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                  ) : (
                    ""
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Win/Loss Modal */}
        {(isGameOver || isWon) && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span
              className={`flex items-center gap-2 font-bold text-lg drop-shadow-md ${
                isWon ? "text-emerald-400" : "text-rose-500"
              }`}
            >
              {isWon ? (
                <>
                  <Sparkles className="h-5 w-5" /> Cleared in {timerSeconds}s!
                </>
              ) : (
                "Detonation! Mine Tripped"
              )}
            </span>
            <Button
              onClick={resetGame}
              className="gap-2 bg-gradient-to-r from-cyan-500 to-rose-500 text-white font-bold px-6 py-2 rounded-xl shadow-lg"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
