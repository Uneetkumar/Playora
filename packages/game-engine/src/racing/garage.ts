import type { GameId } from "@playora/game-types";
import {
  deriveTuning,
  lateralG,
  simulateZeroTo100,
  type Drivetrain,
  type VehiclePhysicsSpec,
  type VehicleTuning,
} from "./vehicle-physics.js";

/**
 * The one roster.
 *
 * There used to be three — the garage UI's, this file's and the model
 * builder's — and none of them reached the race. Now a vehicle is one record:
 * the spec sheet a player reads, the physics the engine runs and the model the
 * renderer draws all hang off the same id, and the stat bars are derived from
 * the physics so the garage cannot claim a car is quick when it is not.
 *
 * Numbers are real-world class figures, balanced the way GT racing balances a
 * grid (weight and power trimmed so every car can win somewhere), not copied
 * from any one manufacturer.
 */

export type CarModelId = "gt" | "supercar" | "hatch" | "muscle" | "rally" | "formula";
export type BikeModelId = "bike-sport" | "bike-hyper" | "bike-light" | "bike-naked";
export type PaintFinish = "solid" | "metallic" | "pearl" | "matte";

/** The spec sheet a player reads. Every figure is one the simulation honours. */
export interface VehicleSpecSheet {
  lengthM: number;
  widthM: number;
  heightM: number;
  wheelbaseM: number;
  massKg: number;
  powerKw: number;
  drivetrain: Drivetrain;
  topSpeedKmh: number;
  zeroTo100S: number;
  /** Peak torque, derived from the power and the engine's curve. */
  torqueNm: number;
  /** Engine, as a brochure would put it. */
  engine: string;
  gears: number;
}

/** The 0-10 bars shown in the garage. */
export interface VehicleStats {
  speed: number;
  acceleration: number;
  handling: number;
  braking: number;
}

export interface VehicleSpec {
  id: string;
  name: string;
  kind: "car" | "bike";
  blurb: string;
  /** Which procedural model draws it: a CarModelId for cars, a BikeModelId for bikes. */
  modelId: string;
  /** e.g. "GT coupe". */
  className: string;
  /** Factory paint, '#rrggbb'. */
  defaultPaint: string;
  /** `defaultPaint` as a number, for three.js callers. */
  colour: number;
  specs: VehicleSpecSheet;
  stats: VehicleStats;
  /** What the engine simulates. */
  physics: VehiclePhysicsSpec;
}

interface Entry {
  id: string;
  name: string;
  blurb: string;
  modelId: string;
  className: string;
  defaultPaint: string;
  heightM: number;
  engine: string;
  physics: VehiclePhysicsSpec;
}

/*
 * Torque shapes, at 0%, 10% ... 100% of redline.
 *
 * Shape is what makes cars sound and drive differently at the same power: a
 * turbo engine is flat from low revs, a big naturally aspirated V12 builds to
 * the top, a V8 pulls from idle.
 */
const TURBO_SIX = [0.3, 0.45, 0.8, 1, 1, 1, 1, 0.99, 0.94, 0.86, 0.76];
const NA_V12 = [0.3, 0.42, 0.56, 0.68, 0.78, 0.86, 0.93, 0.98, 1, 0.97, 0.9];
const TURBO_FOUR = [0.35, 0.55, 0.9, 1, 1, 1, 0.98, 0.93, 0.86, 0.78, 0.68];
const NA_V8 = [0.62, 0.74, 0.84, 0.91, 0.96, 1, 1, 0.97, 0.92, 0.86, 0.78];
const ANTI_LAG_FOUR = [0.45, 0.7, 0.95, 1, 1, 1, 1, 0.97, 0.9, 0.8, 0.7];
const RACE_FOUR = [0.25, 0.35, 0.5, 0.66, 0.8, 0.9, 0.97, 1, 0.98, 0.94, 0.86];
const SCREAMER_FOUR = [0.25, 0.35, 0.48, 0.6, 0.72, 0.82, 0.9, 0.97, 1, 0.97, 0.88];
const BIG_FOUR = [0.4, 0.55, 0.7, 0.82, 0.9, 0.96, 1, 0.99, 0.95, 0.9, 0.82];
const TRIPLE = [0.55, 0.7, 0.85, 0.95, 1, 1, 0.97, 0.93, 0.88, 0.8, 0.72];

/*
 * The six cars. Each is a class, not a model: dimensions from real cars of
 * that class (911, Huracan, a Group B-style hatch, Mustang, an R4 rally car,
 * a regional single-seater), power and mass in the class's range, and tyre
 * and aero figures that put its cornering where the class sits. The 0-100
 * time and the garage bars are *not* written here — they are measured from
 * these figures by the same force model the race runs.
 */
const CAR_ENTRIES: Entry[] = [
  {
    id: "car-gt",
    name: "Vanta GT",
    blurb: "Rear-engined and honest. Brakes late, turns in clean, and rewards a smooth right foot.",
    modelId: "gt",
    className: "GT coupe",
    defaultPaint: "#b3122e",
    heightM: 1.3,
    engine: "3.0 L twin-turbo flat-six",
    physics: {
      kind: "car",
      drivetrain: "RWD",
      massKg: 1495,
      powerKw: 353,
      topSpeedKmh: 311,
      lengthM: 4.53,
      widthM: 1.85,
      wheelbaseM: 2.45,
      rearShare: 0.61,
      cgHeightM: 0.46,
      wheelRadiusM: 0.355,
      idleRpm: 900,
      redlineRpm: 7500,
      torqueCurve: TURBO_SIX,
      gearRatios: [3.91, 2.29, 1.65, 1.3, 1.08, 0.88, 0.71],
      shiftMs: 80,
      drivelineEfficiency: 0.88,
      downforceArea: 0.35,
      rollingResistance: 0.012,
      tyreGrip: 1.18,
      slideGrip: 0.82,
      brakeG: 1.4,
      steerLockDeg: 34,
      steerRate: 6,
      turnInS: 0.085,
      looseness: 0.45,
      looseSurface: 0.25,
      driftAngleDeg: 34,
      tractionControl: 0.8,
      fragility: 1,
    },
  },
  {
    id: "car-super",
    name: "Halcyon V12",
    blurb: "A naturally aspirated V12 behind your shoulders. Nothing touches it on a straight; everything asks it to slow down.",
    modelId: "supercar",
    className: "Mid-engined supercar",
    defaultPaint: "#e8b400",
    heightM: 1.14,
    engine: "6.5 L naturally aspirated V12",
    physics: {
      kind: "car",
      drivetrain: "RWD",
      massKg: 1580,
      powerKw: 588,
      topSpeedKmh: 340,
      lengthM: 4.7,
      widthM: 2.03,
      wheelbaseM: 2.72,
      rearShare: 0.6,
      cgHeightM: 0.4,
      wheelRadiusM: 0.36,
      idleRpm: 1000,
      redlineRpm: 8900,
      torqueCurve: NA_V12,
      gearRatios: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69],
      shiftMs: 60,
      drivelineEfficiency: 0.88,
      downforceArea: 0.7,
      rollingResistance: 0.012,
      tyreGrip: 1.27,
      slideGrip: 0.8,
      brakeG: 1.5,
      steerLockDeg: 32,
      steerRate: 5.5,
      turnInS: 0.095,
      looseness: 0.4,
      looseSurface: 0.15,
      driftAngleDeg: 30,
      tractionControl: 0.7,
      fragility: 1.1,
    },
  },
  {
    id: "car-hatch",
    name: "Kestrel RS",
    blurb: "A stripped, all-wheel-drive hot hatch. First off every line and out of every hairpin; runs out of gears on a long straight.",
    modelId: "hatch",
    className: "Hot hatch",
    defaultPaint: "#1f6fd1",
    heightM: 1.44,
    engine: "2.0 L turbo inline-four",
    physics: {
      kind: "car",
      drivetrain: "AWD",
      massKg: 1150,
      powerKw: 300,
      topSpeedKmh: 250,
      gearLimited: true,
      lengthM: 4.15,
      widthM: 1.8,
      wheelbaseM: 2.56,
      rearShare: 0.42,
      cgHeightM: 0.5,
      wheelRadiusM: 0.33,
      idleRpm: 850,
      redlineRpm: 7000,
      torqueCurve: TURBO_FOUR,
      gearRatios: [3.36, 2.24, 1.7, 1.36, 1.12, 0.94],
      shiftMs: 70,
      drivelineEfficiency: 0.85,
      downforceArea: 0.2,
      rollingResistance: 0.012,
      tyreGrip: 1.2,
      slideGrip: 0.86,
      brakeG: 1.35,
      steerLockDeg: 36,
      steerRate: 7.5,
      turnInS: 0.065,
      looseness: 0.2,
      looseSurface: 0.45,
      driftAngleDeg: 32,
      tractionControl: 0.9,
      fragility: 0.9,
    },
  },
  {
    id: "car-muscle",
    name: "Brute 5.0",
    blurb: "Five litres of V8 and a manual box. Torque everywhere, and a rear axle that wants to overtake the front.",
    modelId: "muscle",
    className: "Muscle car",
    defaultPaint: "#0f3d2e",
    heightM: 1.4,
    engine: "5.0 L naturally aspirated V8",
    physics: {
      kind: "car",
      drivetrain: "RWD",
      massKg: 1720,
      powerKw: 400,
      topSpeedKmh: 290,
      lengthM: 4.81,
      widthM: 1.92,
      wheelbaseM: 2.72,
      rearShare: 0.5,
      cgHeightM: 0.53,
      wheelRadiusM: 0.35,
      idleRpm: 750,
      redlineRpm: 7500,
      torqueCurve: NA_V8,
      gearRatios: [3.66, 2.43, 1.69, 1.32, 1.0, 0.75],
      shiftMs: 180,
      drivelineEfficiency: 0.86,
      downforceArea: 0.05,
      rollingResistance: 0.013,
      tyreGrip: 1.1,
      slideGrip: 0.86,
      brakeG: 1.25,
      steerLockDeg: 33,
      steerRate: 4.5,
      turnInS: 0.13,
      looseness: 1,
      looseSurface: 0.35,
      driftAngleDeg: 36,
      tractionControl: 0.2,
      fragility: 0.75,
    },
  },
  {
    id: "car-rally",
    name: "Talon R4",
    blurb: "Built for gravel, ice and mud. Where everything else slides, it simply drives.",
    modelId: "rally",
    className: "Rally car",
    defaultPaint: "#f2f2ee",
    heightM: 1.48,
    engine: "1.6 L turbo inline-four, anti-lag",
    physics: {
      kind: "car",
      drivetrain: "AWD",
      massKg: 1260,
      powerKw: 235,
      topSpeedKmh: 228,
      gearLimited: true,
      lengthM: 4.1,
      widthM: 1.82,
      wheelbaseM: 2.57,
      rearShare: 0.42,
      cgHeightM: 0.55,
      wheelRadiusM: 0.33,
      idleRpm: 1000,
      redlineRpm: 7800,
      torqueCurve: ANTI_LAG_FOUR,
      gearRatios: [3.0, 2.06, 1.56, 1.24, 1.0],
      shiftMs: 50,
      drivelineEfficiency: 0.85,
      downforceArea: 0.32,
      rollingResistance: 0.013,
      tyreGrip: 1.15,
      slideGrip: 0.92,
      brakeG: 1.3,
      steerLockDeg: 38,
      steerRate: 7,
      turnInS: 0.075,
      looseness: 0.55,
      looseSurface: 1,
      driftAngleDeg: 40,
      tractionControl: 0.6,
      fragility: 0.85,
    },
  },
  {
    id: "car-formula",
    name: "Apex FR",
    blurb: "An open-wheel single-seater on slicks and wings. Corners like nothing else — and does not forgive a touch of wheels.",
    modelId: "formula",
    className: "Open-wheel racer",
    defaultPaint: "#e8e8e8",
    heightM: 0.98,
    engine: "1.8 L turbo inline-four",
    physics: {
      kind: "car",
      drivetrain: "RWD",
      massKg: 700,
      powerKw: 170,
      topSpeedKmh: 240,
      lengthM: 5.0,
      widthM: 1.85,
      wheelbaseM: 2.85,
      rearShare: 0.6,
      cgHeightM: 0.3,
      wheelRadiusM: 0.3,
      idleRpm: 2500,
      redlineRpm: 8750,
      torqueCurve: RACE_FOUR,
      gearRatios: [2.92, 2.06, 1.62, 1.33, 1.13, 0.98],
      shiftMs: 40,
      drivelineEfficiency: 0.9,
      downforceArea: 1.45,
      rollingResistance: 0.014,
      tyreGrip: 1.45,
      slideGrip: 0.72,
      brakeG: 2.4,
      steerLockDeg: 22,
      steerRate: 8,
      turnInS: 0.05,
      looseness: 0.25,
      looseSurface: 0,
      driftAngleDeg: 20,
      tractionControl: 0.5,
      fragility: 2,
    },
  },
];

const BIKE_ENTRIES: Entry[] = [
  {
    id: "bike-balanced",
    name: "Rush 600",
    blurb: "The standard against which the others are measured.",
    modelId: "bike-sport",
    className: "Supersport",
    defaultPaint: "#c8102e",
    heightM: 1.12,
    engine: "599 cc inline-four",
    physics: bikePhysics({ massKg: 270, powerKw: 88, topSpeedKmh: 262, redlineRpm: 16000, torqueCurve: SCREAMER_FOUR, tyreGrip: 1.2 }),
  },
  {
    id: "bike-speed",
    name: "Blackbird 1000",
    blurb: "Terrifying on a straight, a passenger in a corner.",
    modelId: "bike-hyper",
    className: "Superbike",
    defaultPaint: "#111214",
    heightM: 1.14,
    engine: "999 cc inline-four",
    physics: bikePhysics({ massKg: 282, powerKw: 150, topSpeedKmh: 299, redlineRpm: 14500, torqueCurve: BIG_FOUR, tyreGrip: 1.16, wheelbaseM: 1.44, turnInS: 0.13 }),
  },
  {
    id: "bike-agile",
    name: "Wasp 400",
    blurb: "Flicks between lanes. Nothing at all in reserve up top.",
    modelId: "bike-light",
    className: "Lightweight",
    defaultPaint: "#f2c300",
    heightM: 1.08,
    engine: "399 cc inline-four",
    physics: bikePhysics({ massKg: 240, powerKw: 60, topSpeedKmh: 222, redlineRpm: 15500, torqueCurve: SCREAMER_FOUR, tyreGrip: 1.28, wheelbaseM: 1.36, turnInS: 0.08 }),
  },
  {
    id: "bike-tough",
    name: "Anvil 900",
    blurb: "Survives contact that would end anyone else's race.",
    modelId: "bike-naked",
    className: "Naked",
    defaultPaint: "#f05a1a",
    heightM: 1.15,
    engine: "890 cc triple",
    physics: bikePhysics({ massKg: 272, powerKw: 87, topSpeedKmh: 240, redlineRpm: 11000, torqueCurve: TRIPLE, tyreGrip: 1.2, fragility: 0.9 }),
  },
];

function bikePhysics(p: {
  massKg: number;
  powerKw: number;
  topSpeedKmh: number;
  redlineRpm: number;
  torqueCurve: readonly number[];
  tyreGrip: number;
  wheelbaseM?: number;
  fragility?: number;
  turnInS?: number;
}): VehiclePhysicsSpec {
  return {
    kind: "bike",
    drivetrain: "RWD",
    massKg: p.massKg,
    powerKw: p.powerKw,
    topSpeedKmh: p.topSpeedKmh,
    lengthM: 2.05,
    widthM: 0.85,
    wheelbaseM: p.wheelbaseM ?? 1.4,
    rearShare: 0.52,
    cgHeightM: 0.62,
    wheelRadiusM: 0.31,
    idleRpm: 1400,
    redlineRpm: p.redlineRpm,
    torqueCurve: p.torqueCurve,
    gearRatios: [2.58, 2.0, 1.67, 1.44, 1.29, 1.15],
    shiftMs: 50,
    drivelineEfficiency: 0.9,
    downforceArea: 0,
    rollingResistance: 0.015,
    tyreGrip: p.tyreGrip,
    slideGrip: 0.8,
    brakeG: 1.2,
    steerLockDeg: 28,
    steerRate: 6.5,
    // A bike has to lean before it turns, which is the lag a rider feels.
    turnInS: p.turnInS ?? 0.1,
    looseness: 0.3,
    looseSurface: 0.3,
    driftAngleDeg: 16,
    tractionControl: 0.6,
    fragility: p.fragility ?? 1.6,
  };
}

/** One decimal, clamped to the bar. */
function bar(value: number): number {
  return Math.round(Math.min(10, Math.max(1, value)) * 10) / 10;
}

/** 0..1 position of a value between two ends of a scale (either way round). */
function along(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/** The stop from 100 km/h on dry tarmac, metres. */
export function stoppingDistance100(t: VehicleTuning): number {
  const v = 100 / 3.6;
  return (v * v) / (2 * t.brakePower);
}

/**
 * The bars, from the physics.
 *
 * Each maps a measured quantity onto 1-10 over the range real cars span, so a
 * bar means the same thing for every car and the spread is readable:
 *
 *   speed         top speed, 200-350 km/h
 *   acceleration  simulated 0-100 km/h, 5.0-2.5 s
 *   handling      steady cornering at 120 km/h (0.95-2.0 g), with a quarter
 *                 for how quickly the chassis answers the wheel
 *   braking       the shortest stop from 100 km/h, 42-22 m
 */
export function statsFromTuning(t: VehicleTuning): VehicleStats {
  const kmh = t.maxSpeed * 3.6;
  const launch = simulateZeroTo100(t);
  const cornering = lateralG(t, 120 / 3.6);
  const agility = along(t.turnIn, 0.16, 0.05);
  return {
    speed: bar(1 + along(kmh, 200, 350) * 9),
    acceleration: bar(1 + along(launch, 5, 2.5) * 9),
    handling: bar(1 + (0.75 * along(cornering, 0.95, 2) + 0.25 * agility) * 9),
    braking: bar(1 + along(stoppingDistance100(t), 42, 22) * 9),
  };
}

function build(entries: Entry[], kind: "car" | "bike"): VehicleSpec[] {
  return entries.map((e) => {
    const tuning = deriveTuning(e.id, e.physics);
    return {
      id: e.id,
      name: e.name,
      kind,
      blurb: e.blurb,
      modelId: e.modelId,
      className: e.className,
      defaultPaint: e.defaultPaint,
      colour: parseInt(e.defaultPaint.slice(1), 16),
      specs: {
        lengthM: e.physics.lengthM,
        widthM: e.physics.widthM,
        heightM: e.heightM,
        wheelbaseM: e.physics.wheelbaseM,
        massKg: e.physics.massKg,
        powerKw: e.physics.powerKw,
        drivetrain: e.physics.drivetrain,
        topSpeedKmh: e.physics.topSpeedKmh,
        // Measured, never quoted: the figure on the card is one the car does.
        zeroTo100S: Math.round(simulateZeroTo100(tuning) * 10) / 10,
        torqueNm: Math.round(tuning.peakTorque),
        engine: e.engine,
        gears: e.physics.gearRatios.length,
      },
      stats: statsFromTuning(tuning),
      physics: e.physics,
    };
  });
}

export const CARS: VehicleSpec[] = build(CAR_ENTRIES, "car");
export const BIKES: VehicleSpec[] = build(BIKE_ENTRIES, "bike");

/**
 * Factory-style paints.
 *
 * Named the way a configurator names them rather than by hex, with the finish
 * the renderer needs to pick the right clearcoat and flake.
 */
export const PAINTS: Array<{ id: string; name: string; hex: string; finish: PaintFinish }> = [
  { id: "racing-red", name: "Racing Red", hex: "#b3122e", finish: "solid" },
  { id: "signal-yellow", name: "Signal Yellow", hex: "#e8b400", finish: "solid" },
  { id: "riviera-blue", name: "Riviera Blue", hex: "#1f6fd1", finish: "solid" },
  { id: "midnight-blue", name: "Midnight Blue Metallic", hex: "#16243f", finish: "metallic" },
  { id: "arctic-silver", name: "Arctic Silver Metallic", hex: "#b8bcc2", finish: "metallic" },
  { id: "obsidian-black", name: "Obsidian Black Metallic", hex: "#111214", finish: "metallic" },
  { id: "pearl-white", name: "Pearl White", hex: "#f2f2ee", finish: "pearl" },
  { id: "british-green", name: "British Racing Green", hex: "#0f3d2e", finish: "metallic" },
  { id: "lava-orange", name: "Lava Orange", hex: "#f05a1a", finish: "solid" },
  { id: "acid-green", name: "Acid Green", hex: "#7cc22e", finish: "solid" },
  { id: "cement-grey", name: "Cement Grey", hex: "#7a7d80", finish: "solid" },
  { id: "violet-pearl", name: "Violet Pearl", hex: "#5b2a86", finish: "pearl" },
  { id: "frozen-black", name: "Frozen Black", hex: "#1c1d1f", finish: "matte" },
  { id: "chalk", name: "Chalk", hex: "#e8e8e8", finish: "matte" },
];

const HEX_PAINT = /^#[0-9a-f]{6}$/;

/** A paint is any lower-case '#rrggbb'. Anything else is refused, never guessed. */
export function isValidPaint(value: unknown): value is string {
  return typeof value === "string" && HEX_PAINT.test(value);
}

/**
 * The finish a colour is sprayed in: the configurator's own for a listed
 * paint, metallic for anything custom — the commonest factory finish, and the
 * one that reads as "a car" rather than "a toy" under studio light.
 */
export function paintFinishOf(hex: string | null | undefined): PaintFinish {
  const value = typeof hex === "string" ? hex.toLowerCase() : "";
  return PAINTS.find((p) => p.hex === value)?.finish ?? "metallic";
}

/** The paint to use: the player's choice if it is a colour, else the car's own. */
export function resolvePaint(gameId: GameId, vehicleId: string | null | undefined, paint: unknown): string {
  if (typeof paint === "string" && isValidPaint(paint.toLowerCase())) return paint.toLowerCase();
  return vehicleById(gameId, vehicleId).defaultPaint;
}

/**
 * Ids from rosters that no longer exist.
 *
 * Stored choices outlive rosters — a player's localStorage still says
 * "car-speed" from before the cars had names — so old ids are translated to
 * the nearest current car rather than silently becoming the default.
 */
const LEGACY_IDS: Record<string, string> = {
  "car-balanced": "car-gt",
  "car-speed": "car-super",
  "car-sprint": "car-hatch",
  "car-grip": "car-formula",
  // The garage screen's old showroom ids.
  "eclipse-gt": "car-gt",
  "thunder-v10": "car-super",
  "phantom-rs": "car-hatch",
  "velocity-x": "car-formula",
  "inferno-zx": "car-muscle",
  "raptor-900": "bike-balanced",
  "nighthawk-1000": "bike-speed",
  "phoenix-zx": "bike-agile",
  "shadow-rr": "bike-tough",
  "blaze-x": "bike-speed",
};

export function vehiclesFor(gameId: GameId): VehicleSpec[] {
  return gameId === "bike-race" ? BIKES : CARS;
}

/** The current id for anything a client or storage hands us; the default when unknown. */
export function resolveVehicleId(gameId: GameId, id: string | null | undefined): string {
  const list = vehiclesFor(gameId);
  const mapped = id ? (LEGACY_IDS[id] ?? id) : null;
  return list.find((v) => v.id === mapped)?.id ?? list[0]!.id;
}

export function vehicleById(gameId: GameId, id: string | null | undefined): VehicleSpec {
  const resolved = resolveVehicleId(gameId, id);
  const list = vehiclesFor(gameId);
  return list.find((v) => v.id === resolved) ?? list[0]!;
}

/** The garage bars. Kept as a function for callers that predate `spec.stats`. */
export function vehicleStats(spec: VehicleSpec): VehicleStats {
  return spec.stats;
}

/** Display facts for each car model, for the renderer and showroom. */
export const CAR_ROSTER_MODELS: Record<CarModelId, { id: string; name: string; className: string }> =
  Object.fromEntries(
    CARS.map((c) => [c.modelId, { id: c.id, name: c.name, className: c.className }]),
  ) as Record<CarModelId, { id: string; name: string; className: string }>;

/** A vehicle's quoted top speed in m/s, for dashboards scaled to the car. */
export function topSpeedFor(gameId: GameId, vehicleId: string | null | undefined): number {
  return vehicleById(gameId, vehicleId).specs.topSpeedKmh / 3.6;
}

/** Default vehicles' top speeds, m/s — what a dashboard shows before it knows the car. */
export const CAR_BASE_TOP_SPEED = CARS[0]!.specs.topSpeedKmh / 3.6;
export const BIKE_BASE_TOP_SPEED = BIKES[0]!.specs.topSpeedKmh / 3.6;
