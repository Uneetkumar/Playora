import * as THREE from "three";

/**
 * Vehicle models.
 *
 * Built from primitives rather than loaded from a file: there is no licensed
 * model in this repo, and a car assembled from a dozen boxes reads as a car
 * from a chase camera far better than a downloaded mesh nobody owns.
 *
 * The one rule everything here follows is that motion must be *visible*. A
 * smooth dark cylinder spinning at ninety miles an hour looks completely still,
 * so every wheel gets a bright rim, spokes, and tread blocks that break its
 * silhouette. That is the whole difference between a car and a sliding box.
 */

export interface VehicleRig {
  group: THREE.Group;
  /** The part that leans and pitches. Wheels are outside it, on the ground. */
  chassis: THREE.Group;
  wheels: THREE.Group[];
  /** Front wheels, which also steer. */
  steeringWheels: THREE.Group[];
  /** Where nitro flame and exhaust smoke come from. */
  exhausts: THREE.Object3D[];
  brakeLights: THREE.MeshStandardMaterial;
  headlight: THREE.PointLight;
  isBike: boolean;
}

const TYRE = new THREE.MeshStandardMaterial({ color: 0x14101f, roughness: 0.9, metalness: 0.05 });
const RIM = new THREE.MeshStandardMaterial({
  color: 0xd8d8e8,
  roughness: 0.25,
  metalness: 0.85,
  emissive: new THREE.Color(0x4a4a6a),
  emissiveIntensity: 0.25,
});
const GLASS = new THREE.MeshStandardMaterial({
  color: 0x0d0a1c,
  roughness: 0.08,
  metalness: 0.6,
  transparent: true,
  opacity: 0.85,
});
const TRIM = new THREE.MeshStandardMaterial({ color: 0x1a1430, roughness: 0.5, metalness: 0.4 });
const HEADLIGHT = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: new THREE.Color(0xfff3c4),
  emissiveIntensity: 2.2,
});

/**
 * One wheel: tyre, rim, spokes and tread.
 *
 * The spokes and tread exist purely so the rotation can be seen. Without them a
 * wheel is a featureless ring of revolution and spinning it changes nothing on
 * screen — which is exactly why the first version looked like a box on rails.
 */
function buildWheel(radius: number, width: number): THREE.Group {
  const wheel = new THREE.Group();

  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), TYRE);
  tyre.rotation.z = Math.PI / 2;
  wheel.add(tyre);

  // Rim faces, inset slightly so the tyre reads as rubber around them.
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.12, 16),
      RIM,
    );
    rim.rotation.z = Math.PI / 2;
    rim.position.x = side * (width / 2 + 0.01);
    wheel.add(rim);
  }

  // Spokes. Five is enough to read as rotation without strobing.
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.75, radius * 1.15, radius * 0.15),
      RIM,
    );
    spoke.rotation.x = (i / 5) * Math.PI;
    wheel.add(spoke);
  }

  // Tread blocks around the circumference — the part visible from directly
  // behind, which is where the chase camera sits most of the time.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.04, radius * 0.16, radius * 0.3),
      TRIM,
    );
    tread.position.y = Math.sin(angle) * radius * 0.94;
    tread.position.z = Math.cos(angle) * radius * 0.94;
    tread.rotation.x = -angle;
    wheel.add(tread);
  }

  return wheel;
}

/** A tapered box, for a nose or a wedge. Front face narrower than the back. */
function taperedBox(
  width: number,
  height: number,
  depth: number,
  frontScale: number,
  material: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    // +z is the front of the vehicle; pinch those vertices inward.
    if (position.getZ(i) > 0) {
      position.setX(i, position.getX(i) * frontScale);
      position.setY(i, position.getY(i) * frontScale);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

export function buildCar(colour: number): VehicleRig {
  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);

  const paint = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.28,
    metalness: 0.55,
    emissive: new THREE.Color(colour),
    emissiveIntensity: 0.14,
  });

  // Lower body: wide and low, the part that reads as "car" in silhouette.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.3), paint);
  body.position.y = 0.72;
  chassis.add(body);

  // Bonnet, tapering towards the nose.
  const nose = taperedBox(1.9, 0.38, 1.5, 0.72, paint);
  nose.position.set(0, 0.86, 2.05);
  chassis.add(nose);

  // Cabin, set back, with a sloped windscreen in front of it.
  const cabin = taperedBox(1.6, 0.62, 1.9, 0.86, paint);
  cabin.position.set(0, 1.28, -0.25);
  chassis.add(cabin);

  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.55, 0.12), GLASS);
  windscreen.position.set(0, 1.3, 0.72);
  windscreen.rotation.x = -0.42;
  chassis.add(windscreen);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.1), GLASS);
  rearGlass.position.set(0, 1.3, -1.2);
  rearGlass.rotation.x = 0.38;
  chassis.add(rearGlass);

  // Side skirts, which stop the car looking like a slab from behind.
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 3.1), TRIM);
    skirt.position.set(side * 1.02, 0.52, -0.1);
    chassis.add(skirt);
  }

  // Rear wing on two struts.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.55), TRIM);
  wing.position.set(0, 1.45, -2.05);
  chassis.add(wing);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.16), TRIM);
    strut.position.set(side * 0.72, 1.24, -2.05);
    chassis.add(strut);
  }

  // Headlights, and one real light so the road ahead is lit.
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), HEADLIGHT);
    lamp.position.set(side * 0.6, 0.88, 2.74);
    chassis.add(lamp);
  }

  // Brake lights. The material is returned so braking can brighten them.
  const brakeLights = new THREE.MeshStandardMaterial({
    color: 0xff2b3d,
    emissive: new THREE.Color(0xff2b3d),
    emissiveIntensity: 0.9,
  });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.1), brakeLights);
    lamp.position.set(side * 0.62, 0.92, -2.18);
    chassis.add(lamp);
  }

  const exhausts: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.3, 10), TRIM);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.5, 0.5, -2.3);
    chassis.add(pipe);

    const anchor = new THREE.Object3D();
    anchor.position.set(side * 0.5, 0.5, -2.5);
    chassis.add(anchor);
    exhausts.push(anchor);
  }

  // Wheels sit on the group, not the chassis: the body leans and pitches, the
  // wheels stay on the road. That contrast is most of what sells the motion.
  const wheels: THREE.Group[] = [];
  const steeringWheels: THREE.Group[] = [];
  const layout: Array<[number, number, boolean]> = [
    [-1.02, 1.45, true],
    [1.02, 1.45, true],
    [-1.02, -1.5, false],
    [1.02, -1.5, false],
  ];

  for (const [x, z, isFront] of layout) {
    const wheel = buildWheel(0.58, 0.42);
    wheel.position.set(x, 0.58, z);
    group.add(wheel);
    wheels.push(wheel);
    if (isFront) steeringWheels.push(wheel);
  }

  const headlight = new THREE.PointLight(0xfff0d0, 2.4, 34, 1.6);
  headlight.position.set(0, 1.1, 3.4);
  group.add(headlight);

  return { group, chassis, wheels, steeringWheels, exhausts, brakeLights, headlight, isBike: false };
}

export function buildBike(colour: number): VehicleRig {
  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);

  const paint = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.3,
    metalness: 0.6,
    emissive: new THREE.Color(colour),
    emissiveIntensity: 0.16,
  });

  // Frame spine.
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 2.1), TRIM);
  spine.position.set(0, 0.86, 0);
  chassis.add(spine);

  // Fuel tank, the widest part and the one that reads as a motorbike.
  const tank = taperedBox(0.62, 0.5, 1.1, 0.78, paint);
  tank.position.set(0, 1.06, 0.35);
  chassis.add(tank);

  // Fairing over the front wheel.
  const fairing = taperedBox(0.6, 0.62, 1.0, 0.6, paint);
  fairing.position.set(0, 1.0, 1.15);
  chassis.add(fairing);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.08), GLASS);
  screen.position.set(0, 1.32, 1.35);
  screen.rotation.x = -0.6;
  chassis.add(screen);

  // Seat and tail.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.85), TRIM);
  seat.position.set(0, 1.08, -0.55);
  chassis.add(seat);

  const tail = taperedBox(0.4, 0.32, 0.7, 0.5, paint);
  tail.position.set(0, 1.16, -1.1);
  tail.rotation.y = Math.PI;
  chassis.add(tail);

  // Forks down to the front wheel.
  for (const side of [-1, 1]) {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.12), RIM);
    fork.position.set(side * 0.2, 0.95, 1.3);
    fork.rotation.x = 0.25;
    chassis.add(fork);
  }

  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), TRIM);
  bars.position.set(0, 1.42, 1.12);
  chassis.add(bars);

  // Rider. A bike without one looks abandoned, and the rider is also what
  // makes the lean legible from behind.
  const torso = taperedBox(0.42, 0.7, 0.4, 0.75, TRIM);
  torso.position.set(0, 1.5, -0.15);
  torso.rotation.x = -0.5;
  chassis.add(torso);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), paint);
  helmet.position.set(0, 1.86, 0.25);
  chassis.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.1), GLASS);
  visor.position.set(0, 1.88, 0.46);
  chassis.add(visor);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.8), TRIM);
    arm.position.set(side * 0.24, 1.52, 0.5);
    arm.rotation.x = 0.5;
    chassis.add(arm);
  }

  const brakeLights = new THREE.MeshStandardMaterial({
    color: 0xff2b3d,
    emissive: new THREE.Color(0xff2b3d),
    emissiveIntensity: 0.9,
  });
  const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), brakeLights);
  tailLamp.position.set(0, 1.2, -1.42);
  chassis.add(tailLamp);

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.08), HEADLIGHT);
  lamp.position.set(0, 1.12, 1.66);
  chassis.add(lamp);

  const exhausts: THREE.Object3D[] = [];
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.6, 10), TRIM);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(0.22, 0.6, -1.0);
  chassis.add(pipe);
  const anchor = new THREE.Object3D();
  anchor.position.set(0.22, 0.6, -1.35);
  chassis.add(anchor);
  exhausts.push(anchor);

  const wheels: THREE.Group[] = [];
  const steeringWheels: THREE.Group[] = [];

  const front = buildWheel(0.62, 0.2);
  front.position.set(0, 0.62, 1.42);
  group.add(front);
  wheels.push(front);
  steeringWheels.push(front);

  const rear = buildWheel(0.62, 0.26);
  rear.position.set(0, 0.62, -1.15);
  group.add(rear);
  wheels.push(rear);

  const headlight = new THREE.PointLight(0xfff0d0, 2.0, 30, 1.6);
  headlight.position.set(0, 1.2, 2.2);
  group.add(headlight);

  return { group, chassis, wheels, steeringWheels, exhausts, brakeLights, headlight, isBike: true };
}
