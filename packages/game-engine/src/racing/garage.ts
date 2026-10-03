import type { GameId } from "@playora/game-types";

/**
 * How a vehicle differs from the class baseline.
 *
 * Multipliers on the engine's tuning, not free-standing numbers. That is the
 * whole point: the stat bars a player compares in the garage are *derived* from
 * these, so a car that shows more speed genuinely has a higher top speed. Stats
 * stored separately from the physics they claim to describe drift apart, and
 * then the garage is lying.
 */
export interface VehicleModifiers {
  maxSpeed: number;
  acceleration: number;
  /** How quickly it changes lane. */
  steerRate: number;
  /** How hard a corner throws it. Lower is better, so it inverts in the stats. */
  centrifugal: number;
  nitroMultiplier: number;
  /** Speed retained after a hit. Higher is more forgiving. */
  crashPenalty: number;
}

export interface VehicleSpec {
  id: string;
  name: string;
  kind: "car" | "bike";
  blurb: string;
  /** Body colour, used by the renderer and the garage preview. */
  colour: number;
  modifiers: VehicleModifiers;
}

/** The 0-10 bars shown in the garage. */
export interface VehicleStats {
  speed: number;
  acceleration: number;
  handling: number;
  nitro: number;
}

const NEUTRAL: VehicleModifiers = {
  maxSpeed: 1,
  acceleration: 1,
  steerRate: 1,
  centrifugal: 1,
  nitroMultiplier: 1,
  crashPenalty: 1,
};

export const CARS: VehicleSpec[] = [
  {
    id: "car-balanced",
    name: "Vanta GT",
    kind: "car",
    blurb: "No weakness and no speciality. The one to learn a circuit in.",
    colour: 0xff2b3d,
    modifiers: { ...NEUTRAL },
  },
  {
    id: "car-speed",
    name: "Halcyon V12",
    kind: "car",
    blurb: "Enormous top end, reluctant to change direction. Long circuits only.",
    colour: 0x3ba7ff,
    modifiers: {
      ...NEUTRAL,
      maxSpeed: 1.14,
      acceleration: 0.88,
      steerRate: 0.86,
      centrifugal: 1.18,
    },
  },
  {
    id: "car-sprint",
    name: "Kestrel RS",
    kind: "car",
    blurb: "Away from a corner before anything else. Runs out of legs on a straight.",
    colour: 0x4ade80,
    modifiers: {
      ...NEUTRAL,
      maxSpeed: 0.92,
      acceleration: 1.24,
      steerRate: 1.08,
      nitroMultiplier: 1.06,
    },
  },
  {
    id: "car-grip",
    name: "Talon SR",
    kind: "car",
    blurb: "Holds a line nothing else can. You will lose time on the straights.",
    colour: 0xa855f7,
    modifiers: {
      ...NEUTRAL,
      maxSpeed: 0.95,
      steerRate: 1.22,
      centrifugal: 0.72,
      crashPenalty: 1.25,
    },
  },
];

export const BIKES: VehicleSpec[] = [
  {
    id: "bike-balanced",
    name: "Rush 600",
    kind: "bike",
    blurb: "The standard against which the others are measured.",
    colour: 0xff2b3d,
    modifiers: { ...NEUTRAL },
  },
  {
    id: "bike-speed",
    name: "Blackbird 1000",
    kind: "bike",
    blurb: "Terrifying on a straight, a passenger in a corner.",
    colour: 0x22d3ee,
    modifiers: {
      ...NEUTRAL,
      maxSpeed: 1.16,
      acceleration: 0.9,
      steerRate: 0.88,
      centrifugal: 1.22,
    },
  },
  {
    id: "bike-agile",
    name: "Wasp 400",
    kind: "bike",
    blurb: "Flicks between lanes. Nothing at all in reserve up top.",
    colour: 0xfbbf24,
    modifiers: {
      ...NEUTRAL,
      maxSpeed: 0.9,
      acceleration: 1.18,
      steerRate: 1.3,
      centrifugal: 0.78,
    },
  },
  {
    id: "bike-tough",
    name: "Anvil 900",
    kind: "bike",
    blurb: "Survives contact that would end anyone else's race.",
    colour: 0xf97316,
    modifiers: {
      ...NEUTRAL,
      maxSpeed: 0.97,
      acceleration: 1.02,
      steerRate: 0.96,
      crashPenalty: 1.6,
    },
  },
];

export function vehiclesFor(gameId: GameId): VehicleSpec[] {
  return gameId === "bike-race" ? BIKES : CARS;
}

export function vehicleById(gameId: GameId, id: string | null | undefined): VehicleSpec {
  const list = vehiclesFor(gameId);
  return list.find((v) => v.id === id) ?? list[0]!;
}

/**
 * Turns modifiers into the bars the garage shows.
 *
 * Derived rather than authored, so the display cannot disagree with the
 * physics. A multiplier of 1 sits at 6.5, and the scale is chosen so the
 * spread across the roster fills most of the bar without any entry pinning to
 * either end — a row of maxed-out bars tells the player nothing.
 */
export function vehicleStats(spec: VehicleSpec): VehicleStats {
  const scale = (multiplier: number, sensitivity = 14) =>
    clamp(Math.round((6.5 + (multiplier - 1) * sensitivity) * 10) / 10, 1, 10);

  return {
    speed: scale(spec.modifiers.maxSpeed, 20),
    acceleration: scale(spec.modifiers.acceleration, 14),
    // Handling is steering authority set against how hard a corner throws it;
    // a vehicle that turns quickly but slides wide is not a handling vehicle.
    handling: scale(
      (spec.modifiers.steerRate + 1 / spec.modifiers.centrifugal) / 2,
      12,
    ),
    nitro: scale(spec.modifiers.nitroMultiplier, 22),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A vehicle's real top speed, for the dashboard.
 *
 * The HUD had `78` hardcoded in three separate files — the *base* car speed,
 * before the chosen vehicle's modifier. So the gauge and the gear readout were
 * calibrated for a car you might not be driving: a Thunder V10 tops out at 89
 * and pegged the needle early, while a bike tops out at 72 and never reached
 * the end of its own dial.
 */
export function topSpeedFor(gameId: GameId, vehicleId: string | null | undefined): number {
  const isBike = gameId === "bike-race";
  const base = isBike ? BIKE_BASE_TOP_SPEED : CAR_BASE_TOP_SPEED;
  return base * vehicleById(gameId, vehicleId).modifiers.maxSpeed;
}

/** Base top speeds, matching CarRaceEngine and BikeRaceEngine tuning. */
export const CAR_BASE_TOP_SPEED = 78;
export const BIKE_BASE_TOP_SPEED = 72;
