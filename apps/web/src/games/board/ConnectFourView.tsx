"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Bot, User, Sparkles, Volume2, VolumeX, Keyboard } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

const ROWS = 6;
const COLS = 7;
type PlayerColor = "red" | "yellow";
type Board = (PlayerColor | null)[][]; // 6 rows x 7 cols
type Difficulty = "easy" | "medium" | "hard";

// Persistent audio context
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

export function checkConnectFourWin(
  currentBoard: Board,
  row: number,
  col: number,
  player: PlayerColor
): Array<[number, number]> | null {
  const directions: Array<[number, number]> = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal down-right
    [1, -1], // diagonal down-left
  ];

  for (const [dr, dc] of directions) {
    const cells: Array<[number, number]> = [[row, col]];

    // forward
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && currentBoard[r]?.[c] === player) {
      cells.push([r, c]);
      r += dr;
      c += dc;
    }

    // backward
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && currentBoard[r]?.[c] === player) {
      cells.push([r, c]);
      r -= dr;
      c -= dc;
    }

    if (cells.length >= 4) {
      return cells;
    }
  }
  return null;
}

export function getConnectFourOpenRow(currentBoard: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!currentBoard[r]?.[col]) {
      return r;
    }
  }
  return -1;
}

const checkWin = checkConnectFourWin;
const getOpenRow = getConnectFourOpenRow;

export function ConnectFourView({
  mode = "vs-ai",
  aiLevel = 3,
  onExit,
}: {
  mode?: "vs-ai" | "pass-and-play";
  aiLevel?: number;
  onExit?: () => void;
}) {
  const [board, setBoard] = React.useState<Board>(() =>
    Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
  );
  const [currentPlayer, setCurrentPlayer] = React.useState<PlayerColor>("red");
  const [currentMode, setCurrentMode] = React.useState<"vs-ai" | "pass-and-play">(mode);

  React.useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const [difficulty, setDifficulty] = React.useState<Difficulty>(
    aiLevel <= 2 ? "easy" : aiLevel <= 4 ? "medium" : "hard"
  );
  const [hoveredCol, setHoveredCol] = React.useState<number>(3);
  const [winningCells, setWinningCells] = React.useState<Array<[number, number]> | null>(null);
  const [scores, setScores] = React.useState({ red: 0, yellow: 0, ties: 0 });
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [isAiThinking, setIsAiThinking] = React.useState(false);
  const [showKeysHint, setShowKeysHint] = React.useState(false);

  const startTimeRef = React.useRef<number>(Date.now());
  const matchRecordedRef = React.useRef(false);

  const isBoardFull = board[0]?.every((c) => c !== null) ?? false;
  const isDraw = !winningCells && isBoardFull;
  const isGameOver = Boolean(winningCells || isDraw);

  // Audio synthesis
  const playSound = React.useCallback(
    (type: "drop" | "win" | "tie" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "drop") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(360, now);
          osc.frequency.exponentialRampToValueAtTime(130, now + 0.12);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === "win") {
          const notes = [440, 554.37, 659.25, 880];
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "triangle";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.09);
            noteGain.gain.setValueAtTime(0.18, now + idx * 0.09);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.09);
            noteOsc.stop(now + idx * 0.09 + 0.28);
          });
        } else if (type === "tie") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.linearRampToValueAtTime(180, now + 0.25);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
        } else if (type === "click") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(550, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        }
      } catch {
        // audio fail
      }
    },
    [soundEnabled]
  );

  // Record game over to local match history
  React.useEffect(() => {
    if (!isGameOver || matchRecordedRef.current) return;
    matchRecordedRef.current = true;
    const duration = Math.max(5, Math.round((Date.now() - startTimeRef.current) / 1000));

    if (winningCells) {
      playSound("win");
      const winner = currentPlayer;
      if (winner === "red") {
        setScores((s) => ({ ...s, red: s.red + 1 }));
      } else {
        setScores((s) => ({ ...s, yellow: s.yellow + 1 }));
      }
      saveLocalMatch({
        gameId: "connect-four",
        gameName: "Connect Four",
        mode: currentMode,
        outcome: currentMode === "vs-ai" ? (winner === "red" ? "win" : "loss") : "win",
        durationSeconds: duration,
        playedAt: Date.now(),
        score: winner === "red" ? 100 : 0,
      });
    } else if (isDraw) {
      playSound("tie");
      setScores((s) => ({ ...s, ties: s.ties + 1 }));
      saveLocalMatch({
        gameId: "connect-four",
        gameName: "Connect Four",
        mode: currentMode,
        outcome: "draw",
        durationSeconds: duration,
        playedAt: Date.now(),
        score: 50,
      });
    }
  }, [isGameOver, winningCells, isDraw, currentPlayer, currentMode, playSound]);

  // Drop disc
  const dropDisc = React.useCallback(
    (col: number) => {
      if (isGameOver || isAiThinking) return;
      if (currentMode === "vs-ai" && currentPlayer === "yellow") return;

      const openRow = getOpenRow(board, col);
      if (openRow === -1) return;

      const newBoard = board.map((row) => [...row]);
      newBoard[openRow]![col] = currentPlayer;
      setBoard(newBoard);
      playSound("drop");

      const winLine = checkWin(newBoard, openRow, col, currentPlayer);
      if (winLine) {
        setWinningCells(winLine);
      } else {
        setCurrentPlayer((prev) => (prev === "red" ? "yellow" : "red"));
      }
    },
    [board, isGameOver, isAiThinking, currentMode, currentPlayer, playSound]
  );

  // AI Logic
  React.useEffect(() => {
    if (!(currentMode === "vs-ai" && currentPlayer === "yellow" && !isGameOver)) return;
    setIsAiThinking(true);
    const delay = difficulty === "easy" ? 300 : 480;

    const timer = setTimeout(() => {
      const validCols = Array.from({ length: COLS }, (_, i) => i).filter(
        (c) => getOpenRow(board, c) !== -1
      );
      if (validCols.length === 0) {
        setIsAiThinking(false);
        return;
      }

      let chosenCol = -1;

      if (difficulty === "easy") {
        // Casual: 75% random, 25% take winning move
        if (Math.random() < 0.25) {
          for (const c of validCols) {
            const r = getOpenRow(board, c);
            const testBoard = board.map((row) => [...row]);
            testBoard[r]![c] = "yellow";
            if (checkWin(testBoard, r, c, "yellow")) {
              chosenCol = c;
              break;
            }
          }
        }
        if (chosenCol === -1) {
          chosenCol = validCols[Math.floor(Math.random() * validCols.length)]!;
        }
      } else {
        // Medium / Hard AI:
        // 1. Can AI win immediately?
        for (const c of validCols) {
          const r = getOpenRow(board, c);
          const testBoard = board.map((row) => [...row]);
          testBoard[r]![c] = "yellow";
          if (checkWin(testBoard, r, c, "yellow")) {
            chosenCol = c;
            break;
          }
        }

        // 2. Can player win immediately? Block them!
        if (chosenCol === -1) {
          for (const c of validCols) {
            const r = getOpenRow(board, c);
            const testBoard = board.map((row) => [...row]);
            testBoard[r]![c] = "red";
            if (checkWin(testBoard, r, c, "red")) {
              chosenCol = c;
              break;
            }
          }
        }

        // 3. Avoid suicide moves: do not place a disc if player can win directly on top (r-1)!
        const safeCols = validCols.filter((c) => {
          const r = getOpenRow(board, c);
          if (r - 1 < 0) return true;
          const testBoard = board.map((row) => [...row]);
          testBoard[r]![c] = "yellow";
          testBoard[r - 1]![c] = "red";
          return !checkWin(testBoard, r - 1, c, "red");
        });

        const pool = safeCols.length > 0 ? safeCols : validCols;

        // 4. Center-out column priority
        if (chosenCol === -1) {
          const centerPreference = [3, 2, 4, 1, 5, 0, 6];
          for (const c of centerPreference) {
            if (pool.includes(c)) {
              chosenCol = c;
              break;
            }
          }
        }
      }

      if (chosenCol >= 0) {
        const r = getOpenRow(board, chosenCol);
        if (r !== -1) {
          const newBoard = board.map((row) => [...row]);
          newBoard[r]![chosenCol] = "yellow";
          setBoard(newBoard);
          playSound("drop");

          const winLine = checkWin(newBoard, r, chosenCol, "yellow");
          if (winLine) {
            setWinningCells(winLine);
          } else {
            setCurrentPlayer("red");
          }
        }
      }
      setIsAiThinking(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [board, currentPlayer, currentMode, isGameOver, difficulty, playSound]);

  const resetGame = React.useCallback(() => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
    setCurrentPlayer("red");
    setWinningCells(null);
    setIsAiThinking(false);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    playSound("click");
  }, [playSound]);

  const resetScores = React.useCallback(() => {
    setScores({ red: 0, yellow: 0, ties: 0 });
    resetGame();
  }, [resetGame]);

  // Keyboard navigation: 1-7 keys or Left/Right + Space/Enter
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (isGameOver && (e.key === " " || e.key === "Enter" || e.key === "r" || e.key === "R")) {
        e.preventDefault();
        resetGame();
        return;
      }

      if (e.key >= "1" && e.key <= "7") {
        const col = parseInt(e.key, 10) - 1;
        setHoveredCol(col);
        dropDisc(col);
      } else if (e.key === "ArrowLeft") {
        setHoveredCol((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setHoveredCol((prev) => Math.min(COLS - 1, prev + 1));
      } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        dropDisc(hoveredCol);
      } else if (e.key === "r" || e.key === "R") {
        resetGame();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hoveredCol, dropDisc, isGameOver, resetGame]);

  // Automatically retarget hoveredCol to the nearest open column if current column becomes full
  React.useEffect(() => {
    if (isGameOver) return;
    const openRow = getOpenRow(board, hoveredCol);
    if (openRow === -1) {
      const validCols = Array.from({ length: COLS }, (_, i) => i).filter(
        (c) => getOpenRow(board, c) !== -1
      );
      if (validCols.length > 0) {
        const closest = [...validCols].sort(
          (a, b) => Math.abs(a - hoveredCol) - Math.abs(b - hoveredCol)
        )[0]!;
        setHoveredCol(closest);
      }
    }
  }, [board, hoveredCol, isGameOver]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Connect Four"
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
            onClick={() => (isGameOver || board.every((r) => r.every((c) => c === null)) ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Connect Four</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
              {currentMode === "vs-ai" ? "vs AI" : "2P Local"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mode Switcher */}
          <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setCurrentMode("vs-ai");
                resetGame();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                currentMode === "vs-ai" ? "bg-primary text-white shadow" : "text-white/60 hover:text-white"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentMode("pass-and-play");
                resetGame();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                currentMode === "pass-and-play" ? "bg-primary text-white shadow" : "text-white/60 hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">2P</span>
            </button>
          </div>

          {currentMode === "vs-ai" && (
            <select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value as Difficulty);
                resetGame();
              }}
              className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2 py-1 outline-none focus:border-primary cursor-pointer hover:bg-white/10 transition"
              aria-label="Difficulty"
            >
              <option value="easy" className="bg-[#121422] text-white">Easy</option>
              <option value="medium" className="bg-[#121422] text-white">Medium</option>
              <option value="hard" className="bg-[#121422] text-white">Master</option>
            </select>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKeysHint(!showKeysHint)}
            className="h-8 w-8 p-0 text-white/60 hover:text-white hidden sm:flex"
            title="Keyboard shortcuts (1-7 or Arrows + Space)"
          >
            <Keyboard className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-8 w-8 p-0 text-white/60 hover:text-white"
            title={soundEnabled ? "Mute sound" : "Unmute sound"}
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

      {/* Arena */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {showKeysHint && (
          <div className="mb-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary animate-in fade-in">
            Keys <strong>1-7</strong> to drop directly, or <strong>Arrows</strong> to aim and <strong>Space / Enter</strong> to drop.
          </div>
        )}

        {/* Status Scoreboard */}
        <div className="mb-3 sm:mb-5 flex flex-col items-center gap-2 w-full max-w-[min(92vw,74vh,560px)]">
          <div className="grid grid-cols-3 gap-2 w-full rounded-2xl bg-white/[0.03] p-2 border border-white/10 shadow-xl backdrop-blur-md">
            {/* Red Player */}
            <div
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                currentPlayer === "red" && !isGameOver
                  ? "bg-red-500/15 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                  : "bg-transparent border border-transparent opacity-70"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">Red</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-white">{scores.red}</span>
            </div>

            {/* Ties */}
            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl opacity-60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Ties</span>
              <span className="text-2xl sm:text-3xl font-black text-white">{scores.ties}</span>
            </div>

            {/* Yellow Player */}
            <div
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                currentPlayer === "yellow" && !isGameOver
                  ? "bg-yellow-500/15 border border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.25)]"
                  : "bg-transparent border border-transparent opacity-70"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-400 truncate max-w-[85px]">
                  {currentMode === "vs-ai" ? "Bot" : "Yellow"}
                </span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-white">{scores.yellow}</span>
            </div>
          </div>

          <div className="min-h-7 flex items-center justify-center text-sm font-semibold">
            {winningCells ? (
              <span className="flex items-center gap-2 text-emerald-400 text-base font-bold animate-bounce drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
                <Sparkles className="h-4 w-4" />
                {currentPlayer === "red"
                  ? "Red Connects Four!"
                  : currentMode === "vs-ai"
                  ? "Bot Wins!"
                  : "Yellow Connects Four!"}
              </span>
            ) : isDraw ? (
              <span className="text-amber-300 font-bold">Grid Full — It&apos;s a Stalemate!</span>
            ) : isAiThinking ? (
              <span className="flex items-center gap-1.5 text-yellow-400 animate-pulse">
                <Bot className="h-4 w-4 animate-spin" />
                Bot is aiming...
              </span>
            ) : (
              <span className="text-white/70">
                Turn:{" "}
                <strong className={currentPlayer === "red" ? "text-red-400" : "text-yellow-400"}>
                  {currentPlayer === "red" ? "Player Red" : currentMode === "vs-ai" ? "Bot" : "Player Yellow"}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Connect Four Physical Board Frame */}
        <div className="relative w-full max-w-[min(92vw,74vh,560px)] p-3 sm:p-4 rounded-3xl bg-gradient-to-b from-[#1d4ed8] to-[#1e3a8a] border-4 border-[#3b82f6]/80 shadow-[0_15px_35px_rgba(30,58,138,0.5)]">
          {/* Top hover indicator */}
          <div className="grid grid-cols-7 gap-2 mb-2 px-1 h-7">
            {Array.from({ length: COLS }).map((_, c) => (
              <div key={c} className="flex justify-center items-center">
                {hoveredCol === c && !isGameOver && !isAiThinking && (
                  <div
                    className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full shadow-lg ${
                      currentPlayer === "red"
                        ? "bg-red-500 shadow-red-500/80 animate-bounce"
                        : "bg-yellow-400 shadow-yellow-400/80 animate-bounce"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Slots Matrix */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 bg-[#0c1e4a] p-2 sm:p-2.5 rounded-2xl shadow-inner">
            {Array.from({ length: COLS }).map((_, col) => {
              const openRowForCol = getOpenRow(board, col);
              const isColFull = openRowForCol === -1;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => dropDisc(col)}
                  onMouseEnter={() => setHoveredCol(col)}
                  disabled={isGameOver || isAiThinking || isColFull || (currentMode === "vs-ai" && currentPlayer === "yellow")}
                  aria-label={`Column ${col + 1} ${isColFull ? "full" : ""}`}
                  className="flex flex-col gap-1.5 sm:gap-2 items-center group cursor-pointer focus:outline-none rounded-xl p-0.5 hover:bg-white/5 transition-colors disabled:cursor-not-allowed"
                >
                  {Array.from({ length: ROWS }).map((_, row) => {
                    const cell = board[row]?.[col];
                    const isWinning = winningCells?.some(([r, c]) => r === row && c === col);
                    const isGhostTarget =
                      !cell &&
                      hoveredCol === col &&
                      row === openRowForCol &&
                      !isGameOver &&
                      !isAiThinking &&
                      !(currentMode === "vs-ai" && currentPlayer === "yellow");

                    return (
                      <div
                        key={row}
                        className={`relative aspect-square w-full rounded-full border-2 transition-all duration-300 ${
                          isWinning
                            ? "border-emerald-300 ring-4 ring-emerald-400 scale-105 z-10 animate-pulse"
                            : "border-[#1b3575]"
                        } ${
                          cell === "red"
                            ? "bg-gradient-to-br from-red-400 via-red-500 to-red-700 shadow-[inset_0_3px_5px_rgba(255,255,255,0.4),0_3px_8px_rgba(0,0,0,0.6)] animate-in zoom-in-75 duration-200"
                            : cell === "yellow"
                            ? "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 shadow-[inset_0_3px_5px_rgba(255,255,255,0.4),0_3px_8px_rgba(0,0,0,0.6)] animate-in zoom-in-75 duration-200"
                            : isGhostTarget
                            ? currentPlayer === "red"
                              ? "bg-red-500/30 border-red-400/60 ring-2 ring-red-400/40"
                              : "bg-yellow-400/30 border-yellow-400/60 ring-2 ring-yellow-400/40"
                            : "bg-[#060e22] group-hover:bg-[#0c1836]"
                        }`}
                      />
                    );
                  })}
                  <span className="text-[9px] font-mono text-white/30 pt-0.5">{col + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-5 flex items-center gap-3">
          {isGameOver ? (
            <Button
              onClick={resetGame}
              className="gap-2 bg-gradient-to-r from-red-500 to-yellow-500 hover:opacity-90 text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-yellow-500/20"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetScores}
              className="text-xs text-white/40 hover:text-white/80 transition"
            >
              Reset Scores
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
