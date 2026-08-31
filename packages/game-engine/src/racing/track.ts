import { createRng, seedFromString } from "../lib/rng.js";
import type {
  BoostPad,
  TrackObject,
  TrackObstacle,
  TrackPoint,
  TrackSegment,
  TrackSpec,
} from "./types.js";

/** Distance between stored centreline points, in metres. */
const POINT_STEP = 10;

const CHECKPOINT_COUNT = 4;

/**
 * The tightest corner a vehicle can hold at speed.
 *
 * Above this the centrifugal push at top speed exceeds full steering lock and
 * the bend becomes impossible rather than difficult — no input keeps the car on
 * the road.
 */
const MAX_CURVATURE = 0.028;

/**
 * Builds a closed race circuit from a seed.
 *
 * A circuit, not a ribbon with two ends. Laps need the road to come back to
 * where it started, and the previous point-to-point generator could not do
 * that: it walked curvature forward and hoped, which spiralled into its own
 * path and left the start and the finish in unrelated places.
 *
 * The shape is a closed polar curve — a circle with a few low harmonics added
 * to its radius. That closes by construction rather than by correction, and
 * gives long straights and distinct corners instead of a road that wanders.
 * Everything else is derived from it: the centreline is that curve resampled at
 * even distances, and curvature is the turn from one sample to the next.
 *
 * Deterministic, so the server sends only the seed and every client rebuilds
 * the identical circuit. No geometry crosses the network.
 */
export function buildTrack(seedSource: string | number, length: number): TrackSpec {
  const seed = typeof seedSource === "number" ? seedSource : seedFromString(seedSource);
  const rng = createRng(seed);

  const points = buildCentreline(rng, Math.max(600, length));
  const actualLength = points.length * POINT_STEP;

  const segments: TrackSegment[] = points.map((point, i) => {
    const next = points[(i + 1) % points.length]!;
    return {
      length: POINT_STEP,
      curvature: angleDelta(point.heading, next.heading) / POINT_STEP,
      gradient: (next.y - point.y) / POINT_STEP,
    };
  });

  const obstacles = placeObstacles(rng, actualLength);
  const boostPads = placeBoostPads(rng, actualLength, obstacles);
  const coins = placeCoins(rng, actualLength, obstacles);

  const checkpoints = Array.from(
    { length: CHECKPOINT_COUNT },
    (_, i) => Math.round((actualLength * (i + 1)) / CHECKPOINT_COUNT),
  );

  return { seed, length: actualLength, points, segments, obstacles, coins, boostPads, checkpoints };
}

/**
 * The closed centreline, sampled at even distances.
 *
 * Built in polar form and then resampled by arc length, because a curve that is
 * even in angle is not even in distance — the outside of a bend would get fewer
 * points than the inside, and the road would be built from stretched quads
 * exactly where it turns.
 */
function buildCentreline(rng: () => number, targetLength: number): TrackPoint[] {
  // A handful of low harmonics. Higher ones make a road that wriggles rather
  // than corners, and there is no way to drive a wriggle well.
  const harmonics = [2, 3, 4, 5].map((k) => ({
    k,
    amplitude: (0.05 + rng() * 0.13) / (k * 0.55),
    phase: rng() * Math.PI * 2,
  }));

  const radiusAt = (theta: number) =>
    1 + harmonics.reduce((sum, h) => sum + h.amplitude * Math.sin(h.k * theta + h.phase), 0);

  // Fine sample first, so arc length is measured accurately.
  const FINE = 4096;
  const fine: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < FINE; i++) {
    const theta = (i / FINE) * Math.PI * 2;
    const r = radiusAt(theta);
    fine.push({ x: Math.cos(theta) * r, z: Math.sin(theta) * r });
  }

  const cumulative: number[] = [0];
  for (let i = 1; i <= FINE; i++) {
    const a = fine[i - 1]!;
    const b = fine[i % FINE]!;
    cumulative.push(cumulative[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const perimeter = cumulative[FINE]!;
  const scale = targetLength / perimeter;

  const count = Math.max(24, Math.round(targetLength / POINT_STEP));
  const spacingInCurveUnits = perimeter / count;

  const raw: Array<{ x: number; z: number }> = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const target = i * spacingInCurveUnits;
    while (cursor < FINE - 1 && cumulative[cursor + 1]! < target) cursor++;

    const span = cumulative[cursor + 1]! - cumulative[cursor]!;
    const t = span > 0 ? (target - cumulative[cursor]!) / span : 0;
    const a = fine[cursor]!;
    const b = fine[(cursor + 1) % FINE]!;
    raw.push({
      x: (a.x + (b.x - a.x) * t) * scale,
      z: (a.z + (b.z - a.z) * t) * scale,
    });
  }

  // Gentle elevation, periodic so there is no step at the join.
  const hillPhase = rng() * Math.PI * 2;
  const hillAmplitude = 5 + rng() * 9;

  const points: TrackPoint[] = raw.map((point, i) => {
    const next = raw[(i + 1) % raw.length]!;
    return {
      x: point.x,
      y: Math.sin((i / raw.length) * Math.PI * 4 + hillPhase) * hillAmplitude,
      z: point.z,
      heading: Math.atan2(next.x - point.x, next.z - point.z),
      distance: i * POINT_STEP,
    };
  });

  // Start on the straightest part, so the grid, the countdown and the finish
  // line all sit somewhere a driver can use.
  const startIndex = straightestIndex(points);
  const rotated = [...points.slice(startIndex), ...points.slice(0, startIndex)];
  rotated.forEach((point, i) => {
    point.distance = i * POINT_STEP;
  });

  return tame(rotated, 0);
}

/** The index whose surrounding stretch turns least. */
function straightestIndex(points: TrackPoint[]): number {
  let best = 0;
  let bestTurn = Infinity;

  for (let i = 0; i < points.length; i++) {
    let turn = 0;
    for (let j = 0; j < 8; j++) {
      const a = points[(i + j) % points.length]!;
      const b = points[(i + j + 1) % points.length]!;
      turn += Math.abs(angleDelta(a.heading, b.heading));
    }
    if (turn < bestTurn) {
      bestTurn = turn;
      best = i;
    }
  }
  return best;
}

/**
 * Rounds off corners too tight to drive.
 */
function tame(points: TrackPoint[], depth: number): TrackPoint[] {
  if (depth > 6) return points;

  let maxCurvature = 0;
  points.forEach((point, i) => {
    const next = points[(i + 1) % points.length]!;
    const delta = Math.abs(angleDelta(point.heading, next.heading));
    maxCurvature = Math.max(maxCurvature, delta / POINT_STEP);
  });

  if (maxCurvature <= MAX_CURVATURE) return points;

  const meanRadius =
    points.reduce((sum, p) => sum + Math.hypot(p.x, p.z), 0) / points.length;

  const pulled = points.map((point) => {
    const radius = Math.hypot(point.x, point.z);
    const theta = Math.atan2(point.z, point.x);
    const eased = radius + (meanRadius - radius) * 0.25;
    return {
      ...point,
      x: Math.cos(theta) * eased,
      z: Math.sin(theta) * eased,
    };
  });

  pulled.forEach((point, i) => {
    const next = pulled[(i + 1) % pulled.length]!;
    point.heading = Math.atan2(next.x - point.x, next.z - point.z);
  });

  return tame(pulled, depth + 1);
}

/**
 * Scatters dynamic obstacles (barricades, barrels, spikes, lasers, cones).
 */
function placeObstacles(rng: () => number, length: number): TrackObstacle[] {
  const obstacles: TrackObstacle[] = [];
  let distance = 140;

  while (distance < length - 140) {
    distance += 65 + rng() * 95;
    if (distance >= length - 140) break;

    const roll = rng();
    const kind: TrackObstacle["kind"] =
      roll < 0.28
        ? "barrier"
        : roll < 0.52
        ? "barrel"
        : roll < 0.74
        ? "spikes"
        : roll < 0.88
        ? "laser"
        : "cone";

    const halfWidth =
      kind === "laser" ? 0.38 : kind === "barrier" ? 0.32 : kind === "spikes" ? 0.26 : kind === "barrel" ? 0.22 : 0.12;

    const lateral =
      kind === "barrier" || kind === "laser"
        ? (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.35)
        : (rng() - 0.5) * 1.5;

    obstacles.push({ distance: Math.round(distance), lateral: round2(lateral), kind, halfWidth });

    if (rng() < 0.3) {
      const otherSide = -Math.sign(lateral || 1) * (0.4 + rng() * 0.4);
      const gap = Math.abs(otherSide - lateral) - halfWidth - 0.2;
      if (gap > 0.45) {
        obstacles.push({
          distance: Math.round(distance),
          lateral: round2(otherSide),
          kind: "cone",
          halfWidth: 0.12,
        });
      }
    }
  }

  return obstacles;
}

/** Places ground speed booster pads that give instant acceleration. */
function placeBoostPads(
  rng: () => number,
  length: number,
  obstacles: TrackObstacle[],
): BoostPad[] {
  const pads: BoostPad[] = [];
  let distance = 180;

  while (distance < length - 160) {
    distance += 120 + rng() * 140;
    if (distance >= length - 160) break;

    const lateral = round2((rng() - 0.5) * 1.2);
    // Don't place on top of obstacles
    const blocked = obstacles.some(
      (o) => Math.abs(o.distance - distance) < 18 && Math.abs(o.lateral - lateral) < 0.45,
    );
    if (!blocked) {
      pads.push({ distance: Math.round(distance), lateral, halfWidth: 0.35 });
    }
  }

  return pads;
}

/** Coins run in short lines, and never inside an obstacle. */
function placeCoins(
  rng: () => number,
  length: number,
  obstacles: TrackObstacle[],
): TrackObject[] {
  const coins: TrackObject[] = [];
  let distance = 60;

  while (distance < length - 60) {
    distance += 50 + rng() * 90;
    const lateral = round2((rng() - 0.5) * 1.5);
    const runLength = 3 + Math.floor(rng() * 5);

    for (let i = 0; i < runLength; i++) {
      const at = Math.round(distance + i * 8);
      if (at >= length - 40) break;
      const blocked = obstacles.some(
        (o) => Math.abs(o.distance - at) < 12 && Math.abs(o.lateral - lateral) < o.halfWidth + 0.2,
      );
      if (!blocked) coins.push({ distance: at, lateral });
    }
    distance += runLength * 8;
  }

  return coins;
}

/**
 * Wraps a distance onto the circuit.
 *
 * Vehicles carry total distance travelled, which grows past a lap and is
 * negative on the grid. Everything asking "where on the road is this" comes
 * through here.
 */
export function wrapDistance(track: TrackSpec, distance: number): number {
  const length = track.length;
  return ((distance % length) + length) % length;
}

/** Curvature and gradient at a distance along the circuit. */
export function sampleTrack(
  track: TrackSpec,
  distance: number,
): { curvature: number; gradient: number } {
  if (track.segments.length === 0) return { curvature: 0, gradient: 0 };
  const index = Math.floor(wrapDistance(track, distance) / POINT_STEP) % track.segments.length;
  const segment = track.segments[index];
  return segment
    ? { curvature: segment.curvature, gradient: segment.gradient }
    : { curvature: 0, gradient: 0 };
}

/**
 * The centreline in world space.
 *
 * Returned from the stored points rather than integrated from curvature:
 * integration accumulates error, and on a closed circuit that shows up as a
 * visible step where the road meets itself.
 */
export function trackCenterline(track: TrackSpec, step = POINT_STEP): TrackPoint[] {
  if (step === POINT_STEP || track.points.length === 0) return track.points;

  const out: TrackPoint[] = [];
  for (let distance = 0; distance < track.length; distance += step) {
    const point = trackToWorld(track.points, distance, 0, 0, POINT_STEP);
    if (point) out.push({ ...point, distance });
  }
  return out;
}

export interface WorldPoint {
  x: number;
  y: number;
  z: number;
  heading: number;
}

/**
 * Track space (distance along, offset across) to world space.
 *
 * The sign of the lateral offset is the whole reason this is a tested function
 * rather than three lines inside the renderer. The chase camera looks along
 * +z, and a camera looking down +z has its right hand pointing at **-x**. With
 * the geometrically obvious normal, steering right moved the car to the left of
 * the picture — invisible in every still frame, obvious the instant anybody
 * drives.
 */
export function trackToWorld(
  centerline: readonly TrackPoint[],
  distance: number,
  lateral: number,
  halfWidth: number,
  step: number,
): WorldPoint | null {
  if (centerline.length === 0) return null;

  // A circuit, so both ends wrap rather than clamp.
  const span = centerline.length * step;
  const wrapped = ((distance % span) + span) % span;
  const raw = wrapped / step;
  const index = Math.floor(raw) % centerline.length;
  const t = raw - Math.floor(raw);

  const a = centerline[index]!;
  const b = centerline[(index + 1) % centerline.length]!;

  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const z = a.z + (b.z - a.z) * t;
  // Interpolated as a delta so a heading crossing pi does not spin the vehicle
  // the long way round.
  const heading = a.heading + angleDelta(a.heading, b.heading) * t;

  const offset = lateral * halfWidth;
  return {
    x: x - Math.cos(heading) * offset,
    y,
    z: z + Math.sin(heading) * offset,
    heading,
  };
}

export const SEGMENT_METRES = POINT_STEP;

/** Shortest signed angle from a to b, so headings wrap cleanly at plus or minus pi. */
export function angleDelta(a: number, b: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
