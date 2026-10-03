import { afterEach, describe, expect, it, vi } from "vitest";
import { EASE, EASE_CSS, INTERACTION_MS, INTERACTION_S, SPRING } from "../tokens.js";
import { HOVER_LIFT, PRESS_SCALE, liftProps, pressProps } from "../presets.js";
import {
  REDUCE_MOTION_CLASS,
  readReducedMotionPref,
  subscribeReducedMotionPref,
} from "../reduced-motion.js";

describe("design-system springs", () => {
  it("carries the numbers the spec names", () => {
    expect(SPRING.micro).toMatchObject({ stiffness: 500, damping: 30 });
    expect(SPRING.panel).toMatchObject({ stiffness: 300, damping: 32 });
    expect(SPRING.ambient).toMatchObject({ stiffness: 120, damping: 20 });
  });
});

describe("interaction timings", () => {
  it("sit inside the spec's ranges", () => {
    expect(INTERACTION_MS.press).toBe(80);
    expect(INTERACTION_MS.hover).toBeGreaterThanOrEqual(180);
    expect(INTERACTION_MS.hover).toBeLessThanOrEqual(220);
    expect(INTERACTION_MS.sheet).toBeGreaterThanOrEqual(280);
    expect(INTERACTION_MS.sheet).toBeLessThanOrEqual(360);
    expect(INTERACTION_MS.sheetExit).toBeGreaterThanOrEqual(280);
    expect(INTERACTION_MS.sheetExit).toBeLessThan(INTERACTION_MS.sheet);
  });

  it("keeps seconds and milliseconds in agreement", () => {
    for (const key of Object.keys(INTERACTION_MS) as Array<keyof typeof INTERACTION_MS>) {
      expect(INTERACTION_S[key]).toBeCloseTo(INTERACTION_MS[key] / 1000, 6);
    }
  });

  it("writes the CSS easing from the same numbers as the Motion one", () => {
    expect(EASE_CSS.out).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(EASE_CSS.out).toBe(`cubic-bezier(${EASE.out.join(", ")})`);
  });
});

describe("presets", () => {
  it("press scales down on the micro spring", () => {
    expect(pressProps()).toEqual({ whileTap: { scale: PRESS_SCALE, transition: SPRING.micro } });
  });

  it("lift answers focus as well as hover", () => {
    // Hover-only affordances are invisible to keyboard and touch players.
    const props = liftProps();
    expect(props.whileHover).toMatchObject(HOVER_LIFT);
    expect(props.whileFocus).toEqual(props.whileHover);
  });

  it("do nothing at all under reduced motion", () => {
    expect(pressProps(true)).toEqual({});
    expect(liftProps(true)).toEqual({});
  });
});

describe("reduced-motion preference", () => {
  afterEach(() => {
    document.documentElement.classList.remove(REDUCE_MOTION_CLASS);
    vi.unstubAllGlobals();
  });

  it("is off by default", () => {
    expect(readReducedMotionPref()).toBe(false);
  });

  it("follows the in-app setting's class on <html>", () => {
    document.documentElement.classList.add(REDUCE_MOTION_CLASS);
    expect(readReducedMotionPref()).toBe(true);
  });

  it("follows the OS setting", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    expect(readReducedMotionPref()).toBe(true);
  });

  it("notifies when the in-app setting is toggled, and stops after unsubscribe", async () => {
    // The Settings toggle flips a class and fires no event of its own; the
    // subscription is the only way a mounted component hears about it.
    const onChange = vi.fn();
    const unsubscribe = subscribeReducedMotionPref(onChange);

    document.documentElement.classList.add(REDUCE_MOTION_CLASS);
    await Promise.resolve();
    expect(onChange).toHaveBeenCalled();

    unsubscribe();
    onChange.mockClear();
    document.documentElement.classList.remove(REDUCE_MOTION_CLASS);
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
  });
});
