import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Where every static piece of a car goes before it is drawn.
 *
 * A car is a few hundred parts (panels, lenses, louvres, bolts) but only a
 * handful of distinct materials, so parts are poured into one bucket per
 * material and each bucket is merged into a single mesh: one draw call per
 * material rather than per part. The `detail` bucket takes this furthest.
 * Gloss trim, matte plastic, chrome, rubber and the cabin all share one
 * material, with colour, roughness and metalness carried per vertex.
 */
export type Bucket = "paint" | "glass" | "detail" | "carbon" | "lamp" | "decal";

export const BUCKETS: readonly Bucket[] = ["paint", "glass", "detail", "carbon", "lamp", "decal"];

/**
 * What a lamp vertex does: whether it lights with the headlights, the brake
 * pedal, or always. The lamp material reads this per vertex and scales its
 * emissive accordingly, so every lamp on a car is one draw call that still
 * switches piecemeal.
 */
export const LampKind = {
  None: 0,
  Head: 1,
  Drl: 2,
  Tail: 3,
  Brake: 4,
  Indicator: 5,
  Reverse: 6,
} as const;
export type LampKind = (typeof LampKind)[keyof typeof LampKind];

/** How a part looks inside its bucket. Colours are sRGB hex, as written in a style guide. */
export interface Look {
  color?: number;
  alpha?: number;
  rough?: number;
  metal?: number;
  lamp?: LampKind;
}

const _c = new THREE.Color();

export class PartSink {
  private readonly lists = new Map<Bucket, THREE.BufferGeometry[]>();

  add(bucket: Bucket, geometry: THREE.BufferGeometry, look: Look = {}, matrix?: THREE.Matrix4): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) {
      g.applyMatrix4(matrix);
      // A mirroring matrix turns every triangle inside out; swapping two
      // corners of each puts the front faces back outside.
      if (matrix.determinant() < 0) flipWinding(g);
    }
    // Everything merged into a bucket must carry the same attributes, so the
    // ones a part did not set are filled with its constant look.
    const count = g.getAttribute("position").count;
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    for (const name of Object.keys(g.attributes)) {
      if (!["position", "normal", "uv", "color", "aRM", "aLamp"].includes(name)) g.deleteAttribute(name);
    }
    const colour = g.getAttribute("color");
    if (!colour || colour.itemSize !== 4) {
      _c.setHex(look.color ?? 0xffffff);
      const a = look.alpha ?? 1;
      const arr = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        if (colour) {
          arr[i * 4] = colour.getX(i);
          arr[i * 4 + 1] = colour.getY(i);
          arr[i * 4 + 2] = colour.getZ(i);
        } else {
          arr[i * 4] = _c.r;
          arr[i * 4 + 1] = _c.g;
          arr[i * 4 + 2] = _c.b;
        }
        arr[i * 4 + 3] = a;
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(arr, 4));
    }
    if (!g.getAttribute("aRM")) {
      const arr = new Float32Array(count * 2);
      const r = look.rough ?? 0.5;
      const m = look.metal ?? 0;
      for (let i = 0; i < count; i++) {
        arr[i * 2] = r;
        arr[i * 2 + 1] = m;
      }
      g.setAttribute("aRM", new THREE.Float32BufferAttribute(arr, 2));
    }
    if (!g.getAttribute("aLamp")) {
      const arr = new Float32Array(count).fill(look.lamp ?? 0);
      g.setAttribute("aLamp", new THREE.Float32BufferAttribute(arr, 1));
    }
    g.morphAttributes = {};
    g.clearGroups();
    let list = this.lists.get(bucket);
    if (!list) {
      list = [];
      this.lists.set(bucket, list);
    }
    list.push(g);
  }

  /** One merged geometry per bucket that received anything. */
  build(): Map<Bucket, THREE.BufferGeometry> {
    const out = new Map<Bucket, THREE.BufferGeometry>();
    for (const [bucket, list] of this.lists) {
      if (list.length === 0) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      // Each material reads only some of the attributes; the rest would be
      // uploaded for nothing.
      if (bucket === "paint" || bucket === "carbon") merged.deleteAttribute("color");
      if (bucket !== "detail") merged.deleteAttribute("aRM");
      if (bucket !== "lamp") merged.deleteAttribute("aLamp");
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      out.set(bucket, merged);
    }
    this.lists.clear();
    return out;
  }
}

/** Reverses every triangle of a non-indexed geometry, in every attribute. */
export function flipWinding(g: THREE.BufferGeometry): void {
  for (const name of Object.keys(g.attributes)) {
    const attr = g.getAttribute(name) as THREE.BufferAttribute;
    const s = attr.itemSize;
    const arr = attr.array as Float32Array;
    for (let t = 0; t + 2 < attr.count; t += 3) {
      for (let k = 0; k < s; k++) {
        const a = (t + 1) * s + k;
        const b = (t + 2) * s + k;
        const tmp = arr[a]!;
        arr[a] = arr[b]!;
        arr[b] = tmp;
      }
    }
    attr.needsUpdate = true;
  }
}

/** Writes per-vertex colours onto a geometry so its parts can differ inside one bucket. */
export function paintVertices(g: THREE.BufferGeometry, pick: (x: number, y: number, z: number) => number): void {
  const pos = g.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    _c.setHex(pick(pos.getX(i), pos.getY(i), pos.getZ(i)));
    arr[i * 3] = _c.r;
    arr[i * 3 + 1] = _c.g;
    arr[i * 3 + 2] = _c.b;
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
}

/** Sets a constant roughness/metalness attribute, for parts merged into the detail material by hand. */
export function setRM(g: THREE.BufferGeometry, rough: number, metal: number): void {
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    arr[i * 2] = rough;
    arr[i * 2 + 1] = metal;
  }
  g.setAttribute("aRM", new THREE.Float32BufferAttribute(arr, 2));
}
