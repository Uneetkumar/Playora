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
  type TrackObstacle,
  type TrackSpec,
  type VehicleState,
} from "@playora/game-engine";

/**
 * Multiple AAA-grade Racing Environment Themes.
 */
export interface RacingTheme {
  name: string;
  fog: number;
  skyTop: number;
  skyBottom: number;
  roadAsphalt: number;
  curbColor1: number;
  curbColor2: number;
  railLeft: number;
  railRight: number;
  buildingColor: number;
  windowGlow1: number;
  windowGlow2: number;
  lightAmbient: number;
  lightHemisphereSky: number;
  lightHemisphereGround: number;
  chevronGlow: number;
}

export const THEMES: Record<string, RacingTheme> = {
  cityNight: {
    name: "Cyber Metropolis",
    fog: 0x060914,
    skyTop: 0x02050e,
    skyBottom: 0x0b1428,
    roadAsphalt: 0x0f1422,
    curbColor1: 0x0284c7,
    curbColor2: 0x475569,
    railLeft: 0x06b6d4,
    railRight: 0xa855f7,
    buildingColor: 0x080c18,
    windowGlow1: 0x38bdf8,
    windowGlow2: 0xf43f5e,
    lightAmbient: 0xdbeafe,
    lightHemisphereSky: 0x93c5fd,
    lightHemisphereGround: 0x030712,
    chevronGlow: 0x00f0ff,
  },
  sunsetHighway: {
    name: "Sunset Coastal",
    fog: 0x0a0614,
    skyTop: 0x140628,
    skyBottom: 0x2e0d36,
    roadAsphalt: 0x120f1c,
    curbColor1: 0xf97316,
    curbColor2: 0x475569,
    railLeft: 0xf59e0b,
    railRight: 0xf43f5e,
    buildingColor: 0x0a0714,
    windowGlow1: 0xfbbf24,
    windowGlow2: 0xf97316,
    lightAmbient: 0xfef08a,
    lightHemisphereSky: 0xfdba74,
    lightHemisphereGround: 0x0c0620,
    chevronGlow: 0xf59e0b,
  },
  futuristicArena: {
    name: "Neon Arena",
    fog: 0x050914,
    skyTop: 0x020612,
    skyBottom: 0x061226,
    roadAsphalt: 0x0d1424,
    curbColor1: 0x06b6d4,
    curbColor2: 0x334155,
    railLeft: 0x06b6d4,
    railRight: 0x3b82f6,
    buildingColor: 0x070d1a,
    windowGlow1: 0x00f0ff,
    windowGlow2: 0x6366f1,
    lightAmbient: 0xdbeafe,
    lightHemisphereSky: 0x67e8f9,
    lightHemisphereGround: 0x020817,
    chevronGlow: 0x00f0ff,
  },
  volcanicRidge: {
    name: "Volcanic Ridge",
    fog: 0x080306,
    skyTop: 0x100306,
    skyBottom: 0x22070c,
    roadAsphalt: 0x120a0d,
    curbColor1: 0xe11d48,
    curbColor2: 0x475569,
    railLeft: 0xf97316,
    railRight: 0xe11d48,
    buildingColor: 0x0b0507,
    windowGlow1: 0xfb923c,
    windowGlow2: 0xf43f5e,
    lightAmbient: 0xfecdd3,
    lightHemisphereSky: 0xf87171,
    lightHemisphereGround: 0x080204,
    chevronGlow: 0xf97316,
  },

  /*
   * The remaining themes from the track asset pack.
   *
   * Each one is a palette, not a set of models: the sky gradient, the fog, the
   * tarmac and the barrier glows are what actually establish where a track is,
   * far more than any prop does. Daylight themes deliberately carry a much
   * lighter fog than the night ones, because reusing a near-black fog under a
   * blue sky reads as smog rather than distance.
   */
  mountainPass: {
    name: "Mountain Pass",
    fog: 0x8fa8c4,
    skyTop: 0x2f6fb5,
    skyBottom: 0xbcd4ea,
    roadAsphalt: 0x2a2f38,
    curbColor1: 0xdc2626,
    curbColor2: 0xf1f5f9,
    railLeft: 0x94a3b8,
    railRight: 0x94a3b8,
    buildingColor: 0x4b5563,
    windowGlow1: 0xe2e8f0,
    windowGlow2: 0xcbd5e1,
    lightAmbient: 0xffffff,
    lightHemisphereSky: 0x9ec5f0,
    lightHemisphereGround: 0x5a6b52,
    chevronGlow: 0xfacc15,
  },
  desertDunes: {
    name: "Desert Run",
    fog: 0xe0b483,
    skyTop: 0x3d86c0,
    skyBottom: 0xf5d9a8,
    roadAsphalt: 0x3a3129,
    curbColor1: 0xf59e0b,
    curbColor2: 0xfef3c7,
    railLeft: 0xd97706,
    railRight: 0xd97706,
    buildingColor: 0x8a6a45,
    windowGlow1: 0xfde68a,
    windowGlow2: 0xfbbf24,
    lightAmbient: 0xfff7e6,
    lightHemisphereSky: 0xfcd9a0,
    lightHemisphereGround: 0x8a6a45,
    chevronGlow: 0xfb923c,
  },
  jungleRuins: {
    name: "Jungle Ruins",
    fog: 0x1c3326,
    skyTop: 0x123322,
    skyBottom: 0x3f6b4a,
    roadAsphalt: 0x232a26,
    curbColor1: 0x65a30d,
    curbColor2: 0x1f2d24,
    railLeft: 0x84cc16,
    railRight: 0x0d9488,
    buildingColor: 0x2f4034,
    windowGlow1: 0xa3e635,
    windowGlow2: 0x22d3ee,
    lightAmbient: 0xd9f99d,
    lightHemisphereSky: 0x86efac,
    lightHemisphereGround: 0x14251a,
    chevronGlow: 0x4ade80,
  },
  snowPeak: {
    name: "Frozen Summit",
    fog: 0xdbe7f2,
    skyTop: 0x6ea8dc,
    skyBottom: 0xeaf2fa,
    roadAsphalt: 0x3d4652,
    curbColor1: 0x1d4ed8,
    curbColor2: 0xf8fafc,
    railLeft: 0xbae6fd,
    railRight: 0xbae6fd,
    buildingColor: 0x9fb3c8,
    windowGlow1: 0xe0f2fe,
    windowGlow2: 0xffffff,
    lightAmbient: 0xffffff,
    lightHemisphereSky: 0xdbeafe,
    lightHemisphereGround: 0xb8c9d9,
    chevronGlow: 0x38bdf8,
  },
  industrialZone: {
    name: "Industrial Zone",
    fog: 0x2b2f36,
    skyTop: 0x1d232c,
    skyBottom: 0x545a63,
    roadAsphalt: 0x1a1e24,
    curbColor1: 0xf59e0b,
    curbColor2: 0x27303a,
    railLeft: 0xfbbf24,
    railRight: 0x64748b,
    buildingColor: 0x353b44,
    windowGlow1: 0xfcd34d,
    windowGlow2: 0xf97316,
    lightAmbient: 0xd6dae0,
    lightHemisphereSky: 0x8a929c,
    lightHemisphereGround: 0x1a1e24,
    chevronGlow: 0xfbbf24,
  },
  forestTrail: {
    name: "Forest Trail",
    fog: 0x22301f,
    skyTop: 0x2c4a2a,
    skyBottom: 0x6f8f5c,
    roadAsphalt: 0x38302a,
    curbColor1: 0x854d0e,
    curbColor2: 0x1f2a1c,
    railLeft: 0x4d7c0f,
    railRight: 0x4d7c0f,
    buildingColor: 0x27341f,
    windowGlow1: 0xbef264,
    windowGlow2: 0x84cc16,
    lightAmbient: 0xecfccb,
    lightHemisphereSky: 0x9ccb7a,
    lightHemisphereGround: 0x1b2416,
    chevronGlow: 0xa3e635,
  },
  canyonRush: {
    name: "Canyon Rush",
    fog: 0xc07a4e,
    skyTop: 0x3b6ea8,
    skyBottom: 0xe8a877,
    roadAsphalt: 0x35291f,
    curbColor1: 0xdc2626,
    curbColor2: 0xfed7aa,
    railLeft: 0xea580c,
    railRight: 0xea580c,
    buildingColor: 0x7c4128,
    windowGlow1: 0xfdba74,
    windowGlow2: 0xf97316,
    lightAmbient: 0xffedd5,
    lightHemisphereSky: 0xf3b98a,
    lightHemisphereGround: 0x6b3a24,
    chevronGlow: 0xf97316,
  },
  coastalHighway: {
    name: "Coastal Highway",
    fog: 0xa8d4e0,
    skyTop: 0x1d6fa8,
    skyBottom: 0xd6f0f7,
    roadAsphalt: 0x2b323a,
    curbColor1: 0x0ea5e9,
    curbColor2: 0xf8fafc,
    railLeft: 0x22d3ee,
    railRight: 0x22d3ee,
    buildingColor: 0x5d7c8a,
    windowGlow1: 0xa5f3fc,
    windowGlow2: 0xfde68a,
    lightAmbient: 0xffffff,
    lightHemisphereSky: 0xbae6fd,
    lightHemisphereGround: 0x3f6070,
    chevronGlow: 0x06b6d4,
  },
};

const CAR_COLOURS = [
  0xff2b3d, 0x06b6d4, 0x10b981, 0xfbbf24, 0xa855f7, 0xf43f5e, 0x3b82f6, 0xf97316,
];

const ROAD_STEP = 8;

/**
 * Suspension feel.
 *
 * Travel is deliberately small. Real road-car wheel travel under braking is a
 * couple of centimetres, and exaggerating it past about 5cm stops reading as a
 * heavy car settling and starts reading as a toy on springs.
 */
const SUSPENSION_TRAVEL = 0.05;
/** Converts m/s^2 of deceleration into a 0..1 load. Tuned so hard braking sits near 1. */
const SUSPENSION_LONG_GAIN = 0.05;
/** Converts steer x speed into a 0..1 lateral load. */
const SUSPENSION_LAT_GAIN = 0.012;
/** How far a fully loaded car rolls onto its outside springs, in radians. */
const SUSPENSION_ROLL_ANGLE = 0.05;
/** How far the body pitches under full braking, in radians. */
const SUSPENSION_PITCH_ANGLE = 0.075;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export class RaceScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private centerline: ReturnType<typeof trackCenterline> = [];
  private vehicles = new Map<string, VehicleRig>();
  private coinMeshes = new Map<string, THREE.Mesh>();
  private pickupMeshes: THREE.Mesh[] = [];
  private cameraTarget = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();
  private disposed = false;
  private isBike: boolean;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  /**
   * The most anisotropic filtering this GPU supports.
   *
   * Read once from the renderer: a building facade is seen almost edge-on for
   * most of a lap, which is exactly the case plain mipmapping blurs into mush
   * and anisotropy fixes.
   */
  private maxAnisotropy = 1;
  private particles: ParticleField | null = null;
  private speedLines: SpeedLines | null = null;
  private lastFrameAt = 0;
  // `speed` is kept so suspension can measure real acceleration between frames
  // rather than inferring it from the brake and throttle flags.
  private previous = new Map<
    string,
    { distance: number; crashTicks: number; coins: number; speed: number }
  >();
  private theme: RacingTheme;

  constructor(
    private canvas: HTMLCanvasElement,
    track: TrackSpec,
    options: { isBike?: boolean; themeName?: string } = {}
  ) {
    this.isBike = options.isBike ?? false;

    // Pick theme based on track seed
    const themeKeys = Object.keys(THEMES);
    const themeKey = options.themeName ?? themeKeys[Math.abs(track.seed) % themeKeys.length]!;
    this.theme = THEMES[themeKey] ?? THEMES.cityNight!;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));

    this.camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.5, 1400);
    this.scene.fog = new THREE.FogExp2(this.theme.fog, 0.0032);
    this.scene.background = new THREE.Color(this.theme.fog);

    this.centerline = trackCenterline(track, ROAD_STEP);

    this.buildLights();
    this.buildSky();
    this.buildRoad();
    this.buildRails();
    this.buildCurbs();
    this.buildChevrons();
    this.buildCity(track);
    this.buildOverheadGantries();
    this.buildBoostPads(track);
    this.buildZones(track);
    this.buildObstacles(track);
    this.buildCoins(track);
    this.buildPickups(track);
    this.buildFinish();

    // Post-Processing with Tone Mapping & High-Definition Bloom
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.35, // Bloom strength
      0.4,  // Radius
      0.85  // High threshold to eliminate light flicker and specular shimmer
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.particles = new ParticleField(this.scene);
    this.speedLines = new SpeedLines(this.camera);
    this.scene.add(this.camera);

    this.resize();
  }

  update(view: RacingPlayerView, followId: string | null): void {
    if (this.disposed) return;

    const now = performance.now();
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
    if (follow) {
      const boosting = follow.nitroUntilTick > view.tick;
      this.followCamera(follow, view.racingPhase === "countdown", boosting);
    }

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
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------- lighting & sky
  private buildLights(): void {
    this.scene.add(
      new THREE.HemisphereLight(
        this.theme.lightHemisphereSky,
        this.theme.lightHemisphereGround,
        1.1
      )
    );

    const dirLight = new THREE.DirectionalLight(0xdbeafe, 1.3);
    dirLight.position.set(50, 150, 80);
    this.scene.add(dirLight);
  }

  private buildSky(): void {
    const geometry = new THREE.SphereGeometry(1100, 32, 24);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(this.theme.skyTop) },
        bottom: { value: new THREE.Color(this.theme.skyBottom) },
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

  // ---------------------------------------------------------------- road & rails
  private buildRoad(): void {
    const half = ROAD_HALF_WIDTH;
    const positions: number[] = [];
    const indices: number[] = [];
    const runoffPositions: number[] = [];
    const runoffIndices: number[] = [];

    const ring = [...this.centerline, this.centerline[0]!];

    ring.forEach((point, i) => {
      const nx = Math.cos(point.heading);
      const nz = -Math.sin(point.heading);

      positions.push(point.x - nx * half, point.y, point.z - nz * half);
      positions.push(point.x + nx * half, point.y, point.z + nz * half);

      const wide = half * 1.45;
      runoffPositions.push(point.x - nx * wide, point.y - 0.05, point.z - nz * wide);
      runoffPositions.push(point.x + nx * wide, point.y - 0.05, point.z + nz * wide);

      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        runoffIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });

    // 1. Calculate Minimum Track Elevation across the whole circuit
    const minY = Math.min(...this.centerline.map((p) => p.y));

    // 2. City Base Ground Terrain (Placed safely below all track hills and dips)
    const groundGeo = new THREE.PlaneGeometry(3200, 3200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x04060e,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = minY - 12;
    this.scene.add(ground);

    // 3. Outward Terrain Embankment Skirts (Smoothly follows track elevation)
    const skirtPositions: number[] = [];
    const skirtIndices: number[] = [];
    ring.forEach((point, i) => {
      const nx = Math.cos(point.heading);
      const nz = -Math.sin(point.heading);
      const skirtDist = half * 3.2;

      skirtPositions.push(point.x - nx * skirtDist, point.y - 1.2, point.z - nz * skirtDist);
      skirtPositions.push(point.x + nx * skirtDist, point.y - 1.2, point.z + nz * skirtDist);

      if (i > 0) {
        const a = (i - 1) * 2;
        skirtIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });

    this.scene.add(
      mesh(
        skirtPositions,
        skirtIndices,
        new THREE.MeshStandardMaterial({
          color: 0x060914,
          roughness: 0.95,
          metalness: 0.05,
          side: THREE.DoubleSide,
        })
      )
    );

    // 4. Runoff Gravel
    this.scene.add(
      mesh(
        runoffPositions,
        runoffIndices,
        new THREE.MeshStandardMaterial({
          color: 0x0c0e18,
          roughness: 0.95,
          metalness: 0.05,
          side: THREE.DoubleSide,
        })
      )
    );

    // Procedural Wet Asphalt PBR Road Surface
    const asphaltTex = this.createAsphaltTexture();
    this.scene.add(
      mesh(
        positions,
        indices,
        new THREE.MeshStandardMaterial({
          color: this.theme.roadAsphalt,
          map: asphaltTex,
          roughness: 0.38,
          metalness: 0.52,
          side: THREE.DoubleSide,
        })
      )
    );

    this.buildCentreLine();
  }

  private buildCentreLine(): void {
    const geometry = new THREE.PlaneGeometry(0.45, 4.8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
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

  private buildCurbs(): void {
    for (const side of [-1, 1] as const) {
      const half = ROAD_HALF_WIDTH;
      const curbWidth = 0.8;
      const positions: number[] = [];
      const indices: number[] = [];

      const ring = [...this.centerline, this.centerline[0]!];
      ring.forEach((point, i) => {
        const nx = Math.cos(point.heading) * side;
        const nz = -Math.sin(point.heading) * side;
        positions.push(point.x + nx * half, point.y + 0.01, point.z + nz * half);
        positions.push(point.x + nx * (half + curbWidth), point.y + 0.04, point.z + nz * (half + curbWidth));

        if (i > 0) {
          const a = (i - 1) * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });

      this.scene.add(
        mesh(
          positions,
          indices,
          new THREE.MeshStandardMaterial({
            color: side < 0 ? this.theme.curbColor1 : this.theme.curbColor2,
            roughness: 0.45,
            metalness: 0.3,
            side: THREE.DoubleSide,
          })
        )
      );
    }
  }

  private buildRails(): void {
    for (const side of [-1, 1] as const) {
      const positions: number[] = [];
      const indices: number[] = [];
      const half = ROAD_HALF_WIDTH * 1.06;
      const height = 0.95;

      const ring = [...this.centerline, this.centerline[0]!];
      ring.forEach((point, i) => {
        const nx = Math.cos(point.heading) * side;
        const nz = -Math.sin(point.heading) * side;
        positions.push(point.x + nx * half, point.y + 0.02, point.z + nz * half);
        positions.push(point.x + nx * half, point.y + height, point.z + nz * half);
        if (i > 0) {
          const a = (i - 1) * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });

      this.scene.add(
        mesh(
          positions,
          indices,
          new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            emissive: new THREE.Color(side < 0 ? this.theme.railLeft : this.theme.railRight),
            emissiveIntensity: 0.5,
            roughness: 0.35,
            metalness: 0.85,
            side: THREE.DoubleSide,
          })
        )
      );
    }
  }

  /** Animated Neon Chevron Turn Indicators (>>>) on Outer Track Rails */
  private buildChevrons(): void {
    const chevronGeo = new THREE.BoxGeometry(2.4, 1.2, 0.15);
    const chevronMat = new THREE.MeshStandardMaterial({
      color: this.theme.chevronGlow,
      emissive: new THREE.Color(this.theme.chevronGlow),
      emissiveIntensity: 2.5,
      roughness: 0.2,
    });

    for (let i = 0; i < this.centerline.length; i += 6) {
      const point = this.centerline[i]!;
      const side = (i % 12 === 0 ? 1 : -1);
      const nx = Math.cos(point.heading) * side;
      const nz = -Math.sin(point.heading) * side;
      const dist = ROAD_HALF_WIDTH * 1.44;

      const sign = new THREE.Mesh(chevronGeo, chevronMat);
      sign.position.set(point.x + nx * dist, point.y + 2.0, point.z + nz * dist);
      sign.rotation.y = point.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.scene.add(sign);
    }
  }

  // ---------------------------------------------------------------- city & buildings
  private buildCity(track: TrackSpec): void {
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const facadeTex = this.createFacadeTexture();
    const billboardTex = this.createBillboardTexture();

    // Dark Obsidian Glass Skyscraper Material with Window Grid
    const bldgMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: facadeTex,
      // Glass, not chrome. At 0.85 metalness every window acted as a mirror
      // and threw a moving specular highlight as the car drove past, which
      // read as flickering.
      roughness: 0.55,
      metalness: 0.35,
      envMapIntensity: 0.7,
    });

    // Dark Matte Structural Steel Material
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.8,
    });

    // Glowing Neon Accents Material
    const neonCyan = new THREE.MeshStandardMaterial({
      color: this.theme.windowGlow1,
      emissive: new THREE.Color(this.theme.windowGlow1),
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });

    const neonMagenta = new THREE.MeshStandardMaterial({
      color: this.theme.windowGlow2,
      emissive: new THREE.Color(this.theme.windowGlow2),
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });

    // Glowing Billboard Material
    const billboardMat = new THREE.MeshBasicMaterial({
      map: billboardTex,
      side: THREE.DoubleSide,
    });

    const buildingCount = Math.min(180, Math.floor(track.length / 14));

    for (let i = 0; i < buildingCount; i++) {
      const point = this.centerline[i % this.centerline.length]!;
      const side = i % 2 === 0 ? 1 : -1;
      // Depth as well as height: a fixed set of four offsets built four
      // perfectly straight walls of buildings either side of the track.
      const rowNoise = Math.sin(i * 7.13) * 0.5 + 0.5;
      const distance = ROAD_HALF_WIDTH + 20 + rowNoise * 58;

      const nx = Math.cos(point.heading) * side;
      const nz = -Math.sin(point.heading) * side;

      const posX = point.x + nx * distance;
      const posZ = point.z + nz * distance;
      const posY = point.y;

      /*
       * Variation, from the building's own index.
       *
       * Every tower of a given archetype was built from the same hard-coded
       * numbers — width 24, heights 28/45/35 — so a skyline of 180 buildings
       * was four shapes repeated forty-five times, at identical size, in
       * strict rotation. That reads as wallpaper rather than a city.
       *
       * A cheap hash of the index gives each tower its own proportions while
       * staying deterministic, so the skyline is the same every time you drive
       * the track and does not flicker as buildings are rebuilt.
       */
      const hash = (n: number) => {
        const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      // Archetype from a hash rather than `i % 4`, so the four kinds do not
      // alternate in a visible pattern down the road.
      const archetype = Math.floor(hash(0) * 4);
      // Slim towers next to broad ones, and a real spread of heights.
      const widthScale = 0.55 + hash(1) * 0.95;
      const heightScale = 0.5 + hash(2) * 1.6;

      const towerGroup = new THREE.Group();
      towerGroup.position.set(posX, posY, posZ);
      // Turned off-axis so the facades do not all face the road square-on.
      towerGroup.rotation.y = point.heading + (hash(3) - 0.5) * 0.9;
      towerGroup.scale.set(widthScale, heightScale, widthScale);

      if (archetype === 0) {
        // ── ARCHETYPE 1: 3-Tiered Modern Skyscraper with Helipad ──
        const width = 24;
        const depth = 24;
        const h1 = 28;
        const h2 = 45;
        const h3 = 35;

        // Base Podium
        const base = new THREE.Mesh(new THREE.BoxGeometry(width, h1, depth), bldgMaterial);
        base.position.y = h1 / 2;
        towerGroup.add(base);

        // Mid Tower Setback
        const mid = new THREE.Mesh(new THREE.BoxGeometry(width * 0.75, h2, depth * 0.75), bldgMaterial);
        mid.position.y = h1 + h2 / 2;
        towerGroup.add(mid);

        // Top Crown
        const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.5, h3, depth * 0.5), bldgMaterial);
        top.position.y = h1 + h2 + h3 / 2;
        towerGroup.add(top);

        // Glowing Helipad Ring on Roof
        const helipad = new THREE.Mesh(
          new THREE.TorusGeometry(width * 0.2, 0.4, 8, 24),
          neonCyan
        );
        helipad.rotation.x = Math.PI / 2;
        helipad.position.y = h1 + h2 + h3 + 0.2;
        towerGroup.add(helipad);

      } else if (archetype === 1) {
        // ── ARCHETYPE 2: Cyberpunk Hologram Billboard Tower ──
        const width = 20;
        const depth = 18;
        const height = 85;

        const mainTower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bldgMaterial);
        mainTower.position.y = height / 2;
        towerGroup.add(mainTower);

        // Diagonal Structural Steel Cross-Bracing
        for (const fSide of [-depth / 2 - 0.2, depth / 2 + 0.2]) {
          const brace1 = new THREE.Mesh(new THREE.BoxGeometry(width * 1.1, 0.8, 0.8), steelMaterial);
          brace1.position.set(0, height * 0.35, fSide);
          towerGroup.add(brace1);

          const brace2 = new THREE.Mesh(new THREE.BoxGeometry(width * 1.1, 0.8, 0.8), steelMaterial);
          brace2.position.set(0, height * 0.7, fSide);
          towerGroup.add(brace2);
        }

        // Giant Trackside Glowing Cyber Billboard Screen
        const billboard = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), billboardMat);
        billboard.position.set(0, 32, (depth / 2 + 0.6) * (side > 0 ? -1 : 1));
        billboard.rotation.y = side > 0 ? Math.PI : 0;
        towerGroup.add(billboard);

      } else if (archetype === 2) {
        // ── ARCHETYPE 3: Twin Towers with Elevated Sky-Bridge ──
        const tWidth = 12;
        const tDepth = 14;
        const tHeight = 90;
        const gap = 16;

        for (const offset of [-gap / 2, gap / 2]) {
          const tower = new THREE.Mesh(new THREE.BoxGeometry(tWidth, tHeight, tDepth), bldgMaterial);
          tower.position.set(offset, tHeight / 2, 0);
          towerGroup.add(tower);

          // Rooftop Neon Crown
          const crown = new THREE.Mesh(new THREE.BoxGeometry(tWidth * 0.9, 2, tDepth * 0.9), neonMagenta);
          crown.position.set(offset, tHeight + 1, 0);
          towerGroup.add(crown);
        }

        // Connecting Glass Sky-Bridge
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(gap + tWidth * 0.5, 4.5, 6), bldgMaterial);
        bridge.position.set(0, tHeight * 0.65, 0);
        towerGroup.add(bridge);

        const bridgeNeon = new THREE.Mesh(new THREE.BoxGeometry(gap + tWidth * 0.5, 0.4, 6.2), neonCyan);
        bridgeNeon.position.set(0, tHeight * 0.65 - 2.3, 0);
        towerGroup.add(bridgeNeon);

      } else {
        // ── ARCHETYPE 4: Slender Architectural Spire Tower ──
        const width = 16;
        const depth = 16;
        const height = 110;

        const spireTower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bldgMaterial);
        spireTower.position.y = height / 2;
        towerGroup.add(spireTower);

        // Antenna Mast
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 26, 8), steelMaterial);
        antenna.position.set(0, height + 13, 0);
        towerGroup.add(antenna);

        // Red Warning Beacon
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        beacon.position.set(0, height + 26, 0);
        towerGroup.add(beacon);
      }

      this.scene.add(towerGroup);
    }

    // ── Trackside LED Street Lamps ──
    const lampStep = 8;
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff7ed });

    for (let i = 0; i < this.centerline.length; i += lampStep) {
      const point = this.centerline[i]!;
      const side = i % (lampStep * 2) === 0 ? 1 : -1;
      const nx = Math.cos(point.heading) * side;
      const nz = -Math.sin(point.heading) * side;
      const dist = ROAD_HALF_WIDTH * 1.18;

      const lamp = new THREE.Group();
      lamp.position.set(point.x + nx * dist, point.y, point.z + nz * dist);
      lamp.rotation.y = point.heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2);

      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 8), lampMat);
      pole.position.y = 3.25;
      lamp.add(pole);

      // Curved Overhang Arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.2), lampMat);
      arm.position.set(1.0, 6.4, 0);
      lamp.add(arm);

      // LED Light Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.4), lampGlowMat);
      head.position.set(2.0, 6.3, 0);
      lamp.add(head);

      this.scene.add(lamp);
    }
  }

  /** Generates Procedural Skyscraper Facade Canvas Texture with Lit Window Grids */
  private createFacadeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Deep tinted obsidian glass background
    ctx.fillStyle = "#070b16";
    ctx.fillRect(0, 0, 512, 1024);

    // Vertical structural mullions
    ctx.strokeStyle = "#162032";
    ctx.lineWidth = 4;
    for (let x = 0; x <= 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }

    // Floor dividers
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 6;
    for (let y = 0; y <= 1024; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Random illuminated office window lights (Warm Gold, Sky Blue, Cool Mint, Violet)
    const windowColors = ["#38bdf8", "#fef08a", "#a855f7", "#34d399", "#60a5fa"];
    for (let y = 8; y < 1024; y += 44) {
      for (let x = 6; x < 512; x += 32) {
        if (Math.random() > 0.4) {
          const color = windowColors[Math.floor(Math.random() * windowColors.length)]!;
          // Lit windows vary in brightness. Painting them all at full
          // saturation put every one of them over the bloom threshold, so the
          // whole facade glowed and shimmered as one sheet.
          ctx.globalAlpha = 0.35 + Math.random() * 0.4;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 20, 24);
          ctx.globalAlpha = 1;
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    /*
     * This is the fix for the "blinking" city.
     *
     * The facade is a grid of small bright window rectangles. Repeated 2x4
     * over a tower forty metres tall, each window ends up smaller than a pixel
     * at any distance — so every frame samples a different one and the whole
     * building crawls and flashes. It is not a light effect; it is aliasing.
     *
     * Mipmaps give the GPU a pre-averaged version to sample at distance, and
     * anisotropy keeps the facade sharp at the glancing angles you see a
     * building from while driving past it. The repeat is halved so the windows
     * are large enough to survive being minified in the first place.
     */
    texture.repeat.set(1, 2);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = this.maxAnisotropy;
    texture.needsUpdate = true;
    return texture;
  }

  /** Generates High-Resolution Cyber Billboard Canvas Texture */
  private createBillboardTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 288;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Cyberpunk gradient background
    const grad = ctx.createLinearGradient(0, 0, 512, 288);
    grad.addColorStop(0, "#0f051d");
    grad.addColorStop(0.5, "#1e0b36");
    grad.addColorStop(1, "#031024");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 288);

    // Glowing Cyber Border
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 276);

    // Grid pattern
    ctx.strokeStyle = "rgba(0, 240, 255, 0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 288);
      ctx.stroke();
    }

    // Bold Cyber Typography
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PLAYORA NITRO", 256, 120);

    ctx.fillStyle = "#00f0ff";
    ctx.font = "800 24px sans-serif";
    ctx.fillText("HYPER GRAND PRIX", 256, 165);

    ctx.fillStyle = "#f43f5e";
    ctx.font = "700 18px sans-serif";
    ctx.fillText(">>> SPEED UNLEASHED >>>", 256, 210);

    return new THREE.CanvasTexture(canvas);
  }

  /** Generates procedural fine aggregate asphalt texture with wet rubber tire sheen */
  private createAsphaltTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Dark asphalt base
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, 512, 512);

    // Fine mineral aggregate grain noise
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 32;
      const val = Math.max(6, Math.min(48, 16 + noise));
      data[i] = val + (Math.random() > 0.94 ? 14 : 0);
      data[i + 1] = val + (Math.random() > 0.94 ? 18 : 0);
      data[i + 2] = val + 8;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // Subtle longitudinal tire rubber wear grooves
    ctx.fillStyle = "rgba(4, 7, 14, 0.45)";
    ctx.fillRect(64, 0, 128, 512);
    ctx.fillRect(320, 0, 128, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 48);
    return tex;
  }

  /** Overhead Highway LED Gantry Arches Spanning the Track */
  private buildOverheadGantries(): void {
    const step = Math.max(16, Math.floor(this.centerline.length / 6));
    const width = ROAD_HALF_WIDTH * 2.9;

    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.8,
    });

    const neonBarMat = new THREE.MeshStandardMaterial({
      color: this.theme.railLeft,
      emissive: new THREE.Color(this.theme.railLeft),
      emissiveIntensity: 2.2,
    });

    for (let i = step; i < this.centerline.length - step; i += step) {
      const point = this.centerline[i]!;
      const gantry = new THREE.Group();

      // Top Crossbeam
      const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(width, 1.4, 2.0), gantryMat);
      crossbeam.position.y = 8.0;
      gantry.add(crossbeam);

      // Neon LED Sign Underneath
      const ledSign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 0.8, 0.2), neonBarMat);
      ledSign.position.set(0, 7.2, 0);
      gantry.add(ledSign);

      // Left and Right Pillars
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.5, 1.4), gantryMat);
        pillar.position.set(side * (width / 2), 4.25, 0);
        gantry.add(pillar);
      }

      gantry.position.set(point.x, point.y, point.z);
      gantry.rotation.y = point.heading;
      this.scene.add(gantry);
    }
  }

  // -------------------------------------------------------------- Surface Zones
  /**
   * Painted areas of tarmac that change how the car behaves.
   *
   * Drawn flat and read at a glance, because a driver has about a second to
   * decide whether to take the inside line. Each kind gets its own colour *and*
   * its own surface treatment — matte mud, mirror-black oil, textured grip —
   * because colour alone fails for the ~8% of players with a colour vision
   * deficiency, and a racing game that punishes them for it is badly made.
   */
  private buildZones(track: TrackSpec): void {
    if (!track.zones?.length) return;

    // One material per kind, shared across every patch. A material per step
    // would be several hundred of them on a long track, each its own draw call.
    const materials: Record<string, THREE.MeshStandardMaterial> = {
      // Cyan, matching the boost pads a driver already recognises.
      boost: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: new THREE.Color(0x06b6d4),
        emissiveIntensity: 0.6,
        roughness: 0.25,
        metalness: 0.3,
      }),
      // Mud and gravel: matte, unlit, visibly draggy.
      slow: new THREE.MeshStandardMaterial({
        color: 0x4a3a24,
        roughness: 0.95,
        metalness: 0.02,
      }),
      // Oil: near-black and mirror-smooth, the one surface that looks wet.
      slick: new THREE.MeshStandardMaterial({
        color: 0x0b0d12,
        emissive: new THREE.Color(0x1e1b4b),
        emissiveIntensity: 0.18,
        roughness: 0.04,
        metalness: 0.9,
      }),
      grip: new THREE.MeshStandardMaterial({
        color: 0x166534,
        emissive: new THREE.Color(0x22c55e),
        emissiveIntensity: 0.4,
        roughness: 0.7,
        metalness: 0.1,
      }),
      // Purple and the brightest of the set, because it is the rarest.
      nitro: new THREE.MeshStandardMaterial({
        color: 0x581c87,
        emissive: new THREE.Color(0xa855f7),
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.4,
      }),
    };

    for (const zone of track.zones) {
      const material = materials[zone.kind];
      if (!material) continue;

      // Stepped along the centreline rather than drawn as one long slab: a
      // straight box across a corner floats off the road on the outside and
      // sinks into it on the inside.
      const steps = Math.max(2, Math.round(zone.length / 6));
      const stepLength = zone.length / steps;
      const geometry = new THREE.BoxGeometry(
        zone.halfWidth * 2 * ROAD_HALF_WIDTH,
        0.02,
        stepLength + 0.3,
      );

      for (let i = 0; i < steps; i++) {
        const point = this.worldPoint(zone.distance + i * stepLength, zone.lateral);
        if (!point) continue;

        const mesh = new THREE.Mesh(geometry, material);
        // Just above the tarmac: coplanar surfaces z-fight into a flicker far
        // more distracting than the zone itself.
        mesh.position.set(point.x, point.y + 0.012, point.z);
        mesh.rotation.y = point.heading;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
      }
    }
  }

  // ---------------------------------------------------------------- Boost Pads
  private buildBoostPads(track: TrackSpec): void {
    if (!track.boostPads) return;

    // Dark Carbon Baseplate
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.85,
    });

    // Clean Cyber Arrow Material (Calibrated glow, no blinding overexposure)
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: new THREE.Color(0x06b6d4),
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.6,
    });

    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });

    for (const pad of track.boostPads) {
      const point = this.worldPoint(pad.distance, pad.lateral);
      if (!point) continue;

      const group = new THREE.Group();

      // 1. Carbon Base Plate
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.04, 4.2), baseMat);
      base.position.y = 0.02;
      group.add(base);

      // 2. Glowing Side Guard Strips
      for (const side of [-1.8, 1.8]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 4.2), borderMat);
        strip.position.set(side, 0.04, 0);
        group.add(strip);
      }

      // 3. Molded 3D Forward Chevron Arrows
      for (let i = 0; i < 3; i++) {
        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(0, 0.05, i * 1.2 - 1.2);

        // Angled Chevron Arms
        for (const armSide of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.38), arrowMat);
          arm.position.set(armSide * 0.55, 0, -armSide * 0.28);
          arm.rotation.y = -armSide * 0.55;
          arrowGroup.add(arm);
        }
        group.add(arrowGroup);
      }

      group.position.set(point.x, point.y, point.z);
      group.rotation.y = point.heading;
      this.scene.add(group);
    }
  }

  // ---------------------------------------------------------------- Obstacles & Pickups
  private buildObstacles(track: TrackSpec): void {
    for (const obstacle of track.obstacles) {
      const point = this.worldPoint(obstacle.distance, obstacle.lateral);
      if (!point) continue;

      const group = createObstacleMesh(obstacle.kind);
      group.position.set(point.x, point.y, point.z);
      group.rotation.y = point.heading;
      this.scene.add(group);
    }
  }

  /** Builds Collectible Gold Coins & 3D Nitro Booster Bottles */
  // ------------------------------------------------------------------ Pickups
  /**
   * Power-ups, each readable as a silhouette before its colour registers.
   *
   * A driver sees these for well under a second while deciding whether the
   * detour is worth it, so shape carries the meaning and colour reinforces it:
   * a bottle is nitro, a disc is a shield, a ring is a magnet, a cross is a
   * repair, and a cube with nothing on it is a mystery box. Five glowing
   * lozenges in five colours would be unreadable at racing speed.
   */
  private buildPickups(track: TrackSpec): void {
    if (!track.pickups?.length) return;

    const make = (kind: string | null): THREE.Mesh => {
      switch (kind) {
        case "nitro":
          return new THREE.Mesh(
            new THREE.CapsuleGeometry(0.32, 0.5, 6, 12),
            new THREE.MeshStandardMaterial({
              color: 0x0ea5e9,
              emissive: new THREE.Color(0x38bdf8),
              emissiveIntensity: 1.1,
              roughness: 0.2,
              metalness: 0.5,
            }),
          );
        case "perfectNitro":
          return new THREE.Mesh(
            new THREE.CapsuleGeometry(0.34, 0.56, 6, 12),
            new THREE.MeshStandardMaterial({
              color: 0x9333ea,
              emissive: new THREE.Color(0xc084fc),
              emissiveIntensity: 1.4,
              roughness: 0.15,
              metalness: 0.6,
            }),
          );
        case "shield":
          return new THREE.Mesh(
            new THREE.CylinderGeometry(0.52, 0.52, 0.12, 6),
            new THREE.MeshStandardMaterial({
              color: 0x0891b2,
              emissive: new THREE.Color(0x22d3ee),
              emissiveIntensity: 1.0,
              roughness: 0.18,
              metalness: 0.8,
            }),
          );
        case "magnet":
          return new THREE.Mesh(
            new THREE.TorusGeometry(0.42, 0.14, 8, 18, Math.PI * 1.4),
            new THREE.MeshStandardMaterial({
              color: 0xd97706,
              emissive: new THREE.Color(0xfbbf24),
              emissiveIntensity: 1.1,
              roughness: 0.25,
              metalness: 0.85,
            }),
          );
        case "repair":
          return new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.2, 0.2),
            new THREE.MeshStandardMaterial({
              color: 0x15803d,
              emissive: new THREE.Color(0x4ade80),
              emissiveIntensity: 1.0,
              roughness: 0.3,
              metalness: 0.4,
            }),
          );
        default:
          // Mystery box: deliberately featureless, because its contents are not
          // decided until it is driven over.
          return new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.62, 0.62),
            new THREE.MeshStandardMaterial({
              color: 0xca8a04,
              emissive: new THREE.Color(0xfacc15),
              emissiveIntensity: 0.9,
              roughness: 0.35,
              metalness: 0.5,
            }),
          );
      }
    };

    for (const pickup of track.pickups) {
      const point = this.worldPoint(pickup.distance, pickup.lateral);
      if (!point) continue;

      const mesh = make(pickup.kind);
      // Floating clear of the road so it reads against the tarmac and is not
      // lost in the car's own shadow.
      mesh.position.set(point.x, point.y + 0.9, point.z);
      mesh.rotation.y = point.heading;
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.pickupMeshes.push(mesh);
    }
  }

  private buildCoins(track: TrackSpec): void {
    // 1. Gold Coin Materials
    const coinGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.14, 18);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.95,
    });

    // 2. Nitro Boost Canister Materials
    const nitroBottleMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.9,
    });
    const nitroValveMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.1,
      metalness: 0.95,
    });
    const nitroRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    for (let i = 0; i < track.coins.length; i++) {
      const coin = track.coins[i]!;
      const point = this.worldPoint(coin.distance, coin.lateral);
      if (!point) continue;

      const isNitroPickup = i % 3 === 0; // 1 out of 3 pickups is a floating 3D Nitro Canister!

      if (isNitroPickup) {
        // Floating 3D Nitro Canister
        const bottleGroup = new THREE.Group();

        // Main Bottle Tank
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.85, 16), nitroBottleMat);
        bottleGroup.add(tank);

        // Top Valve & Cap
        const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.26, 12), nitroValveMat);
        valve.position.y = 0.52;
        bottleGroup.add(valve);

        // Glowing Energy Ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.04, 8, 20), nitroRingMat);
        ring.rotation.x = Math.PI / 2;
        bottleGroup.add(ring);

        bottleGroup.position.set(point.x, point.y + 0.95, point.z);
        this.scene.add(bottleGroup);
        this.coinMeshes.set(`${coin.distance}:${coin.lateral}`, bottleGroup as unknown as THREE.Mesh);
      } else {
        // 3D Forged Gold Coin
        const mesh = new THREE.Mesh(coinGeo, coinMat);
        mesh.position.set(point.x, point.y + 0.9, point.z);
        mesh.rotation.x = Math.PI / 2;
        this.scene.add(mesh);
        this.coinMeshes.set(`${coin.distance}:${coin.lateral}`, mesh);
      }
    }
  }

  /** Start / Finish FIA GT Gantry with Checkered Line & Start Lights */
  private buildFinish(): void {
    const start = this.centerline[0];
    if (!start) return;

    const gantry = new THREE.Group();
    const width = ROAD_HALF_WIDTH * 2.8;

    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.88,
    });

    const bannerMat = new THREE.MeshBasicMaterial({
      map: this.createFinishBannerTexture(),
      side: THREE.DoubleSide,
    });

    // 1. Titanium Overhead Truss Crossbeam
    const arch = new THREE.Mesh(new THREE.BoxGeometry(width, 1.2, 2.2), trussMat);
    arch.position.y = 8.6;
    gantry.add(arch);

    // 2. High-Resolution Checkered Finish Banner
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.72, 1.8), bannerMat);
    banner.position.set(0, 7.6, 1.12);
    gantry.add(banner);

    const bannerBack = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.72, 1.8), bannerMat);
    bannerBack.position.set(0, 7.6, -1.12);
    bannerBack.rotation.y = Math.PI;
    gantry.add(bannerBack);

    // 3. Overhead 5-Stage Start Lights
    const lightBarMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.5 });
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    const lightBox = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.9, 0.5), lightBarMat);
    lightBox.position.set(0, 6.3, 1.05);
    gantry.add(lightBox);

    for (let i = -2; i <= 2; i++) {
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), i === 0 ? greenLightMat : redLightMat);
      bulb.position.set(i * 0.95, 6.3, 1.31);
      gantry.add(bulb);
    }

    // 4. Left & Right Support Pillars
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9.2, 1.6), trussMat);
      pillar.position.set(side * (width / 2), 4.6, 0);
      gantry.add(pillar);
    }

    // 5. On-Track Checkered Asphalt Grid Line
    const gridLineGeo = new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2, 0.02, 1.6);
    const gridLineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.1,
    });
    const gridLine = new THREE.Mesh(gridLineGeo, gridLineMat);
    gridLine.position.set(0, 0.01, 0);
    gantry.add(gridLine);

    gantry.position.set(start.x, start.y, start.z);
    gantry.rotation.y = start.heading;
    this.scene.add(gantry);
  }

  /** Generates Checkered Finish Banner Texture */
  private createFinishBannerTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 512, 128);

    // Checkered border on top and bottom
    const sq = 16;
    for (let y = 0; y < 32; y += sq) {
      for (let x = 0; x < 512; x += sq) {
        if ((Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, y, sq, sq);
          ctx.fillRect(x, 128 - y - sq, sq, sq);
        }
      }
    }

    // Central Banner Box
    ctx.fillStyle = "#020617";
    ctx.fillRect(32, 34, 448, 60);

    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 34, 448, 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🏁 FINISH LINE 🏁", 256, 76);

    return new THREE.CanvasTexture(canvas);
  }

  // ---------------------------------------------------------------- Vehicles & Camera
  private addVehicle(id: string, index: number, specId?: string): VehicleRig {
    const colour = CAR_COLOURS[index % CAR_COLOURS.length]!;
    const rig = this.isBike ? buildBike(colour, specId) : buildCar(colour, specId);
    this.scene.add(rig.group);
    this.vehicles.set(id, rig);
    return rig;
  }

  private placeVehicle(
    rig: VehicleRig,
    vehicle: VehicleState,
    delta: number,
    tick: number
  ): void {
    const point = this.worldPoint(vehicle.distance, vehicle.lateral);
    if (!point) return;

    rig.group.position.set(point.x, point.y, point.z);
    rig.group.rotation.y = point.heading;

    const before = this.previous.get(vehicle.playerId);
    const boosting = vehicle.nitroUntilTick > tick;
    const crashed = before !== undefined && vehicle.crashTicks > before.crashTicks;
    const tookCoin = before !== undefined && vehicle.coins > before.coins;

    /*
     * Wheel rotation from the ground actually passing underneath.
     *
     * This was `speed / 0.6`, a constant with no relationship to the wheel it
     * was turning — so a 0.36m car wheel and a 0.32m bike wheel span at the
     * same rate, and neither matched the road. Rolling without slipping is
     * angle = distance / radius, and the eye is unexpectedly good at spotting
     * when that is wrong: wheels that under-rotate read as skidding.
     */
    const spin = (vehicle.speed * delta) / rig.wheelRadius;
    for (const wheel of rig.wheels) wheel.rotation.x -= spin;

    // Steering rotation
    for (const wheel of rig.steeringWheels) {
      wheel.rotation.y += (vehicle.input.steer * 0.45 - wheel.rotation.y) * Math.min(1, delta * 14);
    }

    /*
     * Suspension, as weight transfer on the body.
     *
     * The important detail is which part moves. The wheels are siblings of the
     * chassis, not children of it, so their y is height above the *road* — a
     * tyre in contact with the ground stays at its radius, always. Pushing the
     * wheels down to represent braking load buries them in the tarmac; the load
     * belongs on the body, which is the thing actually moving on springs.
     *
     * The fender arches are part of the chassis, so this comes out right for
     * free: as the body dips, the gap between arch and tyre closes, which is
     * exactly what compressing suspension looks like from outside the car.
     *
     * Load comes from measured acceleration rather than the input flags, so
     * coasting to a stop or being slowed by a hazard dips the nose too. It
     * should — the body does not know why it is decelerating.
     */
    const dt = Math.max(delta, 1 / 120);
    const longitudinal = before ? (vehicle.speed - before.speed) / dt : 0;
    // Cornering load scales with speed: turning the wheel while stopped
    // transfers no weight at all.
    const lateral = vehicle.input.steer * vehicle.speed;

    const dive = clamp(-longitudinal * SUSPENSION_LONG_GAIN, -1, 1);
    const rollLoad = clamp(lateral * SUSPENSION_LAT_GAIN, -1, 1);

    // Heave: both ends compress under any hard load, so the car settles instead
    // of pivoting around a fixed ride height.
    const heaveTarget = -Math.abs(dive) * SUSPENSION_TRAVEL;
    rig.chassis.position.y += (heaveTarget - rig.chassis.position.y) * Math.min(1, delta * 9);

    // Wheels stay planted. Anything that lifts them belongs to a jump or a
    // bump, which the simulation does not model yet.
    for (let i = 0; i < rig.wheels.length; i++) {
      const rest = rig.wheelRest[i];
      const wheel = rig.wheels[i];
      if (rest && wheel) wheel.position.y = rest.y;
    }

    /*
     * Roll and lean.
     *
     * A bike banks into a corner — the whole machine leans with the rider. A
     * car rolls the other way, onto its outside springs, and by far less. Using
     * one number for both is why the cars used to lean into corners like
     * motorcycles.
     */
    const leanTarget = rig.isBike
      ? -vehicle.lean * 0.72
      : -vehicle.lean * 0.16 + rollLoad * SUSPENSION_ROLL_ANGLE;
    rig.chassis.rotation.z += (leanTarget - rig.chassis.rotation.z) * Math.min(1, delta * 12);

    /*
     * Pitch follows the same measured acceleration as the heave, so body angle
     * and ride height always agree. Previously pitch was driven by the brake
     * flag alone, which made braking look like the car tilting on a hinge.
     */
    const pitchTarget =
      vehicle.crashTicks > 0 ? -0.25 : clamp(dive * SUSPENSION_PITCH_ANGLE, -0.075, 0.075);
    rig.chassis.rotation.x += (pitchTarget - rig.chassis.rotation.x) * Math.min(1, delta * 10);

    // Dynamic brake & headlight intensity with smooth interpolation (no sudden flicker)
    const targetBrake = vehicle.input.brake ? 3.0 : 0.6;
    rig.brakeLights.emissiveIntensity += (targetBrake - rig.brakeLights.emissiveIntensity) * Math.min(1, delta * 12);

    const targetHeadlight = boosting ? 4.2 : 2.8;
    rig.headlight.intensity += (targetHeadlight - rig.headlight.intensity) * Math.min(1, delta * 10);

    // Particle emission
    const particles = this.particles;
    if (particles) {
      if (boosting) {
        for (const exhaust of rig.exhausts) {
          const at = exhaust.getWorldPosition(new THREE.Vector3());
          const backward = new THREE.Vector3(
            -Math.sin(point.heading),
            0,
            -Math.cos(point.heading)
          );
          particles.flame(at, backward);
        }
      }

      if (Math.abs(vehicle.input.steer) > 0.38 && vehicle.speed > 32) {
        for (const wheel of rig.wheels) {
          particles.smoke(wheel.getWorldPosition(new THREE.Vector3()));
        }
      }

      if (crashed) {
        particles.sparks(rig.group.position.clone().setY(point.y + 0.6));
      }

      if (tookCoin) {
        particles.pickup(rig.group.position.clone().setY(point.y + 1.1));
      }
    }

    this.previous.set(vehicle.playerId, {
      distance: vehicle.distance,
      crashTicks: vehicle.crashTicks,
      coins: vehicle.coins,
      speed: vehicle.speed,
    });
  }

  private spinCoins(): void {
    for (const coin of this.coinMeshes.values()) {
      if (coin.visible) {
        coin.rotation.z += 0.06;
        coin.rotation.y += 0.04;
      }
    }
    // Pickups turn more slowly than coins. They are larger and there are far
    // fewer of them, and matching the coin rate makes them read as clutter
    // rather than as something worth going out of your way for.
    for (const pickup of this.pickupMeshes) {
      pickup.rotation.y += 0.022;
    }
  }

  private followCamera(vehicle: VehicleState, isCountdown: boolean, boosting: boolean): void {
    const point = this.worldPoint(vehicle.distance, vehicle.lateral * 0.88);
    if (!point) return;

    const speedFactor = Math.min(1, vehicle.speed / 70);
    const back = isCountdown ? 13.5 : 11.0 + speedFactor * 3.6 + (boosting ? 1.5 : 0);
    const height = isCountdown ? 6.2 : 4.6 + speedFactor * 0.9;

    const behind = new THREE.Vector3(
      point.x - Math.sin(point.heading) * back,
      point.y + height,
      point.z - Math.cos(point.heading) * back
    );

    if (this.cameraPosition.lengthSq() === 0) this.cameraPosition.copy(behind);
    else this.cameraPosition.lerp(behind, 0.15);
    this.camera.position.copy(this.cameraPosition);

    const ahead = this.worldPoint(vehicle.distance + 28, vehicle.lateral * 0.3) ?? point;
    const lookAt = new THREE.Vector3(ahead.x, ahead.y + 1.4, ahead.z);
    if (this.cameraTarget.lengthSq() === 0) this.cameraTarget.copy(lookAt);
    else this.cameraTarget.lerp(lookAt, 0.16);
    this.camera.lookAt(this.cameraTarget);

    const targetFov = 64 + speedFactor * 12 + (boosting ? 14 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * 0.12;
    this.camera.updateProjectionMatrix();

    // High-Speed Speed Vibration & Road Rumble Shock
    if (vehicle.speed > 52) {
      const shakeIntensity = ((vehicle.speed - 52) / 35) * (boosting ? 0.05 : 0.022);
      this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    }
  }

  private worldPoint(
    distance: number,
    lateral: number
  ): { x: number; y: number; z: number; heading: number } | null {
    return trackToWorld(this.centerline, distance, lateral, ROAD_HALF_WIDTH, ROAD_STEP);
  }
}

// ─────────────────────────────────────────────────────────────────
// OBSTACLE 3D MESH GENERATORS
// ─────────────────────────────────────────────────────────────────
function createObstacleMesh(kind: TrackObstacle["kind"]): THREE.Group {
  switch (kind) {
    case "barrel":
      return buildExplosiveBarrel();
    case "spikes":
      return buildSpikeStrip();
    case "laser":
      return buildLaserFence();
    case "barrier":
    case "block":
      return buildRoadblockBarrier();
    case "cone":
    default:
      return buildTrafficCone();
  }
}

/** Realistic Orange/White Safety Barricade with flashing beacons */
function buildRoadblockBarrier(): THREE.Group {
  const group = new THREE.Group();

  const boardMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.4,
    metalness: 0.3,
  });

  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.3,
  });

  const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.75, 0.12), boardMat);
  board.position.y = 0.9;
  group.add(board);

  // White Stripes
  for (const x of [-0.8, 0, 0.8]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.76, 0.14), stripeMat);
    stripe.position.set(x, 0.9, 0);
    group.add(stripe);
  }

  // Steel A-Frame Legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
  for (const x of [-1.15, 1.15]) {
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), legMat);
    leg1.position.set(x, 0.6, 0.25);
    leg1.rotation.x = 0.35;
    group.add(leg1);

    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), legMat);
    leg2.position.set(x, 0.6, -0.25);
    leg2.rotation.x = -0.35;
    group.add(leg2);
  }

  // Dual Flashing Amber Beacons
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: new THREE.Color(0xfbbf24),
    emissiveIntensity: 3.0,
  });
  for (const x of [-1.0, 1.0]) {
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 12), beaconMat);
    beacon.position.set(x, 1.38, 0);
    group.add(beacon);
  }

  return group;
}

/** Explosive Red Steel Hazard Barrel */
function buildExplosiveBarrel(): THREE.Group {
  const group = new THREE.Group();

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.6,
  });

  const hazardBandMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: new THREE.Color(0xfbbf24),
    emissiveIntensity: 1.2,
  });

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.3, 16), barrelMat);
  drum.position.y = 0.65;
  group.add(drum);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.3, 16), hazardBandMat);
  band.position.y = 0.65;
  group.add(band);

  return group;
}

/** Heavy Steel Spike Strip */
function buildSpikeStrip(): THREE.Group {
  const group = new THREE.Group();

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85 });
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.4), baseMat);
  base.position.y = 0.05;
  group.add(base);

  for (let i = 0; i < 7; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 8), spikeMat);
    spike.position.set(-0.9 + i * 0.3, 0.25, 0);
    group.add(spike);
  }

  return group;
}

/** Laser Energy Plasma Fence */
function buildLaserFence(): THREE.Group {
  const group = new THREE.Group();

  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color(0x38bdf8),
    emissiveIntensity: 3.8,
  });

  for (const x of [-1.4, 1.4]) {
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 12), pylonMat);
    pylon.position.set(x, 1.1, 0);
    group.add(pylon);
  }

  // Crackling Plasma Beam
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 12), beamMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 1.2;
  group.add(beam);

  return group;
}

/** High-Visibility Traffic Cone */
function buildTrafficCone(): THREE.Group {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.12, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
  );
  base.position.y = 0.06;
  group.add(base);

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.4, 14),
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: new THREE.Color(0xf97316),
      emissiveIntensity: 0.8,
      roughness: 0.4,
    })
  );
  body.position.y = 0.76;
  group.add(body);

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.3, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
  );
  stripe.position.y = 0.76;
  group.add(stripe);

  return group;
}

function mesh(
  positions: number[],
  indices: number[],
  material: THREE.Material
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}
