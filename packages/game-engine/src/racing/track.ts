import { createRng, seedFromString } from "../lib/rng.js";
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
 * The tightest corner that can be driven at all.
 *
 * This was 0.028 — a 36m radius — chosen as the tightest bend holdable *at top
 * speed*. That was the right bound for a game where nothing required braking
 * and the wrong one once corners are meant to.
 *
 * The threshold matters and was measured rather than guessed: this car holds
 * anything above about a 28m radius flat out, so 0.033 (30m) still produced
 * zero braking points on a lap. 0.045 is a 22m radius, taken at roughly
 * 43 m/s against a top speed of 78 — which needs about 106m of braking, and is
 * therefore an actual corner.
 *
 * `tame` pulls anything tighter than this back, so it is a real bound rather
 * than an aspiration.
 */
export const MAX_CURVATURE = 0.05;

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

/**
 * The closed centreline, sampled at even distances.
 *
 * Built in polar form and then resampled by arc length, because a curve that is
 * even in angle is not even in distance — the outside of a bend would get fewer
 * points than the inside, and the road would be built from stretched quads
 * exactly where it turns.
 */
/** One pass of the radial curve, at a given harmonic amplitude scale. */
function traceHarmonics(
  harmonics: Array<{ k: number; amplitude: number; phase: number }>,
  scaleAmplitude: number,
  targetLength: number,
): Array<{ x: number; z: number }> {
  const radiusAt = (theta: number) =>
    1 +
    harmonics.reduce(
      (sum, h) => sum + h.amplitude * scaleAmplitude * Math.sin(h.k * theta + h.phase),
      0,
    );

  const FINE = 8192;
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

  return raw;
}

/** The tightest bend in a traced curve, as a curvature. */
function peakCurvature(raw: Array<{ x: number; z: number }>): number {
  let worst = 0;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]!;
    const b = raw[(i + 1) % raw.length]!;
    const c = raw[(i + 2) % raw.length]!;
    const h1 = Math.atan2(b.x - a.x, b.z - a.z);
    const h2 = Math.atan2(c.x - b.x, c.z - b.z);
    worst = Math.max(worst, Math.abs(angleDelta(h1, h2)) / POINT_STEP);
  }
  return worst;
}

function buildCentreline(rng: () => number, targetLength: number): TrackPoint[] {
  /*
   * Harmonics strong enough to make corners.
   *
   * These were [2,3,4,5] at (0.05 + r * 0.13) / (k * 0.55), and measured across
   * generated tracks the tightest bend that produced was a 103m radius. This
   * car holds anything above about a 28m radius flat out, so *no corner on any
   * track required braking* — which is why racing felt flat and why the AI
   * never had a reason to lift.
   */
  const harmonics = [2, 3, 4, 5, 6, 7].map((k) => ({
    k,
    amplitude: (0.1 + rng() * 0.2) / (k * 0.5),
    phase: rng() * Math.PI * 2,
  }));

  /*
   * Corners kept inside the drivable limit by reducing amplitude, not by
   * dragging points around afterwards.
   *
   * The old `tame` pulled every point toward the mean radius whenever a bend
   * was too tight. That does not preserve closure: on one seed it left the lap
   * 3.4m short of joining itself, which is a visible kink in a 16m-wide road.
   * A radial curve of this form is closed at *any* amplitude, so turning the
   * amplitude down and re-tracing keeps the loop exact for free.
   */
  let amplitude = 1;
  let raw = traceHarmonics(harmonics, amplitude, targetLength);
  for (let pass = 0; pass < 8; pass++) {
    const peak = peakCurvature(raw);
    // 0.94 of the limit: this estimates curvature from three consecutive
    // points while the segment table measures it between consecutive heading
    // deltas, and the two differ by a percent or two on the tightest bends.
    const ceiling = MAX_CURVATURE * 0.94;
    if (peak <= ceiling) break;
    amplitude *= Math.max(0.55, Math.sqrt(ceiling / peak));
    raw = traceHarmonics(harmonics, amplitude, targetLength);
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

  return rotated;
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
