"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Volume2, VolumeX, Sparkles, Trophy, Pause, Play, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { readBestScore, commitBestScore } from "./scoring";
import { saveLocalMatch } from "../../hooks/use-local-history";

const GRID_SIZE = 20;
const CANVAS_SIZE = 400; // 400x400 Canvas
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE; // 20px per cell

type Point = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

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

export function getNextSnakeDirection(currentDir: Direction, newDir: Direction): Direction {
  if (newDir === "UP" && currentDir !== "DOWN") return "UP";
  if (newDir === "DOWN" && currentDir !== "UP") return "DOWN";
  if (newDir === "LEFT" && currentDir !== "RIGHT") return "LEFT";
  if (newDir === "RIGHT" && currentDir !== "LEFT") return "RIGHT";
  return currentDir;
}

export function checkSnakeSelfCollision(
  snake: Point[],
  newHead: Point,
  willEatFood: boolean
): boolean {
  const bodyToCheck = willEatFood ? snake : snake.slice(0, -1);
  return bodyToCheck.some((seg) => seg.x === newHead.x && seg.y === newHead.y);
}

export function RetroSnakeView({ onExit }: { onExit?: () => void }) {
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(() => readBestScore("retro-snake"));
  const [isPaused, setIsPaused] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [goldenActive, setGoldenActive] = React.useState(false);
  const [goldenTimer, setGoldenTimer] = React.useState(0);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);

  // Core game state in refs for smooth animation and zero re-renders
  const snakeRef = React.useRef<Point[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);
  const dirRef = React.useRef<Direction>("UP");
  const foodRef = React.useRef<Point>({ x: 5, y: 5 });
  const goldenFoodRef = React.useRef<Point | null>(null);
  const scoreRef = React.useRef(0);

  // Audio synthesizer
  const playSound = React.useCallback(
    (type: "eat" | "gold" | "die") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === "eat") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(750, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === "gold") {
          [523, 659, 784, 1046].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(f, now + i * 0.06);
            gain.gain.setValueAtTime(0.12, now + i * 0.06);
            gain.gain.linearRampToValueAtTime(0.001, now + i * 0.06 + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.2);
          });
        } else if (type === "die") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(50, now + 0.35);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        }
      } catch {
        // audio fail
      }
    },
    [soundEnabled]
  );

  const spawnRandomPoint = React.useCallback((currentSnake: Point[]): Point => {
    let pt: Point;
    let collision = true;
    while (collision) {
      pt = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      collision = currentSnake.some((seg) => seg.x === pt.x && seg.y === pt.y);
    }
    return pt!;
  }, []);

  const inputQueueRef = React.useRef<Direction[]>([]);

  const changeDirection = React.useCallback((newDir: Direction) => {
    const queue = inputQueueRef.current;
    if (queue.length >= 2) return;
    const baseDir = queue.length > 0 ? queue[queue.length - 1]! : dirRef.current;
    const next = getNextSnakeDirection(baseDir, newDir);
    if (next !== baseDir) {
      queue.push(next);
    }
  }, []);

  const restartRef = React.useRef<() => void>(() => {});

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        changeDirection("UP");
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        changeDirection("DOWN");
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        changeDirection("LEFT");
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        changeDirection("RIGHT");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        restartRef.current();
      } else if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
        e.preventDefault();
        if (!gameStarted || gameOver) {
          restartRef.current();
        } else {
          setIsPaused((p) => !p);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeDirection, gameStarted, gameOver]);

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

    const threshold = 25;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > threshold) {
        changeDirection(dx > 0 ? "RIGHT" : "LEFT");
      }
    } else {
      if (Math.abs(dy) > threshold) {
        changeDirection(dy > 0 ? "DOWN" : "UP");
      }
    }
  };

  // Draw Game onto Canvas
  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0c101c";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= CANVAS_SIZE; i += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_SIZE, i);
      ctx.stroke();
    }

    // Food (Neon Strawberry / Pellet)
    const food = foodRef.current;
    ctx.fillStyle = "#f43f5e";
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2.4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Golden Food
    const gold = goldenFoodRef.current;
    if (gold) {
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(
        gold.x * CELL_SIZE + CELL_SIZE / 2,
        gold.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2.2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Snake Body & Head
    const snake = snakeRef.current;
    snake.forEach((seg, idx) => {
      const isHead = idx === 0;
      if (isHead) {
        ctx.fillStyle = "#34d399";
        ctx.shadowColor = "#10b981";
        ctx.shadowBlur = 14;
      } else {
        const alpha = Math.max(0.45, 1 - idx / (snake.length + 8));
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(
        seg.x * CELL_SIZE + 1.5,
        seg.y * CELL_SIZE + 1.5,
        CELL_SIZE - 3,
        CELL_SIZE - 3,
        isHead ? 6 : 4
      );
      ctx.fill();

      // Draw eyes on head
      if (isHead) {
        ctx.fillStyle = "#0c101c";
        ctx.shadowBlur = 0;
        const curDir = dirRef.current;
        let eye1: [number, number];
        let eye2: [number, number];

        if (curDir === "UP") {
          eye1 = [seg.x * CELL_SIZE + 5, seg.y * CELL_SIZE + 5];
          eye2 = [seg.x * CELL_SIZE + CELL_SIZE - 5, seg.y * CELL_SIZE + 5];
        } else if (curDir === "DOWN") {
          eye1 = [seg.x * CELL_SIZE + 5, seg.y * CELL_SIZE + CELL_SIZE - 5];
          eye2 = [seg.x * CELL_SIZE + CELL_SIZE - 5, seg.y * CELL_SIZE + CELL_SIZE - 5];
        } else if (curDir === "LEFT") {
          eye1 = [seg.x * CELL_SIZE + 5, seg.y * CELL_SIZE + 5];
          eye2 = [seg.x * CELL_SIZE + 5, seg.y * CELL_SIZE + CELL_SIZE - 5];
        } else {
          eye1 = [seg.x * CELL_SIZE + CELL_SIZE - 5, seg.y * CELL_SIZE + 5];
          eye2 = [seg.x * CELL_SIZE + CELL_SIZE - 5, seg.y * CELL_SIZE + CELL_SIZE - 5];
        }

        ctx.beginPath();
        ctx.arc(eye1[0], eye1[1], 2, 0, Math.PI * 2);
        ctx.arc(eye2[0], eye2[1], 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.shadowBlur = 0;
  }, []);

  // Main game tick loop
  React.useEffect(() => {
    if (!gameStarted || isPaused || gameOver) return;

    const tickInterval = Math.max(65, 135 - Math.floor(score / 5) * 4);

    const timer = setInterval(() => {
      const curSnake = snakeRef.current;
      const nextFromQueue = inputQueueRef.current.shift();
      if (nextFromQueue) {
        dirRef.current = nextFromQueue;
      }
      const curDir = dirRef.current;

      const head = curSnake[0]!;
      let newHead: Point;

      if (curDir === "UP") newHead = { x: head.x, y: head.y - 1 };
      else if (curDir === "DOWN") newHead = { x: head.x, y: head.y + 1 };
      else if (curDir === "LEFT") newHead = { x: head.x - 1, y: head.y };
      else newHead = { x: head.x + 1, y: head.y };

      // Wall collision
      if (
        newHead.x < 0 ||
        newHead.x >= GRID_SIZE ||
        newHead.y < 0 ||
        newHead.y >= GRID_SIZE
      ) {
        playSound("die");
        setGameOver(true);
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          saveLocalMatch({
            gameId: "retro-snake",
            gameName: "Retro Snake",
            mode: "solo",
            outcome: "loss",
            durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
            score: scoreRef.current,
          });
        }
        return;
      }

      // Check food
      const curFood = foodRef.current;
      const curGold = goldenFoodRef.current;
      const willEatFood =
        (newHead.x === curFood.x && newHead.y === curFood.y) ||
        Boolean(curGold && newHead.x === curGold.x && newHead.y === curGold.y);

      // Self collision (if not eating, tail vacates tile so following tail is legal)
      if (checkSnakeSelfCollision(curSnake, newHead, willEatFood)) {
        playSound("die");
        setGameOver(true);
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          saveLocalMatch({
            gameId: "retro-snake",
            gameName: "Retro Snake",
            mode: "solo",
            outcome: "loss",
            durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
            score: scoreRef.current,
          });
        }
        return;
      }

      let ateFood = false;
      let pointsEarned = 0;

      if (newHead.x === curFood.x && newHead.y === curFood.y) {
        playSound("eat");
        ateFood = true;
        pointsEarned += 10;
        foodRef.current = spawnRandomPoint([...curSnake, newHead]);

        if (Math.random() < 0.28 && !curGold) {
          goldenFoodRef.current = spawnRandomPoint([...curSnake, newHead]);
          setGoldenActive(true);
          setGoldenTimer(10);
        }
      } else if (curGold && newHead.x === curGold.x && newHead.y === curGold.y) {
        playSound("gold");
        ateFood = true;
        pointsEarned += 50;
        goldenFoodRef.current = null;
        setGoldenActive(false);
        setGoldenTimer(0);
      }

      if (ateFood) {
        const nextScore = scoreRef.current + pointsEarned;
        scoreRef.current = nextScore;
        setScore(nextScore);
        if (nextScore > bestScore) {
          setBestScore(nextScore);
          commitBestScore("retro-snake", nextScore);
        }
        snakeRef.current = [newHead, ...curSnake];
      } else {
        snakeRef.current = [newHead, ...curSnake.slice(0, -1)];
      }

      draw();
    }, tickInterval);

    return () => clearInterval(timer);
  }, [gameStarted, isPaused, gameOver, score, bestScore, playSound, spawnRandomPoint, draw]);

  // Initial and reactive draw
  React.useEffect(() => {
    draw();
  }, [draw, gameStarted, isPaused]);

  // Golden timer ticker
  React.useEffect(() => {
    if (!goldenActive || isPaused || gameOver) return;
    const interval = setInterval(() => {
      setGoldenTimer((t) => {
        if (t <= 1) {
          goldenFoodRef.current = null;
          setGoldenActive(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [goldenActive, isPaused, gameOver]);

  const restart = () => {
    const initSnake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ];
    snakeRef.current = initSnake;
    dirRef.current = "UP";
    inputQueueRef.current = [];
    foodRef.current = spawnRandomPoint(initSnake);
    goldenFoodRef.current = null;
    scoreRef.current = 0;
    setScore(0);
    setGoldenActive(false);
    setGoldenTimer(0);
    setIsPaused(false);
    setGameOver(false);
    setGameStarted(true);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    draw();
  };
  restartRef.current = restart;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Retro Snake"
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

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Score: {score}</span>
          </Badge>
          <Badge variant="secondary" className="hidden sm:inline-flex gap-1 bg-white/5 text-white/70 border-white/10 text-xs px-2.5 py-1">
            <Trophy className="h-3.5 w-3.5 text-yellow-400" />
            <span>Best: {bestScore}</span>
          </Badge>
          {gameStarted && !gameOver && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white/70 hover:text-white"
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play className="h-4 w-4 text-emerald-400" /> : <Pause className="h-4 w-4" />}
            </Button>
          )}
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
            <span className="hidden sm:inline">Restart</span>
          </Button>
        </div>
      </header>

      {/* Main Game Stage */}
      <main className="relative flex flex-1 flex-col items-center justify-between p-2 sm:p-4 max-w-[min(90vw,68vh,480px)] mx-auto w-full overflow-y-auto">
        <div className="text-center my-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-lime-400 uppercase">
            RETRO SNAKE
          </h2>
          <p className="text-xs text-white/50 font-medium">
            {isPaused ? "Paused" : goldenActive ? `⚡ Golden Fruit active: ${goldenTimer}s (+50 pts)` : "Swipe on screen or use Arrow keys"}
          </p>
        </div>

        {/* 60 FPS HTML5 Canvas */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative aspect-square w-full max-w-[min(90vw,68vh,480px)] rounded-3xl border-2 border-emerald-500/40 bg-[#0c101c] shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden p-1 touch-none"
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="w-full h-full block rounded-2xl"
          />

          {/* Pause overlay */}
          {isPaused && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xs">
              <span className="text-2xl font-black text-white tracking-widest uppercase">PAUSED</span>
              <Button
                size="sm"
                className="mt-3 bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                onClick={() => setIsPaused(false)}
              >
                Resume
              </Button>
            </div>
          )}

          {/* Not started overlay */}
          {!gameStarted && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs p-4 text-center">
              <span className="text-2xl font-black text-emerald-400 tracking-wider mb-2">READY TO SLITHER?</span>
              <p className="text-xs text-white/60 mb-4 max-w-[200px]">Collect neon pellets, avoid walls and your own tail.</p>
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-5 rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95"
                onClick={restart}
              >
                PLAY NOW
              </Button>
            </div>
          )}
        </div>

        {/* Virtual On-screen D-Pad for Mobile */}
        <div className="flex flex-col items-center justify-center my-auto pb-1 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            className="h-11 w-11 rounded-xl bg-white/5 border-white/15 active:bg-emerald-500/20"
            onClick={() => changeDirection("UP")}
          >
            <ChevronUp className="h-5 w-5 text-white" />
          </Button>
          <div className="flex gap-4 my-1">
            <Button
              variant="outline"
              size="sm"
              className="h-11 w-11 rounded-xl bg-white/5 border-white/15 active:bg-emerald-500/20"
              onClick={() => changeDirection("LEFT")}
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </Button>
            <div className="h-11 w-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <span className="text-[10px] text-emerald-400 font-bold">{snakeRef.current.length}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-11 w-11 rounded-xl bg-white/5 border-white/15 active:bg-emerald-500/20"
              onClick={() => changeDirection("RIGHT")}
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-11 w-11 rounded-xl bg-white/5 border-white/15 active:bg-emerald-500/20"
            onClick={() => changeDirection("DOWN")}
          >
            <ChevronDown className="h-5 w-5 text-white" />
          </Button>
        </div>
      </main>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#121424] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
              <RotateCcw className="h-7 w-7 text-rose-400" />
            </div>

            <h3 className="text-2xl font-black text-white">Collision!</h3>
            <p className="mt-1 text-sm text-white/60">
              Your snake grew to <span className="font-bold text-white">{snakeRef.current.length}</span> segments.
            </p>

            <div className="flex justify-around my-4 py-2 border-y border-white/5">
              <div>
                <p className="text-xs text-white/50">Score</p>
                <p className="text-xl font-bold text-emerald-400">{score}</p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-xs text-white/50">Best Score</p>
                <p className="text-xl font-bold text-yellow-400">{bestScore}</p>
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
