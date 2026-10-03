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
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud } from "./ArcadeHud";
import { useJuice } from "./use-juice";
import { waveAt } from "./juice";
import { GameLoop } from "@playora/game-runtime";
import {
  createAntState,
  stepAnts,
  swat,
  fireSpray,
  SPRAY_COOLDOWN,
  START_HEALTH,
  BUG_KINDS,
  type Bug,
} from "./ant-attack";
import { formatScore, pointsFor } from "./scoring";

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
  /*
   * Score, chain and the personal best come from the shared run. The local
   * versions applied a linear `1 + combo * 0.15` with no cap and no
   * persistence — a long streak was worth arbitrarily much, and the total
   * vanished the moment the cake fell.
   */
  const run = useArcadeRun("ant-attack");
  const juice = useJuice();
  // Held in a ref so the game loops can reach it without becoming a dependency.
  const juiceRef = React.useRef(juice);
  juiceRef.current = juice;
  const runRef = React.useRef(run);
  runRef.current = run;
  const [cakeHealth, setCakeHealth] = React.useState(100);
  // The authoritative value for the game loop; state is the render mirror.
  const [gameOver, setGameOver] = React.useState(false);
  const [sprayCooldown, setSprayCooldown] = React.useState(0);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [screenShake, setScreenShake] = React.useState(0);

  /** The simulation. The canvas reads from it; nothing else writes to it. */
  const simRef = React.useRef(createAntState());
  const sprayCooldownRef = React.useRef(0);
  /** Held so a restart can start it again — it stops when the cake falls. */
  const loopRef = React.useRef<GameLoop | null>(null);
  const bugsRef = React.useRef<Bug[]>([]);
  const splattersRef = React.useRef<Splatter[]>([]);
  const floatingTextsRef = React.useRef<FloatingText[]>([]);
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

  /*
   * One clock for the whole game.
   *
   * This ran on three: a 550ms `setInterval` spawning bugs, the rAF loop below
   * moving them, and a third `setInterval` counting the spray cooldown. rAF
   * stops in a background tab and `setInterval` does not, so switching away and
   * back returned the player to a screen full of bugs that had spawned but
   * never moved.
   *
   * The spawn interval was also hardcoded, so despite the wave badge the swarm
   * never actually thickened. It now comes from the shared difficulty ramp.
   */
  React.useEffect(() => {
    const loop = new GameLoop({
      update: (dt) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const sim = simRef.current;

        stepAnts(sim, dt, {
          width: canvas.width,
          height: canvas.height,
          spawnIntervalMs: runRef.current.spawnInterval(550),
          wave: waveAt(runRef.current.elapsed),
          rng: Math.random,
        });

        // The render loop reads this array directly.
        bugsRef.current = sim.bugs;

        if (sim.events.reachedCake > 0) {
          setCakeHealth(sim.cakeHealth);
          for (let i = 0; i < sim.events.reachedCake; i++) runRef.current.miss();
          // A bug reaching the cake is the mistake that matters here.
          juiceRef.current.impact("heavy");
        }
        if (sim.sprayCooldown !== sprayCooldownRef.current) {
          sprayCooldownRef.current = sim.sprayCooldown;
          setSprayCooldown(Math.ceil(sim.sprayCooldown));
        }
        if (sim.events.chainBroken) runRef.current.miss();
        if (sim.events.died) {
          setGameOver(true);
          runRef.current.end();
          juiceRef.current.impact("fatal");
          loop.stop();
        }
      },
    });
    loopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      loopRef.current = null;
    };
  }, []);


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
        // Draw only. Movement, spawning and cake damage all happen in the
        // simulation step above — this loop used to do all four at once, on a
        // clock that was not the same one the spawner used.
        for (let i = bugsRef.current.length - 1; i >= 0; i--) {
          const bug = bugsRef.current[i]!;

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

    // The hit test, the hp bookkeeping and the removal all live in the
    // simulation now; this handler is only responsible for the feedback.
    const { hit, killed } = swat(simRef.current, x, y);
    bugsRef.current = simRef.current.bugs;

    if (killed) {
      splattersRef.current.push({
        x: killed.x,
        y: killed.y,
        color:
          killed.type === "fire"
            ? "#f43f5e"
            : killed.type === "golden"
              ? "#facc15"
              : killed.type === "beetle"
                ? "#84cc16"
                : "#0284c7",
        radius: killed.size * 0.9,
        opacity: 0.9,
        createdAt: Date.now(),
      });
      const basePts = BUG_KINDS[killed.type].points;
      const combo = runRef.current.combo;
      const awarded = pointsFor(basePts, combo + 1);
      runRef.current.hit(basePts);
      // A queen is worth noticing; a worker ant is not.
      juiceRef.current.impact(
        killed.type === "queen" || killed.type === "golden" ? "solid" : "tap",
      );
      floatingTextsRef.current.push({
        id: nextTextId.current++,
        x: killed.x,
        y: killed.y,
        text: `+${awarded}${combo > 2 ? ` 🔥x${combo}` : ""}`,
        color: killed.type === "golden" ? "#facc15" : "#38bdf8",
        opacity: 1,
        yOffset: 0,
      });
      playSquishSound(1 + Math.min(1, combo * 0.1));
      setScreenShake(killed.type === "queen" ? 4 : 1.5);
    } else if (hit) {
      floatingTextsRef.current.push({
        id: nextTextId.current++,
        x,
        y,
        text: "HIT!",
        color: "#f97316",
        opacity: 1,
        yOffset: 0,
      });
      playSquishSound(0.7);
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
    const cleared = fireSpray(simRef.current);
    if (cleared === null) return;
    setSprayCooldown(SPRAY_COOLDOWN);
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
    // The spray clears the screen; it should not also build a chain the player
    // did not earn one bug at a time.
    for (let i = 0; i < clearedCount; i++) runRef.current.hit(30);
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

  const restartGame = () => {
    run.reset();
    // A fresh simulation, and the loop started again — it stops itself when
    // the cake falls, so without this a restart would leave a dead game.
    simRef.current = createAntState();
    sprayCooldownRef.current = 0;
    setSprayCooldown(0);
    setCakeHealth(START_HEALTH);
    setGameOver(false);
    bugsRef.current = [];
    splattersRef.current = [];
    floatingTextsRef.current = [];
    loopRef.current?.start();
  };

  return (
    <div
          {...juice.shakeProps}
          className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none">
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
          {/*
            * The wave, shown.
            *
            * The difficulty ramp already existed but was invisible, and
            * escalation a player cannot see reads as the game quietly becoming
            * unfair rather than as something they are surviving.
            */}
          <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-1.5 backdrop-blur-md">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">Wave</div>
            <div className="numeric text-lg font-black leading-none text-white tabular-nums sm:text-xl">
              {waveAt(run.elapsed)}
            </div>
          </div>
          <ArcadeHud run={run} />
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
                {formatScore(run.score)}
              </span>
              {run.isNewBest ? (
                <span className="mt-1 block text-xs font-black uppercase tracking-widest text-amber-300">
                  New best!
                </span>
              ) : run.best > 0 ? (
                <span className="mt-1 block text-xs text-white/60">
                  Best {formatScore(run.best)}
                </span>
              ) : null}
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
