/**
 * Profile curves: a value that varies along the car, given as keyframes.
 *
 * A car body is drawn the way a designer draws one, as a handful of lines
 * running nose to tail (roof line, belt line, plan outline...), and every
 * cross-section reads its numbers off those lines. The interpolation is
 * monotone (PCHIP), so a line never overshoots between two keys: a roof that
 * rises from 1.25 to 1.30 m does not bulge to 1.32 on the way. A key marked
 * sharp is a corner (where the windscreen meets the bonnet, say) instead of a
 * smooth bend.
 */

/** `[z, value]`, or `[z, value, 1]` for a corner at that key. */
export type Key = readonly [number, number] | readonly [number, number, 1];

export type Curve = (z: number) => number;
export type CurveLike = number | Curve | readonly Key[];

export function curve(keys: readonly Key[]): Curve {
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  const n = sorted.length;
  if (n === 0) return () => 0;
  if (n === 1) {
    const v = sorted[0]![1];
    return () => v;
  }
  const xs = sorted.map((k) => k[0]);
  const ys = sorted.map((k) => k[1]);
  const sharp = sorted.map((k) => k[2] === 1);
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = Math.max(1e-9, xs[i + 1]! - xs[i]!);
    h.push(dx);
    d.push((ys[i + 1]! - ys[i]!) / dx);
  }
  // Tangent leaving each key (right) and arriving at it (left). They only
  // differ at a sharp key, where each side keeps its own slope.
  const mR: number[] = new Array(n).fill(0);
  const mL: number[] = new Array(n).fill(0);
  mR[0] = d[0]!;
  mL[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const d0 = d[i - 1]!;
    const d1 = d[i]!;
    if (sharp[i]) {
      mL[i] = d0;
      mR[i] = d1;
      continue;
    }
    let m = 0;
    if (d0 * d1 > 0) {
      const w1 = 2 * h[i]! + h[i - 1]!;
      const w2 = h[i]! + 2 * h[i - 1]!;
      m = (w1 + w2) / (w1 / d0 + w2 / d1);
    }
    mL[i] = m;
    mR[i] = m;
  }
  return (z: number) => {
    if (z <= xs[0]!) return ys[0]!;
    if (z >= xs[n - 1]!) return ys[n - 1]!;
    // Few keys per curve, so a linear scan beats the bookkeeping of a search.
    let i = 0;
    while (i < n - 2 && z > xs[i + 1]!) i++;
    const t = (z - xs[i]!) / h[i]!;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i]! +
      (t3 - 2 * t2 + t) * h[i]! * mR[i]! +
      (-2 * t3 + 3 * t2) * ys[i + 1]! +
      (t3 - t2) * h[i]! * mL[i + 1]!
    );
  };
}

export function toCurve(c: CurveLike): Curve {
  if (typeof c === "number") return () => c;
  if (typeof c === "function") return c;
  return curve(c);
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * The end of a superellipse quadrant: 0 at d = 0, rising to 1 at d = len.
 * `pow` 2 is a circle; higher is squarer, which is how a bumper corner reads
 * from above: a broad front with tight corners rather than a bullet.
 */
export function endFalloff(d: number, len: number, pow: number): number {
  if (d <= 0) return 0;
  if (d >= len) return 1;
  const u = 1 - d / len;
  return Math.pow(1 - Math.pow(u, pow), 1 / pow);
}

/** Deterministic hash noise for procedural textures (no Math.random, so a texture looks the same every load). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
