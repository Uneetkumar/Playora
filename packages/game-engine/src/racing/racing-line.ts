import { clamp, datan, dcos, dsin } from "./dmath.js";
import { sampleTrack } from "./track.js";
import { GRAVITY, maxSteerTan, type VehicleTuning } from "./vehicle-physics.js";
import { ROAD_HALF_WIDTH, type TrackSpec, type VehicleState } from "./types.js";

/**
 * Corner speed, braking distance and steering, from the same physics the
 * engine runs.
 *
 * A planner with its own idea of grip drives a different car from the one on
 * the road: the first version of this file used a lane-change model while the
 * engine used another and the bots braked for corners that needed nothing.
 * Everything here is the friction circle the engine enforces:
 *
 *   corner speed     v^2 |k| = mu (g + d v^2)   (d = downforce per kg per v^2)
 *   braking distance (u^2 - v^2) / 2a
 *
 * Curvature is radians per metre (1/radius), right-positive.
 */

/** The phase of a corner, in the order a driver goes through them. */
export type CornerPhase = "straight" | "approach" | "brake" | "turn-in" | "apex" | "exit";

/** How hard a vehicle can corner: tyre friction and downforce per kilogram. */
export interface CornerGrip {
  mu: number;
  /** Downforce acceleration per (m/s)^2: liftK / mass. */
  liftPerMass: number;
}

export function cornerGripOf(t: VehicleTuning, scale = 1): CornerGrip {
  return { mu: t.mu * scale, liftPerMass: t.liftK / t.mass };
}

export interface CornerPlanInput {
  track: TrackSpec;
  /** Metres travelled along the centreline. */
  distance: number;
  /** Current speed, metres per second. */
  speed: number;
  /** The vehicle's top speed. */
  maxSpeed: number;
  /** The vehicle's grip. A cautious driver passes a scaled-down mu. */
  grip: CornerGrip;
  /** Deceleration under braking, m/s^2. */
  brakingPower: number;
  /** How far ahead to look, in metres. */
  lookahead: number;
  /**
   * Safety margin on the braking point, 0 to 1. A cautious driver brakes
   * earlier than the physics demands; an expert brakes closer to the limit.
   */
  margin?: number;
  /**
   * How much of the centreline's curvature the driver's line actually takes.
   * Using the full width of the road opens a corner up; 1 drives the centre.
   */
  lineFactor?: number;
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
 * The fastest a corner of this curvature can be held: lateral demand v^2 k
 * against the friction circle mu (g + downforce). Downforce grows with v^2
 * too, which is why a winged car's limit can run away to "flat out" — when
 * mu d >= k the corner never binds and the top speed is the limit.
 */
export function cornerSpeedFor(curvature: number, grip: CornerGrip, maxSpeed: number): number {
  const k = Math.abs(curvature);
  if (k < 1e-6) return maxSpeed;
  const denom = k - grip.mu * grip.liftPerMass;
  if (denom <= 0) return maxSpeed;
  return Math.min(maxSpeed, Math.sqrt((grip.mu * GRAVITY) / denom));
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
    grip,
    brakingPower,
    lookahead,
    margin = 0.25,
    lineFactor = 1,
  } = input;

  const step = 8;
  let chosen: CornerPlan | null = null;
  let mostUrgent = -Number.POSITIVE_INFINITY;

  for (let ahead = 0; ahead <= lookahead; ahead += step) {
    const { curvature } = sampleTrack(track, distance + ahead);
    const target = cornerSpeedFor(curvature * lineFactor, grip, maxSpeed);
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

/**
 * The steering input that brings a vehicle onto a lateral line.
 *
 * Steering in this engine sets a yaw rate, not a sideways speed, so pointing
 * the wheel at the target is not enough: a driver has to aim the car's course
 * at the line and take the aim off again as it arrives, or it weaves. This is
 * that driver — feed-forward for the road's own curve, plus a course that
 * closes the gap over about a second, plus a yaw correction onto that course
 * — returned as the -1..1 input the engine expects.
 */
export function steerToward(
  t: VehicleTuning,
  vehicle: Pick<VehicleState, "distance" | "lateral" | "speed" | "heading" | "slip">,
  track: TrackSpec,
  targetLateral: number,
  /** Seconds over which to close the lateral gap; shorter is twitchier. */
  closeTime = 1.1,
): number {
  const v = Math.max(vehicle.speed, 3);
  const preview = vehicle.distance + v * 0.12;
  const { curvature } = sampleTrack(track, preview);
  const n = vehicle.lateral * ROAD_HALF_WIDTH;
  const feedForward = curvature / Math.max(0.35, 1 - n * curvature);

  const error = (targetLateral - vehicle.lateral) * ROAD_HALF_WIDTH;
  const desiredCourse = clamp(datan(error / Math.max(6, v * closeTime)), -0.45, 0.45);
  const course = vehicle.heading - vehicle.slip;
  const courseError = desiredCourse - course;
  // Turn the course onto the desired one over ~0.35 s: a yaw rate, as path curvature.
  const pathCurvature = feedForward + courseError / Math.max(v * 0.35, 2.5);

  const grip = t.mu * (GRAVITY + (t.liftK * v * v) / t.mass);
  const tanMax = maxSteerTan(t, v, grip);
  return clamp((pathCurvature * t.wheelbase) / tanMax, -1, 1);
}

/** Unit vector of a vehicle's travel in track space, for callers that want one. */
export function travelDirection(vehicle: Pick<VehicleState, "heading" | "slip">): {
  along: number;
  across: number;
} {
  const course = vehicle.heading - vehicle.slip;
  return { along: dcos(course), across: dsin(course) };
}
