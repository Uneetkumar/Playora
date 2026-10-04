import * as THREE from "three";
import { clamp, hash2, smoothstep } from "./curves";

/**
 * Every texture a car uses, painted on canvases at runtime. No image files:
 * the game ships no binary assets. Each is drawn once and shared, except the
 * contact shadow (one per body shape) and the decal sheet (one per car, since
 * it carries that car's race number).
 *
 * Patterns use a seeded hash rather than Math.random, so a texture is the
 * same on every load and in every screenshot.
 */

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

function texture(c: HTMLCanvasElement, colour: boolean, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * A tangent-space normal map from a height field, by central differences.
 * Lets a pattern drawn as light and dark (tread blocks, weave, drill holes)
 * also catch the light the way real relief does.
 */
function normalsFromHeight(h: Float32Array, w: number, hh: number, strength: number, wrapX = true, wrapY = true): HTMLCanvasElement {
  const { c, ctx } = canvas(w, hh);
  const img = ctx.createImageData(w, hh);
  const at = (x: number, y: number): number => {
    const xx = wrapX ? (x + w) % w : clamp(x, 0, w - 1);
    const yy = wrapY ? (y + hh) % hh : clamp(y, 0, hh - 1);
    return h[yy * w + xx]!;
  };
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      // Canvas rows run downwards but texture v runs up, so the y slope flips.
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const shared: {
  flake?: THREE.Texture;
  carbon?: { map: THREE.Texture; normal: THREE.Texture };
  tyre?: { map: THREE.Texture; normal: THREE.Texture };
  slick?: { map: THREE.Texture; normal: THREE.Texture };
  disc?: { map: THREE.Texture; alpha: THREE.Texture; emissive: THREE.Texture };
} = {};

/**
 * Metallic flake: each texel a slightly tilted mirror. Up close the paint
 * sparkles; from a distance the mipmaps average the tilts into the soft,
 * wide highlight that tells metallic paint from solid.
 */
export function flakeTexture(): THREE.Texture {
  if (shared.flake) return shared.flake;
  const n = 256;
  const { c, ctx } = canvas(n, n);
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = hash2(x, y, 11) * Math.PI * 2;
      const r = Math.pow(hash2(x, y, 12), 0.6) * 0.55;
      const nx = Math.cos(a) * r;
      const ny = Math.sin(a) * r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const i = (y * n + x) * 4;
      img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  shared.flake = texture(c, false);
  return shared.flake;
}

/** 2x2 twill carbon weave: tows alternate over two, under two, shifting one per row. */
export function carbonTextures(): { map: THREE.Texture; normal: THREE.Texture } {
  if (shared.carbon) return shared.carbon;
  const n = 256;
  const cells = 8;
  const cell = n / cells;
  const height = new Float32Array(n * n);
  const { c, ctx } = canvas(n, n);
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const horizontal = (cx + cy) % 4 < 2;
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      // Across a tow it is a shallow cylinder: bright down the middle, dark at
      // the edges where it dives under its neighbour.
      const across = horizontal ? fy : fx;
      const along = horizontal ? fx : fy;
      const bulge = Math.sin(across * Math.PI);
      const fibre = 0.85 + 0.15 * hash2(horizontal ? Math.floor(y / 1) : x, horizontal ? cx : cy, 3);
      const h = bulge * (0.75 + 0.25 * Math.sin(along * Math.PI));
      height[y * n + x] = h;
      const tone = (horizontal ? 0.75 : 1) * (0.25 + 0.75 * bulge) * fibre;
      const v = Math.round(14 + tone * 34);
      const i = (y * n + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v + 1;
      img.data[i + 2] = v + 4;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  shared.carbon = { map: texture(c, true), normal: texture(normalsFromHeight(height, n, n, 2.2), false) };
  return shared.carbon;
}

/**
 * Tyre sheet. u runs round the tyre; v runs across its profile from the inner
 * bead (0) over the tread to the outer bead (1). The tyre builder maps its
 * profile onto these fixed bands, so the texture knows where the tread is.
 */
export const TYRE_V = { treadStart: 0.3, treadEnd: 0.7 } as const;

export function tyreTextures(slick: boolean): { map: THREE.Texture; normal: THREE.Texture } {
  const cached = slick ? shared.slick : shared.tyre;
  if (cached) return cached;
  const w = 2048;
  const h = 512;
  const height = new Float32Array(w * h);
  const { c, ctx } = canvas(w, h);
  // Canvas y = 0 is texture v = 1 (the outer bead); y grows towards the inner bead.
  const yOf = (v: number): number => (1 - v) * h;
  ctx.fillStyle = "#1b1b1d";
  ctx.fillRect(0, 0, w, h);

  const tread0 = yOf(TYRE_V.treadEnd);
  const tread1 = yOf(TYRE_V.treadStart);
  const tw = tread1 - tread0;
  if (!slick) {
    // Four circumferential grooves and shoulder blocks: the pattern of a
    // modern asymmetric performance tyre, simplified.
    const grooves = [0.2, 0.41, 0.6, 0.79];
    for (let y = Math.floor(tread0); y < tread1; y++) {
      const f = (y - tread0) / tw;
      for (let x = 0; x < w; x++) {
        let hgt = 1;
        for (const g of grooves) {
          const d = Math.abs(f - g);
          if (d < 0.028) hgt = Math.min(hgt, smoothstep(0.012, 0.028, d));
        }
        // Lateral sipes on the shoulders, angled, every 1/96 of the tyre.
        const shoulder = f < 0.2 || f > 0.79;
        if (shoulder) {
          const u = (x / w) * 96 + (f < 0.5 ? f * 3 : -f * 3);
          const s = Math.abs(u - Math.round(u));
          if (s < 0.07) hgt = Math.min(hgt, smoothstep(0.03, 0.07, s));
        } else if (f > 0.41 && f < 0.6) {
          const u = (x / w) * 64 + f * 6;
          const s = Math.abs(u - Math.round(u));
          if (s < 0.03) hgt = Math.min(hgt, 0.5 + 0.5 * smoothstep(0.012, 0.03, s));
        }
        height[y * w + x] = hgt;
      }
    }
    const img = ctx.getImageData(0, 0, w, h);
    for (let y = Math.floor(tread0); y < tread1; y++) {
      for (let x = 0; x < w; x++) {
        const v = height[y * w + x]!;
        const i = (y * w + x) * 4;
        const tone = 14 + v * 16 + hash2(x, y, 5) * 4;
        img.data[i] = tone;
        img.data[i + 1] = tone;
        img.data[i + 2] = tone + 1;
      }
    }
    ctx.putImageData(img, 0, 0);
  } else {
    // A slick's tread is smooth rubber, scuffed with use.
    const img = ctx.getImageData(0, 0, w, h);
    for (let y = Math.floor(tread0); y < tread1; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const tone = 22 + hash2(x >> 2, y >> 1, 9) * 6;
        img.data[i] = tone;
        img.data[i + 1] = tone;
        img.data[i + 2] = tone;
        height[y * w + x] = 1;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  for (let y = 0; y < h; y++) {
    if (y >= tread0 && y < tread1) continue;
    for (let x = 0; x < w; x++) height[y * w + x] = 0.6;
  }

  // Outer sidewall lettering. Real sidewall text is moulded, so it is nearly
  // the colour of the rubber: lighter only where it catches the light.
  const side0 = 0;
  const side1 = yOf(TYRE_V.treadEnd);
  const mid = (side0 + side1) * 0.5;
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (const at of [0.25, 0.75]) {
    ctx.save();
    ctx.translate(at * w, mid);
    // Turned half round so the tops of the letters face the tread.
    ctx.rotate(Math.PI);
    if (slick) {
      ctx.fillStyle = "#e8e8ea";
      ctx.font = "800 46px Arial, Helvetica, sans-serif";
      ctx.fillText("PLAYORA", 0, -4);
      ctx.fillStyle = "#e0242b";
      ctx.font = "800 26px Arial, Helvetica, sans-serif";
      ctx.fillText("P ZERO-S", 0, 34);
    } else {
      ctx.fillStyle = "#3a3a3e";
      ctx.font = "700 50px Arial, Helvetica, sans-serif";
      ctx.fillText("PLAYORA", 0, -8);
      ctx.font = "600 22px Arial, Helvetica, sans-serif";
      ctx.fillText("RS-1 SPORT   245/35 ZR20 91Y", 0, 36);
    }
    ctx.restore();
  }
  if (slick) {
    // The compound band, red for soft, round the whole sidewall.
    ctx.fillStyle = "#d81f26";
    ctx.fillRect(0, side1 - 30, w, 12);
  }
  ctx.restore();
  const lettering = ctx.getImageData(0, 0, w, Math.ceil(side1));
  for (let y = 0; y < Math.ceil(side1); y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = lettering.data[i]! / 255;
      if (lum > 0.13) height[y * w + x] = 0.6 + (lum - 0.1) * 0.8;
    }
  }
  // The rim protector rib just above the bead, a darker band.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, w, 10);
  ctx.fillRect(0, h - 10, w, 10);

  const result = { map: texture(c, true), normal: texture(normalsFromHeight(height, w, h, 3, true, false), false) };
  result.map.wrapT = THREE.ClampToEdgeWrapping;
  result.normal.wrapT = THREE.ClampToEdgeWrapping;
  if (slick) shared.slick = result;
  else shared.tyre = result;
  return result;
}

/**
 * Brake disc face, mapped flat across the disc (u, v from -r to r). The
 * alpha cuts the cross-drilling right through, so the caliper behind shows
 * through the holes; the emissive is the heat that builds on the outer
 * friction ring first.
 */
export const DISC_HOLE = { inner: 0.62, outer: 0.93 } as const;

export function discTextures(): { map: THREE.Texture; alpha: THREE.Texture; emissive: THREE.Texture } {
  if (shared.disc) return shared.disc;
  const n = 512;
  const half = n / 2;
  const a = canvas(n, n);
  const m = canvas(n, n);
  const e = canvas(n, n);
  const alpha = a.ctx.createImageData(n, n);
  const map = m.ctx.createImageData(n, n);
  const emit = e.ctx.createImageData(n, n);
  // Three staggered rows of holes, offset per row, which is how drilled
  // discs are patterned so no two holes share a radial line.
  const holes: Array<[number, number, number]> = [];
  const rows = 3;
  const per = 18;
  for (let r = 0; r < rows; r++) {
    const rad = DISC_HOLE.inner + (r + 0.5) * ((DISC_HOLE.outer - DISC_HOLE.inner) / rows);
    for (let k = 0; k < per; k++) {
      const ang = ((k + r / rows) / per) * Math.PI * 2;
      holes.push([Math.cos(ang) * rad, Math.sin(ang) * rad, 0.026]);
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x - half + 0.5) / half;
      const v = (y - half + 0.5) / half;
      const r = Math.hypot(u, v);
      let hole = 1;
      for (const [hx, hy, hr] of holes) {
        const d = Math.hypot(u - hx, v - hy);
        if (d < hr + 0.01) hole = Math.min(hole, smoothstep(hr - 0.004, hr + 0.004, d));
      }
      const i = (y * n + x) * 4;
      const ring = r > 0.56;
      const op = ring ? hole : 1;
      alpha.data[i] = alpha.data[i + 1] = alpha.data[i + 2] = Math.round(op * 255);
      alpha.data[i + 3] = 255;
      // Friction ring: machined, with concentric scoring; the hat: darker cast iron.
      const score = 0.9 + 0.1 * Math.sin(r * 900) * hash2(Math.round(r * 300), 0, 4);
      const base = ring ? 150 * score : 70;
      const rim = op < 1 ? 40 : base;
      map.data[i] = map.data[i + 1] = rim;
      map.data[i + 2] = rim + 4;
      map.data[i + 3] = 255;
      const heat = ring ? smoothstep(0.56, 0.98, r) : 0;
      emit.data[i] = Math.round(255 * heat);
      emit.data[i + 1] = Math.round(120 * heat * heat);
      emit.data[i + 2] = Math.round(30 * heat * heat * heat);
      emit.data[i + 3] = 255;
    }
  }
  a.ctx.putImageData(alpha, 0, 0);
  m.ctx.putImageData(map, 0, 0);
  e.ctx.putImageData(emit, 0, 0);
  shared.disc = { map: texture(m.c, true, false), alpha: texture(a.c, false, false), emissive: texture(e.c, true, false) };
  return shared.disc;
}

/**
 * The soft dark patch under a car, where the sky cannot reach. Shadow maps
 * give the car's cast shadow; this is the ambient occlusion they miss, and on
 * low quality it is the only thing keeping a car on the road. Darkest under
 * each tyre, where the car actually touches.
 */
export function contactShadowTexture(length: number, width: number, wheelbase: number, track: number, tyreW: number): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const { c, ctx } = canvas(w, h);
  const img = ctx.createImageData(w, h);
  // The texture spans the car plus a margin all round.
  const spanX = width + 0.9;
  const spanZ = length + 0.9;
  const hx = width / 2 - 0.06;
  const hz = length / 2 - 0.12;
  const rr = 0.35;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = ((x + 0.5) / w - 0.5) * spanX;
      const pz = ((y + 0.5) / h - 0.5) * spanZ;
      // Signed distance to a rounded rectangle the size of the floor pan.
      const qx = Math.abs(px) - (hx - rr);
      const qz = Math.abs(pz) - (hz - rr);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rr;
      let a = 0.62 * (1 - smoothstep(-0.35, 0.42, outside));
      for (const sz of [-1, 1]) {
        for (const sx of [-1, 1]) {
          const dx = Math.abs(px - (sx * track) / 2) - tyreW / 2;
          const dz = Math.abs(pz - (sz * wheelbase) / 2) - 0.1;
          const d = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
          a = Math.max(a, 0.9 * (1 - smoothstep(-0.05, 0.16, d)));
        }
      }
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = texture(c, true, false);
  return t;
}

/**
 * A car's own decal sheet, 512 x 256. The left square is the race-number
 * roundel; the right half holds flat swatches that livery stripes sample,
 * so stripes recolour when the paint changes by redrawing this sheet rather
 * than rebuilding geometry.
 */
export const DECAL_UV = {
  roundel: { u0: 0, v0: 0, u1: 0.5, v1: 1 },
  swatchA: { u: 0.62, v: 0.5 },
  swatchB: { u: 0.88, v: 0.5 },
  white: { u: 0.62, v: 0.12 },
  black: { u: 0.88, v: 0.12 },
} as const;

export interface DecalSheet {
  texture: THREE.CanvasTexture;
  draw(number: number | undefined, accentA: string, accentB: string): void;
}

export function createDecalSheet(): DecalSheet {
  const { c, ctx } = canvas(512, 256);
  const tex = texture(c, true, false);
  return {
    texture: tex,
    draw(number, accentA, accentB) {
      ctx.clearRect(0, 0, 512, 256);
      // Swatches (opaque) on the right; the alpha test keeps their edges crisp.
      ctx.fillStyle = accentA;
      ctx.fillRect(256, 0, 128, 128);
      ctx.fillStyle = accentB;
      ctx.fillRect(384, 0, 128, 128);
      ctx.fillStyle = "#f4f4f2";
      ctx.fillRect(256, 128, 128, 128);
      ctx.fillStyle = "#0b0b0c";
      ctx.fillRect(384, 128, 128, 128);
      if (number !== undefined) {
        ctx.fillStyle = "#f4f4f2";
        ctx.beginPath();
        ctx.arc(128, 128, 118, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#0b0b0c";
        ctx.stroke();
        ctx.fillStyle = "#0b0b0c";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = String(Math.max(0, Math.min(999, Math.round(number))));
        ctx.font = `900 ${label.length > 2 ? 104 : 150}px Arial, Helvetica, sans-serif`;
        ctx.fillText(label, 128, 138);
      }
      tex.needsUpdate = true;
    },
  };
}
