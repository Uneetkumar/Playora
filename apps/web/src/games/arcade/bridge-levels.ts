/**
 * Bridge Builder campaign.
 *
 * World units: 500 x 300, y grows downward, 10 units = 1 metre. Every level is
 * mirrored about x = 250 where its terrain allows, so mirror-build works.
 *
 * Each level introduces one idea. The reference solutions that prove every
 * level can be beaten under its cap live in the tests, not here — shipping
 * them in the bundle would only hand players the answer.
 */

export type Point = { x: number; y: number };
export type Polygon = Array<[number, number]>;

export type VehicleKind = "car" | "van" | "truck";

export interface VehicleDef {
  kind: VehicleKind;
  name: string;
  /** Tonnes. */
  mass: number;
  wheelbase: number;
  wheelRadius: number;
  /** Chassis height above the axle line. */
  height: number;
  /** Body length, for drawing. */
  length: number;
  /** Cruise speed, units per second. */
  speed: number;
  color: string;
}

export const VEHICLES: Record<VehicleKind, VehicleDef> = {
  car: {
    kind: "car",
    name: "Hatchback",
    mass: 1.4,
    wheelbase: 26,
    wheelRadius: 5,
    height: 11,
    length: 40,
    speed: 60,
    color: "#ef4444",
  },
  van: {
    kind: "van",
    name: "Delivery Van",
    mass: 3,
    wheelbase: 32,
    wheelRadius: 6,
    height: 16,
    length: 48,
    speed: 55,
    color: "#f8fafc",
  },
  truck: {
    kind: "truck",
    name: "Cargo Truck",
    mass: 7,
    wheelbase: 44,
    wheelRadius: 7,
    height: 20,
    length: 64,
    speed: 48,
    color: "#f59e0b",
  },
};

/** A decorative tower whose top is an anchor. Drawn behind the road. */
export interface Pylon {
  x: number;
  topY: number;
  baseY: number;
}

export interface BridgeLevel {
  id: string;
  name: string;
  /** One-line idea this level teaches. */
  lesson: string;
  hint: string;
  terrain: Polygon[];
  anchors: Point[];
  pylons?: Pylon[];
  waterY: number;
  startX: number;
  finishX: number;
  /** Three-star budget. */
  targetBudget: number;
  /** Hard cap: you cannot build past it. */
  maxBudget: number;
  /** Peak stress at or under this earns the engineering star. */
  stressStar: number;
  vehicle: VehicleDef;
}

const WATER = 272;

/** Mirror a left-bank polygon to the right bank about x = 250. */
function mirror(poly: Polygon): Polygon {
  return poly.map(([x, y]) => [500 - x, y] as [number, number]).reverse();
}

function mirrorPoints(points: Point[]): Point[] {
  return points.map((p) => ({ x: 500 - p.x, y: p.y }));
}

function symmetric(left: Polygon, anchors: Point[]): { terrain: Polygon[]; anchors: Point[] } {
  return {
    terrain: [left, mirror(left)],
    anchors: [...anchors, ...mirrorPoints(anchors)],
  };
}

const L1 = symmetric(
  [
    [0, 150],
    [190, 150],
    [190, 190],
    [182, 230],
    [174, 300],
    [0, 300],
  ],
  [
    { x: 190, y: 150 },
    { x: 190, y: 190 },
  ]
);

const L2 = symmetric(
  [
    [0, 160],
    [160, 160],
    [156, 220],
    [150, 300],
    [0, 300],
  ],
  [{ x: 160, y: 160 }]
);

const L3 = symmetric(
  [
    [0, 140],
    [140, 140],
    [134, 180],
    [140, 220],
    [128, 300],
    [0, 300],
  ],
  [
    { x: 140, y: 140 },
    { x: 140, y: 220 },
  ]
);

const L4 = symmetric(
  [
    [0, 150],
    [80, 150],
    [80, 200],
    [70, 300],
    [0, 300],
  ],
  [
    { x: 80, y: 150 },
    { x: 80, y: 200 },
  ]
);

const L5 = symmetric(
  [
    [0, 150],
    [150, 150],
    [150, 200],
    [144, 240],
    [136, 300],
    [0, 300],
  ],
  [
    { x: 150, y: 150 },
    { x: 150, y: 200 },
  ]
);

const L6 = symmetric(
  [
    [0, 160],
    [130, 160],
    [126, 230],
    [118, 300],
    [0, 300],
  ],
  [
    { x: 130, y: 160 },
    { x: 110, y: 50 },
  ]
);

const L8 = symmetric(
  [
    [0, 150],
    [90, 150],
    [90, 210],
    [80, 300],
    [0, 300],
  ],
  [
    { x: 90, y: 150 },
    { x: 90, y: 210 },
    { x: 70, y: 40 },
  ]
);

export const LEVELS: BridgeLevel[] = [
  {
    id: "first-crossing",
    name: "First Crossing",
    lesson: "Roads sag. Triangles don't.",
    hint: "Lay road across the gap, then brace each road joint down to the lower anchors so every panel is a triangle.",
    ...L1,
    waterY: WATER,
    startX: 50,
    finishX: 450,
    targetBudget: 520,
    maxBudget: 800,
    stressStar: 0.8,
    vehicle: VEHICLES.car,
  },
  {
    id: "over-the-top",
    name: "Over the Top",
    lesson: "No anchors below? Build the truss above the road.",
    hint: "Sheer cliffs leave nothing to brace against. Raise a row of joints over the road and zig-zag between the two chords.",
    ...L2,
    waterY: WATER,
    startX: 50,
    finishX: 450,
    targetBudget: 1000,
    maxBudget: 1500,
    stressStar: 0.8,
    vehicle: VEHICLES.van,
  },
  {
    id: "deep-arch",
    name: "Deep Arch",
    lesson: "Arches turn weight into compression.",
    hint: "Curve a chain of members from the low anchors up toward mid-span, then post it up to the road. Short members resist buckling.",
    ...L3,
    waterY: WATER,
    startX: 50,
    finishX: 450,
    targetBudget: 1400,
    maxBudget: 2000,
    stressStar: 0.8,
    vehicle: VEHICLES.van,
  },
  {
    id: "midstream-pier",
    name: "Midstream Pier",
    lesson: "Two short spans beat one long one.",
    hint: "The rock in the river is an anchor. Split the crossing into two spans that both rest on it.",
    terrain: [
      ...L4.terrain,
      [
        [232, 300],
        [236, 210],
        [264, 210],
        [268, 300],
      ],
    ],
    anchors: [...L4.anchors, { x: 240, y: 210 }, { x: 260, y: 210 }],
    waterY: WATER,
    startX: 40,
    finishX: 460,
    targetBudget: 1850,
    maxBudget: 2600,
    stressStar: 0.8,
    vehicle: VEHICLES.van,
  },
  {
    id: "heavy-haul",
    name: "Heavy Haul",
    lesson: "Steel where it matters, wood where it doesn't.",
    hint: "A 7-tonne truck. Put steel in the members that glow red, keep cheap wood in the quiet ones.",
    ...L5,
    waterY: WATER,
    startX: 50,
    finishX: 450,
    targetBudget: 1950,
    maxBudget: 2800,
    stressStar: 0.85,
    vehicle: VEHICLES.truck,
  },
  {
    id: "cable-stay",
    name: "Cable Stay",
    lesson: "Cables carry huge tension for their weight — and nothing in compression.",
    hint: "Hang the road from the pylon tops with cables. A cable that goes slack does no work.",
    ...L6,
    pylons: [
      { x: 110, topY: 50, baseY: 160 },
      { x: 390, topY: 50, baseY: 160 },
    ],
    waterY: WATER,
    startX: 45,
    finishX: 455,
    targetBudget: 1250,
    maxBudget: 1900,
    stressStar: 0.8,
    vehicle: VEHICLES.van,
  },
  {
    id: "uneven-banks",
    name: "Uneven Banks",
    lesson: "Slopes push sideways too.",
    hint: "The road falls 8 metres. Brace it from the high bank's low anchor and keep the downhill end well triangulated.",
    terrain: [
      [
        [0, 110],
        [140, 110],
        [140, 170],
        [130, 230],
        [122, 300],
        [0, 300],
      ],
      [
        [360, 190],
        [360, 240],
        [372, 300],
        [500, 300],
        [500, 190],
      ],
    ],
    anchors: [
      { x: 140, y: 110 },
      { x: 140, y: 170 },
      { x: 360, y: 190 },
      { x: 360, y: 240 },
    ],
    waterY: WATER,
    startX: 50,
    finishX: 450,
    targetBudget: 1400,
    maxBudget: 2000,
    stressStar: 0.9,
    vehicle: VEHICLES.van,
  },
  {
    id: "grand-gorge",
    name: "Grand Gorge",
    lesson: "Everything you've learned, at once.",
    hint: "32 metres and a loaded truck. Combine a truss, an arch or cables from the pylons — whatever stays green.",
    ...L8,
    pylons: [
      { x: 70, topY: 40, baseY: 150 },
      { x: 430, topY: 40, baseY: 150 },
    ],
    waterY: WATER,
    startX: 35,
    finishX: 465,
    targetBudget: 2400,
    maxBudget: 3600,
    stressStar: 0.85,
    vehicle: VEHICLES.truck,
  },
];
