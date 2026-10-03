"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Volume2, VolumeX, Sparkles, Trophy, Play, Medal } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { readBestScore, commitBestScore } from "./scoring";
import { saveLocalMatch } from "../../hooks/use-local-history";

const CANVAS_WIDTH = 380;
const CANVAS_HEIGHT = 540;
const GRAVITY = 0.36;
const FLAP_STRENGTH = -6.6;
const PIPE_SPEED = 2.4;
const PIPE_SPAWN_INTERVAL = 110; // frames
const PIPE_GAP = 125;
const PIPE_WIDTH = 54;
const BIRD_RADIUS = 13; // forgiving 13px hitbox for fair squeeze

interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
}

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

export function checkFlappyPipeCollision(
  bird: { x: number; y: number },
  radius: number,
  pipe: { x: number; topHeight: number; bottomY: number; width?: number }
): boolean {
  const width = pipe.width ?? 54;
  if (bird.x + radius > pipe.x && bird.x - radius < pipe.x + width) {
    if (bird.y - radius < pipe.topHeight || bird.y + radius > pipe.bottomY) {
      return true;
    }
  }
  return false;
}

export function FlappyBirdView({ onExit }: { onExit?: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(() => readBestScore("flappy-bird"));
  const [gameState, setGameState] = React.useState<"idle" | "playing" | "gameover">("idle");
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  // Mutable game physics state
  const birdRef = React.useRef({
    x: 85,
    y: CANVAS_HEIGHT / 2,
    velocity: 0,
    angle: 0,
  });
  const pipesRef = React.useRef<Pipe[]>([]);
  const particlesRef = React.useRef<Particle[]>([]);
  const frameCountRef = React.useRef(0);
  const scoreRef = React.useRef(0);
  scoreRef.current = score;
  const gameStateRef = React.useRef(gameState);
  gameStateRef.current = gameState;
  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);

  // Audio synthesizer
  const playSound = React.useCallback(
    (type: "flap" | "score" | "hit" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === "flap") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(360, now);
          osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === "score") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(780, now);
          osc.frequency.setValueAtTime(1040, now + 0.08);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.2);
        } else if (type === "hit") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.linearRampToValueAtTime(40, now + 0.25);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.25);
        } else if (type === "click") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
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
    birdRef.current = {
      x: 85,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      angle: 0,
    };
    pipesRef.current = [];
    particlesRef.current = [];
    frameCountRef.current = 0;
    setScore(0);
    setGameState("idle");
    matchRecordedRef.current = false;
  }, []);

  const flap = React.useCallback(() => {
    if (gameStateRef.current === "gameover") {
      resetGame();
      return;
    }
    if (gameStateRef.current === "idle") {
      setGameState("playing");
      birdRef.current.velocity = FLAP_STRENGTH;
      matchRecordedRef.current = false;
      startTimeRef.current = Date.now();
      playSound("flap");
      return;
    }
    if (gameStateRef.current === "playing") {
      birdRef.current.velocity = FLAP_STRENGTH;
      // Spawn puff particle
      particlesRef.current.push({
        x: birdRef.current.x - 8,
        y: birdRef.current.y + 4,
        vx: -1.5,
        vy: 1,
        alpha: 0.8,
      });
      playSound("flap");
    }
  }, [playSound, resetGame]);

  // Keyboard and click handling
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetGame();
      } else if (e.key === "Enter") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flap, resetGame]);

  // Main 60 FPS Render & Physics loop
  React.useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const state = gameStateRef.current;
      frameCountRef.current++;

      // Gentle floating bob in idle state
      if (state === "idle") {
        birdRef.current.y = CANVAS_HEIGHT / 2 + Math.sin(frameCountRef.current * 0.08) * 8;
        birdRef.current.angle = 0;
      }

      // Physics update if playing
      if (state === "playing") {
        const bird = birdRef.current;
        bird.velocity += GRAVITY;
        bird.y += bird.velocity;
        // Tilting physics
        if (bird.velocity < 0) {
          bird.angle = -0.35;
        } else {
          bird.angle = Math.min(1.2, (bird.velocity - 2) * 0.12);
        }

        // Ground / Ceiling collision
        if (bird.y + BIRD_RADIUS >= CANVAS_HEIGHT - 30) {
          bird.y = CANVAS_HEIGHT - 30 - BIRD_RADIUS;
          playSound("hit");
          setGameState("gameover");
          if (!matchRecordedRef.current) {
            matchRecordedRef.current = true;
            saveLocalMatch({
              gameId: "flappy-bird",
              gameName: "Flappy Bird",
              mode: "solo",
              outcome: "loss",
              durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
              score: scoreRef.current,
            });
          }
        }
        if (bird.y - BIRD_RADIUS <= 0) {
          bird.y = BIRD_RADIUS;
          bird.velocity = 0;
        }

        // Spawn pipes
        if (frameCountRef.current % PIPE_SPAWN_INTERVAL === 0) {
          const minH = 60;
          const maxH = CANVAS_HEIGHT - 30 - PIPE_GAP - minH;
          const topH = Math.floor(Math.random() * (maxH - minH + 1)) + minH;
          pipesRef.current.push({
            x: CANVAS_WIDTH,
            topHeight: topH,
            bottomY: topH + PIPE_GAP,
            passed: false,
          });
        }

        // Pipes movement & collision
        const pipes = pipesRef.current;
        for (let i = pipes.length - 1; i >= 0; i--) {
          const p = pipes[i]!;
          p.x -= PIPE_SPEED;

          // Check score pass
          if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
            p.passed = true;
            playSound("score");
            setScore((s) => {
              const next = s + 1;
              if (next > bestScore) {
                setBestScore(next);
                commitBestScore("flappy-bird", next);
              }
              return next;
            });
          }

          // Pipe collision detection
          if (checkFlappyPipeCollision(bird, BIRD_RADIUS, { ...p, width: PIPE_WIDTH })) {
            playSound("hit");
            setGameState("gameover");
            if (!matchRecordedRef.current) {
              matchRecordedRef.current = true;
              saveLocalMatch({
                gameId: "flappy-bird",
                gameName: "Flappy Bird",
                mode: "solo",
                outcome: "loss",
                durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                score: scoreRef.current,
              });
            }
            break;
          }

          // Remove offscreen
          if (p.x + PIPE_WIDTH < -10) {
            pipes.splice(i, 1);
          }
        }
      }

      // Draw Background
      ctx.fillStyle = "#090B18";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Distant neon skyscrapers
      ctx.fillStyle = "#11142E";
      for (let i = 0; i < 9; i++) {
        const bx = i * 55 - ((frameCountRef.current * 0.35) % 55);
        ctx.fillRect(bx, CANVAS_HEIGHT - 170 + (i % 3) * 22, 44, 170);
      }

      // Draw Pipes
      const pipes = pipesRef.current;
      for (const p of pipes) {
        // Top Pipe
        const topGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
        topGrad.addColorStop(0, "#059669");
        topGrad.addColorStop(0.4, "#34D399");
        topGrad.addColorStop(1, "#047857");

        ctx.fillStyle = topGrad;
        ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
        // Collar
        ctx.fillStyle = "#10B981";
        ctx.fillRect(p.x - 3, p.topHeight - 18, PIPE_WIDTH + 6, 18);
        ctx.strokeStyle = "#064e3b";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x - 3, p.topHeight - 18, PIPE_WIDTH + 6, 18);

        // Bottom Pipe
        const bottomHeight = CANVAS_HEIGHT - 30 - p.bottomY;
        const botGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
        botGrad.addColorStop(0, "#059669");
        botGrad.addColorStop(0.4, "#34D399");
        botGrad.addColorStop(1, "#047857");

        ctx.fillStyle = botGrad;
        ctx.fillRect(p.x, p.bottomY, PIPE_WIDTH, bottomHeight);
        // Collar
        ctx.fillStyle = "#10B981";
        ctx.fillRect(p.x - 3, p.bottomY, PIPE_WIDTH + 6, 18);
        ctx.strokeRect(p.x - 3, p.bottomY, PIPE_WIDTH + 6, 18);
      }

      // Draw Ground
      const groundGrad = ctx.createLinearGradient(0, CANVAS_HEIGHT - 30, 0, CANVAS_HEIGHT);
      groundGrad.addColorStop(0, "#0F172A");
      groundGrad.addColorStop(1, "#020617");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30);
      ctx.fillStyle = "#10B981";
      ctx.fillRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 3);

      // Draw Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]!;
        ctx.fillStyle = `rgba(253, 224, 71, ${pt.alpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.05;
        if (pt.alpha <= 0) particles.splice(i, 1);
      }

      // Draw Bird
      const bird = birdRef.current;
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.angle);

      // Body glow & gradient
      const birdGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, BIRD_RADIUS);
      birdGrad.addColorStop(0, "#FEF08A");
      birdGrad.addColorStop(0.7, "#EAB308");
      birdGrad.addColorStop(1, "#B45309");
      ctx.fillStyle = birdGrad;
      ctx.shadowColor = "#FACC15";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Wing
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.ellipse(-4, 2, 7, 5, bird.velocity * 0.06, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(6, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(7.5, -4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = "#EA580C";
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(19, 3);
      ctx.lineTo(10, 7);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // In-flight Score HUD
      if (state === "playing") {
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 6;
        ctx.font = "900 42px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(scoreRef.current), CANVAS_WIDTH / 2, 65);
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bestScore, playSound]);

  // Determine achievement medal
  const getMedal = (s: number) => {
    if (s >= 40) return { label: "Platinum", color: "text-cyan-300" };
    if (s >= 25) return { label: "Gold", color: "text-amber-400" };
    if (s >= 15) return { label: "Silver", color: "text-slate-300" };
    if (s >= 5) return { label: "Bronze", color: "text-amber-600" };
    return null;
  };

  const medal = getMedal(score);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Flappy Bird"
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
          onClick={() => (gameState === "playing" ? setShowExitConfirm(true) : onExit?.())}
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Exit</span>
        </Button>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs px-2.5 py-1">
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
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-white/40" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/10 text-white/90 hover:bg-white/10 text-xs sm:text-sm"
            onClick={resetGame}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </header>

      {/* Main Game Stage */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <div
          role="button"
          tabIndex={0}
          onClick={flap}
          onTouchStart={(e) => {
            if ((e.target as HTMLElement)?.closest("button")) return;
            e.preventDefault();
            flap();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") flap();
          }}
          aria-label="Tap to flap bird"
          className="relative rounded-3xl border-2 border-emerald-500/40 shadow-[0_0_60px_rgba(16,185,129,0.2)] overflow-hidden cursor-pointer select-none touch-none"
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block w-full max-w-[min(90vw,420px)] max-h-[75vh] aspect-[380/540] object-contain"
          />

          {/* Idle Start Overlay */}
          {gameState === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-center">
              <span className="text-3xl font-black text-amber-400 tracking-wider mb-2 drop-shadow-md">
                FLAPPY BIRD
              </span>
              <p className="text-xs text-white/70 mb-4 max-w-[200px]">
                Tap anywhere or press Spacebar to flap wings through the pipes.
              </p>
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black px-8 py-5 rounded-2xl shadow-xl shadow-amber-500/25 active:scale-95"
              >
                <Play className="h-5 w-5 fill-current" />
                TAP TO FLAP
              </Button>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === "gameover" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-center animate-in fade-in zoom-in-95">
              <div className="w-full max-w-[280px] rounded-3xl border border-white/10 bg-[#121424] p-5 shadow-2xl">
                <span className="text-2xl font-black text-white">Flight Over</span>

                {medal && (
                  <div className={`mt-2 flex items-center justify-center gap-1.5 font-bold text-sm ${medal.color}`}>
                    <Medal className="h-4 w-4" />
                    <span>{medal.label} Medal Earned!</span>
                  </div>
                )}

                <div className="flex justify-around my-4 py-2 border-y border-white/5">
                  <div>
                    <p className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">Score</p>
                    <p className="text-2xl font-black text-amber-400 tabular-nums">{score}</p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div>
                    <p className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">Best</p>
                    <p className="text-2xl font-black text-yellow-400 tabular-nums">{bestScore}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/10 text-white/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExit?.();
                    }}
                  >
                    Exit
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetGame();
                    }}
                  >
                    Play Again
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
