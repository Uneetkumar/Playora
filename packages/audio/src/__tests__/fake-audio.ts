import { vi } from "vitest";

/**
 * Enough of Web Audio to observe what the engine builds and schedules.
 *
 * Every node records what it connects to, and every AudioParam records its
 * automation calls. `setTargetAtTime` jumps `value` straight to the target so a
 * test can read "where is this heading" without simulating the curve.
 */

export interface FakeParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
}

export interface FakeNode {
  kind: "gain" | "osc" | "buffer" | "filter" | "shaper" | "panner" | "destination";
  outputs: unknown[];
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

export function fakeParam(initial = 0): FakeParam {
  const param: FakeParam = {
    value: initial,
    setValueAtTime: vi.fn((v: number) => {
      param.value = v;
    }),
    linearRampToValueAtTime: vi.fn((v: number) => {
      param.value = v;
    }),
    exponentialRampToValueAtTime: vi.fn((v: number) => {
      param.value = v;
    }),
    setTargetAtTime: vi.fn((v: number) => {
      param.value = v;
    }),
    cancelScheduledValues: vi.fn(),
  };
  return param;
}

export interface FakeContextOptions {
  state?: AudioContextState;
  /** Leave out createStereoPanner, as Safari before 14.1 does. */
  noPanner?: boolean;
}

export function fakeContext(options: FakeContextOptions = {}) {
  const nodes: FakeNode[] = [];
  const started: Array<{ type: "osc" | "noise"; when: number; node: FakeNode }> = [];

  const node = (kind: FakeNode["kind"], extra: Record<string, unknown> = {}): FakeNode => {
    const n: FakeNode = {
      kind,
      outputs: [],
      connect: vi.fn((dest: unknown) => {
        n.outputs.push(dest);
        return dest;
      }),
      disconnect: vi.fn(),
      ...extra,
    };
    if (kind !== "destination") nodes.push(n);
    return n;
  };

  const destination = node("destination");

  const context = {
    currentTime: 0,
    sampleRate: 48000,
    state: options.state ?? ("running" as AudioContextState),
    destination,
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
    createGain: () => node("gain", { gain: fakeParam(1) }),
    createOscillator: () => {
      const n: FakeNode = node("osc", {
        type: "sine",
        frequency: fakeParam(440),
        detune: fakeParam(0),
        onended: null,
        stop: vi.fn(),
      });
      n.start = vi.fn((when: number) => started.push({ type: "osc", when, node: n }));
      return n;
    },
    createBufferSource: () => {
      const n: FakeNode = node("buffer", { buffer: null, loop: false, onended: null, stop: vi.fn() });
      n.start = vi.fn((when: number) => started.push({ type: "noise", when, node: n }));
      return n;
    },
    createBiquadFilter: () => node("filter", { type: "lowpass", frequency: fakeParam(350), Q: fakeParam(1) }),
    createWaveShaper: () => node("shaper", { curve: null, oversample: "none" }),
    createStereoPanner: options.noPanner ? undefined : () => node("panner", { pan: fakeParam(0) }),
    createBuffer: (_channels: number, frames: number, rate: number) => ({
      length: frames,
      duration: frames / rate,
      getChannelData: () => new Float32Array(frames),
    }),
  };

  const of = (kind: FakeNode["kind"]) => nodes.filter((n) => n.kind === kind);

  /** The master gain: the one gain wired straight to the destination. */
  const master = () => of("gain").find((n) => n.outputs.includes(destination));
  /** Bus gains in creation order, which is `AUDIO_BUSES` order. */
  const buses = () => {
    const m = master();
    return of("gain").filter((n) => m !== undefined && n.outputs.includes(m));
  };

  return { context: context as unknown as AudioContext, raw: context, nodes, started, of, master, buses };
}

export function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

/** A window stand-in that collects gesture listeners so a test can fire them. */
export function fakeGestureTarget() {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const target = {
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener);
    }),
  };
  const fire = (type: string) => {
    for (const listener of [...(listeners.get(type) ?? [])]) {
      if (typeof listener === "function") listener(new Event(type));
      else listener.handleEvent(new Event(type));
    }
  };
  const count = () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
  return { target, fire, count };
}
