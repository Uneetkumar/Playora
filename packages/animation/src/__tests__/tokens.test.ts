import { describe, it, expect } from "vitest";
import {
  DURATION_MS,
  DURATION_S,
  EASE,
  SPRING,
  stagger,
  transition,
} from "../tokens.js";
import { celebrate, popIn, riseIn, slideIn, staggerChildren } from "../variants.js";

describe("duration tokens", () => {
  it("matches the values the spec names", () => {
    expect(DURATION_MS.micro).toBe(120);
    expect(DURATION_MS.fast).toBe(180);
    expect(DURATION_MS.normal).toBe(240);
    expect(DURATION_MS.emphasis).toBe(360);
    expect(DURATION_MS.cinematic).toBeGreaterThanOrEqual(600);
  });

  it("gets longer as the emphasis rises", () => {
    // A ladder that is not monotonic is not a ladder.
    const order = ["micro", "fast", "normal", "emphasis", "cinematic"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(DURATION_MS[order[i]!]).toBeGreaterThan(DURATION_MS[order[i - 1]!]);
    }
  });

  it("keeps seconds and milliseconds in agreement", () => {
    // Two units for one value is exactly where a mismatch hides.
    for (const key of Object.keys(DURATION_MS) as Array<keyof typeof DURATION_MS>) {
      expect(DURATION_S[key]).toBeCloseTo(DURATION_MS[key] / 1000, 6);
    }
  });
});

describe("transition()", () => {
  it("uses the normal duration by default", () => {
    expect(transition()).toMatchObject({ duration: DURATION_S.normal, ease: EASE.out });
  });

  it("returns a spring when one is named", () => {
    expect(transition({ spring: "bouncy" })).toMatchObject(SPRING.bouncy);
  });

  it("collapses to instant under reduced motion", () => {
    expect(transition({ reduced: true })).toEqual({ duration: 0 });
  });

  it("never returns a spring under reduced motion", () => {
    // A zero-duration spring still oscillates, so honouring the preference
    // means dropping the spring rather than shortening it.
    const result = transition({ spring: "bouncy", reduced: true });
    expect(result).toEqual({ duration: 0 });
    expect(result).not.toHaveProperty("stiffness");
  });

  it("drops the delay under reduced motion too", () => {
    // A delayed instant transition is just a pause with nothing in it.
    expect(transition({ delay: 0.4, reduced: true })).toEqual({ duration: 0 });
  });

  it("carries a delay through when motion is allowed", () => {
    expect(transition({ delay: 0.2 })).toMatchObject({ delay: 0.2 });
    expect(transition({ spring: "soft", delay: 0.2 })).toMatchObject({ delay: 0.2 });
  });
});

describe("stagger()", () => {
  it("grows with the index", () => {
    expect(stagger(2)).toBeGreaterThan(stagger(1));
  });

  it("caps, so a long list does not take seconds to arrive", () => {
    expect(stagger(500)).toBeLessThanOrEqual(0.35);
  });

  it("starts at zero", () => {
    expect(stagger(0)).toBe(0);
  });
});

describe("variants", () => {
  const builders = [
    ["riseIn", riseIn],
    ["popIn", popIn],
    ["celebrate", celebrate],
    ["staggerChildren", staggerChildren],
  ] as const;

  it("every variant honours reduced motion", () => {
    // The rule that is easiest to forget and most visible when broken.
    for (const [name, build] of builders) {
      const reduced = build(true);
      const visible = reduced.visible as { transition?: { duration?: number } };
      expect(visible.transition?.duration, `${name} still animates`).toBe(0);
    }

    for (const from of ["left", "right", "bottom"] as const) {
      const visible = slideIn(from, true).visible as { transition?: { duration?: number } };
      expect(visible.transition?.duration, `slideIn ${from} still animates`).toBe(0);
    }
  });

  it("leaves nothing invisible when motion is reduced", () => {
    // Skipping the animation must not skip the element: a hidden state with
    // opacity 0 and no transition would leave the content permanently gone.
    for (const [name, build] of builders) {
      const hidden = build(true).hidden as { opacity?: number };
      if (hidden.opacity !== undefined) {
        expect(hidden.opacity, `${name} hides its content`).toBe(1);
      }
    }
  });

  it("actually animates when motion is allowed", () => {
    const hidden = riseIn(false).hidden as { opacity: number; y: number };
    expect(hidden.opacity).toBe(0);
    expect(hidden.y).toBeGreaterThan(0);
  });

  it("slides from the edge it is told to", () => {
    expect(slideIn("left").hidden).toMatchObject({ x: "-100%" });
    expect(slideIn("right").hidden).toMatchObject({ x: "100%" });
    expect(slideIn("bottom").hidden).toMatchObject({ y: "100%" });
  });
});
