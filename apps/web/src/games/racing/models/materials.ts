import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { carbonTextures, discTextures, flakeTexture, tyreTextures, type DecalSheet } from "./textures";
import type { PaintFinish } from "./types";

/**
 * The materials a car is made of. Shared ones are created once and reused by
 * every car on the grid; the few that differ per car (paint, lamps, brake
 * discs, decals) are made per car and are what `dispose()` frees.
 *
 * Everything here is physically based and expects an environment map
 * (`scene.environment`, see `createStudioEnvironment`). Without one, clearcoat
 * and chrome have nothing to reflect and the car renders flat and dark: the
 * original race renderer's main problem.
 */

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/**
 * A soft-box studio as an environment map: the reflections that make paint
 * read as paint. Built once per renderer.
 */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const cached = envCache.get(renderer);
  if (cached) return cached;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.035).texture;
  room.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });
  pmrem.dispose();
  envCache.set(renderer, texture);
  return texture;
}

const shared: {
  detail?: THREE.MeshStandardMaterial;
  carbon?: THREE.MeshPhysicalMaterial;
  glass?: THREE.MeshPhysicalMaterial;
  glassOpaque?: THREE.MeshPhysicalMaterial;
  tyre?: THREE.MeshStandardMaterial;
  slick?: THREE.MeshStandardMaterial;
} = {};

/** Every shared material, so a page that tears the game down can free them. */
export function sharedMaterials(): THREE.Material[] {
  return Object.values(shared).filter((m): m is NonNullable<typeof m> => Boolean(m));
}

/**
 * Trim, plastics, chrome, rubber, cabin: one material, with roughness and
 * metalness read per vertex from an `aRM` attribute. Three.js has no
 * per-vertex roughness, so it is patched into the standard shader.
 */
export function detailMaterial(): THREE.MeshStandardMaterial {
  if (shared.detail) return shared.detail;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
  m.name = "car-detail";
  // Overlays (lamp housings, grilles, trim) sit millimetres off the paint;
  // the offset keeps them winning the depth test when the car is far away.
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -2;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aRM;\nvarying vec2 vRM;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRM = aRM;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vRM;")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;");
  };
  m.customProgramCacheKey = () => "car-detail-rm";
  shared.detail = m;
  return m;
}

export function carbonMaterial(): THREE.MeshPhysicalMaterial {
  if (shared.carbon) return shared.carbon;
  const { map, normal } = carbonTextures();
  map.repeat.set(18, 18);
  normal.repeat.set(18, 18);
  const m = new THREE.MeshPhysicalMaterial({
    map,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.42,
    metalness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  m.name = "car-carbon";
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -2;
  shared.carbon = m;
  return m;
}

/**
 * Car glass, see-through. Blending is premultiplied so the reflection is
 * added at full strength while only the tint is scaled by opacity: real glass
 * reflects the sky just as brightly whether the cabin behind it is dark or
 * not. Opacity also climbs towards grazing angles (Fresnel), which is why a
 * windscreen seen edge-on is a mirror and seen head-on is a window.
 */
export function glassMaterial(): THREE.MeshPhysicalMaterial {
  if (shared.glass) return shared.glass;
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.03,
    metalness: 0,
    ior: 1.52,
    envMapIntensity: 1.25,
  });
  m.name = "car-glass";
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -2;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <opaque_fragment>",
        [
          "float carFres = pow( 1.0 - saturate( abs( dot( normal, normalize( vViewPosition ) ) ) ), 4.0 );",
          "float carAlpha = clamp( mix( diffuseColor.a, 1.0, carFres * 0.9 ), 0.0, 1.0 );",
          "gl_FragColor = vec4( totalDiffuse * carAlpha + totalSpecular + totalEmissiveRadiance, carAlpha );",
        ].join("\n"),
      )
      .replace("#include <premultiplied_alpha_fragment>", "");
  };
  m.customProgramCacheKey = () => "car-glass-fresnel";
  shared.glass = m;
  return m;
}

/** Glass for the medium and low models: dark, glossy and opaque, with no cabin behind it. */
export function glassOpaqueMaterial(): THREE.MeshPhysicalMaterial {
  if (shared.glassOpaque) return shared.glassOpaque;
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.03,
  });
  m.name = "car-glass-opaque";
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -2;
  shared.glassOpaque = m;
  return m;
}

export function tyreMaterial(slick: boolean): THREE.MeshStandardMaterial {
  const cached = slick ? shared.slick : shared.tyre;
  if (cached) return cached;
  const { map, normal } = tyreTextures(slick);
  const m = new THREE.MeshStandardMaterial({
    map,
    normalMap: normal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: slick ? 0.72 : 0.86,
    metalness: 0,
    envMapIntensity: 0.6,
  });
  m.name = slick ? "car-slick" : "car-tyre";
  if (slick) shared.slick = m;
  else shared.tyre = m;
  return m;
}

/**
 * Paint, one per car. The finish changes the layers, not just the numbers:
 * metallic has flake under a smooth clearcoat, pearl adds a thin-film colour
 * shift, matte loses the clearcoat altogether.
 */
export function createPaintMaterial(hex: string, finish: PaintFinish): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial();
  m.name = "car-paint";
  applyPaint(m, hex, finish);
  return m;
}

export function applyPaint(m: THREE.MeshPhysicalMaterial, hex: string, finish: PaintFinish): void {
  const colour = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#b0b4bb";
  m.color.set(colour);
  const flake = flakeTexture();
  flake.repeat.set(30, 30);
  m.normalMap = null;
  m.iridescence = 0;
  m.sheen = 0;
  m.clearcoat = 1;
  m.clearcoatRoughness = 0.035;
  m.envMapIntensity = 1;
  switch (finish) {
    case "solid":
      m.metalness = 0;
      m.roughness = 0.42;
      break;
    case "metallic":
      m.metalness = 0.62;
      m.roughness = 0.34;
      m.normalMap = flake;
      m.normalScale.set(0.22, 0.22);
      break;
    case "pearl":
      m.metalness = 0.38;
      m.roughness = 0.3;
      m.normalMap = flake;
      m.normalScale.set(0.12, 0.12);
      m.iridescence = 0.7;
      m.iridescenceIOR = 1.45;
      m.iridescenceThicknessRange = [220, 460];
      break;
    case "matte":
      m.metalness = 0.32;
      m.roughness = 0.58;
      m.clearcoat = 0;
      m.envMapIntensity = 0.85;
      break;
  }
  m.needsUpdate = true;
}

export interface LampState {
  head: boolean;
  brake: boolean;
}

/**
 * Every lamp on one car, in one material. Each vertex says what kind of lamp
 * it belongs to (`aLamp`), and the shader lights it from that kind's
 * uniform, so the brake pedal brightens the brake LEDs and nothing else.
 * Intensities are well above 1 so the bloom pass catches them.
 */
export function createLampMaterial(): { material: THREE.MeshStandardMaterial; set(state: LampState): void } {
  const uniforms = {
    uHead: { value: 0 },
    uDrl: { value: 3.2 },
    uTail: { value: 1.6 },
    uBrake: { value: 0 },
    uInd: { value: 0.05 },
    uRev: { value: 0 },
  };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0 });
  m.name = "car-lamps";
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -3;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aLamp;\nvarying float vLamp;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLamp = aLamp;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vLamp;\nuniform float uHead, uDrl, uTail, uBrake, uInd, uRev;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        [
          "#include <emissivemap_fragment>",
          "float lampK = 0.0;",
          "lampK += uHead * step( abs( vLamp - 1.0 ), 0.5 );",
          "lampK += uDrl * step( abs( vLamp - 2.0 ), 0.5 );",
          "lampK += uTail * step( abs( vLamp - 3.0 ), 0.5 );",
          "lampK += uBrake * step( abs( vLamp - 4.0 ), 0.5 );",
          "lampK += uInd * step( abs( vLamp - 5.0 ), 0.5 );",
          "lampK += uRev * step( abs( vLamp - 6.0 ), 0.5 );",
          "totalEmissiveRadiance = vColor.rgb * lampK;",
        ].join("\n"),
      );
  };
  m.customProgramCacheKey = () => "car-lamps";
  return {
    material: m,
    set(state) {
      uniforms.uHead.value = state.head ? 7 : 0;
      // Daytime running lights are always on; tail lamps light fully with the headlights.
      uniforms.uDrl.value = state.head ? 4.5 : 3.2;
      uniforms.uTail.value = state.head ? 2.4 : 1.6;
      uniforms.uBrake.value = state.brake ? 7.5 : 0;
    },
  };
}

/** Brake discs for one car: drilled (alpha-tested), and glowing from the rim inward as they heat. */
export function createDiscMaterial(): THREE.MeshStandardMaterial {
  const { map, alpha, emissive } = discTextures();
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaMap: alpha,
    alphaTest: 0.5,
    metalness: 0.85,
    roughness: 0.42,
    emissive: new THREE.Color(1, 1, 1),
    emissiveMap: emissive,
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
  });
  m.name = "car-disc";
  return m;
}

export function createDecalMaterial(sheet: DecalSheet): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    map: sheet.texture,
    alphaTest: 0.5,
    roughness: 0.38,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  m.name = "car-decals";
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -3;
  return m;
}
