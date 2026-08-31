"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import {
  Trophy,
  RotateCcw,
  Zap,
  Heart,
  Volume2,
  VolumeX,
  ArrowLeft,
} from "lucide-react";

type BugType = "worker" | "fire" | "beetle" | "queen" | "golden";

interface Bug {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  type: BugType;
  hp: number;
  maxHp: number;
  size: number;
  legPhase: number;
  color: string;
}

interface Splatter {
  x: number;
  y: number;
  color: string;
  radius: number;
  opacity: number;
  createdAt: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
  yOffset: number;
}

export function AntAttackView({ onExit }: { onExit?: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = React.useState(0);
  const [combo, setCombo] = React.useState(0);
  const [cakeHealth, setCakeHealth] = React.useState(100);
  const [gameOver, setGameOver] = React.useState(false);
  const [sprayCooldown, setSprayCooldown] = React.useState(0);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [screenShake, setScreenShake] = React.useState(0);

  const bugsRef = React.useRef<Bug[]>([]);
  const splattersRef = React.useRef<Splatter[]>([]);
  const floatingTextsRef = React.useRef<FloatingText[]>([]);
  const comboTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const nextBugId = React.useRef(1);
  const nextTextId = React.useRef(1);

  const playSquishSound = React.useCallback((pitch = 1) => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(320 * pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable
    }
  }, [soundEnabled]);

  React.useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.width;
      const spawnX = Math.random() * (width - 120) + 60;
      const spawnY = -30;

      const rand = Math.random();
      let type: BugType = "worker";
      let hp = 1;
      let size = 18;
      let speed = 1.6 + Math.random() * 0.8;
      let color = "#18181b"; 

      if (rand < 0.08) {
        type = "golden";
        hp = 1;
        size = 20;
        speed = 3.4;
        color = "#eab308";
      } else if (rand < 0.22) {
        type = "queen";
        hp = 4;
        size = 34;
        speed = 1.1;
        color = "#831843";
      } else if (rand < 0.45) {
        type = "beetle";
        hp = 2;
        size = 26;
        speed = 1.2;
        color = "#15803d";
      } else if (rand < 0.70) {
        type = "fire";
        hp = 1;
        size = 20;
        speed = 2.4;
        color = "#dc2626";
      }

      const targetX = width * 0.5 + (Math.random() - 0.5) * (width * 0.6);
      const targetY = canvas.height - 40;
      const angle = Math.atan2(targetY - spawnY, targetX - spawnX);

      bugsRef.current.push({
        id: nextBugId.current++,
        x: spawnX,
        y: spawnY,
        angle,
        speed,
        type,
        hp,
        maxHp: hp,
        size,
        legPhase: Math.random() * Math.PI * 2,
        color,
      });
    }, 550);

    return () => clearInterval(interval);
  }, [gameOver]);

  React.useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      animationId = requestAnimationFrame(render);
      const delta = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.save();
      if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake * 4;
        const shakeY = (Math.random() - 0.5) * screenShake * 4;
        ctx.translate(shakeX, shakeY);
        setScreenShake((s) => Math.max(0, s - delta * 8));
      }

      const grad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width * 0.75);
      grad.addColorStop(0, "#451a03");
      grad.addColorStop(1, "#1c0a00");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      const sq = 48;
      for (let y = 0; y < height; y += sq) {
        for (let x = 0; x < width; x += sq) {
          if ((Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0) {
            ctx.fillRect(x, y, sq, sq);
          }
        }
      }

      for (let i = splattersRef.current.length - 1; i >= 0; i--) {
        const s = splattersRef.current[i]!;
        s.opacity -= delta * 0.04;
        if (s.opacity <= 0) {
          splattersRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, s.opacity);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let d = 0; d < 6; d++) {
          const dropAngle = (d / 6) * Math.PI * 2 + 0.3;
          const dropDist = s.radius * 1.5;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(dropAngle) * dropDist, s.y + Math.sin(dropAngle) * dropDist, s.radius * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const cakeY = height - 50;
      const cakeWidth = Math.min(width * 0.7, 720);
      const cakeX = width / 2 - cakeWidth / 2;

      ctx.save();
      ctx.shadowColor = "#f43f5e";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#e11d48";
      ctx.beginPath();
      ctx.roundRect(cakeX, cakeY, cakeWidth, 38, [18, 18, 0, 0]);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#fff1f2";
      ctx.fillRect(cakeX + 8, cakeY + 4, cakeWidth - 16, 10);

      const berryCount = Math.floor(cakeWidth / 48);
      for (let b = 0; b < berryCount; b++) {
        const bx = cakeX + 24 + b * 46;
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.arc(bx, cakeY + 6, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#10b981";
        ctx.fillRect(bx - 2, cakeY - 1, 4, 3);
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🎂 SWEET STRAWBERRY CAKE · DEFEND AT ALL COSTS 🎂", width / 2, cakeY + 26);

      if (!gameOver) {
        for (let i = bugsRef.current.length - 1; i >= 0; i--) {
          const bug = bugsRef.current[i]!;
          bug.legPhase += delta * 18 * (bug.speed / 1.5);
          bug.angle += (Math.random() - 0.5) * 0.08;
          bug.x += Math.cos(bug.angle) * bug.speed * (delta * 60);
          bug.y += Math.sin(bug.angle) * bug.speed * (delta * 60);

          if (bug.y >= cakeY - 10) {
            bugsRef.current.splice(i, 1);
            setCakeHealth((h) => {
              const damage = bug.type === "queen" ? 25 : bug.type === "beetle" ? 15 : 8;
              const next = Math.max(0, h - damage);
              if (next <= 0) setGameOver(true);
              return next;
            });
            setCombo(0);
            setScreenShake(3);
            continue;
          }

          ctx.save();
          ctx.translate(bug.x, bug.y);
          ctx.rotate(bug.angle + Math.PI / 2);

          ctx.strokeStyle = bug.color;
          ctx.lineWidth = bug.size > 24 ? 3 : 2;
          ctx.lineCap = "round";

          for (let leg = -1; leg <= 1; leg += 2) {
            for (let side = -1; side <= 1; side += 2) {
              const phase = bug.legPhase * side + leg;
              const wiggle = Math.sin(phase) * 0.45;
              const legLength = bug.size * 0.9;
              const legRootX = side * (bug.size * 0.25);
              const legRootY = leg * (bug.size * 0.35);
              const kneeX = legRootX + side * (legLength * 0.6) + wiggle * 4;
              const kneeY = legRootY + (leg * 6) + wiggle * 6;
              const footX = kneeX + side * (legLength * 0.5) - wiggle * 3;
              const footY = kneeY + (leg * 8) + wiggle * 4;
              ctx.beginPath();
              ctx.moveTo(legRootX, legRootY);
              ctx.lineTo(kneeX, kneeY);
              ctx.lineTo(footX, footY);
              ctx.stroke();
            }
          }

          ctx.fillStyle = bug.color;
          ctx.beginPath();
          ctx.ellipse(0, bug.size * 0.5, bug.size * 0.35, bug.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          if (bug.type === "golden") {
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.beginPath();
            ctx.ellipse(-bug.size * 0.1, bug.size * 0.45, bug.size * 0.1, bug.size * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = bug.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, bug.size * 0.22, bug.size * 0.28, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.ellipse(0, -bug.size * 0.48, bug.size * 0.26, bug.size * 0.28, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = bug.type === "fire" ? "#fef08a" : bug.type === "golden" ? "#ffffff" : "#38bdf8";
          ctx.beginPath();
          ctx.arc(-bug.size * 0.12, -bug.size * 0.55, bug.size * 0.07, 0, Math.PI * 2);
          ctx.arc(bug.size * 0.12, -bug.size * 0.55, bug.size * 0.07, 0, Math.PI * 2);
          ctx.fill();

          const antennaTwitch = Math.sin(bug.legPhase * 1.5) * 0.2;
          ctx.strokeStyle = bug.color;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(-bug.size * 0.1, -bug.size * 0.65);
          ctx.quadraticCurveTo(-bug.size * 0.4 + antennaTwitch * 6, -bug.size * 1.1, -bug.size * 0.5, -bug.size * 1.25);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bug.size * 0.1, -bug.size * 0.65);
          ctx.quadraticCurveTo(bug.size * 0.4 - antennaTwitch * 6, -bug.size * 1.1, bug.size * 0.5, -bug.size * 1.25);
          ctx.stroke();

          if (bug.maxHp > 1) {
            const hpWidth = bug.size * 1.4;
            const hpPercent = bug.hp / bug.maxHp;
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(-hpWidth / 2, -bug.size * 0.9, hpWidth, 4);
            ctx.fillStyle = hpPercent > 0.5 ? "#22c55e" : "#ef4444";
            ctx.fillRect(-hpWidth / 2, -bug.size * 0.9, hpWidth * hpPercent, 4);
          }

          ctx.restore();
        }
      }

      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i]!;
        ft.opacity -= delta * 1.4;
        ft.yOffset -= delta * 60;
        if (ft.opacity <= 0) {
          floatingTextsRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.opacity);
        ctx.fillStyle = ft.color;
        ctx.font = "900 18px sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 6;
        ctx.fillText(ft.text, ft.x, ft.y + ft.yOffset);
        ctx.restore();
      }
      ctx.restore();
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [gameOver, screenShake]);

  const handleSquish = (clientX: number, clientY: number) => {
    if (gameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let hit = false;
    for (let i = bugsRef.current.length - 1; i >= 0; i--) {
      const bug = bugsRef.current[i]!;
      const dist = Math.hypot(bug.x - x, bug.y - y);
      const hitRadius = Math.max(48, bug.size * 2.2);

      if (dist < hitRadius) {
        hit = true;
        bug.hp -= 1;
        if (bug.hp <= 0) {
          bugsRef.current.splice(i, 1);
          splattersRef.current.push({
            x: bug.x,
            y: bug.y,
            color: bug.type === "fire" ? "#f43f5e" : bug.type === "golden" ? "#facc15" : bug.type === "beetle" ? "#84cc16" : "#0284c7",
            radius: bug.size * 0.9,
            opacity: 0.9,
            createdAt: Date.now(),
          });
          const basePts = bug.type === "golden" ? 150 : bug.type === "queen" ? 200 : bug.type === "beetle" ? 80 : bug.type === "fire" ? 40 : 20;
          const comboMult = 1 + combo * 0.15;
          const awarded = Math.round(basePts * comboMult);
          setScore((s) => s + awarded);
          setCombo((c) => c + 1);
          floatingTextsRef.current.push({
            id: nextTextId.current++,
            x: bug.x,
            y: bug.y,
            text: `+${awarded}${combo > 2 ? ` 🔥x${combo}` : ""}`,
            color: bug.type === "golden" ? "#facc15" : "#38bdf8",
            opacity: 1,
            yOffset: 0,
          });
          playSquishSound(1 + Math.min(1, combo * 0.1));
          setScreenShake(bug.type === "queen" ? 4 : 1.5);
        } else {
          floatingTextsRef.current.push({
            id: nextTextId.current++,
            x: bug.x,
            y: bug.y,
            text: "HIT!",
            color: "#f97316",
            opacity: 1,
            yOffset: 0,
          });
          playSquishSound(0.7);
        }
        break;
      }
    }
    if (!hit) {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => setCombo(0), 1200);
    }
  };

  React.useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight - 64;
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const triggerBugSpray = () => {
    if (sprayCooldown > 0 || gameOver) return;
    setSprayCooldown(12);
    for (const bug of bugsRef.current) {
      splattersRef.current.push({
        x: bug.x,
        y: bug.y,
        color: "#38bdf8",
        radius: bug.size * 0.7,
        opacity: 0.8,
        createdAt: Date.now(),
      });
    }
    const clearedCount = bugsRef.current.length;
    bugsRef.current = [];
    setScore((s) => s + clearedCount * 30 + 100);
    setScreenShake(5);
    playSquishSound(1.8);
    floatingTextsRef.current.push({
      id: nextTextId.current++,
      x: (canvasRef.current?.width || 800) / 2,
      y: (canvasRef.current?.height || 600) / 2,
      text: "💨 BUG SPRAY CLEARED ALL! +100",
      color: "#22d3ee",
      opacity: 1,
      yOffset: 0,
    });
  };

  React.useEffect(() => {
    if (sprayCooldown <= 0) return;
    const t = setInterval(() => setSprayCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [sprayCooldown]);

  const restartGame = () => {
    setScore(0);
    setCombo(0);
    setCakeHealth(100);
    setGameOver(false);
    bugsRef.current = [];
    splattersRef.current = [];
    floatingTextsRef.current = [];
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none">
      <div className="absolute top-4 inset-x-4 sm:inset-x-8 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {onExit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExit}
              className="gap-1.5 rounded-2xl border-white/15 bg-black/60 backdrop-blur-xl text-white hover:bg-white/15 shadow-xl h-10 px-3.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </Button>
          )}
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/60 backdrop-blur-xl px-4 py-2 shadow-2xl">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                SCORE
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-amber-300">
                {score.toLocaleString()}
              </span>
            </div>
            {combo > 1 && (
              <div className="border-l border-white/10 pl-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block animate-pulse">
                  COMBO
                </span>
                <span className="font-mono text-lg font-black text-cyan-300">
                  x{combo}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center rounded-2xl border border-white/15 bg-black/60 backdrop-blur-xl px-5 py-2 shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-rose-200">
              Cake Health: {cakeHealth}%
            </span>
          </div>
          <div className="h-2 w-48 rounded-full bg-white/10 overflow-hidden border border-white/10">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                cakeHealth > 50
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                  : cakeHealth > 25
                  ? "bg-gradient-to-r from-amber-500 to-orange-400"
                  : "bg-gradient-to-r from-rose-600 to-red-500 animate-pulse"
              )}
              style={{ width: `${cakeHealth}%` }}
            />
          </div>
        </div>

        {/* Right: Controls & Power-ups */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button
            size="sm"
            onClick={triggerBugSpray}
            disabled={sprayCooldown > 0 || gameOver}
            className="gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black shadow-[0_0_20px_rgba(6,182,212,0.4)] h-10 px-4"
          >
            <Zap className="h-4 w-4" />
            <span>Bug Spray</span>
            {sprayCooldown > 0 && <span className="font-mono text-xs opacity-75">({sprayCooldown}s)</span>}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded-2xl border-white/15 bg-black/60 backdrop-blur-xl text-white hover:bg-white/15 h-10 w-10"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-white/50" />}
          </Button>
        </div>
      </div>

      {/* Main Full-Screen Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={(e) => handleSquish(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch) handleSquish(touch.clientX, touch.clientY);
          }
        }}
        className="h-full w-full cursor-crosshair touch-none"
      />

      {/* Game Over Modal Overlay */}
      {gameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-[#1c1917] via-[#0c0a09] to-[#000000] p-8 text-center shadow-[0_0_80px_rgba(0,0,0,0.9)]">
            <Trophy className="h-16 w-16 text-amber-400 mx-auto animate-bounce mb-3" />
            <h2 className="font-display text-3xl font-black text-white uppercase tracking-tight">
              CAKE DEVOURED!
            </h2>
            <p className="text-sm text-white/70 mt-1">
              The ants conquered the strawberry cake.
            </p>

            <div className="my-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                FINAL SQUISH SCORE
              </span>
              <span className="font-mono text-4xl font-black text-amber-400">
                {score.toLocaleString()}
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={restartGame}
                className="flex-1 gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black h-12 shadow-[0_0_25px_rgba(245,158,11,0.4)]"
              >
                <RotateCcw className="h-5 w-5" />
                Play Again
              </Button>
              {onExit && (
                <Button
                  variant="outline"
                  onClick={onExit}
                  className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10 h-12 px-6 font-bold"
                >
                  Exit
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
