import { createRng, seedFromString } from "../lib/rng.js";
import { datan2, dcos, dsin, dtan } from "./dmath.js";
import type {
  BoostPad,
  TrackObject,
  TrackObstacle,
  TrackPickup,
  PickupKind,
  TrackZone,
  ZoneKind,
  TrackPoint,
  TrackSegment,
  TrackSpec,
} from "./types.js";

/** Distance between stored centreline points, in metres. */
const POINT_STEP = 10;

const CHECKPOINT_COUNT = 4;

/**
 * The tightest corner the generator may produce, as a curvature (1/radius).
 *
 * 0.05 is a 20 m radius: a proper hairpin, taken at 55-70 km/h depending on
 * the car's grip. Corners are generated with radii of at least
 * `MIN_CORNER_RADIUS`, comfortably inside this, and a generated circuit that
 * breaks it anyway (smoothing, rounding) is rejected and redrawn.
 */
export const MAX_CURVATURE = 0.05;

/** Smallest corner radius drawn, metres. */
const MIN_CORNER_RADIUS = 23;
/** Shortest straight left between two corners, metres. */
const MIN_STRAIGHT = 20;
/**
 * Closest two unrelated parts of the circuit may come, centreline to
 * centreline: two road widths plus room for kerbs, run-off and a barrier.
 */
const MIN_CLEARANCE = 4 * 8 + 4;
/** Below this a segment counts as straight (a 500 m radius is flat for every car). */
const STRAIGHT_CURVATURE = 0.002;

/**
 * Builds a closed race circuit from a seed.
 *
 * A circuit, not a ribbon with two ends. Laps need the road to come back to
 * where it started, and everything else is derived from that loop: the
 * centreline is sampled at even distances, and curvature is the turn from one
 * sample to the next.
 *
 * Deterministic, so the server sends only the seed and every client rebuilds
 * the identical circuit. No geometry crosses the network. The trigonometry is
 * the polynomial kind from dmath, because curvature feeds the physics and
 * `Math.sin` is allowed to differ by an ulp between browsers.
 */
export function buildTrack(seedSource: string | number, length: number): TrackSpec {
  const seed = typeof seedSource === "number" ? seedSource : seedFromString(seedSource);
  const rng = createRng(seed);

  const points = buildCentreline(rng, Math.max(600, length));
  const actualLength = points.length * POINT_STEP;

  /*
   * Curvature is stored right-positive: the same sign as `lateral` and
   * steering, so "positive curves right" is literally true. Point headings
   * grow when the road turns *left* (heading = atan2(dx, dz) with the driver's
   * right at -x), so the sign is flipped here, once.
   */
  const segments: TrackSegment[] = points.map((point, i) => {
    const next = points[(i + 1) % points.length]!;
    return {
      length: POINT_STEP,
      curvature: -angleDelta(point.heading, next.heading) / POINT_STEP,
      gradient: (next.y - point.y) / POINT_STEP,
    };
  });

  const obstacles = placeObstacles(rng, actualLength);
  const boostPads = placeBoostPads(rng, actualLength, obstacles);
  const zones = placeZones(rng, actualLength, obstacles);
  const pickups = placePickups(rng, actualLength, obstacles);
  const coins = placeCoins(rng, actualLength, obstacles);

  const checkpoints = Array.from(
    { length: CHECKPOINT_COUNT },
    (_, i) => Math.round((actualLength * (i + 1)) / CHECKPOINT_COUNT),
  );

  return {
    seed,
    length: actualLength,
    points,
    segments,
    obstacles,
    coins,
    boostPads,
    zones,
    pickups,
    checkpoints,
  };
}

interface Vec {
  x: number;
  z: number;
}

/** One corner of the circuit: a polygon vertex rounded off by an arc. */
interface Corner {
  /** Polygon vertex, unit scale. */
  at: Vec;
  /** Heading into and out of the corner. */
  headingIn: number;
  headingOut: number;
  /** Signed heading change through the corner. */
  turn: number;
  /** Arc radius, metres. */
  radius: number;
}

/** Heading of a direction, in the track's convention (atan2(dx, dz)). */
function headingOf(dx: number, dz: number): number {
  return datan2(dx, dz);
}

/**
 * The circuit's layout: straights joined by constant-radius corners.
 *
 * The old generator traced a circle with a few sine waves added to its
 * radius. That closes by construction, but it can only make one kind of
 * road — a constant wander of medium bends — and once the cars had real tyres
 * a 1 km lap of it was a single 100 km/h corner: nowhere to use the power,
 * nowhere to brake, nothing to tell a supercar from a hatchback.
 *
 * Real circuits are straights and corners. So: scatter a star-shaped polygon
 * around a centre (star-shaped, so it cannot cross itself), give every vertex
 * a corner whose radius suits how far it turns — hairpins tight, kinks fast —
 * and round each vertex off with that arc. A filleted polygon is still closed
 * exactly, the straights between corners are where speed and braking live,
 * and an inward vertex between two outward ones makes an S-bend for free.
 *
 * The scale is solved so the lap is exactly the requested length, a few
 * metres of smoothing turn the hard joins between straight and arc into short
 * transitions (as real kerbs do), and any layout that comes too close to
 * itself or bends too tightly is thrown away and redrawn from the same RNG.
 */
function buildCentreline(rng: () => number, targetLength: number): TrackPoint[] {
  const length = Math.round(targetLength / POINT_STEP) * POINT_STEP;
  const count = length / POINT_STEP;

  let loop: Vec[] | null = null;
  for (let attempt = 0; attempt < 24 && !loop; attempt++) {
    loop = layout(rng, length, count, false);
  }
  // A regular hexagon with medium corners always fits; it is the circuit of
  // last resort rather than a failure to build one.
  loop ??= layout(rng, length, count, true)!;

  /*
   * Gentle elevation, periodic so there is no step at the join.
   *
   * Capped so the steepest grade stays near 9%: gradient is real (g sin theta
   * on every car), and the same 14 m of hill that is a rolling crest on a 3 km
   * lap is a 20% wall on a 900 m one.
   */
  const hillPhase = rng() * Math.PI * 2;
  const hillAmplitude = Math.min(5 + rng() * 9, (0.09 * length) / (Math.PI * 4));

  const raw = loop;
  const points: TrackPoint[] = raw.map((point, i) => {
    const next = raw[(i + 1) % raw.length]!;
    return {
      x: point.x,
      y: dsin((i / raw.length) * Math.PI * 4 + hillPhase) * hillAmplitude,
      z: point.z,
      heading: headingOf(next.x - point.x, next.z - point.z),
      distance: i * POINT_STEP,
    };
  });

  // The start line goes part-way down the longest straight, leaving room
  // behind it for the grid and room ahead of it for a launch.
  const startIndex = startLineIndex(points);
  const rotated = [...points.slice(startIndex), ...points.slice(0, startIndex)];
  rotated.forEach((point, i) => {
    point.distance = i * POINT_STEP;
  });

  return rotated;
}

/**
 * One attempt at a layout, as `count` points spaced `POINT_STEP` apart, or
 * null when this draw does not make a usable circuit.
 */
function layout(rng: () => number, length: number, count: number, fallback: boolean): Vec[] | null {
  const n = fallback ? 6 : Math.min(12, Math.max(5, 4 + Math.floor(length / 550) + Math.floor(rng() * 3)));

  // A star-shaped polygon: angles in order, radii varied, the odd vertex
  // pulled in to make an S-bend. Never two inward in a row, which is where a
  // star polygon starts to fold back on itself.
  const vertices: Vec[] = [];
  let pulledLast = false;
  for (let i = 0; i < n; i++) {
    const theta = fallback ? (i / n) * Math.PI * 2 : ((i + (rng() - 0.5) * 0.7) / n) * Math.PI * 2;
    let r = fallback ? 1 : 0.62 + rng() * 0.62;
    const pull: boolean = !fallback && !pulledLast && i > 0 && rng() < 0.3;
    if (pull) r *= 0.55;
    pulledLast = pull;
    vertices.push({ x: dcos(theta) * r, z: dsin(theta) * r });
  }

  const edges: number[] = [];
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const e = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z));
    edges.push(e);
    perimeter += e;
  }

  const corners: Corner[] = vertices.map((at, i) => {
    const prev = vertices[(i - 1 + n) % n]!;
    const next = vertices[(i + 1) % n]!;
    const headingIn = headingOf(at.x - prev.x, at.z - prev.z);
    const headingOut = headingOf(next.x - at.x, next.z - at.z);
    const turn = angleDelta(headingIn, headingOut);
    const severity = Math.abs(turn);
    // Radius by how far the corner turns: a hairpin is slow, a kink is fast.
    const radius = fallback
      ? 60
      : severity >= 2
        ? MIN_CORNER_RADIUS + rng() * 12
        : severity >= 1.3
          ? 28 + rng() * 32
          : severity >= 0.7
            ? 40 + rng() * 70
            : 70 + rng() * 160;
    return { at, headingIn, headingOut, turn, radius };
  });

  // Solve the scale for the exact lap length, shrinking any pair of corners
  // that would leave no straight between them.
  const tangent = (c: Corner) => c.radius * dtan(Math.abs(c.turn) / 2);
  let scale = 0;
  let fits = false;
  for (let iteration = 0; iteration < 40 && !fits; iteration++) {
    let extra = 0;
    for (const c of corners) extra += 2 * tangent(c) - c.radius * Math.abs(c.turn);
    scale = (length + extra) / perimeter;
    fits = true;
    for (let i = 0; i < n; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % n]!;
      const room = scale * edges[i]! - MIN_STRAIGHT;
      const need = tangent(a) + tangent(b);
      if (need <= room) continue;
      fits = false;
      const shrink = room > 0 ? Math.max(0.5, room / need) : 0.5;
      a.radius = Math.max(MIN_CORNER_RADIUS, a.radius * shrink);
      b.radius = Math.max(MIN_CORNER_RADIUS, b.radius * shrink);
    }
  }
  if (!fits) return null;

  const dense = traceLoop(corners, scale, length);
  smoothLoop(dense, 6, 2);
  const loop = resample(dense, count, length);
  return acceptable(loop) ? loop : null;
}

/**
 * The filleted polygon as points one metre apart.
 *
 * Each corner is an arc from the point `T = r tan(turn / 2)` before its
 * vertex to the point `T` after it, tangent to both edges; between arcs the
 * road is straight. Evaluated in closed form along the arc rather than
 * integrated, so the loop meets itself exactly.
 */
function traceLoop(corners: Corner[], scale: number, length: number): Vec[] {
  type Piece =
    | { kind: "arc"; from: Vec; heading: number; sign: number; radius: number; length: number }
    | { kind: "straight"; from: Vec; heading: number; length: number };

  const pieces: Piece[] = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const c = corners[i]!;
    const next = corners[(i + 1) % n]!;
    const t = c.radius * dtan(Math.abs(c.turn) / 2);
    const vx = c.at.x * scale;
    const vz = c.at.z * scale;
    const from = { x: vx - dsin(c.headingIn) * t, z: vz - dcos(c.headingIn) * t };
    pieces.push({
      kind: "arc",
      from,
      heading: c.headingIn,
      sign: c.turn >= 0 ? 1 : -1,
      radius: c.radius,
      length: c.radius * Math.abs(c.turn),
    });
    const exit = { x: vx + dsin(c.headingOut) * t, z: vz + dcos(c.headingOut) * t };
    const tNext = next.radius * dtan(Math.abs(next.turn) / 2);
    const nx = next.at.x * scale - dsin(next.headingIn) * tNext;
    const nz = next.at.z * scale - dcos(next.headingIn) * tNext;
    pieces.push({
      kind: "straight",
      from: exit,
      heading: c.headingOut,
      length: Math.sqrt((nx - exit.x) * (nx - exit.x) + (nz - exit.z) * (nz - exit.z)),
    });
  }

  const total = pieces.reduce((sum, p) => sum + p.length, 0);
  const samples = Math.max(64, Math.round(length));
  const step = total / samples;
  const out: Vec[] = [];
  let piece = 0;
  let start = 0;
  for (let k = 0; k < samples; k++) {
    const u = k * step;
    while (piece < pieces.length - 1 && start + pieces[piece]!.length < u) {
      start += pieces[piece]!.length;
      piece += 1;
    }
    const p = pieces[piece]!;
    const along = Math.min(p.length, Math.max(0, u - start));
    if (p.kind === "straight") {
      out.push({ x: p.from.x + dsin(p.heading) * along, z: p.from.z + dcos(p.heading) * along });
    } else {
      // Heading grows by sign/radius per metre: x = x0 + s r (cos h0 - cos h),
      // z = z0 + s r (sin h - sin h0).
      const h = p.heading + (p.sign * along) / p.radius;
      out.push({
        x: p.from.x + p.sign * p.radius * (dcos(p.heading) - dcos(h)),
        z: p.from.z + p.sign * p.radius * (dsin(h) - dsin(p.heading)),
      });
    }
  }
  return out;
}

/** A centred moving average around the loop, applied `passes` times. */
function smoothLoop(points: Vec[], halfWidth: number, passes: number): void {
  const n = points.length;
  const window = halfWidth * 2 + 1;
  for (let pass = 0; pass < passes; pass++) {
    const xs = points.map((p) => p.x);
    const zs = points.map((p) => p.z);
    for (let i = 0; i < n; i++) {
      let sx = 0;
      let sz = 0;
      for (let k = -halfWidth; k <= halfWidth; k++) {
        const j = (i + k + n) % n;
        sx += xs[j]!;
        sz += zs[j]!;
      }
      points[i] = { x: sx / window, z: sz / window };
    }
  }
}

/**
 * `count` points at even arc length around a closed polyline, scaled so the
 * loop is exactly `length` metres. Smoothing shortens a loop by a fraction of
 * a percent; scaling it back keeps a lap the length it says it is.
 */
function resample(points: Vec[], count: number, length: number): Vec[] {
  const n = points.length;
  const cumulative: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const a = points[i - 1]!;
    const b = points[i % n]!;
    cumulative.push(cumulative[i - 1]! + Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z)));
  }
  const perimeter = cumulative[n]!;
  const scale = length / perimeter;
  const out: Vec[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * perimeter;
    while (cursor < n - 1 && cumulative[cursor + 1]! < target) cursor++;
    const span = cumulative[cursor + 1]! - cumulative[cursor]!;
    const t = span > 0 ? (target - cumulative[cursor]!) / span : 0;
    const a = points[cursor]!;
    const b = points[(cursor + 1) % n]!;
    out.push({ x: (a.x + (b.x - a.x) * t) * scale, z: (a.z + (b.z - a.z) * t) * scale });
  }
  return out;
}

/**
 * Whether a sampled loop is a circuit worth racing on: no bend tighter than
 * the limit, no part of the road within a barrier's reach of another, and a
 * straight long enough for a grid.
 */
function acceptable(loop: Vec[]): boolean {
  const n = loop.length;
  const headings = loop.map((p, i) => {
    const next = loop[(i + 1) % n]!;
    return headingOf(next.x - p.x, next.z - p.z);
  });
  let straightRun = 0;
  let longest = 0;
  for (let i = 0; i < n * 2; i++) {
    const k = Math.abs(angleDelta(headings[i % n]!, headings[(i + 1) % n]!)) / POINT_STEP;
    if (i < n && k > MAX_CURVATURE * 0.97) return false;
    straightRun = k < STRAIGHT_CURVATURE ? straightRun + 1 : 0;
    longest = Math.max(longest, Math.min(straightRun, n));
  }
  if (longest * POINT_STEP < Math.min(140, n * POINT_STEP * 0.12)) return false;

  // Points this far apart along the road are "unrelated": anything nearer is
  // the same corner or the same straight.
  const skip = Math.ceil(150 / POINT_STEP);
  const limit = MIN_CLEARANCE * MIN_CLEARANCE;
  for (let i = 0; i < n; i++) {
    for (let j = i + skip; j < n; j++) {
      if (n - (j - i) < skip) break;
      const dx = loop[j]!.x - loop[i]!.x;
      const dz = loop[j]!.z - loop[i]!.z;
      if (dx * dx + dz * dz < limit) return false;
    }
  }
  return true;
}

/** The start line: 45% down the longest straight, with room behind for the grid. */
function startLineIndex(points: TrackPoint[]): number {
  const n = points.length;
  const straight = (i: number) =>
    Math.abs(angleDelta(points[i % n]!.heading, points[(i + 1) % n]!.heading)) / POINT_STEP < STRAIGHT_CURVATURE;

  // Begin the scan just after a bend so a straight is never split by the seam.
  let begin = 0;
  for (let i = 0; i < n; i++) {
    if (!straight(i)) {
      begin = i + 1;
      break;
    }
  }

  let bestStart = 0;
  let bestLength = 0;
  let runStart = -1;
  for (let k = 0; k <= n; k++) {
    const i = begin + k;
    if (k < n && straight(i)) {
      if (runStart < 0) runStart = i;
      continue;
    }
    if (runStart >= 0 && i - runStart > bestLength) {
      bestLength = i - runStart;
      bestStart = runStart;
    }
    runStart = -1;
  }

  const into = Math.min(Math.max(Math.round(bestLength * 0.45), Math.min(7, bestLength - 1)), Math.max(0, bestLength - 2));
  return (bestStart + into) % n;
}

/**
 * Scatters dynamic obstacles (barricades, barrels, spikes, lasers, cones).
 */
function placeObstacles(rng: () => number, length: number): TrackObstacle[] {
  const obstacles: TrackObstacle[] = [];
  let distance = 140;

  /*
   * Spaced for racing rather than dodging: one every 120-270 m. Closer than
   * that and, on real tyres, the fastest line around a lap is a slalom, and
   * the race is decided by who hits the fewest barrels rather than who brakes
   * latest.
   */
  while (distance < length - 140) {
    distance += 120 + rng() * 150;
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

/**
 * Painted surface zones.
 *
 * Placed off the natural racing line far more often than on it. A slick or a
 * mud patch in the middle of the only viable line is not a decision, it is a
 * tax — every driver hits it every lap and the fastest route is unchanged. Put
 * it on the inside of a corner and it becomes a real question: cut and lose
 * grip, or stay wide and lose distance.
 */
function placeZones(
  rng: () => number,
  length: number,
  obstacles: TrackObstacle[],
): TrackZone[] {
  const zones: TrackZone[] = [];
  const count = Math.max(4, Math.floor(length / 260));

  for (let i = 0; i < count; i++) {
    const distance = Math.round(((i + 0.5) / count) * length + (rng() - 0.5) * 40);

    // Weighted so the punishing zones are commoner than the rewarding ones;
    // a track paved with boosts is just a faster track.
    const roll = rng();
    const kind: ZoneKind =
      roll < 0.3 ? "slow" : roll < 0.55 ? "slick" : roll < 0.75 ? "grip" : roll < 0.9 ? "boost" : "nitro";

    // Rewards sit off-line, hazards sit where a driver would want to cut.
    const offLine = kind === "boost" || kind === "nitro" || kind === "grip";
    const lateral = round2((offLine ? 0.45 : 0.3) * (rng() < 0.5 ? -1 : 1) + (rng() - 0.5) * 0.2);

    const zoneLength = kind === "slick" || kind === "slow" ? 26 + rng() * 22 : 18 + rng() * 14;

    /*
     * Never inside an obstacle: being stunned by a barrier while standing in a
     * slick reads as the slick having stunned you.
     *
     * Nudged along the track until it fits, rather than dropped. Dropping
     * skews the mix badly: hazards are placed nearer the racing line, which is
     * also where the obstacles are, so they were rejected far more often than
     * the rewards. Measured over five tracks that turned an intended 30% slow /
     * 25% slick into a field that was 54% grip — tracks that were, on balance,
     * helping the driver.
     */
    const clashes = (at: number) =>
      obstacles.some(
        (o) =>
          Math.abs(o.distance - at) < zoneLength &&
          Math.abs(o.lateral - lateral) < o.halfWidth + 0.3,
      );

    let placed = distance;
    for (let attempt = 0; attempt < 6 && clashes(placed); attempt++) {
      placed = distance + (attempt + 1) * Math.round(zoneLength * 1.5);
    }
    if (clashes(placed)) continue;

    zones.push({
      distance: Math.round(placed % length),
      lateral,
      kind,
      halfWidth: 0.26,
      length: Math.round(zoneLength),
    });
  }

  return zones;
}

/**
 * Power-ups along the track.
 *
 * Placed off the ideal line on purpose. A pickup sitting on the fastest route
 * is not a choice — everyone takes it every lap and it may as well be a passive
 * bonus. Two metres wide of the apex, it costs a tenth of a second to collect,
 * which is a decision.
 *
 * Roughly a third are mystery boxes, whose contents are decided at pickup time
 * rather than here: the client rebuilds the track from the seed, so anything
 * decided at generation is knowable in advance by anyone reading their own
 * memory.
 */
function placePickups(
  rng: () => number,
  length: number,
  obstacles: TrackObstacle[],
): TrackPickup[] {
  const pickups: TrackPickup[] = [];
  const count = Math.max(3, Math.floor(length / 340));

  for (let i = 0; i < count; i++) {
    const distance = Math.round(((i + 0.5) / count) * length + (rng() - 0.5) * 60);
    const lateral = round2((0.4 + rng() * 0.3) * (rng() < 0.5 ? -1 : 1));

    const blocked = obstacles.some(
      (o) => Math.abs(o.distance - distance) < 12 && Math.abs(o.lateral - lateral) < o.halfWidth + 0.3,
    );
    if (blocked) continue;

    const roll = rng();
    const kind: PickupKind | null =
      roll < 0.32
        ? null
        : roll < 0.5
          ? "nitro"
          : roll < 0.66
            ? "shield"
            : roll < 0.8
              ? "magnet"
              : roll < 0.92
                ? "repair"
                : "perfectNitro";

    pickups.push({ distance: Math.round(distance % length), lateral, kind });
  }

  return pickups;
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

/**
 * How far `to` is ahead of `from` around the loop, in (-length/2, length/2].
 *
 * The comparison every "is that car near me" question needs. Raw total
 * distances say a car one lap down is 2 km behind you when it is alongside,
 * which is how lapped cars used to drive straight through each other.
 */
export function lapDelta(track: TrackSpec, from: number, to: number): number {
  const length = track.length;
  let d = wrapDistance(track, to - from);
  if (d > length / 2) d -= length;
  return d;
}

/** Metres from `from` forward to the lap-local point `at`, in [0, length). */
export function distanceAhead(track: TrackSpec, from: number, at: number): number {
  return wrapDistance(track, at - from);
}

/**
 * Whether moving from total distance `previous` to `next` passes the lap-local
 * point `at` — on any lap, including across the finish-line seam.
 *
 * Half-open (previous, next], so an object exactly under a stationary car is
 * not struck every tick and one crossed exactly on a tick boundary is struck
 * once.
 */
export function crossedOnLap(track: TrackSpec, at: number, previous: number, next: number): boolean {
  const travelled = next - previous;
  if (!(travelled > 0)) return false;
  if (travelled >= track.length) return true;
  const ahead = wrapDistance(track, at - previous);
  return ahead > 0 && ahead <= travelled;
}

/** Whether a total distance lies within `length` metres after a lap-local start. */
export function withinOnLap(track: TrackSpec, start: number, length: number, distance: number): boolean {
  return wrapDistance(track, distance - start) <= length;
}

/**
 * World yaw of a vehicle for the renderer.
 *
 * Vehicle angles are right-positive relative to the road; track headings grow
 * to the left. Getting this sign wrong makes a drifting car point out of the
 * corner, so it lives here rather than in every caller.
 */
export function vehicleWorldYaw(trackHeading: number, heading: number): number {
  return trackHeading - heading;
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
