import { describe, it, expect } from "vitest";
import {
  LEVELS,
  MATERIALS,
  beamCost,
  canRedo,
  canUndo,
  checkPlacement,
  clearBridge,
  compressionStrength,
  createBridgeState,
  designCost,
  insideTerrain,
  isDesignValidFor,
  parseDesign,
  placeBeam,
  redoBridge,
  removeBeam,
  removeJoint,
  resolvePoint,
  scoreFor,
  selectLevel,
  serializeDesign,
  setBeamMaterial,
  setMirror,
  snapToGrid,
  startTest,
  stepBridge,
  stopTest,
  undoBridge,
  type BridgeState,
  type MaterialType,
} from "../bridge-builder";

/* ---- helpers ----------------------------------------------------------- */

type Seg = [number, number, number, number, MaterialType];
type P = [number, number];

const pt = (s: BridgeState, x: number, y: number) => resolvePoint(s, x, y, 0.5);

function build(levelIndex: number, segs: Seg[]): BridgeState {
  const s = createBridgeState(levelIndex);
  for (const [x1, y1, x2, y2, m] of segs) {
    const a = pt(s, x1, y1);
    const b = pt(s, x2, y2);
    const ids = placeBeam(s, a, b, m);
    if (ids.length === 0) {
      throw new Error(
        `could not place ${m} ${x1},${y1} -> ${x2},${y2}: ${checkPlacement(s, a, b, m).reason}`
      );
    }
  }
  return s;
}

function runTest(s: BridgeState, onStep?: (s: BridgeState) => void): BridgeState {
  startTest(s);
  for (let i = 0; i < 60 * 45 && !s.result; i++) {
    stepBridge(s, 1 / 60);
    onStep?.(s);
  }
  return s;
}

const path = (pts: P[], m: MaterialType): Seg[] =>
  pts.slice(1).map((b, i) => [pts[i]![0], pts[i]![1], b[0], b[1], m] as Seg);

const line = (x0: number, x1: number, y: number, step: number): P[] => {
  const out: P[] = [];
  for (let x = x0; x <= x1; x += step) out.push([x, y]);
  return out;
};

/**
 * A deck with a Pratt truss hung `depth` below it (negative: above), the end
 * chord members running to `ends` (or the deck ends when omitted).
 */
function pratt(
  deck: P[],
  depth: number,
  ends: [P, P] | null,
  chord: MaterialType,
  diag: MaterialType,
  vert: MaterialType
): Seg[] {
  const out: Seg[] = path(deck, "road");
  const inner = deck.slice(1, -1);
  const bottom: P[] = inner.map(([x, y]) => [x, y + depth]);
  out.push(
    ...path(
      ends ? [ends[0], ...bottom, ends[1]] : [deck[0]!, ...bottom, deck[deck.length - 1]!],
      chord
    )
  );
  inner.forEach(([x, y], i) => out.push([x, y, bottom[i]![0], bottom[i]![1], vert]));
  const mid = (deck[0]![0] + deck[deck.length - 1]![0]) / 2;
  // Diagonals lean toward mid-span, so they work in tension under load.
  for (let i = 0; i + 1 < deck.length; i++) {
    const [ax, ay] = deck[i]!;
    const [bx, by] = deck[i + 1]!;
    const before = i === 0 ? null : bottom[i - 1]!;
    const after = i + 1 >= deck.length - 1 ? null : bottom[i]!;
    if ((ax + bx) / 2 < mid) {
      if (after) out.push([ax, ay, after[0], after[1], diag]);
    } else if (before) {
      out.push([before[0], before[1], bx, by, diag]);
    }
  }
  // Drop exact duplicates (an end diagonal can coincide with the chord).
  const seen = new Set<string>();
  return out.filter(([x1, y1, x2, y2]) => {
    const key = [x1, y1, x2, y2].join() + "|" + [x2, y2, x1, y1].join();
    const alt = [x2, y2, x1, y1].join() + "|" + [x1, y1, x2, y2].join();
    if (seen.has(key) || seen.has(alt)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * One known-good design per level. These are deliberately ordinary, not
 * optimal: they prove each level is beatable within its cap, with three stars,
 * by a design a player could reasonably arrive at.
 */
const REFERENCE: Seg[][] = [
  // 1 First Crossing: road plus one braced triangle.
  [
    ...path(line(190, 310, 150, 40), "road"),
    [190, 190, 230, 150, "wood"],
    [230, 150, 250, 190, "wood"],
    [250, 190, 270, 150, "wood"],
    [270, 150, 310, 190, "wood"],
  ],
  // 2 Over the Top: Pratt truss above the road.
  pratt(line(160, 340, 160, 30), -40, null, "wood", "wood", "wood"),
  // 3 Deep Arch: braced arch under the road.
  [
    ...path(
      [
        [140, 140],
        [180, 140],
        [220, 140],
        [250, 140],
        [280, 140],
        [320, 140],
        [360, 140],
      ],
      "road"
    ),
    ...path(
      [
        [140, 220],
        [180, 190],
        [220, 170],
        [250, 170],
        [280, 170],
        [320, 190],
        [360, 220],
      ],
      "wood"
    ),
    [180, 140, 180, 190, "wood"],
    [220, 140, 220, 170, "wood"],
    [250, 140, 250, 170, "wood"],
    [280, 140, 280, 170, "wood"],
    [320, 140, 320, 190, "wood"],
    [140, 140, 180, 190, "steel"],
    [360, 140, 320, 190, "steel"],
    [180, 140, 220, 170, "wood"],
    [220, 140, 250, 170, "wood"],
    [280, 140, 250, 170, "wood"],
    [320, 140, 280, 170, "wood"],
  ],
  // 4 Midstream Pier: two trussed spans meeting on the rock.
  [
    ...pratt(
      line(80, 240, 150, 40),
      40,
      [
        [80, 200],
        [240, 210],
      ],
      "wood",
      "wood",
      "wood"
    ),
    ...pratt(
      line(260, 420, 150, 40),
      40,
      [
        [260, 210],
        [420, 200],
      ],
      "wood",
      "wood",
      "wood"
    ),
    [240, 150, 260, 150, "road"],
    [240, 150, 240, 210, "wood"],
    [260, 150, 260, 210, "wood"],
  ],
  // 5 Heavy Haul: wood chords, steel web.
  pratt(
    line(150, 350, 150, 40),
    50,
    [
      [150, 200],
      [350, 200],
    ],
    "wood",
    "steel",
    "steel"
  ),
  // 6 Cable Stay: six stays from the pylons.
  [
    ...path(line(130, 370, 160, 40), "road"),
    [110, 50, 170, 160, "cable"],
    [110, 50, 210, 160, "cable"],
    [110, 50, 250, 160, "cable"],
    [390, 50, 330, 160, "cable"],
    [390, 50, 290, 160, "cable"],
    [390, 50, 250, 160, "cable"],
  ],
  // 7 Uneven Banks: sloped Pratt.
  pratt(
    [
      [140, 110],
      [170, 120],
      [200, 130],
      [230, 140],
      [260, 150],
      [290, 160],
      [320, 170],
      [340, 180],
      [360, 190],
    ],
    40,
    [
      [140, 170],
      [360, 240],
    ],
    "wood",
    "wood",
    "wood"
  ),
  // 8 Grand Gorge: wood truss plus four stays.
  [
    ...pratt(
      line(90, 410, 150, 40),
      40,
      [
        [90, 210],
        [410, 210],
      ],
      "wood",
      "wood",
      "wood"
    ),
    [70, 40, 170, 150, "cable"],
    [70, 40, 250, 150, "cable"],
    [430, 40, 330, 150, "cable"],
    [430, 40, 250, 150, "cable"],
  ],
];

/** Road straight across, nothing holding it up. */
function deckOnly(levelIndex: number): Seg[] {
  const roads = REFERENCE[levelIndex]!.filter((s) => s[4] === "road");
  return roads;
}

/* ---- materials --------------------------------------------------------- */

describe("materials", () => {
  it("cables carry no compression; steel out-muscles wood", () => {
    expect(MATERIALS.cable.compression).toBe(0);
    expect(MATERIALS.steel.tension).toBeGreaterThan(MATERIALS.wood.tension);
    expect(MATERIALS.steel.compression).toBeGreaterThan(MATERIALS.wood.compression);
    expect(MATERIALS.cable.maxLength).toBeGreaterThan(MATERIALS.steel.maxLength);
  });

  it("long members buckle at lower loads than short ones", () => {
    const short = compressionStrength("wood", 30);
    const long = compressionStrength("wood", 60);
    expect(short).toBe(MATERIALS.wood.compression);
    expect(long).toBeLessThan(short);
    expect(long).toBeCloseTo(short * (50 / 60) ** 2, 5);
    expect(compressionStrength("cable", 50)).toBe(0);
  });

  it("prices by length", () => {
    expect(beamCost("road", 40)).toBe(80);
    expect(beamCost("wood", 50)).toBe(50);
  });
});

/* ---- building ---------------------------------------------------------- */

describe("building", () => {
  it("starts with only the level's anchors", () => {
    const s = createBridgeState(0);
    expect(s.mode).toBe("build");
    expect(s.design.beams).toHaveLength(0);
    expect(s.design.joints.every((j) => j.anchor)).toBe(true);
    expect(s.design.joints).toHaveLength(LEVELS[0]!.anchors.length);
    expect(designCost(s.design)).toBe(0);
  });

  it("snaps to a 10-unit grid and magnets to nearby joints", () => {
    expect(snapToGrid(83, 157)).toEqual({ x: 80, y: 160 });
    const s = createBridgeState(0);
    const p = resolvePoint(s, 193, 147, 6);
    expect(p).toMatchObject({ x: 190, y: 150 });
    expect(p.jointId).not.toBeNull();
  });

  it("places a beam, creating the free joint and charging for it", () => {
    const s = createBridgeState(0);
    const ids = placeBeam(s, pt(s, 190, 150), pt(s, 230, 150), "road");
    expect(ids).toHaveLength(1);
    expect(s.design.joints.some((j) => !j.anchor && j.x === 230 && j.y === 150)).toBe(true);
    expect(designCost(s.design)).toBe(80);
  });

  it("refuses beams that break the rules, saying why", () => {
    const s = createBridgeState(0);
    const a = pt(s, 190, 150);
    expect(checkPlacement(s, a, pt(s, 260, 150), "road").reason).toMatch(/Too long/);
    expect(checkPlacement(s, a, pt(s, 230, 150), "road").ok).toBe(true);
    // Into the cliff.
    expect(checkPlacement(s, a, pt(s, 150, 170), "wood").reason).toBe("Inside rock");
    // Through the cliff: both ends in open air, the middle in rock.
    expect(checkPlacement(s, pt(s, 170, 140), pt(s, 200, 200), "steel").reason).toBe(
      "Blocked by rock"
    );
    // Below the waterline.
    expect(checkPlacement(s, pt(s, 190, 190), pt(s, 230, 270), "cable").reason).toBe(
      "Out of bounds"
    );
    placeBeam(s, a, pt(s, 230, 150), "road");
    expect(checkPlacement(s, pt(s, 230, 150), a, "road").reason).toBe("Already built");
  });

  it("enforces the budget cap", () => {
    const s = createBridgeState(0);
    // Burn the budget with cables.
    let x = 200;
    while (placeBeam(s, pt(s, 190, 150), pt(s, x, 40), "cable").length) x += 10;
    expect(designCost(s.design)).toBeLessThanOrEqual(LEVELS[0]!.maxBudget);
    const check = checkPlacement(s, pt(s, 190, 150), pt(s, 230, 150), "road");
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("Over budget");
  });

  it("removing a beam prunes joints nothing else uses; anchors stay", () => {
    const s = build(0, [
      [190, 150, 230, 150, "road"],
      [230, 150, 270, 150, "road"],
    ]);
    const last = s.design.beams[1]!;
    expect(removeBeam(s, last.id)).toBe(true);
    expect(s.design.joints.some((j) => j.x === 270)).toBe(false);
    expect(s.design.joints.some((j) => j.x === 230)).toBe(true);
    const anchor = s.design.joints.find((j) => j.anchor)!;
    expect(removeJoint(s, anchor.id)).toBe(false);
  });

  it("removing a joint removes every beam on it", () => {
    const s = build(0, [
      [190, 150, 230, 150, "road"],
      [190, 190, 230, 150, "wood"],
      [230, 150, 270, 150, "road"],
    ]);
    const j = s.design.joints.find((x) => x.x === 230 && x.y === 150)!;
    expect(removeJoint(s, j.id)).toBe(true);
    expect(s.design.beams).toHaveLength(0);
    expect(s.design.joints.every((x) => x.anchor)).toBe(true);
  });

  it("undo, redo, and a new edit discards the redo branch", () => {
    const s = build(0, [
      [190, 150, 230, 150, "road"],
      [230, 150, 270, 150, "road"],
    ]);
    expect(canUndo(s)).toBe(true);
    undoBridge(s);
    expect(s.design.beams).toHaveLength(1);
    expect(canRedo(s)).toBe(true);
    redoBridge(s);
    expect(s.design.beams).toHaveLength(2);
    undoBridge(s);
    placeBeam(s, pt(s, 190, 190), pt(s, 230, 150), "wood");
    expect(canRedo(s)).toBe(false);
    clearBridge(s);
    expect(s.design.beams).toHaveLength(0);
    undoBridge(s);
    expect(s.design.beams).toHaveLength(2);
  });

  it("mirror mode builds and deletes the twin across the centre", () => {
    const s = createBridgeState(0);
    setMirror(s, true);
    const ids = placeBeam(s, pt(s, 190, 150), pt(s, 230, 150), "road");
    expect(ids).toHaveLength(2);
    expect(s.design.joints.some((j) => j.x === 270 && j.y === 150)).toBe(true);
    expect(designCost(s.design)).toBe(160);
    // A beam on the axis has no twin.
    expect(placeBeam(s, pt(s, 230, 150), pt(s, 250, 190), "wood")).toHaveLength(2);
    expect(placeBeam(s, pt(s, 250, 190), pt(s, 250, 150), "wood")).toHaveLength(1);
    const first = s.design.beams[0]!;
    removeBeam(s, first.id);
    expect(s.design.beams.filter((b) => b.material === "road")).toHaveLength(0);
  });

  it("re-materials a beam only when it still fits", () => {
    const s = build(0, [[190, 190, 230, 150, "wood"]]); // 56.6 long
    const beam = s.design.beams[0]!;
    expect(setBeamMaterial(s, beam.id, "road")).toBe(false);
    expect(setBeamMaterial(s, beam.id, "cable")).toBe(true);
    expect(s.design.beams[0]!.material).toBe("cable");
  });

  it("refuses edits during a test", () => {
    const s = build(0, REFERENCE[0]!);
    startTest(s);
    expect(placeBeam(s, pt(s, 190, 190), pt(s, 220, 190), "wood")).toHaveLength(0);
    expect(removeBeam(s, s.design.beams[0]!.id)).toBe(false);
    expect(canUndo(s)).toBe(false);
  });

  it("round-trips a saved design and rejects one from another level", () => {
    const s = build(0, REFERENCE[0]!);
    const restored = parseDesign(serializeDesign(s.design));
    expect(restored).toEqual(s.design);
    expect(isDesignValidFor(LEVELS[0]!, restored!)).toBe(true);
    expect(isDesignValidFor(LEVELS[1]!, restored!)).toBe(false);
    expect(parseDesign("{not json")).toBeNull();
    // A saved design for the wrong level is ignored, not loaded broken.
    expect(createBridgeState(1, restored).design.beams).toHaveLength(0);
    expect(createBridgeState(0, restored).design.beams).toHaveLength(s.design.beams.length);
  });

  it("switching level resets the design and keeps mirror mode", () => {
    const s = build(0, REFERENCE[0]!);
    setMirror(s, true);
    selectLevel(s, 4);
    expect(s.levelIndex).toBe(4);
    expect(s.design.beams).toHaveLength(0);
    expect(s.mirror).toBe(true);
  });
});

/* ---- levels ------------------------------------------------------------ */

describe("levels", () => {
  it.each(LEVELS.map((l, i) => [i + 1, l] as const))("level %i is well formed", (_n, level) => {
    expect(level.targetBudget).toBeLessThan(level.maxBudget);
    for (const a of level.anchors) {
      expect(insideTerrain(level, a.x, a.y)).toBe(false);
      expect(a.x % 10).toBe(0);
      expect(a.y % 10).toBe(0);
    }
    expect(level.startX).toBeLessThan(level.finishX);
  });
});

/* ---- simulation -------------------------------------------------------- */

describe("simulation", () => {
  it("with nothing built, the vehicle drives off the edge into the water", () => {
    const s = createBridgeState(0);
    let splashes = 0;
    runTest(s, (st) => {
      if (st.events.splash) splashes += 1;
    });
    expect(s.result?.success).toBe(false);
    expect(s.result?.reason).toBe("fell");
    expect(splashes).toBe(1);
  });

  it.each(LEVELS.map((l, i) => [i + 1, l.name, i] as const))(
    "level %i (%s): road alone snaps in tension",
    (_n, _name, i) => {
      const s = runTest(build(i, deckOnly(i)));
      expect(s.result?.success).toBe(false);
      expect(s.result?.firstBreak).toMatchObject({ material: "road", mode: "tension" });
    }
  );

  it.each(LEVELS.map((l, i) => [i + 1, l.name, i] as const))(
    "level %i (%s): the reference bridge carries the vehicle for three stars",
    (_n, _name, i) => {
      const s = build(i, REFERENCE[i]!);
      expect(designCost(s.design)).toBeLessThanOrEqual(LEVELS[i]!.targetBudget);
      runTest(s);
      expect(s.result).toMatchObject({ success: true, brokenCount: 0, stars: 3 });
      expect(scoreFor(s)).toBeGreaterThan(0);
    }
  );

  it("anchors never move and nothing goes non-finite", () => {
    const s = build(4, REFERENCE[4]!);
    const anchors = s.design.joints.filter((j) => j.anchor);
    runTest(s, (st) => {
      for (const a of anchors) {
        const p = st.sim!.particles[st.sim!.index.get(a.id)!]!;
        expect(p.x).toBe(a.x);
        expect(p.y).toBe(a.y);
      }
      for (const p of st.sim!.particles) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    });
  });

  it("cables never push", () => {
    const s = build(5, REFERENCE[5]!);
    let minCable = Infinity;
    runTest(s, (st) => {
      for (const b of st.sim!.beams)
        if (b.material === "cable") minCable = Math.min(minCable, b.force);
    });
    expect(minCable).toBeGreaterThanOrEqual(0);
  });

  it("steel braces run at lower stress than wood in the same place", () => {
    const withBraces = (m: MaterialType): Seg[] =>
      REFERENCE[0]!.map((seg) => (seg[4] === "wood" ? ([...seg.slice(0, 4), m] as Seg) : seg));
    const wood = runTest(build(0, withBraces("wood")));
    const steel = runTest(build(0, withBraces("steel")));
    expect(wood.result?.success).toBe(true);
    expect(steel.result?.success).toBe(true);
    expect(steel.result!.peakStress).toBeLessThan(wood.result!.peakStress);
  });

  it("reports crossing exactly once and then stops", () => {
    const s = build(0, REFERENCE[0]!);
    let crossed = 0;
    startTest(s);
    for (let i = 0; i < 60 * 30; i++) {
      stepBridge(s, 1 / 60);
      if (s.events.crossed) crossed += 1;
    }
    expect(crossed).toBe(1);
  });

  it("is deterministic: the same bridge gives the same result", () => {
    const a = runTest(build(2, REFERENCE[2]!)).result!;
    const b = runTest(build(2, REFERENCE[2]!)).result!;
    expect(b).toEqual(a);
  });

  it("stopping returns to build with the design intact and the peaks kept", () => {
    const s = build(0, REFERENCE[0]!);
    const before = serializeDesign(s.design);
    startTest(s);
    for (let i = 0; i < 240; i++) stepBridge(s, 1 / 60);
    stopTest(s);
    expect(s.mode).toBe("build");
    expect(s.sim).toBeNull();
    expect(serializeDesign(s.design)).toBe(before);
    expect(Object.keys(s.lastPeaks).length).toBe(s.design.beams.length);
    // Editing clears stale peaks.
    placeBeam(s, pt(s, 190, 190), pt(s, 250, 190), "wood");
    expect(Object.keys(s.lastPeaks)).toHaveLength(0);
  });

  it("scores nothing for a failure, and more for a cheaper bridge", () => {
    const failed = runTest(build(0, deckOnly(0)));
    expect(scoreFor(failed)).toBe(0);
    const lean = runTest(build(0, REFERENCE[0]!));
    const heavy = runTest(
      build(0, [...REFERENCE[0]!, [190, 190, 250, 190, "wood"], [250, 190, 310, 190, "wood"]])
    );
    expect(heavy.result?.success).toBe(true);
    expect(scoreFor(lean)).toBeGreaterThan(scoreFor(heavy));
  });
});
