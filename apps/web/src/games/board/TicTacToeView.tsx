"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Bot, User, Sparkles, Volume2, VolumeX, Keyboard } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

type Mark = "X" | "O" | null;
type Board = Mark[];
type GameMode = "vs-ai" | "pass-and-play";
type Difficulty = "easy" | "medium" | "hard";

const WINNING_COMBOS: Array<[number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],           // diagonals
];

// Reusable audio context singleton to avoid "Too many AudioContexts" browser limits
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

export function checkTicTacToeWinner(squares: Board): { winner: Mark; line: number[] | null } {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: [a, b, c] };
    }
  }
  return { winner: null, line: null };
}

export function getTicTacToeEmptyIndices(board: Board): number[] {
  return board
    .map((val, idx) => (val === null ? idx : null))
    .filter((v): v is number => v !== null);
}

const checkWinner = checkTicTacToeWinner;

function minimax(
  currentBoard: Board,
  depth: number,
  isMaximizing: boolean
): { score: number; move?: number } {
  const { winner: currentWinner } = checkWinner(currentBoard);
  if (currentWinner === "O") return { score: 10 - depth };
  if (currentWinner === "X") return { score: depth - 10 };
  if (currentBoard.every((c) => c !== null)) return { score: 0 };

  const availableMoves = currentBoard
    .map((val, idx) => (val === null ? idx : null))
    .filter((v): v is number => v !== null);

  if (isMaximizing) {
    let maxScore = -Infinity;
    let bestMove = availableMoves[0];
    for (const move of availableMoves) {
      currentBoard[move] = "O";
      const result = minimax(currentBoard, depth + 1, false);
      currentBoard[move] = null;
      if (result.score > maxScore) {
        maxScore = result.score;
        bestMove = move;
      }
    }
    return { score: maxScore, move: bestMove };
  } else {
    let minScore = Infinity;
    let bestMove = availableMoves[0];
    for (const move of availableMoves) {
      currentBoard[move] = "X";
      const result = minimax(currentBoard, depth + 1, true);
      currentBoard[move] = null;
      if (result.score < minScore) {
        minScore = result.score;
        bestMove = move;
      }
    }
    return { score: minScore, move: bestMove };
  }
}

export function TicTacToeView({
  mode = "vs-ai",
  aiLevel = 3,
  onExit,
}: {
  mode?: "vs-ai" | "pass-and-play";
  aiLevel?: number;
  onExit?: () => void;
}) {
  const [board, setBoard] = React.useState<Board>(Array(9).fill(null));
  const [isXNext, setIsXNext] = React.useState(true);
  const [currentMode, setCurrentMode] = React.useState<GameMode>(mode);

  React.useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);
  const [difficulty, setDifficulty] = React.useState<Difficulty>(
    aiLevel <= 2 ? "easy" : aiLevel <= 4 ? "medium" : "hard"
  );
  const [scores, setScores] = React.useState({ x: 0, o: 0, ties: 0 });
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [isAiThinking, setIsAiThinking] = React.useState(false);
  const [showKeysHint, setShowKeysHint] = React.useState(false);
  const startTimeRef = React.useRef<number>(Date.now());
  const matchRecordedRef = React.useRef(false);

  // Audio synthesizer via persistent Web Audio
  const playSound = React.useCallback(
    (type: "x" | "o" | "win" | "tie" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "x") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
        } else if (type === "o") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(659.25, now);
          osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.1);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === "win") {
          // Cheerful major chord arpeggio
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "sine";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
            noteGain.gain.setValueAtTime(0.15, now + idx * 0.08);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.08);
            noteOsc.stop(now + idx * 0.08 + 0.25);
          });
        } else if (type === "tie") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.linearRampToValueAtTime(180, now + 0.22);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.22);
        } else if (type === "click") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
        }
      } catch {
        // audio fail safe
      }
    },
    [soundEnabled]
  );

  const { winner, line: winningLine } = checkWinner(board);
  const isDraw = !winner && board.every((cell) => cell !== null);
  const isGameOver = Boolean(winner || isDraw);

  // Bot move selector
  const getAiMove = React.useCallback(
    (currentBoard: Board): number => {
      const available = currentBoard
        .map((val, idx) => (val === null ? idx : null))
        .filter((v): v is number => v !== null);

      if (available.length === 0) return -1;

      if (difficulty === "easy") {
        // Pure casual random
        return available[Math.floor(Math.random() * available.length)]!;
      }

      // Check if AI can win in 1 move
      for (const m of available) {
        currentBoard[m] = "O";
        if (checkWinner(currentBoard).winner === "O") {
          currentBoard[m] = null;
          return m;
        }
        currentBoard[m] = null;
      }

      // Check if Player X is threatening to win in 1 move; block them!
      for (const m of available) {
        currentBoard[m] = "X";
        if (checkWinner(currentBoard).winner === "X") {
          currentBoard[m] = null;
          return m;
        }
        currentBoard[m] = null;
      }

      if (difficulty === "medium") {
        // 60% optimal move, otherwise favor center or random
        if (Math.random() < 0.6) {
          const { move } = minimax(currentBoard, 0, true);
          return move ?? available[0]!;
        }
        if (currentBoard[4] === null && Math.random() < 0.5) return 4;
        return available[Math.floor(Math.random() * available.length)]!;
      }

      // Hard / Unbeatable Minimax
      const { move } = minimax(currentBoard, 0, true);
      return move ?? available[0]!;
    },
    [difficulty]
  );

  const getAiMoveRef = React.useRef(getAiMove);
  getAiMoveRef.current = getAiMove;

  // AI Turn trigger
  React.useEffect(() => {
    if (!(currentMode === "vs-ai" && !isXNext && !isGameOver)) return;
    setIsAiThinking(true);
    const delay = difficulty === "easy" ? 250 : 420;
    const timer = setTimeout(() => {
      const move = getAiMoveRef.current([...board]);
      if (move >= 0) {
        setBoard((prev) => {
          if (prev[move] !== null) return prev;
          const next = [...prev];
          next[move] = "O";
          return next;
        });
        setIsXNext(true);
        playSound("o");
      }
      setIsAiThinking(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [board, isXNext, currentMode, isGameOver, difficulty, playSound]);

  // Handle Score and Local History on Game Over
  React.useEffect(() => {
    if (!isGameOver || matchRecordedRef.current) return;
    matchRecordedRef.current = true;
    const duration = Math.max(3, Math.round((Date.now() - startTimeRef.current) / 1000));

    if (winner) {
      playSound("win");
      if (winner === "X") {
        setScores((s) => ({ ...s, x: s.x + 1 }));
      } else {
        setScores((s) => ({ ...s, o: s.o + 1 }));
      }
      saveLocalMatch({
        gameId: "tic-tac-toe",
        gameName: "Tic-Tac-Toe",
        mode: currentMode,
        outcome: currentMode === "vs-ai" ? (winner === "X" ? "win" : "loss") : "win",
        durationSeconds: duration,
        playedAt: Date.now(),
        score: winner === "X" ? 100 : 0,
      });
    } else if (isDraw) {
      playSound("tie");
      setScores((s) => ({ ...s, ties: s.ties + 1 }));
      saveLocalMatch({
        gameId: "tic-tac-toe",
        gameName: "Tic-Tac-Toe",
        mode: currentMode,
        outcome: "draw",
        durationSeconds: duration,
        playedAt: Date.now(),
        score: 50,
      });
    }
  }, [isGameOver, winner, isDraw, currentMode, playSound]);

  const handleCellClick = React.useCallback(
    (index: number) => {
      if (board[index] || isGameOver || isAiThinking) return;
      if (currentMode === "vs-ai" && !isXNext) return;

      const mark: Mark = isXNext ? "X" : "O";
      setBoard((prev) => {
        if (prev[index]) return prev;
        const next = [...prev];
        next[index] = mark;
        return next;
      });
      setIsXNext(!isXNext);
      playSound(mark === "X" ? "x" : "o");
    },
    [board, isGameOver, isAiThinking, currentMode, isXNext, playSound]
  );

  // Auto-finish single remaining square
  React.useEffect(() => {
    if (isGameOver || isAiThinking) return undefined;
    if (currentMode === "vs-ai" && !isXNext) return undefined;

    const emptyIndices = getTicTacToeEmptyIndices(board);
    if (emptyIndices.length === 1) {
      const lastIndex = emptyIndices[0]!;
      const timer = setTimeout(() => {
        handleCellClick(lastIndex);
      }, 450);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [board, isGameOver, isAiThinking, currentMode, isXNext, handleCellClick]);

  const resetGame = React.useCallback(() => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setIsAiThinking(false);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    playSound("click");
  }, [playSound]);

  const resetScores = React.useCallback(() => {
    setScores({ x: 0, o: 0, ties: 0 });
    resetGame();
  }, [resetGame]);

  // Keyboard controls: 1-9 top-to-bottom or Numpad 1-9 (standard desktop layout)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (isGameOver && (e.key === " " || e.key === "Enter" || e.key === "r" || e.key === "R")) {
        e.preventDefault();
        resetGame();
        return;
      }

      let cellIdx = -1;

      // Numpad layout mapping (7=top-left, 1=bottom-left)
      if (e.code === "Numpad7") cellIdx = 0;
      else if (e.code === "Numpad8") cellIdx = 1;
      else if (e.code === "Numpad9") cellIdx = 2;
      else if (e.code === "Numpad4") cellIdx = 3;
      else if (e.code === "Numpad5") cellIdx = 4;
      else if (e.code === "Numpad6") cellIdx = 5;
      else if (e.code === "Numpad1") cellIdx = 6;
      else if (e.code === "Numpad2") cellIdx = 7;
      else if (e.code === "Numpad3") cellIdx = 8;
      // Top number row 1-9 mapping
      else if (e.key >= "1" && e.key <= "9") {
        cellIdx = parseInt(e.key, 10) - 1;
      } else if (e.key === "r" || e.key === "R") {
        resetGame();
      }

      if (cellIdx >= 0 && cellIdx < 9) {
        handleCellClick(cellIdx);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCellClick, isGameOver, resetGame]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Tic-Tac-Toe"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Top Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/10 bg-[#090A14]/90 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (isGameOver || board.every((c) => c === null) ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Tic-Tac-Toe</h1>
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
              aria-label="AI Difficulty"
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
            title="Keyboard shortcuts (1-9 or Numpad)"
          >
            <Keyboard className="h-4 w-4" />
          </Button>

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
      <main className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Subtle keyboard hint toast */}
        {showKeysHint && (
          <div className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary animate-in fade-in">
            Use keys <strong>1-9</strong> or <strong>Numpad 1-9</strong> to place a mark. Press <strong>R</strong> to restart.
          </div>
        )}

        {/* Scoreboard Cards */}
        <div className="mb-4 sm:mb-6 flex flex-col items-center gap-3 w-full max-w-[min(90vw,70vh,460px)]">
          <div className="grid grid-cols-3 gap-2 w-full rounded-2xl bg-white/[0.03] p-2 border border-white/10 shadow-xl backdrop-blur-md">
            {/* Player X */}
            <div
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                isXNext && !isGameOver
                  ? "bg-cyan-500/15 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  : "bg-transparent border border-transparent opacity-70"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Player X</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-white">{scores.x}</span>
            </div>

            {/* Ties */}
            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-transparent opacity-60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Ties</span>
              <span className="text-2xl sm:text-3xl font-black text-white">{scores.ties}</span>
            </div>

            {/* Player O */}
            <div
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                !isXNext && !isGameOver
                  ? "bg-pink-500/15 border border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.2)]"
                  : "bg-transparent border border-transparent opacity-70"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-pink-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400 truncate max-w-[85px]">
                  {currentMode === "vs-ai" ? "Bot (O)" : "Player O"}
                </span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-white">{scores.o}</span>
            </div>
          </div>

          {/* Turn / Outcome Announcement */}
          <div className="min-h-7 flex items-center justify-center text-sm font-semibold">
            {winner ? (
              <span className="flex items-center gap-2 text-emerald-400 text-base font-bold animate-bounce drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
                <Sparkles className="h-4 w-4" />
                Player {winner} Wins!
              </span>
            ) : isDraw ? (
              <span className="text-amber-300 font-bold tracking-wide">Tie Game! Well matched.</span>
            ) : isAiThinking ? (
              <span className="flex items-center gap-1.5 text-pink-400 animate-pulse">
                <Bot className="h-4 w-4 animate-spin" />
                Bot is planning a move...
              </span>
            ) : (
              <span className="text-white/70">
                Turn:{" "}
                <strong className={isXNext ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"}>
                  {isXNext ? "Player X" : currentMode === "vs-ai" ? "Bot (O)" : "Player O"}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* 3x3 Board Grid Container */}
        <div className="relative aspect-square w-full max-w-[min(90vw,70vh,460px)] p-3 sm:p-4 rounded-3xl bg-[#121428]/90 border border-white/10 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-3 grid-rows-3 h-full w-full gap-2 sm:gap-3">
            {board.map((val, idx) => {
              const isWinCell = winningLine?.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleCellClick(idx)}
                  disabled={Boolean(val) || isGameOver || isAiThinking || (currentMode === "vs-ai" && !isXNext)}
                  aria-label={`Cell ${idx + 1}, ${val ? val : "empty"}`}
                  className={`group relative flex items-center justify-center rounded-2xl border transition-all duration-200 text-5xl sm:text-6xl font-black select-none ${
                    isWinCell
                      ? "border-emerald-400/90 bg-emerald-500/25 shadow-[0_0_25px_rgba(16,185,129,0.5)] scale-[0.98]"
                      : val
                      ? "border-white/10 bg-[#171933]"
                      : "border-white/5 bg-[#161830]/60 hover:bg-[#1f2244] hover:border-white/20 active:scale-95 cursor-pointer"
                  }`}
                >
                  {val === "X" && (
                    <span className="text-cyan-400 drop-shadow-[0_0_14px_rgba(6,182,212,0.85)] animate-in zoom-in-75 duration-150">
                      X
                    </span>
                  )}
                  {val === "O" && (
                    <span className="text-pink-500 drop-shadow-[0_0_14px_rgba(236,72,153,0.85)] animate-in zoom-in-75 duration-150">
                      O
                    </span>
                  )}
                  {!val && !isGameOver && !isAiThinking && (
                    <span className="opacity-0 group-hover:opacity-20 text-3xl font-bold text-white transition-opacity">
                      {isXNext ? "X" : "O"}
                    </span>
                  )}
                  {/* Subtle number label helper */}
                  <span className="absolute bottom-1 right-2 text-[9px] font-mono text-white/20 select-none pointer-events-none">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Game Controls */}
        <div className="mt-5 flex items-center gap-3">
          {isGameOver ? (
            <Button
              onClick={resetGame}
              className="gap-2 bg-gradient-to-r from-cyan-500 to-pink-500 hover:opacity-90 text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-primary/25"
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
