import { glide } from "./synth.js";

/**
 * Sounds that come from somewhere: an opponent's engine off your left
 * shoulder, fading as it drops back.
 *
 * Positions are given in the *listener's* frame rather than set on the
 * context's AudioListener. The listener is one per context, and the context is
 * shared by the whole page; a race that moved it would move every other
 * positional sound with it. Converting into listener space here keeps the
 * global listener at its default pose (at the origin, looking down -z) and makes
 * the maths testable without Web Audio.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Where the listener is and which way it faces (any length; normalised here). Y is up. */
export interface ListenerPose extends Vec3 {
  fx: number;
  fy: number;
  fz: number;
}

export interface ListenerSpacePoint extends Vec3 {
  distance: number;
}

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/**
 * `point` in Web Audio's listener frame: +x to the right, +y up, -z straight
 * ahead. A listener facing straight up or down has no defined right; it falls
 * back to world +x.
 */
export function toListenerSpace(point: Vec3, listener: ListenerPose): ListenerSpacePoint {
  const dx = finite(point.x) - finite(listener.x);
  const dy = finite(point.y) - finite(listener.y);
  const dz = finite(point.z) - finite(listener.z);

  let fx = finite(listener.fx);
  let fy = finite(listener.fy);
  let fz = finite(listener.fz);
  let len = Math.hypot(fx, fy, fz);
  if (len < 1e-9) {
    fx = 0;
    fy = 0;
    fz = -1;
    len = 1;
  }
  fx /= len;
  fy /= len;
  fz /= len;

  // right = forward × worldUp(0, 1, 0)
  let rx = -fz;
  const ry = 0;
  let rz = fx;
  const rlen = Math.hypot(rx, rz);
  if (rlen < 1e-6) {
    rx = 1;
    rz = 0;
  } else {
    rx /= rlen;
    rz /= rlen;
  }
  // up = right × forward
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  return {
    x: dx * rx + dy * ry + dz * rz,
    y: dx * ux + dy * uy + dz * uz,
    z: -(dx * fx + dy * fy + dz * fz),
    distance: Math.hypot(dx, dy, dz),
  };
}

export const SPEED_OF_SOUND = 343;

/**
 * The pitch ratio a moving source is heard at. `radialVelocity` is how fast
 * the distance is growing, m/s: positive receding (lower), negative closing
 * (higher). PannerNode stopped doing Doppler years ago, so a car passing at
 * 60 m/s needs it applied by hand — it is a third of an octave, and the most
 * recognisable sound in motorsport.
 *
 * Clamped to half the speed of sound either way: a teleport (a respawn, a
 * snapshot jump) must not briefly shriek.
 */
export function dopplerFactor(radialVelocity: number, speedOfSound = SPEED_OF_SOUND): number {
  const c = speedOfSound > 0 ? speedOfSound : SPEED_OF_SOUND;
  const v = Math.min(c * 0.5, Math.max(-c * 0.5, finite(radialVelocity)));
  return c / (c + v);
}

export type DistanceModel = "linear" | "inverse" | "exponential";

export interface DistanceOptions {
  model?: DistanceModel;
  /** Distance at which the sound is at full level. */
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
}

/** PannerNode's distance attenuation, as the Web Audio spec defines it. */
export function distanceGain(distance: number, options: DistanceOptions = {}): number {
  const model = options.model ?? "inverse";
  const ref = Math.max(1e-3, options.refDistance ?? 1);
  const max = Math.max(ref, options.maxDistance ?? 10000);
  const rolloff = Math.max(0, options.rolloffFactor ?? 1);
  const d = Math.max(0, finite(distance));
  switch (model) {
    case "linear": {
      const clamped = Math.min(max, Math.max(ref, d));
      return 1 - (Math.min(1, rolloff) * (clamped - ref)) / Math.max(1e-6, max - ref);
    }
    case "exponential":
      return Math.pow(Math.max(d, ref) / ref, -rolloff);
    default:
      return ref / (ref + rolloff * (Math.max(d, ref) - ref));
  }
}

export interface PositionalOptions extends DistanceOptions {
  /**
   * `equalpower` by default. HRTF places a source above or behind you, but it
   * is a convolution per source and costs real CPU on a phone; equal-power
   * panning plus distance is what a car game needs to say "left, close".
   */
  panningModel?: PanningModelType;
}

/**
 * A positioned input: connect a voice to `input`, call `setPosition` with a
 * listener-space point every frame.
 *
 * Uses a PannerNode where there is one, and otherwise a stereo pan plus the
 * same distance curve computed by hand, so a browser without 3D panning still
 * hears near and far, left and right.
 */
export class PositionalSource {
  readonly input: GainNode;
  private readonly context: BaseAudioContext;
  private readonly panner: PannerNode | null = null;
  private readonly stereo: StereoPannerNode | null = null;
  private readonly attenuation: GainNode | null = null;
  private readonly options: PositionalOptions;
  private readonly nodes: AudioNode[] = [];

  constructor(context: BaseAudioContext, destination: AudioNode, options: PositionalOptions = {}) {
    this.context = context;
    this.options = options;
    const input = context.createGain();
    this.input = input;
    this.nodes.push(input);

    if (typeof context.createPanner === "function") {
      const panner = context.createPanner();
      panner.panningModel = options.panningModel ?? "equalpower";
      panner.distanceModel = options.model ?? "inverse";
      panner.refDistance = Math.max(1e-3, options.refDistance ?? 1);
      panner.maxDistance = Math.max(panner.refDistance, options.maxDistance ?? 10000);
      panner.rolloffFactor = Math.max(0, options.rolloffFactor ?? 1);
      input.connect(panner);
      panner.connect(destination);
      this.panner = panner;
      this.nodes.push(panner);
      return;
    }

    const attenuation = context.createGain();
    input.connect(attenuation);
    this.attenuation = attenuation;
    this.nodes.push(attenuation);
    if (typeof context.createStereoPanner === "function") {
      const stereo = context.createStereoPanner();
      attenuation.connect(stereo);
      stereo.connect(destination);
      this.stereo = stereo;
      this.nodes.push(stereo);
    } else {
      attenuation.connect(destination);
    }
  }

  /** Moves the source to a point in listener space (see `toListenerSpace`). */
  setPosition(point: Vec3, timeConstant = 0.03): void {
    const now = this.context.currentTime;
    const x = finite(point.x);
    const y = finite(point.y);
    const z = finite(point.z);
    try {
      if (this.panner) {
        const p = this.panner;
        if (p.positionX) {
          glide(p.positionX, x, now, timeConstant);
          glide(p.positionY, y, now, timeConstant);
          glide(p.positionZ, z, now, timeConstant);
        } else {
          // Safari before 14.1 only has the deprecated setter.
          (p as PannerNode & { setPosition?: (x: number, y: number, z: number) => void }).setPosition?.(x, y, z);
        }
        return;
      }
      const distance = Math.hypot(x, y, z);
      if (this.attenuation) glide(this.attenuation.gain, distanceGain(distance, this.options), now, timeConstant);
      if (this.stereo) glide(this.stereo.pan, distance > 1e-6 ? Math.max(-1, Math.min(1, x / distance)) : 0, now, timeConstant);
    } catch {
      // Context closed; the owner rebuilds.
    }
  }

  dispose(): void {
    for (const node of this.nodes) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
  }
}
