"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Volume2, VolumeX, Sparkles, Trophy, Play, Keyboard } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { readBestScore, commitBestScore } from "./scoring";
import { saveLocalMatch } from "../../hooks/use-local-history";

type Color = "green" | "red" | "yellow" | "blue";

// Authentic Simon harmonic frequencies
const PAD_CONFIG: Record<
  Color,
  { label: string; keyHint: string; freq: number; bg: string; activeBg: string; border: string }
> = {
  green: {
    label: "GREEN",
    keyHint: "Q / ↑",
    freq: 329.63, // E4
    bg: "bg-emerald-600/35",
    activeBg: "bg-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.95)] scale-[1.03] z-10",
    border: "border-emerald-500/60",
  },
  red: {
    label: "RED",
    keyHint: "W / →",
    freq: 440.0, // A4
    bg: "bg-rose-600/35",
    activeBg: "bg-rose-400 shadow-[0_0_60px_rgba(251,113,133,0.95)] scale-[1.03] z-10",
    border: "border-rose-500/60",
  },
  yellow: {
    label: "YELLOW",
    keyHint: "A / ←",
    freq: 277.18, // C#4
    bg: "bg-amber-500/35",
    activeBg: "bg-amber-300 shadow-[0_0_60px_rgba(252,211,77,0.95)] scale-[1.03] z-10",
    border: "border-amber-400/60",
  },
  blue: {
    label: "BLUE",
    keyHint: "S / ↓",
    freq: 164.81, // E3
    bg: "bg-sky-600/35",
    activeBg: "bg-sky-400 shadow-[0_0_60px_rgba(56,189,248,0.95)] scale-[1.03] z-10",
    border: "border-sky-500/60",
  },
};

const COLORS: Color[] = ["green", "red", "yellow", "blue"];

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

export function checkSimonStep(
  sequence: Color[],
  playerStep: number,
  clickedColor: Color
): { correct: boolean; roundComplete: boolean } {
  if (playerStep >= sequence.length) return { correct: false, roundComplete: false };
  const correct = sequence[playerStep] === clickedColor;
  const roundComplete = correct && playerStep + 1 === sequence.length;
  return { correct, roundComplete };
}

export function SimonSaysView({ onExit }: { onExit?: () => void }) {
  const [sequence, setSequence] = React.useState<Color[]>([]);
  const [playerStep, setPlayerStep] = React.useState(0);
  const [activePad, setActivePad] = React.useState<Color | null>(null);
  const [isPlayingSeq, setIsPlayingSeq] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(() => readBestScore("simon-says"));
  const [gameStarted, setGameStarted] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [showKeysHint, setShowKeysHint] = React.useState(false);

  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);
  const timersRef = React.useRef<NodeJS.Timeout[]>([]);

  // Clear pending sequence timeouts helper
  const clearAllTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  React.useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // Web Audio tone generator
  const playTone = React.useCallback(
    (freq: number, durationMs = 300) => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const durSec = durationMs / 1000;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.001, now + durSec);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + durSec);
      } catch {
        // audio fail
      }
    },
    [soundEnabled]
  );

  const playBuzzer = React.useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(45, now + 0.4);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // audio fail
    }
  }, [soundEnabled]);

  // Flash a pad visually and audibly
  const flashPad = React.useCallback(
    (color: Color, durationMs = 320) => {
      setActivePad(color);
      playTone(PAD_CONFIG[color].freq, durationMs);
      const timer = setTimeout(() => {
        setActivePad(null);
      }, durationMs);
      timersRef.current.push(timer);
    },
    [playTone]
  );

  // Play full computer sequence
  const playSequence = React.useCallback(
    (seq: Color[]) => {
      clearAllTimers();
      setIsPlayingSeq(true);
      setPlayerStep(0);

      const stepInterval = Math.max(260, 600 - seq.length * 20);
      const flashDuration = Math.max(180, stepInterval - 100);

      seq.forEach((c, idx) => {
        const timer = setTimeout(() => {
          flashPad(c, flashDuration);
          if (idx === seq.length - 1) {
            const endTimer = setTimeout(() => {
              setIsPlayingSeq(false);
            }, flashDuration + 80);
            timersRef.current.push(endTimer);
          }
        }, (idx + 1) * stepInterval);
        timersRef.current.push(timer);
      });
    },
    [flashPad, clearAllTimers]
  );

  // Advance to next round
  const nextRound = React.useCallback(
    (currentSeq: Color[]) => {
      const nextColor = COLORS[Math.floor(Math.random() * COLORS.length)]!;
      const newSeq = [...currentSeq, nextColor];
      setSequence(newSeq);
      playSequence(newSeq);
    },
    [playSequence]
  );

  // Start new game
  const startGame = React.useCallback(() => {
    clearAllTimers();
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setSequence([]);
    setPlayerStep(0);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    nextRound([]);
  }, [clearAllTimers, nextRound]);

  // Player clicks a pad
  const handlePadClick = React.useCallback(
    (color: Color) => {
      if (!gameStarted || isPlayingSeq || gameOver) return;

      flashPad(color, 240);

      const check = checkSimonStep(sequence, playerStep, color);
      if (check.correct) {
        if (check.roundComplete) {
          setIsPlayingSeq(true);
          const nextScore = score + 1;
          setScore(nextScore);
          if (nextScore > bestScore) {
            setBestScore(nextScore);
            commitBestScore("simon-says", nextScore);
          }
          const t = setTimeout(() => {
            nextRound(sequence);
          }, 550);
          timersRef.current.push(t);
        } else {
          setPlayerStep((prev) => prev + 1);
        }
      } else {
        playBuzzer();
        setGameOver(true);
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          saveLocalMatch({
            gameId: "simon-says",
            gameName: "Simon Says",
            mode: "solo",
            outcome: "loss",
            durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
            score,
          });
        }
      }
    },
    [gameStarted, isPlayingSeq, gameOver, sequence, playerStep, score, bestScore, flashPad, playBuzzer, nextRound]
  );

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "q" || e.key === "Q" || e.key === "ArrowUp") {
        e.preventDefault();
        handlePadClick("green");
      } else if (e.key === "w" || e.key === "W" || e.key === "ArrowRight") {
        e.preventDefault();
        handlePadClick("red");
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        e.preventDefault();
        handlePadClick("yellow");
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        e.preventDefault();
        handlePadClick("blue");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        startGame();
      } else if (e.key === " " || e.key === "Enter") {
        if (!gameStarted || gameOver) {
          e.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePadClick, gameStarted, gameOver, startGame]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Simon Says"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/10 bg-[#090A14]/90 backdrop-blur-md">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/10 text-white/90 hover:bg-white/10 text-xs sm:text-sm"
          onClick={() => (gameStarted && !gameOver ? setShowExitConfirm(true) : onExit?.())}
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Exit</span>
        </Button>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <Badge variant="secondary" className="gap-1 bg-purple-500/15 text-purple-300 border-purple-500/30 text-xs px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Score: {score}</span>
          </Badge>
          <Badge variant="secondary" className="hidden sm:inline-flex gap-1 bg-white/5 text-white/70 border-white/10 text-xs px-2.5 py-1">
            <Trophy className="h-3.5 w-3.5 text-yellow-400" />
            <span>Best: {bestScore}</span>
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKeysHint(!showKeysHint)}
            className="h-8 w-8 p-0 text-white/60 hover:text-white hidden sm:flex"
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-white/70 hover:text-white"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-white/40" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/10 text-white/90 hover:bg-white/10 text-xs sm:text-sm"
            onClick={startGame}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </Button>
        </div>
      </header>

      {/* Main Game Stage */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {showKeysHint && (
          <div className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary animate-in fade-in">
            Use <strong>Q, W, A, S</strong> or <strong>Arrow keys</strong> to trigger the pads!
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-400 uppercase">
            SIMON SAYS
          </h2>
          <p className="text-xs text-white/50 mt-1 font-medium">
            {isPlayingSeq ? (
              <span className="text-amber-400 animate-pulse">Watch & listen carefully...</span>
            ) : gameStarted && !gameOver ? (
              <span className="text-emerald-400 font-bold">
                Repeat the sequence ({playerStep}/{sequence.length})
              </span>
            ) : (
              "Test your auditory & visual memory"
            )}
          </p>
        </div>

        {/* Circular Simon Console with High-Gloss Bezels */}
        <div className="relative aspect-square w-full max-w-[min(88vw,66vh,480px)] rounded-full border-8 border-[#171930] bg-[#0c0d1c] p-3 sm:p-4 shadow-[0_25px_60px_rgba(0,0,0,0.9)] flex items-center justify-center">
          {/* 4 Quadrants */}
          <div className="grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-4 h-full w-full rounded-full overflow-hidden">
            {/* Top-Left: Green */}
            <button
              type="button"
              disabled={isPlayingSeq || !gameStarted}
              onClick={() => handlePadClick("green")}
              aria-label="Green pad"
              className={`group relative rounded-tl-full border-2 transition-all duration-150 cursor-pointer ${
                PAD_CONFIG.green.border
              } ${activePad === "green" ? PAD_CONFIG.green.activeBg : PAD_CONFIG.green.bg}`}
            >
              <span className="absolute top-4 left-6 text-[10px] font-mono font-bold text-white/40 group-hover:text-white/80 transition hidden sm:inline">
                {PAD_CONFIG.green.keyHint}
              </span>
            </button>

            {/* Top-Right: Red */}
            <button
              type="button"
              disabled={isPlayingSeq || !gameStarted}
              onClick={() => handlePadClick("red")}
              aria-label="Red pad"
              className={`group relative rounded-tr-full border-2 transition-all duration-150 cursor-pointer ${
                PAD_CONFIG.red.border
              } ${activePad === "red" ? PAD_CONFIG.red.activeBg : PAD_CONFIG.red.bg}`}
            >
              <span className="absolute top-4 right-6 text-[10px] font-mono font-bold text-white/40 group-hover:text-white/80 transition hidden sm:inline">
                {PAD_CONFIG.red.keyHint}
              </span>
            </button>

            {/* Bottom-Left: Yellow */}
            <button
              type="button"
              disabled={isPlayingSeq || !gameStarted}
              onClick={() => handlePadClick("yellow")}
              aria-label="Yellow pad"
              className={`group relative rounded-bl-full border-2 transition-all duration-150 cursor-pointer ${
                PAD_CONFIG.yellow.border
              } ${activePad === "yellow" ? PAD_CONFIG.yellow.activeBg : PAD_CONFIG.yellow.bg}`}
            >
              <span className="absolute bottom-4 left-6 text-[10px] font-mono font-bold text-white/40 group-hover:text-white/80 transition hidden sm:inline">
                {PAD_CONFIG.yellow.keyHint}
              </span>
            </button>

            {/* Bottom-Right: Blue */}
            <button
              type="button"
              disabled={isPlayingSeq || !gameStarted}
              onClick={() => handlePadClick("blue")}
              aria-label="Blue pad"
              className={`group relative rounded-br-full border-2 transition-all duration-150 cursor-pointer ${
                PAD_CONFIG.blue.border
              } ${activePad === "blue" ? PAD_CONFIG.blue.activeBg : PAD_CONFIG.blue.bg}`}
            >
              <span className="absolute bottom-4 right-6 text-[10px] font-mono font-bold text-white/40 group-hover:text-white/80 transition hidden sm:inline">
                {PAD_CONFIG.blue.keyHint}
              </span>
            </button>
          </div>

          {/* Center Hub */}
          <div className="absolute h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 rounded-full border-4 border-[#171930] bg-[#0A0B14] shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center p-2 text-center pointer-events-none">
            <span className="text-[9px] font-bold text-white/40 tracking-widest uppercase">ROUNDS</span>
            <span className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight">
              {score}
            </span>
            {isPlayingSeq ? (
              <span className="text-[10px] text-amber-400 font-bold animate-pulse tracking-wider">
                PLAYING
              </span>
            ) : gameStarted && !gameOver ? (
              <span className="text-[10px] text-emerald-400 font-bold tracking-wider">
                YOUR TURN
              </span>
            ) : (
              <span className="text-[10px] text-white/40 font-semibold tracking-wider">
                READY
              </span>
            )}
          </div>
        </div>

        {/* Start Game Button (if not started) */}
        {!gameStarted && (
          <div className="mt-8">
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black text-base px-8 py-6 rounded-2xl shadow-xl shadow-emerald-500/25 active:scale-95"
              onClick={startGame}
            >
              <Play className="h-5 w-5 fill-current" />
              START GAME
            </Button>
          </div>
        )}
      </main>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#121424] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
              <RotateCcw className="h-7 w-7 text-rose-400" />
            </div>

            <h3 className="text-2xl font-black text-white">Wrong Sequence!</h3>
            <p className="mt-1 text-sm text-white/60">
              You memorized <span className="font-bold text-white">{score}</span> notes accurately.
            </p>

            <div className="flex justify-around my-4 py-2 border-y border-white/5">
              <div>
                <p className="text-xs text-white/50">Score</p>
                <p className="text-lg font-bold text-purple-400">{score}</p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-xs text-white/50">Best</p>
                <p className="text-lg font-bold text-yellow-400">{bestScore}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-white/10 text-white/80 hover:bg-white/10"
                onClick={onExit}
              >
                Exit
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold"
                onClick={startGame}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
