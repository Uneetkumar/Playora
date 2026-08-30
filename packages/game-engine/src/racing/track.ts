import { createRng, seedFromString } from "../lib/rng.js";
import type { TrackObject, TrackObstacle, TrackSegment, TrackSpec } from "./types.js";

/** Length of one road segment, in metres. Short enough to curve smoothly. */
const SEGMENT_LENGTH = 20;

const CHECKPOINT_COUNT = 4;

/**
 * How far one corner may turn before it has to straighten out, in radians.
 *
 * Without a cap, curvature drifts and stays put: sustained maximum curvature is
 * a circle of about thirty metres' radius, so a long track spirals into itself.
 * The road then renders across its own path and the driver sees walls crossing
 * a road they will never reach.
 */
const MAX_CORNER_RADIANS = Math.PI * 0.45;

/** Beyond this total heading, new corners are biased back the other way. */
const HEADING_BUDGET = Math.PI * 0.75;

/**
 * Builds a race track from a seed.
 *
 * Deterministic on purpose, and for the same reason the deck is: the server
 * sends every client the seed, each builds the identical road, and no track
 * geometry ever has to travel over the wire. It also means a replay of a match
 * reproduces the exact track it was raced on.
 *
 * The layout is a sequence of constant-curvature segments rather than a spline.
 * That keeps the physics honest — curvature at any distance is a lookup, not a
 * derivative — and it is what lets the renderer build the road as a ribbon.
 */
export function buildTrack(seedSource: string | number, length: number): TrackSpec {
  const seed = typeof seedSource === "number" ? seedSource : seedFromString(seedSource);
  const rng = createRng(seed);

  const segmentCount = Math.max(8, Math.ceil(length / SEGMENT_LENGTH));
  const segments: TrackSegment[] = [];

  // Curvature is walked rather than drawn independently per segment: picking a
  // fresh random curve each time gives a road that zigzags every 20 metres,
  // which is unreadable to drive and unpleasant to look at.
  let curvature = 0;
  let gradient = 0;
  /** Radians turned so far in the corner currently being driven. */
  let cornerHeading = 0;
  /** Radians turned over the whole track, used to keep it from spiralling. */
  let totalHeading = 0;

  for (let i = 0; i < segmentCount; i++) {
    // The first stretch is straight so the grid and the countdown are readable.
    const isOpening = i < 6;
    // The last stretch is straight so the finish line is approached cleanly.
    const isClosing = i > segmentCount - 5;

    if (isOpening || isClosing) {
      curvature += (0 - curvature) * 0.5;
      gradient += (0 - gradient) * 0.5;
      cornerHeading = 0;
    } else if (Math.abs(cornerHeading) >= MAX_CORNER_RADIANS) {
      // This corner has turned far enough. Unwind to a straight before the
      // road is allowed to bend again.
      // Unwound briskly: a gentle taper keeps turning while it straightens,
      // and the corner overshoots its budget by most of a right angle before
      // the curvature is actually gone.
      curvature += (0 - curvature) * 0.7;
      if (Math.abs(curvature) < 0.004) {
        curvature = 0;
        cornerHeading = 0;
      }
    } else {
      // Occasionally commit to a new corner; otherwise drift towards the
      // current one. The result is recognisable straights and bends.
      if (rng() < 0.12) {
        const magnitude = rng() * 0.02 + 0.004;
        // A track that has wandered a long way one way is steered back, so it
        // stays a road going somewhere rather than a spiral.
        const direction =
          totalHeading > HEADING_BUDGET
            ? -1
            : totalHeading < -HEADING_BUDGET
              ? 1
              // Corners alternate more often than not, the way a real circuit
              // does. Left after right also keeps the track from wandering.
              : curvature !== 0 && rng() < 0.7
                ? -Math.sign(curvature)
                : rng() < 0.5
                  ? -1
                  : 1;

        // The budget only resets when the road actually changes direction. A
        // "new" corner the same way as the old one is the same corner
        // continuing, and resetting there lets it sweep round indefinitely.
        if (curvature === 0 || Math.sign(direction) !== Math.sign(curvature)) {
          cornerHeading = 0;
        }
        curvature = magnitude * direction;
      } else {
        curvature += (rng() - 0.5) * 0.004;
      }
      // Capped so the tightest corner stays inside the steering authority of
      // the slowest-turning vehicle. Above this the centrifugal push at top
      // speed exceeds full lock, and the bend becomes impossible rather than
      // difficult — no input keeps the car on the road.
      curvature = clamp(curvature, -0.03, 0.03);

      if (rng() < 0.1) gradient = (rng() - 0.5) * 0.12;
      gradient = clamp(gradient, -0.08, 0.08);
    }

    const turned = curvature * SEGMENT_LENGTH;
    cornerHeading += turned;
    totalHeading += turned;

    segments.push({ length: SEGMENT_LENGTH, curvature, gradient });
  }

  const obstacles = placeObstacles(rng, length);
  const coins = placeCoins(rng, length, obstacles);

  const checkpoints = Array.from(
    { length: CHECKPOINT_COUNT },
    (_, i) => Math.round((length * (i + 1)) / CHECKPOINT_COUNT),
  );

  return { seed, length, segments, obstacles, coins, checkpoints };
}

/**
 * Scatters obstacles, leaving a gap that is always driveable.
 *
 * The important rule is the last one: whatever is placed across a given stretch
 * of road, at least one lateral corridor stays clear. A track that can be
 * blocked outright is not difficult, it is broken.
 */
function placeObstacles(rng: () => number, length: number): TrackObstacle[] {
  const obstacles: TrackObstacle[] = [];
  // Nothing in the first 150 m: the player is still reading the road.
  let distance = 150;

  while (distance < length - 80) {
    distance += 60 + rng() * 110;
    if (distance >= length - 80) break;

    const roll = rng();
    const kind: TrackObstacle["kind"] = roll < 0.5 ? "cone" : roll < 0.82 ? "block" : "barrier";
    const halfWidth = kind === "cone" ? 0.1 : kind === "block" ? 0.18 : 0.3;

    // A barrier is wide, so it is pushed towards one side and never centred.
    const lateral =
      kind === "barrier"
        ? (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.35)
        : (rng() - 0.5) * 1.6;

    obstacles.push({ distance: Math.round(distance), lateral: round2(lateral), kind, halfWidth });

    // A second obstacle alongside, only where a clear corridor survives.
    if (rng() < 0.35) {
      const otherSide = -Math.sign(lateral || 1) * (0.4 + rng() * 0.4);
      const gap = Math.abs(otherSide - lateral) - halfWidth - 0.18;
      if (gap > 0.45) {
        obstacles.push({
          distance: Math.round(distance),
          lateral: round2(otherSide),
          kind: "cone",
          halfWidth: 0.1,
        });
      }
    }
  }

  return obstacles;
}

/** Coins run in short lines, and never inside an obstacle. */
function placeCoins(
  rng: () => number,
  length: number,
  obstacles: TrackObstacle[],
): TrackObject[] {
  const coins: TrackObject[] = [];
  let distance = 60;

  while (distance < length - 40) {
    distance += 50 + rng() * 90;
    const lateral = round2((rng() - 0.5) * 1.5);
    const runLength = 3 + Math.floor(rng() * 5);

    for (let i = 0; i < runLength; i++) {
      const at = Math.round(distance + i * 8);
      if (at >= length - 20) break;
      // Skip any coin that would sit inside an obstacle: an uncollectable coin
      // reads as a bug, and a coin that lures the player into a barrier is worse.
      const blocked = obstacles.some(
        (o) => Math.abs(o.distance - at) < 12 && Math.abs(o.lateral - lateral) < o.halfWidth + 0.2,
      );
      if (!blocked) coins.push({ distance: at, lateral });
    }
    distance += runLength * 8;
  }

  return coins;
}

/** Curvature and gradient at a distance along the track. */
export function sampleTrack(
  track: TrackSpec,
  distance: number,
): { curvature: number; gradient: number } {
  const index = Math.floor(Math.max(0, distance) / SEGMENT_LENGTH);
  const segment = track.segments[Math.min(index, track.segments.length - 1)];
  return segment
    ? { curvature: segment.curvature, gradient: segment.gradient }
    : { curvature: 0, gradient: 0 };
}

/**
 * The centreline in world space, for the renderer.
 *
 * Integrating heading over the segments here — rather than in the renderer —
 * means the geometry the player drives on and the geometry they see come from
 * one calculation. Two integrations would drift apart, and the car would visibly
 * corner differently from the road.
 */
export function trackCenterline(
  track: TrackSpec,
  step = SEGMENT_LENGTH,
): Array<{ x: number; y: number; z: number; heading: number; distance: number }> {
  const points: Array<{ x: number; y: number; z: number; heading: number; distance: number }> = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let heading = 0;

  for (let distance = 0; distance <= track.length; distance += step) {
    points.push({ x, y, z, heading, distance });
    const { curvature, gradient } = sampleTrack(track, distance);
    heading += curvature * step;
    x += Math.sin(heading) * step;
    z += Math.cos(heading) * step;
    y += gradient * step;
  }
  return points;
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
 * the geometrically obvious normal, steering right moved the car to the left
 * of the picture — a bug that is invisible in every still frame and obvious the
 * instant anybody drives. Encoding it here means it is asserted, not eyeballed.
 */
export function trackToWorld(
  centerline: ReturnType<typeof trackCenterline>,
  distance: number,
  lateral: number,
  halfWidth: number,
  step: number,
): WorldPoint | null {
  if (centerline.length === 0) return null;

  const raw = distance / step;
  const index = Math.floor(raw);
  const t = raw - index;

  const a = centerline[Math.min(centerline.length - 1, Math.max(0, index))]!;
  const b = centerline[Math.min(centerline.length - 1, Math.max(0, index + 1))]!;

  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const z = a.z + (b.z - a.z) * t;
  const heading = a.heading + (b.heading - a.heading) * t;

  const offset = lateral * halfWidth;
  return {
    x: x - Math.cos(heading) * offset,
    y,
    z: z + Math.sin(heading) * offset,
    heading,
  };
}

export const SEGMENT_METRES = SEGMENT_LENGTH;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
