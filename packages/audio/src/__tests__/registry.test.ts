import { describe, it, expect } from "vitest";
import {
  PLAY_PARAM_LIMITS,
  SOUND_IDS,
  SOUNDS,
  durationOf,
  resolvePlayParams,
  semitones,
  tone,
  type SoundId,
} from "../sounds.js";
import {
  COMMON_LOOP_PARAMS,
  LOOPS,
  LOOP_IDS,
  driveCurve,
  loopParamSpecs,
  mapLoopParam,
  resolveLoopParams,
  resolveLoopTargets,
  type LoopSpec,
} from "../loops.js";

/** The ids the games were promised. Spelled out so a rename fails loudly here. */
const REQUIRED_SOUNDS: SoundId[] = [
  "card.skip",
  "card.reverse",
  "card.wild",
  "card.stack",
  "uno.call",
  "uno.caught",
  "player.eliminated",
  "ui.hover",
  "ui.select",
  "ui.back",
  "race.light",
  "race.go",
  "race.gear",
  "race.nitro",
  "race.collision",
  "race.checkpoint",
  "game.win",
  "game.lose",
  "game.point",
  "game.error",
  "piece.move",
  "piece.capture",
  "dice.roll",
  "tile.flip",
  "tile.merge",
];

describe("sound registry", () => {
  it("has a spec for every id, and an id for every spec", () => {
    for (const id of SOUND_IDS) expect(SOUNDS[id], `${id} has no spec`).toBeDefined();
    expect(Object.keys(SOUNDS).sort()).toEqual([...SOUND_IDS].sort());
  });

  it("lists each id once", () => {
    expect(new Set(SOUND_IDS).size).toBe(SOUND_IDS.length);
  });

  it("includes every sound the games depend on", () => {
    for (const id of REQUIRED_SOUNDS) expect(SOUND_IDS, `${id} is missing`).toContain(id);
  });

  it("describes only layers Web Audio can schedule", () => {
    const audible = (hz: number | undefined) => hz === undefined || (Number.isFinite(hz) && hz >= 20 && hz <= 20000);
    for (const id of SOUND_IDS) {
      const spec = SOUNDS[id];
      expect(spec.throttleMs ?? 0, `${id} has a negative throttle`).toBeGreaterThanOrEqual(0);
      for (const layer of spec.layers) {
        expect(audible(layer.frequency), `${id} has an inaudible frequency`).toBe(true);
        expect(audible(layer.endFrequency), `${id} glides somewhere inaudible`).toBe(true);
        expect(audible(layer.filter), `${id} has a filter outside 20 Hz-20 kHz`).toBe(true);
        expect(audible(layer.endFilter), `${id} sweeps a filter out of range`).toBe(true);
        if (layer.q !== undefined) expect(layer.q, `${id} has a non-positive Q`).toBeGreaterThan(0);
        expect(layer.delay, `${id} has a negative delay`).toBeGreaterThanOrEqual(0);
        // The envelope ramps up until `attack`, then down until `duration`;
        // an attack as long as the layer would schedule the ramps out of order.
        expect(layer.attack, `${id} attacks for longer than it lasts`).toBeLessThan(layer.duration);
        if (layer.endFilter !== undefined) expect(layer.filter, `${id} sweeps a filter it does not have`).toBeDefined();
      }
    }
  });

  it("measures inline specs as well as ids", () => {
    const spec = { bus: "sfx" as const, layers: [tone(440, 0.1, 0.2), tone(660, 0.2, 0.2, { delay: 0.3 })] };
    expect(durationOf(spec)).toBeCloseTo(0.5);
    expect(durationOf("card.deal")).toBeCloseTo(0.07);
  });
});

describe("play params", () => {
  it("defaults to the sound exactly as described", () => {
    expect(resolvePlayParams()).toEqual({ pitch: 1, gain: 1, pan: 0, delay: 0 });
    expect(resolvePlayParams({})).toEqual({ pitch: 1, gain: 1, pan: 0, delay: 0 });
  });

  it("clamps every param to its limits", () => {
    const high = resolvePlayParams({ pitch: 100, gain: 50, pan: 3, delay: 999 });
    expect(high).toEqual({
      pitch: PLAY_PARAM_LIMITS.pitch.max,
      gain: PLAY_PARAM_LIMITS.gain.max,
      pan: PLAY_PARAM_LIMITS.pan.max,
      delay: PLAY_PARAM_LIMITS.delay.max,
    });
    const low = resolvePlayParams({ pitch: 0, gain: -1, pan: -3, delay: -5 });
    expect(low).toEqual({
      pitch: PLAY_PARAM_LIMITS.pitch.min,
      gain: PLAY_PARAM_LIMITS.gain.min,
      pan: PLAY_PARAM_LIMITS.pan.min,
      delay: PLAY_PARAM_LIMITS.delay.min,
    });
  });

  it("treats NaN and Infinity as a bug upstream and plays the default", () => {
    expect(resolvePlayParams({ pitch: Number.NaN, gain: Infinity, pan: -Infinity, delay: Number.NaN })).toEqual({
      pitch: 1,
      gain: 1,
      pan: 0,
      delay: 0,
    });
  });

  it("passes values inside the limits through untouched", () => {
    expect(resolvePlayParams({ pitch: 1.5, gain: 0.4, pan: -0.25, delay: 0.3 })).toEqual({
      pitch: 1.5,
      gain: 0.4,
      pan: -0.25,
      delay: 0.3,
    });
  });

  it("converts semitones to a pitch ratio", () => {
    expect(semitones(0)).toBe(1);
    expect(semitones(12)).toBeCloseTo(2);
    expect(semitones(-12)).toBeCloseTo(0.5);
    expect(semitones(7)).toBeCloseTo(1.4983, 3);
  });
});

describe("loop registry", () => {
  it("has the loops racing needs", () => {
    expect(LOOP_IDS).toEqual(expect.arrayContaining(["engine", "wind", "tyre-squeal", "crowd"]));
  });

  it("declares sane ranges for every parameter", () => {
    for (const id of LOOP_IDS) {
      for (const [name, param] of Object.entries(loopParamSpecs(LOOPS[id]))) {
        expect(param.min, `${id}.${name}`).toBeLessThan(param.max);
        expect(param.default, `${id}.${name} default`).toBeGreaterThanOrEqual(param.min);
        expect(param.default, `${id}.${name} default`).toBeLessThanOrEqual(param.max);
        expect(param.smoothing, `${id}.${name} smoothing`).toBeGreaterThan(0);
      }
    }
  });

  it("maps only parameters the loop declares", () => {
    for (const id of LOOP_IDS) {
      const declared = Object.keys(loopParamSpecs(LOOPS[id]));
      for (const mapping of LOOPS[id].mappings) expect(declared, `${id} maps ${mapping.param}`).toContain(mapping.param);
    }
  });

  it("gives every loop an audible voice", () => {
    for (const id of LOOP_IDS) {
      const spec: LoopSpec = LOOPS[id];
      expect(spec.voices.length, `${id} has no voices`).toBeGreaterThan(0);
      for (const voice of spec.voices) expect(voice.gain, `${id} has a silent voice`).toBeGreaterThan(0);
    }
  });

  it("resolves to finite, in-range targets across every parameter's whole range", () => {
    for (const id of LOOP_IDS) {
      const spec: LoopSpec = LOOPS[id];
      const params = loopParamSpecs(spec);
      for (const at of ["min", "default", "max"] as const) {
        const values = Object.fromEntries(Object.entries(params).map(([n, p]) => [n, p[at]]));
        const t = resolveLoopTargets(spec, values);
        for (const [key, value] of Object.entries(t)) expect(Number.isFinite(value), `${id}.${key} at ${at}`).toBe(true);
        expect(t.gain).toBeGreaterThanOrEqual(0);
        if (spec.filter) {
          expect(t.cutoff, `${id} cutoff at ${at}`).toBeGreaterThanOrEqual(20);
          expect(t.cutoff, `${id} cutoff at ${at}`).toBeLessThanOrEqual(20000);
        }
        if (spec.voices.some((v) => v.kind === "tone")) {
          expect(t.pitch, `${id} pitch at ${at}`).toBeGreaterThanOrEqual(20);
        }
      }
    }
  });
});

describe("loop params", () => {
  it("fills in defaults, including volume and pan", () => {
    expect(resolveLoopParams(LOOPS.engine)).toEqual({ rpm: 900, throttle: 0, volume: 1, pan: 0 });
  });

  it("clamps to the declared range", () => {
    const v = resolveLoopParams(LOOPS.engine, { rpm: 20000, throttle: -1, volume: 3, pan: -9 });
    expect(v).toEqual({ rpm: 9000, throttle: 0, volume: 1, pan: -1 });
  });

  it("replaces NaN with the default rather than a bound", () => {
    const v = resolveLoopParams(LOOPS.engine, { rpm: Number.NaN, throttle: Infinity });
    expect(v.rpm).toBe(LOOPS.engine.params.rpm.default);
    expect(v.throttle).toBe(LOOPS.engine.params.throttle.default);
  });

  it("drops parameters the loop does not have", () => {
    expect(resolveLoopParams(LOOPS.wind, { rpm: 3000 })).not.toHaveProperty("rpm");
  });

  it("clamps out-of-range input inside the target resolver too", () => {
    const over = resolveLoopTargets(LOOPS.engine, { rpm: 1e9, throttle: 1 });
    const max = resolveLoopTargets(LOOPS.engine, { rpm: 9000, throttle: 1 });
    expect(over).toEqual(max);
  });
});

describe("loop behaviour", () => {
  const engine = (rpm: number, throttle = 0) => resolveLoopTargets(LOOPS.engine, { rpm, throttle });

  it("pitches the engine from rpm across 800-9000", () => {
    expect(engine(800).pitch).toBeCloseTo(40);
    expect(engine(9000).pitch).toBeCloseTo(450);
    let previous = 0;
    for (let rpm = 800; rpm <= 9000; rpm += 400) {
      expect(engine(rpm).pitch).toBeGreaterThan(previous);
      previous = engine(rpm).pitch;
    }
  });

  it("opens the engine's filter, drive and level with throttle", () => {
    const off = engine(4000, 0);
    const on = engine(4000, 1);
    expect(on.cutoff).toBeGreaterThan(off.cutoff * 4);
    expect(on.drive).toBeGreaterThan(off.drive);
    expect(on.gain).toBeGreaterThan(off.gain);
    // Throttle shapes the tone; it must not change the note.
    expect(on.pitch).toBeCloseTo(off.pitch);
  });

  it("keeps the wind silent at a standstill and grows it with speed", () => {
    expect(resolveLoopTargets(LOOPS.wind, { speed: 0 }).gain).toBe(0);
    const mid = resolveLoopTargets(LOOPS.wind, { speed: 0.5 });
    const top = resolveLoopTargets(LOOPS.wind, { speed: 1 });
    expect(top.gain).toBeGreaterThan(mid.gain);
    expect(top.cutoff).toBeGreaterThan(mid.cutoff);
    // Faster than linear: half speed is well under half the noise.
    expect(mid.gain).toBeLessThan(top.gain / 2);
  });

  it("keeps the tyres quiet until they actually slide", () => {
    expect(resolveLoopTargets(LOOPS["tyre-squeal"], { slip: 0 }).gain).toBe(0);
    expect(resolveLoopTargets(LOOPS["tyre-squeal"], { slip: 0.15 }).gain).toBe(0);
    expect(resolveLoopTargets(LOOPS["tyre-squeal"], { slip: 0.6 }).gain).toBeGreaterThan(0);
    expect(resolveLoopTargets(LOOPS["tyre-squeal"], { slip: 1 }).gain).toBeGreaterThan(
      resolveLoopTargets(LOOPS["tyre-squeal"], { slip: 0.6 }).gain,
    );
  });

  it("swells the crowd with intensity", () => {
    expect(resolveLoopTargets(LOOPS.crowd, { intensity: 1 }).gain).toBeGreaterThan(
      resolveLoopTargets(LOOPS.crowd, { intensity: 0.2 }).gain,
    );
  });

  it("scales any loop by volume, down to silence", () => {
    const full = resolveLoopTargets(LOOPS.engine, { rpm: 3000, throttle: 1, volume: 1 });
    const half = resolveLoopTargets(LOOPS.engine, { rpm: 3000, throttle: 1, volume: 0.5 });
    expect(half.gain).toBeCloseTo(full.gain / 2);
    expect(resolveLoopTargets(LOOPS.engine, { volume: 0 }).gain).toBe(0);
  });

  it("interpolates exponential mappings geometrically", () => {
    const param = { min: 0, max: 1, default: 0, smoothing: 0.1 };
    const mapping = { param: "x", target: "cutoff" as const, range: [100, 10000] as const, exponential: true };
    expect(mapLoopParam(mapping, param, 0.5)).toBeCloseTo(1000);
    expect(mapLoopParam({ ...mapping, exponential: false }, param, 0.5)).toBeCloseTo(5050);
  });

  it("exposes volume and pan on every loop", () => {
    for (const id of LOOP_IDS) {
      expect(loopParamSpecs(LOOPS[id])).toMatchObject(COMMON_LOOP_PARAMS);
    }
  });
});

describe("drive curve", () => {
  it("stays within ±1, is odd-symmetric and monotonic", () => {
    const curve = driveCurve(0.6, 257);
    expect(curve[0]).toBeCloseTo(-1);
    expect(curve[256]).toBeCloseTo(1);
    expect(curve[128]).toBeCloseTo(0);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!);
      expect(Math.abs(curve[i]!)).toBeLessThanOrEqual(1 + 1e-6);
      expect(curve[i]!).toBeCloseTo(-curve[curve.length - 1 - i]!);
    }
  });

  it("survives a nonsense amount", () => {
    const curve = driveCurve(Number.NaN, 16);
    for (const v of curve) expect(Number.isFinite(v)).toBe(true);
  });
});
