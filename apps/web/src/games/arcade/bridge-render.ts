/**
 * Canvas renderer for Bridge Builder.
 *
 * Draws one frame from plain data — the level, the design, the live simulation
 * when a test is running — so the view decides *what* to show and this decides
 * only *how*. World coordinates are 500 x 300; the viewport letterboxes them
 * and the sky, rock and water run on past the edges so no bars ever show.
 */

import {
  groundYAt,
  MATERIALS,
  stressColor,
  type Design,
  type MaterialType,
  type Sim,
} from "./bridge-builder";
import type { BridgeLevel, Point, Polygon, VehicleDef } from "./bridge-levels";

export const WORLD_W = 500;
export const WORLD_H = 300;

export interface Viewport {
  /** CSS pixels per world unit. */
  scale: number;
  /** CSS pixel offset of world (0, 0). */
  ox: number;
  oy: number;
  width: number;
  height: number;
  dpr: number;
}

/** The part of a level that matters for building: anchors, pylons, the gap. */
export interface Focus {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function focusFor(level: BridgeLevel): Focus {
  const xs = level.anchors.map((a) => a.x);
  const ys = [...level.anchors.map((a) => a.y), ...(level.pylons ?? []).map((p) => p.topY)];
  return {
    x0: Math.min(...xs) - 30,
    x1: Math.max(...xs) + 30,
    y0: Math.min(...ys) - 30,
    y1: level.waterY + 8,
  };
}

/** Room kept clear at the top of the stage for the budget and stress panels. */
const HUD_TOP = 64;

export function computeViewport(
  width: number,
  height: number,
  dpr: number,
  focus?: Focus
): Viewport {
  if (!focus) {
    const scale = Math.max(0.5, Math.min(width / (WORLD_W + 10), height / (WORLD_H - 20)));
    return {
      scale,
      ox: (width - WORLD_W * scale) / 2,
      oy: (height - WORLD_H * scale) / 2,
      width,
      height,
      dpr,
    };
  }
  const fw = focus.x1 - focus.x0;
  const fh = focus.y1 - focus.y0;
  const usable = Math.max(1, height - HUD_TOP);
  // The whole scene when there is room for it: the vehicle's run-up and the
  // flag are part of the story. Never let the build site slide under the HUD.
  const full = Math.min(width / (WORLD_W + 10), usable / fh);
  if (full >= 1.4) {
    const spare = Math.max(0, usable - fh * full);
    // Spare height goes mostly above: sky to build into, not more river.
    const oy = HUD_TOP - focus.y0 * full + spare * 0.7;
    return { scale: full, ox: (width - WORLD_W * full) / 2, oy, width, height, dpr };
  }
  // A narrow screen: zoom to the build site so joints stay big enough to tap.
  const scale = Math.max(full, Math.min(width / fw, usable / fh));
  const cx = (focus.x0 + focus.x1) / 2;
  const cy = (focus.y0 + focus.y1) / 2;
  const oy = Math.max(HUD_TOP - focus.y0 * scale, height * 0.52 - cy * scale);
  return { scale, ox: width / 2 - cx * scale, oy, width, height, dpr };
}

export function toWorld(vp: Viewport, sx: number, sy: number): Point {
  return { x: (sx - vp.ox) / vp.scale, y: (sy - vp.oy) / vp.scale };
}

export function toScreen(vp: Viewport, x: number, y: number): Point {
  return { x: vp.ox + x * vp.scale, y: vp.oy + y * vp.scale };
}

export interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export interface BeamPreview {
  a: Point;
  b: Point;
  ok: boolean;
  material: MaterialType;
  label: string;
  mirror?: { a: Point; b: Point } | null;
}

export interface RenderInput {
  level: BridgeLevel;
  design: Design;
  sim: Sim | null;
  time: number;
  /** Colour beams by stress (live in a test, last peaks in build). */
  stressView: boolean;
  lastPeaks: Record<number, number>;
  /** Beam to call out: the first failure, or the one about to be deleted. */
  highlightBeam: number | null;
  highlightKind: "fail" | "delete" | null;
  hoverJoint: number | null;
  activeJoint: number | null;
  preview: BeamPreview | null;
  particles: FxParticle[];
  pulseAnchors: boolean;
  showGrid: boolean;
}

/* ------------------------------------------------------------------------ */

const BEAM_WIDTH: Record<MaterialType, number> = {
  road: 4.6,
  wood: 2.7,
  steel: 2.7,
  cable: 1.2,
};

function polyPath(ctx: CanvasRenderingContext2D, poly: Polygon): void {
  // Stretch edges that touch the world boundary out past the screen.
  const ext = (v: number, lo: number, hi: number) =>
    v <= lo ? lo - 4000 : v >= hi ? hi + 4000 : v;
  ctx.beginPath();
  poly.forEach(([x, y], i) => {
    const px = ext(x, 0, WORLD_W);
    const py = y >= WORLD_H ? WORLD_H + 4000 : y;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function ridge(x: number, seed: number): number {
  return (
    Math.sin(x * 0.013 + seed) * 18 +
    Math.sin(x * 0.031 + seed * 2.1) * 9 +
    Math.sin(x * 0.071 + seed * 3.7) * 4
  );
}

function drawBackdrop(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const sky = ctx.createLinearGradient(0, -200, 0, input.level.waterY);
  sky.addColorStop(0, "#0b3a6e");
  sky.addColorStop(0.45, "#3b82c4");
  sky.addColorStop(0.85, "#a5d3f0");
  sky.addColorStop(1, "#e8f4fb");
  ctx.fillStyle = sky;
  ctx.fillRect(-4000, -4000, 8500, 4000 + input.level.waterY + 5);

  // Sun glow.
  const sun = ctx.createRadialGradient(400, 40, 4, 400, 40, 120);
  sun.addColorStop(0, "rgba(255,244,214,0.9)");
  sun.addColorStop(0.15, "rgba(255,236,190,0.35)");
  sun.addColorStop(1, "rgba(255,236,190,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(250, -120, 300, 300);

  // Clouds drift slowly.
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 4; i++) {
    const x = ((i * 157 + input.time * (3 + i)) % 700) - 100;
    const y = 30 + i * 17;
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 14, y - 4, 16, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 12, y - 2, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Two layers of distant mountains for depth.
  const layers: Array<[number, number, string]> = [
    [150, 1.3, "rgba(59, 89, 135, 0.55)"],
    [195, 4.2, "rgba(40, 70, 96, 0.7)"],
  ];
  for (const [base, seed, color] of layers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-600, input.level.waterY);
    for (let x = -600; x <= 1100; x += 8) ctx.lineTo(x, base + ridge(x, seed) - 30);
    ctx.lineTo(1100, input.level.waterY);
    ctx.closePath();
    ctx.fill();
  }

  // Pine silhouettes along the far bank.
  ctx.fillStyle = "rgba(22, 50, 52, 0.75)";
  for (let i = -20; i < 60; i++) {
    const x = i * 11 + ((i * 37) % 7);
    const base = 236 + Math.sin(i * 1.7) * 4;
    const hgt = 14 + ((i * 53) % 9);
    ctx.beginPath();
    ctx.moveTo(x - 4, base);
    ctx.lineTo(x, base - hgt);
    ctx.lineTo(x + 4, base);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWater(ctx: CanvasRenderingContext2D, input: RenderInput, front: boolean): void {
  const y0 = input.level.waterY;
  const t = input.time;
  if (!front) {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 60);
    g.addColorStop(0, "#1f78b4");
    g.addColorStop(1, "#0b2a4a");
    ctx.fillStyle = g;
    ctx.fillRect(-4000, y0, 8500, 4000);
    return;
  }
  // Translucent front sheet and moving highlights.
  ctx.fillStyle = "rgba(56, 152, 214, 0.35)";
  ctx.beginPath();
  ctx.moveTo(-4000, y0 + 3);
  for (let x = -40; x <= 540; x += 6) ctx.lineTo(x, y0 + Math.sin(x * 0.06 + t * 1.6) * 1.2);
  ctx.lineTo(4500, y0 + 3);
  ctx.lineTo(4500, y0 + 4000);
  ctx.lineTo(-4000, y0 + 4000);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(220, 240, 255, 0.7)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = -40; x <= 540; x += 6) {
    const y = y0 + Math.sin(x * 0.06 + t * 1.6) * 1.2;
    if (x === -40) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  for (let i = 0; i < 14; i++) {
    const x = ((i * 47 + t * 9) % 560) - 30;
    const y = y0 + 8 + ((i * 13) % 20);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8, y);
    ctx.stroke();
  }
}

function drawTerrain(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  for (const poly of input.level.terrain) {
    const g = ctx.createLinearGradient(0, 100, 0, 300);
    g.addColorStop(0, "#8b7355");
    g.addColorStop(0.35, "#6b5a45");
    g.addColorStop(1, "#3b3128");
    ctx.fillStyle = g;
    polyPath(ctx, poly);
    ctx.fill();

    // Rock strata, clipped to the polygon.
    ctx.save();
    polyPath(ctx, poly);
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.13)";
    ctx.lineWidth = 1;
    for (let y = 120; y < 320; y += 9) {
      ctx.beginPath();
      for (let x = -40; x <= 540; x += 10) {
        const yy = y + Math.sin(x * 0.08 + y) * 1.5;
        if (x === -40) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Grass on the walkable tops, a road on the approach.
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i]!;
      const [x2, y2] = poly[(i + 1) % poly.length]!;
      if (Math.abs(y2 - y1) > Math.abs(x2 - x1) * 0.4) continue;
      if (Math.min(y1, y2) >= WORLD_H - 1) continue; // the buried base, not a surface
      const ext = (v: number) => (v <= 0 ? -4000 : v >= WORLD_W ? WORLD_W + 4000 : v);
      ctx.strokeStyle = "#4d7c3a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ext(x1), y1 + 1.2);
      ctx.lineTo(ext(x2), y2 + 1.2);
      ctx.stroke();
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(ext(x1), y1 - 0.2);
      ctx.lineTo(ext(x2), y2 - 0.2);
      ctx.stroke();
    }
  }
}

function drawPylons(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  for (const p of input.level.pylons ?? []) {
    const w = 5;
    ctx.fillStyle = "#3f4a5a";
    ctx.fillRect(p.x - w / 2, p.topY, w, p.baseY - p.topY);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let y = p.topY + 4; y < p.baseY - 2; y += 8) {
      ctx.moveTo(p.x - w / 2, y);
      ctx.lineTo(p.x + w / 2, y + 8);
      ctx.moveTo(p.x + w / 2, y);
      ctx.lineTo(p.x - w / 2, y + 8);
    }
    ctx.stroke();
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(p.x - 5, p.topY - 2, 10, 3);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, input: RenderInput, vp: Viewport): void {
  const dot = Math.max(0.35, 0.9 / vp.scale);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let x = 0; x <= WORLD_W; x += 10) {
    for (let y = 10; y < input.level.waterY - 5; y += 10) {
      const major = x % 50 === 0 && y % 50 === 0;
      const r = major ? dot * 1.6 : dot;
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, groundY: number, t: number): void {
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x, groundY - 26);
  ctx.stroke();
  const s = 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const wave = Math.sin(t * 4 + c * 0.9) * 0.8;
      ctx.fillStyle = (r + c) % 2 === 0 ? "#111827" : "#f9fafb";
      ctx.fillRect(x + c * s, groundY - 26 + r * s + wave * (c / 4), s, s);
    }
  }
}

function drawBeamShape(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  material: MaterialType,
  override: string | null
): void {
  const w = BEAM_WIDTH[material];
  ctx.lineCap = "round";
  const line = (color: string, width: number, dash?: number[]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  };
  switch (material) {
    case "road":
      line("#111827", w);
      line(override ?? "#4b5563", w - 1.3);
      if (!override) line("#facc15", 0.35, [2.5, 2.5]);
      break;
    case "wood":
      line("#5b3413", w);
      line(override ?? "#c98a46", w - 1);
      if (!override) line("rgba(255,230,190,0.35)", 0.4);
      break;
    case "steel":
      line("#1e293b", w);
      line(override ?? "#8aa1bd", w - 1);
      if (!override) line("rgba(255,255,255,0.45)", 0.45);
      break;
    case "cable":
      line("#0f172a", w);
      line(override ?? "#e2e8f0", w - 0.55);
      break;
  }
  ctx.setLineDash([]);
}

function jointPositions(input: RenderInput): Map<number, Point> {
  const pos = new Map<number, Point>();
  if (input.sim) {
    for (const [id, i] of input.sim.index) pos.set(id, input.sim.particles[i]!);
  } else {
    for (const j of input.design.joints) pos.set(j.id, j);
  }
  return pos;
}

function drawBeams(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  pos: Map<number, Point>
): void {
  const live = input.sim;
  const order: MaterialType[] = ["cable", "wood", "steel", "road"];
  const byId = new Map(live ? live.beams.map((b) => [b.id, b]) : []);

  for (const mat of order) {
    for (const beam of input.design.beams) {
      if (beam.material !== mat) continue;
      const a = pos.get(beam.a);
      const b = pos.get(beam.b);
      if (!a || !b) continue;
      const simBeam = byId.get(beam.id);
      if (simBeam?.broken) {
        // Two dangling stubs where the member let go.
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        ctx.globalAlpha = 0.85;
        drawBeamShape(
          ctx,
          a.x,
          a.y,
          a.x + dx * 0.32,
          a.y + dy * 0.32 + 3,
          beam.material,
          "#b91c1c"
        );
        drawBeamShape(
          ctx,
          b.x,
          b.y,
          b.x - dx * 0.32,
          b.y - dy * 0.32 + 3,
          beam.material,
          "#b91c1c"
        );
        ctx.globalAlpha = 1;
        continue;
      }
      let override: string | null = null;
      if (input.stressView) {
        const stress = simBeam ? simBeam.stress : input.lastPeaks[beam.id];
        if (stress !== undefined) override = stressColor(stress);
        if (simBeam && simBeam.material === "cable" && simBeam.force <= 0) override = "#64748b";
      }
      if (input.highlightBeam === beam.id) {
        ctx.save();
        ctx.shadowColor = input.highlightKind === "delete" ? "#f43f5e" : "#fb7185";
        ctx.shadowBlur = 12;
        drawBeamShape(
          ctx,
          a.x,
          a.y,
          b.x,
          b.y,
          beam.material,
          input.highlightKind === "delete" ? "#f43f5e" : (override ?? "#ef4444")
        );
        ctx.restore();
      } else {
        drawBeamShape(ctx, a.x, a.y, b.x, b.y, beam.material, override);
      }
    }
  }
}

function drawJoints(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  pos: Map<number, Point>,
  vp: Viewport
): void {
  const minR = 3.5 / vp.scale;
  for (const j of input.design.joints) {
    const p = pos.get(j.id);
    if (!p) continue;
    const hovered = input.hoverJoint === j.id || input.activeJoint === j.id;
    if (j.anchor) {
      const r = Math.max(3, minR * 1.3);
      if (input.pulseAnchors && !input.sim) {
        const k = (Math.sin(input.time * 4) + 1) / 2;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.25 + k * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 2 + k * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#7c2d12";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hovered ? "#fde047" : "#f97316";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7c2d12";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const r = Math.max(1.8, minR);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hovered ? "#fde047" : "#f8fafc";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hovered && !input.sim) {
      ctx.strokeStyle = "rgba(253, 224, 71, 0.9)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (j.anchor ? 5.5 : 4.2) + 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** Vehicle pose: wheel centres, from the sim or parked at the start. */
function vehiclePose(input: RenderInput): { rear: Point; front: Point; spin: number } {
  const v = input.level.vehicle;
  if (input.sim) {
    const s = input.sim;
    return {
      rear: s.particles[s.vehicle.rear]!,
      front: s.particles[s.vehicle.front]!,
      spin: s.vehicle.spin,
    };
  }
  const ground = groundYAt(input.level, input.level.startX);
  const y = ground - v.wheelRadius;
  return {
    rear: { x: input.level.startX - v.wheelbase / 2, y },
    front: { x: input.level.startX + v.wheelbase / 2, y },
    spin: 0,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, r: number, spin: number): void {
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(x, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.arc(x, 0, r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = r * 0.14;
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
    ctx.stroke();
  }
}

function drawBody(ctx: CanvasRenderingContext2D, v: VehicleDef): void {
  const L = v.length;
  const h = v.height;
  const glass = "#bfe3f5";
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  if (v.kind === "car") {
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.moveTo(-L / 2, -2);
    ctx.lineTo(-L / 2, -h * 0.55);
    ctx.lineTo(-L * 0.28, -h * 0.6);
    ctx.lineTo(-L * 0.18, -h);
    ctx.lineTo(L * 0.14, -h);
    ctx.lineTo(L * 0.28, -h * 0.6);
    ctx.lineTo(L / 2, -h * 0.5);
    ctx.lineTo(L / 2, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-L * 0.24, -h * 0.62);
    ctx.lineTo(-L * 0.16, -h * 0.92);
    ctx.lineTo(L * 0.12, -h * 0.92);
    ctx.lineTo(L * 0.24, -h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(L / 2 - 2, -h * 0.45, 2, 1.6);
  } else if (v.kind === "van") {
    ctx.fillStyle = v.color;
    roundRect(ctx, -L / 2, -h, L * 0.8, h - 2, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L * 0.3, -h);
    ctx.lineTo(L * 0.4, -h);
    ctx.lineTo(L / 2, -h * 0.5);
    ctx.lineTo(L / 2, -2);
    ctx.lineTo(L * 0.3, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(L * 0.33, -h * 0.92);
    ctx.lineTo(L * 0.39, -h * 0.92);
    ctx.lineTo(L * 0.47, -h * 0.52);
    ctx.lineTo(L * 0.33, -h * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(-L / 2, -h * 0.45, L * 0.8, 2.2);
    ctx.fillStyle = "#1e3a8a";
    ctx.font = `bold ${h * 0.3}px system-ui, sans-serif`;
    ctx.fillText("PLAYORA", -L * 0.42, -h * 0.58);
  } else {
    // Cargo box, then cab.
    ctx.fillStyle = "#e5e7eb";
    roundRect(ctx, -L / 2, -h * 1.05, L * 0.66, h * 0.98, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    for (let x = -L / 2 + 5; x < -L / 2 + L * 0.66; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, -h * 1.0);
      ctx.lineTo(x, -h * 0.12);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.moveTo(L * 0.18, -2);
    ctx.lineTo(L * 0.18, -h * 0.85);
    ctx.lineTo(L * 0.36, -h * 0.85);
    ctx.lineTo(L / 2, -h * 0.45);
    ctx.lineTo(L / 2, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(L * 0.3, -h * 0.78);
    ctx.lineTo(L * 0.35, -h * 0.78);
    ctx.lineTo(L * 0.46, -h * 0.48);
    ctx.lineTo(L * 0.3, -h * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(-L / 2, -3, L, 2);
  }
}

function drawVehicle(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const v = input.level.vehicle;
  const { rear, front, spin } = vehiclePose(input);
  const cx = (rear.x + front.x) / 2;
  const cy = (rear.y + front.y) / 2;
  const ang = Math.atan2(front.y - rear.y, front.x - rear.x);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // Soft shadow under the chassis.
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, v.wheelRadius, v.length * 0.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  drawBody(ctx, v);
  drawWheel(ctx, -v.wheelbase / 2, v.wheelRadius, spin);
  drawWheel(ctx, v.wheelbase / 2, v.wheelRadius, spin);
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  for (const p of input.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPreview(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const pv = input.preview;
  if (!pv) return;
  const draw = (a: Point, b: Point, alpha: number) => {
    ctx.globalAlpha = alpha;
    if (pv.ok) {
      drawBeamShape(ctx, a.x, a.y, b.x, b.y, pv.material, null);
    } else {
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = pv.ok ? "#fde047" : "#f43f5e";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  if (pv.mirror) draw(pv.mirror.a, pv.mirror.b, 0.4);
  draw(pv.a, pv.b, 0.85);
  // Reach circle: how far this material can span from the start joint.
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.arc(pv.a.x, pv.a.y, MATERIALS[pv.material].maxLength, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPreviewLabel(ctx: CanvasRenderingContext2D, vp: Viewport, input: RenderInput): void {
  const pv = input.preview;
  if (!pv || !pv.label) return;
  const mid = toScreen(vp, (pv.a.x + pv.b.x) / 2, (pv.a.y + pv.b.y) / 2);
  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  const w = ctx.measureText(pv.label).width + 14;
  const x = Math.max(4, Math.min(vp.width - w - 4, mid.x - w / 2));
  const y = Math.max(4, mid.y - 32);
  ctx.fillStyle = pv.ok ? "rgba(15, 23, 42, 0.85)" : "rgba(136, 19, 55, 0.92)";
  roundRect(ctx, x, y, w, 22, 11);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(pv.label, x + 7, y + 15);
}

export function drawScene(ctx: CanvasRenderingContext2D, vp: Viewport, input: RenderInput): void {
  const { dpr, scale, ox, oy } = vp;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, vp.width * dpr, vp.height * dpr);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

  drawBackdrop(ctx, input);
  drawWater(ctx, input, false);
  drawPylons(ctx, input);
  if (input.showGrid) drawGrid(ctx, input, vp);
  drawTerrain(ctx, input);

  const finishGround = groundYAt(input.level, input.level.finishX);
  drawFlag(ctx, input.level.finishX, finishGround, input.time);

  const pos = jointPositions(input);
  drawBeams(ctx, input, pos);
  drawVehicle(ctx, input);
  drawJoints(ctx, input, pos, vp);
  drawPreview(ctx, input);
  drawParticles(ctx, input);
  drawWater(ctx, input, true);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPreviewLabel(ctx, vp, input);
}
