import { clamp, dtan, sampleCurve, PI } from "./dmath.js";
import { ROAD_HALF_WIDTH, TICK_RATE, TICK_SECONDS } from "./types.js";

/**
 * Vehicle physics, derived from a spec sheet.
 *
 * Every number the simulation uses comes from something a manufacturer would
 * print: mass, power, gearing, tyre and aero figures. Nothing is a "speed
 * multiplier". The one derived quantity worth calling out is drag: it is
 * solved from the quoted top speed and the power available there, so a car
 * listed at 311 km/h tops out at 311 km/h in the simulation by construction
 * rather than by tuning.
 */

export const GRAVITY = 9.81;
export const AIR_DENSITY = 1.225;

export type Drivetrain = "RWD" | "AWD" | "FWD";

/** The physical description a garage entry carries. Authored, not derived. */
export interface VehiclePhysicsSpec {
  kind: "car" | "bike";
  drivetrain: Drivetrain;
  massKg: number;
  powerKw: number;
  topSpeedKmh: number;
  lengthM: number;
  widthM: number;
  wheelbaseM: number;
  /** Static weight share on the rear axle. */
  rearShare: number;
  cgHeightM: number;
  wheelRadiusM: number;
  idleRpm: number;
  redlineRpm: number;
  /** Full-throttle torque at 0%, 10% ... 100% of redline; the peak is 1. */
  torqueCurve: readonly number[];
  /** Gearbox ratios, first to top. The final drive is solved from top speed. */
  gearRatios: readonly number[];
  shiftMs: number;
  drivelineEfficiency: number;
  /** Lift coefficient times frontal area (ClA), m^2. Downforce grows with v^2. */
  downforceArea: number;
  rollingResistance: number;
  /** Peak tyre friction on dry tarmac. */
  tyreGrip: number;
  /** Friction while sliding, as a fraction of the peak. */
  slideGrip: number;
  /** What the brake system alone can do, in g. Tyres usually run out first. */
  brakeG: number;
  steerLockDeg: number;
  /** 0 planted .. 1 loose: how readily the rear steps out under power. */
  looseness: number;
  /** 0 tarmac-only .. 1 rally: how little loose and slippery surfaces cost. */
  looseSurface: number;
  /** Largest slip angle a held drift settles at, degrees. */
  driftAngleDeg: number;
  /** 0 none .. 1 full: how much of an over-torque request is trimmed rather than spun. */
  tractionControl: number;
  /** Contact sensitivity: speed lost and stun from car contact. 1 = road car. */
  fragility: number;
}

/** Everything the simulation reads per vehicle, precomputed once. */
export interface VehicleTuning {
  id: string;
  kind: "car" | "bike";
  drivetrain: Drivetrain;
  mass: number;
  length: number;
  width: number;
  /** Half the width in lateral units (1 = the road half-width). */
  halfWidth: number;
  /** Half the length, metres. */
  halfLength: number;
  wheelbase: number;
  rearShare: number;
  /** Static share of weight on the driven wheels. */
  drivenShare: number;
  cgHeight: number;
  wheelRadius: number;
  idleRpm: number;
  redlineRpm: number;
  /** Clutch-slip rpm held while launching. */
  launchRpm: number;
  peakTorque: number;
  torqueCurve: readonly number[];
  gearRatios: readonly number[];
  finalDrive: number;
  drivelineEfficiency: number;
  shiftTicks: number;
  /** Fraction above redline a boost may run before the limiter cuts. */
  overrev: number;
  /** 0.5 * rho * CdA: drag force is dragK * v^2. */
  dragK: number;
  /** 0.5 * rho * ClA: downforce is liftK * v^2. */
  liftK: number;
  rollingResistance: number;
  mu: number;
  slideMu: number;
  /** Brake-system deceleration cap, m/s^2. */
  brakeDecel: number;
  /** Longitudinal acceleration at which the front wheel lifts (bikes; cars never reach it). */
  wheelieAccel: number;
  /** Deceleration at which the rear wheel lifts. */
  stoppieDecel: number;
  /** Full lock at parking speed, radians. */
  steerLock: number;
  looseness: number;
  looseSurface: number;
  driftMaxSlip: number;
  tractionControl: number;
  fragility: number;
  /** Quoted top speed, m/s. */
  maxSpeed: number;
  /** Typical braking at 100 km/h on tarmac, m/s^2. For planners and bots. */
  brakePower: number;
  /** Stun after a heavy hit, ticks. */
  crashStunTicks: number;
  /** Speed kept after hitting a hard obstacle. */
  crashPenalty: number;
  /** Peak power, watts. */
  powerW: number;
}

const RPM_TO_RAD = (2 * PI) / 60;

export function deriveTuning(id: string, spec: VehiclePhysicsSpec): VehicleTuning {
  const maxSpeed = spec.topSpeedKmh / 3.6;
  const redlineOmega = spec.redlineRpm * RPM_TO_RAD;
  const topRatio = spec.gearRatios[spec.gearRatios.length - 1] ?? 1;

  /*
   * Gearing: top gear reaches redline a little above the quoted top speed, so
   * the car is drag-limited just under the limiter — the usual road-car
   * arrangement — and a boost has some rev range left to use.
   */
  const overspeed = spec.kind === "bike" ? 1.04 : 1.05;
  const finalDrive = (redlineOmega * spec.wheelRadiusM) / (maxSpeed * overspeed * topRatio);

  // Peak torque such that the curve's best torque * omega is the quoted power.
  let bestShape = 0;
  for (let i = 1; i <= 200; i++) {
    const x = i / 200;
    const p = sampleCurve(spec.torqueCurve, x) * x * redlineOmega;
    if (p > bestShape) bestShape = p;
  }
  const powerW = spec.powerKw * 1000;
  const peakTorque = powerW / Math.max(1, bestShape);

  // Drag solved from the power available at the quoted top speed in top gear.
  const rpmAtTop = (maxSpeed / spec.wheelRadiusM) * topRatio * finalDrive / RPM_TO_RAD;
  const torqueAtTop = peakTorque * sampleCurve(spec.torqueCurve, rpmAtTop / spec.redlineRpm);
  const powerAtTop = torqueAtTop * rpmAtTop * RPM_TO_RAD * spec.drivelineEfficiency;
  const rolling = spec.rollingResistance * spec.massKg * GRAVITY;
  const dragK = Math.max(0.05, (powerAtTop / maxSpeed - rolling) / (maxSpeed * maxSpeed));

  const frontShare = 1 - spec.rearShare;
  const drivenShare =
    spec.drivetrain === "AWD" ? 1 : spec.drivetrain === "FWD" ? frontShare : spec.rearShare;

  return {
    id,
    kind: spec.kind,
    drivetrain: spec.drivetrain,
    mass: spec.massKg,
    length: spec.lengthM,
    width: spec.widthM,
    halfWidth: spec.widthM / 2 / ROAD_HALF_WIDTH,
    halfLength: spec.lengthM / 2,
    wheelbase: spec.wheelbaseM,
    rearShare: spec.rearShare,
    drivenShare,
    cgHeight: spec.cgHeightM,
    wheelRadius: spec.wheelRadiusM,
    idleRpm: spec.idleRpm,
    redlineRpm: spec.redlineRpm,
    launchRpm: spec.redlineRpm * (spec.kind === "bike" ? 0.5 : 0.45),
    peakTorque,
    torqueCurve: spec.torqueCurve,
    gearRatios: spec.gearRatios,
    finalDrive,
    drivelineEfficiency: spec.drivelineEfficiency,
    shiftTicks: Math.max(1, Math.round((spec.shiftMs / 1000) * TICK_RATE)),
    overrev: 0.05,
    dragK,
    liftK: 0.5 * AIR_DENSITY * spec.downforceArea,
    rollingResistance: spec.rollingResistance,
    mu: spec.tyreGrip,
    slideMu: spec.slideGrip,
    brakeDecel: spec.brakeG * GRAVITY,
    // A lifting wheel ends the axle's contribution: the bike's rear-weight
    // geometry, not its engine, is what limits a launch and a stop.
    wheelieAccel: (GRAVITY * frontShare * spec.wheelbaseM) / spec.cgHeightM,
    stoppieDecel: (GRAVITY * spec.rearShare * spec.wheelbaseM) / spec.cgHeightM,
    steerLock: (spec.steerLockDeg * PI) / 180,
    looseness: spec.looseness,
    looseSurface: spec.looseSurface,
    driftMaxSlip: (spec.driftAngleDeg * PI) / 180,
    tractionControl: spec.tractionControl,
    fragility: spec.fragility,
    maxSpeed,
    brakePower: brakingDecel(spec, 27.8),
    crashStunTicks: spec.kind === "bike" ? 48 : 30,
    crashPenalty: spec.kind === "bike" ? 0.18 : clamp(0.42 - 0.08 * spec.fragility, 0.2, 0.4),
    powerW,
  };
}

/** Straight-line braking the tyres and brakes allow at a speed, m/s^2. */
function brakingDecel(spec: VehiclePhysicsSpec, v: number): number {
  const down = (0.5 * AIR_DENSITY * spec.downforceArea * v * v) / spec.massKg;
  const tyre = spec.tyreGrip * (GRAVITY + down);
  const stoppie = (GRAVITY * spec.rearShare * spec.wheelbaseM) / spec.cgHeightM;
  return Math.min(tyre, spec.brakeG * GRAVITY, stoppie);
}

/** Overall ratio (gearbox * final drive) in a gear, 1-based. */
export function overallRatio(t: VehicleTuning, gear: number): number {
  const ratio = t.gearRatios[clamp(gear, 1, t.gearRatios.length) - 1] ?? 1;
  return ratio * t.finalDrive;
}

/** Engine rpm locked to the wheels in a gear. */
export function wheelRpm(t: VehicleTuning, speed: number, gear: number): number {
  return ((speed / t.wheelRadius) * overallRatio(t, gear)) / RPM_TO_RAD;
}

/** Full-throttle torque at an rpm, Nm. */
export function engineTorque(t: VehicleTuning, rpm: number): number {
  return t.peakTorque * sampleCurve(t.torqueCurve, rpm / t.redlineRpm);
}

/** Full-throttle power at an rpm, W. */
export function enginePower(t: VehicleTuning, rpm: number): number {
  return engineTorque(t, rpm) * rpm * RPM_TO_RAD;
}

/** Downforce per kilogram at a speed, m/s^2. */
export function downforceAccel(t: VehicleTuning, speed: number): number {
  return (t.liftK * speed * speed) / t.mass;
}

/**
 * The largest drive force the driven tyres can put down, N.
 *
 * Weight moves rearwards under acceleration, which helps a rear-driven car and
 * robs a front-driven one; solving for that transfer is the closed form below.
 * `lateralUse` is how much of the friction circle cornering already takes.
 */
export function tractionLimit(
  t: VehicleTuning,
  normalAccel: number,
  mu: number,
  lateralUse: number,
): number {
  const weight = t.mass * normalAccel;
  const transfer = (mu * t.cgHeight) / t.wheelbase;
  let limit: number;
  if (t.drivetrain === "AWD") limit = mu * weight;
  else if (t.drivetrain === "FWD") limit = (mu * weight * t.drivenShare) / (1 + transfer);
  else limit = (mu * weight * t.drivenShare) / Math.max(0.55, 1 - transfer);
  // A bike's launch ends at the wheelie, not at the tyre.
  limit = Math.min(limit, t.mass * t.wheelieAccel);
  const used = clamp(lateralUse, 0, 1);
  return limit * Math.sqrt(Math.max(0.12, 1 - 0.9 * used * used));
}

/** Gear that keeps the engine nearest its power peak at a speed — used on a rolling start. */
export function bestGearFor(t: VehicleTuning, speed: number): number {
  let gear = 1;
  for (let g = 1; g <= t.gearRatios.length; g++) {
    if (wheelRpm(t, speed, g) <= t.redlineRpm * 0.92) {
      gear = g;
      break;
    }
    gear = g;
  }
  return gear;
}

/**
 * 0-100 km/h, simulated with the same force model the race uses.
 *
 * Flat road, full throttle from a perfect launch, shifting at the limiter.
 * The garage's acceleration bar and the spec-sheet test both read this, so a
 * figure on a card is one the car actually achieves.
 */
export function simulateZeroTo100(t: VehicleTuning): number {
  let v = 0;
  let gear = 1;
  let shift = 0;
  const dt = TICK_SECONDS;
  for (let tick = 1; tick < TICK_RATE * 20; tick++) {
    let drive = 0;
    if (shift > 0) {
      shift -= 1;
    } else {
      let rpm = wheelRpm(t, v, gear);
      if (rpm >= t.redlineRpm * 0.985 && gear < t.gearRatios.length) {
        gear += 1;
        shift = t.shiftTicks;
        continue;
      }
      rpm = Math.max(rpm, t.launchRpm);
      drive = (engineTorque(t, Math.min(rpm, t.redlineRpm)) * overallRatio(t, gear) * t.drivelineEfficiency) / t.wheelRadius;
    }
    const normal = GRAVITY + downforceAccel(t, v);
    drive = Math.min(drive, tractionLimit(t, normal, t.mu, 0));
    const resist = t.dragK * v * v + t.rollingResistance * t.mass * GRAVITY;
    v += ((drive - resist) / t.mass) * dt;
    if (v >= 100 / 3.6) return tick * dt;
  }
  return 20;
}

/**
 * How far full lock turns the front wheels at a speed, as tan(angle).
 *
 * Speed-sensitive, the way a racing driver's hands are: at parking speed the
 * rack's full lock; at speed, only as much as the tyres can use plus a little
 * (15%) so a driver can still overdrive into understeer. Without the limit a
 * keyboard's full lock at 250 km/h is a 40-degree flick and an instant spin.
 */
export function maxSteerTan(t: VehicleTuning, speed: number, gripAccel: number): number {
  const lock = dtan(t.steerLock);
  if (speed < 1) return lock;
  return Math.min(lock, (1.15 * gripAccel * t.wheelbase) / (speed * speed));
}

/** Steady lateral grip at a speed, in g. */
export function lateralG(t: VehicleTuning, speed: number): number {
  return (t.mu * (GRAVITY + downforceAccel(t, speed))) / GRAVITY;
}
