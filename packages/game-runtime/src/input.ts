/**
 * Input, as game actions rather than devices.
 *
 * Nine of eleven arcade games shipped with click handlers and nothing else, so
 * they were unplayable on a phone — on a platform whose brief is mobile-first.
 * Fixing that game by game would mean eleven separate touch implementations and
 * eleven separate sets of bugs.
 *
 * A game binds actions ("ACCELERATE", "MOVE_LEFT") and asks whether they are
 * held or were just pressed. Whether that came from a key, a thumb or a
 * gamepad is this file's problem, not the game's.
 *
 * `justPressed` is edge-triggered and consumed per simulation step, so a tap
 * fires exactly one action no matter how many frames it spans.
 */

export type ActionName = string;

/** Which physical inputs produce an action. */
export interface ActionBinding {
  /** `KeyboardEvent.code` values, e.g. "ArrowLeft", "KeyW", "Space". */
  keys?: string[];
  /** Gamepad button indices (standard mapping). */
  buttons?: number[];
  /**
   * Gamepad axis as [index, direction]; direction -1 or 1. Applied past a
   * deadzone so a resting stick does not hold an action down.
   */
  axis?: [number, -1 | 1];
}

export type Bindings = Record<ActionName, ActionBinding>;

export interface PointerState {
  /** Down right now. */
  down: boolean;
  /** Position in element-relative CSS pixels. */
  x: number;
  y: number;
  /** Movement since the previous step, for drag and swipe. */
  dx: number;
  dy: number;
}

const AXIS_DEADZONE = 0.35;

export class InputManager {
  private readonly held = new Set<ActionName>();
  private readonly pressed = new Set<ActionName>();
  private readonly released = new Set<ActionName>();
  private readonly keyToActions = new Map<string, ActionName[]>();

  private pointer: PointerState = { down: false, x: 0, y: 0, dx: 0, dy: 0 };
  private lastPointer = { x: 0, y: 0 };
  private detachers: Array<() => void> = [];

  constructor(private bindings: Bindings = {}) {
    this.indexKeys();
  }

  /** Rebind at runtime — a control-scheme setting, or a game changing mode. */
  setBindings(bindings: Bindings): void {
    this.bindings = bindings;
    this.keyToActions.clear();
    this.indexKeys();
  }

  private indexKeys(): void {
    for (const [action, binding] of Object.entries(this.bindings)) {
      for (const key of binding.keys ?? []) {
        const list = this.keyToActions.get(key) ?? [];
        list.push(action);
        this.keyToActions.set(key, list);
      }
    }
  }

  /** True while the action is held. */
  isDown(action: ActionName): boolean {
    return this.held.has(action);
  }

  /** True only on the step the action went down. */
  justPressed(action: ActionName): boolean {
    return this.pressed.has(action);
  }

  /** True only on the step the action came up. */
  justReleased(action: ActionName): boolean {
    return this.released.has(action);
  }

  getPointer(): Readonly<PointerState> {
    return this.pointer;
  }

  /**
   * Feed an action directly — the hook for on-screen controls, where a button
   * under a thumb is the same thing as a held key.
   */
  setAction(action: ActionName, down: boolean): void {
    if (down) {
      if (!this.held.has(action)) this.pressed.add(action);
      this.held.add(action);
    } else if (this.held.has(action)) {
      this.held.delete(action);
      this.released.add(action);
    }
  }

  /**
   * Clears the edge-triggered sets. Call once at the end of each simulation
   * step, so a press is visible for exactly one step.
   */
  endStep(): void {
    this.pressed.clear();
    this.released.clear();
    this.pointer.dx = 0;
    this.pointer.dy = 0;
  }

  /** Reads connected gamepads. Call once per step before reading actions. */
  pollGamepads(): void {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      for (const [action, binding] of Object.entries(this.bindings)) {
        let down = false;
        for (const i of binding.buttons ?? []) {
          if (pad.buttons[i]?.pressed) down = true;
        }
        if (binding.axis) {
          const [index, dir] = binding.axis;
          const value = pad.axes[index] ?? 0;
          if (Math.abs(value) > AXIS_DEADZONE && Math.sign(value) === dir) down = true;
        }
        if (down) this.setAction(action, true);
        else if (this.held.has(action) && !this.keyboardHolds(action)) {
          this.setAction(action, false);
        }
      }
    }
  }

  /** Whether a key is currently holding this action, so gamepad release does not steal it. */
  private keyboardHeld = new Set<ActionName>();
  private keyboardHolds(action: ActionName): boolean {
    return this.keyboardHeld.has(action);
  }

  /**
   * Attaches DOM listeners. `element` scopes pointer coordinates; keyboard is
   * always on the window because focus belongs to the page, not the canvas.
   */
  attach(element: HTMLElement | null): void {
    this.detach();
    if (typeof window === "undefined") return;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const actions = this.keyToActions.get(e.code);
      if (!actions?.length) return;
      // A game key should not also scroll the page.
      e.preventDefault();
      for (const a of actions) {
        if (down) this.keyboardHeld.add(a);
        else this.keyboardHeld.delete(a);
        this.setAction(a, down);
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd, { passive: false });
    window.addEventListener("keyup", ku);
    this.detachers.push(() => window.removeEventListener("keydown", kd));
    this.detachers.push(() => window.removeEventListener("keyup", ku));

    // Losing focus must release everything, or the player returns to a game
    // that thinks a key is still held.
    const blur = () => {
      for (const a of [...this.held]) this.setAction(a, false);
      this.keyboardHeld.clear();
      this.pointer.down = false;
    };
    window.addEventListener("blur", blur);
    this.detachers.push(() => window.removeEventListener("blur", blur));

    if (!element) return;

    const pos = (e: PointerEvent) => {
      const r = element.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pd = (e: PointerEvent) => {
      const { x, y } = pos(e);
      this.pointer = { down: true, x, y, dx: 0, dy: 0 };
      this.lastPointer = { x, y };
      // Pointer Events unify mouse and touch, so there is no separate touch
      // path to keep in sync — the reason nine games had no touch support.
      element.setPointerCapture?.(e.pointerId);
    };
    const pm = (e: PointerEvent) => {
      const { x, y } = pos(e);
      this.pointer.dx += x - this.lastPointer.x;
      this.pointer.dy += y - this.lastPointer.y;
      this.pointer.x = x;
      this.pointer.y = y;
      this.lastPointer = { x, y };
    };
    const pu = () => {
      this.pointer.down = false;
    };
    element.addEventListener("pointerdown", pd);
    element.addEventListener("pointermove", pm);
    element.addEventListener("pointerup", pu);
    element.addEventListener("pointercancel", pu);
    this.detachers.push(() => element.removeEventListener("pointerdown", pd));
    this.detachers.push(() => element.removeEventListener("pointermove", pm));
    this.detachers.push(() => element.removeEventListener("pointerup", pu));
    this.detachers.push(() => element.removeEventListener("pointercancel", pu));
  }

  detach(): void {
    for (const off of this.detachers) off();
    this.detachers = [];
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.keyboardHeld.clear();
  }
}

/** Sensible defaults so a game does not have to invent a control scheme. */
export const DEFAULT_BINDINGS: Bindings = {
  MOVE_LEFT: { keys: ["ArrowLeft", "KeyA"], axis: [0, -1], buttons: [14] },
  MOVE_RIGHT: { keys: ["ArrowRight", "KeyD"], axis: [0, 1], buttons: [15] },
  MOVE_UP: { keys: ["ArrowUp", "KeyW"], axis: [1, -1], buttons: [12] },
  MOVE_DOWN: { keys: ["ArrowDown", "KeyS"], axis: [1, 1], buttons: [13] },
  ACCELERATE: { keys: ["ArrowUp", "KeyW"], buttons: [7, 0] },
  BRAKE: { keys: ["ArrowDown", "KeyS"], buttons: [6, 1] },
  BOOST: { keys: ["ShiftLeft", "Space"], buttons: [0] },
  ACTION: { keys: ["Space", "Enter"], buttons: [0] },
  PAUSE: { keys: ["Escape", "KeyP"], buttons: [9] },
};
