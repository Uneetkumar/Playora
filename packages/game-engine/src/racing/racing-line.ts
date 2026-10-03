import { sampleTrack } from "./track.js";
import type { TrackSpec } from "./types.js";

/**
 * Corner speed and braking distance.
 *
 * The bot used to decide "am I going too fast for the sharpest bend I can see"
 * and brake only once it already was. That is the one thing a driver must not
 * do: by the time you are over the limit at the corner, the corner is already
 * being taken badly. A real approach starts braking *before* the corner, at a
 * distance computed from how much speed has to come off.
 *
 * Both quantities here are physical rather than tuned constants, so they stay
 * sensible when a vehicle's grip or a track's curvature changes:
 *
 *   corner speed     v = sqrt(a_lat / |k|)     (a_lat = grip, k = curvature)
 *   braking distance d = (u^2 - v^2) / 2a      (standard kinematics)
 *
 * Track curvature is in radians per metre, so 1/|k| is the corner radius in
 * metres — a typical circuit here runs from about 120m at the tightest to
 * effectively straight.
 */

/** The phase of a corner, in the order a driver goes through them. */
export type CornerPhase = "straight" | "approach" | "brake" | "turn-in" | "apex" | "exit";

export interface CornerPlanInput {
  track: TrackSpec;
  /** Metres travelled along the centreline. */
  distance: number;
  /** Current speed, in the engine's units (metres per second). */
  speed: number;
  /** The vehicle's top speed. */
  maxSpeed: number;
  /**
   * The vehicle's cornering terms, straight from its tuning. A driver that
   * corners conservatively scales `steerRate` down, which is the same as
   * behaving like a car with less steering authority.
   */
  handling: { steerRate: number; centrifugal: number };
  /** Deceleration under braking, in m/s^2. */
  brakingPower: number;
  /** How far ahead to look, in metres. */
  lookahead: number;
  /**
   * Safety margin on the braking point, 0 to 1. A cautious driver brakes
   * earlier than the physics demands; an expert brakes closer to the limit.
   */
  margin?: number;
}

export interface CornerPlan {
  /** The speed the vehicle should be doing when it reaches the corner. */
  targetSpeed: number;
  /** Metres to the corner that set the target. */
  distanceToCorner: number;
  /** How hard to brake, 0 to 1. */
  brake: number;
  /** How much throttle to hold, 0 to 1. */
  throttle: number;
  phase: CornerPhase;
}

/**
 * The fastest a vehicle can hold a corner of the given curvature.
 *
 * Derived from the engine's own lateral equation rather than from a friction
 * circle. That distinction was not academic: the first version of this used
 * `v = sqrt(a_lat / k)`, which is right for a tyre-grip model and wrong for
 * this one, and it told the AI a 123m corner had to be taken at 44 m/s when
 * the engine happily holds it at 78. The bots braked hard for corners that
 * need no braking and lost 27% of their lap time.
 *
 * The engine holds a line when steering can counter the outward push:
 *
 *   steerRate * speedFactor  >=  |k| * v * centrifugal / downforce
 *
 * Above about a third of top speed `speedFactor` is 1, so the limit is
 *
 *   v = steerRate * downforce / (|k| * centrifugal)
 *
 * `downforce` itself grows with speed, so this settles on the answer by
 * iterating a few times — it converges immediately in practice.
 */
export function cornerSpeedFor(
  curvature: number,
  handling: { steerRate: number; centrifugal: number },
  maxSpeed: number,
): number {
  const k = Math.abs(curvature);
  if (k < 1e-6) return maxSpeed;

  let v = maxSpeed;
  // Ten passes: six leaves a visible residual just below the top-speed clamp.
  for (let i = 0; i < 10; i++) {
    const ratio = v / maxSpeed;
    const downforce = 1 + Math.min(0.55, ratio * ratio * 0.55);
    v = Math.min(maxSpeed, (handling.steerRate * downforce) / (k * handling.centrifugal));
  }
  return v;
}

/**
 * Distance needed to shed speed from `from` down to `to`.
 *
 * Zero when already slow enough — braking for a corner you are under the speed
 * for is how a bot ends up crawling round the whole lap.
 */
export function brakingDistance(from: number, to: number, brakingPower: number): number {
  if (from <= to) return 0;
  if (brakingPower <= 0) return Number.POSITIVE_INFINITY;
  return (from * from - to * to) / (2 * brakingPower);
}

/**
 * Looks ahead and decides what to do about the corner that matters.
 *
 * "Matters" is not "sharpest" — a hairpin 200m away needs action before a kink
 * 20m away does. Each sample is scored by how urgent its braking point is, and
 * the most urgent wins.
 */
export function planCorner(input: CornerPlanInput): CornerPlan {
  const {
    track,
    distance,
    speed,
    maxSpeed,
    handling,
    brakingPower,
    lookahead,
    margin = 0.25,
  } = input;

  const step = 8;
  let chosen: CornerPlan | null = null;
  let mostUrgent = -Number.POSITIVE_INFINITY;

  for (let ahead = 0; ahead <= lookahead; ahead += step) {
    const { curvature } = sampleTrack(track, distance + ahead);
    const target = cornerSpeedFor(curvature, handling, maxSpeed);
    if (target >= maxSpeed) continue;

    const needed = brakingDistance(speed, target, brakingPower) * (1 + margin);
    // How far past the braking point we already are. Positive means late.
    const urgency = needed - ahead;
    if (urgency > mostUrgent) {
      mostUrgent = urgency;
      chosen = {
        targetSpeed: target,
        distanceToCorner: ahead,
        brake: 0,
        throttle: 1,
        phase: "straight",
      };
    }
  }

  if (!chosen) {
    return {
      targetSpeed: maxSpeed,
      distanceToCorner: lookahead,
      brake: 0,
      throttle: 1,
      phase: "straight",
    };
  }

  const needed = brakingDistance(speed, chosen.targetSpeed, brakingPower) * (1 + margin);
  const slack = chosen.distanceToCorner - needed;

  if (slack > 20) {
    // Still far enough out to keep the throttle open.
    return { ...chosen, brake: 0, throttle: 1, phase: "approach" };
  }

  if (slack > 0) {
    // Inside the window: ease off rather than stamping on the brake.
    return { ...chosen, brake: 0, throttle: 0.35, phase: "approach" };
  }

  // Past the braking point. Brake harder the later we are, and trail off as
  // the speed comes down to target — which is what produces the strong brake,
  // trail brake, turn-in sequence rather than an on/off pedal.
  const excess = speed - chosen.targetSpeed;
  const brake = Math.min(1, Math.max(0.2, -slack / 25 + excess / Math.max(1, chosen.targetSpeed)));

  if (chosen.distanceToCorner < 12) {
    // At the corner. Braking is done; the speed is whatever it is.
    return {
      ...chosen,
      brake: excess > 2 ? 0.3 : 0,
      throttle: excess > 2 ? 0 : 0.6,
      phase: excess > 2 ? "turn-in" : "apex",
    };
  }

  return { ...chosen, brake, throttle: 0, phase: "brake" };
}
