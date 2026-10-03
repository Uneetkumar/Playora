"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Sparkles, Volume2, VolumeX, Flame, Zap, Shield, Crown, Gem, Gamepad2, Swords, Star, Bot, User, Clock } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

export interface MemoryCard {
  id: number;
  symbol: string;
  iconName: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export type Card = MemoryCard;

export function checkMemoryCardsMatch(cardA: MemoryCard, cardB: MemoryCard): boolean {
  return cardA.symbol === cardB.symbol;
}

export function applyFastForwardMismatch(
  currentCards: Card[],
  mismatchPair: [number, number],
  clickedIndex: number
): { nextCards: Card[]; nextFlipped: number[]; canFlipClicked: boolean } {
  const [f, s] = mismatchPair;
  const baseCards = currentCards.map((c, i) =>
    i === f || i === s ? { ...c, isFlipped: false } : c
  );
  const target = baseCards[clickedIndex];
  if (!target || target.isMatched) {
    return { nextCards: baseCards, nextFlipped: [], canFlipClicked: false };
  }
  const nextCards = baseCards.map((c, i) =>
    i === clickedIndex ? { ...c, isFlipped: true } : c
  );
  return { nextCards, nextFlipped: [clickedIndex], canFlipClicked: true };
}

const SYMBOLS = [
  { symbol: "sword", iconName: "Swords" },
  { symbol: "shield", iconName: "Shield" },
  { symbol: "crown", iconName: "Crown" },
  { symbol: "gem", iconName: "Gem" },
  { symbol: "gamepad", iconName: "Gamepad2" },
  { symbol: "zap", iconName: "Zap" },
  { symbol: "flame", iconName: "Flame" },
  { symbol: "star", iconName: "Star" },
];

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

function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const item of SYMBOLS) {
    deck.push({ id: id++, symbol: item.symbol, iconName: item.iconName, isFlipped: false, isMatched: false });
    deck.push({ id: id++, symbol: item.symbol, iconName: item.iconName, isFlipped: false, isMatched: false });
  }
  return deck.sort(() => Math.random() - 0.5);
}

export function MemoryMatchView({
  mode = "vs-ai",
  onExit,
}: {
  mode?: "vs-ai" | "solo" | "pass-and-play";
  onExit?: () => void;
}) {
  const [currentMode, setCurrentMode] = React.useState<"vs-ai" | "solo" | "pass-and-play">(
    mode === "pass-and-play" ? "pass-and-play" : mode === "solo" ? "solo" : "vs-ai"
  );

  React.useEffect(() => {
    setCurrentMode(mode === "pass-and-play" ? "pass-and-play" : mode === "solo" ? "solo" : "vs-ai");
  }, [mode]);
  const [cards, setCards] = React.useState<Card[]>(() => createDeck());
  const [flippedIndices, setFlippedIndices] = React.useState<number[]>([]);
  const [turn, setTurn] = React.useState<"p1" | "p2">("p1");
  const [scores, setScores] = React.useState({ p1: 0, p2: 0 });
  const [moves, setMoves] = React.useState(0);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const [isAiThinking, setIsAiThinking] = React.useState(false);

  // Timer for solo mode
  const [secondsElapsed, setSecondsElapsed] = React.useState(0);
  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);

  // AI memory: index -> symbol
  const aiMemoryRef = React.useRef<Map<number, string>>(new Map());

  const allMatched = cards.every((c) => c.isMatched);

  // Timer ticker
  React.useEffect(() => {
    if (allMatched) return;
    const interval = setInterval(() => {
      setSecondsElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [allMatched]);

  // Audio synthesis
  const playSound = React.useCallback(
    (type: "flip" | "match" | "mismatch" | "win" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "flip") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === "match") {
          // Cheerful chime
          const freqs = [523.25, 659.25, 783.99];
          freqs.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "triangle";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
            noteGain.gain.setValueAtTime(0.18, now + idx * 0.08);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.08);
            noteOsc.stop(now + idx * 0.08 + 0.25);
          });
        } else if (type === "mismatch") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.linearRampToValueAtTime(140, now + 0.16);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
          osc.start(now);
          osc.stop(now + 0.16);
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

  const mismatchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMismatchRef = React.useRef<[number, number] | null>(null);

  const resolveMismatch = React.useCallback(() => {
    if (mismatchTimerRef.current) {
      clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = null;
    }
    if (pendingMismatchRef.current) {
      const [f, s] = pendingMismatchRef.current;
      pendingMismatchRef.current = null;
      setCards((prev) =>
        prev.map((c, i) => (i === f || i === s ? { ...c, isFlipped: false } : c))
      );
      setFlippedIndices([]);
      setIsLocked(false);
      if (currentMode !== "solo") {
        setTurn((t) => (t === "p1" ? "p2" : "p1"));
      }
    }
  }, [currentMode]);

  const handleCardClick = React.useCallback(
    (index: number) => {
      if (allMatched || isAiThinking) return;

      // If waiting on a mismatch flip, fast-forward flip down and accept click immediately
      if (pendingMismatchRef.current) {
        const pair = pendingMismatchRef.current;
        if (mismatchTimerRef.current) {
          clearTimeout(mismatchTimerRef.current);
          mismatchTimerRef.current = null;
        }
        pendingMismatchRef.current = null;
        setIsLocked(false);

        if (currentMode === "vs-ai") {
          // In vs-ai, human turn ended on mismatch; pass turn to AI bot
          setCards((prev) =>
            prev.map((c, i) => (i === pair[0] || i === pair[1] ? { ...c, isFlipped: false } : c))
          );
          setFlippedIndices([]);
          setTurn("p2");
          return;
        }

        const nextTurn = currentMode === "pass-and-play" ? (turn === "p1" ? "p2" : "p1") : turn;
        if (currentMode === "pass-and-play") {
          setTurn(nextTurn);
        }

        const { nextCards, nextFlipped, canFlipClicked } = applyFastForwardMismatch(
          cards,
          pair,
          index
        );

        if (!canFlipClicked) {
          setCards(nextCards);
          setFlippedIndices([]);
          return;
        }

        playSound("flip");
        aiMemoryRef.current.set(index, nextCards[index]!.symbol);
        setCards(nextCards);
        setFlippedIndices(nextFlipped);
        return;
      }

      if (isLocked) return;
      if (currentMode === "vs-ai" && turn === "p2") return;
      const card = cards[index];
      if (!card || card.isFlipped || card.isMatched) return;

      playSound("flip");

      // Record in AI memory
      aiMemoryRef.current.set(index, card.symbol);

      const newFlipped = [...flippedIndices, index];
      const newCards = cards.map((c, i) => (i === index ? { ...c, isFlipped: true } : c));
      setCards(newCards);

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        setIsLocked(true);
        const [firstIdx, secondIdx] = newFlipped as [number, number];
        const firstCard = newCards[firstIdx]!;
        const secondCard = newCards[secondIdx]!;

        if (checkMemoryCardsMatch(firstCard, secondCard)) {
          // MATCH!
          playSound("match");
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c, i) =>
                i === firstIdx || i === secondIdx ? { ...c, isMatched: true } : c
              )
            );
            if (turn === "p1") setScores((s) => ({ ...s, p1: s.p1 + 1 }));
            else setScores((s) => ({ ...s, p2: s.p2 + 1 }));

            setFlippedIndices([]);
            setIsLocked(false);
          }, 380);
        } else {
          // MISMATCH - schedule flip-down with fast-forward support
          pendingMismatchRef.current = [firstIdx, secondIdx];
          mismatchTimerRef.current = setTimeout(() => {
            playSound("mismatch");
            resolveMismatch();
          }, 600);
        }
      } else {
        setFlippedIndices(newFlipped);
      }
    },
    [cards, flippedIndices, isLocked, allMatched, isAiThinking, currentMode, turn, playSound, resolveMismatch]
  );

  // AI Turn automation for vs-ai mode
  React.useEffect(() => {
    if (currentMode !== "vs-ai" || turn !== "p2" || allMatched || isLocked) return;
    setIsAiThinking(true);

    const timer = setTimeout(() => {
      // Find unmatched cards
      const availableIndices = cards
        .map((c, i) => (!c.isMatched && !c.isFlipped ? i : -1))
        .filter((i) => i !== -1);

      if (availableIndices.length === 0) {
        setIsAiThinking(false);
        return;
      }

      // Check if AI knows a matching pair in memory!
      const memory = aiMemoryRef.current;
      let firstChoice = -1;
      let secondChoice = -1;

      for (const [idx1, sym1] of memory.entries()) {
        if (cards[idx1]?.isMatched) continue;
        for (const [idx2, sym2] of memory.entries()) {
          if (idx1 !== idx2 && sym1 === sym2 && !cards[idx2]?.isMatched) {
            firstChoice = idx1;
            secondChoice = idx2;
            break;
          }
        }
        if (firstChoice !== -1) break;
      }

      // If no known pair, pick random first card
      if (firstChoice === -1) {
        firstChoice = availableIndices[Math.floor(Math.random() * availableIndices.length)]!;
        // After picking, see if symbol matches anything in memory
        const sym = cards[firstChoice]!.symbol;
        for (const [idx, s] of memory.entries()) {
          if (idx !== firstChoice && s === sym && !cards[idx]?.isMatched) {
            secondChoice = idx;
            break;
          }
        }
      }

      if (secondChoice === -1) {
        const remaining = availableIndices.filter((i) => i !== firstChoice);
        secondChoice = remaining[Math.floor(Math.random() * remaining.length)]!;
      }

      // Step 1: Flip first card
      playSound("flip");
      aiMemoryRef.current.set(firstChoice, cards[firstChoice]!.symbol);
      setCards((prev) => prev.map((c, i) => (i === firstChoice ? { ...c, isFlipped: true } : c)));

      // Step 2: Flip second card
      setTimeout(() => {
        playSound("flip");
        setMoves((m) => m + 1);
        aiMemoryRef.current.set(secondChoice, cards[secondChoice]!.symbol);
        setCards((prev) =>
          prev.map((c, i) => (i === secondChoice ? { ...c, isFlipped: true } : c))
        );

        const card1 = cards[firstChoice]!;
        const card2 = cards[secondChoice]!;

        if (checkMemoryCardsMatch(card1, card2)) {
          // AI Match!
          setTimeout(() => {
            playSound("match");
            setCards((prev) =>
              prev.map((c, i) =>
                i === firstChoice || i === secondChoice ? { ...c, isMatched: true } : c
              )
            );
            setScores((s) => ({ ...s, p2: s.p2 + 1 }));
            setIsAiThinking(false);
          }, 380);
        } else {
          // AI Mismatch
          setTimeout(() => {
            playSound("mismatch");
            setCards((prev) =>
              prev.map((c, i) =>
                i === firstChoice || i === secondChoice ? { ...c, isFlipped: false } : c
              )
            );
            setTurn("p1");
            setIsAiThinking(false);
          }, 550);
        }
      }, 400);
    }, 400);

    return () => clearTimeout(timer);
  }, [currentMode, turn, allMatched, isLocked, cards, playSound]);

  // Game over check
  React.useEffect(() => {
    if (!allMatched || matchRecordedRef.current) return;
    matchRecordedRef.current = true;
    playSound("win");

    const duration = Math.max(10, Math.round((Date.now() - startTimeRef.current) / 1000));
    const isWin =
      currentMode === "solo"
        ? true
        : currentMode === "vs-ai"
        ? scores.p1 > scores.p2
        : scores.p1 >= scores.p2;

    saveLocalMatch({
      gameId: "memory-match",
      gameName: "Memory Match",
      mode: currentMode === "vs-ai" ? "vs-ai" : currentMode === "solo" ? "solo" : "pass-and-play",
      outcome: isWin ? "win" : "loss",
      durationSeconds: duration,
      playedAt: Date.now(),
      score: Math.max(10, 100 - moves * 3),
    });
  }, [allMatched, moves, currentMode, scores, playSound]);

  const resetGame = React.useCallback(() => {
    setCards(createDeck());
    setFlippedIndices([]);
    setScores({ p1: 0, p2: 0 });
    setMoves(0);
    setTurn("p1");
    setIsLocked(false);
    setIsAiThinking(false);
    aiMemoryRef.current.clear();
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    setSecondsElapsed(0);
    playSound("click");
  }, [playSound]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "r" || e.key === "R") {
        resetGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetGame]);

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "Swords": return <Swords className="h-7 w-7 sm:h-8 sm:w-8 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]" />;
      case "Shield": return <Shield className="h-7 w-7 sm:h-8 sm:w-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.7)]" />;
      case "Crown": return <Crown className="h-7 w-7 sm:h-8 sm:w-8 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />;
      case "Gem": return <Gem className="h-7 w-7 sm:h-8 sm:w-8 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.7)]" />;
      case "Gamepad2": return <Gamepad2 className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.7)]" />;
      case "Zap": return <Zap className="h-7 w-7 sm:h-8 sm:w-8 text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.7)]" />;
      case "Flame": return <Flame className="h-7 w-7 sm:h-8 sm:w-8 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.7)]" />;
      case "Star": return <Star className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]" />;
      default: return <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />;
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Memory Match"
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
            onClick={() => (allMatched ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Memory Match</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
              {currentMode === "vs-ai" ? "vs AI" : currentMode === "solo" ? "Solo" : "2P Local"}
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
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition font-medium ${
                currentMode === "vs-ai" ? "bg-primary text-white shadow" : "text-white/60 hover:text-white"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentMode("solo");
                resetGame();
              }}
              className={`px-2 py-1 rounded-md transition font-medium ${
                currentMode === "solo" ? "bg-primary text-white shadow" : "text-white/60 hover:text-white"
              }`}
            >
              Solo
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentMode("pass-and-play");
                resetGame();
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition font-medium ${
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
        {/* Scoreboard / Status Card */}
        <div className="mb-3 flex items-center justify-between w-full max-w-[min(90vw,74vh,540px)] bg-white/[0.04] px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
          {currentMode === "solo" ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{secondsElapsed}s</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                Pairs: {scores.p1}/8
              </span>
              <span className="text-xs font-bold text-white/80">Moves: {moves}</span>
            </div>
          ) : (
            <>
              <div
                className={`flex items-center gap-2 transition-all ${
                  turn === "p1" && !allMatched
                    ? "font-black text-cyan-400 scale-105"
                    : "opacity-60 text-white"
                }`}
              >
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                <span className="text-xs">Player 1: {scores.p1}</span>
              </div>
              <div className="text-[11px] text-white/40 font-bold uppercase">
                {isAiThinking ? (
                  <span className="text-pink-400 animate-pulse">Bot searching...</span>
                ) : (
                  `Moves: ${moves}`
                )}
              </div>
              <div
                className={`flex items-center gap-2 transition-all ${
                  turn === "p2" && !allMatched
                    ? "font-black text-pink-400 scale-105"
                    : "opacity-60 text-white"
                }`}
              >
                <span className="text-xs">
                  {currentMode === "vs-ai" ? "Bot" : "Player 2"}: {scores.p2}
                </span>
                <div className="h-2.5 w-2.5 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
              </div>
            </>
          )}
        </div>

        {/* 4x4 Card Grid */}
        <div className="relative aspect-square w-full max-w-[min(90vw,74vh,540px)] p-3 sm:p-4 rounded-3xl bg-[#121428]/90 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="grid grid-cols-4 grid-rows-4 h-full w-full gap-2 sm:gap-3">
            {cards.map((card, idx) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(idx)}
                disabled={card.isFlipped || card.isMatched || isLocked || isAiThinking || (currentMode === "vs-ai" && turn === "p2")}
                aria-label={`Card ${idx + 1}`}
                className={`relative flex items-center justify-center rounded-2xl border transition-all duration-300 transform cursor-pointer select-none ${
                  card.isMatched
                    ? "border-emerald-400/90 bg-emerald-500/20 shadow-[0_0_18px_rgba(16,185,129,0.4)] scale-95 opacity-85"
                    : card.isFlipped
                    ? "border-primary bg-[#1c1f3b] shadow-[0_0_15px_rgba(139,92,246,0.3)] scale-100"
                    : "border-white/10 bg-[#161830]/80 hover:bg-[#1f2244] hover:border-white/20 active:scale-95"
                }`}
              >
                {card.isFlipped || card.isMatched ? (
                  <div className="animate-in zoom-in-75 duration-200">
                    {renderIcon(card.iconName)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-30 group-hover:opacity-60 transition">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Win Banner */}
        {allMatched && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="flex items-center gap-2 text-emerald-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
              <Sparkles className="h-5 w-5" />
              {currentMode === "solo"
                ? `Cleared in ${secondsElapsed}s (${moves} moves)!`
                : scores.p1 > scores.p2
                ? "Player 1 Wins the Match!"
                : scores.p2 > scores.p1
                ? currentMode === "vs-ai" ? "Bot Wins the Match!" : "Player 2 Wins!"
                : "It's a Tie!"}
            </span>
            <Button onClick={resetGame} className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold px-6 py-2 rounded-xl shadow-lg">
              <RotateCcw className="h-4 w-4" />
              Play Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
