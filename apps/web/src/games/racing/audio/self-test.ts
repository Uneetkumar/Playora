import { firingFrequency } from "@playora/audio";
import { createRaceAudio, RACE_AUDIO_EVENTS, type RaceAudio, type RaceAudioEvent, type RaceAudioFrame } from "./race-audio";
import { engineProfileFor } from "./engine-profiles";

/**
 * Renders the race's sound offline and measures it.
 *
 * Nobody can listen in CI or in a headless browser, so this is how a check
 * knows the engine is not silent and that its pitch follows the revs: an
 * OfflineAudioContext runs the very graph the race uses, as fast as the CPU
 * allows, and the samples are inspected. Browser-only (Node has no Web Audio);
 * the dev bench runs it from a button and exposes the result to Playwright.
 */

export interface EngineProbe {
  rpm: number;
  /** What the voice should be firing at. */
  firingHz: number;
  rms: number;
  /** Zero crossings per second, halved: roughly the dominant frequency. */
  zcrHz: number;
}

export interface SelfTestResult {
  profile: string;
  engine: EngineProbe[];
  /** Each cue's loudest sample: a 40 ms clunk has a tiny RMS over a second, but a clear peak. */
  events: Array<{ event: RaceAudioEvent; peak: number }>;
  /**
   * RMS of each continuous layer on its own, found by rendering with and
   * without it and subtracting powers (uncorrelated signals add in power).
   */
  layers: { engineIdle: number; engineFull: number; squeal: number; airAndRoad: number; offRoad: number };
  /** Energy in each channel for an opponent off to the right, then the left. */
  panning: { rightOfListener: [left: number, right: number]; leftOfListener: [left: number, right: number] };
  failures: string[];
  passed: boolean;
}

const RATE = 44100;
/** Below this RMS a render counts as silence (about -50 dBFS). */
const SILENCE = 0.003;

type Offline = OfflineAudioContext;

function offline(channels: number, seconds: number): Offline {
  const Ctor =
    (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext ??
    (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctor) throw new Error("No OfflineAudioContext here.");
  return new Ctor(channels, Math.round(RATE * seconds), RATE);
}

function raceOn(context: Offline, vehicle: string): RaceAudio {
  const audio = createRaceAudio({
    output: () => ({ context, destination: context.destination }),
    watchdog: false,
    vehicle,
  });
  audio.start();
  return audio;
}

function measure(data: Float32Array, skipSeconds = 0): { rms: number; zcrHz: number } {
  const start = Math.min(data.length, Math.round(skipSeconds * RATE));
  let sum = 0;
  let crossings = 0;
  for (let i = start; i < data.length; i++) {
    const x = data[i] ?? 0;
    sum += x * x;
    if (i > start && (data[i - 1] ?? 0) < 0 !== x < 0) crossings++;
  }
  const n = Math.max(1, data.length - start);
  return { rms: Math.sqrt(sum / n), zcrHz: crossings / (n / RATE) / 2 };
}

function peakOf(data: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] ?? 0));
  return peak;
}

function energy(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += (data[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, data.length));
}

export async function runRaceAudioSelfTest(vehicle: string, kind: "car" | "bike", idleRpm: number, redlineRpm: number): Promise<SelfTestResult> {
  const failures: string[] = [];
  const profile = engineProfileFor(vehicle, kind);

  // The engine at full throttle through the rev range, standing still so
  // wind and tyre noise stay out of the measurement.
  const engine: EngineProbe[] = [];
  const points = [0.2, 0.5, 0.85].map((f) => Math.round(idleRpm + (redlineRpm - idleRpm) * f));
  for (const rpm of points) {
    const context = offline(1, 0.6);
    const audio = raceOn(context, vehicle);
    audio.frame({ rpm, rpmMax: redlineRpm, throttle: 1, speed: 0, slip: 0, nitro: false, offRoad: false, kind }, 1 / 60);
    const rendered = await context.startRendering();
    audio.dispose();
    // Skip the first 200 ms: the fade-in and the glide to pitch.
    const { rms, zcrHz } = measure(rendered.getChannelData(0), 0.2);
    engine.push({ rpm, firingHz: firingFrequency(rpm, profile.voice.cylinders), rms, zcrHz });
  }
  engine.forEach((probe, i) => {
    if (probe.rms < SILENCE) failures.push(`engine silent at ${probe.rpm} rpm`);
    const previous = engine[i - 1];
    if (previous && probe.zcrHz <= previous.zcrHz) failures.push(`pitch did not rise from ${previous.rpm} to ${probe.rpm} rpm`);
  });

  // The continuous layers, each against the same scene without it.
  const scene = async (patch: Partial<RaceAudioFrame>): Promise<number> => {
    const context = offline(1, 0.7);
    const audio = raceOn(context, vehicle);
    const frame: RaceAudioFrame = {
      rpm: idleRpm,
      rpmMax: redlineRpm,
      throttle: 0,
      speed: 0,
      slip: 0,
      nitro: false,
      offRoad: false,
      kind,
      ...patch,
    };
    // Half a second of frames, so the smoothed slip has arrived.
    for (let i = 0; i < 30; i++) audio.frame(frame, 1 / 60);
    const rendered = await context.startRendering();
    audio.dispose();
    return measure(rendered.getChannelData(0), 0.3).rms;
  };
  const without = (total: number, rest: number) => Math.sqrt(Math.max(0, total * total - rest * rest));
  const idle = await scene({});
  const full = await scene({ rpm: redlineRpm * 0.8, throttle: 1 });
  const rolling = await scene({ speed: 30 });
  const layers = {
    engineIdle: idle,
    engineFull: full,
    squeal: without(await scene({ speed: 30, slip: 1 }), rolling),
    airAndRoad: without(await scene({ speed: 85 }), idle),
    offRoad: without(await scene({ speed: 25, offRoad: true }), idle),
  };
  if (layers.squeal < 0.03) failures.push(`tyre squeal too quiet (${layers.squeal.toFixed(3)})`);
  if (layers.squeal > layers.engineFull) failures.push("tyre squeal louder than the engine at full throttle");
  if (layers.airAndRoad < 0.02) failures.push(`wind at speed too quiet (${layers.airAndRoad.toFixed(3)})`);
  if (layers.offRoad < 0.03) failures.push(`off-road rumble too quiet (${layers.offRoad.toFixed(3)})`);

  // Every cue on its own: no frame is sent, so the engine bus stays shut.
  const events: SelfTestResult["events"] = [];
  for (const event of RACE_AUDIO_EVENTS) {
    const context = offline(1, 1.2);
    const audio = raceOn(context, vehicle);
    audio.event(event, event === "mini-turbo" ? 2 : 0.8);
    const rendered = await context.startRendering();
    audio.dispose();
    const peak = peakOf(rendered.getChannelData(0));
    events.push({ event, peak });
    if (peak < SILENCE * 3) failures.push(`${event} is silent`);
  }

  // An opponent ten metres to one side should be louder in that ear.
  const side = async (x: number): Promise<[number, number]> => {
    const context = offline(2, 0.5);
    const audio = raceOn(context, vehicle);
    audio.setOpponents([{ id: "probe", x, y: 0, z: -2, rpm: 6000 }], { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 });
    const rendered = await context.startRendering();
    audio.dispose();
    return [energy(rendered.getChannelData(0)), energy(rendered.getChannelData(1))];
  };
  const rightOfListener = await side(10);
  const leftOfListener = await side(-10);
  if (!(rightOfListener[1] > rightOfListener[0] * 1.5)) failures.push("an opponent on the right is not louder on the right");
  if (!(leftOfListener[0] > leftOfListener[1] * 1.5)) failures.push("an opponent on the left is not louder on the left");
  if (rightOfListener[1] < SILENCE / 3) failures.push("opponent engine is silent");

  return {
    profile: profile.key,
    engine,
    layers,
    events,
    panning: { rightOfListener, leftOfListener },
    failures,
    passed: failures.length === 0,
  };
}
