"use client";

import * as React from "react";
import { Button, cn, focusRingClass } from "@playora/ui";
import { GameLoop } from "@playora/game-runtime";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Eraser,
  FlipHorizontal2,
  Lightbulb,
  Lock,
  Pencil,
  Play,
  Redo2,
  RotateCcw,
  Square,
  Star,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { GameShell, ShellIconButton } from "../../components/games/game-shell";
import { useAudioStore } from "../../lib/store/audio-store";
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud } from "./ArcadeHud";
import { useJuice } from "./use-juice";
import { bridgeAudio } from "./bridge-audio";
import {
  LEVELS,
  MATERIALS,
  MATERIAL_ORDER,
  canRedo,
  canUndo,
  checkPlacement,
  clearBridge,
  createBridgeState,
  currentLevel,
  designCost,
  findBeam,
  findJoint,
  parseDesign,
  placeBeam,
  redoBridge,
  removeBeam,
  removeJoint,
  resolvePoint,
  scoreFor,
  selectLevel,
  serializeDesign,
  setMirror,
  startTest,
  stepBridge,
  stopTest,
  stressColor,
  undoBridge,
  UNITS_PER_METRE,
  type BridgeState,
  type BuildPoint,
  type MaterialType,
} from "./bridge-builder";
import {
  computeViewport,
  drawScene,
  focusFor,
  toWorld,
  type BeamPreview,
  type FxParticle,
  type Viewport,
} from "./bridge-render";
import type { Point } from "./bridge-levels";

/* ------------------------------------------------------------------------ */
/* Persistence                                                              */
/* ------------------------------------------------------------------------ */

type Progress = Record<string, { stars: number; bestCost: number }>;

const PROGRESS_KEY = "playora:bridge-builder:progress:v1";
const designKey = (levelId: string) => `playora:bridge-builder:design:v1:${levelId}`;

// Every storage access is guarded: localStorage throws outright in some
// privacy modes and embedded contexts, and progress is a nicety, not a need.
function readProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Progress) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgress(p: Progress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function readDesign(levelId: string) {
  try {
    return parseDesign(window.localStorage.getItem(designKey(levelId)));
  } catch {
    return null;
  }
}

function writeDesign(s: BridgeState): void {
  try {
    window.localStorage.setItem(designKey(currentLevel(s).id), serializeDesign(s.design));
  } catch {
    /* ignore */
  }
}

function isUnlocked(progress: Progress, index: number): boolean {
  return index === 0 || (progress[LEVELS[index - 1]!.id]?.stars ?? 0) > 0;
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const metres = (units: number) => `${(units / UNITS_PER_METRE).toFixed(1)} m`;

/**
 * Where a beam drawn toward `world` should end: the joint or grid point under
 * the pointer, or — when that is out of reach — the grid point nearest the
 * pointer that the material can still span. Dragging past the limit then
 * draws the longest legal beam instead of refusing.
 */
function computeEnd(
  s: BridgeState,
  from: BuildPoint,
  world: Point,
  material: MaterialType,
  magnet: number
): BuildPoint {
  const max = MATERIALS[material].maxLength;
  const p = resolvePoint(s, world.x, world.y, magnet);
  if (Math.hypot(p.x - from.x, p.y - from.y) <= max + 0.01) return p;
  const dx = world.x - from.x;
  const dy = world.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = from.x + (dx / len) * max;
  const cy = from.y + (dy / len) * max;
  let best: Point | null = null;
  let bestD = Infinity;
  for (let gx = Math.floor(cx / 10) - 1; gx <= Math.ceil(cx / 10) + 1; gx++) {
    for (let gy = Math.floor(cy / 10) - 1; gy <= Math.ceil(cy / 10) + 1; gy++) {
      const x = gx * 10;
      const y = gy * 10;
      if (Math.hypot(x - from.x, y - from.y) > max + 0.01) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  if (!best) return p;
  const j = findJoint(s, best.x, best.y, 0.5);
  return { x: best.x, y: best.y, jointId: j ? j.id : null };
}

function failureCopy(s: BridgeState): { title: string; detail: string; tip: string } {
  const r = s.result!;
  if (r.firstBreak) {
    const name = MATERIALS[r.firstBreak.material].name;
    if (r.firstBreak.mode === "buckled") {
      return {
        title: `${name} buckled`,
        detail: `A ${name.toLowerCase()} member was crushed in compression${r.brokenCount > 1 ? `, and ${r.brokenCount - 1} more followed` : ""}.`,
        tip: "Long members buckle easily. Split it with an extra joint, brace it into triangles, or use steel.",
      };
    }
    return {
      title: `${name} snapped`,
      detail: `A ${name.toLowerCase()} member was pulled apart in tension${r.brokenCount > 1 ? `, and ${r.brokenCount - 1} more followed` : ""}.`,
      tip:
        r.firstBreak.material === "road"
          ? "Road alone sags like a rope. Support every road joint with triangles below, above, or cables."
          : "Share the load with more triangles, or use steel or cable where it pulls hardest.",
    };
  }
  if (r.reason === "stuck") {
    return {
      title: "Vehicle stuck",
      detail: "The vehicle couldn't climb the road surface.",
      tip: "Smooth out lips and steep bends in the road deck.",
    };
  }
  if (r.reason === "timeout") {
    return {
      title: "Out of time",
      detail: "The vehicle never reached the flag.",
      tip: "Check the road reaches the far bank.",
    };
  }
  return {
    title: "Into the river",
    detail: "The vehicle fell — the road doesn't reach the other side.",
    tip: "Join Road pieces end to end from bank to bank. Only Road can be driven on.",
  };
}

/**
 * `onDark` is for the result card, which sits over the canvas art in either
 * theme; the default follows the theme, for the level list.
 */
function Stars({
  count,
  size = "h-5 w-5",
  tone = "theme",
}: {
  count: number;
  size?: string;
  tone?: "theme" | "onDark";
}) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            size,
            i < count
              // Gold fill, with an outline that holds 3:1 on a white card,
              // where the gold alone is 1.7:1.
              ? "fill-badge-top text-reward"
              : tone === "onDark"
                ? "fill-white/10 text-white/25"
                : "fill-foreground/10 text-foreground/25"
          )}
        />
      ))}
    </div>
  );
}

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
  tone = "default",
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-10 min-w-10 flex-col items-center justify-center rounded-lg px-2 text-[10px] font-bold transition-colors duration-hover ease-out-expo",
        "disabled:cursor-not-allowed disabled:opacity-35",
        active
          ? tone === "danger"
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground"
          : "bg-foreground/[0.06] text-foreground/80 hover:bg-foreground/[0.12]"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* View                                                                     */
/* ------------------------------------------------------------------------ */

type Tool = "build" | "delete";

interface Interaction {
  /** Joint the next beam starts from. */
  from: BuildPoint | null;
  /** Tap-to-chain mode: each tap lays a beam and continues from its end. */
  chain: boolean;
  /** The current press started a fresh beam (vs. continuing a chain). */
  fresh: boolean;
  down: { x: number; y: number; id: number } | null;
  pointer: Point | null;
  hoverJoint: number | null;
  hoverBeam: number | null;
}

export function BridgeBuilderView({ onExit }: { onExit?: () => void }) {
  const run = useArcadeRun("bridge-builder");
  const muted = useAudioStore((s) => s.mixer.muted);
  const juice = useJuice();
  const runRef = React.useRef(run);
  runRef.current = run;
  const juiceRef = React.useRef(juice);
  juiceRef.current = juice;

  const stateRef = React.useRef<BridgeState | null>(null);
  if (stateRef.current === null) stateRef.current = createBridgeState(0);

  const [, setVersion] = React.useState(0);
  const refresh = React.useCallback(() => setVersion((v) => v + 1), []);

  const [screen, setScreen] = React.useState<"levels" | "play">("levels");
  const [progress, setProgress] = React.useState<Progress>({});
  const [material, setMaterial] = React.useState<MaterialType>("road");
  const [tool, setTool] = React.useState<Tool>("build");
  const [stressView, setStressView] = React.useState(true);
  const [showHint, setShowHint] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [toast, setToast] = React.useState<{ text: string; id: number } | null>(null);

  const materialRef = React.useRef(material);
  materialRef.current = material;
  const toolRef = React.useRef(tool);
  toolRef.current = tool;
  const stressRef = React.useRef(stressView);
  stressRef.current = stressView;
  const pausedRef = React.useRef(paused);
  pausedRef.current = paused;

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const vpRef = React.useRef<Viewport>(computeViewport(800, 480, 1));
  const sizeRef = React.useRef({ w: 800, h: 480, dpr: 1 });
  const fxRef = React.useRef<FxParticle[]>([]);
  const timeRef = React.useRef(0);
  const bankedRef = React.useRef<Record<string, number>>({});
  const ix = React.useRef<Interaction>({
    from: null,
    chain: false,
    fresh: false,
    down: null,
    pointer: null,
    hoverJoint: null,
    hoverBeam: null,
  });

  React.useEffect(() => {
    setProgress(readProgress());
    return () => bridgeAudio.setEngine(false);
  }, []);

  // Bridge Builder still synthesises through its own AudioContext, so the
  // global mute the shell's button drives is mirrored into it. Unmuting
  // mid-test brings the engine hum back rather than leaving it silent.
  React.useEffect(() => {
    bridgeAudio.setMuted(muted);
    const s = stateRef.current!;
    if (!muted && s.mode === "test" && !s.result && !pausedRef.current) {
      bridgeAudio.setEngine(true, 0.6);
    }
  }, [muted]);

  // Paused, the simulation freezes (the loop below skips its update) and the
  // engine hum stops; resuming a test that was still running restarts it.
  const onPauseChange = React.useCallback((next: boolean) => {
    pausedRef.current = next;
    setPaused(next);
    const s = stateRef.current!;
    if (next) bridgeAudio.setEngine(false);
    else if (s.mode === "test" && !s.result) bridgeAudio.setEngine(true, 0.6);
  }, []);

  const flash = React.useCallback((text: string) => {
    setToast({ text, id: Date.now() });
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const cancelChain = React.useCallback(() => {
    ix.current.from = null;
    ix.current.chain = false;
    ix.current.down = null;
  }, []);

  /* ---- Simulation loop -------------------------------------------------- */

  const onTestEvents = React.useCallback(
    (s: BridgeState) => {
      const ev = s.events;
      const sim = s.sim;
      if (!sim) return;
      for (const b of ev.broke) {
        bridgeAudio.playSnap(b.material);
        juiceRef.current.impact(b.material === "road" ? "heavy" : "solid");
        const beam = sim.beams.find((x) => x.id === b.beamId);
        if (beam) {
          const pa = sim.particles[beam.a]!;
          const pb = sim.particles[beam.b]!;
          for (let i = 0; i < 10; i++) {
            fxRef.current.push({
              x: (pa.x + pb.x) / 2,
              y: (pa.y + pb.y) / 2,
              vx: (Math.random() - 0.5) * 60,
              vy: -Math.random() * 40,
              life: 0.8,
              max: 0.8,
              size: 0.7 + Math.random() * 0.8,
              color: MATERIALS[b.material].color,
            });
          }
        }
      }
      if (ev.maxStress > 0.7) bridgeAudio.playCreak(ev.maxStress);
      if (ev.splash) {
        bridgeAudio.playSplash();
        const P = sim.particles;
        const x = (P[sim.vehicle.rear]!.x + P[sim.vehicle.front]!.x) / 2;
        const y = currentLevel(s).waterY;
        for (let i = 0; i < 40; i++) {
          fxRef.current.push({
            x: x + (Math.random() - 0.5) * 24,
            y,
            vx: (Math.random() - 0.5) * 70,
            vy: -40 - Math.random() * 90,
            life: 1.2,
            max: 1.2,
            size: 0.8 + Math.random() * 1.4,
            color: Math.random() < 0.5 ? "#e0f2fe" : "#7dd3fc",
          });
        }
      }
      if (ev.crossed || ev.failed) {
        bridgeAudio.setEngine(false);
        if (ev.crossed && s.result) {
          bridgeAudio.playSuccess();
          juiceRef.current.impact("solid");
          const level = currentLevel(s);
          const points = scoreFor(s);
          const prev = bankedRef.current[level.id] ?? 0;
          if (points > prev) {
            runRef.current.bank(points - prev);
            bankedRef.current[level.id] = points;
          }
          runRef.current.end();
          const r = s.result;
          setProgress((p) => {
            const old = p[level.id];
            const next: Progress = {
              ...p,
              [level.id]: {
                stars: Math.max(old?.stars ?? 0, r.stars),
                bestCost: Math.min(old?.bestCost ?? Infinity, r.cost),
              },
            };
            writeProgress(next);
            return next;
          });
        } else if (s.result?.firstBreak) {
          // Point at the culprit straight away.
          setStressView(true);
        }
        refresh();
      }
    },
    [refresh]
  );

  React.useEffect(() => {
    let frame = 0;
    const loop = new GameLoop(
      {
        update: (dt) => {
          if (pausedRef.current) return;
          timeRef.current += dt;
          const s = stateRef.current!;
          if (s.mode === "test") {
            stepBridge(s, dt);
            onTestEvents(s);
          }
          const fx = fxRef.current;
          for (const p of fx) {
            p.vy += 98 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
          }
          if (fx.length) fxRef.current = fx.filter((p) => p.life > 0);
        },
        render: () => {
          draw();
          // Live numbers during a test, a few times a second, not every frame.
          frame += 1;
          if (!pausedRef.current && stateRef.current?.mode === "test" && frame % 8 === 0) refresh();
        },
      },
      { runWhileHidden: false }
    );
    loop.start();
    return () => loop.stop();
    // `draw` reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTestEvents, refresh]);

  /* ---- Drawing ---------------------------------------------------------- */

  const buildPreview = (): BeamPreview | null => {
    const s = stateRef.current!;
    const st = ix.current;
    if (s.mode !== "build" || toolRef.current !== "build" || !st.from || !st.pointer) return null;
    const vp = vpRef.current;
    const end = computeEnd(s, st.from, st.pointer, materialRef.current, 14 / vp.scale);
    if (Math.abs(end.x - st.from.x) < 0.5 && Math.abs(end.y - st.from.y) < 0.5) return null;
    const check = checkPlacement(s, st.from, end, materialRef.current);
    const label = check.ok
      ? `${metres(check.length)} · ${money(check.cost)}`
      : (check.reason ?? "");
    const mirror =
      s.mirror && Math.abs(st.from.x - (500 - st.from.x)) + Math.abs(end.x - (500 - end.x)) > 1
        ? { a: { x: 500 - st.from.x, y: st.from.y }, b: { x: 500 - end.x, y: end.y } }
        : null;
    return { a: st.from, b: end, ok: check.ok, material: materialRef.current, label, mirror };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const s = stateRef.current;
    if (!canvas || !ctx || !s) return;
    const { w, h, dpr } = sizeRef.current;
    vpRef.current = computeViewport(w, h, dpr, focusFor(currentLevel(s)));
    const st = ix.current;
    const failBeam = s.result?.firstBreak?.beamId ?? null;
    const deleting = s.mode === "build" && toolRef.current === "delete" && st.hoverBeam !== null;
    drawScene(ctx, vpRef.current, {
      level: currentLevel(s),
      design: s.design,
      sim: s.sim,
      time: timeRef.current,
      stressView: stressRef.current,
      lastPeaks: s.lastPeaks,
      highlightBeam: deleting ? st.hoverBeam : s.mode === "build" ? failBeam : null,
      highlightKind: deleting ? "delete" : failBeam !== null ? "fail" : null,
      hoverJoint: s.mode === "build" ? st.hoverJoint : null,
      activeJoint: st.from?.jointId ?? null,
      preview: buildPreview(),
      particles: fxRef.current,
      pulseAnchors: s.design.beams.length === 0,
      showGrid: s.mode === "build",
    });
  };

  // Size the canvas to its box, at device resolution.
  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [screen]);

  /* ---- Actions ---------------------------------------------------------- */

  const afterEdit = React.useCallback(() => {
    writeDesign(stateRef.current!);
    refresh();
  }, [refresh]);

  const openLevel = React.useCallback(
    (index: number) => {
      const s = stateRef.current!;
      bridgeAudio.setEngine(false);
      selectLevel(s, index, readDesign(LEVELS[index]!.id));
      cancelChain();
      fxRef.current = [];
      setMaterial("road");
      setTool("build");
      setShowHint(index === 0);
      setScreen("play");
      refresh();
    },
    [cancelChain, refresh]
  );

  const toggleTest = React.useCallback(() => {
    const s = stateRef.current!;
    cancelChain();
    if (s.mode === "test") {
      stopTest(s);
      bridgeAudio.setEngine(false);
    } else {
      if (!s.design.beams.some((b) => b.material === "road")) {
        flash("Build some Road first — only Road can be driven on");
      }
      startTest(s);
      fxRef.current = [];
      bridgeAudio.setEngine(true, 0.6);
    }
    refresh();
  }, [cancelChain, flash, refresh]);

  const retest = React.useCallback(() => {
    const s = stateRef.current!;
    stopTest(s);
    startTest(s);
    fxRef.current = [];
    bridgeAudio.setEngine(true, 0.6);
    refresh();
  }, [refresh]);

  const editBridge = React.useCallback(() => {
    const s = stateRef.current!;
    stopTest(s);
    bridgeAudio.setEngine(false);
    refresh();
  }, [refresh]);

  const doUndo = React.useCallback(() => {
    cancelChain();
    undoBridge(stateRef.current!);
    afterEdit();
  }, [afterEdit, cancelChain]);

  const doRedo = React.useCallback(() => {
    cancelChain();
    redoBridge(stateRef.current!);
    afterEdit();
  }, [afterEdit, cancelChain]);

  const doClear = React.useCallback(() => {
    const s = stateRef.current!;
    if (s.mode !== "build" || s.design.beams.length === 0) return;
    cancelChain();
    clearBridge(s);
    bridgeAudio.playDelete();
    afterEdit();
    flash("Cleared — Undo brings it back");
  }, [afterEdit, cancelChain, flash]);

  const toggleMirror = React.useCallback(() => {
    const s = stateRef.current!;
    setMirror(s, !s.mirror);
    flash(s.mirror ? "Mirror on — beams copy across the centre" : "Mirror off");
    refresh();
  }, [flash, refresh]);

  const pickMaterial = React.useCallback((m: MaterialType) => {
    setMaterial(m);
    setTool("build");
  }, []);

  /* ---- Pointer input ---------------------------------------------------- */

  const worldFromEvent = (e: React.PointerEvent | React.MouseEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return toWorld(vpRef.current, e.clientX - rect.left, e.clientY - rect.top);
  };

  const updateHover = (world: Point) => {
    const s = stateRef.current!;
    const vp = vpRef.current;
    const j = findJoint(s, world.x, world.y, 14 / vp.scale);
    ix.current.hoverJoint = j ? j.id : null;
    const b =
      toolRef.current === "delete" && !j ? findBeam(s, world.x, world.y, 9 / vp.scale) : null;
    ix.current.hoverBeam = b ? b.id : null;
  };

  const deleteAt = (world: Point): boolean => {
    const s = stateRef.current!;
    const vp = vpRef.current;
    const j = findJoint(s, world.x, world.y, 12 / vp.scale);
    if (j && !j.anchor && removeJoint(s, j.id)) {
      bridgeAudio.playDelete();
      afterEdit();
      return true;
    }
    const b = findBeam(s, world.x, world.y, 9 / vp.scale);
    if (b && removeBeam(s, b.id)) {
      bridgeAudio.playDelete();
      ix.current.hoverBeam = null;
      afterEdit();
      return true;
    }
    return false;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current!;
    if (s.mode !== "build") return;
    const world = worldFromEvent(e);
    ix.current.pointer = world;
    updateHover(world);

    if (e.button === 2) {
      // Right click: cancel a chain, or delete what's under the cursor.
      if (ix.current.from) cancelChain();
      else deleteAt(world);
      return;
    }
    if (toolRef.current === "delete") {
      deleteAt(world);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    ix.current.down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    if (ix.current.from) {
      ix.current.fresh = false;
      return;
    }
    const j = findJoint(s, world.x, world.y, 16 / vpRef.current.scale);
    if (!j) {
      ix.current.down = null;
      flash("Start from a joint — orange anchors are bolted to the rock");
      return;
    }
    ix.current.from = { x: j.x, y: j.y, jointId: j.id };
    ix.current.fresh = true;
    ix.current.chain = false;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = worldFromEvent(e);
    ix.current.pointer = world;
    if (stateRef.current!.mode === "build") updateHover(world);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current!;
    const st = ix.current;
    if (!st.down || st.down.id !== e.pointerId || !st.from || s.mode !== "build") {
      st.down = null;
      return;
    }
    const moved = Math.hypot(e.clientX - st.down.x, e.clientY - st.down.y) > 8;
    st.down = null;
    const world = worldFromEvent(e);
    st.pointer = world;

    if (st.fresh && !moved) {
      // A tap on a joint starts chain mode: tap, tap, tap to lay a deck.
      st.chain = true;
      return;
    }

    const end = computeEnd(s, st.from, world, materialRef.current, 14 / vpRef.current.scale);
    if (Math.abs(end.x - st.from.x) < 0.5 && Math.abs(end.y - st.from.y) < 0.5) {
      cancelChain();
      return;
    }
    const check = checkPlacement(s, st.from, end, materialRef.current);
    if (!check.ok) {
      flash(check.reason ?? "Can't build there");
      if (!st.chain) cancelChain();
      return;
    }
    placeBeam(s, st.from, end, materialRef.current);
    bridgeAudio.playPlaceMember(materialRef.current);
    if (st.chain) {
      const j = findJoint(s, end.x, end.y, 0.5);
      st.from = j ? { x: j.x, y: j.y, jointId: j.id } : null;
      if (!st.from) st.chain = false;
    } else {
      cancelChain();
    }
    afterEdit();
  };

  const onPointerLeave = () => {
    if (!ix.current.chain && !ix.current.down) ix.current.pointer = null;
    ix.current.hoverJoint = null;
    ix.current.hoverBeam = null;
  };

  /* ---- Keyboard --------------------------------------------------------- */

  React.useEffect(() => {
    if (screen !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      // The pause menu is up: Space must not run a test behind it.
      if (pausedRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        doRedo();
        return;
      }
      if (mod) return;
      if (k === " " || k === "enter") {
        e.preventDefault();
        toggleTest();
      } else if (k >= "1" && k <= "4") {
        pickMaterial(MATERIAL_ORDER[Number(k) - 1]!);
      } else if (k === "d" || k === "x" || k === "delete" || k === "backspace") {
        setTool((t) => (t === "delete" ? "build" : "delete"));
        cancelChain();
      } else if (k === "m") {
        toggleMirror();
      } else if (k === "s") {
        setStressView((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, cancelChain, doRedo, doUndo, pickMaterial, toggleMirror, toggleTest]);

  // Escape cancels a beam being drawn; with nothing to cancel, the shell
  // takes it and pauses.
  const onEscape = React.useCallback(() => {
    if (screen !== "play" || !ix.current.from) return false;
    cancelChain();
    return true;
  }, [screen, cancelChain]);

  /* ---- Render ----------------------------------------------------------- */

  const s = stateRef.current;
  const level = currentLevel(s);
  const cost = designCost(s.design);
  const testing = s.mode === "test";
  const result = s.result;
  const done = testing && !!result;
  const levelIndex = s.levelIndex;
  const hasNext = levelIndex < LEVELS.length - 1;
  const nextUnlocked = hasNext && (isUnlocked(progress, levelIndex + 1) || !!result?.success);
  const liveStress = s.sim
    ? Math.max(0, ...s.sim.beams.filter((b) => !b.broken).map((b) => b.stress))
    : 0;
  const peakSoFar = s.sim ? Math.max(0, ...s.sim.beams.map((b) => b.peak)) : 0;
  const brokenSoFar = s.sim ? s.sim.beams.filter((b) => b.broken).length : 0;
  const shownStress =
    testing && !done
      ? liveStress
      : (result?.peakStress ?? Math.max(0, ...Object.values(s.lastPeaks)));
  const budgetPct = Math.min(100, (cost / level.maxBudget) * 100);
  const targetPct = (level.targetBudget / level.maxBudget) * 100;
  const roadCount = s.design.beams.filter((b) => b.material === "road").length;
  const coach =
    !testing && levelIndex === 0 && s.design.beams.length < 3
      ? roadCount === 0
        ? "Drag from an orange anchor to the right to lay Road. Or tap a joint, then tap, tap, tap."
        : null
      : !testing && levelIndex === 0 && roadCount >= 3 && s.design.beams.length === roadCount
        ? "Road alone will sag. Pick Wood (2) and brace each road joint down to the lower anchors."
        : null;

  const exit = onExit ?? (() => window.history.back());
  const shell = {
    gameId: "bridge-builder",
    title: "Bridge Builder",
    onExit: exit,
    // Designs save as they are drawn and stars as they are earned, so leaving
    // never throws anything away and needs no confirmation.
    matchInProgress: false,
    paused,
    onPauseChange,
    onEscape,
  } as const;

  if (screen === "levels") {
    const totalStars = LEVELS.reduce((n, l) => n + (progress[l.id]?.stars ?? 0), 0);
    return (
      <GameShell
        {...shell}
        subtitle="Structural engineering"
        autoPauseOnHidden={false}
        status={
          <div className="flex h-8 items-center gap-1.5 rounded-full border border-reward/40 bg-reward/10 px-3 text-sm font-bold">
            <Star className="h-4 w-4 fill-badge-top text-reward" aria-hidden />
            <span className="font-mono-num">
              {totalStars}/{LEVELS.length * 3}
            </span>
            <span className="sr-only">stars</span>
          </div>
        }
      >
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
            Get the vehicle to the flag. Lay road between the anchors, brace it with wood, steel and
            cable, then run a test and watch the stress. Stars for crossing, staying under the
            target budget, and keeping stress low.
          </p>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {LEVELS.map((l, i) => {
              const unlocked = isUnlocked(progress, i);
              const p = progress[l.id];
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => openLevel(i)}
                  className={cn(
                    "group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left",
                    "transition-[transform,box-shadow,border-color] duration-hover ease-out-expo",
                    focusRingClass,
                    unlocked
                      ? "border-border bg-card shadow-card hover:-translate-y-0.5 hover:shadow-card-hover"
                      : "cursor-not-allowed border-border/50 bg-card/40 opacity-60"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-mono-num text-2xl font-bold text-foreground/90">
                      {i + 1}
                    </span>
                    {unlocked ? (
                      <Stars count={p?.stars ?? 0} size="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" aria-label="Locked" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold leading-tight text-foreground">{l.name}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{l.lesson}</p>
                  </div>
                  <div className="mt-auto flex w-full items-center justify-between pt-1 text-[11px] font-semibold text-muted-foreground">
                    <span>
                      {l.vehicle.name} · {l.vehicle.mass} t
                    </span>
                    <span className="font-mono-num">
                      {p ? `best ${money(p.bestCost)}` : money(l.targetBudget)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </GameShell>
    );
  }

  const fail = done && !result!.success ? failureCopy(s) : null;

  return (
    <GameShell
      {...shell}
      subtitle={`Level ${levelIndex + 1}: ${level.name} · ${level.vehicle.name} ${level.vehicle.mass} t`}
      status={<ArcadeHud run={run} size="sm" />}
      onBack={() => {
        editBridge();
        setScreen("levels");
      }}
      backLabel="Levels"
      // Only a running test is worth pausing for; a half-drawn design waits
      // without help, and a pause menu on every tab switch would nag.
      autoPauseOnHidden={testing && !done}
      actions={
        <ShellIconButton
          label="Hint"
          pressed={showHint}
          onClick={() => setShowHint((v) => !v)}
        >
          <Lightbulb className="h-5 w-5" aria-hidden />
        </ShellIconButton>
      }
    >
      {/* Stage */}
      <div
        ref={wrapRef}
        {...juice.shakeProps}
        className="relative min-h-0 flex-1 select-none overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 block touch-none",
            testing ? "cursor-default" : tool === "delete" ? "cursor-crosshair" : "cursor-pointer"
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => cancelChain()}
          onPointerLeave={onPointerLeave}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Bridge construction site"
          role="img"
        />

        {/* Budget */}
        <div className="pointer-events-none absolute left-2 top-2 w-[calc(50%-0.75rem)] rounded-xl sm:w-60 border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur-md sm:left-3 sm:top-3">
          <div className="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-widest text-white/55">
            <span>Budget</span>
            <span className="tabular-nums normal-case tracking-normal">
              <span
                className={cn(
                  "text-sm font-black",
                  cost > level.targetBudget ? "text-amber-300" : "text-emerald-300"
                )}
              >
                {money(cost)}
              </span>{" "}
              / {money(level.maxBudget)}
            </span>
          </div>
          <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-200",
                cost > level.targetBudget ? "bg-amber-400" : "bg-emerald-400"
              )}
              style={{ width: `${budgetPct}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-white/80"
              style={{ left: `${targetPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-white/50">
            <Star className="mr-0.5 inline h-2.5 w-2.5 fill-amber-400 text-amber-400" aria-hidden />
            under {money(level.targetBudget)}
          </p>
        </div>

        {/* Live stress / legend */}
        {(testing || (stressView && Object.keys(s.lastPeaks).length > 0)) && (
          <div className="pointer-events-none absolute right-2 top-2 w-[calc(50%-0.75rem)] rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur-md sm:right-3 sm:top-3 sm:w-44">
            <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-white/55">
              <span className="truncate">{testing && !done ? "Stress" : "Peak stress"}</span>
              <span
                className="text-sm font-black tabular-nums"
                style={{ color: stressColor(shownStress) }}
              >
                {Math.round(100 * Math.min(1, shownStress))}%
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${stressColor(0)}, ${stressColor(0.5)}, ${stressColor(1)})`,
              }}
            />
            {testing && !done && peakSoFar > 0 && (
              <p className="mt-1 text-right text-[10px] font-semibold text-white/50 tabular-nums">
                peak {Math.round(100 * peakSoFar)}%
                {brokenSoFar > 0 ? ` · ${brokenSoFar} broken` : ""}
              </p>
            )}
          </div>
        )}

        {/* Coach / hint */}
        {(coach || showHint) && !testing && (
          <div className="pointer-events-auto absolute inset-x-2 bottom-2 mx-auto flex max-w-xl items-start gap-2 rounded-xl border border-amber-300/30 bg-slate-950/80 px-3 py-2 text-xs leading-snug text-amber-50 backdrop-blur-md sm:bottom-3 sm:text-sm">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <p className="flex-1">{coach ?? level.hint}</p>
            {showHint && !coach && (
              <button
                type="button"
                onClick={() => setShowHint(false)}
                aria-label="Close hint"
                className="text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 animate-in fade-in rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-white/15 sm:top-4"
          >
            {toast.text}
          </div>
        )}

        {/* Result: compact, so the bridge it judges stays in view */}
        {done && result && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-2 sm:items-start sm:p-3">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-slate-950/95 p-3.5 shadow-2xl ring-1 ring-black/40 sm:p-4">
              {result.success ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-black leading-tight text-emerald-300">
                        Bridge holds!
                      </h3>
                      <p className="text-xs font-semibold text-white/50">
                        +{scoreFor(s).toLocaleString("en-US")} points
                      </p>
                    </div>
                    <Stars count={result.stars} size="h-7 w-7" tone="onDark" />
                  </div>
                  <ul className="mt-2.5 grid gap-1 text-[13px]">
                    {(
                      [
                        [result.starDetails.crossed, `${level.vehicle.name} reached the flag`],
                        [
                          result.starDetails.underBudget,
                          `Cost ${money(result.cost)} · target ${money(level.targetBudget)}`,
                        ],
                        [
                          result.starDetails.lowStress,
                          `Peak stress ${Math.round(result.peakStress * 100)}% · aim ≤ ${Math.round(level.stressStar * 100)}%`,
                        ],
                      ] as const
                    ).map(([ok, text]) => (
                      <li key={text} className="flex items-center gap-2">
                        <Star
                          aria-hidden
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            ok ? "fill-amber-400 text-amber-400" : "text-white/30"
                          )}
                        />
                        <span className={ok ? "text-white" : "text-white/55"}>{text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h3 className="font-display text-xl font-black leading-tight text-rose-400">
                    {fail!.title}
                  </h3>
                  <p className="mt-1 text-[13px] text-white/75">{fail!.detail}</p>
                  <p className="mt-2 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-xs leading-snug text-amber-100">
                    <Lightbulb className="mr-1 inline h-3.5 w-3.5 text-amber-300" aria-hidden />
                    {fail!.tip}
                  </p>
                </>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={editBridge}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold",
                    result.success
                      ? "border border-white/15 text-white/85 hover:bg-white/10"
                      : "bg-sky-500 text-white hover:bg-sky-400"
                  )}
                >
                  <Pencil className="h-4 w-4" /> {result.success ? "Improve" : "Fix bridge"}
                </button>
                <button
                  type="button"
                  onClick={retest}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-white/85 hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4" /> Retest
                </button>
                {result.success && hasNext && nextUnlocked && (
                  <button
                    type="button"
                    onClick={() => openLevel(levelIndex + 1)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-black text-white hover:bg-emerald-400"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                {result.success && !hasNext && (
                  <button
                    type="button"
                    onClick={() => setScreen("levels")}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-black text-white hover:bg-emerald-400"
                  >
                    <ChevronLeft className="h-4 w-4" /> Levels
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-2 py-2 sm:px-4">
        <div
          className="flex min-w-0 items-center gap-1 sm:gap-1.5"
          role="radiogroup"
          aria-label="Material"
        >
          {MATERIAL_ORDER.map((m, i) => {
            const def = MATERIALS[m];
            const active = tool === "build" && material === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={testing}
                onClick={() => pickMaterial(m)}
                title={`${def.name} (${i + 1}) — ${def.blurb} Max ${def.maxLength / UNITS_PER_METRE} m`}
                className={cn(
                  "flex h-11 items-center gap-1.5 rounded-lg border px-2 text-left transition-colors duration-hover ease-out-expo sm:px-2.5",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                  active
                    ? "border-primary bg-primary/15"
                    : "border-border bg-card hover:bg-raised"
                )}
              >
                <span
                  className="h-5 w-1.5 shrink-0 rounded-full ring-1 ring-foreground/20"
                  style={{ background: def.color }}
                  aria-hidden
                />
                <span className="flex flex-col leading-none">
                  <span className="text-xs font-extrabold">{def.name}</span>
                  <span className="mt-0.5 font-mono-num text-[10px] font-semibold text-muted-foreground">
                    {money(def.costPerUnit * UNITS_PER_METRE)}/m
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <ToolButton
            label="Delete"
            shortcut="D"
            tone="danger"
            active={tool === "delete"}
            disabled={testing}
            onClick={() => {
              setTool((t) => (t === "delete" ? "build" : "delete"));
              cancelChain();
            }}
          >
            <Eraser className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Mirror"
            shortcut="M"
            active={s.mirror}
            disabled={testing}
            onClick={toggleMirror}
          >
            <FlipHorizontal2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Stress view"
            shortcut="S"
            active={stressView}
            onClick={() => setStressView((v) => !v)}
          >
            <Activity className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Undo" shortcut="Ctrl+Z" disabled={!canUndo(s)} onClick={doUndo}>
            <Undo2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={!canRedo(s)} onClick={doRedo}>
            <Redo2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Clear"
            disabled={testing || s.design.beams.length === 0}
            onClick={doClear}
          >
            <Trash2 className="h-4 w-4" />
          </ToolButton>
          {/* The screen's one launch action, so it wears the green Play colour. */}
          <Button
            type="button"
            variant={testing ? "destructive" : "play"}
            onClick={toggleTest}
            title={testing ? "Stop (Space)" : "Run test (Space)"}
            aria-keyshortcuts="Space"
            className="ml-1 h-11 px-4 font-extrabold sm:px-5"
          >
            {testing ? (
              <Square className="h-4 w-4 fill-current" aria-hidden />
            ) : (
              <Play className="h-4 w-4 fill-current" aria-hidden />
            )}
            {testing ? "Stop" : "Test"}
          </Button>
        </div>
      </div>
    </GameShell>
  );
}
