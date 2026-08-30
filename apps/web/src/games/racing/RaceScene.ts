import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildBike, buildCar, type VehicleRig } from "./vehicles";
import { ParticleField, SpeedLines } from "./effects";
import {
  ROAD_HALF_WIDTH,
  trackCenterline,
  trackToWorld,
  type RacingPlayerView,
  type TrackSpec,
  type VehicleState,
} from "@playora/game-engine";

/**
 * The look. Neon night city — a saturated magenta rail against a deep violet
 * road, which is what makes the sense of speed read at a glance.
 */
const PALETTE = {
  fog: 0x140a2e,
  skyTop: 0x2a1152,
  skyBottom: 0x3d1b6b,
  road: 0x3a1f63,
  roadEdge: 0x24123f,
  centreLine: 0x6b3fa8,
  railLeft: 0xff2fd0,
  railRight: 0xc026d3,
  runoff: 0x1e0f36,
  building: 0x1b0d38,
  window: 0x38e8ff,
  coin: 0xffc93c,
  cone: 0xff8a3d,
  block: 0x4ad6ff,
  barrier: 0xff4d6d,
};

const CAR_COLOURS = [0xff2b3d, 0x3ba7ff, 0x4ade80, 0xfbbf24, 0xa855f7, 0xf472b6, 0x22d3ee, 0xf97316];

/** Metres between road cross-sections. Lower is smoother and costs more. */
const ROAD_STEP = 10;

/**
 * Renders a race.
 *
 * Deliberately framework-free: it owns a canvas and a Three.js scene, and is
 * driven by `update(view)` from whatever is holding the game state. Keeping it
 * out of React means the render loop never causes a re-render, and sixty state
 * updates a second never touch the component tree — which is the difference
 * between a smooth race and a slideshow.
 *
 * The track is built once, from the seed the server sent. No geometry travels
 * over the network: both sides derive the same road from the same numbers.
 */
export class RaceScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private centerline: ReturnType<typeof trackCenterline> = [];
  private vehicles = new Map<string, VehicleRig>();
  private coinMeshes = new Map<string, THREE.Mesh>();
  private cameraTarget = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();
  private disposed = false;
  private isBike: boolean;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private particles: ParticleField | null = null;
  private speedLines: SpeedLines | null = null;
  private lastFrameAt = 0;
  /** Per-vehicle memory, for spotting the moment something happens. */
  private previous = new Map<string, { distance: number; crashTicks: number; coins: number }>();

  constructor(
    private canvas: HTMLCanvasElement,
    track: TrackSpec,
    options: { isBike?: boolean } = {},
  ) {
    this.isBike = options.isBike ?? false;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    // Capped at 2: beyond that the pixel count doubles for no visible gain on
    // a moving 3D scene, and it is the first thing to cost frames on a phone.
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));

    this.camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.5, 900);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 90, 620);
    this.scene.background = new THREE.Color(PALETTE.fog);

    this.centerline = trackCenterline(track, ROAD_STEP);

    this.buildLights();
    this.buildSky();
    this.buildRoad();
    this.buildRails();
    this.buildCity(track);
    this.buildObstacles(track);
    this.buildCoins(track);
    this.buildFinish();

    // Bloom. A neon night scene lives or dies on whether the emissive surfaces
    // actually glow: without it the rails, headlights, coins and nitro flame
    // are just brightly coloured polygons. Tuned low-threshold and modest
    // strength, so the road stays readable rather than washing out.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.42, // strength
      0.5, // radius
      // A high threshold on purpose. Low values bloom the road surface itself
      // and the whole frame washes to white — only lights, neon and the nitro
      // flame should glow, not everything they illuminate.
      0.62,
    );
    this.composer.addPass(this.bloom);
    // Converts back to the display colour space; without it the whole scene
    // comes out washed and pale once a composer is in the chain.
    this.composer.addPass(new OutputPass());

    this.particles = new ParticleField(this.scene);
    this.speedLines = new SpeedLines(this.camera);
    // The camera has children now, so it has to be in the scene graph for them
    // to be drawn at all.
    this.scene.add(this.camera);

    this.resize();
  }

  /** Adds or updates every vehicle, moves the camera, and draws a frame. */
  update(view: RacingPlayerView, followId: string | null): void {
    if (this.disposed) return;

    const now = performance.now();
    // Clamped: a backgrounded tab hands back a delta of many seconds, and the
    // effects would fire a whole race's worth of particles in one frame.
    const delta = this.lastFrameAt === 0 ? 1 / 60 : Math.min(0.1, (now - this.lastFrameAt) / 1000);
    this.lastFrameAt = now;

    view.vehicles.forEach((vehicle, index) => {
      const rig = this.vehicles.get(vehicle.playerId) ?? this.addVehicle(vehicle.playerId, index);
      this.placeVehicle(rig, vehicle, delta, view.tick);
    });

    for (const key of view.collectedCoins) {
      const mesh = this.coinMeshes.get(key);
      if (mesh && mesh.visible) mesh.visible = false;
    }

    this.spinCoins();

    const follow = followId ? view.vehicles.find((v) => v.playerId === followId) : view.vehicles[0];
    if (follow) this.followCamera(follow, view.racingPhase === "countdown");

    this.particles?.update(delta);
    this.speedLines?.update(delta, follow?.speed ?? 0, this.isBike ? 72 : 78);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (this.disposed) return;
    const width = this.canvas.clientWidth || 960;
    const height = this.canvas.clientHeight || 540;
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.bloom?.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.speedLines?.dispose();
    this.particles?.dispose();
    this.composer?.dispose();
    // Three does not free GPU memory on garbage collection: every geometry and
    // material has to be released by hand or a few restarts exhaust the context.
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------- geometry

  private buildLights(): void {
    this.scene.add(new THREE.AmbientLight(0xc4a5ff, 1.45));

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(-40, 80, 40);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(PALETTE.railLeft, 0.6);
    rim.position.set(40, 20, -30);
    this.scene.add(rim);
  }

  /** A gradient dome, so the horizon is not a flat wall of fog colour. */
  private buildSky(): void {
    const geometry = new THREE.SphereGeometry(800, 24, 16);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(PALETTE.skyTop) },
        bottom: { value: new THREE.Color(PALETTE.skyBottom) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 bottom;
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottom, top, h), 1.0);
        }`,
    });
    this.scene.add(new THREE.Mesh(geometry, material));
  }

  /**
   * The road surface, built as a ribbon from the same centreline the physics
   * uses. Two triangles per cross-section, with the runoff extending past the
   * drivable edge so leaving the tarmac is visible before it is punishing.
   */
  private buildRoad(): void {
    const half = ROAD_HALF_WIDTH;
    const positions: number[] = [];
    const indices: number[] = [];
    const runoffPositions: number[] = [];
    const runoffIndices: number[] = [];

    // The centreline plus its own first point again: the circuit is a loop, and
    // without the repeat there is a missing quad where the road meets itself.
    const ring = [...this.centerline, this.centerline[0]!];

    ring.forEach((point, i) => {
      const nx = Math.cos(point.heading);
      const nz = -Math.sin(point.heading);

      positions.push(point.x - nx * half, point.y, point.z - nz * half);
      positions.push(point.x + nx * half, point.y, point.z + nz * half);

      const wide = half * 1.35;
      runoffPositions.push(point.x - nx * wide, point.y - 0.05, point.z - nz * wide);
      runoffPositions.push(point.x + nx * wide, point.y - 0.05, point.z + nz * wide);

      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        runoffIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });

    this.scene.add(
      mesh(runoffPositions, runoffIndices, new THREE.MeshStandardMaterial({
        color: PALETTE.runoff, roughness: 1, metalness: 0, side: THREE.DoubleSide,
      })),
    );

    this.scene.add(
      mesh(positions, indices, new THREE.MeshStandardMaterial({
        // DoubleSide because the ribbon's computed normals point down: the
        // winding that makes a continuous strip also makes the surface face
        // away from the sky, and a single-sided road renders black.
        color: PALETTE.road, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide,
      })),
    );

    this.buildCentreLine();
  }

  /** Dashes down the middle — the strongest speed cue the scene has. */
  private buildCentreLine(): void {
    const geometry = new THREE.PlaneGeometry(0.5, 5);
    const material = new THREE.MeshBasicMaterial({
      color: PALETTE.centreLine,
      transparent: true,
      opacity: 0.55,
    });
    const dashes = new THREE.InstancedMesh(geometry, material, this.centerline.length);
    const matrix = new THREE.Matrix4();

    this.centerline.forEach((point, i) => {
      matrix.makeRotationX(-Math.PI / 2);
      matrix.setPosition(point.x, point.y + 0.02, point.z);
      const rotate = new THREE.Matrix4().makeRotationY(point.heading);
      matrix.premultiply(rotate.setPosition(point.x, point.y + 0.02, point.z));
      dashes.setMatrixAt(i, matrix);
    });
    dashes.instanceMatrix.needsUpdate = true;
    this.scene.add(dashes);
  }

  /** The glowing rails. Different colours left and right, so a glance orients you. */
  private buildRails(): void {
    for (const side of [-1, 1] as const) {
      const positions: number[] = [];
      const indices: number[] = [];
      const half = ROAD_HALF_WIDTH * 1.36;
      const height = 3.2;

      const ring = [...this.centerline, this.centerline[0]!];
      ring.forEach((point, i) => {
        const nx = Math.cos(point.heading) * side;
        const nz = -Math.sin(point.heading) * side;
        positions.push(point.x + nx * half, point.y, point.z + nz * half);
        positions.push(point.x + nx * half, point.y + height, point.z + nz * half);
        if (i > 0) {
          const a = (i - 1) * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });

      this.scene.add(
        mesh(positions, indices, new THREE.MeshBasicMaterial({
          color: side < 0 ? PALETTE.railLeft : PALETTE.railRight,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
        })),
      );
    }
  }

  /**
   * Skyline. Instanced boxes with emissive window strips.
   *
   * Instanced rather than individual meshes because there are a few hundred of
   * them and they never move: one draw call instead of several hundred.
   */
  private buildCity(track: TrackSpec): void {
    const count = Math.min(280, Math.floor(track.length / 12));
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: PALETTE.building,
      roughness: 0.95,
      emissive: new THREE.Color(PALETTE.window),
      // Barely lit. These are a silhouette behind the track, not a light
      // source: at any higher value they wash the whole frame teal.
      emissiveIntensity: 0.012,
    });
    const buildings = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();

    // Deterministic placement from the track seed, so the skyline is part of
    // the track rather than different on every reload.
    let seed = track.seed >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      const point = this.centerline[Math.floor(rand() * this.centerline.length)];
      if (!point) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const away = 70 + rand() * 220;
      const nx = Math.cos(point.heading) * side;
      const nz = -Math.sin(point.heading) * side;

      const width = 8 + rand() * 16;
      const height = 22 + rand() * 70;

      matrix.makeScale(width, height, width);
      matrix.setPosition(
        point.x + nx * away,
        height / 2 - 4,
        point.z + nz * away,
      );
      buildings.setMatrixAt(i, matrix);
    }
    buildings.instanceMatrix.needsUpdate = true;
    this.scene.add(buildings);
  }

  /**
   * Obstacles you can recognise before you hit them.
   *
   * Each is built from a few parts with a bright reflective band, because the
   * track is dark and an unlit grey box at ninety metres is invisible until it
   * is too late to avoid — which reads as an unfair game rather than a hard one.
   */
  private buildObstacles(track: TrackSpec): void {
    for (const obstacle of track.obstacles) {
      const position = this.worldPoint(obstacle.distance, obstacle.lateral);
      if (!position) continue;

      const item =
        obstacle.kind === "cone"
          ? buildCone()
          : obstacle.kind === "block"
            ? buildBlock()
            : buildBarrier();

      item.position.set(position.x, position.y, position.z);
      item.rotation.y = position.heading;
      this.scene.add(item);
    }
  }

  private buildCoins(track: TrackSpec): void {
    const geometry = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16);
    const material = new THREE.MeshStandardMaterial({
      color: PALETTE.coin,
      emissive: new THREE.Color(PALETTE.coin),
      emissiveIntensity: 0.7,
      metalness: 0.7,
      roughness: 0.25,
    });

    for (const coin of track.coins) {
      const position = this.worldPoint(coin.distance, coin.lateral);
      if (!position) continue;
      const item = new THREE.Mesh(geometry, material);
      item.position.set(position.x, position.y + 1.1, position.z);
      item.rotation.x = Math.PI / 2;
      this.scene.add(item);
      this.coinMeshes.set(`${coin.distance}:${coin.lateral}`, item);
    }
  }

  private buildFinish(): void {
    // On a circuit the start line and the finish line are the same place.
    const position = this.worldPoint(0, 0);
    if (!position) return;

    const gate = new THREE.Mesh(
      new THREE.TorusGeometry(ROAD_HALF_WIDTH * 1.15, 0.55, 10, 28, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0x6d4aa8,
        emissive: new THREE.Color(0x8b5cf6),
        // Restrained: the gate stands directly over the grid, so a bright one
        // blooms straight into the camera on the first frame of every race.
        emissiveIntensity: 0.35,
      }),
    );
    gate.position.set(position.x, position.y, position.z);
    gate.rotation.y = position.heading;
    this.scene.add(gate);

    // A chequered strip on the road itself, so the line is unmistakable.
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 4),
      new THREE.MeshBasicMaterial({ color: 0xd8d8e8 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = -position.heading;
    strip.position.set(position.x, position.y + 0.05, position.z);
    this.scene.add(strip);
  }

  // ---------------------------------------------------------------- vehicles

  private addVehicle(playerId: string, index: number): VehicleRig {
    const colour = CAR_COLOURS[index % CAR_COLOURS.length]!;
    const rig = this.isBike ? buildBike(colour) : buildCar(colour);
    this.scene.add(rig.group);
    this.vehicles.set(playerId, rig);
    return rig;
  }

  /**
   * Places one vehicle, and emits whatever it is doing.
   *
   * The wheel spin, the lean, the pitch under braking and the flame out of the
   * exhaust are all derived from state the engine already reports. None of it
   * changes the simulation; all of it is the difference between a car and a
   * box sliding along a texture.
   */
  private placeVehicle(rig: VehicleRig, vehicle: VehicleState, delta: number, tick: number): void {
    const point = this.worldPoint(vehicle.distance, vehicle.lateral);
    if (!point) return;

    rig.group.position.set(point.x, point.y, point.z);
    rig.group.rotation.y = point.heading;

    const before = this.previous.get(vehicle.playerId);
    const boosting = vehicle.nitroUntilTick > tick;
    const crashed = before !== undefined && vehicle.crashTicks > before.crashTicks;
    const tookCoin = before !== undefined && vehicle.coins > before.coins;

    // Wheels turn at the rate the car is actually travelling: circumference is
    // 2*pi*r, so radians per second is speed / r.
    const spin = (vehicle.speed / 0.6) * delta;
    for (const wheel of rig.wheels) wheel.rotation.x -= spin;

    // Front wheels also point where the driver is steering.
    for (const wheel of rig.steeringWheels) {
      wheel.rotation.y += (vehicle.input.steer * 0.42 - wheel.rotation.y) * Math.min(1, delta * 12);
    }

    // The body leans and pitches; the wheels stay flat on the road.
    const leanTarget = -vehicle.lean * (rig.isBike ? 0.62 : 0.13);
    rig.chassis.rotation.z += (leanTarget - rig.chassis.rotation.z) * Math.min(1, delta * 9);

    const pitchTarget = vehicle.crashTicks > 0 ? -0.2 : vehicle.input.brake ? 0.05 : boosting ? -0.05 : 0;
    rig.chassis.rotation.x += (pitchTarget - rig.chassis.rotation.x) * Math.min(1, delta * 8);

    rig.brakeLights.emissiveIntensity = vehicle.input.brake ? 4 : 0.9;
    rig.headlight.intensity = boosting ? 4 : 2.2;

    const particles = this.particles;
    if (particles) {
      if (boosting) {
        for (const exhaust of rig.exhausts) {
          const at = exhaust.getWorldPosition(new THREE.Vector3());
          const backward = new THREE.Vector3(
            -Math.sin(point.heading),
            0,
            -Math.cos(point.heading),
          );
          particles.flame(at, backward);
        }
      }

      if (crashed) {
        particles.sparks(rig.group.position.clone().setY(point.y + 0.6));
      }

      if (tookCoin) {
        particles.pickup(rig.group.position.clone().setY(point.y + 1.1));
      }

      // Dust only off the tarmac, and only when actually moving.
      if (Math.abs(vehicle.lateral) > 1 && vehicle.speed > 6 && Math.random() < 0.6) {
        const wheel = rig.wheels[rig.wheels.length - 1]!;
        particles.dust(wheel.getWorldPosition(new THREE.Vector3()));
      }
    }

    this.previous.set(vehicle.playerId, {
      distance: vehicle.distance,
      crashTicks: vehicle.crashTicks,
      coins: vehicle.coins,
    });
  }

  private spinCoins(): void {
    for (const coin of this.coinMeshes.values()) {
      if (coin.visible) coin.rotation.z += 0.06;
    }
  }

  /**
   * Chase camera.
   *
   * Smoothed towards the target rather than pinned to it: a camera welded to
   * the car transmits every twitch of the physics and is genuinely unpleasant
   * to look at for more than a few seconds.
   */
  private followCamera(vehicle: VehicleState, isCountdown: boolean): void {
    // Tracks the car most of the way across the road. At a low fraction the
    // car sits off to one side of the picture with dead road beside it, which
    // is what the first build looked like.
    const point = this.worldPoint(vehicle.distance, vehicle.lateral * 0.88);
    if (!point) return;

    // Pulls back and drops as speed rises, which is the cheapest and most
    // effective sense-of-speed trick there is.
    const speedFactor = Math.min(1, vehicle.speed / 70);
    const back = isCountdown ? 14 : 12 + speedFactor * 3.5;
    const height = isCountdown ? 6.4 : 5.2 + speedFactor * 1.1;

    const behind = new THREE.Vector3(
      point.x - Math.sin(point.heading) * back,
      point.y + height,
      point.z - Math.cos(point.heading) * back,
    );

    // The first frame snaps rather than lerping: starting from the world
    // origin means an unasked-for fly-in every time a race begins.
    if (this.cameraPosition.lengthSq() === 0) this.cameraPosition.copy(behind);
    else this.cameraPosition.lerp(behind, 0.12);
    this.camera.position.copy(this.cameraPosition);

    const ahead = this.worldPoint(vehicle.distance + 26, vehicle.lateral * 0.3) ?? point;
    const lookAt = new THREE.Vector3(ahead.x, ahead.y + 1.6, ahead.z);
    if (this.cameraTarget.lengthSq() === 0) this.cameraTarget.copy(lookAt);
    else this.cameraTarget.lerp(lookAt, 0.14);
    this.camera.lookAt(this.cameraTarget);

    // A narrower base angle than the wide-angle look of the first build: 72
    // degrees bows the road at the edges. The kick with speed stays, because
    // that is doing real work.
    this.camera.fov = 64 + speedFactor * 10;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Track space to world space, including the lateral sign convention.
   *
   * Delegated to the engine so the renderer and the tests agree by
   * construction — see `trackToWorld` for why the sign is not the obvious one.
   */
  private worldPoint(
    distance: number,
    lateral: number,
  ): { x: number; y: number; z: number; heading: number } | null {
    return trackToWorld(this.centerline, distance, lateral, ROAD_HALF_WIDTH, ROAD_STEP);
  }
}

const HAZARD = new THREE.MeshStandardMaterial({
  color: 0xfff6e0,
  emissive: new THREE.Color(0xfff6e0),
  emissiveIntensity: 0.55,
  roughness: 0.4,
});

/** A traffic cone: weighted base, tapered body, reflective band. */
function buildCone(): THREE.Group {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.14, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.9 }),
  );
  base.position.y = 0.07;
  group.add(base);

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.5, 12),
    new THREE.MeshStandardMaterial({
      color: 0xff7a2d,
      emissive: new THREE.Color(0xff7a2d),
      emissiveIntensity: 0.5,
      roughness: 0.6,
    }),
  );
  body.position.y = 0.83;
  group.add(body);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.36, 0.22, 12), HAZARD);
  band.position.y = 0.86;
  group.add(band);

  return group;
}

/** A road barrier: striped panel on two feet. */
function buildBarrier(): THREE.Group {
  const group = new THREE.Group();
  const width = ROAD_HALF_WIDTH * 0.6;

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.9, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0xff4d6d,
      emissive: new THREE.Color(0xff4d6d),
      emissiveIntensity: 0.45,
      roughness: 0.5,
    }),
  );
  panel.position.y = 1.25;
  group.add(panel);

  // Diagonal stripes, which is what makes a barrier read as a barrier.
  const stripes = Math.max(3, Math.round(width / 0.7));
  for (let i = 0; i < stripes; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.05, 0.26), HAZARD);
    stripe.position.set(-width / 2 + (i + 0.5) * (width / stripes), 1.25, 0);
    stripe.rotation.z = 0.5;
    group.add(stripe);
  }

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.12, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x3a2a5a, roughness: 0.7, metalness: 0.4 }),
  );
  rail.position.y = 1.78;
  group.add(rail);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.85, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.9 }),
    );
    leg.position.set((side * width) / 2.4, 0.42, 0);
    group.add(leg);
  }

  return group;
}

/** A concrete block, chevroned so its edges are visible at distance. */
function buildBlock(): THREE.Group {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.5, 1.5),
    new THREE.MeshStandardMaterial({
      color: 0x4ad6ff,
      emissive: new THREE.Color(0x2a86b8),
      emissiveIntensity: 0.35,
      roughness: 0.65,
      metalness: 0.2,
    }),
  );
  body.position.y = 0.75;
  group.add(body);

  // A bright cap and two chevrons: enough contrast to be read in one glance.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 1.6), HAZARD);
  cap.position.y = 1.56;
  group.add(cap);

  for (const side of [-1, 1]) {
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.12), HAZARD);
    chevron.position.set(side * 0.55, 0.8, 0.78);
    chevron.rotation.z = side * 0.55;
    group.add(chevron);
  }

  return group;
}

function mesh(positions: number[], indices: number[], material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

