import { describe, it, expect } from "vitest";
import { POP_VARIANT_COUNT, glide, glideIfChanged, popBuffer, scheduleLayers, whiteNoise } from "../synth.js";
import { EngineVoice, engineVoiceTargets, firingFrequency, type EngineVoiceSpec } from "../engine-voice.js";
import { PositionalSource, distanceGain, dopplerFactor, toListenerSpace } from "../positional.js";
import { SOUNDS } from "../sounds.js";
import { fakeContext, fakeParam, type FakeNode, type FakeParam } from "./fake-audio.js";

const V8: EngineVoiceSpec = {
  cylinders: 8,
  saw: 0.5,
  square: 0.25,
  sub: 0.5,
  detune: 14,
  lump: 0.35,
  intake: 0.2,
  turbo: 0,
  cutoff: [300, 2600],
  q: 1.2,
  shaper: 0.75,
  drive: [0.7, 2.4],
  gain: 0.3,
};

const param = (node: FakeNode | undefined, key: string) => node?.[key] as FakeParam;

function reaches(node: unknown, target: unknown, seen = new Set<unknown>()): boolean {
  if (node === target) return true;
  if (!node || seen.has(node)) return false;
  seen.add(node);
  return ((node as FakeNode).outputs ?? []).some((next) => reaches(next, target, seen));
}

describe("synth helpers", () => {
  it("makes one noise buffer per context", () => {
    const a = fakeContext();
    const b = fakeContext();
    expect(whiteNoise(a.context)).toBe(whiteNoise(a.context));
    expect(whiteNoise(a.context)).not.toBe(whiteNoise(b.context));
  });

  it("never puts a non-finite value on a param", () => {
    const p = fakeParam(3);
    glide(p as unknown as AudioParam, Number.NaN, 0, 0.1);
    glide(p as unknown as AudioParam, Infinity, 0, 0.1);
    expect(p.setTargetAtTime).not.toHaveBeenCalled();
    expect(p.value).toBe(3);
  });

  it("skips a glide when the value has not moved", () => {
    const p = fakeParam(0);
    const ap = p as unknown as AudioParam;
    let last = glideIfChanged(ap, 100, undefined, 0, 0.1);
    last = glideIfChanged(ap, 100.00001, last, 0, 0.1);
    expect(p.setTargetAtTime).toHaveBeenCalledTimes(1);
    glideIfChanged(ap, 120, last, 0, 0.1);
    expect(p.setTargetAtTime).toHaveBeenCalledTimes(2);
  });

  it("schedules catalogue layers onto any destination", () => {
    const fake = fakeContext();
    const target = fake.context.createGain();
    scheduleLayers(fake.context, target, SOUNDS["race.collision"].layers, { gain: 0.5 });
    const sources = [...fake.of("osc"), ...fake.of("buffer")];
    expect(sources).toHaveLength(SOUNDS["race.collision"].layers.length);
    for (const source of sources) expect(reaches(source, target)).toBe(true);
  });

  it("builds bounded, repeatable pops", () => {
    const fake = fakeContext();
    for (let i = 0; i < POP_VARIANT_COUNT; i++) {
      const buffer = popBuffer(fake.context, i);
      expect(buffer).toBe(popBuffer(fake.context, i));
      expect(buffer.duration).toBeGreaterThan(0.03);
    }
  });
});

describe("engine voice targets", () => {
  it("fires at cylinders × rpm / 120", () => {
    expect(firingFrequency(6000, 8)).toBe(400);
    expect(firingFrequency(6000, 4)).toBe(200);
    expect(firingFrequency(Number.NaN, 4)).toBe(0);
  });

  it("rises in pitch with revs", () => {
    let previous = 0;
    for (const rpm of [900, 2500, 4500, 6500, 7500]) {
      const t = engineVoiceTargets(V8, { rpm, rpmMax: 7500, throttle: 1 });
      expect(t.frequency).toBeGreaterThan(previous);
      previous = t.frequency;
    }
  });

  it("opens up and bites under load, muffles on the overrun", () => {
    const load = engineVoiceTargets(V8, { rpm: 6500, rpmMax: 7500, throttle: 1 });
    const lift = engineVoiceTargets(V8, { rpm: 6500, rpmMax: 7500, throttle: 0 });
    expect(load.frequency).toBe(lift.frequency);
    expect(load.cutoff).toBeGreaterThan(lift.cutoff * 4);
    expect(load.drive).toBeGreaterThan(lift.drive);
    expect(load.level).toBeGreaterThan(lift.level);
    expect(load.intakeLevel).toBeGreaterThan(0);
    expect(lift.intakeLevel).toBe(0);
  });

  it("burbles at idle and smooths out at the top", () => {
    const idle = engineVoiceTargets(V8, { rpm: 800, rpmMax: 7500, throttle: 0 });
    const top = engineVoiceTargets(V8, { rpm: 7500, rpmMax: 7500, throttle: 1 });
    expect(idle.lumpDepth).toBeGreaterThan(top.lumpDepth * 2);
  });

  it("spools the turbo only with load and revs", () => {
    const turbo = { ...V8, turbo: 1 };
    expect(engineVoiceTargets(turbo, { rpm: 1200, rpmMax: 7000, throttle: 1 }).turboLevel).toBe(0);
    expect(engineVoiceTargets(turbo, { rpm: 6500, rpmMax: 7000, throttle: 0 }).turboLevel).toBe(0);
    expect(engineVoiceTargets(turbo, { rpm: 6500, rpmMax: 7000, throttle: 1 }).turboLevel).toBeGreaterThan(0);
  });

  it("survives garbage from a physics blow-up", () => {
    const t = engineVoiceTargets(V8, { rpm: Number.NaN, rpmMax: 0, throttle: Infinity, pitch: Number.NaN });
    for (const value of Object.values(t)) expect(Number.isFinite(value)).toBe(true);
  });
});

describe("EngineVoice", () => {
  it("builds a running voice that reaches the destination", () => {
    const fake = fakeContext();
    const dest = fake.context.createGain();
    const voice = new EngineVoice(fake.context, dest, V8, { rpm: 900, rpmMax: 7500, throttle: 0 });
    expect(reaches(voice.output, dest)).toBe(true);
    // saw, square, sub, lump LFO, intake noise
    expect(fake.started.length).toBe(5);
    // The LFO modulates a gain param rather than feeding the signal path.
    for (const osc of fake.of("osc").filter((o) => o.type !== "sine")) expect(reaches(osc, dest)).toBe(true);
  });

  it("glides every tone with the revs", () => {
    const fake = fakeContext();
    const voice = new EngineVoice(fake.context, fake.context.createGain(), V8, { rpm: 900, rpmMax: 7500, throttle: 0 });
    voice.update({ rpm: 6000, rpmMax: 7500, throttle: 1 });
    const tones = fake.of("osc").filter((o) => o.type !== "sine");
    const freqs = tones.map((o) => param(o, "frequency").value).sort((a, b) => a - b);
    // sub an octave down, saw and square on the firing frequency
    expect(freqs).toEqual([200, 400, 400]);
  });

  it("builds a cheap voice for opponents", () => {
    const full = fakeContext();
    new EngineVoice(full.context, full.context.createGain(), V8, { rpm: 900, rpmMax: 7500, throttle: 0 });
    const lite = fakeContext();
    new EngineVoice(lite.context, lite.context.createGain(), V8, { rpm: 900, rpmMax: 7500, throttle: 0 }, { quality: "lite" });
    expect(lite.nodes.length).toBeLessThan(full.nodes.length / 2);
    expect(lite.of("shaper")).toHaveLength(0);
  });

  it("stops every source it started", () => {
    const fake = fakeContext();
    const voice = new EngineVoice(fake.context, fake.context.createGain(), { ...V8, turbo: 1 }, { rpm: 900, rpmMax: 7500, throttle: 0 });
    voice.stop();
    for (const { node } of fake.started) expect(node.stop).toHaveBeenCalled();
    // A stopped voice ignores updates rather than throwing.
    expect(() => voice.update({ rpm: 5000, rpmMax: 7500, throttle: 1 })).not.toThrow();
  });
});

describe("positional", () => {
  const facingNorth = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 };

  it("puts a point ahead on -z and a point to the right on +x", () => {
    const ahead = toListenerSpace({ x: 0, y: 0, z: -10 }, facingNorth);
    expect(ahead.z).toBeCloseTo(-10);
    expect(ahead.x).toBeCloseTo(0);
    const right = toListenerSpace({ x: 5, y: 0, z: 0 }, facingNorth);
    expect(right.x).toBeCloseTo(5);
    expect(right.distance).toBeCloseTo(5);
  });

  it("turns with the listener", () => {
    // Facing +x, a car further along +x is ahead and one at +z is to the right.
    const facingEast = { x: 10, y: 0, z: 0, fx: 3, fy: 0, fz: 0 };
    const ahead = toListenerSpace({ x: 20, y: 0, z: 0 }, facingEast);
    expect(ahead.z).toBeCloseTo(-10);
    const right = toListenerSpace({ x: 10, y: 0, z: 4 }, facingEast);
    expect(right.x).toBeCloseTo(4);
    expect(right.z).toBeCloseTo(0);
  });

  it("copes with a degenerate forward vector", () => {
    const p = toListenerSpace({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0 });
    expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
    const up = toListenerSpace({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0, fx: 0, fy: 1, fz: 0 });
    expect(Number.isFinite(up.x)).toBe(true);
  });

  it("raises an approaching car and lowers a receding one", () => {
    expect(dopplerFactor(-40)).toBeGreaterThan(1);
    expect(dopplerFactor(40)).toBeLessThan(1);
    expect(dopplerFactor(0)).toBe(1);
    // Clamped, so a teleport cannot shriek.
    expect(dopplerFactor(-1e6)).toBeCloseTo(2);
  });

  it("matches the Web Audio distance models", () => {
    expect(distanceGain(1, { refDistance: 1 })).toBe(1);
    expect(distanceGain(10, { refDistance: 5, rolloffFactor: 1 })).toBeCloseTo(0.5);
    expect(distanceGain(50, { model: "linear", refDistance: 0, maxDistance: 100 })).toBeCloseTo(0.5, 2);
    expect(distanceGain(20, { model: "exponential", refDistance: 10, rolloffFactor: 1 })).toBeCloseTo(0.5);
  });

  it("drives a PannerNode when there is one", () => {
    const fake = fakeContext({ panner3d: true });
    const dest = fake.context.createGain();
    const source = new PositionalSource(fake.context, dest, { refDistance: 8 });
    source.setPosition({ x: 3, y: 0, z: -4 });
    const panner = fake.of("panner3d")[0];
    expect(panner?.refDistance).toBe(8);
    expect(param(panner, "positionX").value).toBe(3);
    expect(param(panner, "positionZ").value).toBe(-4);
    expect(reaches(source.input, dest)).toBe(true);
  });

  it("falls back to stereo pan plus distance without one", () => {
    const fake = fakeContext();
    const dest = fake.context.createGain();
    const source = new PositionalSource(fake.context, dest, { refDistance: 5 });
    source.setPosition({ x: -10, y: 0, z: 0 });
    expect(param(fake.of("panner")[0], "pan").value).toBe(-1);
    expect(reaches(source.input, dest)).toBe(true);
  });
});
