"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Volume2, VolumeX, Sparkles, Trophy, Flame } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { readBestScore, commitBestScore } from "./scoring";
import { saveLocalMatch } from "../../hooks/use-local-history";

const WORD_LIST = [
  "ABOVE", "ACUTE", "ALIVE", "ALONE", "ANGEL", "ANKLE", "APPLE", "ASSET",
  "BEACH", "BEGIN", "BLACK", "BLAST", "BLAZE", "BLINK", "BLOCK", "BLOOM",
  "BOOST", "BRAIN", "BRAVE", "BREAD", "BRICK", "BRISK", "BROAD", "CABIN",
  "CAMEL", "CHAIR", "CHAMP", "CHARM", "CHEST", "CHESS", "CHILL", "CLAIM",
  "CLEAN", "CLEAR", "CLIMB", "CLOCK", "CLOUD", "CORAL", "CRANE", "CRISP",
  "CROWN", "CYBER", "DANCE", "DELTA", "DREAM", "DRIFT", "DRINK", "DRIVE",
  "EAGLE", "EARTH", "EMBER", "EXACT", "FAIRY", "FLAME", "FLASH", "FLOAT",
  "FOCUS", "FROST", "FRUIT", "GHOST", "GIANT", "GLIDE", "GLORY", "GLOWS",
  "GRACE", "GRAIN", "GRAND", "GRAPE", "HAVEN", "HEART", "HONEY", "HONOR",
  "HOUSE", "HYPER", "IMAGE", "IVORY", "JUICE", "KNIFE", "LEMON", "LIGHT",
  "LODGE", "LUNAR", "MAGIC", "MANGO", "MARCH", "MATCH", "MEDAL", "MONEY",
  "MUSIC", "NIGHT", "NINJA", "NOBLE", "OCEAN", "ORBIT", "PAINT", "PANDA",
  "PANIC", "PARTY", "PEACE", "PEARL", "PIANO", "PILOT", "PIZZA", "PLANT",
  "POWER", "PRIDE", "PRIME", "PULSE", "QUEEN", "QUEST", "RADAR", "RADIO",
  "RAPID", "RAZOR", "RIDER", "RIVER", "ROBOT", "ROCKY", "ROYAL", "SCALE",
  "SCOPE", "SHARK", "SHIELD", "SHINE", "SHOCK", "SKATE", "SMART", "SMILE",
  "SNAKE", "SNOWY", "SOLAR", "SONIC", "SPACE", "SPARK", "SPEED", "SPIRE",
  "SPORT", "STEEL", "STORM", "SUGAR", "SURGE", "SWEET", "SWIFT", "SWORD",
  "TIGER", "TITAN", "TOWER", "TRACK", "TRAIN", "TULIP", "TURBO", "VALOR",
  "VALVE", "VAPOR", "VIBES", "VIPER", "VIVID", "VOICE", "WATER", "WHALE",
  "WHEAT", "WHEEL", "WINDY", "WITCH", "WORLD", "YACHT", "YOUTH", "ZEBRA",
  "ZESTY"
];

export type TileState = "empty" | "tbd" | "correct" | "present" | "absent";

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

/**
 * Computes exact Wordle tile statuses for a 5-letter guess against the secret word,
 * properly handling duplicate letters (greens first, then yellow for remaining counts, else gray).
 */
export function evaluateGuess(guess: string, target: string): TileState[] {
  const result: TileState[] = Array(5).fill("absent");
  const targetChars = target.split("");
  const guessChars = guess.split("");

  // Pass 1: exact matches (green)
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === targetChars[i]) {
      result[i] = "correct";
      targetChars[i] = ""; // consume
      guessChars[i] = "*";
    }
  }

  // Pass 2: misplaced matches (yellow)
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] !== "*") {
      const idxInTarget = targetChars.indexOf(guessChars[i]!);
      if (idxInTarget !== -1) {
        result[i] = "present";
        targetChars[idxInTarget] = ""; // consume
      }
    }
  }

  return result;
}

export function processWordGuessKey(
  currentGuess: string,
  key: string
): { nextGuess: string; submit: boolean } {
  const upper = key.toUpperCase();
  if (upper === "ENTER") {
    return { nextGuess: currentGuess, submit: true };
  }
  if (upper === "BACKSPACE" || upper === "DEL") {
    return { nextGuess: currentGuess.slice(0, -1), submit: false };
  }
  if (/^[A-Z]$/.test(upper) && currentGuess.length < 5) {
    return { nextGuess: currentGuess + upper, submit: false };
  }
  return { nextGuess: currentGuess, submit: false };
}

export function WordGuessView({ onExit }: { onExit?: () => void }) {
  const [targetWord, setTargetWord] = React.useState<string>(() => getRandomWord());
  const [guesses, setGuesses] = React.useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = React.useState<string>("");
  const [gameStatus, setGameStatus] = React.useState<"playing" | "won" | "lost">("playing");
  const [streak, setStreak] = React.useState(0);
  const [bestStreak, setBestStreak] = React.useState(() => readBestScore("word-guess"));
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [invalidShake, setInvalidShake] = React.useState(false);

  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);
  const shakeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = null;
      }
    };
  }, []);

  function getRandomWord(): string {
    return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]!;
  }

  // Audio synthesizer
  const playSound = React.useCallback(
    (type: "key" | "delete" | "reveal" | "win" | "lose" | "invalid") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === "key") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === "delete") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(320, now);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.06);
        } else if (type === "reveal") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(520, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === "invalid") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(160, now);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.18);
        } else if (type === "win") {
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.15, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.35);
          });
        } else if (type === "lose") {
          [380, 320, 260, 200].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
            gain.gain.setValueAtTime(0.1, now + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.25);
          });
        }
      } catch {
        // audio fail
      }
    },
    [soundEnabled]
  );

  const submitGuess = React.useCallback(() => {
    if (currentGuess.length !== 5) {
      playSound("invalid");
      setInvalidShake(true);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => {
        setInvalidShake(false);
        shakeTimerRef.current = null;
      }, 500);
      return;
    }

    const nextGuesses = [...guesses, currentGuess];
    setGuesses(nextGuesses);
    setCurrentGuess("");
    playSound("reveal");

    if (currentGuess === targetWord) {
      setGameStatus("won");
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      if (nextStreak > bestStreak) {
        setBestStreak(nextStreak);
        commitBestScore("word-guess", nextStreak);
      }
      playSound("win");
      if (!matchRecordedRef.current) {
        matchRecordedRef.current = true;
        saveLocalMatch({
          gameId: "word-guess",
          gameName: "Word Guess",
          mode: "solo",
          outcome: "win",
          durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
          score: nextStreak,
        });
      }
    } else if (nextGuesses.length >= 6) {
      setGameStatus("lost");
      setStreak(0);
      playSound("lose");
      if (!matchRecordedRef.current) {
        matchRecordedRef.current = true;
        saveLocalMatch({
          gameId: "word-guess",
          gameName: "Word Guess",
          mode: "solo",
          outcome: "loss",
          durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
          score: streak,
        });
      }
    }
  }, [currentGuess, guesses, targetWord, streak, bestStreak, playSound]);

  const handleKey = React.useCallback(
    (key: string) => {
      if (gameStatus !== "playing") return;

      const { nextGuess, submit } = processWordGuessKey(currentGuess, key);
      if (submit) {
        submitGuess();
      } else if (nextGuess.length < currentGuess.length) {
        setCurrentGuess(nextGuess);
        playSound("delete");
      } else if (nextGuess.length > currentGuess.length) {
        setCurrentGuess(nextGuess);
        playSound("key");
      }
    },
    [gameStatus, currentGuess, submitGuess, playSound]
  );

  const restart = React.useCallback(() => {
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    setInvalidShake(false);
    setTargetWord(getRandomWord());
    setGuesses([]);
    setCurrentGuess("");
    setGameStatus("playing");
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
  }, []);

  // Physical Keyboard listener
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (gameStatus !== "playing") {
        if (e.key === "Enter" || e.key === " " || e.key === "r" || e.key === "R") {
          e.preventDefault();
          restart();
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        handleKey("ENTER");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleKey("BACKSPACE");
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKey(e.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameStatus, handleKey, restart]);

  // Keyboard letter color map
  const letterStatuses = React.useMemo(() => {
    const statuses: Record<string, TileState> = {};
    for (const guess of guesses) {
      const evaluation = evaluateGuess(guess, targetWord);
      for (let i = 0; i < 5; i++) {
        const letter = guess[i]!;
        const status = evaluation[i]!;
        if (status === "correct") {
          statuses[letter] = "correct";
        } else if (status === "present" && statuses[letter] !== "correct") {
          statuses[letter] = "present";
        } else if (!statuses[letter]) {
          statuses[letter] = "absent";
        }
      }
    }
    return statuses;
  }, [guesses, targetWord]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Word Guess"
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
          onClick={() => (gameStatus !== "playing" ? onExit?.() : setShowExitConfirm(true))}
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Exit</span>
        </Button>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs px-2.5 py-1">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>Streak: {streak}</span>
          </Badge>
          <Badge variant="secondary" className="hidden sm:inline-flex gap-1 bg-white/5 text-white/70 border-white/10 text-xs px-2.5 py-1">
            <Trophy className="h-3.5 w-3.5 text-yellow-400" />
            <span>Best: {bestStreak}</span>
          </Badge>
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
            onClick={restart}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Word</span>
          </Button>
        </div>
      </header>

      {/* Main Board Container */}
      <main className="relative flex flex-1 flex-col items-center justify-between p-3 sm:p-4 max-w-lg mx-auto w-full overflow-y-auto">
        <div className="text-center my-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 uppercase">
            WORD GUESS
          </h2>
          <p className="text-xs text-white/50">Guess the secret 5-letter word in 6 tries</p>
        </div>

        {/* 6x5 Grid */}
        <div className={`grid grid-rows-6 gap-2 my-auto p-3 rounded-2xl bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-md ${invalidShake ? "animate-shake" : ""}`}>
          {Array.from({ length: 6 }).map((_, rowIdx) => {
            const guess = guesses[rowIdx];
            const isCurrentRow = rowIdx === guesses.length;
            const rowEvaluation = guess ? evaluateGuess(guess, targetWord) : null;

            return (
              <div key={rowIdx} className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((__, colIdx) => {
                  let letter = "";
                  let status: TileState = "empty";

                  if (guess) {
                    letter = guess[colIdx]!;
                    status = rowEvaluation![colIdx]!;
                  } else if (isCurrentRow) {
                    letter = currentGuess[colIdx] || "";
                    if (letter) status = "tbd";
                  }

                  let bgClass = "border-white/15 bg-white/[0.03] text-white";
                  if (status === "tbd") bgClass = "border-white/40 bg-white/[0.08] text-white scale-105";
                  if (status === "correct") bgClass = "border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/30";
                  if (status === "present") bgClass = "border-amber-500 bg-amber-600 text-white shadow-lg shadow-amber-600/30";
                  if (status === "absent") bgClass = "border-white/5 bg-white/10 text-white/40";

                  return (
                    <div
                      key={colIdx}
                      className={`h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 flex items-center justify-center rounded-xl border-2 font-black text-xl sm:text-2xl transition-all duration-300 ${bgClass}`}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Virtual Keyboard */}
        <div className="w-full max-w-lg px-1 sm:px-2 pb-2 mt-auto">
          {[
            ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
            ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
            ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"],
          ].map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5 my-1 w-full">
              {row.map((k) => {
                const status = letterStatuses[k];
                let btnStyle = "bg-white/10 text-white hover:bg-white/20";
                if (status === "correct") btnStyle = "bg-emerald-600 text-white shadow-sm shadow-emerald-500/50";
                else if (status === "present") btnStyle = "bg-amber-600 text-white shadow-sm shadow-amber-500/50";
                else if (status === "absent") btnStyle = "bg-white/5 text-white/30";

                const isWide = k === "ENTER" || k === "DEL";

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKey(k)}
                    className={`h-11 sm:h-12 flex items-center justify-center rounded-lg font-bold text-xs sm:text-sm active:scale-95 transition-transform ${btnStyle} ${
                      isWide ? "flex-[1.5] min-w-0 max-w-[4rem] text-[10px] sm:text-xs px-1 tracking-wider" : "flex-1 min-w-0 max-w-[2.5rem]"
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </main>

      {/* Result Modal */}
      {gameStatus !== "playing" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#121424] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
              {gameStatus === "won" ? (
                <Sparkles className="h-7 w-7 text-emerald-400 animate-bounce" />
              ) : (
                <RotateCcw className="h-7 w-7 text-red-400" />
              )}
            </div>

            <h3 className="text-2xl font-black text-white">
              {gameStatus === "won" ? "Splendid!" : "Nice Try!"}
            </h3>

            <p className="mt-1 text-sm text-white/60">
              {gameStatus === "won"
                ? `Guessed in ${guesses.length} ${guesses.length === 1 ? "try" : "tries"}!`
                : "The word was:"}
            </p>

            <div className="my-4 rounded-xl bg-white/5 border border-white/10 py-3 text-2xl font-black tracking-widest text-emerald-400 uppercase">
              {targetWord}
            </div>

            <div className="flex justify-around my-4 py-2 border-y border-white/5">
              <div>
                <p className="text-xs text-white/50">Current Streak</p>
                <p className="text-lg font-bold text-amber-400">{streak}</p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-xs text-white/50">Best Streak</p>
                <p className="text-lg font-bold text-yellow-400">{bestStreak}</p>
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
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold"
                onClick={restart}
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
