/**
 * Bridge Builder Physics & Simulation Engine.
 *
 * Authentic 2D structural mechanics and truss physics simulation:
 * - Dynamic mass-spring-damper substepped physics solver.
 * - Realistic materials: Road Deck, Wood Struts, Steel Girders, Suspension Cables.
 * - Tension and compression strain limits with real-time stress heatmap (Green -> Yellow -> Red -> Snap).
 * - Cables resist tension only (slack under compression).
 * - Multi-axle vehicle dynamics with downward wheel loads and chassis slope tracking.
 * - Multi-level campaign with budget limits, star ratings, and undo/redo history.
 * - Full backwards-compatibility for legacy arcade tests and scoring.
 */

import { trussNeededFor, bridgeScore } from "./scoring";

export type MaterialType = "road" | "wood" | "steel" | "cable";

export interface MaterialDef {
  id: MaterialType;
  name: string;
  costPerMeter: number;
  maxTensionStrain: number;
  maxCompressionStrain: number;
  stiffness: number;
  density: number;
  maxLength: number;
  color: string;
  isRoad: boolean;
}

export const MATERIALS: Record<MaterialType, MaterialDef> = {
  road: {
    id: "road",
    name: "Road Deck",
    costPerMeter: 15,
    maxTensionStrain: 0.16,
    maxCompressionStrain: 0.14,
    stiffness: 9000,
    density: 2.0,
    maxLength: 90,
    color: "#64748b",
    isRoad: true,
  },
  wood: {
    id: "wood",
    name: "Wood Strut",
    costPerMeter: 8,
    maxTensionStrain: 0.18,
    maxCompressionStrain: 0.11, // wood buckles under compression faster than tension
    stiffness: 4800,
    density: 0.9,
    maxLength: 85,
    color: "#d97706",
    isRoad: false,
  },
  steel: {
    id: "steel",
    name: "Steel Girder",
    costPerMeter: 30,
    maxTensionStrain: 0.25,
    maxCompressionStrain: 0.22,
    stiffness: 15000,
    density: 3.2,
    maxLength: 105,
    color: "#0284c7",
    isRoad: false,
  },
  cable: {
    id: "cable",
    name: "Suspension Cable",
    costPerMeter: 20,
    maxTensionStrain: 0.30,
    maxCompressionStrain: 0.0, // cables carry zero compression
    stiffness: 10000,
    density: 0.5,
    maxLength: 180,
    color: "#e2e8f0",
    isRoad: false,
  },
};

export interface BridgeNode {
  id: string;
  x: number;
  y: number;
  origX: number;
  origY: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  mass: number;
  isAnchor: boolean;
  isRoadNode?: boolean;
}

export interface BridgeMember {
  id: string;
  nodeAId: string;
  nodeBId: string;
  material: MaterialType;
  restLength: number;
  currentLength: number;
  strain: number;
  stress: number; // 0 to 1+ (>= 1.0 snaps)
  isBroken: boolean;
  cost: number;
}

export interface VehicleDef {
  name: string;
  type: "van" | "truck" | "dumper" | "monster";
  massTonnes: number;
  wheelbase: number;
  length: number;
  speed: number; // units per second
}

export interface VehicleState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  frontWheelX: number;
  frontWheelY: number;
  rearWheelX: number;
  rearWheelY: number;
  grounded: boolean;
  inWater: boolean;
  finished: boolean;
}

export interface BridgeLevel {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  gapStartX: number;
  gapEndX: number;
  roadY: number;
  waterY: number;
  finishX: number;
  targetBudget: number;
  maxBudget: number;
  maxStressStar: number; // <= this stress gives the stress star
  vehicle: VehicleDef;
  anchors: Array<{ id?: string; x: number; y: number; isRoadNode?: boolean }>;
  cliffs: {
    left: Array<[number, number]>;
    right: Array<[number, number]>;
    island?: Array<[number, number]>;
  };
}

export const LEVELS: BridgeLevel[] = [
  {
    id: "pine-valley",
    name: "Level 1: Pine Valley",
    subtitle: "Gentle Mountain Span",
    description: "Build a sturdy road across the valley. Add triangular wood struts below to distribute the vehicle's weight.",
    gapStartX: 80,
    gapEndX: 280,
    roadY: 160,
    waterY: 265,
    finishX: 380,
    targetBudget: 750,
    maxBudget: 1100,
    maxStressStar: 0.75,
    vehicle: {
      name: "Delivery Van",
      type: "van",
      massTonnes: 6,
      wheelbase: 44,
      length: 54,
      speed: 80,
    },
    anchors: [
      { id: "a_left_road", x: 80, y: 160, isRoadNode: true },
      { id: "a_left_low", x: 50, y: 210, isRoadNode: false },
      { id: "a_right_road", x: 280, y: 160, isRoadNode: true },
      { id: "a_right_low", x: 310, y: 210, isRoadNode: false },
    ],
    cliffs: {
      left: [
        [0, 160],
        [80, 160],
        [50, 300],
        [0, 300],
      ],
      right: [
        [280, 160],
        [500, 160],
        [500, 300],
        [310, 300],
      ],
    },
  },
  {
    id: "canyon-arch",
    name: "Level 2: Canyon Arch",
    subtitle: "Deep Gorge Crossing",
    description: "A wide gap carrying a heavy 14-tonne cargo hauler. Build an arch or truss over or under the roadway.",
    gapStartX: 80,
    gapEndX: 340,
    roadY: 150,
    waterY: 265,
    finishX: 420,
    targetBudget: 1400,
    maxBudget: 1950,
    maxStressStar: 0.80,
    vehicle: {
      name: "Heavy Cargo Hauler",
      type: "truck",
      massTonnes: 14,
      wheelbase: 58,
      length: 74,
      speed: 72,
    },
    anchors: [
      { id: "a_left_road", x: 80, y: 150, isRoadNode: true },
      { id: "a_left_high", x: 40, y: 90, isRoadNode: false },
      { id: "a_left_low", x: 50, y: 210, isRoadNode: false },
      { id: "a_right_road", x: 340, y: 150, isRoadNode: true },
      { id: "a_right_high", x: 380, y: 90, isRoadNode: false },
      { id: "a_right_low", x: 370, y: 210, isRoadNode: false },
    ],
    cliffs: {
      left: [
        [0, 90],
        [40, 90],
        [80, 150],
        [50, 300],
        [0, 300],
      ],
      right: [
        [340, 150],
        [380, 90],
        [500, 90],
        [500, 300],
        [370, 300],
      ],
    },
  },
  {
    id: "river-pier",
    name: "Level 3: River Barge Pier",
    subtitle: "Central Pillar Bridge",
    description: "A central stone pier divides the wide river. Connect both spans to the foundation anchor.",
    gapStartX: 60,
    gapEndX: 440,
    roadY: 150,
    waterY: 265,
    finishX: 480,
    targetBudget: 1850,
    maxBudget: 2400,
    maxStressStar: 0.80,
    vehicle: {
      name: "Dump Truck",
      type: "dumper",
      massTonnes: 20,
      wheelbase: 66,
      length: 84,
      speed: 64,
    },
    anchors: [
      { id: "a_left_road", x: 60, y: 150, isRoadNode: true },
      { id: "a_left_low", x: 30, y: 200, isRoadNode: false },
      { id: "a_pier_road", x: 250, y: 150, isRoadNode: true },
      { id: "a_pier_base", x: 250, y: 220, isRoadNode: false },
      { id: "a_right_road", x: 440, y: 150, isRoadNode: true },
      { id: "a_right_low", x: 470, y: 200, isRoadNode: false },
    ],
    cliffs: {
      left: [
        [0, 150],
        [60, 150],
        [30, 300],
        [0, 300],
      ],
      right: [
        [440, 150],
        [500, 150],
        [500, 300],
        [470, 300],
      ],
      island: [
        [235, 160],
        [265, 160],
        [270, 300],
        [230, 300],
      ],
    },
  },
  {
    id: "steep-ravine",
    name: "Level 4: Steep Ravine",
    subtitle: "Asymmetric Slope & High Mast",
    description: "The left mountain peak towers over the low right bank. Use suspension cables from the top cliff mast.",
    gapStartX: 60,
    gapEndX: 370,
    roadY: 110,
    waterY: 265,
    finishX: 440,
    targetBudget: 1700,
    maxBudget: 2300,
    maxStressStar: 0.85,
    vehicle: {
      name: "Heavy Hauler",
      type: "truck",
      massTonnes: 16,
      wheelbase: 62,
      length: 78,
      speed: 68,
    },
    anchors: [
      { id: "a_left_road", x: 60, y: 110, isRoadNode: true },
      { id: "a_left_mast", x: 30, y: 45, isRoadNode: false },
      { id: "a_left_low", x: 30, y: 170, isRoadNode: false },
      { id: "a_right_road", x: 370, y: 180, isRoadNode: true },
      { id: "a_right_low", x: 390, y: 230, isRoadNode: false },
    ],
    cliffs: {
      left: [
        [0, 45],
        [30, 45],
        [60, 110],
        [30, 300],
        [0, 300],
      ],
      right: [
        [370, 180],
        [500, 180],
        [500, 300],
        [390, 300],
      ],
    },
  },
  {
    id: "devils-gorge",
    name: "Level 5: Devil's Gorge",
    subtitle: "Grand Suspension Abyss",
    description: "Massive 360m chasm carrying the 28-tonne Monster Road Train. Suspension cables and reinforced steel truss required!",
    gapStartX: 60,
    gapEndX: 420,
    roadY: 140,
    waterY: 265,
    finishX: 480,
    targetBudget: 2500,
    maxBudget: 3400,
    maxStressStar: 0.85,
    vehicle: {
      name: "Monster Road Train",
      type: "monster",
      massTonnes: 28,
      wheelbase: 88,
      length: 112,
      speed: 60,
    },
    anchors: [
      { id: "a_left_mast", x: 30, y: 40, isRoadNode: false },
      { id: "a_left_road", x: 60, y: 140, isRoadNode: true },
      { id: "a_left_low", x: 30, y: 200, isRoadNode: false },
      { id: "a_right_mast", x: 450, y: 40, isRoadNode: false },
      { id: "a_right_road", x: 420, y: 140, isRoadNode: true },
      { id: "a_right_low", x: 450, y: 200, isRoadNode: false },
    ],
    cliffs: {
      left: [
        [0, 40],
        [30, 40],
        [60, 140],
        [30, 300],
        [0, 300],
      ],
      right: [
        [420, 140],
        [450, 40],
        [500, 40],
        [500, 300],
        [450, 300],
      ],
    },
  },
];

export interface BridgeEvents {
  snapped: boolean;
  crossed: boolean;
  brokenMemberId?: string;
  splash?: boolean;
  peakStress?: number;
  creak?: boolean;
  cableHum?: boolean;
}

export interface BridgeState {
  /** Legacy load compatibility */
  loadTonnes: number;
  /** Legacy truss height slider compatibility */
  trussHeight: number;
  truckX: number;
  simulating: boolean;
  snapped: boolean;
  success: boolean;
  events: BridgeEvents;

  // Real Bridge Builder Engine State
  currentLevelIndex: number;
  nodes: BridgeNode[];
  members: BridgeMember[];
  vehicle: VehicleState;
  selectedMaterial: MaterialType;
  peakStressEncountered: number;
  starsEarned: number;
  starDetails: {
    completed: boolean;
    underBudget: boolean;
    underStress: boolean;
  };
  totalCost: number;
  history: Array<{ nodes: BridgeNode[]; members: BridgeMember[] }>;
  historyIndex: number;
}

// Legacy constants
export const START_X = 20;
export const FINISH_X = 380;
export const STRESS_START = 180;
export const STRESS_END = 260;
export const TRUCK_SPEED = 75;

export function rollLoad(rng: () => number = Math.random): number {
  return 4 + Math.round(rng() * 18);
}

/**
 * Initializes nodes from level anchors.
 */
function createInitialNodes(level: BridgeLevel): BridgeNode[] {
  return level.anchors.map((a, idx) => ({
    id: a.id || `node_anchor_${idx}`,
    x: a.x,
    y: a.y,
    origX: a.x,
    origY: a.y,
    vx: 0,
    vy: 0,
    fx: 0,
    fy: 0,
    mass: 10,
    isAnchor: true,
    isRoadNode: a.isRoadNode ?? false,
  }));
}

/**
 * Creates vehicle state aligned with current level.
 */
function createVehicleState(level: BridgeLevel): VehicleState {
  const vDef = level.vehicle;
  const startX = START_X;
  const startY = level.roadY - 14;
  return {
    x: startX,
    y: startY,
    angle: 0,
    vx: vDef.speed,
    vy: 0,
    frontWheelX: startX + vDef.wheelbase / 2,
    frontWheelY: level.roadY,
    rearWheelX: startX - vDef.wheelbase / 2,
    rearWheelY: level.roadY,
    grounded: true,
    inWater: false,
    finished: false,
  };
}

export function createBridgeState(
  rng: () => number = Math.random,
  levelIndex = 0
): BridgeState {
  const safeLevelIdx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
  const level = LEVELS[safeLevelIdx];
  const initialNodes = createInitialNodes(level);
  const initialMembers: BridgeMember[] = [];
  const vehicle = createVehicleState(level);

  const initialHistory = [
    {
      nodes: initialNodes.map((n) => ({ ...n })),
      members: initialMembers.map((m) => ({ ...m })),
    },
  ];

  return {
    loadTonnes: rollLoad(rng),
    trussHeight: 30,
    truckX: START_X,
    simulating: false,
    snapped: false,
    success: false,
    events: { snapped: false, crossed: false },

    currentLevelIndex: safeLevelIdx,
    nodes: initialNodes,
    members: initialMembers,
    vehicle,
    selectedMaterial: "road",
    peakStressEncountered: 0,
    starsEarned: 0,
    starDetails: {
      completed: false,
      underBudget: false,
      underStress: false,
    },
    totalCost: 0,
    history: initialHistory,
    historyIndex: 0,
  };
}

/**
 * Calculates member Euclidean length.
 */
export function memberLength(nodeA: BridgeNode, nodeB: BridgeNode): number {
  const dx = nodeB.x - nodeA.x;
  const dy = nodeB.y - nodeA.y;
  return Math.hypot(dx, dy);
}

export function calculateBridgeCost(members: BridgeMember[]): number {
  return members.reduce((sum, m) => sum + (m.isBroken ? 0 : m.cost), 0);
}

/**
 * Snaps a coordinate to a magnetic grid point.
 */
export function snapToGrid(
  x: number,
  y: number,
  gridSize = 20
): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

/**
 * Finds an existing node near a target point.
 */
export function findNodeNear(
  s: BridgeState,
  x: number,
  y: number,
  maxDist = 14
): BridgeNode | null {
  let closest: BridgeNode | null = null;
  let minDist = maxDist;

  for (const node of s.nodes) {
    const dist = Math.hypot(node.x - x, node.y - y);
    if (dist < minDist) {
      minDist = dist;
      closest = node;
    }
  }
  return closest;
}

/**
 * Adds a node or returns existing node if near.
 */
export function addNode(
  s: BridgeState,
  x: number,
  y: number,
  isAnchor = false,
  isRoadNode = false
): BridgeNode {
  const existing = findNodeNear(s, x, y, 10);
  if (existing) {
    if (isRoadNode) existing.isRoadNode = true;
    return existing;
  }

  const newNode: BridgeNode = {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    x,
    y,
    origX: x,
    origY: y,
    vx: 0,
    vy: 0,
    fx: 0,
    fy: 0,
    mass: 8,
    isAnchor,
    isRoadNode,
  };

  s.nodes.push(newNode);
  return newNode;
}

/**
 * Record history state for Undo/Redo.
 */
function recordHistory(s: BridgeState): void {
  if (s.historyIndex < s.history.length - 1) {
    s.history = s.history.slice(0, s.historyIndex + 1);
  }

  s.history.push({
    nodes: s.nodes.map((n) => ({ ...n })),
    members: s.members.map((m) => ({ ...m })),
  });
  s.historyIndex = s.history.length - 1;
}

/**
 * Adds a bridge member connecting two nodes.
 */
export function addMember(
  s: BridgeState,
  nodeAId: string,
  nodeBId: string,
  material: MaterialType
): BridgeMember | null {
  if (nodeAId === nodeBId) return null;

  const nodeA = s.nodes.find((n) => n.id === nodeAId);
  const nodeB = s.nodes.find((n) => n.id === nodeBId);
  if (!nodeA || !nodeB) return null;

  // Prevent duplicate members between same two nodes
  const duplicate = s.members.find(
    (m) =>
      !m.isBroken &&
      ((m.nodeAId === nodeAId && m.nodeBId === nodeBId) ||
        (m.nodeAId === nodeBId && m.nodeBId === nodeAId))
  );
  if (duplicate) return null;

  const length = memberLength(nodeA, nodeB);
  const matDef = MATERIALS[material];

  // Length constraint validation
  if (length > matDef.maxLength || length < 10) return null;

  const cost = Math.round(length * matDef.costPerMeter);

  if (material === "road") {
    nodeA.isRoadNode = true;
    nodeB.isRoadNode = true;
  }

  const member: BridgeMember = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nodeAId,
    nodeBId,
    material,
    restLength: length,
    currentLength: length,
    strain: 0,
    stress: 0,
    isBroken: false,
    cost,
  };

  s.members.push(member);
  s.totalCost = calculateBridgeCost(s.members);
  recordHistory(s);
  return member;
}

/**
 * Removes a member and cleans up orphaned non-anchor nodes.
 */
export function removeMember(s: BridgeState, memberId: string): void {
  const idx = s.members.findIndex((m) => m.id === memberId);
  if (idx === -1) return;

  s.members.splice(idx, 1);

  // Clean up orphan non-anchor nodes
  const activeNodeIds = new Set<string>();
  for (const m of s.members) {
    activeNodeIds.add(m.nodeAId);
    activeNodeIds.add(m.nodeBId);
  }

  s.nodes = s.nodes.filter((n) => n.isAnchor || activeNodeIds.has(n.id));
  s.totalCost = calculateBridgeCost(s.members);
  recordHistory(s);
}

export function undoBridge(s: BridgeState): void {
  if (s.simulating || s.historyIndex <= 0) return;
  s.historyIndex--;
  const snapshot = s.history[s.historyIndex];
  s.nodes = snapshot.nodes.map((n) => ({ ...n }));
  s.members = snapshot.members.map((m) => ({ ...m }));
  s.totalCost = calculateBridgeCost(s.members);
}

export function redoBridge(s: BridgeState): void {
  if (s.simulating || s.historyIndex >= s.history.length - 1) return;
  s.historyIndex++;
  const snapshot = s.history[s.historyIndex];
  s.nodes = snapshot.nodes.map((n) => ({ ...n }));
  s.members = snapshot.members.map((m) => ({ ...m }));
  s.totalCost = calculateBridgeCost(s.members);
}

export function clearBridge(s: BridgeState): void {
  if (s.simulating) return;
  const level = LEVELS[s.currentLevelIndex];
  s.nodes = createInitialNodes(level);
  s.members = [];
  s.totalCost = 0;
  recordHistory(s);
}

/**
 * Automatically builds baseline road deck between cliff anchors.
 */
export function buildAutoDeck(s: BridgeState): void {
  if (s.simulating) return;
  const level = LEVELS[s.currentLevelIndex];

  // Find left and right road anchors
  const leftAnchor = s.nodes.find(
    (n) => n.isAnchor && n.isRoadNode && n.x <= level.gapStartX + 5
  );
  const rightAnchor = s.nodes.find(
    (n) => n.isAnchor && n.isRoadNode && n.x >= level.gapEndX - 5
  );

  if (!leftAnchor || !rightAnchor) return;

  const totalGap = rightAnchor.x - leftAnchor.x;
  const segmentWidth = 40;
  const count = Math.max(2, Math.round(totalGap / segmentWidth));
  const actualStep = totalGap / count;

  let prevNode = leftAnchor;
  for (let i = 1; i < count; i++) {
    const x = Math.round(leftAnchor.x + i * actualStep);
    const t = i / count;
    const y = Math.round(leftAnchor.y + t * (rightAnchor.y - leftAnchor.y));
    const nextNode = addNode(s, x, y, false, true);
    addMember(s, prevNode.id, nextNode.id, "road");
    prevNode = nextNode;
  }
  addMember(s, prevNode.id, rightAnchor.id, "road");
}

/**
 * Selects a campaign level and resets state.
 */
export function selectLevel(s: BridgeState, levelIndex: number): void {
  const safeIdx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
  s.currentLevelIndex = safeIdx;
  const level = LEVELS[safeIdx];
  s.nodes = createInitialNodes(level);
  s.members = [];
  s.vehicle = createVehicleState(level);
  s.truckX = START_X;
  s.simulating = false;
  s.snapped = false;
  s.success = false;
  s.events = { snapped: false, crossed: false };
  s.peakStressEncountered = 0;
  s.starsEarned = 0;
  s.totalCost = 0;
  s.history = [
    {
      nodes: s.nodes.map((n) => ({ ...n })),
      members: s.members.map((m) => ({ ...m })),
    },
  ];
  s.historyIndex = 0;
}

/**
 * Resets positions and velocities before a test run.
 */
export function startTest(s: BridgeState): void {
  if (s.simulating) return;

  const level = LEVELS[s.currentLevelIndex];

  // Reset node positions and velocities
  for (const node of s.nodes) {
    node.x = node.origX;
    node.y = node.origY;
    node.vx = 0;
    node.vy = 0;
    node.fx = 0;
    node.fy = 0;
  }

  // Reset member strains and unbroken status
  for (const m of s.members) {
    const nodeA = s.nodes.find((n) => n.id === m.nodeAId);
    const nodeB = s.nodes.find((n) => n.id === m.nodeBId);
    if (nodeA && nodeB) {
      m.restLength = memberLength(nodeA, nodeB);
      m.currentLength = m.restLength;
    }
    m.strain = 0;
    m.stress = 0;
    m.isBroken = false;
  }

  s.vehicle = createVehicleState(level);
  s.truckX = START_X;
  s.simulating = true;
  s.snapped = false;
  s.success = false;
  s.peakStressEncountered = 0;
  s.events = { snapped: false, crossed: false };
}

export function stopTest(s: BridgeState): void {
  s.simulating = false;
  const level = LEVELS[s.currentLevelIndex];

  // Restore node resting coordinates
  for (const node of s.nodes) {
    node.x = node.origX;
    node.y = node.origY;
    node.vx = 0;
    node.vy = 0;
  }

  for (const m of s.members) {
    m.isBroken = false;
    m.strain = 0;
    m.stress = 0;
  }

  s.vehicle = createVehicleState(level);
  s.truckX = START_X;
}

export function setTruss(s: BridgeState, height: number): void {
  if (s.simulating) return;
  s.trussHeight = Math.max(0, Math.min(100, height));
}

export function willHold(s: BridgeState): boolean {
  if (s.members.length > 0 && s.totalCost > 0) {
    const hasRoad = s.members.some((m) => m.material === "road");
    return hasRoad && s.totalCost >= 250;
  }
  return s.trussHeight >= trussNeededFor(s.loadTonnes);
}

export function scoreFor(s: BridgeState): number {
  if (s.starsEarned > 0) {
    const level = LEVELS[s.currentLevelIndex];
    const budgetBonus = Math.max(0, level.targetBudget - s.totalCost) * 2;
    const stressBonus = Math.round((1 - Math.min(1, s.peakStressEncountered)) * 300);
    return 400 + s.starsEarned * 200 + budgetBonus + stressBonus;
  }
  return bridgeScore(s.trussHeight, trussNeededFor(s.loadTonnes));
}

/**
 * Find road height and connected road segment at wheel position.
 */
function getRoadContact(
  s: BridgeState,
  x: number,
  level: BridgeLevel
): { y: number; roadMember: BridgeMember | null; t: number; nodeA: BridgeNode | null; nodeB: BridgeNode | null } {
  // Left cliff surface
  if (x <= level.gapStartX) {
    const startY = level.cliffs.left[1]?.[1] ?? level.roadY;
    return { y: startY, roadMember: null, t: 0, nodeA: null, nodeB: null };
  }

  // Right cliff surface
  if (x >= level.gapEndX) {
    const finishY = level.cliffs.right[0]?.[1] ?? level.roadY;
    return { y: finishY, roadMember: null, t: 0, nodeA: null, nodeB: null };
  }

  // Active road members in the gap
  for (const m of s.members) {
    if (m.isBroken || m.material !== "road") continue;
    const a = s.nodes.find((n) => n.id === m.nodeAId);
    const b = s.nodes.find((n) => n.id === m.nodeBId);
    if (!a || !b) continue;

    const minX = Math.min(a.x, b.x) - 1.5;
    const maxX = Math.max(a.x, b.x) + 1.5;

    if (x >= minX && x <= maxX) {
      const denom = b.x - a.x;
      const t = denom !== 0 ? Math.max(0, Math.min(1, (x - a.x) / denom)) : 0;
      const y = a.y + t * (b.y - a.y);
      return { y, roadMember: m, t, nodeA: a, nodeB: b };
    }
  }

  // No road surface under wheel (gap or broken segment)
  return { y: level.waterY + 100, roadMember: null, t: 0, nodeA: null, nodeB: null };
}

/**
 * Advances the simulation by dt seconds with substepping. Mutates `s`.
 */
export function stepBridge(s: BridgeState, dt: number): void {
  s.events = { snapped: false, crossed: false };
  if (!s.simulating || s.snapped || s.success) return;

  const level = LEVELS[s.currentLevelIndex];
  const vDef = level.vehicle;
  const vState = s.vehicle;

  // If no custom members have been placed, run legacy slider simulation
  if (s.members.length === 0) {
    s.truckX += TRUCK_SPEED * dt;
    vState.x = s.truckX;
    vState.frontWheelX = s.truckX + vDef.wheelbase / 2;
    vState.rearWheelX = s.truckX - vDef.wheelbase / 2;

    if (
      s.truckX >= STRESS_START &&
      s.truckX <= STRESS_END &&
      s.trussHeight < trussNeededFor(s.loadTonnes)
    ) {
      s.snapped = true;
      s.simulating = false;
      s.events.snapped = true;
      vState.inWater = true;
      return;
    }

    if (s.truckX >= FINISH_X) {
      s.truckX = FINISH_X;
      vState.x = FINISH_X;
      s.success = true;
      s.simulating = false;
      s.events.crossed = true;
      s.starDetails = { completed: true, underBudget: true, underStress: true };
      s.starsEarned = 3;
    }
    return;
  }

  // Full 2D physics simulation for custom-built bridges
  const substeps = 12;
  const dtSub = dt / substeps;
  const gravity = 18; // px/s^2 baseline gravity force scale

  // Update dynamic node masses
  for (const n of s.nodes) {
    n.mass = n.isAnchor ? 9999 : 6;
  }
  for (const m of s.members) {
    if (m.isBroken) continue;
    const a = s.nodes.find((n) => n.id === m.nodeAId);
    const b = s.nodes.find((n) => n.id === m.nodeBId);
    if (a && b) {
      const halfMass = (m.restLength * MATERIALS[m.material].density) / 2;
      if (!a.isAnchor) a.mass += halfMass;
      if (!b.isAnchor) b.mass += halfMass;
    }
  }

  let frameMaxStress = 0;

  for (let step = 0; step < substeps; step++) {
    // 1. Initialize forces
    for (const n of s.nodes) {
      if (n.isAnchor) {
        n.fx = 0;
        n.fy = 0;
      } else {
        n.fx = 0;
        n.fy = n.mass * gravity;
      }
    }

    // 2. Member tension and compression forces
    for (const m of s.members) {
      if (m.isBroken) continue;
      const a = s.nodes.find((n) => n.id === m.nodeAId);
      const b = s.nodes.find((n) => n.id === m.nodeBId);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 0.001;
      m.currentLength = len;

      const delta = len - m.restLength;
      const strain = delta / m.restLength;
      m.strain = strain;

      const mat = MATERIALS[m.material];

      // Cable slack rule: zero force and zero stress if compressed
      if (mat.id === "cable" && delta < 0) {
        m.stress = 0;
        continue;
      }

      let stressRatio = 0;
      if (delta >= 0) {
        stressRatio = strain / mat.maxTensionStrain;
      } else {
        stressRatio = -strain / mat.maxCompressionStrain;
      }

      m.stress = Math.max(0, stressRatio);
      if (m.stress > frameMaxStress) frameMaxStress = m.stress;

      // Check fracture limit
      if (m.stress >= 1.0) {
        m.isBroken = true;
        s.events.snapped = true;
        s.events.brokenMemberId = m.id;
        break;
      }

      // Spring + axial damping force
      const uX = dx / len;
      const uY = dy / len;
      const fSpring = mat.stiffness * delta;
      const vRel = (b.vx - a.vx) * uX + (b.vy - a.vy) * uY;
      const fDamp = 45 * vRel;
      const fTotal = fSpring + fDamp;

      if (!a.isAnchor) {
        a.fx += fTotal * uX;
        a.fy += fTotal * uY;
      }
      if (!b.isAnchor) {
        b.fx -= fTotal * uX;
        b.fy -= fTotal * uY;
      }
    }

    // 3. Vehicle wheel downward forces applied to bridge nodes
    if (vState.grounded && !s.snapped) {
      const halfWheelbase = vDef.wheelbase / 2;
      const rX = vState.x - halfWheelbase * Math.cos(vState.angle);
      const fX = vState.x + halfWheelbase * Math.cos(vState.angle);

      const rContact = getRoadContact(s, rX, level);
      const fContact = getRoadContact(s, fX, level);

      const wheelWeight = vDef.massTonnes * 24;

      if (rContact.roadMember && rContact.nodeA && rContact.nodeB) {
        if (!rContact.nodeA.isAnchor) rContact.nodeA.fy += (1 - rContact.t) * wheelWeight;
        if (!rContact.nodeB.isAnchor) rContact.nodeB.fy += rContact.t * wheelWeight;
      }

      if (fContact.roadMember && fContact.nodeA && fContact.nodeB) {
        if (!fContact.nodeA.isAnchor) fContact.nodeA.fy += (1 - fContact.t) * wheelWeight;
        if (!fContact.nodeB.isAnchor) fContact.nodeB.fy += fContact.t * wheelWeight;
      }
    }

    // 4. Integrate node positions and velocities
    for (const n of s.nodes) {
      if (n.isAnchor) {
        n.x = n.origX;
        n.y = n.origY;
        n.vx = 0;
        n.vy = 0;
        continue;
      }

      const ax = n.fx / n.mass;
      const ay = n.fy / n.mass;

      // Air resistance damping
      n.vx = (n.vx + ax * dtSub) * (1 - 0.03 * dtSub * 60);
      n.vy = (n.vy + ay * dtSub) * (1 - 0.03 * dtSub * 60);

      // Clamp velocities to prevent physics explosion
      n.vx = Math.max(-350, Math.min(350, n.vx));
      n.vy = Math.max(-350, Math.min(350, n.vy));

      n.x += n.vx * dtSub;
      n.y += n.vy * dtSub;
    }
  }

  // Update peak stress
  if (frameMaxStress > s.peakStressEncountered) {
    s.peakStressEncountered = frameMaxStress;
  }
  s.events.peakStress = frameMaxStress;

  // Sound event flags
  if (frameMaxStress > 0.65) s.events.creak = true;
  if (frameMaxStress > 0.75) s.events.cableHum = true;

  // 5. Vehicle horizontal propulsion & chassis slope tracking
  const halfWheelbase = vDef.wheelbase / 2;
  const rX = vState.x - halfWheelbase;
  const fX = vState.x + halfWheelbase;

  const rearContact = getRoadContact(s, rX, level);
  const frontContact = getRoadContact(s, fX, level);

  const rearSupported = rearContact.y < level.waterY;
  const frontSupported = frontContact.y < level.waterY;

  if (rearSupported && frontSupported) {
    // Both wheels supported: drive forward smoothly
    vState.grounded = true;
    vState.x += vDef.speed * dt;
    s.truckX = vState.x;

    const targetY = (rearContact.y + frontContact.y) / 2 - 14;
    const targetAngle = Math.atan2(frontContact.y - rearContact.y, vDef.wheelbase);

    vState.y += (targetY - vState.y) * Math.min(1, 14 * dt);
    vState.angle += (targetAngle - vState.angle) * Math.min(1, 14 * dt);

    vState.rearWheelX = rX;
    vState.rearWheelY = rearContact.y;
    vState.frontWheelX = fX;
    vState.frontWheelY = frontContact.y;
  } else {
    // Loss of support (road snapped or gap): vehicle falls
    vState.grounded = false;
    vState.vy += gravity * dt;
    vState.x += (vDef.speed * 0.7) * dt;
    s.truckX = vState.x;
    vState.y += vState.vy * dt;
    vState.angle += 1.8 * dt; // tumbling

    if (vState.y >= level.waterY - 10) {
      vState.inWater = true;
      s.snapped = true;
      s.simulating = false;
      s.events.snapped = true;
      s.events.splash = true;
      return;
    }
  }

  // 6. Check finish line crossing
  if (vState.x >= level.finishX) {
    vState.finished = true;
    s.truckX = level.finishX;
    s.success = true;
    s.simulating = false;
    s.events.crossed = true;

    // Calculate 3-star rating
    const starCompleted = true;
    const starBudget = s.totalCost <= level.targetBudget;
    const starStress = s.peakStressEncountered <= level.maxStressStar;

    s.starDetails = {
      completed: starCompleted,
      underBudget: starBudget,
      underStress: starStress,
    };
    s.starsEarned =
      (starCompleted ? 1 : 0) + (starBudget ? 1 : 0) + (starStress ? 1 : 0);
  }
}
