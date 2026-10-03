"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Volume2, VolumeX, Sparkles, Trophy, Timer, Play, Zap, Bomb, Flame, Crosshair } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { readBestScore, commitBestScore } from "./scoring";
import { saveLocalMatch } from "../../hooks/use-local-history";

type MoleType = "standard" | "golden" | "bomb" | "speed";

interface HoleState {
  active: boolean;
  type: MoleType;
  whacked: boolean;
  spawnTime: number;
  duration: number;
}

interface HitPopup {
  id: number;
  holeIdx: number;
  text: string;
  color: string;
  xOffset: number;
}

const DURATION_PRESETS = [
  { label: "30s Blitz", duration: 30 },
  { label: "45s Frenzy", duration: 45 },
  { label: "60s Marathon", duration: 60 },
];

// Persistent AudioContext singleton
let globalAudioContext: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!globalAudioContext) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      globalAudioContext = new AudioCtx();
    }
  }
  if (globalAudioContext && globalAudioContext.state === "suspended") {
    globalAudioContext.resume().catch(() => {});
  }
  return globalAudioContext;
}

export function calculateWhackScore(
  moleType: MoleType,
  currentCombo: number,
  currentScore: number
): { points: number; nextCombo: number; nextScore: number; bonusTime: number } {
  let points = 0;
  let nextCombo = currentCombo;
  let bonusTime = 0;

  if (moleType === "standard") {
    nextCombo = Math.min(5, currentCombo + 1);
    points = 10 * nextCombo;
  } else if (moleType === "golden") {
    nextCombo = Math.min(5, currentCombo + 1);
    points = 30 * nextCombo;
    bonusTime = 1000;
  } else if (moleType === "speed") {
    nextCombo = Math.min(5, currentCombo + 1);
    points = 20 * nextCombo;
  } else if (moleType === "bomb") {
    nextCombo = 0;
    points = -25;
  }

  const nextScore = Math.max(0, currentScore + points);
  return { points, nextCombo, nextScore, bonusTime };
}

export function WhackAMoleView({ onExit }: { onExit?: () => void }) {
  const [selectedDuration, setSelectedDuration] = React.useState(45);
  const [holes, setHoles] = React.useState<HoleState[]>(() =>
    Array(9).fill(null).map(() => ({ active: false, type: "standard", whacked: false, spawnTime: 0, duration: 0 }))
  );
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(() => readBestScore("whack-a-mole"));
  const [timeLeft, setTimeLeft] = React.useState(45);
  const [combo, setCombo] = React.useState(0);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [hitPopups, setHitPopups] = React.useState<HitPopup[]>([]);
  const [isShaking, setIsShaking] = React.useState(false);

  // Stable refs for game loop
  const holesRef = React.useRef(holes);
  holesRef.current = holes;
  const scoreRef = React.useRef(score);
  scoreRef.current = score;
  const comboRef = React.useRef(combo);
  comboRef.current = combo;
  const gameStartedRef = React.useRef(gameStarted);
  gameStartedRef.current = gameStarted;
  const gameOverRef = React.useRef(gameOver);
  gameOverRef.current = gameOver;
  const timeLeftRef = React.useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);
  const nextSpawnTimeRef = React.useRef(0);
  const popupIdRef = React.useRef(0);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  React.useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // Web Audio synthesizer
  const playSound = React.useCallback(
    (type: "hit" | "gold" | "bomb" | "speed" | "miss" | "combo-max" | "gameover", comboScale = 1) => {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;

        if (type === "hit") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          const baseFreq = 380 + Math.min(300, (comboScale - 1) * 60);
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === "gold") {
          [587.33, 880, 1174.66, 1479.98].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(f, now + i * 0.04);
            gain.gain.setValueAtTime(0.12, now + i * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.16);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.04);
            osc.stop(now + i * 0.04 + 0.16);
          });
        } else if (type === "speed") {
          [880, 1318.51].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(f, now + i * 0.04);
            gain.gain.setValueAtTime(0.1, now + i * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.04);
            osc.stop(now + i * 0.04 + 0.12);
          });
        } else if (type === "bomb") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(110, now);
          osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === "miss") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(120, now);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === "combo-max") {
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(f, now + i * 0.05);
            gain.gain.setValueAtTime(0.14, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.2);
          });
        }
      } catch {
        // Audio error handled
      }
    },
    [soundEnabled]
  );

  const startGame = () => {
    clearAllTimers();
    setScore(0);
    setCombo(0);
    setTimeLeft(selectedDuration);
    setHoles(Array(9).fill(null).map(() => ({ active: false, type: "standard", whacked: false, spawnTime: 0, duration: 0 })));
    setGameOver(false);
    setGameStarted(true);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    nextSpawnTimeRef.current = Date.now() + 300;
  };

  // Main deterministic game loop
  React.useEffect(() => {
    if (!gameStarted || gameOver) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSec = Math.floor((now - startTimeRef.current) / 1000);
      const remainingSec = Math.max(0, selectedDuration - elapsedSec);

      setTimeLeft(remainingSec);

      // Check game over
      if (remainingSec <= 0) {
        setGameOver(true);
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          const finalScore = scoreRef.current;
          saveLocalMatch({
            gameId: "whack-a-mole",
            gameName: "Whack-A-Mole",
            mode: "solo",
            outcome: "win",
            durationSeconds: selectedDuration,
            score: finalScore,
          });
        }
        clearInterval(interval);
        return;
      }

      const currentHoles = holesRef.current;
      let stateChanged = false;
      const nextHoles = [...currentHoles];

      // 1. Check & retreat expired active moles
      for (let i = 0; i < 9; i++) {
        const h = nextHoles[i]!;
        if (h.active && !h.whacked && now - h.spawnTime >= h.duration) {
          nextHoles[i] = { active: false, type: "standard", whacked: false, spawnTime: 0, duration: 0 };
          stateChanged = true;
        }
      }

      // 2. Spawn new mole if interval reached
      if (now >= nextSpawnTimeRef.current) {
        // Progress (0 to 1) speeds up spawn rates
        const progress = (selectedDuration - remainingSec) / selectedDuration;
        const spawnDelay = Math.max(380, 820 - progress * 420);
        nextSpawnTimeRef.current = now + spawnDelay;

        // Count how many are currently active
        const activeCount = nextHoles.filter((h) => h.active && !h.whacked).length;
        const maxConcurrent = progress > 0.6 ? 3 : progress > 0.3 ? 2 : 1;

        if (activeCount < maxConcurrent) {
          const inactiveIndices: number[] = [];
          nextHoles.forEach((h, idx) => {
            if (!h.active) inactiveIndices.push(idx);
          });

          if (inactiveIndices.length > 0) {
            const pickIdx = inactiveIndices[Math.floor(Math.random() * inactiveIndices.length)]!;
            const roll = Math.random();
            let type: MoleType = "standard";
            let duration = Math.max(620, 1150 - progress * 500);

            if (roll < 0.18) {
              type = "bomb";
              duration = Math.max(700, 1200 - progress * 450);
            } else if (roll < 0.34) {
              type = "golden";
              duration = Math.max(550, 950 - progress * 400);
            } else if (roll < 0.5) {
              type = "speed";
              duration = Math.max(480, 750 - progress * 300);
            }

            nextHoles[pickIdx] = {
              active: true,
              type,
              whacked: false,
              spawnTime: now,
              duration,
            };
            stateChanged = true;
          }
        }
      }

      if (stateChanged) {
        setHoles(nextHoles);
      }
    }, 60);

    return () => clearInterval(interval);
  }, [gameStarted, gameOver, selectedDuration]);

  // Whack hole handler
  const whack = React.useCallback(
    (idx: number) => {
      if (!gameStartedRef.current || gameOverRef.current) return;
      const hole = holesRef.current[idx];

      // Whacking empty hole (miss)
      if (!hole || !hole.active || hole.whacked) {
        playSound("miss");
        setCombo(0);
        return;
      }

      const currentCombo = comboRef.current;
      const { points, nextCombo, nextScore, bonusTime } = calculateWhackScore(
        hole.type,
        currentCombo,
        scoreRef.current
      );

      setCombo(nextCombo);
      if (bonusTime > 0) {
        startTimeRef.current += bonusTime;
      }

      let popupText = "";
      let popupColor = "text-emerald-400";

      if (hole.type === "standard") {
        playSound("hit", nextCombo);
        popupText = nextCombo > 1 ? `+${points} (${nextCombo}x)` : `+10`;
        popupColor = "text-emerald-400";
        if (nextCombo === 5) playSound("combo-max");
      } else if (hole.type === "golden") {
        playSound("gold");
        popupText = `+${points} GOLD!`;
        popupColor = "text-yellow-400";
      } else if (hole.type === "speed") {
        playSound("speed");
        popupText = `+${points} FAST!`;
        popupColor = "text-cyan-400";
      } else if (hole.type === "bomb") {
        playSound("bomb");
        popupText = "-25 BOOM!";
        popupColor = "text-rose-400";
        setIsShaking(true);
        const shakeT = setTimeout(() => setIsShaking(false), 300);
        timersRef.current.push(shakeT);
      }

      // Mark whacked
      setHoles((prev) => {
        const next = [...prev];
        next[idx] = { ...hole, whacked: true };
        return next;
      });

      setScore(nextScore);
      if (nextScore > bestScore) {
        setBestScore(nextScore);
        commitBestScore("whack-a-mole", nextScore);
      }

      // Popup animation
      const popupId = ++popupIdRef.current;
      const xOffset = (Math.random() - 0.5) * 16;
      setHitPopups((prev) => [...prev, { id: popupId, holeIdx: idx, text: popupText, color: popupColor, xOffset }]);

      const cleanupT = setTimeout(() => {
        setHitPopups((prev) => prev.filter((p) => p.id !== popupId));
        setHoles((prev) => {
          const next = [...prev];
          if (next[idx]?.whacked) {
            next[idx] = { active: false, type: "standard", whacked: false, spawnTime: 0, duration: 0 };
          }
          return next;
        });
      }, 350);
      timersRef.current.push(cleanupT);
    },
    [bestScore, playSound]
  );

  // Keyboard shortcut controls: 1-9 top row & Numpad 1-9
  const startGameRef = React.useRef(startGame);
  startGameRef.current = startGame;

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStartedRef.current || gameOverRef.current) {
        if (e.key === " " || e.key === "Enter" || e.key === "r" || e.key === "R") {
          startGameRef.current();
        }
        return;
      }

      if (e.key === "r" || e.key === "R") {
        startGameRef.current();
        return;
      }

      // Numpad mapping (checked FIRST so e.code takes precedence over e.key = "7" etc.):
      const numpadMap: Record<string, number> = {
        Numpad7: 0, Numpad8: 1, Numpad9: 2,
        Numpad4: 3, Numpad5: 4, Numpad6: 5,
        Numpad1: 6, Numpad2: 7, Numpad3: 8,
      };

      // Digit row 1-9 mapping (for top row number keys):
      const digitMap: Record<string, number> = {
        "1": 0, "2": 1, "3": 2,
        "4": 3, "5": 4, "6": 5,
        "7": 6, "8": 7, "9": 8,
      };

      if (numpadMap[e.code] !== undefined) {
        e.preventDefault();
        whack(numpadMap[e.code]!);
      } else if (digitMap[e.key] !== undefined) {
        e.preventDefault();
        whack(digitMap[e.key]!);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [whack]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Whack-A-Mole"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Top Floating Control Bar */}
      <div className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/5 bg-[#090A14]/90 backdrop-blur-md">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/10 text-white/90 hover:bg-white/10 text-xs sm:text-sm"
          onClick={() => (gameStarted && !gameOver ? setShowExitConfirm(true) : onExit?.())}
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Exit</span>
        </Button>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Combo Multiplier Badge */}
          {combo > 1 && (
            <Badge
              variant="outline"
              className={`gap-1 px-2 py-0.5 text-xs font-black animate-pulse ${
                combo === 5
                  ? "bg-amber-500/20 text-yellow-300 border-yellow-400/50 shadow-[0_0_12px_rgba(234,179,8,0.4)]"
                  : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span>{combo}x COMBO</span>
            </Badge>
          )}

          {/* Time Badge */}
          <Badge
            variant="secondary"
            className={`gap-1.5 px-2.5 py-1 text-xs border ${
              timeLeft <= 8
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse font-black"
                : "bg-white/5 text-white/80 border-white/10"
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            <span>{timeLeft}s</span>
          </Badge>

          <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-300 border-amber-500/20 text-xs px-2.5 py-1 font-bold">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Score: {score}</span>
          </Badge>
          <Badge variant="secondary" className="hidden sm:inline-flex gap-1 bg-white/5 text-white/70 border-white/10 text-xs px-2.5 py-1">
            <Trophy className="h-3.5 w-3.5 text-yellow-400" />
            <span>Best: {bestScore}</span>
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-white/70 hover:text-white"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-400" />}
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
      </div>

      {/* Main Game Stage */}
      <div className="relative flex flex-1 flex-col items-center justify-between p-3 sm:p-4 max-w-2xl mx-auto w-full">
        {/* Game Title & Duration Presets */}
        <div className="text-center my-1 w-full">
          <h2 className="text-xl sm:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 uppercase">
            WHACK-A-MOLE
          </h2>
          {!gameStarted ? (
            <div className="flex justify-center items-center gap-2 mt-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.duration}
                  onClick={() => {
                    setSelectedDuration(p.duration);
                    setTimeLeft(p.duration);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    selectedDuration === p.duration
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                      : "bg-white/5 text-white/50 border-white/10 hover:text-white/80"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/50 mt-1">
              Tap holes or press <span className="font-mono text-cyan-300">1-9</span> keys! Avoid Cyber Bombs!
            </p>
          )}
        </div>

        {/* 3x3 Burrows Grid */}
        <div className={`relative grid grid-cols-3 grid-rows-3 gap-3 sm:gap-4 my-auto w-full max-w-[min(90vw,66vh,480px)] aspect-square p-3 sm:p-4 rounded-3xl bg-[#121426] border-2 border-amber-500/25 shadow-[0_0_40px_rgba(245,158,11,0.12)] transition-transform ${isShaking ? "animate-shake" : ""}`}>
          {holes.map((hole, idx) => {
            const popups = hitPopups.filter((p) => p.holeIdx === idx);

            return (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                onClick={() => whack(idx)}
                className="relative rounded-2xl bg-[#090A14] border-2 border-white/10 flex items-center justify-center overflow-hidden cursor-pointer shadow-inner active:scale-95 transition-transform group"
              >
                {/* Keyboard badge shortcut for desktop */}
                <span className="absolute top-1.5 left-2 text-[10px] font-mono text-white/20 select-none group-hover:text-white/40">
                  {idx + 1}
                </span>

                {/* Burrow mound shading */}
                <div className="absolute bottom-0 inset-x-0 h-5 bg-gradient-to-t from-black/60 to-transparent rounded-b-2xl border-t border-white/5" />

                {/* Floating score text on whack */}
                {popups.map((popup) => (
                  <div
                    key={popup.id}
                    style={{ transform: `translateX(${popup.xOffset}px)` }}
                    className={`absolute z-30 font-black text-xl sm:text-2xl animate-in fade-in zoom-in-125 duration-200 pointer-events-none drop-shadow-md ${popup.color}`}
                  >
                    {popup.text}
                  </div>
                ))}

                {/* Active Mole / Target */}
                {hole.active && (
                  <div
                    className={`relative z-10 flex flex-col items-center justify-center transition-all duration-150 ${
                      hole.whacked ? "scale-75 opacity-60" : "scale-100 animate-in slide-in-from-bottom-8"
                    }`}
                  >
                    {hole.type === "standard" && (
                      <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-gradient-to-t from-emerald-600 to-emerald-400 border-2 border-emerald-300 shadow-[0_0_16px_#34d399] flex flex-col items-center justify-center">
                        <div className="flex gap-2 mb-1">
                          <span className="h-2 w-2 rounded-full bg-black ring-1 ring-white/50" />
                          <span className="h-2 w-2 rounded-full bg-black ring-1 ring-white/50" />
                        </div>
                        <span className="h-2.5 w-4 rounded-full bg-emerald-900 border border-emerald-400/50" />
                        <span className="text-[9px] font-black text-black/80 mt-1">CYBER</span>
                      </div>
                    )}

                    {hole.type === "golden" && (
                      <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-gradient-to-t from-amber-500 to-yellow-300 border-2 border-yellow-200 shadow-[0_0_25px_#fde047] flex flex-col items-center justify-center animate-pulse">
                        <div className="flex gap-2 mb-1">
                          <Zap className="h-2.5 w-2.5 text-black fill-black" />
                          <Zap className="h-2.5 w-2.5 text-black fill-black" />
                        </div>
                        <span className="h-2.5 w-4 rounded-full bg-amber-800" />
                        <span className="text-[9px] font-black text-black mt-1">+1s GOLD</span>
                      </div>
                    )}

                    {hole.type === "speed" && (
                      <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-gradient-to-t from-cyan-600 to-sky-300 border-2 border-cyan-200 shadow-[0_0_20px_#38bdf8] flex flex-col items-center justify-center">
                        <Crosshair className="h-5 w-5 text-black mb-1 animate-spin" />
                        <span className="text-[9px] font-black text-black">SPEED</span>
                      </div>
                    )}

                    {hole.type === "bomb" && (
                      <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-gradient-to-t from-rose-700 to-rose-500 border-2 border-rose-300 shadow-[0_0_22px_#f43f5e] flex flex-col items-center justify-center">
                        <Bomb className="h-7 w-7 text-black fill-black animate-bounce" />
                        <span className="text-[9px] font-black text-white">BOMB!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Start Button */}
        {!gameStarted && (
          <div className="mt-2 mb-auto">
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-black text-base px-8 py-6 rounded-2xl shadow-xl shadow-amber-500/25 active:scale-95"
              onClick={startGame}
            >
              <Play className="h-5 w-5 fill-current" />
              START FRENZY
            </Button>
          </div>
        )}
      </div>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#121424] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <Trophy className="h-7 w-7 text-amber-400" />
            </div>

            <h3 className="text-2xl font-black text-white">Time&apos;s Up!</h3>
            <p className="mt-1 text-xs text-white/60">{selectedDuration}s Frenzy Complete</p>

            <div className="flex justify-around my-4 py-2 border-y border-white/5">
              <div>
                <p className="text-xs text-white/50">Final Score</p>
                <p className="text-2xl font-black text-amber-400">{score}</p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-xs text-white/50">Personal Best</p>
                <p className="text-2xl font-black text-yellow-400">{bestScore}</p>
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
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold"
                onClick={startGame}
              >
                Play Again
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
