import * as THREE from "three";

/**
 * AAA-Grade Photorealistic PBR Vehicle Models & Kinematics.
 *
 * Specific Realistic Models:
 * - ECLIPSE GT: Sleek Gran Turismo coupe with dual hood vents, fastback roof, BBS rims, ducktail spoiler, twin exhausts.
 * - THUNDER V10: Mid-engine wedge supercar with side radiator scoops, glass engine cover showing V10 engine block, quad exhausts.
 * - PHANTOM RS: Track hypercar with swan-neck carbon GT3 wing, roof snorkel scoop, carbon dive planes, ceramic brakes.
 * - VELOCITY X: Le Mans Prototype racer with bubble canopy, central shark fin, enclosed widebody arches, aerodisc wheels.
 * - INFERNO ZX: Extreme hypercar with stealth angles, multi-tier aero flaps, glowing underglow, hexagonal afterburners.
 *
 * Specific Realistic Bikes:
 * - RAPTOR 900 / APEX: Agile supersport with aerodynamic fairings, crystal twin headlights, upswept exhaust, 3D leaning rider.
 * - NIGHTHAWK 1000: Superbike with carbon winglets, gold USD inverted forks, single-sided swingarm.
 * - PHOENIX ZX: Factory MotoGP prototype with red trellis subframe, carbon swingarm, titanium exhaust.
 * - SHADOW PHANTOM: Cyber drag bike with stretched low frame, wide rear drag slick, LED halo headlight.
 * - TEMPEST EVO: Extreme electric hyperbike with hubless centerless glowing wheels and stator coils.
 */

/**
 * Where the wheels are, and how big they are.
 *
 * Shared so the fender arches and the wheels themselves cannot drift apart:
 * they were authored separately once, and the arches ended up 20cm behind the
 * tyres they were supposed to be wrapping.
 */
export const WHEEL_RADIUS = 0.36;
/**
 * [z along the car, x from the centre line] for the front and rear axles.
 *
 * Chosen so the outer face of the tyre sits just inside the bodywork. The
 * bodies are 1.92-2.10 wide, i.e. +-0.96 to +-1.05, and a 0.32-wide wheel
 * centred at 1.02 puts its outer edge at 1.18 — sticking 22cm proud of the
 * car on each side. That single number was most of why the models read as
 * go-karts rather than cars: real wheels tuck under the arches.
 */
export const WHEEL_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [1.35, 0.82],
  [-1.25, 0.84],
];

export interface VehicleRig {
  group: THREE.Group;
  /** The part that leans and pitches. */
  chassis: THREE.Group;
  wheels: THREE.Group[];
  /** Front wheels that steer. */
  steeringWheels: THREE.Group[];
  /**
   * Rolling radius, so wheels turn at the rate the ground is passing under
   * them. A fixed divisor makes big wheels visibly slip and small ones spin
   * like a cartoon.
   */
  wheelRadius: number;
  /**
   * Each wheel's resting height and which corner it is on, so suspension can
   * push it up and down relative to the body. Index-matched to `wheels`.
   */
  wheelRest: Array<{ y: number; front: boolean; side: number }>;
  /** Where nitro flame and exhaust smoke originate. */
  exhausts: THREE.Object3D[];
  brakeLights: THREE.MeshStandardMaterial;
  headlight: THREE.PointLight;
  headlightBeams?: THREE.Group;
  shadowMesh?: THREE.Mesh;
  isBike: boolean;
  rider?: THREE.Group;
}

// ─────────────────────────────────────────────────────────────────
// PBR MATERIAL PALETTE
// ─────────────────────────────────────────────────────────────────
const TYRE = new THREE.MeshStandardMaterial({
  color: 0x111317,
  roughness: 0.88,
  metalness: 0.08,
});

const RIM_CHROME = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  roughness: 0.12,
  metalness: 0.95,
});

const RIM_GOLD = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  roughness: 0.15,
  metalness: 0.92,
});

const BRAKE_DISC = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  roughness: 0.28,
  metalness: 0.92,
});

const BRAKE_CALIPER_RED = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  roughness: 0.25,
  metalness: 0.75,
});

const BRAKE_CALIPER_YELLOW = new THREE.MeshStandardMaterial({
  color: 0xfacc15,
  roughness: 0.25,
  metalness: 0.75,
});

const CARBON_FIBER = new THREE.MeshStandardMaterial({
  color: 0x0f1117,
  roughness: 0.35,
  metalness: 0.75,
});

const TINTED_GLASS = new THREE.MeshStandardMaterial({
  color: 0x060913,
  roughness: 0.04,
  metalness: 0.92,
  transparent: true,
  opacity: 0.85,
});

const CHROME_EXHAUST = new THREE.MeshStandardMaterial({
  color: 0xcfd8e3,
  roughness: 0.08,
  metalness: 0.96,
});

const TITANIUM_BLUE_EXHAUST = new THREE.MeshStandardMaterial({
  color: 0x0284c7,
  roughness: 0.12,
  metalness: 0.92,
});

const ENGINE_METAL = new THREE.MeshStandardMaterial({
  color: 0x475569,
  roughness: 0.35,
  metalness: 0.88,
});

const ENGINE_RED = new THREE.MeshStandardMaterial({
  color: 0xdc2626,
  roughness: 0.3,
  metalness: 0.6,
});

const HEADLIGHT_LENS = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: new THREE.Color(0xd6f4ff),
  emissiveIntensity: 4.5,
  roughness: 0.05,
  metalness: 0.3,
});

const SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.65,
  depthWrite: false,
});

/**
 * Builds extruded & tapered polygon parts for aerodynamic automotive styling.
 */
/**
 * A car body built from its side profile, rather than from stacked boxes.
 *
 * This is the difference between "a vehicle" and "a car". Every panel here used
 * to be a `BoxGeometry`, which means every silhouette was a staircase of
 * rectangles: flat slab, flat roof, hard step down to the boot. A real car is
 * one continuous line from bumper to bumper — the hood rises over the front
 * axle, rakes into the windscreen, peaks at the roof and falls away to the
 * tail, and the eye reads that curve as "car" long before it registers any
 * detail.
 *
 * So the shell is a single extrusion of that outline across the car's width,
 * with a bevel doing the work of the soft edges a real body has. Points run
 * nose-to-tail along +z with y up, which is the same frame the rest of this
 * file uses.
 */
function buildBodyShell(
  profile: Array<[number, number]>,
  width: number,
  material: THREE.Material,
  bevel = 0.09,
): THREE.Mesh {
  /*
   * Rounds every corner by running a quadratic *through* it.
   *
   * The control point has to be the vertex being rounded, with the curve
   * spanning midpoint-to-midpoint of the two edges that meet there. Passing the
   * previous point as the control instead — which is what this did at first —
   * puts the control on top of the curve's own start, and a quadratic whose
   * control point is its start point is a straight line. The result was a
   * faceted polyline wearing the word "curve": every body still had a flat top
   * and hard corners, which is exactly the look this was meant to replace.
   */
  const shape = new THREE.Shape();
  const at = (i: number) => profile[(i + profile.length) % profile.length]!;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];

  const first = mid(at(0), at(1));
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i <= profile.length; i++) {
    const corner = at(i);
    const next = mid(corner, at(i + 1));
    shape.quadraticCurveTo(corner[0], corner[1], next[0], next[1]);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 12,
  });

  /*
   * Shape space is (x = along the car, y = up), extruded along +z. The car
   * wants (z = along the car, y = up, x = across), so the solid is turned a
   * quarter turn and re-centred.
   *
   * The turn is -90 and not +90: (x,y,z) -> (-z, y, x) puts the nose at +z,
   * where the rest of this file expects it. Turning the other way builds the
   * same shell facing backwards, which is subtle enough on a symmetrical mesh
   * to miss and obvious the moment the headlights point at the camera behind.
   *
   * The extrusion then spans x from -depth to 0, so it shifts back by half its
   * depth to straddle the centre line rather than sit entirely on one side.
   */
  const depth = width - bevel * 2;
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(depth / 2, 0, 0);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * The arch over a wheel.
 *
 * Without one the body is a slab floating above four cylinders. A real fender
 * wraps the tyre, and the shadowed gap between arch and tread is most of what
 * sells the wheel as being *in* the car rather than beside it.
 */
function buildFenderArch(
  radius: number,
  width: number,
  material: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.TorusGeometry(radius, radius * 0.17, 8, 16, Math.PI);
  geometry.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.z = 1.05;
  mesh.scale.x = width;
  mesh.castShadow = true;
  return mesh;
}

function taperedBox(
  width: number,
  height: number,
  depth: number,
  frontScaleX: number,
  frontScaleY: number,
  material: THREE.Material
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    if (position.getZ(i) > 0) {
      position.setX(i, position.getX(i) * frontScaleX);
      position.setY(i, position.getY(i) * frontScaleY);
    }
  }
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

/**
 * Creates high-detail forged alloy wheel with multi-spoke pattern, deep rim lip, drilled rotor, and caliper.
 */
function buildForgedPerformanceWheel(
  radius: number,
  width: number,
  rimStyle: "bbs" | "star" | "aerodisc" | "gold" = "star",
  caliperMat: THREE.MeshStandardMaterial = BRAKE_CALIPER_RED
): THREE.Group {
  const wheel = new THREE.Group();

  // 1. Rubber Tire with rounded tread profile
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), TYRE);
  tyre.rotation.z = Math.PI / 2;
  wheel.add(tyre);

  const rimMat = rimStyle === "gold" ? RIM_GOLD : RIM_CHROME;

  // 2. Chrome Outer & Inner Rim Lips
  for (const side of [-1, 1]) {
    const rimLip = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.74, radius * 0.74, width * 0.1, 20),
      rimMat
    );
    rimLip.rotation.z = Math.PI / 2;
    rimLip.position.x = side * (width / 2 + 0.005);
    wheel.add(rimLip);
  }

  // 3. Spoke Pattern
  if (rimStyle === "aerodisc") {
    // Solid aerodynamic carbon disc with cooling slots
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, width * 0.88, 24),
      CARBON_FIBER
    );
    disc.rotation.z = Math.PI / 2;
    wheel.add(disc);
    // Outer accent ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.65, radius * 0.04, 8, 24),
      RIM_CHROME
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = width * 0.45;
    wheel.add(ring);
  } else if (rimStyle === "bbs") {
    // 10-spoke GT wire mesh
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.84, radius * 1.35, radius * 0.05),
        rimMat
      );
      spoke.rotation.x = angle;
      wheel.add(spoke);
    }
  } else {
    // Forged 5-spoke star
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.82, radius * 1.32, radius * 0.08),
        rimMat
      );
      spoke.rotation.x = angle;
      wheel.add(spoke);
    }
  }

  // Center Hub Cap
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width * 0.9, 14), CARBON_FIBER);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);

  // 4. Slotted Brake Rotor
  const rotor = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width * 0.06, 18),
    BRAKE_DISC
  );
  rotor.rotation.z = Math.PI / 2;
  wheel.add(rotor);

  // 5. Brembo Caliper
  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.45, radius * 0.35, radius * 0.22),
    caliperMat
  );
  caliper.position.set(width * 0.14, radius * 0.4, 0);
  wheel.add(caliper);

  return wheel;
}

// ─────────────────────────────────────────────────────────────────
// 1. CAR MODEL BUILDERS
// ─────────────────────────────────────────────────────────────────

/**
 * 1. ECLIPSE GT: Sleek Gran Turismo sports coupe with dual hood scoops, fastback roof, BBS rims, ducktail spoiler.
 */
/**
 * Fittings every car has, added once in the shared build path.
 *
 * These were left to each model to remember, and three of the five forgot:
 * Phantom RS, Velocity X and Inferno ZX had no headlights at all, and only
 * Eclipse GT had mirrors. From behind that reads as a car with one light in
 * the wrong place rather than a car with none, which is why it looked like the
 * lamps were mispositioned.
 *
 * Symmetry is the whole point. Headlights are placed as a mirrored pair about
 * the centre line, so no car can end up with one lamp on one corner.
 */
function addStandardFittings(
  chassis: THREE.Group,
  BODY: THREE.MeshStandardMaterial,
  options: { noseZ: number; noseY: number; mirrorZ: number; mirrorY: number },
): void {
  // Headlights: a mirrored pair, always.
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.26), HEADLIGHT_LENS);
    lamp.position.set(side * 0.62, options.noseY, options.noseZ);
    lamp.rotation.x = -0.1;
    chassis.add(lamp);
  }

  // Wing mirrors, on stalks so they read as mirrors rather than lumps.
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8), CARBON_FIBER);
    stalk.rotation.z = Math.PI / 2;
    stalk.position.set(side * 0.92, options.mirrorY, options.mirrorZ);
    chassis.add(stalk);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.1), BODY);
    housing.position.set(side * 1.03, options.mirrorY + 0.01, options.mirrorZ);
    housing.rotation.y = side * 0.28;
    chassis.add(housing);

    // The glass, angled back towards the driver.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.08), TINTED_GLASS);
    glass.position.set(side * 1.1, options.mirrorY + 0.01, options.mirrorZ - 0.01);
    glass.rotation.y = side * 0.28;
    chassis.add(glass);
  }
}

function buildEclipseGTModel(BODY: THREE.MeshStandardMaterial, BRAKE_LIGHT_MAT: THREE.MeshStandardMaterial, chassis: THREE.Group, exhausts: THREE.Object3D[]) {
  /*
   * The side profile, nose (+z) to tail (-z).
   *
   * Read it as a line drawing: the splitter sits low at the front, the nose
   * lifts over the front axle, the hood runs long and slightly domed, the
   * windscreen rakes hard into a low roof, and the fastback falls away in one
   * unbroken sweep to the ducktail. That single curve is what reads as a
   * grand tourer; the vents and lights below are only detail on top of it.
   */
  const shell = buildBodyShell(
    [
      [2.55, 0.16],   // splitter lip
      [2.52, 0.40],   // nose
      [2.20, 0.52],   // over the front axle
      [1.30, 0.56],   // hood, gently domed
      [0.55, 0.60],   // cowl
      [0.10, 0.98],   // base of the windscreen
      [-0.45, 1.14],  // roof leading edge
      [-1.05, 1.10],  // roof trailing edge
      [-1.85, 0.78],  // fastback
      [-2.20, 0.62],  // ducktail
      [-2.30, 0.34],  // tail panel
      [-2.24, 0.16],  // diffuser lip
      [-1.60, 0.12],  // floor
      [1.60, 0.12],
    ],
    1.92,
    BODY,
  );
  shell.position.set(0, 0, 0);
  chassis.add(shell);

  // Fender arches, so the wheels sit in the body rather than beside it.
  // Arches sit over the wheels, at the wheel positions and scaled to the
  // tyre. Authoring them at invented coordinates leaves the arch hovering
  // beside the wheel, which reads worse than having no arch at all.
  for (const [z, x] of WHEEL_ANCHORS) {
    for (const side of [-1, 1]) {
      const arch = buildFenderArch(WHEEL_RADIUS * 1.22, 0.3, BODY);
      arch.position.set(side * x, 0.42, z);
      chassis.add(arch);
    }
  }

  // Greenhouse: glass follows the same rake as the shell, inset so the pillars
  // read as body colour either side of it.
  const glass = buildBodyShell(
    [
      [0.12, 0.96],
      [-0.45, 1.12],
      [-1.05, 1.08],
      [-1.70, 0.80],
      [-1.70, 0.66],
      [0.12, 0.62],
    ],
    1.34,
    TINTED_GLASS,
    0.04,
  );
  chassis.add(glass);

  // Twin hood vents.
  for (const x of [-0.35, 0.35]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.5), CARBON_FIBER);
    vent.position.set(x, 0.6, 1.55);
    chassis.add(vent);
  }

  // Front splitter.
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.05, 0.5), CARBON_FIBER);
  splitter.position.set(0, 0.13, 2.42);
  chassis.add(splitter);

  // Side sills, which give the flank a shadow line instead of a flat wall.
  for (const side of [-1, 1]) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 2.2), CARBON_FIBER);
    sill.position.set(side * 0.95, 0.2, 0);
    chassis.add(sill);
  }

  // Ducktail lip.
  const ducktail = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 0.26), BODY);
  ducktail.position.set(0, 0.68, -2.1);
  ducktail.rotation.x = -0.3;
  chassis.add(ducktail);

  // Rear diffuser.
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.13, 0.42), CARBON_FIBER);
  diffuser.position.set(0, 0.15, -2.1);
  chassis.add(diffuser);

  // Full-width taillight bar.
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.06), BRAKE_LIGHT_MAT);
  lightBar.position.set(0, 0.54, -2.3);
  chassis.add(lightBar);

  // Twin polished exhausts.
  for (const x of [-0.38, 0.38]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.28, 14), CHROME_EXHAUST);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.25, -2.2);
    chassis.add(pipe);

    const nozzle = new THREE.Object3D();
    nozzle.position.set(x, 0.25, -2.35);
    chassis.add(nozzle);
    exhausts.push(nozzle);
  }
}

/**
 * 2. THUNDER V10: Mid-engine Italian wedge supercar with side radiator air scoops, glass rear engine cover, V10 engine block.
 */
function buildThunderV10Model(BODY: THREE.MeshStandardMaterial, BRAKE_LIGHT_MAT: THREE.MeshStandardMaterial, chassis: THREE.Group, exhausts: THREE.Object3D[]) {
  /*
   * A mid-engine wedge: the defining line is a single unbroken rise from a nose
   * almost touching the road to a cabin set unusually far forward, then a flat
   * engine deck and a tail chopped off vertically. Nothing here is a stack of
   * slabs, because a wedge with a step in it stops being a wedge.
   */
  const shell = buildBodyShell(
    [
      [2.60, 0.14], [2.56, 0.30],   // knife-edge nose
      [1.70, 0.42], [0.90, 0.58],   // the long rise
      [0.62, 0.94],                 // windscreen base, set forward
      [0.05, 1.08], [-0.75, 1.02],  // low cabin roof
      [-1.15, 0.76],                // drop onto the engine deck
      [-2.10, 0.70],                // flat deck over the V10
      [-2.24, 0.34], [-2.20, 0.14], // Kamm tail, cut vertically
      [-1.60, 0.16], [1.60, 0.16],
    ],
    1.98,
    BODY,
  );
  chassis.add(shell);

  // Arches sit over the wheels, at the wheel positions and scaled to the
  // tyre. Authoring them at invented coordinates leaves the arch hovering
  // beside the wheel, which reads worse than having no arch at all.
  for (const [z, x] of WHEEL_ANCHORS) {
    for (const side of [-1, 1]) {
      const arch = buildFenderArch(WHEEL_RADIUS * 1.22, 0.3, BODY);
      arch.position.set(side * x, 0.38, z);
      chassis.add(arch);
    }
  }

  // Angular Radiator Air Scoops
  for (const x of [-1.02, 1.02]) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.8), CARBON_FIBER);
    scoop.position.set(x, 0.38, -0.2);
    chassis.add(scoop);
  }

  // Glazing follows the same rake as the shell, inset so the pillars read as body.
  const cabin = buildBodyShell(
    [[0.64, 0.92], [0.05, 1.06], [-0.75, 1.00], [-0.95, 0.74], [0.64, 0.66]],
    1.3,
    TINTED_GLASS,
    0.04,
  );
  chassis.add(cabin);

  // Transparent Glass Engine Deck
  const engineGlass = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 1.1), TINTED_GLASS);
  engineGlass.position.set(0, 0.62, -1.25);
  chassis.add(engineGlass);

  // 3D V10 Engine Block inside
  const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.9), ENGINE_METAL);
  engineBlock.position.set(0, 0.44, -1.25);
  chassis.add(engineBlock);

  // Red V10 Cylinder Heads
  for (const x of [-0.22, 0.22]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.8), ENGINE_RED);
    head.position.set(x, 0.55, -1.25);
    chassis.add(head);
  }

  // Quad Square Exhausts
  for (const x of [-0.48, -0.24, 0.24, 0.48]) {
    const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.26), CHROME_EXHAUST);
    pipe.position.set(x, 0.34, -2.22);
    chassis.add(pipe);

    const nozzle = new THREE.Object3D();
    nozzle.position.set(x, 0.34, -2.35);
    chassis.add(nozzle);
    exhausts.push(nozzle);
  }

  // Angular Taillights
  for (const x of [-0.65, 0.65]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.08), BRAKE_LIGHT_MAT);
    tl.position.set(x, 0.48, -2.2);
    chassis.add(tl);
  }
}

/**
 * 3. PHANTOM RS: Track hypercar with high swan-neck carbon GT3 wing, roof snorkel, carbon dive planes, ceramic brakes.
 */
function buildPhantomRSModel(BODY: THREE.MeshStandardMaterial, BRAKE_LIGHT_MAT: THREE.MeshStandardMaterial, chassis: THREE.Group, exhausts: THREE.Object3D[]) {
  /*
   * Track car, so the silhouette is deliberately blunter than a road car: a
   * flat floor, a short hard rise at the screen and a long flat roof. Homologated
   * racers look like this because the cabin is a safety cell, not styling.
   */
  const shell = buildBodyShell(
    [
      [2.58, 0.14], [2.54, 0.34],
      [2.10, 0.48], [1.00, 0.50],   // flat, low hood
      [0.55, 0.56],
      [0.20, 1.00],                 // steep screen
      [-0.40, 1.14], [-1.10, 1.12], // long flat roof
      [-1.80, 0.86],
      [-2.20, 0.66], [-2.28, 0.32], [-2.22, 0.14],
      [-1.60, 0.16], [1.60, 0.16],
    ],
    2.02,
    BODY,
  );
  chassis.add(shell);

  // Arches sit over the wheels, at the wheel positions and scaled to the
  // tyre. Authoring them at invented coordinates leaves the arch hovering
  // beside the wheel, which reads worse than having no arch at all.
  for (const [z, x] of WHEEL_ANCHORS) {
    for (const side of [-1, 1]) {
      const arch = buildFenderArch(WHEEL_RADIUS * 1.22, 0.32, BODY);
      arch.position.set(side * x, 0.4, z);
      chassis.add(arch);
    }
  }

  // Extended Splitter & Dive Planes
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.07, 0.7), CARBON_FIBER);
  splitter.position.set(0, 0.12, 2.55);
  chassis.add(splitter);

  for (const x of [-1.08, 1.08]) {
    const canard1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.35), CARBON_FIBER);
    canard1.position.set(x, 0.24, 2.48);
    chassis.add(canard1);
  }

  const cabin = buildBodyShell(
    [[0.22, 0.98], [-0.40, 1.12], [-1.10, 1.10], [-1.60, 0.86], [-1.60, 0.70], [0.22, 0.66]],
    1.34,
    TINTED_GLASS,
    0.04,
  );
  chassis.add(cabin);

  // Roof Snorkel Air Intake
  const snorkel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.7), CARBON_FIBER);
  snorkel.position.set(0, 1.08, -0.15);
  snorkel.rotation.x = -0.22;
  chassis.add(snorkel);

  // High-Mount Swan-Neck Carbon GT3 Wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.06, 0.52), CARBON_FIBER);
  wing.position.set(0, 1.06, -2.1);
  chassis.add(wing);

  // Swan Neck Mounts
  for (const x of [-0.55, 0.55]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.32), CARBON_FIBER);
    mount.position.set(x, 0.82, -1.95);
    chassis.add(mount);
  }

  // Wing Endplates
  for (const x of [-1.09, 1.09]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.6), CARBON_FIBER);
    ep.position.set(x, 1.06, -2.1);
    chassis.add(ep);
  }

  // High-exit Twin Titanium Exhausts
  for (const x of [-0.22, 0.22]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 14), TITANIUM_BLUE_EXHAUST);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.45, -2.22);
    chassis.add(pipe);

    const nozzle = new THREE.Object3D();
    nozzle.position.set(x, 0.45, -2.35);
    chassis.add(nozzle);
    exhausts.push(nozzle);
  }

  // LED Taillight Strip
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.07, 0.08), BRAKE_LIGHT_MAT);
  lightBar.position.set(0, 0.54, -2.18);
  chassis.add(lightBar);
}

/**
 * 4. VELOCITY X: Le Mans LMP Prototype racer with bubble canopy, central aerodynamic shark fin, enclosed wheel arches.
 */
function buildVelocityXModel(BODY: THREE.MeshStandardMaterial, BRAKE_LIGHT_MAT: THREE.MeshStandardMaterial, chassis: THREE.Group, exhausts: THREE.Object3D[]) {
  /*
   * Prototype proportions: an unusually long flat nose, a canopy that sits
   * proud of the bodywork rather than being blended into it, and rear haunches
   * standing taller than the nose over the drivetrain. Those three facts are
   * what separate an LMP silhouette from a road car's.
   */
  const shell = buildBodyShell(
    [
      [2.70, 0.12], [2.66, 0.26],
      [2.00, 0.34], [0.80, 0.36],   // the long flat nose
      [0.30, 0.44],
      [-0.60, 0.56],
      [-1.30, 0.82],                // haunches rise over the drivetrain
      [-2.10, 0.86],
      [-2.34, 0.44], [-2.28, 0.18],
      [-1.70, 0.16], [1.70, 0.16],
    ],
    2.10,
    BODY,
  );
  chassis.add(shell);

  // Arches sit over the wheels, at the wheel positions and scaled to the
  // tyre. Authoring them at invented coordinates leaves the arch hovering
  // beside the wheel, which reads worse than having no arch at all.
  for (const [z, x] of WHEEL_ANCHORS) {
    for (const side of [-1, 1]) {
      const arch = buildFenderArch(WHEEL_RADIUS * 1.22, 0.34, BODY);
      arch.position.set(side * x, 0.34, z);
      chassis.add(arch);
    }
  }

  // Bubble Fighter-Jet Canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), TINTED_GLASS);
  canopy.scale.set(0.9, 0.72, 1.8);
  canopy.position.set(0, 0.65, 0.2);
  chassis.add(canopy);

  // Central Aerodynamic Shark Fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 2.2), CARBON_FIBER);
  fin.position.set(0, 0.82, -1.05);
  chassis.add(fin);

  // Full-Width LMP Rear Wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.05, 0.48), CARBON_FIBER);
  wing.position.set(0, 0.94, -2.15);
  chassis.add(wing);

  // Massive Venturi Diffuser
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.16, 0.65), CARBON_FIBER);
  diffuser.position.set(0, 0.14, -2.25);
  chassis.add(diffuser);

  // Vertical Fin Taillights
  for (const x of [-1.02, 1.02]) {
    const vLight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.08), BRAKE_LIGHT_MAT);
    vLight.position.set(x, 0.62, -2.26);
    chassis.add(vLight);
  }

  // Dual Central Exhausts
  for (const x of [-0.18, 0.18]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 14), TITANIUM_BLUE_EXHAUST);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.35, -2.28);
    chassis.add(pipe);

    const nozzle = new THREE.Object3D();
    nozzle.position.set(x, 0.35, -2.4);
    chassis.add(nozzle);
    exhausts.push(nozzle);
  }
}

/**
 * 5. INFERNO ZX: Extreme hypercar with stealth angles, multi-tier active aero flaps, glowing underglow, hexagonal afterburners.
 */
function buildInfernoZXModel(BODY: THREE.MeshStandardMaterial, BRAKE_LIGHT_MAT: THREE.MeshStandardMaterial, chassis: THREE.Group, exhausts: THREE.Object3D[]) {
  /*
   * Stealth car, so this one gets a much tighter bevel than the others. The
   * rounding that makes a GT look expensive is exactly what would destroy a
   * faceted shape — here the edges should stay sharp enough to catch a hard
   * highlight.
   */
  const shell = buildBodyShell(
    [
      [2.62, 0.12], [2.58, 0.28],
      [2.20, 0.40], [1.20, 0.44],
      [0.70, 0.52],
      [0.25, 0.96],
      [-0.35, 1.06], [-1.00, 0.98],
      [-1.70, 0.72],
      [-2.20, 0.60], [-2.32, 0.30], [-2.26, 0.12],
      [-1.65, 0.08], [1.65, 0.08],
    ],
    2.08,
    BODY,
    0.04,
  );
  chassis.add(shell);

  // Arches sit over the wheels, at the wheel positions and scaled to the
  // tyre. Authoring them at invented coordinates leaves the arch hovering
  // beside the wheel, which reads worse than having no arch at all.
  for (const [z, x] of WHEEL_ANCHORS) {
    for (const side of [-1, 1]) {
      const arch = buildFenderArch(WHEEL_RADIUS * 1.22, 0.32, BODY);
      arch.position.set(side * x, 0.38, z);
      chassis.add(arch);
    }
  }

  // Multi-tier Active Aero Flaps on Nose
  for (let i = 0; i < 3; i++) {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(1.6 - i * 0.3, 0.04, 0.25), CARBON_FIBER);
    flap.position.set(0, 0.36 + i * 0.08, 1.8 - i * 0.35);
    flap.rotation.x = -0.15;
    chassis.add(flap);
  }

  const cabin = buildBodyShell(
    [[0.27, 0.94], [-0.35, 1.04], [-1.00, 0.96], [-1.45, 0.72], [-1.45, 0.62], [0.27, 0.60]],
    1.3,
    TINTED_GLASS,
    0.03,
  );
  chassis.add(cabin);

  // Active Hydraulic Dual-Element Rear Wing
  const upperWing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.44), CARBON_FIBER);
  upperWing.position.set(0, 1.02, -2.15);
  chassis.add(upperWing);

  const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.32), CARBON_FIBER);
  lowerWing.position.set(0, 0.78, -2.05);
  chassis.add(lowerWing);

  // Glowing Hexagonal Afterburner Exhausts
  const hexMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: new THREE.Color(0xff4500),
    emissiveIntensity: 5.0,
  });

  for (const x of [-0.32, 0.32]) {
    const hexRing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.24, 6), hexMat);
    hexRing.rotation.x = Math.PI / 2;
    hexRing.position.set(x, 0.42, -2.25);
    chassis.add(hexRing);

    const nozzle = new THREE.Object3D();
    nozzle.position.set(x, 0.42, -2.38);
    chassis.add(nozzle);
    exhausts.push(nozzle);
  }

  // Angular Taillight Strip
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.08, 0.08), BRAKE_LIGHT_MAT);
  lightBar.position.set(0, 0.52, -2.24);
  chassis.add(lightBar);

  // Glowing Underglow Accent
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 3.8),
    new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })
  );
  underglow.rotation.x = Math.PI / 2;
  underglow.position.y = 0.08;
  chassis.add(underglow);
}

/**
 * Universal Car Builder with Model Dispatch.
 */
export function buildCar(colorHex: number, modelId?: string): VehicleRig {
  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);

  const BODY = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.1,
    metalness: 0.88,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 1.0,
    envMapIntensity: 2.8,
  });

  const BRAKE_LIGHT_MAT = new THREE.MeshStandardMaterial({
    color: 0xff0033,
    emissive: new THREE.Color(0xff0033),
    emissiveIntensity: 4.2,
    roughness: 0.05,
  });

  const exhausts: THREE.Object3D[] = [];

  const normId = (modelId || "").toLowerCase();
  let wheelStyle: "bbs" | "star" | "aerodisc" | "gold";
  let caliperMat = BRAKE_CALIPER_RED;

  if (normId.includes("eclipse") || normId.includes("gt")) {
    buildEclipseGTModel(BODY, BRAKE_LIGHT_MAT, chassis, exhausts);
    wheelStyle = "bbs";
  } else if (normId.includes("thunder") || normId.includes("v10")) {
    buildThunderV10Model(BODY, BRAKE_LIGHT_MAT, chassis, exhausts);
    wheelStyle = "star";
  } else if (normId.includes("phantom")) {
    buildPhantomRSModel(BODY, BRAKE_LIGHT_MAT, chassis, exhausts);
    wheelStyle = "star";
    caliperMat = BRAKE_CALIPER_YELLOW;
  } else if (normId.includes("velocity") || normId.includes("lmp")) {
    buildVelocityXModel(BODY, BRAKE_LIGHT_MAT, chassis, exhausts);
    wheelStyle = "aerodisc";
  } else if (normId.includes("inferno")) {
    buildInfernoZXModel(BODY, BRAKE_LIGHT_MAT, chassis, exhausts);
    wheelStyle = "star";
  } else {
    // Default to GT Model
    buildEclipseGTModel(BODY, BRAKE_LIGHT_MAT, chassis, exhausts);
    wheelStyle = "bbs";
  }

  // Lamps and mirrors, for whichever model was just built. Applied here rather
  // than per model so no car can ship without them again.
  addStandardFittings(chassis, BODY, { noseZ: 2.34, noseY: 0.46, mirrorZ: 0.32, mirrorY: 0.84 });

  // Real-time Headlight Point Light
  const headlight = new THREE.PointLight(0xd6f4ff, 4.0, 48, 1.2);
  headlight.position.set(0, 0.45, 3.2);
  chassis.add(headlight);

  // Drop Shadow
  const shadowGeo = new THREE.PlaneGeometry(2.4, 4.8);
  const shadowMesh = new THREE.Mesh(shadowGeo, SHADOW_MAT);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.03;
  group.add(shadowMesh);

  // 4 Forged Alloy Performance Wheels
  const wheels: THREE.Group[] = [];
  const steeringWheels: THREE.Group[] = [];
  const radius = WHEEL_RADIUS;
  const width = 0.32;
  const wheelRest: Array<{ y: number; front: boolean; side: number }> = [];

  // Built from the same anchors the fender arches use, so the two cannot
  // disagree about where a wheel is.
  for (const [z, x] of WHEEL_ANCHORS) {
    const front = z > 0;
    for (const side of [-1, 1]) {
      const w = buildForgedPerformanceWheel(radius, width, wheelStyle, caliperMat);
      w.position.set(side * x, radius, z);
      group.add(w);
      wheels.push(w);
      wheelRest.push({ y: radius, front, side });
      if (front) steeringWheels.push(w);
    }
  }

  return {
    group,
    chassis,
    wheels,
    steeringWheels,
    wheelRadius: radius,
    wheelRest,
    exhausts,
    brakeLights: BRAKE_LIGHT_MAT,
    headlight,
    shadowMesh,
    isBike: false,
  };
}

// ─────────────────────────────────────────────────────────────────
// 2. BIKE MODEL BUILDERS
// ─────────────────────────────────────────────────────────────────

/**
 * Universal Bike Builder with Model Dispatch & 3D Rider.
 */
export function buildBike(colorHex: number, modelId?: string): VehicleRig {
  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);

  const FAIRING = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.1,
    metalness: 0.88,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 1.0,
    envMapIntensity: 2.8,
  });

  const GOLD_FORK = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.14,
    metalness: 0.94,
  });

  const RIDER_SUIT = new THREE.MeshStandardMaterial({
    color: 0x14161f,
    roughness: 0.6,
    metalness: 0.3,
  });

  const RIDER_ACCENT = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.3,
    metalness: 0.6,
  });

  const HELMET_VISOR = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    roughness: 0.04,
    metalness: 0.98,
    emissive: new THREE.Color(0x06b6d4),
    emissiveIntensity: 0.6,
  });

  const BRAKE_LIGHT_MAT = new THREE.MeshStandardMaterial({
    color: 0xff0033,
    emissive: new THREE.Color(0xff0033),
    emissiveIntensity: 3.5,
    roughness: 0.1,
  });

  /*
   * Fairing, tank and tail as one shell.
   *
   * A sportbike's bodywork is a single line: a pointed nose fairing lifting to
   * the screen, falling into the tank, scooping down at the seat and kicking up
   * into the tail hump. It was three tapered boxes stacked at different heights,
   * which gives a stepped outline no motorcycle has.
   *
   * Narrow on purpose — 0.44 across. A bike is a blade seen from the front, and
   * widening the fairing to car-like proportions is the fastest way to make one
   * look like a toy.
   */
  const fairing = buildBodyShell(
    [
      [1.32, 0.74],   // nose tip, low and forward of the front wheel
      [1.26, 1.00],   // fairing front
      [1.02, 1.18],   // screen base
      [0.68, 1.12],   // over the top
      [0.28, 0.98],   // tank front
      [-0.12, 1.04],  // tank crown
      [-0.46, 0.90],  // seat scoop
      [-0.78, 1.00],  // tail hump
      [-1.06, 1.02],
      [-1.22, 0.84],  // tail cut, sharp
      [-1.02, 0.68],
      [0.40, 0.62],   // belly pan
      [1.12, 0.66],
    ],
    0.44,
    FAIRING,
    0.05,
  );
  chassis.add(fairing);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.4), TINTED_GLASS);
  screen.position.set(0, 1.15, 0.8);
  screen.rotation.x = -0.42;
  chassis.add(screen);

  // MotoGP Carbon Aero Winglets for Performance/Hyper bikes
  const normBikeId = (modelId || "").toLowerCase();
  if (normBikeId.includes("phoenix") || normBikeId.includes("nighthawk") || normBikeId.includes("zx")) {
    for (const x of [-0.28, 0.28]) {
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.24), CARBON_FIBER);
      winglet.position.set(x, 0.96, 0.82);
      winglet.rotation.z = x > 0 ? -0.2 : 0.2;
      chassis.add(winglet);
    }
  }

  // 2. Gold USD Inverted Telescopic Forks
  for (const x of [-0.14, 0.14]) {
    const fork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.86, 12),
      GOLD_FORK
    );
    fork.position.set(x, 0.64, 0.96);
    fork.rotation.x = 0.24;
    chassis.add(fork);
  }

  const frontMudguard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.48), CARBON_FIBER);
  frontMudguard.position.set(0, 0.54, 1.12);
  frontMudguard.rotation.x = 0.24;
  chassis.add(frontMudguard);

  // 3. Mechanical 4-Cylinder Engine Block
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.64), ENGINE_METAL);
  engine.position.set(0, 0.52, 0.1);
  chassis.add(engine);

  // 4. Exposed Racing Trellis Frame Rails
  for (const x of [-0.22, 0.22]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 1.1, 10),
      ENGINE_RED
    );
    rail.position.set(x, 0.72, 0.2);
    rail.rotation.x = 0.45;
    chassis.add(rail);
  }

  // 5. Lightweight Carbon Fiber Racing Seat Cowl
  const tail = taperedBox(0.34, 0.24, 0.95, 0.45, 0.55, FAIRING);
  tail.position.set(0, 0.95, -0.92);
  tail.rotation.x = -0.15;
  chassis.add(tail);

  const seatPad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.48), CARBON_FIBER);
  seatPad.position.set(0, 0.9, -0.45);
  chassis.add(seatPad);

  // 6. Swingarm
  const swingarm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.88), ENGINE_METAL);
  swingarm.position.set(0, 0.42, -0.74);
  swingarm.rotation.x = -0.15;
  chassis.add(swingarm);

  // 7. Upswept Titanium Race Exhaust
  const exhausts: THREE.Object3D[] = [];
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.65, 14), TITANIUM_BLUE_EXHAUST);
  pipe.position.set(0.22, 0.58, -0.85);
  pipe.rotation.x = 0.45;
  chassis.add(pipe);

  const nozzle = new THREE.Object3D();
  nozzle.position.set(0.22, 0.78, -1.1);
  chassis.add(nozzle);
  exhausts.push(nozzle);

  // 8. LED Headlights & Taillight
  const headlightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.08), HEADLIGHT_LENS);
  headlightMesh.position.set(0, 0.92, 1.25);
  chassis.add(headlightMesh);

  const brakeLightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.06), BRAKE_LIGHT_MAT);
  brakeLightMesh.position.set(0, 1.0, -1.35);
  chassis.add(brakeLightMesh);

  // 9. Fully Modeled 3D Leaning Rider
  const rider = new THREE.Group();
  chassis.add(rider);

  // Rider Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.52), RIDER_SUIT);
  torso.position.set(0, 1.22, -0.32);
  torso.rotation.x = 0.55;
  rider.add(torso);

  const spineProtector = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.08), RIDER_ACCENT);
  spineProtector.position.set(0, 1.25, -0.56);
  spineProtector.rotation.x = 0.55;
  rider.add(spineProtector);

  // Aerodynamic Helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), RIDER_ACCENT);
  helmet.scale.set(1.0, 1.1, 1.2);
  helmet.position.set(0, 1.52, 0.05);
  helmet.rotation.x = 0.35;
  rider.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.12), HELMET_VISOR);
  visor.position.set(0, 1.5, 0.2);
  rider.add(visor);

  // Rider Arms
  for (const x of [-0.22, 0.22]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.48, 10), RIDER_SUIT);
    arm.position.set(x, 1.18, 0.12);
    arm.rotation.x = -0.7;
    arm.rotation.z = x > 0 ? -0.3 : 0.3;
    rider.add(arm);
  }

  // 10. Real-time Headlight Point Light
  const headlight = new THREE.PointLight(0xd6f4ff, 4.0, 48, 1.2);
  headlight.position.set(0, 0.95, 2.5);
  chassis.add(headlight);

  // 11. Drop Shadow
  const shadowGeo = new THREE.PlaneGeometry(1.2, 3.2);
  const shadowMesh = new THREE.Mesh(shadowGeo, SHADOW_MAT);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.03;
  group.add(shadowMesh);

  // 12. Front & Rear Wheels
  const wheels: THREE.Group[] = [];
  const steeringWheels: THREE.Group[] = [];

  const frontWheel = buildForgedPerformanceWheel(0.32, 0.16, "star", BRAKE_CALIPER_RED);
  frontWheel.position.set(0, 0.32, 1.15);
  group.add(frontWheel);
  wheels.push(frontWheel);
  steeringWheels.push(frontWheel);

  const rearWheel = buildForgedPerformanceWheel(0.34, 0.24, "star", BRAKE_CALIPER_RED);
  rearWheel.position.set(0, 0.34, -1.15);
  group.add(rearWheel);
  wheels.push(rearWheel);

  /*
   * A bike's two wheels are different sizes and both sit on the centre line, so
   * `side` is 0: there is no left or right for roll to push against. Its lean
   * comes from the whole machine banking, not from one corner compressing.
   */
  const wheelRest = [
    { y: 0.32, front: true, side: 0 },
    { y: 0.34, front: false, side: 0 },
  ];

  return {
    group,
    chassis,
    wheels,
    steeringWheels,
    wheelRadius: 0.33,
    wheelRest,
    exhausts,
    brakeLights: BRAKE_LIGHT_MAT,
    headlight,
    shadowMesh,
    isBike: true,
    rider,
  };
}
