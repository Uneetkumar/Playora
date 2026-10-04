import { describe, it, expect, vi } from "vitest";
import { RaceInput, keyControl, type AnalogInput, type RaceInputEnvironment } from "../race-input";
import {
  KEY_STEER_RATE,
  KEY_STEER_RETURN,
  approachSteer,
  pointerSteerFromX,
  shapeStick,
  shapeTrigger,
  strongest,
} from "../shaping";
import { createTouchDrive } from "../../touch-controls";

/** An event target that remembers its listeners, so a test can fire at them. */
function target(extra: Record<string, unknown> = {}) {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: (e: unknown) => void) => void listeners.get(type)?.delete(fn),
    fire: (type: string, event: Record<string, unknown> = {}) => {
      for (const fn of [...(listeners.get(type) ?? [])]) fn({ type, ...event });
    },
    count: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    ...extra,
  };
}

interface Pad {
  index: number;
  connected: boolean;
  mapping: string;
  axes: number[];
  buttons: Array<{ pressed: boolean; value: number }>;
  vibrationActuator?: { playEffect: ReturnType<typeof vi.fn> };
}

function pad(): Pad {
  return {
    index: 0,
    connected: true,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    vibrationActuator: { playEffect: vi.fn(async () => "complete") },
  };
}

function setup() {
  let clock = 0;
  const win = target();
  const doc = target({ hidden: false });
  const canvas = target({
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
    setPointerCapture: vi.fn(),
  });
  const pads: Array<Pad | null> = [];
  const vibrate = vi.fn(() => true);
  const env: RaceInputEnvironment = {
    window: win,
    document: doc as unknown as RaceInputEnvironment["document"],
    navigator: { getGamepads: () => pads as never, vibrate },
    now: () => clock,
  };
  const input = new RaceInput(env);
  input.attach(canvas as unknown as HTMLElement);
  input.read();
  const advance = (ms: number): AnalogInput => {
    clock += ms;
    return input.read();
  };
  const key = (type: "keydown" | "keyup", code: string, extra: Record<string, unknown> = {}) => {
    const preventDefault = vi.fn();
    win.fire(type, { code, key: code, repeat: false, target: null, preventDefault, ...extra });
    return preventDefault;
  };
  return { input, win, doc, canvas, pads, vibrate, advance, key };
}

describe("shaping", () => {
  it("ramps towards lock at the press rate and back at the return rate", () => {
    expect(approachSteer(0, 1, 0.1)).toBeCloseTo(KEY_STEER_RATE * 0.1);
    expect(approachSteer(1, 0, 0.1)).toBeCloseTo(1 - KEY_STEER_RETURN * 0.1);
    // Reversing goes back through centre at the faster rate.
    expect(approachSteer(0.5, -1, 0.1)).toBeCloseTo(0.5 - KEY_STEER_RETURN * 0.1);
    expect(approachSteer(0.9, 1, 1)).toBe(1);
  });

  it("ignores a resting stick and keeps fine control near centre", () => {
    expect(shapeStick(0.08)).toBe(0);
    expect(shapeStick(-0.08)).toBe(0);
    expect(shapeStick(1)).toBeCloseTo(1);
    expect(shapeStick(-1)).toBeCloseTo(-1);
    const half = shapeStick(0.56);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(0.5);
    expect(shapeStick(Number.NaN)).toBe(0);
  });

  it("gives triggers slack at both ends", () => {
    expect(shapeTrigger(0.02)).toBe(0);
    expect(shapeTrigger(0.98)).toBe(1);
    expect(shapeTrigger(0.5)).toBeCloseTo(0.5, 1);
  });

  it("steers straight through the middle of the canvas", () => {
    expect(pointerSteerFromX(500, 0, 1000)).toBe(0);
    expect(pointerSteerFromX(550, 0, 1000)).toBe(0);
    expect(pointerSteerFromX(1000, 0, 1000)).toBe(1);
    expect(pointerSteerFromX(0, 0, 1000)).toBe(-1);
    expect(pointerSteerFromX(750, 0, 1000)).toBeGreaterThan(0.4);
    expect(pointerSteerFromX(750, 0, 0)).toBe(0);
  });

  it("merges by magnitude", () => {
    expect(strongest(0.2, -0.7, 0.5)).toBe(-0.7);
    expect(strongest(0, Number.NaN)).toBe(0);
  });
});

describe("keyboard", () => {
  it("maps physical keys and falls back to the key name", () => {
    expect(keyControl({ code: "KeyW", key: "z" })).toBe("throttle");
    expect(keyControl({ code: "", key: "ArrowLeft" })).toBe("left");
    expect(keyControl({ code: "ShiftRight", key: "Shift" })).toBe("nitro");
    expect(keyControl({ code: "KeyQ", key: "q" })).toBeNull();
  });

  it("holds throttle and brake while the keys are down", () => {
    const { advance, key } = setup();
    key("keydown", "KeyW");
    expect(advance(16).throttle).toBe(1);
    key("keyup", "KeyW");
    key("keydown", "ArrowDown");
    const frame = advance(16);
    expect(frame.throttle).toBe(0);
    expect(frame.brake).toBe(1);
  });

  it("ramps the steering instead of snapping it", () => {
    const { advance, key } = setup();
    key("keydown", "KeyD");
    expect(advance(0).steer).toBe(0);
    expect(advance(100).steer).toBeCloseTo(KEY_STEER_RATE * 0.1);
    for (let i = 0; i < 10; i++) advance(50);
    expect(advance(16).steer).toBe(1);
    key("keyup", "KeyD");
    expect(advance(100).steer).toBeCloseTo(1 - KEY_STEER_RETURN * 0.1);
  });

  it("lets the key pressed last win when both are held", () => {
    const { advance, key } = setup();
    key("keydown", "KeyA");
    key("keydown", "KeyD");
    for (let i = 0; i < 20; i++) advance(50);
    expect(advance(16).steer).toBe(1);
    key("keyup", "KeyD");
    for (let i = 0; i < 20; i++) advance(50);
    expect(advance(16).steer).toBe(-1);
  });

  it("stops arrows and space scrolling the page, but leaves letters alone", () => {
    const { key } = setup();
    expect(key("keydown", "ArrowUp")).toHaveBeenCalled();
    expect(key("keydown", "Space")).toHaveBeenCalled();
    expect(key("keydown", "KeyW")).not.toHaveBeenCalled();
  });

  it("ignores typing in a text field and keys inside the pause menu", () => {
    const { advance, key } = setup();
    const field = { tagName: "INPUT" };
    const prevent = key("keydown", "ArrowUp", { target: field });
    expect(prevent).not.toHaveBeenCalled();
    expect(advance(16).throttle).toBe(0);
    const menuButton = { tagName: "BUTTON", closest: (sel: string) => (sel.includes("dialog") ? {} : null) };
    key("keydown", "Space", { target: menuButton });
    expect(advance(16).handbrake).toBe(false);
  });

  it("leaves browser shortcuts alone", () => {
    const { advance, key } = setup();
    key("keydown", "KeyW", { ctrlKey: true });
    expect(advance(16).throttle).toBe(0);
  });

  it("fires the camera once per press", () => {
    const { advance, key } = setup();
    key("keydown", "KeyC");
    expect(advance(16).cameraNext).toBe(true);
    expect(advance(16).cameraNext).toBe(false);
    key("keydown", "KeyC", { repeat: true });
    expect(advance(16).cameraNext).toBe(false);
  });

  it("releases everything when the window loses focus or the tab hides", () => {
    const { advance, key, win, doc, input } = setup();
    key("keydown", "KeyW");
    key("keydown", "KeyD");
    for (let i = 0; i < 5; i++) advance(50);
    win.fire("blur");
    let frame = advance(16);
    expect(frame.throttle).toBe(0);
    expect(frame.steer).toBe(0);
    key("keydown", "KeyW");
    input.setTouch({ brake: 1 });
    (doc as unknown as { hidden: boolean }).hidden = true;
    doc.fire("visibilitychange");
    frame = advance(16);
    expect(frame.throttle).toBe(0);
    expect(frame.brake).toBe(0);
  });
});

describe("touch", () => {
  it("is never overwritten by the keyboard", () => {
    const { advance, key, input } = setup();
    input.setTouch({ throttle: 1, steer: -0.3 });
    expect(advance(16)).toMatchObject({ throttle: 1, steer: -0.3 });
    key("keydown", "KeyS");
    key("keyup", "KeyS");
    key("keydown", "KeyW");
    key("keyup", "KeyW");
    expect(advance(16)).toMatchObject({ throttle: 1, steer: -0.3 });
  });

  it("merges with the keyboard by magnitude", () => {
    const { advance, key, input } = setup();
    input.setTouch({ steer: -0.3 });
    key("keydown", "KeyD");
    for (let i = 0; i < 20; i++) advance(50);
    expect(advance(16).steer).toBe(1);
    key("keyup", "KeyD");
    for (let i = 0; i < 20; i++) advance(50);
    expect(advance(16).steer).toBe(-0.3);
  });

  it("clamps junk", () => {
    const { advance, input } = setup();
    input.setTouch({ steer: 7, throttle: Number.NaN, brake: -2 });
    expect(advance(16)).toMatchObject({ steer: 1, throttle: 0, brake: 0 });
  });

  it("treats a camera tap as one press", () => {
    const { advance, input } = setup();
    input.setTouch({ cameraNext: true });
    expect(advance(16).cameraNext).toBe(true);
    expect(advance(16).cameraNext).toBe(false);
  });
});

describe("gamepad", () => {
  it("reads the stick and the analog triggers", () => {
    const { advance, pads } = setup();
    const p = pad();
    p.axes[0] = -0.6;
    p.buttons[7] = { pressed: true, value: 0.5 };
    p.buttons[6] = { pressed: false, value: 0.02 };
    pads.push(p);
    const frame = advance(16);
    expect(frame.steer).toBeCloseTo(shapeStick(-0.6));
    expect(frame.throttle).toBeCloseTo(shapeTrigger(0.5));
    expect(frame.brake).toBe(0);
  });

  it("maps the face buttons", () => {
    const { advance, pads } = setup();
    const p = pad();
    p.buttons[0] = { pressed: true, value: 1 };
    p.buttons[2] = { pressed: true, value: 1 };
    p.buttons[5] = { pressed: true, value: 1 };
    pads.push(p);
    expect(advance(16)).toMatchObject({ nitro: true, handbrake: true, lookBack: true });
  });

  it("fires the camera on the press, not while held, and not after a pause", () => {
    const { advance, pads, input } = setup();
    const p = pad();
    pads.push(p);
    advance(16);
    p.buttons[3] = { pressed: true, value: 1 };
    expect(advance(16).cameraNext).toBe(true);
    expect(advance(16).cameraNext).toBe(false);
    p.buttons[3] = { pressed: false, value: 0 };
    advance(16);
    p.buttons[3] = { pressed: true, value: 1 };
    input.clear();
    expect(advance(16).cameraNext).toBe(false);
  });

  it("steers digitally with the d-pad, ramped like keys", () => {
    const { advance, pads } = setup();
    const p = pad();
    p.buttons[15] = { pressed: true, value: 1 };
    pads.push(p);
    advance(0);
    expect(advance(100).steer).toBeCloseTo(KEY_STEER_RATE * 0.1);
  });

  it("rumbles the pad only when the player is on it", () => {
    const { advance, pads, input, key } = setup();
    const p = pad();
    pads.push(p);
    key("keydown", "KeyW");
    advance(16);
    input.rumble(0.8, 200);
    expect(p.vibrationActuator!.playEffect).not.toHaveBeenCalled();
    key("keyup", "KeyW");
    p.buttons[7] = { pressed: true, value: 1 };
    advance(16);
    input.rumble(0.8, 200);
    expect(p.vibrationActuator!.playEffect).toHaveBeenCalledWith(
      "dual-rumble",
      expect.objectContaining({ duration: 200, weakMagnitude: 0.8 }),
    );
  });
});

describe("pointer", () => {
  it("steers and accelerates with a mouse held on the canvas", () => {
    const { advance, canvas } = setup();
    canvas.fire("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: 950 });
    let frame = advance(16);
    expect(frame.throttle).toBe(1);
    for (let i = 0; i < 20; i++) frame = advance(16);
    expect(frame.steer).toBeGreaterThan(0.9);
    canvas.fire("pointermove", { pointerId: 1, pointerType: "mouse", buttons: 1, clientX: 520 });
    for (let i = 0; i < 30; i++) frame = advance(16);
    expect(Math.abs(frame.steer)).toBeLessThan(0.02);
    canvas.fire("pointerup", { pointerId: 1, pointerType: "mouse", button: 0, buttons: 0 });
    expect(advance(16)).toMatchObject({ throttle: 0, steer: 0 });
  });

  it("brakes with the right button", () => {
    const { advance, canvas } = setup();
    canvas.fire("pointerdown", { pointerId: 1, pointerType: "mouse", button: 2, buttons: 2, clientX: 500 });
    expect(advance(16)).toMatchObject({ brake: 1, throttle: 0 });
  });

  it("never steers from a touch on the canvas", () => {
    const { advance, canvas } = setup();
    canvas.fire("pointerdown", { pointerId: 3, pointerType: "touch", button: 0, buttons: 1, clientX: 990 });
    expect(advance(16)).toMatchObject({ throttle: 0, steer: 0 });
  });

  it("can be turned off", () => {
    const { advance, canvas, input } = setup();
    input.attach(canvas as unknown as HTMLElement, { pointer: false });
    canvas.fire("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: 990 });
    expect(advance(16).throttle).toBe(0);
  });

  it("lets go when the browser cancels the pointer", () => {
    const { advance, canvas } = setup();
    canvas.fire("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: 900 });
    canvas.fire("pointercancel", { pointerId: 1 });
    expect(advance(16).throttle).toBe(0);
  });
});

describe("lifecycle", () => {
  it("vibrates a phone for touch players, spaced out", () => {
    const { input, vibrate, advance } = setup();
    input.setTouch({ throttle: 1 });
    input.rumble(1, 100);
    input.rumble(1, 100);
    expect(vibrate).toHaveBeenCalledTimes(1);
    advance(150);
    input.rumble(0.5, 100);
    expect(vibrate).toHaveBeenCalledTimes(2);
    input.rumble(0, 100);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("removes every listener on dispose and can be attached again", () => {
    const { input, win, doc, canvas, key, advance } = setup();
    input.dispose();
    expect(win.count() + doc.count() + canvas.count()).toBe(0);
    key("keydown", "KeyW");
    expect(advance(16).throttle).toBe(0);
    input.attach(canvas as unknown as HTMLElement);
    key("keydown", "KeyW");
    expect(advance(16).throttle).toBe(1);
  });

  it("does nothing on the server", () => {
    const input = new RaceInput({ window: null, document: null, navigator: null, now: () => 0 });
    input.attach(null);
    expect(input.read()).toMatchObject({ steer: 0, throttle: 0, brake: 0, nitro: false });
  });
});

describe("touch drive", () => {
  function drive() {
    const state: Partial<AnalogInput> = {};
    const frames: Array<(t: number) => void> = [];
    const d = createTouchDrive(
      { setTouch: (p) => Object.assign(state, p) },
      { requestFrame: (cb) => frames.push(cb), cancelFrame: () => {} },
    );
    let time = 0;
    const run = (count: number) => {
      for (let i = 0; i < count && frames.length > 0; i++) {
        time += 16;
        frames.shift()!(time);
      }
    };
    return { d, state, run, frames };
  }

  it("keeps steering while one of two fingers is still down", () => {
    const { d, state, run } = drive();
    d.press("left", 1);
    d.press("right", 2);
    run(60);
    expect(state.steer).toBe(1);
    d.release(2);
    run(60);
    expect(state.steer).toBe(-1);
  });

  it("releases a button the browser cancelled", () => {
    const { d, state } = drive();
    d.press("throttle", 5);
    expect(state.throttle).toBe(1);
    d.release(5);
    expect(state.throttle).toBe(0);
  });

  it("only animates while the wheel is moving", () => {
    const { d, run, frames } = drive();
    d.press("right", 1);
    run(100);
    expect(frames).toHaveLength(0);
    d.press("nitro", 2);
    expect(frames).toHaveLength(0);
  });

  it("taps the camera once", () => {
    const { d, state } = drive();
    d.press("camera", 9);
    expect(state.cameraNext).toBe(true);
  });
});
