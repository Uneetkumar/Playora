import { describe, it, expect, vi } from "vitest";
import { AUDIO_BUSES, DEFAULT_MIXER } from "../mixer.js";
import { SOUNDS, tone, type SoundSpec } from "../sounds.js";
import { LOOPS, type LoopId, type LoopSpec } from "../loops.js";
import { AudioEngine, type AudioEngineOptions } from "../engine.js";
import { getAudioEngine } from "../shared.js";
import { fakeContext, fakeGestureTarget, memoryStorage, type FakeNode, type FakeParam } from "./fake-audio.js";

function setup(options: Partial<AudioEngineOptions> & { fake?: ReturnType<typeof fakeContext> } = {}) {
  const fake = options.fake ?? fakeContext();
  const factory = vi.fn(() => fake.context);
  const engine = new AudioEngine({
    contextFactory: factory,
    storage: memoryStorage(),
    hasUserActivation: () => true,
    ...options,
  });
  return { engine, fake, factory };
}

const param = (node: FakeNode | undefined, key: string) => node?.[key] as FakeParam;

/** Follows a node's connections downstream and reports whether it reaches `target`. */
function reaches(node: unknown, target: unknown, seen = new Set<unknown>()): boolean {
  if (node === target) return true;
  if (!node || seen.has(node)) return false;
  seen.add(node);
  return ((node as FakeNode).outputs ?? []).some((next) => reaches(next, target, seen));
}

describe("bus graph", () => {
  it("builds a master gain and one gain per bus, all feeding the destination", () => {
    const { engine, fake } = setup();
    engine.play("ui.click");
    expect(fake.master()).toBeDefined();
    expect(fake.buses()).toHaveLength(AUDIO_BUSES.length);
  });

  it("starts the graph at the stored mixer levels", () => {
    const { engine, fake } = setup();
    engine.play("ui.click");
    expect(param(fake.master(), "gain").value).toBeCloseTo(DEFAULT_MIXER.master);
    fake.buses().forEach((bus, i) => {
      const name = AUDIO_BUSES[i]!;
      expect(param(bus, "gain").value, name).toBeCloseTo(DEFAULT_MIXER.volumes[name]);
    });
  });

  it("pushes mute, master and bus changes onto the live graph", () => {
    const { engine, fake } = setup();
    engine.play("ui.click");
    const master = param(fake.master(), "gain");
    const music = param(fake.buses()[AUDIO_BUSES.indexOf("music")], "gain");

    engine.setMuted(true);
    expect(master.value).toBe(0);
    engine.setMuted(false);
    expect(master.value).toBeCloseTo(DEFAULT_MIXER.master);

    engine.setMasterVolume(0.3);
    expect(master.value).toBeCloseTo(0.3);
    engine.setVolume("music", 0.2);
    expect(music.value).toBeCloseTo(0.2);
    engine.toggleBusMuted("music");
    expect(music.value).toBe(0);
    // Glided, not stepped: a slider drag must not zipper.
    expect(master.setTargetAtTime).toHaveBeenCalled();
  });

  it("routes each sound into its own bus", () => {
    const { engine, fake } = setup();
    engine.play("ui.click");
    const ui = fake.buses()[AUDIO_BUSES.indexOf("ui")];
    const sfx = fake.buses()[AUDIO_BUSES.indexOf("sfx")];
    const osc = fake.of("osc")[0];
    expect(reaches(osc, ui)).toBe(true);
    expect(reaches(osc, sfx)).toBe(false);
  });

  it("plays a sound whose bus is muted as nothing at all", () => {
    const { engine, fake } = setup();
    engine.toggleBusMuted("ui");
    expect(engine.play("ui.click")).toBe(false);
    expect(engine.play("card.deal")).toBe(true);
    expect(fake.started).toHaveLength(SOUNDS["card.deal"].layers.length);
  });
});

describe("play(spec)", () => {
  const blip: SoundSpec = { bus: "sfx", layers: [tone(500, 0.05, 0.2)], throttleMs: 100 };

  it("plays a spec described inline", () => {
    const { engine, fake } = setup();
    expect(engine.play({ bus: "sfx", layers: [tone(300, 0.1, 0.2), tone(600, 0.1, 0.2)] })).toBe(true);
    expect(fake.started).toHaveLength(2);
  });

  it("throttles an inline spec by identity", () => {
    let clock = 0;
    const { engine } = setup({ now: () => clock });
    expect(engine.play(blip)).toBe(true);
    expect(engine.play(blip)).toBe(false);
    // An equal but separate object is a separate sound.
    expect(engine.play({ ...blip })).toBe(true);
    clock += 150;
    expect(engine.play(blip)).toBe(true);
  });

  it("refuses a malformed spec quietly", () => {
    const { engine } = setup();
    expect(engine.play({ bus: "sfx" } as unknown as SoundSpec)).toBe(false);
    expect(engine.play("no.such.sound" as never)).toBe(false);
  });

  it("scales every tone and filter by pitch", () => {
    const { engine, fake } = setup();
    engine.play("card.stack", { pitch: 2 });
    const layers = SOUNDS["card.stack"].layers.filter((l) => l.kind === "tone");
    fake.of("osc").forEach((osc, i) => {
      expect(param(osc, "frequency").setValueAtTime.mock.calls[0]?.[0]).toBeCloseTo(layers[i]!.frequency! * 2);
    });
    const noiseFilter = fake.of("filter")[0];
    expect(param(noiseFilter, "frequency").setValueAtTime.mock.calls[0]?.[0]).toBeCloseTo(2400 * 2);
  });

  it("clamps params before they reach the graph", () => {
    const { engine, fake } = setup();
    engine.play("tile.merge", { pitch: 1000, gain: Number.NaN });
    const osc = fake.of("osc")[0];
    expect(param(osc, "frequency").setValueAtTime.mock.calls[0]?.[0]).toBeCloseTo(330 * 4);
    const peaks = fake
      .of("gain")
      .flatMap((g) => param(g, "gain").exponentialRampToValueAtTime.mock.calls.map((c) => c[0] as number));
    // The peak is the layer's own gain: NaN fell back to 1x, not to 0 or 2x.
    expect(peaks).toContain(SOUNDS["tile.merge"].layers[0]!.gain);
  });

  it("schedules a delay on the audio clock", () => {
    const { engine, fake } = setup();
    engine.play("ui.click", { delay: 0.5 });
    expect(fake.started[0]?.when).toBeCloseTo(0.5);
  });

  it("pans only when asked, and only where the browser can", () => {
    const centred = setup();
    centred.engine.play("game.point");
    expect(centred.fake.of("panner")).toHaveLength(0);

    const left = setup();
    left.engine.play("game.point", { pan: -0.5 });
    expect(param(left.fake.of("panner")[0], "pan").value).toBe(-0.5);

    const oldSafari = setup({ fake: fakeContext({ noPanner: true }) });
    expect(oldSafari.engine.play("game.point", { pan: -0.5 })).toBe(true);
  });

  it("drops sounds queued before the page has ever been touched", () => {
    // They would all fire at once on the first click.
    const fake = fakeContext({ state: "suspended" });
    const { engine, factory } = setup({ fake, hasUserActivation: () => false });
    expect(engine.play("card.deal")).toBe(false);
    expect(fake.started).toHaveLength(0);
    // Nor is a context made that could only start suspended.
    expect(factory).not.toHaveBeenCalled();
  });

  it("starts over when the context is closed from outside", () => {
    const first = fakeContext();
    const second = fakeContext();
    const factory = vi.fn().mockReturnValueOnce(first.context).mockReturnValueOnce(second.context);
    const engine = new AudioEngine({ contextFactory: factory, storage: memoryStorage(), hasUserActivation: () => true });
    const loop = engine.loop("wind");
    loop.start();
    first.raw.state = "closed";

    expect(engine.play("ui.click")).toBe(true);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(second.started).toHaveLength(1);
    expect(loop.playing).toBe(false);
  });

  it("still queues sounds on a suspended context after a gesture", () => {
    const fake = fakeContext({ state: "suspended" });
    const { engine } = setup({ fake, hasUserActivation: () => true });
    expect(engine.play("card.deal")).toBe(true);
    expect(fake.raw.resume).toHaveBeenCalled();
  });
});

describe("output()", () => {
  it("hands out the shared context and a bus for hand-built nodes", () => {
    const { engine, fake } = setup();
    const out = engine.output("sfx");
    expect(out?.context).toBe(fake.context);
    expect(out?.destination).toBe(fake.buses()[AUDIO_BUSES.indexOf("sfx")]);
  });

  it("returns null when muted, so legacy `if (!ctx) return` covers mute", () => {
    const { engine } = setup();
    engine.setMuted(true);
    expect(engine.output()).toBeNull();
  });

  it("returns null without Web Audio", () => {
    const engine = new AudioEngine({
      contextFactory: () => {
        throw new Error("none");
      },
      storage: memoryStorage(),
    });
    expect(engine.output()).toBeNull();
  });
});

describe("loops", () => {
  it("does not touch Web Audio until started", () => {
    const { engine, factory } = setup();
    const loop = engine.loop("engine", { rpm: 1200 });
    loop.setParam("rpm", 3000);
    expect(factory).not.toHaveBeenCalled();
    expect(loop.playing).toBe(false);
    expect(loop.getParam("rpm")).toBe(3000);
  });

  it("builds the engine from two detuned oscillators, a shaper and a low-pass", () => {
    const { engine, fake } = setup();
    engine.loop("engine").start();
    const oscs = fake.of("osc");
    expect(oscs).toHaveLength(2);
    expect(oscs.map((o) => param(o, "detune").value).sort()).toEqual([-8, 8]);
    expect(fake.of("shaper")[0]?.curve).toBeInstanceOf(Float32Array);
    expect(fake.of("filter")[0]?.type).toBe("lowpass");
    // And it plays into the game-sounds bus, so the mixer reaches it.
    const sfx = fake.buses()[AUDIO_BUSES.indexOf("sfx")];
    expect(oscs.every((o) => reaches(o, sfx))).toBe(true);
  });

  it("starts at the initial params and fades in rather than clicking on", () => {
    const { engine, fake } = setup();
    engine.loop("engine", { rpm: 2000 }).start();
    expect(param(fake.of("osc")[0], "frequency").value).toBeCloseTo(100);
    const out = fake.of("gain").find((g) => param(g, "gain").setTargetAtTime.mock.calls.length > 0);
    expect(out).toBeDefined();
  });

  it("follows rpm with the pitch, smoothly", () => {
    const { engine, fake } = setup();
    const loop = engine.loop("engine");
    loop.start();
    loop.setParam("rpm", 4500);
    const freq = param(fake.of("osc")[0], "frequency");
    expect(freq.setTargetAtTime).toHaveBeenLastCalledWith(225, 0, expect.any(Number));
    // The default glide is the rpm smoothing, a third of it as time constant.
    expect(freq.setTargetAtTime.mock.lastCall?.[2]).toBeCloseTo(LOOPS.engine.params.rpm.smoothing / 3);
  });

  it("opens the filter with throttle", () => {
    const { engine, fake } = setup();
    const loop = engine.loop("engine", { rpm: 3000 });
    loop.start();
    const cutoff = param(fake.of("filter")[0], "frequency");
    const closed = cutoff.value;
    loop.setParam("throttle", 1);
    expect(cutoff.value).toBeGreaterThan(closed * 4);
  });

  it("honours an explicit ramp time", () => {
    const { engine, fake } = setup();
    const loop = engine.loop("wind");
    loop.start();
    loop.setParam("speed", 1, 0.9);
    const out = fake.of("gain").find((g) => param(g, "gain").setTargetAtTime.mock.calls.some((c) => c[2] === 0.3));
    expect(out).toBeDefined();
  });

  it("clamps params and schedules nothing for an unchanged value", () => {
    const { engine, fake } = setup();
    const loop = engine.loop("engine");
    loop.start();
    loop.setParam("rpm", 50000);
    expect(loop.getParam("rpm")).toBe(9000);
    const freq = param(fake.of("osc")[0], "frequency");
    const calls = freq.setTargetAtTime.mock.calls.length;
    loop.setParam("rpm", 9000);
    loop.setParam("rpm", 12000);
    expect(freq.setTargetAtTime.mock.calls.length).toBe(calls);
  });

  it("pans and trims any loop with the common params", () => {
    const { engine, fake } = setup();
    const loop = engine.loop("engine", { pan: -0.4, volume: 0.5 });
    loop.start();
    expect(param(fake.of("panner")[0], "pan").value).toBe(-0.4);
    loop.setParam("pan", 0.7);
    expect(param(fake.of("panner")[0], "pan").value).toBe(0.7);
  });

  it("runs while muted, so it is there when the sound comes back", () => {
    const { engine, fake } = setup();
    engine.setMuted(true);
    const loop = engine.loop("crowd");
    loop.start();
    expect(loop.playing).toBe(true);
    expect(param(fake.master(), "gain").value).toBe(0);
    engine.setMuted(false);
    expect(param(fake.master(), "gain").value).toBeGreaterThan(0);
  });

  it("stops every source, including LFOs, and can start again", () => {
    const { engine, fake } = setup();
    const loop = engine.loop("crowd");
    loop.start();
    const first = fake.started.map((s) => s.node);
    // Two noise voices, each with a wobble LFO.
    expect(first).toHaveLength(4);
    loop.stop(0.3);
    expect(loop.playing).toBe(false);
    for (const node of first) expect(node.stop).toHaveBeenCalledWith(expect.closeTo(0.35, 5));

    loop.start();
    expect(loop.playing).toBe(true);
    expect(fake.started).toHaveLength(8);
  });

  it("starts noise voices at different points in the shared buffer", () => {
    const { engine, fake } = setup();
    engine.loop("crowd").start();
    const offsets = fake.started
      .filter((s) => s.type === "noise")
      .map((s) => (s.node.start as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]);
    expect(offsets.every((o) => typeof o === "number")).toBe(true);
    // One buffer for everything, made once.
    const buffers = new Set(fake.of("buffer").map((b) => b.buffer));
    expect(buffers.size).toBe(1);
  });

  it("stops running loops when the engine is disposed", async () => {
    const { engine } = setup();
    const a = engine.loop("engine");
    const b = engine.loop("wind");
    a.start();
    b.start();
    await engine.dispose();
    expect(a.playing).toBe(false);
    expect(b.playing).toBe(false);
  });

  it("ignores everything once disposed", () => {
    const { engine, fake } = setup();
    const loop = engine.loop("engine");
    loop.dispose();
    loop.start();
    loop.setParam("rpm", 5000);
    expect(loop.playing).toBe(false);
    expect(fake.started).toHaveLength(0);
  });

  it("is silent, never throwing, without Web Audio", () => {
    const engine = new AudioEngine({
      contextFactory: () => {
        throw new Error("none");
      },
      storage: memoryStorage(),
    });
    const loop = engine.loop("tyre-squeal");
    expect(() => {
      loop.start();
      loop.setParam("slip", 0.9);
      loop.stop();
      loop.dispose();
    }).not.toThrow();
    expect(loop.playing).toBe(false);
  });

  it("gives an unknown id a silent handle instead of throwing", () => {
    const { engine, factory } = setup();
    const loop = engine.loop("jet-engine" as LoopId);
    expect(() => {
      loop.start();
      loop.setParam("rpm" as never, 1);
      loop.stop();
    }).not.toThrow();
    expect(loop.playing).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });

  it("plays a game's own loop spec", () => {
    const hum: LoopSpec = {
      bus: "sfx",
      voices: [{ kind: "tone", waveform: "sine", gain: 0.3 }],
      params: { tension: { min: 0, max: 1, default: 0, smoothing: 0.1 } },
      mappings: [{ param: "tension", target: "pitch", range: [80, 320], exponential: true }],
    };
    const { engine, fake } = setup();
    const loop = engine.loop(hum, { tension: 1 });
    loop.start();
    expect(param(fake.of("osc")[0], "frequency").value).toBeCloseTo(320);
  });
});

describe("gesture unlock", () => {
  it("creates and resumes the context on the first gesture, then lets go", async () => {
    const fake = fakeContext({ state: "suspended" });
    fake.raw.resume.mockImplementation(async () => {
      fake.raw.state = "running";
    });
    const { engine, factory } = setup({ fake });
    const page = fakeGestureTarget();

    engine.installGestureUnlock(page.target);
    expect(factory).not.toHaveBeenCalled();
    expect(page.count()).toBeGreaterThan(0);

    page.fire("pointerdown");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(fake.raw.resume).toHaveBeenCalled();
    // The silent frame iOS needs started inside the gesture.
    expect(fake.started.some((s) => s.type === "noise" && s.when === 0)).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    expect(page.count()).toBe(0);
  });

  it("installs its listeners once however many components ask", () => {
    const { engine } = setup();
    const page = fakeGestureTarget();
    engine.installGestureUnlock(page.target);
    const once = page.count();
    engine.installGestureUnlock(page.target);
    engine.installGestureUnlock(page.target);
    expect(page.count()).toBe(once);
  });

  it("does nothing where there is no page", () => {
    const { engine } = setup();
    expect(() => engine.installGestureUnlock(null)()).not.toThrow();
  });
});

describe("shared engine", () => {
  it("is one instance for the whole process", () => {
    expect(getAudioEngine()).toBe(getAudioEngine());
  });

  it("replaces, and closes, the previous engine when a hot reload re-evaluates the module", async () => {
    const before = getAudioEngine();
    const dispose = vi.spyOn(before, "dispose");
    vi.resetModules();
    const reloaded = await import("../shared.js");
    const after = reloaded.getAudioEngine();
    expect(dispose).toHaveBeenCalled();
    expect(after).not.toBe(before);
    expect(reloaded.getAudioEngine()).toBe(after);
  });

  it("is inert where there is no Web Audio, as during server rendering", () => {
    const engine = getAudioEngine();
    expect(engine.play("ui.click")).toBe(false);
    expect(() => engine.loop("engine").start()).not.toThrow();
  });
});
