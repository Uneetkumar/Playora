"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Volume2, VolumeX, Sparkles, Trophy, Heart, Play, Zap, Shield, Flame } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { readBestScore, commitBestScore } from "./scoring";
import { saveLocalMatch } from "../../hooks/use-local-history";

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 560;
const BASE_PADDLE_WIDTH = 90;
const WIDE_PADDLE_WIDTH = 136;
const PADDLE_HEIGHT = 12;
const BALL_RADIUS = 6;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_HEIGHT = 18;
const BRICK_PADDING = 6;
const BRICK_OFFSET_TOP = 52;
const BRICK_OFFSET_LEFT = 24;

const ROW_COLORS = [
  { fill: "#F43F5E", stroke: "#FB7185", points: 50, glow: "rgba(244, 63, 94, 0.4)" }, // Rose
  { fill: "#A855F7", stroke: "#C084FC", points: 40, glow: "rgba(168, 85, 247, 0.4)" }, // Purple
  { fill: "#3B82F6", stroke: "#60A5FA", points: 30, glow: "rgba(59, 130, 246, 0.4)" }, // Blue
  { fill: "#10B981", stroke: "#34D399", points: 20, glow: "rgba(16, 185, 129, 0.4)" }, // Emerald
  { fill: "#F59E0B", stroke: "#FBBF24", points: 10, glow: "rgba(245, 158, 11, 0.4)" }, // Amber
];

type PowerUpType = "wide" | "multiball" | "fireball" | "life";

interface PowerUp {
  x: number;
  y: number;
  vy: number;
  type: PowerUpType;
  label: string;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

interface FloatingScore {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  fireball: boolean;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  alive: boolean;
  colorIdx: number;
}

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

export function calculatePaddleBounce(
  ballX: number,
  paddleX: number,
  paddleWidth: number,
  incomingSpeed: number
): { dx: number; dy: number } {
  const hitPos = (ballX - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
  const clampedHit = Math.max(-0.95, Math.min(0.95, hitPos));
  const maxAngle = Math.PI / 2.8; // ~64 deg
  const angle = clampedHit * maxAngle;
  const currentSpeed = Math.min(8.6, incomingSpeed * 1.01);
  return {
    dx: currentSpeed * Math.sin(angle),
    dy: -Math.max(3.2, currentSpeed * Math.cos(angle)),
  };
}

export function BrickBreakerView({ onExit }: { onExit?: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [score, setScore] = React.useState(0);
  const [lives, setLives] = React.useState(3);
  const [bestScore, setBestScore] = React.useState(() => readBestScore("brick-breaker"));
  const [gameState, setGameState] = React.useState<"idle" | "playing" | "won" | "gameover">("idle");
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [activeBuff, setActiveBuff] = React.useState<string | null>(null);

  // Gameplay physics refs
  const paddleRef = React.useRef({
    x: (CANVAS_WIDTH - BASE_PADDLE_WIDTH) / 2,
    width: BASE_PADDLE_WIDTH,
    wideUntil: 0,
    fireballUntil: 0,
  });

  const ballsRef = React.useRef<Ball[]>([]);
  const bricksRef = React.useRef<Brick[]>([]);
  const powerUpsRef = React.useRef<PowerUp[]>([]);
  const particlesRef = React.useRef<Particle[]>([]);
  const floatingTextsRef = React.useRef<FloatingScore[]>([]);

  const comboRef = React.useRef(0);
  const keysRef = React.useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const scoreRef = React.useRef(0);
  scoreRef.current = score;
  const livesRef = React.useRef(3);
  livesRef.current = lives;
  const gameStateRef = React.useRef(gameState);
  gameStateRef.current = gameState;
  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);

  // Web Audio synthesizer
  const playSound = React.useCallback(
    (type: "paddle" | "brick" | "powerup" | "lose-ball" | "lose-life" | "win" | "gameover", pitchMod = 1) => {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;

        if (type === "paddle") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(340, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.05);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.06);
        } else if (type === "brick") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          const baseFreq = Math.min(1200, 520 * pitchMod);
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
        } else if (type === "powerup") {
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now + idx * 0.05);
            gain.gain.setValueAtTime(0.1, now + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.05);
            osc.stop(now + idx * 0.05 + 0.12);
          });
        } else if (type === "lose-ball" || type === "lose-life") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.28);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.28);
        } else if (type === "win") {
          [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            gain.gain.setValueAtTime(0.14, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.28);
          });
        }
      } catch {
        // Audio error handled
      }
    },
    [soundEnabled]
  );

  const initBricks = React.useCallback(() => {
    const bricks: Brick[] = [];
    const brickWidth = Math.floor(
      (CANVAS_WIDTH - BRICK_OFFSET_LEFT * 2 - (BRICK_COLS - 1) * BRICK_PADDING) / BRICK_COLS
    );

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_OFFSET_LEFT + c * (brickWidth + BRICK_PADDING),
          y: BRICK_OFFSET_TOP + r * (BRICK_HEIGHT + BRICK_PADDING),
          width: brickWidth,
          height: BRICK_HEIGHT,
          alive: true,
          colorIdx: r,
        });
      }
    }
    bricksRef.current = bricks;
  }, []);

  const resetPaddleAndBall = React.useCallback(() => {
    paddleRef.current = {
      x: (CANVAS_WIDTH - BASE_PADDLE_WIDTH) / 2,
      width: BASE_PADDLE_WIDTH,
      wideUntil: 0,
      fireballUntil: 0,
    };
    ballsRef.current = [
      {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT - 65,
        dx: 3.6 * (Math.random() > 0.5 ? 1 : -1),
        dy: -4.6,
        fireball: false,
      },
    ];
    powerUpsRef.current = [];
    comboRef.current = 0;
    setActiveBuff(null);
  }, []);

  const spawnParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        size: 2.5 + Math.random() * 2,
      });
    }
  };

  const spawnPowerUp = (x: number, y: number) => {
    // 24% chance of powerup drop
    if (Math.random() > 0.24) return;

    const roll = Math.random();
    let type: PowerUpType;
    let label: string;
    let color: string;

    if (roll < 0.3) {
      type = "wide";
      label = "WIDE";
      color = "#38BDF8";
    } else if (roll < 0.6) {
      type = "multiball";
      label = "3-BALL";
      color = "#A855F7";
    } else if (roll < 0.85) {
      type = "fireball";
      label = "FIRE";
      color = "#F43F5E";
    } else {
      type = "life";
      label = "+1 LIFE";
      color = "#10B981";
    }

    powerUpsRef.current.push({
      x,
      y,
      vy: 1.8,
      type,
      label,
      color,
    });
  };

  const startGame = React.useCallback(() => {
    initBricks();
    resetPaddleAndBall();
    particlesRef.current = [];
    floatingTextsRef.current = [];
    setScore(0);
    setLives(3);
    setGameState("playing");
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
  }, [initBricks, resetPaddleAndBall]);

  // Handle paddle mouse & touch move
  const updatePaddlePosition = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const canvasX = (clientX - rect.left) * scaleX;
    const pWidth = paddleRef.current.width;
    paddleRef.current.x = Math.max(0, Math.min(CANVAS_WIDTH - pWidth, canvasX - pWidth / 2));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updatePaddlePosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons > 0 || e.pointerType === "mouse") {
      updatePaddlePosition(e.clientX);
    }
  };

  // Keyboard controls
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        keysRef.current.right = true;
      } else if (
        (e.key === " " || e.key === "Enter") &&
        (gameStateRef.current === "idle" || gameStateRef.current === "gameover" || gameStateRef.current === "won")
      ) {
        e.preventDefault();
        startGame();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        startGame();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        keysRef.current.left = false;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        keysRef.current.right = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startGame]);

  // 60 FPS physics & render loop
  React.useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const state = gameStateRef.current;
      const nowMs = Date.now();
      const paddle = paddleRef.current;

      // Handle buff expirations
      if (paddle.wideUntil > 0 && nowMs > paddle.wideUntil) {
        paddle.wideUntil = 0;
        paddle.width = BASE_PADDLE_WIDTH;
        setActiveBuff((prev) => (prev === "WIDE" ? null : prev));
      }
      if (paddle.fireballUntil > 0 && nowMs > paddle.fireballUntil) {
        paddle.fireballUntil = 0;
        ballsRef.current.forEach((b) => (b.fireball = false));
        setActiveBuff((prev) => (prev === "FIREBALL" ? null : prev));
      }

      if (state === "playing") {
        // Keyboard paddle motion
        const moveSpeed = 8;
        if (keysRef.current.left) {
          paddle.x = Math.max(0, paddle.x - moveSpeed);
        }
        if (keysRef.current.right) {
          paddle.x = Math.min(CANVAS_WIDTH - paddle.width, paddle.x + moveSpeed);
        }

        const paddleY = CANVAS_HEIGHT - 38;

        // Update Powerups falling
        const powerUps = powerUpsRef.current;
        for (let i = powerUps.length - 1; i >= 0; i--) {
          const pu = powerUps[i]!;
          pu.y += pu.vy;

          // Check paddle collision with powerup
          if (
            pu.y + 10 >= paddleY &&
            pu.y - 10 <= paddleY + PADDLE_HEIGHT &&
            pu.x + 18 >= paddle.x &&
            pu.x - 18 <= paddle.x + paddle.width
          ) {
            playSound("powerup");
            if (pu.type === "wide") {
              paddle.width = WIDE_PADDLE_WIDTH;
              paddle.wideUntil = nowMs + 12000;
              setActiveBuff("WIDE");
            } else if (pu.type === "multiball") {
              // Spawn 2 additional balls with varied angles
              const mainBall = ballsRef.current[0] || { x: paddle.x + paddle.width / 2, y: paddleY - 20, dx: 3, dy: -4, fireball: false };
              ballsRef.current.push(
                { x: mainBall.x, y: mainBall.y, dx: -3.5, dy: -4.2, fireball: paddle.fireballUntil > 0 },
                { x: mainBall.x, y: mainBall.y, dx: 3.5, dy: -4.2, fireball: paddle.fireballUntil > 0 }
              );
              setActiveBuff("3-BALL");
            } else if (pu.type === "fireball") {
              paddle.fireballUntil = nowMs + 8000;
              ballsRef.current.forEach((b) => (b.fireball = true));
              setActiveBuff("FIREBALL");
            } else if (pu.type === "life") {
              setLives((l) => Math.min(5, l + 1));
              setActiveBuff("+1 LIFE");
            }

            floatingTextsRef.current.push({
              x: pu.x,
              y: pu.y - 10,
              text: pu.label,
              color: pu.color,
              alpha: 1,
            });

            powerUps.splice(i, 1);
            continue;
          }

          // Offscreen removal
          if (pu.y > CANVAS_HEIGHT) {
            powerUps.splice(i, 1);
          }
        }

        // Update Balls
        const balls = ballsRef.current;
        for (let bIdx = balls.length - 1; bIdx >= 0; bIdx--) {
          const ball = balls[bIdx]!;
          ball.x += ball.dx;
          ball.y += ball.dy;

          // Wall collisions
          if (ball.x - BALL_RADIUS <= 0) {
            ball.x = BALL_RADIUS;
            ball.dx = Math.abs(ball.dx);
          } else if (ball.x + BALL_RADIUS >= CANVAS_WIDTH) {
            ball.x = CANVAS_WIDTH - BALL_RADIUS;
            ball.dx = -Math.abs(ball.dx);
          }

          if (ball.y - BALL_RADIUS <= 0) {
            ball.y = BALL_RADIUS;
            ball.dy = Math.abs(ball.dy);
          }

          // Paddle collision
          if (
            ball.y + BALL_RADIUS >= paddleY &&
            ball.y - BALL_RADIUS <= paddleY + PADDLE_HEIGHT &&
            ball.x >= paddle.x &&
            ball.x <= paddle.x + paddle.width &&
            ball.dy > 0
          ) {
            playSound("paddle");
            const incomingSpeed = Math.hypot(ball.dx, ball.dy);
            const bounced = calculatePaddleBounce(ball.x, paddle.x, paddle.width, incomingSpeed);
            ball.dx = bounced.dx;
            ball.dy = bounced.dy;
            ball.y = paddleY - BALL_RADIUS;
          }

          // Brick collisions
          const bricks = bricksRef.current;
          let anyAlive = false;

          for (const brick of bricks) {
            if (!brick.alive) continue;
            anyAlive = true;

            // AABB with previous ball position check to reflect correctly horizontally or vertically
            if (
              ball.x + BALL_RADIUS > brick.x &&
              ball.x - BALL_RADIUS < brick.x + brick.width &&
              ball.y + BALL_RADIUS > brick.y &&
              ball.y - BALL_RADIUS < brick.y + brick.height
            ) {
              brick.alive = false;
              comboRef.current += 1;
              const combo = comboRef.current;
              const comboMultiplier = Math.min(4, 1 + Math.floor(combo / 4));
              const pitchScale = 1 + Math.min(1.2, combo * 0.08);

              playSound("brick", pitchScale);
              spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, ROW_COLORS[brick.colorIdx]!.fill);
              spawnPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);

              const basePts = ROW_COLORS[brick.colorIdx]?.points ?? 10;
              const earnedPts = basePts * comboMultiplier;
              const nextScore = scoreRef.current + earnedPts;
              setScore(nextScore);
              if (nextScore > bestScore) {
                setBestScore(nextScore);
                commitBestScore("brick-breaker", nextScore);
              }

              floatingTextsRef.current.push({
                x: brick.x + brick.width / 2,
                y: brick.y,
                text: comboMultiplier > 1 ? `+${earnedPts} (${comboMultiplier}x)` : `+${earnedPts}`,
                color: ROW_COLORS[brick.colorIdx]!.fill,
                alpha: 1,
              });

              // Fireball pierces through bricks without bouncing!
              if (!ball.fireball) {
                const prevX = ball.x - ball.dx;
                if (prevX + BALL_RADIUS <= brick.x || prevX - BALL_RADIUS >= brick.x + brick.width) {
                  ball.dx = -ball.dx;
                } else {
                  ball.dy = -ball.dy;
                }
              }
              break;
            }
          }

          // Check if all bricks cleared
          if (!anyAlive && bricks.length > 0) {
            playSound("win");
            setGameState("won");
            if (!matchRecordedRef.current) {
              matchRecordedRef.current = true;
              saveLocalMatch({
                gameId: "brick-breaker",
                gameName: "Brick Breaker",
                mode: "solo",
                outcome: "win",
                durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                score: scoreRef.current,
              });
            }
            break;
          }

          // Ball fell below floor
          if (ball.y - BALL_RADIUS > CANVAS_HEIGHT) {
            balls.splice(bIdx, 1);
            if (balls.length === 0) {
              comboRef.current = 0;
              playSound("lose-life");
              const nextLives = livesRef.current - 1;
              setLives(nextLives);
              if (nextLives <= 0) {
                setGameState("gameover");
                if (!matchRecordedRef.current) {
                  matchRecordedRef.current = true;
                  saveLocalMatch({
                    gameId: "brick-breaker",
                    gameName: "Brick Breaker",
                    mode: "solo",
                    outcome: "loss",
                    durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                    score: scoreRef.current,
                  });
                }
              } else {
                resetPaddleAndBall();
              }
            }
          }
        }

        // Update particles
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]!;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12; // gravity
          p.alpha -= 0.03;
          if (p.alpha <= 0) particles.splice(i, 1);
        }

        // Update floating texts
        const floating = floatingTextsRef.current;
        for (let i = floating.length - 1; i >= 0; i--) {
          const ft = floating[i]!;
          ft.y -= 1.1;
          ft.alpha -= 0.025;
          if (ft.alpha <= 0) floating.splice(i, 1);
        }
      }

      // --- RENDER PASS ---
      // Background
      ctx.fillStyle = "#090A16";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Subtle background grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Draw Bricks
      const bricks = bricksRef.current;
      for (const b of bricks) {
        if (!b.alive) continue;
        const color = ROW_COLORS[b.colorIdx]!;
        ctx.shadowColor = color.glow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color.fill;
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 4);
        ctx.fill();
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Draw PowerUps
      const powerUps = powerUpsRef.current;
      for (const pu of powerUps) {
        ctx.shadowColor = pu.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = pu.color;
        ctx.beginPath();
        ctx.roundRect(pu.x - 20, pu.y - 9, 40, 18, 6);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#000000";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pu.label, pu.x, pu.y);
      }

      // Draw Particles
      const particles = particlesRef.current;
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Draw Floating Texts
      const floating = floatingTextsRef.current;
      for (const ft of floating) {
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      // Draw Paddle
      const paddleY = CANVAS_HEIGHT - 38;
      const isFire = paddle.fireballUntil > nowMs;
      const pGrad = ctx.createLinearGradient(paddle.x, paddleY, paddle.x + paddle.width, paddleY);
      if (isFire) {
        pGrad.addColorStop(0, "#F43F5E");
        pGrad.addColorStop(0.5, "#FB923C");
        pGrad.addColorStop(1, "#F43F5E");
        ctx.shadowColor = "#FB923C";
      } else {
        pGrad.addColorStop(0, "#06B6D4");
        pGrad.addColorStop(0.5, "#38BDF8");
        pGrad.addColorStop(1, "#0EA5E9");
        ctx.shadowColor = "#38BDF8";
      }
      ctx.shadowBlur = 12;
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddleY, paddle.width, PADDLE_HEIGHT, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Balls
      const balls = ballsRef.current;
      for (const ball of balls) {
        if (ball.fireball) {
          ctx.shadowColor = "#FB7185";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#FF4500";
        } else {
          ctx.shadowColor = "#67E8F9";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#FFFFFF";
        }
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bestScore, playSound, resetPaddleAndBall]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Brick Breaker"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Top Control Bar */}
      <div className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/5 bg-[#090A14]/90 backdrop-blur-md">
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
          {/* Active Buff Badge */}
          {activeBuff && (
            <Badge variant="outline" className="hidden xs:inline-flex gap-1 bg-amber-500/10 text-amber-300 border-amber-500/30 text-[11px] px-2 py-0.5 animate-pulse">
              <Zap className="h-3 w-3 text-amber-400" />
              <span>{activeBuff}</span>
            </Badge>
          )}

          {/* Lives hearts */}
          <div className="flex gap-1 items-center bg-rose-500/10 px-2 py-1 rounded-md border border-rose-500/20">
            {Array.from({ length: 5 }).map((_, i) => (
              <Heart
                key={i}
                className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-colors ${
                  i < lives ? "fill-rose-500 text-rose-500" : "fill-transparent text-white/15"
                }`}
              />
            ))}
          </div>

          <Badge variant="secondary" className="gap-1 bg-cyan-500/10 text-cyan-300 border-cyan-500/20 text-xs px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
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

      {/* Main Stage */}
      <div className="relative flex flex-1 flex-col items-center justify-center p-2 sm:p-4">
        <div className="relative rounded-3xl border-2 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className="block w-full max-w-[min(90vw,540px)] max-h-[76vh] aspect-[480/560] touch-none cursor-ew-resize object-contain"
          />

          {/* Idle Start Overlay */}
          {gameState === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs p-4 text-center animate-in fade-in">
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 tracking-wider mb-2">
                BRICK BREAKER
              </span>
              <p className="text-xs text-white/70 mb-4 max-w-[240px] leading-relaxed">
                Drag or use Arrow / A-D keys to slide paddle. Catch powerups like Multi-ball & Fireball to shatter the grid!
              </p>
              <div className="flex gap-2 mb-5">
                <span className="flex items-center gap-1 text-[11px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  <Shield className="h-3 w-3" /> Wide
                </span>
                <span className="flex items-center gap-1 text-[11px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  <Zap className="h-3 w-3" /> 3-Ball
                </span>
                <span className="flex items-center gap-1 text-[11px] text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  <Flame className="h-3 w-3" /> Fire
                </span>
              </div>
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white font-black px-8 py-5 rounded-2xl shadow-xl shadow-cyan-500/25 active:scale-95"
                onClick={startGame}
              >
                <Play className="h-5 w-5 fill-current" />
                START GAME
              </Button>
            </div>
          )}

          {/* Won / Game Over Overlay */}
          {(gameState === "won" || gameState === "gameover") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center animate-in fade-in zoom-in-95">
              <div className="w-full max-w-[290px] rounded-3xl border border-white/10 bg-[#121424] p-6 shadow-2xl">
                <span className={`text-2xl font-black ${gameState === "won" ? "text-cyan-400" : "text-rose-400"}`}>
                  {gameState === "won" ? "Stage Cleared!" : "Game Over"}
                </span>
                <div className="flex justify-around my-4 py-2 border-y border-white/5">
                  <div>
                    <p className="text-[11px] text-white/50">Score</p>
                    <p className="text-2xl font-black text-cyan-400">{score}</p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div>
                    <p className="text-[11px] text-white/50">Best</p>
                    <p className="text-2xl font-black text-yellow-400">{bestScore}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/10 text-white/80"
                    onClick={onExit}
                  >
                    Exit
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold"
                    onClick={startGame}
                  >
                    Play Again
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
