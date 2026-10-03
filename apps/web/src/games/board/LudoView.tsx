"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Sparkles, Volume2, VolumeX, Dices, Bot, User } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

export type PlayerColor = "red" | "green" | "yellow" | "blue";

export interface LudoToken {
  id: number; // 0..3
  color: PlayerColor;
  step: number; // -1: yard, 0..50: common path, 51..55: home runway, 56: home center
}

export type Token = LudoToken;

// Global 52 cross perimeter track coords [row, col] on 15x15 grid
export const TRACK_COORDS: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0]
];

// Start offsets into the 52 common tiles
export const COLOR_START_INDEX: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Home runway coords [row, col] for steps 51..55
export const HOME_RUNWAYS: Record<PlayerColor, Array<[number, number]>> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

// Yard spawn coords [cx, cy] in 0..150 SVG coordinates
export const YARD_COORDS_SVG: Record<PlayerColor, Array<[number, number]>> = {
  red: [[20, 20], [40, 20], [20, 40], [40, 40]],
  green: [[110, 20], [130, 20], [110, 40], [130, 40]],
  yellow: [[110, 110], [130, 110], [110, 130], [130, 130]],
  blue: [[20, 110], [40, 110], [20, 130], [40, 130]],
};

export const COLOR_THEMES: Record<PlayerColor, { bg: string; border: string; text: string; ring: string }> = {
  red: { bg: "#ef4444", border: "#b91c1c", text: "text-red-400", ring: "ring-red-400" },
  green: { bg: "#22c55e", border: "#15803d", text: "text-emerald-400", ring: "ring-emerald-400" },
  yellow: { bg: "#eab308", border: "#a16207", text: "text-yellow-400", ring: "ring-yellow-400" },
  blue: { bg: "#3b82f6", border: "#1d4ed8", text: "text-blue-400", ring: "ring-blue-400" },
};

export const getLudoTokenCoords = (token: Token): [number, number] => {
  if (token.step === -1) {
    return YARD_COORDS_SVG[token.color][token.id] ?? [75, 75];
  }
  if (token.step <= 50) {
    const idx = (COLOR_START_INDEX[token.color] + token.step) % 52;
    const coord = TRACK_COORDS[idx] ?? [7, 7];
    return [coord[1] * 10 + 5, coord[0] * 10 + 5];
  }
  if (token.step <= 55) {
    const runwayIdx = token.step - 51;
    const coord = HOME_RUNWAYS[token.color][runwayIdx] ?? [7, 7];
    return [coord[1] * 10 + 5, coord[0] * 10 + 5];
  }
  // Finished at center home (75, 75)
  if (token.color === "red") return [68, 75];
  if (token.color === "green") return [75, 68];
  if (token.color === "yellow") return [82, 75];
  return [75, 82];
};

export function getMovableLudoTokens(
  tokens: Token[],
  color: PlayerColor,
  diceValue: number | null
): Token[] {
  if (diceValue === null) return [];
  return tokens.filter((t) => {
    if (t.color !== color) return false;
    if (t.step === 56) return false; // already won
    if (t.step === -1) return diceValue === 6; // can leave yard on 6
    return t.step + diceValue <= 56; // cannot overshoot goal
  });
}

export function shouldAutoMoveLudoToken(movableTokens: Token[]): Token | null {
  if (movableTokens.length === 1) {
    return movableTokens[0] ?? null;
  }
  // If all movable tokens are in the yard, selecting any is functionally identical
  if (movableTokens.length > 1 && movableTokens.every((t) => t.step === -1)) {
    return movableTokens[0] ?? null;
  }
  return null;
}

const PLAYERS_ORDER: PlayerColor[] = ["red", "green", "yellow", "blue"];

// Persistent Web Audio singleton
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

export function LudoView({
  mode = "vs-ai",
  onExit,
}: {
  mode?: "vs-ai" | "pass-and-play";
  onExit?: () => void;
}) {
  const [playerCount, setPlayerCount] = React.useState<2 | 4>(2);
  const activeColors: PlayerColor[] = playerCount === 2 ? ["red", "yellow"] : PLAYERS_ORDER;

  const [currentMode, setCurrentMode] = React.useState<"vs-ai" | "pass-and-play">(mode);

  React.useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const [turnIndex, setTurnIndex] = React.useState(0);
  const [diceValue, setDiceValue] = React.useState<number | null>(null);
  const [isRolling, setIsRolling] = React.useState(false);
  const [tokens, setTokens] = React.useState<Token[]>(() => {
    const list: Token[] = [];
    for (const color of PLAYERS_ORDER) {
      for (let i = 0; i < 4; i++) {
        list.push({ id: i, color, step: -1 });
      }
    }
    return list;
  });

  const [winner, setWinner] = React.useState<PlayerColor | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);
  const rollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const isMovingRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
    };
  }, []);

  const currentColor = activeColors[turnIndex % activeColors.length]!;
  const isHumanTurn = currentMode === "pass-and-play" || currentColor === "red";

  // Web Audio synthesizer
  const playSound = React.useCallback(
    (type: "roll" | "move" | "capture" | "win" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "roll") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.linearRampToValueAtTime(580, now + 0.12);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === "move") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(840, now + 0.08);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === "capture") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(90, now + 0.22);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.22);
        } else if (type === "win") {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "sine";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
            noteGain.gain.setValueAtTime(0.2, now + idx * 0.08);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.08);
            noteOsc.stop(now + idx * 0.08 + 0.3);
          });
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

  // Available tokens for current player given dice value
  const movableTokens = React.useMemo(() => {
    if (diceValue === null || isRolling || winner) return [];
    return getMovableLudoTokens(tokens, currentColor, diceValue);
  }, [tokens, currentColor, diceValue, isRolling, winner]);

  // Roll dice action
  const rollDice = React.useCallback(() => {
    if (isRolling || diceValue !== null || winner) return;
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    setIsRolling(true);
    playSound("roll");

    let counter = 0;
    rollIntervalRef.current = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      counter++;
      if (counter > 6) {
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        const finalVal = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalVal);
        setIsRolling(false);
      }
    }, 45);
  }, [isRolling, diceValue, winner, playSound]);

  // Move token
  const handleMoveToken = React.useCallback(
    (token: Token) => {
      if (diceValue === null || isRolling || winner || isMovingRef.current) return;
      isMovingRef.current = true;
      const val = diceValue;

      let newStep = token.step;
      if (token.step === -1) {
        if (val === 6) newStep = 0; // enter track
        else {
          isMovingRef.current = false;
          return;
        }
      } else {
        newStep = token.step + val;
        if (newStep > 56) {
          isMovingRef.current = false;
          return; // cannot move
        }
      }

      playSound("move");

      // Check knockout capture if on common track (step 0..50)
      let updatedTokens = tokens.map((t) =>
        t.color === token.color && t.id === token.id ? { ...t, step: newStep } : t
      );

      if (newStep <= 50) {
        const absPos = (COLOR_START_INDEX[token.color] + newStep) % 52;
        // Safe star positions on perimeter: 0, 8, 13, 21, 26, 34, 39, 47
        const isSafe = [0, 8, 13, 21, 26, 34, 39, 47].includes(absPos);

        if (!isSafe) {
          const target = updatedTokens.find((t) => {
            if (t.color === token.color || t.step < 0 || t.step > 50) return false;
            const tAbs = (COLOR_START_INDEX[t.color] + t.step) % 52;
            return tAbs === absPos;
          });

          if (target) {
            // Send captured opponent back to yard!
            updatedTokens = updatedTokens.map((t) =>
              t.color === target.color && t.id === target.id ? { ...t, step: -1 } : t
            );
            playSound("capture");
          }
        }
      }

      setTokens(updatedTokens);
      setDiceValue(null);
      isMovingRef.current = false;

      // Win check
      const currentTokens = updatedTokens.filter((t) => t.color === currentColor);
      if (currentTokens.every((t) => t.step === 56)) {
        setWinner(currentColor);
        playSound("win");
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          const duration = Math.max(30, Math.round((Date.now() - startTimeRef.current) / 1000));
          saveLocalMatch({
            gameId: "ludo",
            gameName: "Ludo",
            mode: currentMode,
            outcome: currentMode === "vs-ai" ? (currentColor === "red" ? "win" : "loss") : "win",
            durationSeconds: duration,
            playedAt: Date.now(),
            score: currentColor === "red" ? 100 : 0,
          });
        }
        return;
      }

      // Extra roll on 6, else pass turn
      if (val !== 6) {
        setTurnIndex((i) => i + 1);
      }
    },
    [diceValue, isRolling, winner, playSound, tokens, currentColor, currentMode]
  );

  // Auto-move single legal token for human (or auto yard-spawn if only yard options exist)
  React.useEffect(() => {
    if (!isHumanTurn || diceValue === null || isRolling || winner) return undefined;
    const tokenToMove = shouldAutoMoveLudoToken(movableTokens);
    if (tokenToMove) {
      const timer = setTimeout(() => {
        handleMoveToken(tokenToMove);
      }, 450);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isHumanTurn, diceValue, isRolling, winner, movableTokens, handleMoveToken]);

  // Pass turn if no moves available
  React.useEffect(() => {
    if (diceValue === null || isRolling || winner || movableTokens.length > 0) return undefined;
    const timer = setTimeout(() => {
      setDiceValue(null);
      setTurnIndex((i) => i + 1);
    }, 700);
    return () => clearTimeout(timer);
  }, [diceValue, isRolling, movableTokens.length, winner]);

  // AI turn automation
  React.useEffect(() => {
    if (isHumanTurn || winner) return undefined;
    if (diceValue === null && !isRolling) {
      const rollTimer = setTimeout(() => {
        rollDice();
      }, 500);
      return () => clearTimeout(rollTimer);
    }
    if (diceValue !== null && !isRolling && movableTokens.length > 0) {
      const moveTimer = setTimeout(() => {
        // AI strategy:
        // 1. Can capture an opponent token?
        let chosen = movableTokens.find((t) => {
          const nextStep = t.step === -1 ? 0 : t.step + diceValue;
          if (nextStep > 50) return false;
          const absPos = (COLOR_START_INDEX[t.color] + nextStep) % 52;
          if ([0, 8, 13, 21, 26, 34, 39, 47].includes(absPos)) return false;
          return tokens.some((other) => {
            if (other.color === t.color || other.step < 0 || other.step > 50) return false;
            return (COLOR_START_INDEX[other.color] + other.step) % 52 === absPos;
          });
        });

        // 2. Can exit yard on 6?
        if (!chosen && diceValue === 6) {
          chosen = movableTokens.find((t) => t.step === -1);
        }

        // 3. Otherwise token nearest goal
        if (!chosen) {
          chosen = [...movableTokens].sort((a, b) => b.step - a.step)[0];
        }

        if (chosen) {
          handleMoveToken(chosen);
        }
      }, 550);
      return () => clearTimeout(moveTimer);
    }
    return undefined;
  }, [isHumanTurn, diceValue, isRolling, movableTokens, winner, rollDice, handleMoveToken, tokens]);

  const resetGame = React.useCallback(() => {
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
    isMovingRef.current = false;
    setTokens((prev) => prev.map((t) => ({ ...t, step: -1 })));
    setDiceValue(null);
    setIsRolling(false);
    setTurnIndex(0);
    setWinner(null);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    playSound("click");
  }, [playSound]);

  // Keyboard shortcut Space to roll, R to restart
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === " " || e.key === "Enter") {
        if (diceValue === null && isHumanTurn && !isRolling && !winner) {
          e.preventDefault();
          rollDice();
        }
      } else if (e.key === "r" || e.key === "R") {
        resetGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [diceValue, isHumanTurn, isRolling, winner, rollDice, resetGame]);

  // Helper to get [x, y] in 0..150 SVG coordinate space
  const getTokenCoords = getLudoTokenCoords;

  // Render dice pips
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
        gameName="Ludo"
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
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Ludo</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
              {currentMode === "vs-ai" ? "vs AI" : "Pass & Play"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mode Switch */}
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
              <span className="hidden xs:inline">Local</span>
            </button>
          </div>

          {/* Players toggle */}
          <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setPlayerCount(2);
                resetGame();
              }}
              className={`px-2 py-1 rounded-md transition ${playerCount === 2 ? "bg-primary text-white" : "text-white/60 hover:text-white"}`}
            >
              2P
            </button>
            <button
              type="button"
              onClick={() => {
                setPlayerCount(4);
                resetGame();
              }}
              className={`px-2 py-1 rounded-md transition ${playerCount === 4 ? "bg-primary text-white" : "text-white/60 hover:text-white"}`}
            >
              4P
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
        {/* Turn Bar & Dice Roller */}
        <div className="mb-3 flex items-center justify-between w-full max-w-[min(92vw,calc(100dvh-130px),720px)] bg-white/[0.04] px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-3">
            <div
              className="h-6 w-6 rounded-full border-2 border-white shadow-lg animate-pulse"
              style={{ backgroundColor: COLOR_THEMES[currentColor].bg }}
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Turn
              </div>
              <div className={`text-sm font-black capitalize ${COLOR_THEMES[currentColor].text}`}>
                {currentColor} {currentMode === "vs-ai" && currentColor !== "red" ? "(AI Bot)" : "(Player)"}
              </div>
            </div>
          </div>

          {/* Dice & Roll Button */}
          <div className="flex items-center gap-2">
            {isHumanTurn && !winner && diceValue === null && (
              <span className="text-[11px] text-white/60 font-medium hidden sm:inline">Press Space to roll</span>
            )}
            {isHumanTurn && !winner && diceValue !== null && !isRolling && (
              <span className="text-[11px] font-semibold text-amber-300 max-w-[130px] sm:max-w-none text-right truncate">
                {movableTokens.length === 0
                  ? "No moves — passing turn..."
                  : shouldAutoMoveLudoToken(movableTokens)
                  ? "Auto-moving..."
                  : "Select a token to move"}
              </span>
            )}
            <button
              type="button"
              onClick={rollDice}
              disabled={diceValue !== null || isRolling || !isHumanTurn || Boolean(winner)}
              aria-label="Roll dice"
              className={`relative flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white text-zinc-950 font-black shadow-2xl transition-all active:scale-95 ${
                diceValue === null && isHumanTurn && !winner
                  ? "border-2 border-primary ring-4 ring-primary/40 animate-pulse cursor-pointer hover:scale-105"
                  : "border border-zinc-300 opacity-95 cursor-default"
              }`}
            >
              {isRolling ? (
                <Dices className="h-7 w-7 animate-spin text-primary" />
              ) : (
                renderDiceFace(diceValue)
              )}
            </button>
          </div>
        </div>

        {/* 15x15 Geometric Ludo Board */}
        <div className="relative aspect-square w-full max-w-[min(92vw,calc(100dvh-130px),720px)] bg-[#0c0e1a] rounded-3xl p-2.5 sm:p-3 border-4 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <svg viewBox="0 0 150 150" className="w-full h-full rounded-2xl bg-[#090b14]">
            {/* Yards */}
            {/* Red (Top-Left 0..60, 0..60) */}
            <rect x="0" y="0" width="60" height="60" fill="#ef4444" rx="6" />
            <rect x="10" y="10" width="40" height="40" fill="#ffffff" rx="8" />
            <circle cx="20" cy="20" r="6" fill="#ef4444" opacity="0.9" />
            <circle cx="40" cy="20" r="6" fill="#ef4444" opacity="0.9" />
            <circle cx="20" cy="40" r="6" fill="#ef4444" opacity="0.9" />
            <circle cx="40" cy="40" r="6" fill="#ef4444" opacity="0.9" />

            {/* Green (Top-Right 90..150, 0..60) */}
            <rect x="90" y="0" width="60" height="60" fill="#22c55e" rx="6" />
            <rect x="100" y="10" width="40" height="40" fill="#ffffff" rx="8" />
            <circle cx="110" cy="20" r="6" fill="#22c55e" opacity="0.9" />
            <circle cx="130" cy="20" r="6" fill="#22c55e" opacity="0.9" />
            <circle cx="110" cy="40" r="6" fill="#22c55e" opacity="0.9" />
            <circle cx="130" cy="40" r="6" fill="#22c55e" opacity="0.9" />

            {/* Blue (Bottom-Left 0..60, 90..150) */}
            <rect x="0" y="90" width="60" height="60" fill="#3b82f6" rx="6" />
            <rect x="10" y="100" width="40" height="40" fill="#ffffff" rx="8" />
            <circle cx="20" cy="110" r="6" fill="#3b82f6" opacity="0.9" />
            <circle cx="40" cy="110" r="6" fill="#3b82f6" opacity="0.9" />
            <circle cx="20" cy="130" r="6" fill="#3b82f6" opacity="0.9" />
            <circle cx="40" cy="130" r="6" fill="#3b82f6" opacity="0.9" />

            {/* Yellow (Bottom-Right 90..150, 90..150) */}
            <rect x="90" y="90" width="60" height="60" fill="#eab308" rx="6" />
            <rect x="100" y="100" width="40" height="40" fill="#ffffff" rx="8" />
            <circle cx="110" cy="110" r="6" fill="#eab308" opacity="0.9" />
            <circle cx="130" cy="110" r="6" fill="#eab308" opacity="0.9" />
            <circle cx="110" cy="130" r="6" fill="#eab308" opacity="0.9" />
            <circle cx="130" cy="130" r="6" fill="#eab308" opacity="0.9" />

            {/* 15x15 Cross Grid lines for track cells */}
            {TRACK_COORDS.map(([r, c], idx) => {
              const isStart = idx === 0 || idx === 13 || idx === 26 || idx === 39;
              const isSafe = [0, 8, 13, 21, 26, 34, 39, 47].includes(idx);
              const startFill =
                idx === 0
                  ? "#ef4444"
                  : idx === 13
                  ? "#22c55e"
                  : idx === 26
                  ? "#eab308"
                  : idx === 39
                  ? "#3b82f6"
                  : "#ffffff";
              const startStroke =
                idx === 0
                  ? "#b91c1c"
                  : idx === 13
                  ? "#15803d"
                  : idx === 26
                  ? "#a16207"
                  : idx === 39
                  ? "#1d4ed8"
                  : "#cbd5e1";

              return (
                <g key={`track-${idx}`}>
                  <rect
                    x={c * 10}
                    y={r * 10}
                    width="10"
                    height="10"
                    fill={isStart ? startFill : "#f8fafc"}
                    stroke={isStart ? startStroke : "#cbd5e1"}
                    strokeWidth="0.5"
                  />
                  {isSafe && !isStart && (
                    <text
                      x={c * 10 + 5}
                      y={r * 10 + 7.2}
                      fontSize="5.5"
                      textAnchor="middle"
                      fill="#64748b"
                      fontWeight="bold"
                    >
                      ★
                    </text>
                  )}
                  {isStart && (
                    <text
                      x={c * 10 + 5}
                      y={r * 10 + 7.2}
                      fontSize="5.5"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontWeight="bold"
                    >
                      ★
                    </text>
                  )}
                </g>
              );
            })}

            {/* Home Runway Rows */}
            {HOME_RUNWAYS.red.map(([r, c], i) => (
              <rect key={`hr-r-${i}`} x={c * 10} y={r * 10} width="10" height="10" fill="#ef4444" stroke="#991b1b" strokeWidth="0.5" />
            ))}
            {HOME_RUNWAYS.green.map(([r, c], i) => (
              <rect key={`hr-g-${i}`} x={c * 10} y={r * 10} width="10" height="10" fill="#22c55e" stroke="#166534" strokeWidth="0.5" />
            ))}
            {HOME_RUNWAYS.yellow.map(([r, c], i) => (
              <rect key={`hr-y-${i}`} x={c * 10} y={r * 10} width="10" height="10" fill="#eab308" stroke="#854d0e" strokeWidth="0.5" />
            ))}
            {HOME_RUNWAYS.blue.map(([r, c], i) => (
              <rect key={`hr-b-${i}`} x={c * 10} y={r * 10} width="10" height="10" fill="#3b82f6" stroke="#1e40af" strokeWidth="0.5" />
            ))}

            {/* Center Home Triangles */}
            <polygon points="60,60 90,60 75,75" fill="#22c55e" />
            <polygon points="90,60 90,90 75,75" fill="#eab308" />
            <polygon points="90,90 60,90 75,75" fill="#3b82f6" />
            <polygon points="60,90 60,60 75,75" fill="#ef4444" />
          </svg>

          {/* Tokens Placement Overlay */}
          <div className="absolute inset-2.5 sm:inset-3 pointer-events-auto">
            {tokens
              .filter((t) => activeColors.includes(t.color))
              .map((t) => {
                const isMovable = movableTokens.some(
                  (m) => m.color === t.color && m.id === t.id
                );

                const [cx, cy] = getTokenCoords(t);
                const topPercent = (cy / 150) * 100;
                const leftPercent = (cx / 150) * 100;

                // Group tokens sharing same coordinate to offset them
                const tokensAtCoord = tokens
                  .filter((other) => activeColors.includes(other.color))
                  .filter((other) => {
                    const [ox, oy] = getTokenCoords(other);
                    return ox === cx && oy === cy;
                  });
                const orderIdx = tokensAtCoord.findIndex(
                  (other) => other.id === t.id && other.color === t.color
                );
                let offsetX = 0;
                let offsetY = 0;
                if (tokensAtCoord.length === 2) {
                  offsetX = orderIdx === 0 ? -4 : 4;
                  offsetY = orderIdx === 0 ? -4 : 4;
                } else if (tokensAtCoord.length === 3) {
                  if (orderIdx === 0) { offsetX = -4; offsetY = -4; }
                  else if (orderIdx === 1) { offsetX = 4; offsetY = -4; }
                  else { offsetX = 0; offsetY = 4; }
                } else if (tokensAtCoord.length >= 4) {
                  offsetX = orderIdx % 2 === 0 ? -5 : 5;
                  offsetY = orderIdx < 2 ? -5 : 5;
                }

                return (
                  <div
                    key={`${t.color}-${t.id}`}
                    className="absolute pointer-events-none transition-all duration-300"
                    style={{
                      top: `${topPercent}%`,
                      left: `${leftPercent}%`,
                      transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
                      zIndex: isMovable && isHumanTurn ? 30 : 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => isMovable && isHumanTurn && handleMoveToken(t)}
                      disabled={!isMovable || !isHumanTurn}
                      aria-label={`${t.color} token ${t.id + 1} ${isMovable ? "movable" : ""}`}
                      className={`h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-white shadow-lg pointer-events-auto flex items-center justify-center transition-all ${
                        isMovable && isHumanTurn
                          ? "ring-4 ring-white animate-bounce cursor-pointer scale-110"
                          : "cursor-default hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: COLOR_THEMES[t.color].bg,
                      }}
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-white opacity-95 shadow-sm" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Win Announcement */}
        {winner && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
              <Sparkles className="h-5 w-5" />
              {winner.toUpperCase()} Won the Game!
            </span>
            <Button onClick={resetGame} className="gap-2 bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold">
              <RotateCcw className="h-4 w-4" />
              Play Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
