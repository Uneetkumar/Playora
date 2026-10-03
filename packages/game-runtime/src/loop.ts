/**
 * The fixed-timestep game loop.
 *
 * Every arcade game on the platform used to own a `setInterval` and mutate
 * React state from inside it. That has three failure modes we actually hit:
 *
 *   - Simulation speed follows timer drift, so the same game runs at different
 *     speeds on different machines and the difficulty curve means nothing.
 *   - Browsers throttle background timers. Rope Rescue drove its saw blade on
 *     `requestAnimationFrame` and its survivors on `setInterval`, so a
 *     backgrounded tab kept scoring against a blade that had stopped moving.
 *     Two clocks for one interaction is a bug waiting for someone to switch
 *     tabs.
 *   - Every simulation step was a React render, which caps the tick rate at
 *     whatever reconciliation costs.
 *
 * So: one clock, fixed steps, render decoupled from simulation.
 *
 * `update` is called a whole number of times per frame with the same `dt`, so
 * the simulation is deterministic and reproducible. `render` is called once per
 * frame with an interpolation factor, so presentation stays smooth even when
 * the step rate and the refresh rate disagree.
 */

export interface LoopCallbacks {
  /** Advance the simulation exactly one fixed step. */
  update: (dt: number, tick: number) => void;
  /**
   * Draw. `alpha` is how far between the last two steps this frame falls
   * (0..1), for interpolating positions; ignore it and you get step-rate
   * animation, which is fine for discrete games.
   */
  render?: (alpha: number) => void;
}

export interface LoopOptions {
  /** Simulation steps per second. 60 unless the game has a reason. */
  stepsPerSecond?: number;
  /**
   * Most steps allowed in one frame before time is discarded.
   *
   * Without this, a long stall (a background tab, a GC pause, a laptop lid)
   * hands the loop a huge accumulated delta, and it tries to simulate every
   * step at once — freezing the page trying to catch up, then teleporting
   * everything. Dropping the excess is the honest behaviour: the game
   * continues from now rather than pretending it was played while hidden.
   */
  maxStepsPerFrame?: number;
  /**
   * Whether to keep simulating while the page is hidden. Defaults to false,
   * which pauses — a game the player cannot see should not be losing for them.
   */
  runWhileHidden?: boolean;
}

type Scheduler = {
  now: () => number;
  requestFrame: (cb: (t: number) => void) => number;
  cancelFrame: (handle: number) => void;
};

const defaultScheduler = (): Scheduler => ({
  now: () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now(),
  requestFrame: (cb) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(cb)
      : (setTimeout(() => cb(Date.now()), 16) as unknown as number),
  cancelFrame: (h) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(h);
    else clearTimeout(h as unknown as ReturnType<typeof setTimeout>);
  },
});

export class GameLoop {
  private readonly stepMs: number;
  private readonly maxSteps: number;
  private readonly runWhileHidden: boolean;
  private readonly scheduler: Scheduler;

  private handle: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private tickCount = 0;
  private running = false;
  private paused = false;

  constructor(
    private readonly callbacks: LoopCallbacks,
    options: LoopOptions = {},
    /** Injectable for tests: the loop is pure given a clock and a scheduler. */
    scheduler?: Scheduler,
  ) {
    const sps = options.stepsPerSecond ?? 60;
    this.stepMs = 1000 / sps;
    this.maxSteps = options.maxStepsPerFrame ?? 5;
    this.runWhileHidden = options.runWhileHidden ?? false;
    this.scheduler = scheduler ?? defaultScheduler();
  }

  /** Simulation steps completed since start. Useful for deterministic tests. */
  get ticks(): number {
    return this.tickCount;
  }

  get isRunning(): boolean {
    return this.running && !this.paused;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = this.scheduler.now();
    this.accumulator = 0;
    this.schedule();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    // Start from now, not from whenever we paused: the time in between was not
    // played, and crediting it would replay it all in one frame.
    this.lastTime = this.scheduler.now();
    this.accumulator = 0;
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      this.scheduler.cancelFrame(this.handle);
      this.handle = null;
    }
  }

  /**
   * Drives one frame. Exposed so tests can advance the loop deterministically
   * without a real clock.
   */
  frame(now: number): void {
    const elapsed = now - this.lastTime;
    this.lastTime = now;

    const hidden =
      !this.runWhileHidden &&
      typeof document !== "undefined" &&
      document.visibilityState === "hidden";

    if (this.paused || hidden) {
      this.accumulator = 0;
      return;
    }

    this.accumulator += elapsed;

    let steps = 0;
    while (this.accumulator >= this.stepMs && steps < this.maxSteps) {
      this.callbacks.update(this.stepMs / 1000, this.tickCount);
      this.accumulator -= this.stepMs;
      this.tickCount += 1;
      steps += 1;
    }

    // Whatever is left after the cap is time we are choosing not to simulate.
    if (steps === this.maxSteps) this.accumulator = 0;

    this.callbacks.render?.(this.accumulator / this.stepMs);
  }

  private schedule(): void {
    this.handle = this.scheduler.requestFrame((t) => {
      if (!this.running) return;
      this.frame(t);
      this.schedule();
    });
  }
}
