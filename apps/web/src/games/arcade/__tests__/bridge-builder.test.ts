import { describe, it, expect } from "vitest";
import {
  createBridgeState,
  stepBridge,
  startTest,
  stopTest,
  setTruss,
  willHold,
  scoreFor,
  rollLoad,
  snapToGrid,
  findNodeNear,
  addNode,
  addMember,
  removeMember,
  undoBridge,
  redoBridge,
  clearBridge,
  buildAutoDeck,
  selectLevel,
  calculateBridgeCost,
  LEVELS,
  MATERIALS,
  START_X,
  FINISH_X,
  STRESS_START,
  TRUCK_SPEED,
  type BridgeState,
} from "../bridge-builder";
import { trussNeededFor } from "../scoring";

const run = (s: BridgeState, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepBridge(s, 1 / 60);
};

describe("bridge builder", () => {
  describe("legacy arcade mechanics", () => {
    it("starts parked, not simulating", () => {
      const s = createBridgeState();
      expect(s.truckX).toBe(START_X);
      expect(s.simulating).toBe(false);
    });

    it("varies the load so the answer cannot be memorised", () => {
      const loads = new Set<number>();
      let seed = 0;
      for (let i = 0; i < 40; i++) {
        seed += 0.023;
        loads.add(rollLoad(() => seed % 1));
      }
      expect(loads.size).toBeGreaterThan(3);
    });

    it("does not move until the test starts", () => {
      const s = createBridgeState();
      run(s, 2);
      expect(s.truckX).toBe(START_X);
    });

    it("drives the truck across at a speed measured in seconds", () => {
      const s = createBridgeState();
      s.trussHeight = 100;
      startTest(s);
      run(s, 1);
      expect(s.truckX).toBeGreaterThan(START_X + TRUCK_SPEED * 0.9);
    });

    it("snaps in the middle when the truss is under-built", () => {
      const s = createBridgeState();
      s.loadTonnes = 20;
      s.trussHeight = trussNeededFor(20) - 5;
      startTest(s);
      run(s, 10);
      expect(s.snapped).toBe(true);
      expect(s.success).toBe(false);
      expect(s.truckX).toBeGreaterThanOrEqual(STRESS_START);
    });

    it("crosses when the truss is sufficient", () => {
      const s = createBridgeState();
      s.loadTonnes = 10;
      s.trussHeight = trussNeededFor(10) + 2;
      startTest(s);
      run(s, 10);
      expect(s.success).toBe(true);
      expect(s.snapped).toBe(false);
      expect(s.truckX).toBe(FINISH_X);
    });

    it("scores the margin, so overbuilding is not the best answer", () => {
      const tight = createBridgeState();
      tight.loadTonnes = 12;
      tight.trussHeight = trussNeededFor(12);
      const heavy = createBridgeState();
      heavy.loadTonnes = 12;
      heavy.trussHeight = trussNeededFor(12) + 40;
      expect(scoreFor(tight)).toBeGreaterThan(scoreFor(heavy));
    });

    it("predicts whether the bridge will hold", () => {
      const s = createBridgeState();
      s.loadTonnes = 15;
      s.trussHeight = trussNeededFor(15);
      expect(willHold(s)).toBe(true);
      s.trussHeight = trussNeededFor(15) - 1;
      expect(willHold(s)).toBe(false);
    });

    it("refuses truss changes mid-test", () => {
      const s = createBridgeState();
      startTest(s);
      const before = s.trussHeight;
      setTruss(s, 90);
      expect(s.trussHeight).toBe(before);
    });

    it("clamps the truss to a sane range", () => {
      const s = createBridgeState();
      setTruss(s, -50);
      expect(s.trussHeight).toBe(0);
      setTruss(s, 5000);
      expect(s.trussHeight).toBe(100);
    });

    it("reports crossing and snapping exactly once", () => {
      const s = createBridgeState();
      s.loadTonnes = 8;
      s.trussHeight = trussNeededFor(8) + 5;
      startTest(s);
      let crossed = 0;
      for (let i = 0; i < 600; i++) {
        stepBridge(s, 1 / 60);
        if (s.events.crossed) crossed += 1;
      }
      expect(crossed).toBe(1);
    });

    it("a restart re-rolls the load", () => {
      const a = createBridgeState(() => 0.1);
      const b = createBridgeState(() => 0.9);
      expect(a.loadTonnes).not.toBe(b.loadTonnes);
    });
  });

  describe("real truss & physics engine", () => {
    it("defines authentic engineering material properties", () => {
      expect(MATERIALS.road.costPerMeter).toBe(15);
      expect(MATERIALS.wood.costPerMeter).toBe(8);
      expect(MATERIALS.steel.costPerMeter).toBe(30);
      expect(MATERIALS.cable.costPerMeter).toBe(20);

      // Steel should have higher stiffness and max strain than wood
      expect(MATERIALS.steel.stiffness).toBeGreaterThan(MATERIALS.wood.stiffness);
      expect(MATERIALS.steel.maxTensionStrain).toBeGreaterThan(MATERIALS.wood.maxTensionStrain);

      // Cables have zero compression capability (slack)
      expect(MATERIALS.cable.maxCompressionStrain).toBe(0);
    });

    it("snaps coordinates magnetically to grid", () => {
      const snapped = snapToGrid(83, 157, 20);
      expect(snapped.x).toBe(80);
      expect(snapped.y).toBe(160);
    });

    it("adds nodes and finds existing nearby nodes within magnetic tolerance", () => {
      const s = createBridgeState();
      const nodeA = addNode(s, 120, 160);
      expect(nodeA).toBeDefined();
      expect(nodeA.x).toBe(120);

      // Searching near (122, 159) should find nodeA
      const found = findNodeNear(s, 122, 159, 14);
      expect(found).toBe(nodeA);

      // Adding near existing node should return the existing one
      const duplicate = addNode(s, 123, 161);
      expect(duplicate).toBe(nodeA);
    });

    it("enforces material length limits and calculates member cost", () => {
      const s = createBridgeState();
      const n1 = addNode(s, 100, 100);
      const n2 = addNode(s, 140, 100); // length 40
      const member = addMember(s, n1.id, n2.id, "wood");

      expect(member).not.toBeNull();
      expect(member?.cost).toBe(40 * MATERIALS.wood.costPerMeter); // 40 * 8 = 320
      expect(s.totalCost).toBe(member!.cost);

      // Exceeding max length for wood (85px)
      const farNode = addNode(s, 300, 100); // length 160
      const tooLong = addMember(s, n2.id, farNode.id, "wood");
      expect(tooLong).toBeNull();

      // But cables can span longer distances (up to 180px)
      const cable = addMember(s, n2.id, farNode.id, "cable");
      expect(cable).not.toBeNull();
    });

    it("removes members and cleans up orphan non-anchor nodes", () => {
      const s = createBridgeState();
      const n1 = addNode(s, 100, 100);
      const n2 = addNode(s, 140, 100);
      const m = addMember(s, n1.id, n2.id, "steel");
      expect(m).not.toBeNull();

      expect(s.nodes.some((n) => n.id === n1.id)).toBe(true);
      removeMember(s, m!.id);

      // Non-anchor orphan nodes should be pruned
      expect(s.nodes.some((n) => n.id === n1.id)).toBe(false);
      expect(s.nodes.some((n) => n.id === n2.id)).toBe(false);
      expect(s.members.length).toBe(0);
      expect(s.totalCost).toBe(0);
    });

    it("handles undo and redo history", () => {
      const s = createBridgeState();
      const n1 = addNode(s, 100, 100);
      const n2 = addNode(s, 140, 100);
      const m = addMember(s, n1.id, n2.id, "wood");
      expect(s.members.length).toBe(1);

      undoBridge(s);
      expect(s.members.length).toBe(0);

      redoBridge(s);
      expect(s.members.length).toBe(1);
    });

    it("clears user bridge back to initial level anchors", () => {
      const s = createBridgeState();
      const n1 = addNode(s, 120, 120);
      const n2 = addNode(s, 160, 120);
      addMember(s, n1.id, n2.id, "steel");
      expect(s.members.length).toBe(1);

      clearBridge(s);
      expect(s.members.length).toBe(0);
      expect(s.nodes.every((n) => n.isAnchor)).toBe(true);
      expect(s.totalCost).toBe(0);
    });

    it("builds auto road deck spanning anchors", () => {
      const s = createBridgeState(Math.random, 0); // Level 1
      buildAutoDeck(s);
      expect(s.members.length).toBeGreaterThan(2);
      expect(s.members.every((m) => m.material === "road")).toBe(true);
      expect(s.totalCost).toBeGreaterThan(0);
    });

    it("switches levels and updates vehicle and anchors", () => {
      const s = createBridgeState();
      expect(s.currentLevelIndex).toBe(0);

      selectLevel(s, 1); // Canyon Arch
      expect(s.currentLevelIndex).toBe(1);
      expect(LEVELS[s.currentLevelIndex].vehicle.name).toBe("Heavy Cargo Hauler");
      expect(s.vehicle.vx).toBe(72);

      selectLevel(s, 4); // Devil's Gorge
      expect(s.currentLevelIndex).toBe(4);
      expect(LEVELS[s.currentLevelIndex].vehicle.type).toBe("monster");
    });

    it("simulates real 2D bridge: unsupported deck collapses under vehicle", () => {
      const s = createBridgeState(Math.random, 0);
      buildAutoDeck(s); // Only flat road without supporting trusses
      startTest(s);

      // Run simulation for several seconds
      run(s, 4);

      // Under the heavy downward weight with no supporting truss, bridge or vehicle collapses
      expect(s.snapped || s.vehicle.inWater).toBe(true);
    });

    it("simulates real 2D bridge: triangulated truss safely holds vehicle", () => {
      const s = createBridgeState(Math.random, 0); // Level 1: Pine Valley (gap 80 to 280, road Y=160)
      buildAutoDeck(s);

      // Add triangular under-truss struts connected to cliff anchors
      const leftLow = s.nodes.find((n) => n.id === "a_left_low")!;
      const rightLow = s.nodes.find((n) => n.id === "a_right_low")!;

      // Find road nodes
      const roadNodes = s.nodes.filter((n) => n.isRoadNode).sort((a, b) => a.x - b.x);

      // Create bottom truss joint at (180, 210)
      const bottomTruss = addNode(s, 180, 215);

      // Connect bottom truss to cliff supports
      addMember(s, leftLow.id, bottomTruss.id, "steel");
      addMember(s, rightLow.id, bottomTruss.id, "steel");

      // Connect road joints to bottom truss and cliff anchors
      for (const rn of roadNodes) {
        if (rn.x <= 130) {
          addMember(s, leftLow.id, rn.id, "wood");
        }
        if (rn.x >= 230) {
          addMember(s, rightLow.id, rn.id, "wood");
        }
        addMember(s, bottomTruss.id, rn.id, "steel");
      }

      startTest(s);
      run(s, 8);

      // console.log debug
      console.log("FINAL TEST STATE:", {
        truckX: s.truckX,
        snapped: s.snapped,
        success: s.success,
        simulating: s.simulating,
        inWater: s.vehicle.inWater,
        grounded: s.vehicle.grounded,
        vY: s.vehicle.y,
        peakStress: s.peakStressEncountered,
        membersCount: s.members.length,
        broken: s.members.filter((m) => m.isBroken).map((m) => m.id),
      });

      // Well-engineered truss successfully holds and crosses
      expect(s.success).toBe(true);
      expect(s.snapped).toBe(false);
      expect(s.starsEarned).toBeGreaterThanOrEqual(1);
    });
  });
});
