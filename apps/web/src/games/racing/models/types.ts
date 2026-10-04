import type * as THREE from "three";

/**
 * The six car bodies. Mirrors `CarModelId` in @playora/game-engine's garage:
 * the roster owns which car is which, this folder owns what each one looks
 * like. Kept as its own string union so the renderer can build a car without
 * the engine package, and so the two stay assignable to each other.
 */
export type CarModelId = "gt" | "supercar" | "hatch" | "muscle" | "rally" | "formula";

export const CAR_MODEL_IDS: readonly CarModelId[] = ["gt", "supercar", "hatch", "muscle", "rally", "formula"];

export type PaintFinish = "solid" | "metallic" | "pearl" | "matte";

/**
 * How much of the car to build. `high` is the player's car and the showroom:
 * see-through glass with a cabin behind it, panel gaps, decals, full wheels.
 * `medium` is an opponent a few car lengths away: the same silhouette with
 * dark opaque glass and no interior. `low` is the far LOD.
 */
export type CarQuality = "high" | "medium" | "low";

export type WheelCorner = "FL" | "FR" | "RL" | "RR";

export interface CarWheel {
  corner: WheelCorner;
  /** Moves on y for suspension travel. Parent of `steer`. */
  suspension: THREE.Group;
  /** Turns on y for steering. The caliper hangs here, so it does not spin. */
  steer: THREE.Group;
  /** Turns on x as the wheel rolls. */
  spin: THREE.Group;
  /** Rolling radius in metres; front and rear differ on staggered cars. */
  radius: number;
}

export interface CarDims {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  /** Mean of the front and rear track, centre of tyre to centre of tyre. */
  track: number;
}

export interface CarRig {
  /** Origin at the centre of the four contact patches, +z forward, +y up, metres. */
  root: THREE.Group;
  /** The sprung mass: everything but the wheels. Pitch, roll and heave go here. */
  body: THREE.Group;
  wheels: CarWheel[];
  /** Empty markers at each tailpipe opening, pointing out of the pipe (-z). */
  exhausts: THREE.Object3D[];
  dims: CarDims;
  setBrakeLights(on: boolean): void;
  setHeadlights(on: boolean): void;
  /** 0..1, how hot the brake discs glow. */
  setBrakeGlow(v: number): void;
  setPaint(hex: string, finish?: PaintFinish): void;
  dispose(): void;
}

export interface CreateCarOptions {
  /** '#rrggbb'. */
  paint: string;
  finish?: PaintFinish;
  quality?: CarQuality;
  /** Door and bonnet roundels on the high-quality model. Omitted: none. */
  raceNumber?: number;
}

export interface CarModelInfo {
  name: string;
  className: string;
  dims: CarDims;
}
