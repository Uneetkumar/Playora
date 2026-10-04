import { describe, it, expect, vi } from "vitest";
import { BIKES, CARS } from "@playora/game-engine";
import { createRaceAudio, RACE_AUDIO_EVENTS, type RaceAudioFrame } from "../race-audio";
import { RACE_CUES, cueParams } from "../cues";
import { ENGINE_PROFILES, engineProfileFor } from "../engine-profiles";
import { assignRivalSlots, rivalDetune } from "../opponents";

/*
 * Just enough Web Audio to watch what the race builds. Params record the last
 * value they were steered to; sources record start and stop.
 */
interface FakeParam {
  value: number;
  setTargetAtTime: (v: number) => void;
  setValueAtTime: (v: number) => void;
  linearRampToValueAtTime: (v: number) => void;
  exponentialRampToValueAtTime: (v: number) => void;
  cancelScheduledValues: () => void;
}
interface FakeNode {
  kind: string;
  outputs: unknown[];
  started?: boolean;
  stopped?: boolean;
  [key: string]: unknown;
}

function param(initial = 0): FakeParam {
  const p: FakeParam = {
    value: initial,
    setTargetAtTime: (v) => void (p.value = v),
    setValueAtTime: (v) => void (p.value = v),
    linearRampToValueAtTime: (v) => void (p.value = v),
    exponentialRampToValueAtTime: (v) => void (p.value = v),
    cancelScheduledValues: () => {},
  };
  return p;
}

function fakeContext() {
  const nodes: FakeNode[] = [];
  const node = (kind: string, extra: Record<string, unknown> = {}): FakeNode => {
    const n: FakeNode = {
      kind,
      outputs: [],
      connect: (to: unknown) => {
        n.outputs.push(to);
        return to;
      },
      disconnect: () => {
        n.outputs = [];
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  const source = (kind: string, extra: Record<string, unknown>) => {
    const n = node(kind, extra);
    n.start = () => void (n.started = true);
    n.stop = () => void (n.stopped = true);
    n.onended = null;
    return n;
  };
  const destination = node("destination");
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    state: "running",
    destination,
    createGain: () => node("gain", { gain: param(1) }),
    createOscillator: () => source("osc", { type: "sine", frequency: param(440), detune: param(0) }),
    createBufferSource: () => source("buffer", { buffer: null, loop: false, playbackRate: param(1) }),
    createBiquadFilter: () => node("filter", { type: "lowpass", frequency: param(350), Q: param(1) }),
    createWaveShaper: () => node("shaper", { curve: null, oversample: "none" }),
    createStereoPanner: () => node("stereo", { pan: param(0) }),
    createPanner: () =>
      node("panner", {
        positionX: param(0),
        positionY: param(0),
        positionZ: param(0),
      }),
    createBuffer: (_c: number, frames: number, rate: number) => {
      const data = new Float32Array(frames);
      return { length: frames, duration: frames / rate, getChannelData: () => data };
    },
  };
  const bus = node("bus", { gain: param(1) });
  const of = (kind: string) => nodes.filter((n) => n.kind === kind);
  const running = () => nodes.filter((n) => n.started && !n.stopped);
  return {
    output: () => ({ context: context as unknown as BaseAudioContext, destination: bus as unknown as AudioNode }),
    context,
    nodes,
    of,
    running,
  };
}

const FRAME: RaceAudioFrame = {
  rpm: 900,
  rpmMax: 7500,
  throttle: 0,
  speed: 0,
  slip: 0,
  nitro: false,
  offRoad: false,
  kind: "car",
};

function setup() {
  const fake = fakeContext();
  const audio = createRaceAudio({ output: fake.output, watchdog: false, vehicle: "muscle" });
  return { fake, audio };
}

/** The sawtooth carrying the player's firing frequency: the first one built. */
const playerSaw = (fake: ReturnType<typeof fakeContext>) =>
  fake.of("osc").find((o) => o.type === "sawtooth") as FakeNode & { frequency: FakeParam };

describe("cues", () => {
  it("has a sound for every event other code can fire", () => {
    for (const event of RACE_AUDIO_EVENTS) {
      const layers = RACE_CUES[event];
      expect(layers.length, event).toBeGreaterThan(0);
      for (const layer of layers) expect(layer.duration, event).toBeGreaterThan(0);
    }
  });

  it("hits harder and lower the stronger the collision", () => {
    const soft = cueParams("collision", 0.1);
    const hard = cueParams("collision", 1);
    expect(hard.gain!).toBeGreaterThan(soft.gain!);
    expect(hard.pitch!).toBeLessThan(soft.pitch!);
  });

  it("pitches mini-turbo tiers upward and clamps junk", () => {
    expect(cueParams("mini-turbo", 3).pitch!).toBeGreaterThan(cueParams("mini-turbo", 1).pitch!);
    expect(cueParams("mini-turbo", 99).pitch).toBe(cueParams("mini-turbo", 3).pitch);
  });
});

describe("engine profiles", () => {
  it("voices every car and bike in the garage", () => {
    for (const spec of [...CARS, ...BIKES]) expect(ENGINE_PROFILES[spec.modelId], spec.modelId).toBeDefined();
  });

  it("falls back to the class default for an unknown model", () => {
    expect(engineProfileFor("hovercraft", "car").key).toBe("gt");
    expect(engineProfileFor(null, "bike").key).toBe("bike-sport");
  });

  it("revs bikes higher than cars for the same layout", () => {
    // Thinner: less sub, a brighter filter.
    const bike = engineProfileFor("bike-sport", "bike").voice;
    const hatch = engineProfileFor("hatch", "car").voice;
    expect(bike.sub).toBeLessThan(hatch.sub);
    expect(bike.cutoff[1]).toBeGreaterThan(hatch.cutoff[1]);
  });
});

describe("rival slots", () => {
  it("voices the nearest four", () => {
    const cars = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, distance: (6 - i) * 10 }));
    const slots = assignRivalSlots([null, null, null, null], cars, 200);
    expect(new Set(slots)).toEqual(new Set(["c", "d", "e", "f"]));
  });

  it("keeps a car in its slot while it stays near", () => {
    const first = assignRivalSlots([null, null, null, null], [{ id: "a", distance: 30 }, { id: "b", distance: 10 }], 200);
    const next = assignRivalSlots(first, [{ id: "a", distance: 12 }, { id: "b", distance: 40 }, { id: "c", distance: 5 }], 200);
    expect(next.indexOf("a")).toBe(first.indexOf("a"));
    expect(next.indexOf("b")).toBe(first.indexOf("b"));
    expect(next).toContain("c");
  });

  it("does not hand a voice back and forth between two cars at nearly equal distance", () => {
    const four = ["a", "b", "c", "d"].map((id) => ({ id, distance: 10 }));
    const held = assignRivalSlots([null, null, null, null], [...four, { id: "e", distance: 50 }], 200);
    // e edges slightly closer than d: d is the incumbent and keeps it.
    const next = assignRivalSlots(held, [...four.slice(0, 3), { id: "d", distance: 50 }, { id: "e", distance: 48 }], 200);
    expect(next).toContain("d");
    expect(next).not.toContain("e");
  });

  it("ignores cars out of earshot", () => {
    expect(assignRivalSlots([null, null], [{ id: "far", distance: 500 }], 180)).toEqual([null, null]);
  });

  it("gives each car a small stable detune", () => {
    expect(rivalDetune("abc")).toBe(rivalDetune("abc"));
    for (const id of ["a", "bb", "player-7", "x".repeat(40)]) {
      expect(rivalDetune(id)).toBeGreaterThanOrEqual(0.98);
      expect(rivalDetune(id)).toBeLessThanOrEqual(1.02);
    }
  });
});

describe("createRaceAudio", () => {
  it("builds nothing until started", () => {
    const { fake, audio } = setup();
    audio.frame(FRAME, 1 / 60);
    audio.event("go");
    expect(fake.nodes.filter((n) => n.kind !== "destination" && n.kind !== "bus")).toHaveLength(0);
  });

  it("pitches the engine with the revs", () => {
    const { fake, audio } = setup();
    audio.start();
    audio.frame({ ...FRAME, rpm: 1500, throttle: 1 }, 1 / 60);
    const low = playerSaw(fake).frequency.value;
    audio.frame({ ...FRAME, rpm: 6000, throttle: 1 }, 1 / 60);
    const high = playerSaw(fake).frequency.value;
    // A V8 fires four times per revolution.
    expect(low).toBeCloseTo((8 * 1500) / 120);
    expect(high).toBeCloseTo((8 * 6000) / 120);
  });

  it("squeals only past the grip threshold, and not on grass", () => {
    const { fake, audio } = setup();
    audio.start();
    const squealLevel = () => {
      const band = fake.of("filter").find((f) => f.type === "bandpass" && (f.Q as FakeParam).value === 4)!;
      return ((band.outputs[0] as FakeNode).gain as FakeParam).value;
    };
    for (let i = 0; i < 30; i++) audio.frame({ ...FRAME, speed: 30, slip: 0.05 }, 1 / 60);
    expect(squealLevel()).toBe(0);
    for (let i = 0; i < 30; i++) audio.frame({ ...FRAME, speed: 30, slip: 0.9 }, 1 / 60);
    const onTarmac = squealLevel();
    expect(onTarmac).toBeGreaterThan(0.1);
    for (let i = 0; i < 30; i++) audio.frame({ ...FRAME, speed: 30, slip: 0.9, offRoad: true }, 1 / 60);
    expect(squealLevel()).toBeLessThan(onTarmac / 4);
  });

  it("plays every event without throwing", () => {
    const { fake, audio } = setup();
    audio.start();
    audio.frame({ ...FRAME, rpm: 6000, throttle: 1 }, 1 / 60);
    const before = fake.nodes.length;
    for (const event of RACE_AUDIO_EVENTS) expect(() => audio.event(event, 0.8)).not.toThrow();
    expect(fake.nodes.length).toBeGreaterThan(before + RACE_AUDIO_EVENTS.length);
  });

  it("crackles when lifting off hard from high revs", () => {
    const { fake, audio } = setup();
    audio.start();
    audio.frame({ ...FRAME, rpm: 6800, throttle: 1, speed: 40 }, 1 / 60);
    const before = fake.of("buffer").length;
    audio.frame({ ...FRAME, rpm: 6700, throttle: 0, speed: 40 }, 1 / 60);
    expect(fake.of("buffer").length).toBeGreaterThan(before + 2);
  });

  it("voices the nearest opponents in space", () => {
    const { fake, audio } = setup();
    audio.start();
    audio.frame(FRAME, 1 / 60);
    const listener = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 };
    const field = Array.from({ length: 7 }, (_, i) => ({ id: `ai-${i}`, x: i * 3, y: 0, z: -i * 8, rpm: 5000 }));
    audio.setOpponents(field, listener);
    expect(fake.of("panner")).toHaveLength(4);
    // Opponents within earshot are placed relative to the listener.
    const placed = fake.of("panner").map((p) => (p.positionZ as FakeParam).value);
    expect(placed.every((z) => z <= 0)).toBe(true);
    // The same field again: no new voices.
    audio.setOpponents(field, listener);
    expect(fake.of("panner")).toHaveLength(4);
  });

  it("stops everything when muted and rebuilds when unmuted", () => {
    const { fake, audio } = setup();
    audio.start();
    audio.frame(FRAME, 1 / 60);
    expect(fake.running().length).toBeGreaterThan(3);
    audio.setMuted(true);
    expect(fake.running()).toHaveLength(0);
    const built = fake.nodes.length;
    audio.frame(FRAME, 1 / 60);
    audio.event("coin");
    audio.setOpponents([{ id: "a", x: 0, y: 0, z: -5, rpm: 4000 }], { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 });
    expect(fake.nodes.length).toBe(built);
    audio.setMuted(false);
    audio.frame(FRAME, 1 / 60);
    expect(fake.running().length).toBeGreaterThan(3);
  });

  it("releases everything on dispose and ignores calls afterwards", () => {
    const { fake, audio } = setup();
    audio.start();
    audio.frame(FRAME, 1 / 60);
    audio.dispose();
    expect(fake.running()).toHaveLength(0);
    const built = fake.nodes.length;
    audio.start();
    audio.frame(FRAME, 1 / 60);
    audio.event("finish");
    expect(fake.nodes.length).toBe(built);
  });

  it("swaps the engine when the vehicle changes", () => {
    const { fake, audio } = setup();
    audio.start();
    audio.frame({ ...FRAME, rpm: 6000 }, 1 / 60);
    audio.setVehicle("supercar");
    audio.frame({ ...FRAME, rpm: 6000 }, 1 / 60);
    const saws = fake.of("osc").filter((o) => o.type === "sawtooth" && !o.stopped);
    // V12: twelve firings per two revolutions.
    expect((saws.at(-1)!.frequency as FakeParam).value).toBeCloseTo((12 * 6000) / 120);
  });

  it("fades out when frames stop arriving", () => {
    vi.useFakeTimers();
    try {
      let clock = 0;
      const fake = fakeContext();
      const audio = createRaceAudio({ output: fake.output, now: () => clock });
      audio.start();
      audio.frame(FRAME, 1 / 60);
      const out = fake.nodes.find((n) => n.kind === "gain" && n.outputs.includes(fake.output().destination))!;
      expect((out.gain as FakeParam).value).toBe(1);
      clock += 1000;
      vi.advanceTimersByTime(300);
      expect((out.gain as FakeParam).value).toBe(0);
      audio.frame(FRAME, 1 / 60);
      expect((out.gain as FakeParam).value).toBe(1);
      audio.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays silent and quiet without Web Audio", () => {
    const audio = createRaceAudio({ watchdog: false });
    expect(() => {
      audio.start();
      audio.frame(FRAME, 1 / 60);
      audio.event("collision", 1);
      audio.setOpponents([], { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 });
      audio.dispose();
    }).not.toThrow();
  });
});
