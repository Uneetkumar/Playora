"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Bot, User, Volume2, VolumeX, Dices, Trophy } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

export const BOARD_SIZE = 10; // 10x10 = 100 tiles

// Ladders: bottom -> top
export const LADDERS: Record<number, number> = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
};

// Snakes: head -> tail
export const SNAKES: Record<number, number> = {
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
};

// Compute (x, y) % on 100x100 SVG boustrophedon grid (1 at bottom-left, 100 at top-left)
export const getSnakeLadderCoordinates = (pos: number): { x: number; y: number } => {
  const zeroIndexed = Math.max(0, Math.min(99, pos - 1));
  const rowFromBottom = Math.floor(zeroIndexed / BOARD_SIZE);
  const colInRow = zeroIndexed % BOARD_SIZE;

  const row = BOARD_SIZE - 1 - rowFromBottom; // 0 is top
  const col = rowFromBottom % 2 === 0 ? colInRow : BOARD_SIZE - 1 - colInRow;

  return { x: col * 10 + 5, y: row * 10 + 5 };
};

export function calculateSnakeLadderMove(currentPos: number, roll: number): {
  targetPos: number;
  intermediatePos: number;
  isLadder: boolean;
  isSnake: boolean;
  exceedsBoard: boolean;
} {
  const intermediatePos = currentPos + roll;
  if (intermediatePos > 100) {
    return {
      targetPos: currentPos,
      intermediatePos,
      isLadder: false,
      isSnake: false,
      exceedsBoard: true,
    };
  }
  let targetPos = intermediatePos;
  let isLadder = false;
  let isSnake = false;

  if (LADDERS[intermediatePos]) {
    targetPos = LADDERS[intermediatePos]!;
    isLadder = true;
  } else if (SNAKES[intermediatePos]) {
    targetPos = SNAKES[intermediatePos]!;
    isSnake = true;
  }

  return {
    targetPos,
    intermediatePos,
    isLadder,
    isSnake,
    exceedsBoard: false,
  };
}

interface Player {
  id: number;
  name: string;
  color: string;
  pos: number; // 1..100
  isAi: boolean;
}

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

export function SnakeLadderView({
  mode = "vs-ai",
  onExit,
}: {
  mode?: "vs-ai" | "pass-and-play";
  onExit?: () => void;
}) {
  const [currentMode, setCurrentMode] = React.useState<"vs-ai" | "pass-and-play">(mode);
  const [players, setPlayers] = React.useState<Player[]>([
    { id: 1, name: "Player 1", color: "#f43f5e", pos: 1, isAi: false },
    { id: 2, name: mode === "vs-ai" ? "Cyber Bot" : "Player 2", color: "#06b6d4", pos: 1, isAi: mode === "vs-ai" },
  ]);

  React.useEffect(() => {
    setCurrentMode(mode);
    setPlayers([
      { id: 1, name: "Player 1", color: "#f43f5e", pos: 1, isAi: false },
      { id: 2, name: mode === "vs-ai" ? "Cyber Bot" : "Player 2", color: "#06b6d4", pos: 1, isAi: mode === "vs-ai" },
    ]);
  }, [mode]);

  const [turnIndex, setTurnIndex] = React.useState(0);
  const [diceVal, setDiceVal] = React.useState<number | null>(null);
  const [isRolling, setIsRolling] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string>("Roll the dice to start!");
  const [winner, setWinner] = React.useState<Player | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const rollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const activePlayer = players[turnIndex % players.length]!;

  // Web Audio sounds
  const playSound = React.useCallback(
    (type: "roll" | "ladder" | "snake" | "step" | "win" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "step") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(360, now);
          osc.frequency.linearRampToValueAtTime(520, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === "ladder") {
          // Ascending bright chime
          [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            const nOsc = ctx.createOscillator();
            const nGain = ctx.createGain();
            nOsc.type = "triangle";
            nOsc.frequency.setValueAtTime(freq, now + i * 0.09);
            nGain.gain.setValueAtTime(0.18, now + i * 0.09);
            nGain.gain.linearRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
            nOsc.connect(nGain);
            nGain.connect(ctx.destination);
            nOsc.start(now + i * 0.09);
            nOsc.stop(now + i * 0.09 + 0.22);
          });
        } else if (type === "snake") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(550, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === "win") {
          const notes = [440, 554.37, 659.25, 880];
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
        } else if (type === "roll") {
          osc.type = "square";
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(480, now + 0.1);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
        } else if (type === "click") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
        }
      } catch {
        // audio context
      }
    },
    [soundEnabled]
  );

  const getCoordinates = getSnakeLadderCoordinates;

  // Process player movement
  const processMove = React.useCallback(
    (roll: number) => {
      const move = calculateSnakeLadderMove(activePlayer.pos, roll);

      if (move.exceedsBoard) {
        setStatusMessage(`${activePlayer.name} rolled a ${roll} — needs exact roll to reach 100!`);
        const t = setTimeout(() => {
          setTurnIndex((idx) => idx + 1);
          setIsRolling(false);
        }, 650);
        timersRef.current.push(t);
        return;
      }

      // Step 1: Walk to intermediate tile
      playSound("step");
      setPlayers((prev) =>
        prev.map((p) => (p.id === activePlayer.id ? { ...p, pos: move.intermediatePos } : p))
      );

      const finalizeMove = (finalPos: number) => {
        if (finalPos === 100) {
          setIsRolling(false);
          setWinner(activePlayer);
          playSound("win");
          setStatusMessage(`🎉 ${activePlayer.name} reached square 100 and claimed victory!`);

          if (!matchRecordedRef.current) {
            matchRecordedRef.current = true;
            const duration = Math.max(20, Math.round((Date.now() - startTimeRef.current) / 1000));
            saveLocalMatch({
              gameId: "snake-ladder",
              gameName: "Snakes & Ladders",
              mode: currentMode,
              outcome: currentMode === "vs-ai" ? (activePlayer.id === 1 ? "win" : "loss") : "win",
              durationSeconds: duration,
              playedAt: Date.now(),
              score: activePlayer.id === 1 ? 100 : 50,
            });
          }
          return;
        }

        // Auto progression after roll
        const progTimer = setTimeout(() => {
          if (roll === 6) {
            setStatusMessage(`Rolled a 6! ${activePlayer.name} gets a bonus roll!`);
          } else {
            setTurnIndex((idx) => idx + 1);
          }
          setIsRolling(false);
        }, 550);
        timersRef.current.push(progTimer);
      };

      if (move.isLadder || move.isSnake) {
        setStatusMessage(
          move.isLadder
            ? `${activePlayer.name} hit square ${move.intermediatePos} — climbing ladder to ${move.targetPos}!`
            : `${activePlayer.name} hit square ${move.intermediatePos} — sliding down snake to ${move.targetPos}!`
        );

        const animTimer = setTimeout(() => {
          setPlayers((prev) =>
            prev.map((p) => (p.id === activePlayer.id ? { ...p, pos: move.targetPos } : p))
          );
          if (move.isLadder) {
            playSound("ladder");
            setStatusMessage(`🪜 Ladder climbed! ${activePlayer.name} surged to ${move.targetPos}!`);
          } else {
            playSound("snake");
            setStatusMessage(`🐍 Snake bitten! ${activePlayer.name} slipped to ${move.targetPos}!`);
          }
          finalizeMove(move.targetPos);
        }, 500);
        timersRef.current.push(animTimer);
      } else {
        setStatusMessage(`${activePlayer.name} moved to square ${move.targetPos}`);
        finalizeMove(move.targetPos);
      }
    },
    [activePlayer, currentMode, playSound]
  );

  // Roll dice and move
  const rollDice = React.useCallback(() => {
    if (isRolling || winner) return;
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    setIsRolling(true);
    playSound("roll");

    let count = 0;
    rollIntervalRef.current = setInterval(() => {
      setDiceVal(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 6) {
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        const roll = Math.floor(Math.random() * 6) + 1;
        setDiceVal(roll);
        processMove(roll);
      }
    }, 45);
  }, [isRolling, winner, playSound, processMove]);

  const rollDiceRef = React.useRef(rollDice);
  rollDiceRef.current = rollDice;

  // AI automation
  React.useEffect(() => {
    if (!(activePlayer.isAi && !isRolling && !winner)) return;
    const timer = setTimeout(() => {
      rollDiceRef.current();
    }, 650);
    return () => clearTimeout(timer);
  }, [turnIndex, activePlayer.isAi, isRolling, winner]);

  const resetGame = React.useCallback(() => {
    clearAllTimers();
    setIsRolling(false);
    setPlayers((prev) => prev.map((p) => ({ ...p, pos: 1 })));
    setTurnIndex(0);
    setDiceVal(null);
    setWinner(null);
    setStatusMessage("Roll the dice to start!");
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    playSound("click");
  }, [playSound, clearAllTimers]);

  // Keyboard shortcut Space / Enter
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === " " || e.key === "Enter") {
        if (!activePlayer.isAi && !isRolling && !winner) {
          e.preventDefault();
          rollDice();
        }
      } else if (e.key === "r" || e.key === "R") {
        resetGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePlayer.isAi, isRolling, winner, rollDice, resetGame]);

  // Render dice face with pips
  const renderDiceFace = (val: number | null) => {
    if (!val) return <Dices className="h-7 w-7 text-zinc-900 drop-shadow-sm" />;
    const pipPositions: Record<number, Array<[number, number]>> = {
      1: [[50, 50]],
      2: [[25, 25], [75, 75]],
      3: [[25, 25], [50, 50], [75, 75]],
      4: [[25, 25], [25, 75], [75, 25], [75, 75]],
      5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
      6: [[25, 25], [50, 25], [75, 25], [25, 75], [50, 75], [75, 75]],
    };
    const pips = pipPositions[val] || [];
    return (
      <div className="relative h-8 w-8 sm:h-9 sm:w-9">
        {pips.map(([top, left], i) => (
          <div
            key={i}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950 shadow-sm"
            style={{ top: `${top}%`, left: `${left}%` }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Snakes & Ladders"
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
            onClick={() => (winner ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Snakes & Ladders</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
              {currentMode === "vs-ai" ? "vs AI" : "2P Local"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mode switch */}
          <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setCurrentMode("vs-ai");
                setPlayers([
                  { id: 1, name: "Player 1", color: "#f43f5e", pos: 1, isAi: false },
                  { id: 2, name: "Cyber Bot", color: "#06b6d4", pos: 1, isAi: true },
                ]);
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
                setPlayers([
                  { id: 1, name: "Player 1", color: "#f43f5e", pos: 1, isAi: false },
                  { id: 2, name: "Player 2", color: "#06b6d4", pos: 1, isAi: false },
                ]);
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
        {/* Status Bar & Dice Roller */}
        <div className="mb-3 flex items-center justify-between w-full max-w-[min(92vw,calc(100dvh-130px),720px)] bg-white/[0.04] p-3 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-3">
            <div
              className="h-5 w-5 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: activePlayer.color }}
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Turn
              </div>
              <div className="text-sm font-black text-white">
                {activePlayer.name}{" "}
                <span className="text-xs font-medium text-white/60 font-mono">
                  ({activePlayer.pos}/100)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-white/70 text-right hidden sm:block max-w-[170px] truncate font-medium">
              {statusMessage}
            </div>
            <button
              type="button"
              onClick={rollDice}
              disabled={isRolling || activePlayer.isAi || Boolean(winner)}
              aria-label="Roll dice"
              className={`relative flex items-center justify-center h-12 w-12 rounded-2xl bg-white text-zinc-950 font-black shadow-xl transition active:scale-95 ${
                !activePlayer.isAi && !winner
                  ? "border-2 border-primary ring-4 ring-primary/40 animate-pulse cursor-pointer hover:scale-105"
                  : "border border-zinc-300 opacity-90 cursor-default"
              }`}
            >
              {isRolling ? (
                <Dices className="h-6 w-6 animate-spin text-primary" />
              ) : (
                renderDiceFace(diceVal)
              )}
            </button>
          </div>
        </div>

        {/* 10x10 Snakes & Ladders SVG Board */}
        <div className="relative aspect-square w-full max-w-[min(92vw,calc(100dvh-130px),720px)] bg-[#0c1222] rounded-3xl p-3 border-4 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <svg viewBox="0 0 100 100" className="w-full h-full rounded-2xl">
            {/* Grid Tiles */}
            {Array.from({ length: 100 }).map((_, i) => {
              const num = i + 1;
              const { x, y } = getCoordinates(num);
              const isEven = (Math.floor((num - 1) / 10) + ((num - 1) % 10)) % 2 === 0;
              const isGoal = num === 100;
              const isLadderBase = Boolean(LADDERS[num]);
              const isSnakeHead = Boolean(SNAKES[num]);

              return (
                <g key={num}>
                  <rect
                    x={x - 5}
                    y={y - 5}
                    width="10"
                    height="10"
                    fill={
                      isGoal
                        ? "#15803d"
                        : isLadderBase
                        ? "#1e3a5f"
                        : isSnakeHead
                        ? "#3f1e28"
                        : isEven
                        ? "#161f38"
                        : "#0f172a"
                    }
                    stroke="#1e293b"
                    strokeWidth="0.3"
                  />
                  <text
                    x={x - 3.8}
                    y={y - 1.8}
                    fontSize="2.4"
                    fill={isGoal ? "#86efac" : isLadderBase ? "#38bdf8" : isSnakeHead ? "#f43f5e" : "#94a3b8"}
                    fontFamily="sans-serif"
                    fontWeight="bold"
                  >
                    {num}
                  </text>
                  {isGoal && (
                    <text x={x - 2} y={y + 3} fontSize="3.5" fill="#facc15">
                      ★
                    </text>
                  )}
                </g>
              );
            })}

            {/* Ladders */}
            {Object.entries(LADDERS).map(([start, end]) => {
              const from = getCoordinates(Number(start));
              const to = getCoordinates(Number(end));
              return (
                <g key={`ladder-${start}`}>
                  <line
                    x1={from.x - 1.2}
                    y1={from.y}
                    x2={to.x - 1.2}
                    y2={to.y}
                    stroke="#f59e0b"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                  />
                  <line
                    x1={from.x + 1.2}
                    y1={from.y}
                    x2={to.x + 1.2}
                    y2={to.y}
                    stroke="#f59e0b"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                  />
                  {/* Rungs */}
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const t = (idx + 1) / 7;
                    const rx = from.x + (to.x - from.x) * t;
                    const ry = from.y + (to.y - from.y) * t;
                    return (
                      <line
                        key={idx}
                        x1={rx - 1.2}
                        y1={ry}
                        x2={rx + 1.2}
                        y2={ry}
                        stroke="#fbbf24"
                        strokeWidth="0.7"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Snakes */}
            {Object.entries(SNAKES).map(([head, tail]) => {
              const from = getCoordinates(Number(head));
              const to = getCoordinates(Number(tail));
              const midX = (from.x + to.x) / 2 + (from.x > to.x ? 6 : -6);
              const midY = (from.y + to.y) / 2;
              return (
                <g key={`snake-${head}`}>
                  <path
                    d={`M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`}
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`}
                    fill="none"
                    stroke="#fda4af"
                    strokeWidth="0.8"
                    strokeDasharray="1 1.5"
                    strokeLinecap="round"
                  />
                  {/* Snake Head */}
                  <circle cx={from.x} cy={from.y} r="1.6" fill="#be123c" />
                  <circle cx={from.x} cy={from.y} r="0.6" fill="#ffffff" />
                  <circle cx={to.x} cy={to.y} r="0.8" fill="#e11d48" />
                </g>
              );
            })}

            {/* Player Pawns */}
            {players.map((p) => {
              const { x, y } = getCoordinates(p.pos);
              const isSharingTile = players.filter((other) => other.pos === p.pos).length > 1;
              const offset = isSharingTile ? (p.id === 1 ? -1.8 : 1.8) : 0;
              return (
                <g key={p.id} className="transition-all duration-300">
                  <circle
                    cx={x + offset}
                    cy={y}
                    r="3"
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth="0.9"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.9))"
                  />
                  <circle cx={x + offset} cy={y} r="1.2" fill="#ffffff" opacity="0.8" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Win Banner */}
        {winner && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="flex items-center gap-2 text-emerald-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
              <Trophy className="h-5 w-5 text-amber-400" />
              {winner.name} Reached Square 100!
            </span>
            <Button onClick={resetGame} className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold">
              <RotateCcw className="h-4 w-4" />
              Play Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
