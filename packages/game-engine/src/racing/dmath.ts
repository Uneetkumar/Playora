/**
 * Trigonometry built only from + - * / and exact rounding.
 *
 * `Math.sin`, `Math.atan2` and friends are not specified to the last bit:
 * V8, SpiderMonkey and JavaScriptCore may disagree by an ulp. That is harmless
 * for a picture and fatal for a simulation that a server runs in V8 while a
 * Safari client predicts the same car — one ulp of heading becomes a metre of
 * position a lap later, and every reconciliation snaps the car. IEEE-754
 * arithmetic *is* exact and identical everywhere (JavaScript never fuses a
 * multiply-add), so polynomials evaluated with it replay bit-for-bit on every
 * engine. Accuracy is ~1e-11, far below anything the physics can feel.
 */

export const PI = 3.141592653589793;
export const HALF_PI = PI / 2;
export const TWO_PI = PI * 2;

/** Folds an angle onto (-pi, pi]. */
export function wrapAngle(x: number): number {
  if (x > -PI && x <= PI) return x;
  const turns = Math.round(x / TWO_PI);
  let r = x - turns * TWO_PI;
  if (r <= -PI) r += TWO_PI;
  if (r > PI) r -= TWO_PI;
  return r;
}

/** sin on [-pi/2, pi/2], Taylor through x^15 (error < 1e-11). */
function sinCore(r: number): number {
  const r2 = r * r;
  return (
    r *
    (1 -
      (r2 / 6) *
        (1 -
          (r2 / 20) *
            (1 -
              (r2 / 42) *
                (1 - (r2 / 72) * (1 - (r2 / 110) * (1 - (r2 / 156) * (1 - r2 / 210)))))))
  );
}

export function dsin(x: number): number {
  let r = wrapAngle(x);
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  return sinCore(r);
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

export function dtan(x: number): number {
  const c = dcos(x);
  return c === 0 ? Number.MAX_VALUE : dsin(x) / c;
}

const TAN_PI_12 = 0.2679491924311227;
const SQRT3 = 1.7320508075688772;

/** atan on [0, 1]. */
function atanUnit(x: number): number {
  // atan(x) = pi/6 + atan((x*sqrt3 - 1) / (x + sqrt3)) moves the argument
  // under tan(pi/12), where the series below converges to ~1e-12.
  let offset = 0;
  let y = x;
  if (y > TAN_PI_12) {
    offset = PI / 6;
    y = (y * SQRT3 - 1) / (y + SQRT3);
  }
  const y2 = y * y;
  // y - y^3/3 + y^5/5 - ... through y^19.
  let sum = 0;
  let term = y;
  let sign = 1;
  for (let k = 1; k <= 19; k += 2) {
    sum += (sign * term) / k;
    term *= y2;
    sign = -sign;
  }
  return offset + sum;
}

export function datan(x: number): number {
  if (x !== x) return x;
  const negative = x < 0;
  const a = negative ? -x : x;
  const r = a <= 1 ? atanUnit(a) : HALF_PI - atanUnit(1 / a);
  return negative ? -r : r;
}

export function datan2(y: number, x: number): number {
  if (x > 0) return datan(y / x);
  if (x < 0) return y >= 0 ? datan(y / x) + PI : datan(y / x) - PI;
  if (y > 0) return HALF_PI;
  if (y < 0) return -HALF_PI;
  return 0;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation through evenly spaced samples of x in [0, 1]. */
export function sampleCurve(samples: readonly number[], x: number): number {
  const n = samples.length - 1;
  if (n <= 0) return samples[0] ?? 0;
  const at = clamp(x, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(at));
  const t = at - i;
  const a = samples[i]!;
  const b = samples[i + 1]!;
  return a + (b - a) * t;
}
