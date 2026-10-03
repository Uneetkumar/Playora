/**
 * Bridge Builder — design rules and structural simulation.
 *
 * Pure and deterministic: no DOM, no clock, no randomness. The view owns input
 * and drawing; everything that decides whether a bridge stands lives here, so
 * it can be tested.
 *
 * The simulation is XPBD (extended position-based dynamics). Every beam is a
 * distance constraint with a compliance derived from its material stiffness
 * and length, solved in small substeps. That makes stiff steel unconditionally
 * stable at 60 Hz, and the constraint multiplier gives each beam's actual axial
 * force — so stress is a real force over a real strength, not a guess.
 *
 *  - Tension and compression have separate strengths. Compression strength
 *    falls with length (Euler buckling), so long struts fail first and short,
 *    triangulated members are the right answer, as in real trusses.
 *  - Cables only pull: compressed, they go slack and carry nothing.
 *  - The vehicle is its own rigid body of four particles. Its wheels collide
 *    with road members and terrain, so its weight reaches the bridge through
 *    contact, wherever the wheels happen to be.
 */

import { LEVELS, type BridgeLevel, type Point, type Polygon } from "./bridge-levels";

export { LEVELS } from "./bridge-levels";
export type { BridgeLevel, VehicleDef, Point } from "./bridge-levels";

/* ------------------------------------------------------------------------ */
/* Materials                                                                */
/* ------------------------------------------------------------------------ */

export type MaterialType = "road" | "wood" | "steel" | "cable";

export interface MaterialDef {
  id: MaterialType;
  name: string;
  /** Dollars per world unit. */
  costPerUnit: number;
  /** Tonnes per world unit. */
  density: number;
  /** Axial stiffness EA. */
  stiffness: number;
  /** Axial force at which the member snaps in tension. */
  tension: number;
  /** Axial force at which a short member crushes; 0 for cables. */
  compression: number;
  /** Length beyond which compression strength falls off as 1/L². */
  buckleLength: number;
  maxLength: number;
  /** Wheels drive on it. */
  drivable: boolean;
  color: string;
  blurb: string;
}

export const MATERIALS: Record<MaterialType, MaterialDef> = {
  road: {
    id: "road",
    name: "Road",
    costPerUnit: 2,
    density: 0.014,
    stiffness: 70000,
    tension: 800,
    compression: 800,
    buckleLength: 50,
    maxLength: 40,
    drivable: true,
    color: "#475569",
    blurb: "Vehicles drive on it. Heavy.",
  },
  wood: {
    id: "wood",
    name: "Wood",
    costPerUnit: 1,
    density: 0.005,
    stiffness: 45000,
    tension: 900,
    compression: 900,
    buckleLength: 50,
    maxLength: 60,
    drivable: false,
    color: "#c2843f",
    blurb: "Cheap and light. Buckles when long.",
  },
  steel: {
    id: "steel",
    name: "Steel",
    costPerUnit: 2.5,
    density: 0.01,
    stiffness: 130000,
    tension: 2600,
    compression: 2600,
    buckleLength: 60,
    maxLength: 70,
    drivable: false,
    color: "#8aa1bd",
    blurb: "Strong both ways. Costly.",
  },
  cable: {
    id: "cable",
    name: "Cable",
    costPerUnit: 0.8,
    density: 0.0015,
    stiffness: 90000,
    tension: 2200,
    compression: 0,
    buckleLength: 1,
    maxLength: 220,
    drivable: false,
    color: "#e2e8f0",
    blurb: "Long and strong in tension only.",
  },
};

export const MATERIAL_ORDER: MaterialType[] = ["road", "wood", "steel", "cable"];

/** Force at which `material` fails in compression at this length. */
export function compressionStrength(material: MaterialType, length: number): number {
  const m = MATERIALS[material];
  if (m.compression <= 0) return 0;
  const r = m.buckleLength / Math.max(1, length);
  return m.compression * Math.min(1, r * r);
}

export function beamCost(material: MaterialType, length: number): number {
  return Math.round(length * MATERIALS[material].costPerUnit);
}

/* ------------------------------------------------------------------------ */
/* Design                                                                   */
/* ------------------------------------------------------------------------ */

export const GRID = 10;
export const MIN_BEAM = 10;
/** 10 world units per metre. */
export const UNITS_PER_METRE = 10;

export interface Joint {
  id: number;
  x: number;
  y: number;
  anchor: boolean;
}

export interface Beam {
  id: number;
  a: number;
  b: number;
  material: MaterialType;
}

export interface Design {
  joints: Joint[];
  beams: Beam[];
  nextId: number;
}

export function initialDesign(level: BridgeLevel): Design {
  return {
    joints: level.anchors.map((p, i) => ({ id: i + 1, x: p.x, y: p.y, anchor: true })),
    beams: [],
    nextId: level.anchors.length + 1,
  };
}

function cloneDesign(d: Design): Design {
  return {
    joints: d.joints.map((j) => ({ ...j })),
    beams: d.beams.map((b) => ({ ...b })),
    nextId: d.nextId,
  };
}

export function jointById(d: Design, id: number): Joint | undefined {
  return d.joints.find((j) => j.id === id);
}

export function beamLength(d: Design, beam: Beam): number {
  const a = jointById(d, beam.a);
  const b = jointById(d, beam.b);
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function designCost(d: Design): number {
  let sum = 0;
  for (const beam of d.beams) sum += beamCost(beam.material, beamLength(d, beam));
  return sum;
}

/* ------------------------------------------------------------------------ */
/* Geometry                                                                 */
/* ------------------------------------------------------------------------ */

export function snapToGrid(x: number, y: number, grid = GRID): Point {
  return { x: Math.round(x / grid) * grid, y: Math.round(y / grid) * grid };
}

export function pointInPolygon(x: number, y: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function onPolygonBoundary(x: number, y: number, poly: Polygon, eps = 0.5): boolean {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (distToSegment(x, y, poly[j]![0], poly[j]![1], poly[i]![0], poly[i]![1]) <= eps) return true;
  }
  return false;
}

/** Strictly inside solid terrain (the surface itself does not count). */
export function insideTerrain(level: BridgeLevel, x: number, y: number): boolean {
  for (const poly of level.terrain) {
    if (pointInPolygon(x, y, poly) && !onPolygonBoundary(x, y, poly)) return true;
  }
  return false;
}

/** True when the segment passes through rock rather than along or out of it. */
export function segmentBlocked(level: BridgeLevel, a: Point, b: Point): boolean {
  const samples = Math.max(4, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    if (insideTerrain(level, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return true;
  }
  return false;
}

/** Height of the highest terrain surface at x, or Infinity over open water. */
export function groundYAt(level: BridgeLevel, x: number): number {
  let best = Infinity;
  for (const poly of level.terrain) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [x1, y1] = poly[j]!;
      const [x2, y2] = poly[i]!;
      if (x < Math.min(x1, x2) || x > Math.max(x1, x2) || x1 === x2) continue;
      const y = y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
      if (y < best) best = y;
    }
  }
  return best;
}

/* ------------------------------------------------------------------------ */
/* State                                                                    */
/* ------------------------------------------------------------------------ */

export type FailReason = "fell" | "stuck" | "timeout";

export interface BridgeResult {
  success: boolean;
  reason?: FailReason;
  /** First member to give way, and how. */
  firstBreak?: { beamId: number; material: MaterialType; mode: "tension" | "buckled" };
  brokenCount: number;
  peakStress: number;
  cost: number;
  time: number;
  stars: number;
  starDetails: { crossed: boolean; underBudget: boolean; lowStress: boolean };
}

export interface BridgeEvents {
  /** Beams that broke this step. */
  broke: Array<{ beamId: number; material: MaterialType }>;
  crossed: boolean;
  failed: boolean;
  splash: boolean;
  /** Highest live stress this step, 0..1+. */
  maxStress: number;
}

export interface BridgeState {
  levelIndex: number;
  design: Design;
  history: Design[];
  historyIndex: number;
  mirror: boolean;
  mode: "build" | "test";
  sim: Sim | null;
  result: BridgeResult | null;
  /** Peak stress per beam id from the last test, for the stress view. */
  lastPeaks: Record<number, number>;
  events: BridgeEvents;
}

function noEvents(): BridgeEvents {
  return { broke: [], crossed: false, failed: false, splash: false, maxStress: 0 };
}

export function currentLevel(s: BridgeState): BridgeLevel {
  return LEVELS[s.levelIndex]!;
}

export function createBridgeState(levelIndex = 0, design?: Design | null): BridgeState {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
  const d =
    design && isDesignValidFor(LEVELS[idx]!, design)
      ? cloneDesign(design)
      : initialDesign(LEVELS[idx]!);
  return {
    levelIndex: idx,
    design: d,
    history: [cloneDesign(d)],
    historyIndex: 0,
    mirror: false,
    mode: "build",
    sim: null,
    result: null,
    lastPeaks: {},
    events: noEvents(),
  };
}

export function selectLevel(s: BridgeState, levelIndex: number, design?: Design | null): void {
  const next = createBridgeState(levelIndex, design);
  next.mirror = s.mirror;
  Object.assign(s, next);
}

function commit(s: BridgeState): void {
  s.history = s.history.slice(0, s.historyIndex + 1);
  s.history.push(cloneDesign(s.design));
  if (s.history.length > 200) s.history.shift();
  s.historyIndex = s.history.length - 1;
  s.result = null;
  s.lastPeaks = {};
}

export function canUndo(s: BridgeState): boolean {
  return s.mode === "build" && s.historyIndex > 0;
}

export function canRedo(s: BridgeState): boolean {
  return s.mode === "build" && s.historyIndex < s.history.length - 1;
}

export function undoBridge(s: BridgeState): void {
  if (!canUndo(s)) return;
  s.historyIndex -= 1;
  s.design = cloneDesign(s.history[s.historyIndex]!);
  s.result = null;
  s.lastPeaks = {};
}

export function redoBridge(s: BridgeState): void {
  if (!canRedo(s)) return;
  s.historyIndex += 1;
  s.design = cloneDesign(s.history[s.historyIndex]!);
  s.result = null;
  s.lastPeaks = {};
}

export function clearBridge(s: BridgeState): void {
  if (s.mode !== "build" || s.design.beams.length === 0) return;
  s.design = initialDesign(currentLevel(s));
  commit(s);
}

export function setMirror(s: BridgeState, on: boolean): void {
  s.mirror = on;
}

/* ------------------------------------------------------------------------ */
/* Building                                                                 */
/* ------------------------------------------------------------------------ */

/** A build endpoint: an existing joint, or a fresh grid point. */
export interface BuildPoint {
  x: number;
  y: number;
  jointId: number | null;
}

export function findJoint(s: BridgeState, x: number, y: number, radius: number): Joint | null {
  let best: Joint | null = null;
  let bestD = radius;
  for (const j of s.design.joints) {
    const d = Math.hypot(j.x - x, j.y - y);
    if (d <= bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

export function findBeam(s: BridgeState, x: number, y: number, radius: number): Beam | null {
  let best: Beam | null = null;
  let bestD = radius;
  for (const beam of s.design.beams) {
    const a = jointById(s.design, beam.a);
    const b = jointById(s.design, beam.b);
    if (!a || !b) continue;
    const d = distToSegment(x, y, a.x, a.y, b.x, b.y);
    if (d <= bestD) {
      bestD = d;
      best = beam;
    }
  }
  return best;
}

/** Resolve a pointer position: magnet to a joint, otherwise snap to grid. */
export function resolvePoint(s: BridgeState, x: number, y: number, magnet: number): BuildPoint {
  const j = findJoint(s, x, y, magnet);
  if (j) return { x: j.x, y: j.y, jointId: j.id };
  const g = snapToGrid(x, y);
  const existing = findJoint(s, g.x, g.y, 0.5);
  return { x: g.x, y: g.y, jointId: existing ? existing.id : null };
}

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
  length: number;
  cost: number;
}

function pointProblem(level: BridgeLevel, p: BuildPoint): string | null {
  if (p.jointId !== null) return null;
  if (p.x < 0 || p.x > 500 || p.y < 0 || p.y > level.waterY - 6) return "Out of bounds";
  if (insideTerrain(level, p.x, p.y)) return "Inside rock";
  return null;
}

function hasBeam(d: Design, a: BuildPoint, b: BuildPoint): boolean {
  if (a.jointId === null || b.jointId === null) return false;
  return d.beams.some(
    (m) => (m.a === a.jointId && m.b === b.jointId) || (m.a === b.jointId && m.b === a.jointId)
  );
}

/** Check one beam on its own, ignoring budget. */
function checkGeometry(
  s: BridgeState,
  a: BuildPoint,
  b: BuildPoint,
  material: MaterialType
): PlacementCheck {
  const level = currentLevel(s);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const cost = beamCost(material, length);
  const fail = (reason: string): PlacementCheck => ({ ok: false, reason, length, cost });
  if (length < MIN_BEAM - 0.01) return fail("Too short");
  const max = MATERIALS[material].maxLength;
  if (length > max + 0.01)
    return fail(
      `Too long — ${MATERIALS[material].name} max ${(max / UNITS_PER_METRE).toFixed(0)} m`
    );
  const pa = pointProblem(level, a) ?? pointProblem(level, b);
  if (pa) return fail(pa);
  if (segmentBlocked(level, a, b)) return fail("Blocked by rock");
  if (hasBeam(s.design, a, b)) return fail("Already built");
  return { ok: true, length, cost };
}

function mirrorPoint(s: BridgeState, p: BuildPoint): BuildPoint {
  const x = 500 - p.x;
  const j = findJoint(s, x, p.y, 0.5);
  return { x, y: p.y, jointId: j ? j.id : null };
}

function mirrorOf(s: BridgeState, a: BuildPoint, b: BuildPoint): [BuildPoint, BuildPoint] | null {
  const ma = mirrorPoint(s, a);
  const mb = mirrorPoint(s, b);
  const same =
    (Math.abs(ma.x - a.x) < 0.5 && Math.abs(mb.x - b.x) < 0.5) ||
    (Math.abs(ma.x - b.x) < 0.5 &&
      Math.abs(mb.x - a.x) < 0.5 &&
      Math.abs(ma.y - b.y) < 0.5 &&
      Math.abs(mb.y - a.y) < 0.5);
  return same ? null : [ma, mb];
}

/** Full placement check, including the mirrored copy and the budget cap. */
export function checkPlacement(
  s: BridgeState,
  a: BuildPoint,
  b: BuildPoint,
  material: MaterialType
): PlacementCheck {
  if (s.mode !== "build") return { ok: false, reason: "Stop the test to edit", length: 0, cost: 0 };
  const main = checkGeometry(s, a, b, material);
  if (!main.ok) return main;
  let cost = main.cost;
  if (s.mirror) {
    const m = mirrorOf(s, a, b);
    if (m) {
      const mc = checkGeometry(s, m[0], m[1], material);
      if (mc.ok) cost += mc.cost;
    }
  }
  const level = currentLevel(s);
  if (designCost(s.design) + cost > level.maxBudget) {
    return { ok: false, reason: "Over budget", length: main.length, cost };
  }
  return { ok: true, length: main.length, cost };
}

function ensureJoint(d: Design, p: BuildPoint): number {
  if (p.jointId !== null) return p.jointId;
  const existing = d.joints.find((j) => Math.abs(j.x - p.x) < 0.5 && Math.abs(j.y - p.y) < 0.5);
  if (existing) return existing.id;
  const id = d.nextId++;
  d.joints.push({ id, x: p.x, y: p.y, anchor: false });
  return id;
}

function addBeamRaw(s: BridgeState, a: BuildPoint, b: BuildPoint, material: MaterialType): number {
  const ia = ensureJoint(s.design, a);
  const ib = ensureJoint(s.design, b);
  const id = s.design.nextId++;
  s.design.beams.push({ id, a: ia, b: ib, material });
  return id;
}

/**
 * Builds a beam (and its mirror, when mirror mode is on and the mirror is
 * valid). Returns the new beam ids, empty when nothing was built.
 */
export function placeBeam(
  s: BridgeState,
  a: BuildPoint,
  b: BuildPoint,
  material: MaterialType
): number[] {
  if (!checkPlacement(s, a, b, material).ok) return [];
  const mirrored = s.mirror ? mirrorOf(s, a, b) : null;
  const mirrorOk = mirrored ? checkGeometry(s, mirrored[0], mirrored[1], material).ok : false;
  const ids = [addBeamRaw(s, a, b, material)];
  if (mirrored && mirrorOk) {
    // Re-resolve: the first beam may have created the joints the mirror uses.
    const ma = mirrorPoint(s, { ...a, jointId: null });
    const mb = mirrorPoint(s, { ...b, jointId: null });
    if (!hasBeam(s.design, ma, mb)) ids.push(addBeamRaw(s, ma, mb, material));
  }
  commit(s);
  return ids;
}

function pruneJoints(d: Design): void {
  const used = new Set<number>();
  for (const b of d.beams) {
    used.add(b.a);
    used.add(b.b);
  }
  d.joints = d.joints.filter((j) => j.anchor || used.has(j.id));
}

export function removeBeam(s: BridgeState, beamId: number): boolean {
  if (s.mode !== "build") return false;
  const beam = s.design.beams.find((m) => m.id === beamId);
  if (!beam) return false;
  const remove = new Set([beamId]);
  if (s.mirror) {
    const a = jointById(s.design, beam.a)!;
    const b = jointById(s.design, beam.b)!;
    const ma = findJoint(s, 500 - a.x, a.y, 0.5);
    const mb = findJoint(s, 500 - b.x, b.y, 0.5);
    if (ma && mb) {
      const twin = s.design.beams.find(
        (m) =>
          m.material === beam.material &&
          ((m.a === ma.id && m.b === mb.id) || (m.a === mb.id && m.b === ma.id))
      );
      if (twin) remove.add(twin.id);
    }
  }
  s.design.beams = s.design.beams.filter((m) => !remove.has(m.id));
  pruneJoints(s.design);
  commit(s);
  return true;
}

/** Removes a free joint and everything attached to it. */
export function removeJoint(s: BridgeState, jointId: number): boolean {
  if (s.mode !== "build") return false;
  const j = jointById(s.design, jointId);
  if (!j || j.anchor) return false;
  s.design.beams = s.design.beams.filter((m) => m.a !== jointId && m.b !== jointId);
  s.design.joints = s.design.joints.filter((x) => x.id !== jointId);
  pruneJoints(s.design);
  commit(s);
  return true;
}

/** Re-material an existing beam, if it still fits that material's rules. */
export function setBeamMaterial(s: BridgeState, beamId: number, material: MaterialType): boolean {
  if (s.mode !== "build") return false;
  const beam = s.design.beams.find((m) => m.id === beamId);
  if (!beam || beam.material === material) return false;
  const len = beamLength(s.design, beam);
  if (len > MATERIALS[material].maxLength + 0.01) return false;
  const delta = beamCost(material, len) - beamCost(beam.material, len);
  if (designCost(s.design) + delta > currentLevel(s).maxBudget) return false;
  beam.material = material;
  commit(s);
  return true;
}

/* ------------------------------------------------------------------------ */
/* Persistence                                                              */
/* ------------------------------------------------------------------------ */

export function serializeDesign(d: Design): string {
  return JSON.stringify({
    j: d.joints.map((j) => [j.id, j.x, j.y, j.anchor ? 1 : 0]),
    b: d.beams.map((b) => [b.id, b.a, b.b, b.material]),
    n: d.nextId,
  });
}

export function parseDesign(raw: string | null | undefined): Design | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as {
      j: [number, number, number, number][];
      b: [number, number, number, string][];
      n: number;
    };
    if (!Array.isArray(o.j) || !Array.isArray(o.b) || typeof o.n !== "number") return null;
    const joints = o.j.map(([id, x, y, a]) => ({ id, x, y, anchor: a === 1 }));
    const beams = o.b
      .filter(([, , , m]) => m in MATERIALS)
      .map(([id, a, b, m]) => ({ id, a, b, material: m as MaterialType }));
    return { joints, beams, nextId: o.n };
  } catch {
    return null;
  }
}

/** A saved design is usable only if its anchors match the level's. */
export function isDesignValidFor(level: BridgeLevel, d: Design): boolean {
  const anchors = d.joints.filter((j) => j.anchor);
  if (anchors.length !== level.anchors.length) return false;
  for (const a of level.anchors) {
    if (!anchors.some((j) => j.x === a.x && j.y === a.y)) return false;
  }
  const ids = new Set(d.joints.map((j) => j.id));
  return (
    d.beams.every((b) => ids.has(b.a) && ids.has(b.b) && b.id < d.nextId) &&
    d.joints.every((j) => j.id < d.nextId)
  );
}

/* ------------------------------------------------------------------------ */
/* Simulation                                                               */
/* ------------------------------------------------------------------------ */

export const GRAVITY = 98; // units/s², with 10 units to the metre
const SUBSTEPS = 24;
const JOINT_MASS = 0.02;
const JOINT_DAMPING = 2.5; // 1/s, bridge joints only
const VEHICLE_DAMPING = 0.1; // 1/s
/** Gravity eases in, so a bridge settles instead of being dropped. */
const SETTLE_TIME = 0.6;
const AXIAL_DAMPING = 60; // 1/s
const MAX_TIME = 40;
const STUCK_TIME = 4;

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Inverse mass; 0 for anchors. */
  w: number;
}

export interface SimBeam {
  id: number;
  a: number;
  b: number;
  material: MaterialType;
  rest: number;
  compliance: number;
  tension: number;
  compression: number;
  broken: boolean;
  /** Signed axial force: positive tension, negative compression. */
  force: number;
  /** Current stress, 0..1 (1 = failure). */
  stress: number;
  peak: number;
  acc: number;
}

interface Rigid {
  a: number;
  b: number;
  rest: number;
}

interface TerrainEdge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  nx: number;
  ny: number;
}

export interface SimVehicle {
  rear: number;
  front: number;
  topRear: number;
  topFront: number;
  radius: number;
  /** Wheel rotation, radians, for drawing. */
  spin: number;
  contact: [boolean, boolean];
}

export interface Sim {
  particles: Particle[];
  /** Joint id -> particle index. */
  index: Map<number, number>;
  beams: SimBeam[];
  rigid: Rigid[];
  terrain: TerrainEdge[];
  vehicle: SimVehicle;
  time: number;
  bestX: number;
  stuck: number;
  done: boolean;
  firstBreak?: BridgeResult["firstBreak"];
}

function terrainEdges(level: BridgeLevel): TerrainEdge[] {
  const edges: TerrainEdge[] = [];
  for (const poly of level.terrain) {
    // Signed area in screen coordinates: positive = clockwise on screen.
    let area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      area += (poly[j]![0] - poly[i]![0]) * (poly[j]![1] + poly[i]![1]);
    }
    const flip = area > 0 ? 1 : -1;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j]!;
      const [bx, by] = poly[i]!;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      // Outward normal; verified below against the polygon interior.
      let nx = ((by - ay) / len) * flip;
      let ny = (-(bx - ax) / len) * flip;
      const mx = (ax + bx) / 2 + nx * 0.5;
      const my = (ay + by) / 2 + ny * 0.5;
      if (pointInPolygon(mx, my, poly)) {
        nx = -nx;
        ny = -ny;
      }
      edges.push({ ax, ay, bx, by, nx, ny });
    }
  }
  return edges;
}

function makeParticle(x: number, y: number, mass: number): Particle {
  return { x, y, px: x, py: y, vx: 0, vy: 0, w: mass > 0 ? 1 / mass : 0 };
}

export function buildSim(level: BridgeLevel, d: Design): Sim {
  const particles: Particle[] = [];
  const index = new Map<number, number>();
  const mass: number[] = [];
  for (const j of d.joints) {
    index.set(j.id, particles.length);
    particles.push(makeParticle(j.x, j.y, 0));
    mass.push(j.anchor ? 0 : JOINT_MASS);
  }

  const beams: SimBeam[] = [];
  for (const b of d.beams) {
    const ia = index.get(b.a);
    const ib = index.get(b.b);
    if (ia === undefined || ib === undefined) continue;
    const pa = particles[ia]!;
    const pb = particles[ib]!;
    const rest = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const mat = MATERIALS[b.material];
    const half = (rest * mat.density) / 2;
    if (mass[ia]! > 0) mass[ia]! += half;
    if (mass[ib]! > 0) mass[ib]! += half;
    beams.push({
      id: b.id,
      a: ia,
      b: ib,
      material: b.material,
      rest,
      compliance: rest / mat.stiffness,
      tension: mat.tension,
      compression: compressionStrength(b.material, rest),
      broken: false,
      force: 0,
      stress: 0,
      peak: 0,
      acc: 0,
    });
  }
  for (let i = 0; i < particles.length; i++) {
    const anchor = d.joints[i]!.anchor;
    particles[i]!.w = anchor ? 0 : 1 / Math.max(JOINT_MASS, mass[i]!);
  }

  // Vehicle: two wheels and two chassis points, held rigid.
  const v = level.vehicle;
  const ground = groundYAt(level, level.startX);
  const axleY = (Number.isFinite(ground) ? ground : 150) - v.wheelRadius;
  const rx = level.startX - v.wheelbase / 2;
  const fx = level.startX + v.wheelbase / 2;
  const wheelMass = v.mass * 0.3;
  const bodyMass = v.mass * 0.2;
  const rear = particles.push(makeParticle(rx, axleY, wheelMass)) - 1;
  const front = particles.push(makeParticle(fx, axleY, wheelMass)) - 1;
  const topRear = particles.push(makeParticle(rx, axleY - v.height, bodyMass)) - 1;
  const topFront = particles.push(makeParticle(fx, axleY - v.height, bodyMass)) - 1;
  const pairs: Array<[number, number]> = [
    [rear, front],
    [rear, topRear],
    [front, topFront],
    [topRear, topFront],
    [rear, topFront],
    [front, topRear],
  ];
  const rigid = pairs.map(([a, b]) => ({
    a,
    b,
    rest: Math.hypot(particles[b]!.x - particles[a]!.x, particles[b]!.y - particles[a]!.y),
  }));

  return {
    particles,
    index,
    beams,
    rigid,
    terrain: terrainEdges(level),
    vehicle: {
      rear,
      front,
      topRear,
      topFront,
      radius: v.wheelRadius,
      spin: 0,
      contact: [false, false],
    },
    time: 0,
    bestX: rx,
    stuck: 0,
    done: false,
  };
}

/** Contact normal per wheel this substep, for traction. */
type Normal = { nx: number; ny: number } | null;

function collideWheel(sim: Sim, wi: number, r: number): Normal {
  const P = sim.particles;
  const p = P[wi]!;
  let normal: Normal = null;

  for (const beam of sim.beams) {
    if (beam.broken || !MATERIALS[beam.material].drivable) continue;
    const a = P[beam.a]!;
    const b = P[beam.b]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-6) continue;
    const len = Math.sqrt(len2);
    // Upward normal of the road surface.
    let sx = aby / len;
    let sy = -abx / len;
    if (sy > 0) {
      sx = -sx;
      sy = -sy;
    }
    const side = (p.x - a.x) * sx + (p.y - a.y) * sy;
    if (side < -r * 0.4 || side > r) continue; // under the deck, or clear of it
    const tRaw = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    const t = Math.max(0, Math.min(1, tRaw));
    const qx = a.x + abx * t;
    const qy = a.y + aby * t;
    let nx: number;
    let ny: number;
    let dist: number;
    if (tRaw > 0 && tRaw < 1) {
      nx = sx;
      ny = sy;
      dist = side;
    } else {
      const dx = p.x - qx;
      const dy = p.y - qy;
      dist = Math.hypot(dx, dy);
      if (dist < 1e-6 || dx * sx + dy * sy <= 0) continue;
      nx = dx / dist;
      ny = dy / dist;
    }
    const pen = r - dist;
    if (pen <= 0) continue;
    const wa = a.w * (1 - t) * (1 - t);
    const wb = b.w * t * t;
    const wsum = p.w + wa + wb;
    if (wsum <= 0) continue;
    const lambda = pen / wsum;
    p.x += p.w * lambda * nx;
    p.y += p.w * lambda * ny;
    a.x -= a.w * (1 - t) * lambda * nx;
    a.y -= a.w * (1 - t) * lambda * ny;
    b.x -= b.w * t * lambda * nx;
    b.y -= b.w * t * lambda * ny;
    normal = { nx, ny };
  }

  for (const e of sim.terrain) {
    const abx = e.bx - e.ax;
    const aby = e.by - e.ay;
    const len2 = abx * abx + aby * aby;
    const side = (p.x - e.ax) * e.nx + (p.y - e.ay) * e.ny;
    if (side < -r * 0.4 || side > r) continue;
    const t = Math.max(0, Math.min(1, ((p.x - e.ax) * abx + (p.y - e.ay) * aby) / len2));
    const qx = e.ax + abx * t;
    const qy = e.ay + aby * t;
    const dx = p.x - qx;
    const dy = p.y - qy;
    let dist = Math.hypot(dx, dy);
    let nx = e.nx;
    let ny = e.ny;
    if (t > 0 && t < 1) {
      dist = side;
    } else if (dist > 1e-6 && dx * e.nx + dy * e.ny > 0) {
      nx = dx / dist;
      ny = dy / dist;
    } else {
      continue;
    }
    const pen = r - dist;
    if (pen <= 0 || p.w <= 0) continue;
    p.x += nx * pen;
    p.y += ny * pen;
    if (ny < -0.3) normal = { nx, ny };
  }
  return normal;
}

/** Advances the test by `dt` seconds. Mutates `s`; read `s.events` after. */
export function stepBridge(s: BridgeState, dt: number): void {
  s.events = noEvents();
  const sim = s.sim;
  if (s.mode !== "test" || !sim || sim.done) return;
  const level = currentLevel(s);
  const v = level.vehicle;
  const P = sim.particles;
  const h = dt / SUBSTEPS;
  const h2 = h * h;
  const veh = sim.vehicle;
  const wheels = [veh.rear, veh.front];

  for (const beam of sim.beams) beam.acc = 0;
  const g = GRAVITY * Math.min(1, sim.time / SETTLE_TIME);
  const firstVehicle = veh.rear;

  for (let step = 0; step < SUBSTEPS; step++) {
    // Predict.
    for (let i = 0; i < P.length; i++) {
      const p = P[i]!;
      if (p.w === 0) continue;
      p.vy += (i >= firstVehicle ? GRAVITY : g) * h;
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * h;
      p.y += p.vy * h;
    }

    // Beams.
    for (const beam of sim.beams) {
      if (beam.broken) continue;
      const a = P[beam.a]!;
      const b = P[beam.b]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const C = len - beam.rest;
      if (beam.compression === 0 && C < 0) continue; // slack cable
      const wsum = a.w + b.w;
      if (wsum === 0) continue;
      const alpha = beam.compliance / h2;
      const dl = -C / (wsum + alpha);
      const nx = dx / len;
      const ny = dy / len;
      a.x -= a.w * dl * nx;
      a.y -= a.w * dl * ny;
      b.x += b.w * dl * nx;
      b.y += b.w * dl * ny;
      beam.acc += -dl / h2; // tension positive
    }

    // Vehicle body.
    for (const c of sim.rigid) {
      const a = P[c.a]!;
      const b = P[c.b]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1e-6;
      const C = len - c.rest;
      const wsum = a.w + b.w;
      const dl = -C / wsum;
      a.x -= (a.w * dl * dx) / len;
      a.y -= (a.w * dl * dy) / len;
      b.x += (b.w * dl * dx) / len;
      b.y += (b.w * dl * dy) / len;
    }

    // Wheels against road and rock.
    const normals: Normal[] = [
      collideWheel(sim, veh.rear, veh.radius),
      collideWheel(sim, veh.front, veh.radius),
    ];

    // Velocities.
    const jointAir = 1 - JOINT_DAMPING * h;
    const vehicleAir = 1 - VEHICLE_DAMPING * h;
    for (let i = 0; i < P.length; i++) {
      const p = P[i]!;
      if (p.w === 0) continue;
      const air = i >= firstVehicle ? vehicleAir : jointAir;
      p.vx = ((p.x - p.px) / h) * air;
      p.vy = ((p.y - p.py) / h) * air;
    }

    // Axial damping keeps beams from ringing without softening them.
    const k = Math.min(1, AXIAL_DAMPING * h);
    for (const beam of sim.beams) {
      if (beam.broken) continue;
      const a = P[beam.a]!;
      const b = P[beam.b]!;
      const wsum = a.w + b.w;
      if (wsum === 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1e-6;
      const nx = dx / len;
      const ny = dy / len;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      const corr = (rel * k) / wsum;
      a.vx += a.w * corr * nx;
      a.vy += a.w * corr * ny;
      b.vx -= b.w * corr * nx;
      b.vy -= b.w * corr * ny;
    }

    // Traction: driven wheels push the vehicle toward cruise speed.
    for (let i = 0; i < 2; i++) {
      const n = normals[i] ?? null;
      if (!n) continue;
      const p = P[wheels[i]!]!;
      const tx = -n.ny;
      const ty = n.nx;
      const vt = p.vx * tx + p.vy * ty;
      const maxDv = 160 * h;
      const dv = Math.max(-maxDv, Math.min(maxDv, v.speed - vt));
      p.vx += dv * tx;
      p.vy += dv * ty;
    }
    veh.contact = [normals[0]! !== null, normals[1]! !== null];
  }

  // Stress, peaks and failures, on the force averaged over the frame so a
  // single substep's spike cannot snap a member.
  let maxStress = 0;
  for (const beam of sim.beams) {
    if (beam.broken) continue;
    const f = beam.acc / SUBSTEPS;
    beam.force = f;
    const stress = f >= 0 ? f / beam.tension : beam.compression > 0 ? -f / beam.compression : 0;
    beam.stress = stress;
    if (stress > beam.peak) beam.peak = Math.min(stress, 1);
    if (stress > maxStress) maxStress = stress;
  }
  for (const beam of sim.beams) {
    if (beam.broken || beam.stress < 1) continue;
    beam.broken = true;
    beam.peak = 1;
    s.events.broke.push({ beamId: beam.id, material: beam.material });
    sim.firstBreak ??= {
      beamId: beam.id,
      material: beam.material,
      mode: beam.force >= 0 ? "tension" : "buckled",
    };
  }
  s.events.maxStress = Math.min(maxStress, 1.5);

  const rear = P[veh.rear]!;
  const front = P[veh.front]!;
  veh.spin += (((rear.vx + front.vx) / 2) * dt) / veh.radius;
  sim.time += dt;

  // Outcome.
  const lowest = Math.max(rear.y, front.y, P[veh.topRear]!.y, P[veh.topFront]!.y);
  if (Math.min(rear.x, front.x) >= level.finishX) {
    finish(s, true);
    s.events.crossed = true;
    return;
  }
  if (lowest >= level.waterY || rear.x < -40 || front.x > 560) {
    s.events.splash = lowest >= level.waterY;
    finish(s, false, "fell");
    s.events.failed = true;
    return;
  }
  if (rear.x > sim.bestX + 1) {
    sim.bestX = rear.x;
    sim.stuck = 0;
  } else {
    sim.stuck += dt;
  }
  if (sim.stuck >= STUCK_TIME) {
    finish(s, false, "stuck");
    s.events.failed = true;
    return;
  }
  if (sim.time >= MAX_TIME) {
    finish(s, false, "timeout");
    s.events.failed = true;
  }
}

function finish(s: BridgeState, success: boolean, reason?: FailReason): void {
  const sim = s.sim!;
  sim.done = true;
  const level = currentLevel(s);
  const cost = designCost(s.design);
  let peak = 0;
  let broken = 0;
  for (const b of sim.beams) {
    peak = Math.max(peak, b.peak);
    if (b.broken) broken += 1;
  }
  const crossed = success;
  const underBudget = success && cost <= level.targetBudget;
  const lowStress = success && broken === 0 && peak <= level.stressStar;
  s.result = {
    success,
    reason,
    firstBreak: sim.firstBreak,
    brokenCount: broken,
    peakStress: peak,
    cost,
    time: sim.time,
    stars: (crossed ? 1 : 0) + (underBudget ? 1 : 0) + (lowStress ? 1 : 0),
    starDetails: { crossed, underBudget, lowStress },
  };
  s.lastPeaks = Object.fromEntries(sim.beams.map((b) => [b.id, b.peak]));
}

export function startTest(s: BridgeState): void {
  if (s.mode === "test") return;
  s.sim = buildSim(currentLevel(s), s.design);
  s.mode = "test";
  s.result = null;
  s.lastPeaks = {};
  s.events = noEvents();
}

/** Back to the drawing board. The design is untouched; peaks are kept. */
export function stopTest(s: BridgeState): void {
  if (s.mode !== "test") return;
  if (s.sim && !s.sim.done) {
    s.lastPeaks = Object.fromEntries(s.sim.beams.map((b) => [b.id, b.peak]));
  }
  s.mode = "build";
  s.sim = null;
  s.events = noEvents();
}

/* ------------------------------------------------------------------------ */
/* Scoring                                                                  */
/* ------------------------------------------------------------------------ */

/** Points for a finished test: nothing for a failure. */
export function scoreFor(s: BridgeState): number {
  const r = s.result;
  if (!r || !r.success) return 0;
  const level = currentLevel(s);
  const savings = Math.max(0, level.maxBudget - r.cost);
  const safety = Math.round((1 - Math.min(1, r.peakStress)) * 200);
  return 300 + r.stars * 200 + Math.round(savings * 0.5) + safety;
}

/** Current stress colour: green → yellow → red. */
export function stressColor(stress: number): string {
  const t = Math.max(0, Math.min(1, stress));
  const hue = 130 - 130 * t;
  return `hsl(${hue.toFixed(0)}, 90%, ${(52 - t * 6).toFixed(0)}%)`;
}
