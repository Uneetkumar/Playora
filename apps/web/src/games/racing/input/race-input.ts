"use client";

import * as React from "react";
import {
  POINTER_FOLLOW,
  approachSteer,
  pointerSteerFromX,
  shapeStick,
  shapeTrigger,
  strongest,
} from "./shaping";

export { useTouchCapable } from "../touch-controls";

/**
 * One frame of driving input, from whatever the player is holding.
 *
 * Analog where the hardware is (a trigger half-pressed is half throttle), and
 * digital controls made to behave analog (held keys ramp the steering), so the
 * physics sees one kind of input whatever the device.
 */
export type AnalogInput = {
  /** -1 full left .. 1 full right. */
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  /** Held. A press counter for the engine is the caller's rising edge. */
  nitro: boolean;
  lookBack: boolean;
  /** True once per press; consumed by the `read()` that returns it. */
  cameraNext: boolean;
};

export type InputSource = "keyboard" | "gamepad" | "pointer" | "touch";

export const NEUTRAL_INPUT: Readonly<AnalogInput> = Object.freeze({
  steer: 0,
  throttle: 0,
  brake: 0,
  handbrake: false,
  nitro: false,
  lookBack: false,
  cameraNext: false,
});

type Listenable = Pick<EventTarget, "addEventListener" | "removeEventListener">;

interface ButtonLike {
  pressed: boolean;
  value: number;
}

interface GamepadLike {
  index?: number;
  connected?: boolean;
  mapping?: string;
  axes: ReadonlyArray<number>;
  buttons: ReadonlyArray<ButtonLike>;
  vibrationActuator?: {
    playEffect?: (type: string, params: Record<string, number>) => Promise<unknown> | unknown;
  } | null;
  hapticActuators?: ReadonlyArray<{ pulse?: (value: number, duration: number) => Promise<unknown> | unknown }>;
}

/**
 * The browser, as far as input needs it. Defaults to the real one, resolved
 * at `attach()` so constructing a RaceInput during server rendering is inert;
 * tests pass stand-ins.
 */
export interface RaceInputEnvironment {
  window?: Listenable | null;
  document?: (Listenable & { hidden?: boolean }) | null;
  navigator?: {
    getGamepads?: () => ArrayLike<GamepadLike | null> | null;
    vibrate?: (pattern: number | number[]) => boolean;
  } | null;
  /** Milliseconds. */
  now?: () => number;
}

export interface AttachOptions {
  /**
   * Whether a mouse or pen held on the target steers and accelerates. On by
   * default. Touch never steers through the target — on-screen controls are
   * the touch scheme, and a thumb resting on the track must not take the wheel.
   */
  pointer?: boolean;
}

type KeyControl = "throttle" | "brake" | "left" | "right" | "handbrake" | "nitro" | "camera" | "lookBack";

/** Physical keys first, so WASD sits under the same fingers on AZERTY. */
const CODE_BINDINGS: Record<string, KeyControl> = {
  KeyW: "throttle",
  ArrowUp: "throttle",
  KeyS: "brake",
  ArrowDown: "brake",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "handbrake",
  ShiftLeft: "nitro",
  ShiftRight: "nitro",
  KeyN: "nitro",
  KeyC: "camera",
  KeyB: "lookBack",
};

/** For keyboards and virtual keyboards that report no `code`. */
const KEY_BINDINGS: Record<string, KeyControl> = {
  w: "throttle",
  arrowup: "throttle",
  s: "brake",
  arrowdown: "brake",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
  " ": "handbrake",
  spacebar: "handbrake",
  shift: "nitro",
  n: "nitro",
  c: "camera",
  b: "lookBack",
};

/** Keys whose default action scrolls the page, which is disastrous mid-race. */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " ", "Spacebar"]);

export function keyControl(e: { code?: string; key?: string }): KeyControl | null {
  if (e.code && CODE_BINDINGS[e.code]) return CODE_BINDINGS[e.code] ?? null;
  const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
  return KEY_BINDINGS[key] ?? null;
}

const ARROW_WIDGETS = new Set(["slider", "textbox", "combobox", "spinbutton", "radio", "tab", "option", "menuitem"]);

/**
 * A key aimed at something else: typing in the chat box, or moving through
 * the pause menu. The race neither reads it nor swallows it.
 */
function belongsElsewhere(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
    closest?: (selector: string) => unknown;
  };
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  // Widgets that use arrow keys themselves.
  const role = el.getAttribute?.("role");
  if (role && ARROW_WIDGETS.has(role)) return true;
  try {
    return Boolean(el.closest?.('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[aria-modal="true"]'));
  } catch {
    return false;
  }
}

const clamp01 = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const clampAxis = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(-1, n)) : 0);

/** Standard-mapping indices. */
const PAD = {
  a: 0,
  x: 2,
  y: 3,
  rb: 5,
  lt: 6,
  rt: 7,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

interface PadState {
  steer: number;
  dpad: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  nitro: boolean;
  lookBack: boolean;
}

const IDLE_PAD: PadState = { steer: 0, dpad: 0, throttle: 0, brake: 0, handbrake: false, nitro: false, lookBack: false };

type TouchState = Omit<AnalogInput, "cameraNext">;
const IDLE_TOUCH: TouchState = { steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false, lookBack: false };

/**
 * Keyboard, gamepad, mouse and on-screen touch controls, merged.
 *
 * Each source keeps its own state and `read()` combines them — the largest
 * magnitude on each axis, OR on each button — so no source can overwrite
 * another. That was the old bug: the keyboard loop sent its idle state every
 * frame and erased whatever the touch buttons had just pressed.
 *
 * `read()` is meant to be called once per frame by the game loop; it also
 * advances the steering ramps and polls the gamepad, which has no events for
 * axes. `cameraNext` is an edge and goes to whichever `read()` sees it first.
 */
export class RaceInput {
  private readonly env: RaceInputEnvironment;
  private readonly now: () => number;
  private readonly held = new Map<string, KeyControl>();
  private lastSteerKey: "left" | "right" | null = null;
  private digitalSteer = 0;
  private pointerId: number | null = null;
  private pointerSteer = 0;
  private pointerTarget = 0;
  private pointerThrottle = 0;
  private pointerBrake = 0;
  private pointerEnabled = true;
  private touch: TouchState = { ...IDLE_TOUCH };
  private cameraLatch = false;
  private padCameraHeld = false;
  private padResync = true;
  private activePad: GamepadLike | null = null;
  private lastRead: number | null = null;
  private lastVibrate = -Infinity;
  private source: InputSource | null = null;
  private detachers: Array<() => void> = [];

  constructor(env: RaceInputEnvironment = {}) {
    this.env = env;
    this.now =
      env.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  }

  /** The device the player last used, for showing the right button prompts. */
  get lastSource(): InputSource | null {
    return this.source;
  }

  /**
   * Starts listening: keyboard on the window, gamepad polling in `read()`,
   * and mouse steering on `target` (the canvas). Calling it again moves the
   * listeners; calling it after `dispose()` starts over.
   */
  attach(target: HTMLElement | null, options: AttachOptions = {}): void {
    this.detach();
    const win = this.env.window !== undefined ? this.env.window : typeof window !== "undefined" ? window : null;
    const doc = this.env.document !== undefined ? this.env.document : typeof document !== "undefined" ? document : null;
    this.pointerEnabled = options.pointer !== false;
    this.lastRead = null;

    const listen = (on: Listenable | null, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
      if (!on) return;
      on.addEventListener(type, fn, opts);
      this.detachers.push(() => on.removeEventListener(type, fn, opts));
    };

    listen(win, "keydown", (e) => this.onKeyDown(e as KeyboardEvent));
    listen(win, "keyup", (e) => this.onKeyUp(e as KeyboardEvent));
    // A key released while the window was not focused never sends keyup: a
    // tab switch mid-corner would otherwise leave the wheel held over.
    listen(win, "blur", () => this.clear());
    listen(doc, "visibilitychange", () => {
      if (doc?.hidden) this.clear();
    });

    if (target) {
      listen(target, "pointerdown", (e) => this.onPointerDown(e as PointerEvent, target));
      listen(target, "pointermove", (e) => this.onPointerMove(e as PointerEvent, target));
      listen(target, "pointerup", (e) => this.onPointerUp(e as PointerEvent));
      listen(target, "pointercancel", () => this.releasePointer());
      listen(target, "lostpointercapture", () => this.releasePointer());
      // The right button brakes, so it must not open the context menu.
      listen(target, "contextmenu", (e) => {
        if (this.pointerEnabled) e.preventDefault();
      });
    }
  }

  /**
   * On-screen controls. Fields given replace that control's touch value;
   * fields left out keep theirs, and no other source can change them.
   * `cameraNext: true` is a press.
   */
  setTouch(partial: Partial<AnalogInput>): void {
    if (!partial || typeof partial !== "object") return;
    const t = this.touch;
    if (partial.steer !== undefined) t.steer = clampAxis(partial.steer);
    if (partial.throttle !== undefined) t.throttle = clamp01(partial.throttle);
    if (partial.brake !== undefined) t.brake = clamp01(partial.brake);
    if (partial.handbrake !== undefined) t.handbrake = partial.handbrake === true;
    if (partial.nitro !== undefined) t.nitro = partial.nitro === true;
    if (partial.lookBack !== undefined) t.lookBack = partial.lookBack === true;
    if (partial.cameraNext === true) this.cameraLatch = true;
    if (t.steer !== 0 || t.throttle > 0 || t.brake > 0 || t.handbrake || t.nitro || partial.cameraNext === true) {
      this.source = "touch";
    }
  }

  read(): AnalogInput {
    const at = this.now();
    const dt = this.lastRead === null ? 0 : Math.min(0.1, Math.max(0, (at - this.lastRead) / 1000));
    this.lastRead = at;

    const pad = this.detachers.length > 0 ? this.pollPad() : IDLE_PAD;

    const left = this.isHeld("left");
    const right = this.isHeld("right");
    // Both held: the one pressed last wins, so a quick flick the other way
    // does not first have to release the old key.
    const keyDir = left && right ? (this.lastSteerKey === "left" ? -1 : 1) : left ? -1 : right ? 1 : 0;
    this.digitalSteer = approachSteer(this.digitalSteer, keyDir !== 0 ? keyDir : pad.dpad, dt);

    const pointing = this.pointerId !== null;
    if (pointing) this.pointerSteer += (this.pointerTarget - this.pointerSteer) * (1 - Math.exp(-POINTER_FOLLOW * dt));

    const t = this.touch;
    const cameraNext = this.cameraLatch;
    this.cameraLatch = false;
    return {
      steer: strongest(this.digitalSteer, pad.steer, pointing ? this.pointerSteer : 0, t.steer),
      throttle: Math.max(this.isHeld("throttle") ? 1 : 0, pad.throttle, this.pointerThrottle, t.throttle),
      brake: Math.max(this.isHeld("brake") ? 1 : 0, pad.brake, this.pointerBrake, t.brake),
      handbrake: this.isHeld("handbrake") || pad.handbrake || t.handbrake,
      nitro: this.isHeld("nitro") || pad.nitro || t.nitro,
      lookBack: this.isHeld("lookBack") || pad.lookBack || t.lookBack,
      cameraNext,
    };
  }

  /** Releases everything: for pause, blur and the end of a race. */
  clear(): void {
    this.held.clear();
    this.lastSteerKey = null;
    this.digitalSteer = 0;
    this.releasePointer();
    this.touch = { ...IDLE_TOUCH };
    this.cameraLatch = false;
    // A button held through the pause must not fire as a fresh press after it.
    this.padResync = true;
  }

  /**
   * Feedback: the gamepad's rumble motors if the player is on a gamepad,
   * otherwise a phone's vibration if they are on touch. `strength` 0..1.
   */
  rumble(strength: number, ms: number): void {
    const s = clamp01(strength);
    const duration = Number.isFinite(ms) ? Math.min(5000, Math.max(0, ms)) : 0;
    if (s <= 0 || duration <= 0) return;

    if (this.source === "gamepad" && this.activePad) {
      const pad = this.activePad;
      try {
        const actuator = pad.vibrationActuator;
        if (actuator?.playEffect) {
          const done = actuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration,
            weakMagnitude: s,
            strongMagnitude: Math.min(1, s * 0.85),
          });
          if (done && typeof (done as Promise<unknown>).catch === "function") (done as Promise<unknown>).catch(() => {});
          return;
        }
        const haptic = pad.hapticActuators?.[0];
        if (haptic?.pulse) {
          const done = haptic.pulse(s, duration);
          if (done && typeof (done as Promise<unknown>).catch === "function") (done as Promise<unknown>).catch(() => {});
        }
      } catch {
        // Rumble is a courtesy.
      }
      return;
    }

    if (this.source === "touch") {
      const nav = this.navigator();
      const at = this.now();
      // The vibration API has no strength, only length; and a burst of short
      // calls cancels itself into nothing, so they are spaced out.
      if (!nav?.vibrate || at - this.lastVibrate < 100) return;
      this.lastVibrate = at;
      try {
        nav.vibrate(Math.max(8, Math.round(duration * (0.35 + 0.65 * s))));
      } catch {
        // Not allowed here (no user gesture yet, or a permissions policy).
      }
    }
  }

  /** Stops listening and releases everything. `attach()` may be called again. */
  dispose(): void {
    this.detach();
    this.clear();
    this.activePad = null;
  }

  private detach(): void {
    for (const off of this.detachers) off();
    this.detachers = [];
  }

  private navigator(): RaceInputEnvironment["navigator"] {
    if (this.env.navigator !== undefined) return this.env.navigator;
    return typeof navigator !== "undefined" ? (navigator as unknown as RaceInputEnvironment["navigator"]) : null;
  }

  private isHeld(control: KeyControl): boolean {
    for (const value of this.held.values()) if (value === control) return true;
    return false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (belongsElsewhere(e.target)) return;
    const control = keyControl(e);
    if (!control) return;
    // Repeats are accepted for held state: after a clear(), the OS's auto-repeat
    // is what tells us a key is still down.
    this.held.set(e.code || e.key, control);
    if (!e.repeat) {
      if (control === "camera") this.cameraLatch = true;
      if (control === "left" || control === "right") this.lastSteerKey = control;
    }
    this.source = "keyboard";
    if (SCROLL_KEYS.has(e.code) || SCROLL_KEYS.has(e.key)) e.preventDefault();
  }

  private onKeyUp(e: KeyboardEvent): void {
    // Always honoured, wherever focus is: a missed release is a stuck key.
    this.held.delete(e.code || e.key);
    if (e.key === "Shift") {
      this.held.delete("ShiftLeft");
      this.held.delete("ShiftRight");
    }
  }

  private onPointerDown(e: PointerEvent, target: HTMLElement): void {
    if (!this.pointerEnabled || e.pointerType === "touch") return;
    if (e.button !== 0 && e.button !== 2) return;
    this.pointerId = e.pointerId;
    this.pointerThrottle = e.button === 0 || (e.buttons & 1) !== 0 ? 1 : 0;
    this.pointerBrake = e.button === 2 || (e.buttons & 2) !== 0 ? 1 : 0;
    this.pointerTarget = this.steerAt(e.clientX, target);
    this.source = "pointer";
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      // Capture is a nicety: it keeps steering when the cursor leaves the canvas.
    }
  }

  private onPointerMove(e: PointerEvent, target: HTMLElement): void {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;
    // A second button pressed or released mid-drag arrives as a move.
    this.pointerThrottle = (e.buttons & 1) !== 0 ? 1 : 0;
    this.pointerBrake = (e.buttons & 2) !== 0 ? 1 : 0;
    this.pointerTarget = this.steerAt(e.clientX, target);
    if (e.buttons === 0) this.releasePointer();
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;
    this.pointerThrottle = (e.buttons & 1) !== 0 ? 1 : 0;
    this.pointerBrake = (e.buttons & 2) !== 0 ? 1 : 0;
    if (e.buttons === 0) this.releasePointer();
  }

  private releasePointer(): void {
    this.pointerId = null;
    this.pointerThrottle = 0;
    this.pointerBrake = 0;
    this.pointerSteer = 0;
    this.pointerTarget = 0;
  }

  private steerAt(clientX: number, target: HTMLElement): number {
    const box = target.getBoundingClientRect?.();
    return box ? pointerSteerFromX(clientX, box.left, box.width) : 0;
  }

  private pollPad(): PadState {
    let pads: ArrayLike<GamepadLike | null> | null | undefined;
    try {
      pads = this.navigator()?.getGamepads?.();
    } catch {
      // Blocked by a permissions policy in an iframe.
      pads = null;
    }
    const pad = pickPad(pads, this.activePad);
    this.activePad = pad;
    if (!pad) {
      this.padCameraHeld = false;
      return IDLE_PAD;
    }

    const button = (i: number): ButtonLike | undefined => pad.buttons[i];
    const pressed = (i: number): boolean => button(i)?.pressed === true;
    const analog = (i: number): number => {
      const b = button(i);
      if (!b) return 0;
      return Number.isFinite(b.value) && b.value > 0 ? b.value : b.pressed ? 1 : 0;
    };

    const state: PadState = {
      steer: shapeStick(pad.axes[0] ?? 0),
      dpad: (pressed(PAD.dpadRight) ? 1 : 0) - (pressed(PAD.dpadLeft) ? 1 : 0),
      throttle: shapeTrigger(analog(PAD.rt)),
      brake: shapeTrigger(analog(PAD.lt)),
      handbrake: pressed(PAD.x),
      nitro: pressed(PAD.a),
      lookBack: pressed(PAD.rb),
    };

    const camera = pressed(PAD.y);
    if (camera && !this.padCameraHeld && !this.padResync) this.cameraLatch = true;
    this.padCameraHeld = camera;
    this.padResync = false;

    if (
      state.steer !== 0 ||
      state.dpad !== 0 ||
      state.throttle > 0 ||
      state.brake > 0 ||
      state.handbrake ||
      state.nitro ||
      state.lookBack ||
      camera
    ) {
      this.source = "gamepad";
    }
    return state;
  }
}

/**
 * The gamepad to read: the one already in use while it stays connected,
 * otherwise the first with any input, otherwise the first connected. A
 * second controller on the desk does not steal the race.
 */
function pickPad(pads: ArrayLike<GamepadLike | null> | null | undefined, current: GamepadLike | null): GamepadLike | null {
  if (!pads || typeof pads.length !== "number") return null;
  const list: GamepadLike[] = [];
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (pad && pad.connected !== false && pad.buttons && pad.axes) list.push(pad);
  }
  if (list.length === 0) return null;
  if (current) {
    // Chrome hands out a new Gamepad object per poll; match by index.
    const same = list.find((p) => p === current || (p.index !== undefined && p.index === current.index));
    if (same) return same;
  }
  const busy = list.find((p) => p.buttons.some((b) => b?.pressed) || p.axes.some((a) => Math.abs(a) > 0.3));
  return busy ?? list[0] ?? null;
}

/**
 * A RaceInput for the life of a component. Attach it in an effect once the
 * canvas exists; it detaches itself on unmount.
 */
export function useRaceInput(): RaceInput {
  const [input] = React.useState(() => new RaceInput());
  React.useEffect(() => () => input.dispose(), [input]);
  return input;
}
