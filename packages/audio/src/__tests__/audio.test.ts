import { describe, it, expect, vi } from "vitest";
import {
  AUDIO_BUSES,
  DEFAULT_MIXER,
  effectiveVolume,
  normalizeMixer,
  setBusVolume,
  setMaster,
  toggleBus,
  toggleMute,
} from "../mixer.js";
import { SOUNDS, durationOf, type SoundId } from "../sounds.js";
import { AudioEngine } from "../engine.js";

describe("mixer", () => {
  it("multiplies master by the bus volume", () => {
    const state = setBusVolume(setMaster(DEFAULT_MIXER, 0.5), "sfx", 0.5);
    expect(effectiveVolume(state, "sfx")).toBeCloseTo(0.25);
  });

  it("silences everything when muted", () => {
    const state = toggleMute(DEFAULT_MIXER);
    for (const bus of AUDIO_BUSES) expect(effectiveVolume(state, bus)).toBe(0);
  });

  it("silences one bus without touching the others", () => {
    const state = toggleBus(DEFAULT_MIXER, "music");
    expect(effectiveVolume(state, "music")).toBe(0);
    expect(effectiveVolume(state, "sfx")).toBeGreaterThan(0);
  });

  it("keeps volumes behind a mute, so unmuting restores them", () => {
    const loud = setBusVolume(DEFAULT_MIXER, "sfx", 0.9);
    const muted = toggleMute(loud);
    expect(effectiveVolume(toggleMute(muted), "sfx")).toBeCloseTo(0.7 * 0.9);
  });

  it("clamps out-of-range volumes", () => {
    expect(setMaster(DEFAULT_MIXER, 5).master).toBe(1);
    expect(setMaster(DEFAULT_MIXER, -3).master).toBe(0);
    expect(setBusVolume(DEFAULT_MIXER, "ui", 42).volumes.ui).toBe(1);
  });

  it("refuses a NaN volume rather than passing it to the audio graph", () => {
    // A NaN gain silences a Web Audio graph permanently and cannot be recovered
    // from by setting a valid value afterwards.
    expect(setMaster(DEFAULT_MIXER, Number.NaN).master).toBe(0);
    expect(effectiveVolume(setMaster(DEFAULT_MIXER, Number.NaN), "sfx")).toBe(0);
  });

  it("rebuilds a sane mixer from junk", () => {
    expect(normalizeMixer(null)).toEqual(DEFAULT_MIXER);
    expect(normalizeMixer("nonsense")).toEqual(DEFAULT_MIXER);
    expect(normalizeMixer({ master: "loud" }).master).toBe(DEFAULT_MIXER.master);
    expect(normalizeMixer({ volumes: { sfx: 99, bogus: 1 } }).volumes.sfx).toBe(1);
    expect(normalizeMixer({ mutedBuses: ["sfx", "nope"] }).mutedBuses).toEqual(["sfx"]);
  });
});

describe("sound catalogue", () => {
  it("puts every sound on a real bus", () => {
    for (const [id, spec] of Object.entries(SOUNDS)) {
      expect(AUDIO_BUSES, `${id} is on an unknown bus`).toContain(spec.bus);
    }
  });

  it("gives every sound at least one audible layer", () => {
    for (const [id, spec] of Object.entries(SOUNDS)) {
      expect(spec.layers.length, `${id} has no layers`).toBeGreaterThan(0);
      for (const layer of spec.layers) {
        expect(layer.gain, `${id} has a silent layer`).toBeGreaterThan(0);
        expect(layer.duration, `${id} has a zero-length layer`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every sound short enough not to overlap the next turn", () => {
    for (const id of Object.keys(SOUNDS) as SoundId[]) {
      expect(durationOf(id), `${id} runs too long`).toBeLessThan(1.2);
    }
  });
});

/** Enough of Web Audio to observe what the engine schedules. */
function fakeContext() {
  const started: Array<{ type: string; when: number }> = [];
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    state: "running" as AudioContextState,
    destination: { kind: "destination" },
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createOscillator: () => ({
      type: "sine",
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      start: (when: number) => started.push({ type: "osc", when }),
      stop: vi.fn(),
      connect: vi.fn(),
    }),
    createBufferSource: () => ({
      buffer: null,
      start: (when: number) => started.push({ type: "noise", when }),
      stop: vi.fn(),
      connect: vi.fn(),
    }),
    createBiquadFilter: () => ({
      type: "lowpass",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    }),
    createBuffer: (_c: number, frames: number) => ({
      getChannelData: () => new Float32Array(frames),
    }),
  };
  return { context: context as unknown as AudioContext, started };
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

describe("AudioEngine", () => {
  it("does not create an AudioContext until something is played", () => {
    const factory = vi.fn(() => fakeContext().context);
    const engine = new AudioEngine({ contextFactory: factory, storage: memoryStorage() });

    expect(factory).not.toHaveBeenCalled();
    engine.play("ui.click");
    expect(factory).toHaveBeenCalledTimes(1);

    // Browsers reject an AudioContext created before a user gesture, and the
    // resulting context stays suspended forever, so it must be lazy.
    engine.play("ui.click");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("schedules one source per layer", () => {
    const fake = fakeContext();
    const engine = new AudioEngine({ contextFactory: () => fake.context, storage: memoryStorage() });

    engine.play("card.shuffle");
    expect(fake.started).toHaveLength(SOUNDS["card.shuffle"].layers.length);
  });

  it("plays nothing while muted", () => {
    const fake = fakeContext();
    const engine = new AudioEngine({ contextFactory: () => fake.context, storage: memoryStorage() });

    engine.setMuted(true);
    expect(engine.play("ui.click")).toBe(false);
    expect(fake.started).toHaveLength(0);

    engine.setMuted(false);
    expect(engine.play("ui.click")).toBe(true);
  });

  it("throttles a retriggered sound", () => {
    const fake = fakeContext();
    let clock = 1000;
    const engine = new AudioEngine({
      contextFactory: () => fake.context,
      storage: memoryStorage(),
      now: () => clock,
    });

    expect(engine.play("ui.hover")).toBe(true);
    expect(engine.play("ui.hover")).toBe(false);

    clock += 200;
    expect(engine.play("ui.hover")).toBe(true);
  });

  it("does not throttle sounds that are meant to stack", () => {
    const fake = fakeContext();
    const engine = new AudioEngine({ contextFactory: () => fake.context, storage: memoryStorage() });
    expect(engine.play("match.victory")).toBe(true);
    expect(engine.play("match.victory")).toBe(true);
  });

  it("persists the mixer and reads it back", () => {
    const storage = memoryStorage();
    const first = new AudioEngine({ contextFactory: () => fakeContext().context, storage });
    first.setMasterVolume(0.25);
    first.setVolume("music", 0.1);

    const second = new AudioEngine({ contextFactory: () => fakeContext().context, storage });
    expect(second.getMixer().master).toBeCloseTo(0.25);
    expect(second.getMixer().volumes.music).toBeCloseTo(0.1);
  });

  it("falls back to defaults when stored settings are corrupt", () => {
    const storage = memoryStorage();
    storage.map.set("playora.audio", "{ not json");
    const engine = new AudioEngine({ contextFactory: () => fakeContext().context, storage });
    expect(engine.getMixer()).toEqual(DEFAULT_MIXER);
  });

  it("stays silent, rather than throwing, with no Web Audio at all", () => {
    const engine = new AudioEngine({
      contextFactory: () => {
        throw new Error("no Web Audio here");
      },
      storage: memoryStorage(),
    });
    expect(() => engine.play("ui.click")).not.toThrow();
    expect(engine.play("ui.click")).toBe(false);
  });

  it("survives storage that throws on write", () => {
    const engine = new AudioEngine({
      contextFactory: () => fakeContext().context,
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
      },
    });
    expect(() => engine.setMasterVolume(0.5)).not.toThrow();
    expect(engine.getMixer().master).toBeCloseTo(0.5);
  });

  it("resumes a context the browser suspended", () => {
    const fake = fakeContext();
    (fake.context as unknown as { state: string }).state = "running";
    const engine = new AudioEngine({ contextFactory: () => fake.context, storage: memoryStorage() });
    engine.play("ui.click");

    (fake.context as unknown as { state: string }).state = "suspended";
    engine.play("ui.back");
    expect(fake.context.resume).toHaveBeenCalled();
  });
});
