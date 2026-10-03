"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Bot, User, Sparkles, Volume2, VolumeX } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

export const COURT_WIDTH = 640;
export const COURT_HEIGHT = 400;
export const PADDLE_HEIGHT = 80;
export const PADDLE_WIDTH = 12;
export const BALL_SIZE = 10;
export const WINNING_SCORE = 7;

export function calculatePongPaddleBounce(
  ballY: number,
  paddleY: number,
  paddleHeight: number,
  currentVx: number
): { vx: number; vy: number } {
  const relativeHit = (ballY + BALL_SIZE / 2 - (paddleY + paddleHeight / 2)) / (paddleHeight / 2);
  const clampedHit = Math.max(-1, Math.min(1, relativeHit));
  const newSpeed = Math.min(13, Math.abs(currentVx) * 1.06);
  const vx = currentVx < 0 ? newSpeed : -newSpeed;
  const vy = clampedHit * 7.5;
  return { vx, vy };
}

type Difficulty = "easy" | "medium" | "hard";

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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export function PongView({
  mode = "vs-ai",
  aiLevel = 3,
  onExit,
}: {
  mode?: "vs-ai" | "pass-and-play";
  aiLevel?: number;
  onExit?: () => void;
}) {
  const [currentMode, setCurrentMode] = React.useState<"vs-ai" | "pass-and-play">(mode);
  const [difficulty, setDifficulty] = React.useState<Difficulty>(
    aiLevel <= 2 ? "easy" : aiLevel <= 4 ? "medium" : "hard"
  );

  React.useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const [scores, setScores] = React.useState({ p1: 0, p2: 0 });
  const [winner, setWinner] = React.useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);

  // Game state in refs for 60fps loop
  const p1YRef = React.useRef(COURT_HEIGHT / 2 - PADDLE_HEIGHT / 2);
  const p2YRef = React.useRef(COURT_HEIGHT / 2 - PADDLE_HEIGHT / 2);
  const ballRef = React.useRef({
    x: COURT_WIDTH / 2,
    y: COURT_HEIGHT / 2,
    vx: 5.5,
    vy: 2.5,
    trail: [] as Array<[number, number]>,
  });

  const particlesRef = React.useRef<Particle[]>([]);
  const keysRef = React.useRef<Record<string, boolean>>({});
  const serveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (serveTimerRef.current) {
        clearTimeout(serveTimerRef.current);
        serveTimerRef.current = null;
      }
    };
  }, []);

  // Audio synth
  const playSound = React.useCallback(
    (type: "paddle" | "wall" | "score" | "win" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "paddle") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(840, now + 0.06);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.06);
          osc.start(now);
          osc.stop(now + 0.06);
        } else if (type === "wall") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(260, now);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === "score") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.linearRampToValueAtTime(70, now + 0.25);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
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

  const resetGame = React.useCallback(() => {
    if (serveTimerRef.current) {
      clearTimeout(serveTimerRef.current);
      serveTimerRef.current = null;
    }
    setScores({ p1: 0, p2: 0 });
    setWinner(null);
    p1YRef.current = COURT_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    p2YRef.current = COURT_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    ballRef.current = { x: COURT_WIDTH / 2, y: COURT_HEIGHT / 2, vx: 0, vy: 0, trail: [] };
    particlesRef.current = [];
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    playSound("click");
    serveTimerRef.current = setTimeout(() => {
      ballRef.current.vx = 5.5;
      ballRef.current.vy = 2.5;
    }, 450);
  }, [playSound]);

  // Key listeners
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "r" || e.key === "R" || (e.key === " " && winner)) {
        resetGame();
        return;
      }
      keysRef.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [winner, resetGame]);

  // Spawn spark particles on impact
  const spawnParticles = (x: number, y: number, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color,
        life: 1.0,
      });
    }
  };

  // Main 60 FPS animation loop
  React.useEffect(() => {
    let animId: number;

    const resetBall = (direction: 1 | -1) => {
      if (serveTimerRef.current) {
        clearTimeout(serveTimerRef.current);
        serveTimerRef.current = null;
      }
      ballRef.current = {
        x: COURT_WIDTH / 2,
        y: COURT_HEIGHT / 2,
        vx: 0,
        vy: 0,
        trail: [],
      };
      serveTimerRef.current = setTimeout(() => {
        if (!winner) {
          ballRef.current.vx = direction * 5.5;
          ballRef.current.vy = (Math.random() - 0.5) * 5;
        }
      }, 450);
    };

    const loop = () => {
      if (winner) return;

      // Move P1 (W/S or ArrowUp/ArrowDown if solo)
      const p1Speed = 6.5;
      if (keysRef.current["w"] || keysRef.current["W"] || (currentMode === "vs-ai" && keysRef.current["ArrowUp"])) {
        p1YRef.current = Math.max(0, p1YRef.current - p1Speed);
      }
      if (keysRef.current["s"] || keysRef.current["S"] || (currentMode === "vs-ai" && keysRef.current["ArrowDown"])) {
        p1YRef.current = Math.min(COURT_HEIGHT - PADDLE_HEIGHT, p1YRef.current + p1Speed);
      }

      // Move P2 (AI or Arrow keys)
      if (currentMode === "vs-ai") {
        const targetY = ballRef.current.y - PADDLE_HEIGHT / 2;
        const aiSpeed = difficulty === "easy" ? 4.0 : difficulty === "medium" ? 5.2 : 6.2;
        const diff = targetY - p2YRef.current;
        if (Math.abs(diff) > 4) {
          p2YRef.current += Math.sign(diff) * Math.min(aiSpeed, Math.abs(diff));
          p2YRef.current = Math.max(0, Math.min(COURT_HEIGHT - PADDLE_HEIGHT, p2YRef.current));
        }
      } else {
        const p2Speed = 6.5;
        if (keysRef.current["ArrowUp"]) {
          p2YRef.current = Math.max(0, p2YRef.current - p2Speed);
        }
        if (keysRef.current["ArrowDown"]) {
          p2YRef.current = Math.min(COURT_HEIGHT - PADDLE_HEIGHT, p2YRef.current + p2Speed);
        }
      }

      // Record trail
      ballRef.current.trail.push([ballRef.current.x, ballRef.current.y]);
      if (ballRef.current.trail.length > 6) {
        ballRef.current.trail.shift();
      }

      // Move Ball
      ballRef.current.x += ballRef.current.vx;
      ballRef.current.y += ballRef.current.vy;

      // Top/Bottom wall collision
      if (ballRef.current.y <= 0) {
        ballRef.current.y = 0;
        ballRef.current.vy *= -1;
        spawnParticles(ballRef.current.x, 0, "#06b6d4", 5);
        playSound("wall");
      } else if (ballRef.current.y >= COURT_HEIGHT - BALL_SIZE) {
        ballRef.current.y = COURT_HEIGHT - BALL_SIZE;
        ballRef.current.vy *= -1;
        spawnParticles(ballRef.current.x, COURT_HEIGHT, "#06b6d4", 5);
        playSound("wall");
      }

      // P1 Paddle Collision (Left)
      const p1Left = 28;
      const p1Right = p1Left + PADDLE_WIDTH;
      if (
        ballRef.current.x <= p1Right &&
        ballRef.current.x >= p1Left - 8 &&
        ballRef.current.y + BALL_SIZE >= p1YRef.current &&
        ballRef.current.y <= p1YRef.current + PADDLE_HEIGHT
      ) {
        ballRef.current.x = p1Right;
        const bounce = calculatePongPaddleBounce(
          ballRef.current.y,
          p1YRef.current,
          PADDLE_HEIGHT,
          ballRef.current.vx
        );
        ballRef.current.vx = bounce.vx;
        ballRef.current.vy = bounce.vy;
        spawnParticles(p1Right, ballRef.current.y, "#38bdf8", 10);
        playSound("paddle");
      }

      // P2 Paddle Collision (Right)
      const p2Left = COURT_WIDTH - 28 - PADDLE_WIDTH;
      const p2Right = COURT_WIDTH - 28;
      if (
        ballRef.current.x + BALL_SIZE >= p2Left &&
        ballRef.current.x + BALL_SIZE <= p2Right + 8 &&
        ballRef.current.y + BALL_SIZE >= p2YRef.current &&
        ballRef.current.y <= p2YRef.current + PADDLE_HEIGHT
      ) {
        ballRef.current.x = p2Left - BALL_SIZE;
        const bounce = calculatePongPaddleBounce(
          ballRef.current.y,
          p2YRef.current,
          PADDLE_HEIGHT,
          ballRef.current.vx
        );
        ballRef.current.vx = bounce.vx;
        ballRef.current.vy = bounce.vy;
        spawnParticles(p2Left, ballRef.current.y, "#f43f5e", 10);
        playSound("paddle");
      }

      // Scoring
      if (ballRef.current.x < -10) {
        playSound("score");
        setScores((s) => {
          const nextP2 = s.p2 + 1;
          if (nextP2 >= WINNING_SCORE) {
            setWinner(currentMode === "vs-ai" ? "Cyber Bot" : "Player 2");
            playSound("win");
            if (!matchRecordedRef.current) {
              matchRecordedRef.current = true;
              const duration = Math.max(15, Math.round((Date.now() - startTimeRef.current) / 1000));
              saveLocalMatch({
                gameId: "pong",
                gameName: "Cyber Pong",
                mode: currentMode,
                outcome: "loss",
                durationSeconds: duration,
                playedAt: Date.now(),
                score: 0,
              });
            }
          }
          return { ...s, p2: nextP2 };
        });
        resetBall(1);
      } else if (ballRef.current.x > COURT_WIDTH + 10) {
        playSound("score");
        setScores((s) => {
          const nextP1 = s.p1 + 1;
          if (nextP1 >= WINNING_SCORE) {
            setWinner("Player 1");
            playSound("win");
            if (!matchRecordedRef.current) {
              matchRecordedRef.current = true;
              const duration = Math.max(15, Math.round((Date.now() - startTimeRef.current) / 1000));
              saveLocalMatch({
                gameId: "pong",
                gameName: "Cyber Pong",
                mode: currentMode,
                outcome: "win",
                durationSeconds: duration,
                playedAt: Date.now(),
                score: 100,
              });
            }
          }
          return { ...s, p1: nextP1 };
        });
        resetBall(-1);
      }

      // Render to Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Dark cyber background
          ctx.fillStyle = "#060814";
          ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

          // Grid horizon lines
          ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
          ctx.lineWidth = 1;
          for (let y = 0; y < COURT_HEIGHT; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(COURT_WIDTH, y);
            ctx.stroke();
          }

          // Center court line
          ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 10]);
          ctx.beginPath();
          ctx.moveTo(COURT_WIDTH / 2, 0);
          ctx.lineTo(COURT_WIDTH / 2, COURT_HEIGHT);
          ctx.stroke();
          ctx.setLineDash([]);

          // Ball Motion Trail
          ballRef.current.trail.forEach(([tx, ty], i) => {
            const alpha = ((i + 1) / ballRef.current.trail.length) * 0.4;
            ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.fillRect(tx, ty, BALL_SIZE, BALL_SIZE);
          });

          // P1 Paddle (Cyan Neon)
          ctx.fillStyle = "#38bdf8";
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.roundRect(p1Left, p1YRef.current, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
          ctx.fill();

          // P2 Paddle (Rose Neon)
          ctx.fillStyle = "#f43f5e";
          ctx.shadowColor = "#f43f5e";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.roundRect(p2Left, p2YRef.current, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
          ctx.fill();

          // Glowing Ball
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 14;
          ctx.fillRect(ballRef.current.x, ballRef.current.y, BALL_SIZE, BALL_SIZE);
          ctx.shadowBlur = 0;

          // Draw particles
          particlesRef.current.forEach((p) => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
          });
          ctx.globalAlpha = 1.0;
          particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [winner, currentMode, difficulty, playSound]);

  // Touch and mouse control for canvas
  const updatePaddleFromCoords = React.useCallback(
    (clientXRaw: number, clientYRaw: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleY = COURT_HEIGHT / rect.height;
      const clientY = (clientYRaw - rect.top) * scaleY;
      const paddleY = Math.max(0, Math.min(COURT_HEIGHT - PADDLE_HEIGHT, clientY - PADDLE_HEIGHT / 2));

      const scaleX = COURT_WIDTH / rect.width;
      const clientX = (clientXRaw - rect.left) * scaleX;

      if (currentMode === "vs-ai") {
        p1YRef.current = paddleY;
      } else if (clientX < COURT_WIDTH / 2) {
        p1YRef.current = paddleY;
      } else {
        p2YRef.current = paddleY;
      }
    },
    [currentMode]
  );

  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    updatePaddleFromCoords(touch.clientX, touch.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    updatePaddleFromCoords(e.clientX, e.clientY);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Cyber Pong"
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
            onClick={() => (winner ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Cyber Pong</h1>
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
              aria-label="Bot Difficulty"
            >
              <option value="easy" className="bg-[#121422] text-white">Easy</option>
              <option value="medium" className="bg-[#121422] text-white">Medium</option>
              <option value="hard" className="bg-[#121422] text-white">Master</option>
            </select>
          )}

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
        {/* Score HUD */}
        <div className="mb-3 flex items-center justify-between w-full max-w-[min(94vw,72vh,800px)] bg-white/[0.04] px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span className="text-xs sm:text-sm font-black text-cyan-400">P1 (W/S)</span>
            <span className="text-2xl font-black text-white ml-2 tabular-nums">{scores.p1}</span>
          </div>

          <div className="text-[11px] text-white/50 font-bold uppercase tracking-widest">
            First to {WINNING_SCORE}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-black text-white mr-2 tabular-nums">{scores.p2}</span>
            <span className="text-xs sm:text-sm font-black text-rose-400">
              {currentMode === "vs-ai" ? "Bot" : "P2 (↑/↓)"}
            </span>
            <div className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          </div>
        </div>

        {/* 60 FPS HTML5 Canvas Court */}
        <div className="relative aspect-[16/10] w-full max-w-[min(94vw,72vh,800px)] rounded-3xl overflow-hidden border-4 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <canvas
            ref={canvasRef}
            width={COURT_WIDTH}
            height={COURT_HEIGHT}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
            onMouseMove={handleMouseMove}
            onPointerMove={(e) => updatePaddleFromCoords(e.clientX, e.clientY)}
            className="w-full h-full block bg-[#060814] cursor-crosshair touch-none"
          />
        </div>

        {/* Mobile Control Buttons */}
        <div className="mt-3 flex sm:hidden items-center justify-between w-full max-w-[340px] gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onPointerDown={() => { keysRef.current["w"] = true; }}
              onPointerUp={() => { keysRef.current["w"] = false; }}
              onPointerLeave={() => { keysRef.current["w"] = false; }}
              onPointerCancel={() => { keysRef.current["w"] = false; }}
              className="h-11 w-12 text-xs font-bold border-cyan-500/40 text-cyan-400 active:bg-cyan-500/20"
            >
              ▲
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPointerDown={() => { keysRef.current["s"] = true; }}
              onPointerUp={() => { keysRef.current["s"] = false; }}
              onPointerLeave={() => { keysRef.current["s"] = false; }}
              onPointerCancel={() => { keysRef.current["s"] = false; }}
              className="h-11 w-12 text-xs font-bold border-cyan-500/40 text-cyan-400 active:bg-cyan-500/20"
            >
              ▼
            </Button>
          </div>
          {currentMode === "pass-and-play" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onPointerDown={() => { keysRef.current["ArrowUp"] = true; }}
                onPointerUp={() => { keysRef.current["ArrowUp"] = false; }}
                onPointerLeave={() => { keysRef.current["ArrowUp"] = false; }}
                onPointerCancel={() => { keysRef.current["ArrowUp"] = false; }}
                className="h-11 w-12 text-xs font-bold border-rose-500/40 text-rose-400 active:bg-rose-500/20"
              >
                ▲
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPointerDown={() => { keysRef.current["ArrowDown"] = true; }}
                onPointerUp={() => { keysRef.current["ArrowDown"] = false; }}
                onPointerLeave={() => { keysRef.current["ArrowDown"] = false; }}
                onPointerCancel={() => { keysRef.current["ArrowDown"] = false; }}
                className="h-11 w-12 text-xs font-bold border-rose-500/40 text-rose-400 active:bg-rose-500/20"
              >
                ▼
              </Button>
            </div>
          )}
        </div>

        {/* Win Banner */}
        {winner && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="flex items-center gap-2 text-emerald-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
              <Sparkles className="h-5 w-5" />
              {winner} Conquers the Court!
            </span>
            <Button onClick={resetGame} className="gap-2 bg-gradient-to-r from-cyan-500 to-rose-500 text-white font-bold px-6 py-2 rounded-xl shadow-lg">
              <RotateCcw className="h-4 w-4" />
              Rally Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
