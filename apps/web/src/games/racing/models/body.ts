import * as THREE from "three";
import { ShapeUtils } from "three";
import { clamp, endFalloff, smoothstep, toCurve, type Curve, type CurveLike } from "./curves";
import type { Bucket, Look, PartSink } from "./sink";
import type { CarQuality } from "./types";

/**
 * The body shell, lofted.
 *
 * A car body is a stack of cross-sections, nose to tail. Each section is a
 * rounded outline (underbody, sill, the swell of the door, the shoulder
 * crease, the glasshouse leaning in, the crowned roof) whose numbers come from
 * profile curves running the length of the car. Skinning them gives one
 * continuous, smooth surface, which is what makes reflections run along a
 * body the way they do on a real one; the box-and-extrusion bodies this
 * replaces could never do that.
 *
 * Rows of the loft are not spread evenly. Some sit exactly on features: the
 * belt line, the top and bottom edges of each side window, the edge of the
 * roof, the pillar and frit borders of the screens. So a window is simply the
 * band of quads between two rows, with a clean edge that follows the design,
 * and a wheel arch is a notch cut into the sections over the wheel, so the
 * opening is a true hole with a dark wheel well behind it.
 */

export interface EndCap {
  /** Plan view: how far from the tip the corners start to round, and how square they are (2 = round). */
  len: number;
  pow: number;
  /** Side view: the height everything converges to at the very tip. */
  yc: number;
  /** How far back the top (bonnet or boot) curls down to the tip, and how sharply. */
  topLen: number;
  topPow: number;
  /** The same for the bottom (chin or diffuser). */
  botLen: number;
  botPow: number;
}

export interface Arch {
  z: number;
  /** Centre height of the opening (around the axle, a touch above). */
  yc: number;
  r: number;
  /** x of the inboard wall of the wheel well. */
  xInner: number;
  /** Outward push of the bodywork right round the opening: a flared arch. */
  flare?: number;
  /** How far from the opening the flare fades out. */
  flareWidth?: number;
}

export interface SideWindow {
  /** Rear and front ends (z0 < z1). */
  z0: number;
  z1: number;
  /** Bottom and top edges of the glass, as heights along the car. */
  lo: CurveLike;
  hi: CurveLike;
  /** Corner radii at the rear and front ends; 0 lets the edges simply meet. */
  r0?: number;
  r1?: number;
}

export type SurfaceFinish = "paint" | "trim" | "carbon" | "chrome" | "matte";

export interface BodySpec {
  zFront: number;
  zRear: number;
  /** Underbody height on the centre line. */
  bottom: CurveLike;
  /** Widest half-width of the lower body, and the height it occurs at. */
  width: CurveLike;
  widthY: CurveLike;
  /** How far the sill tucks in under the widest point. */
  sillTuck: CurveLike;
  sillR: CurveLike;
  /** Rounding at the widest point: large makes a soft barrel side, small a hard crease. */
  sideR: CurveLike;
  /** Belt line (shoulder): height, half-width and crease radius. */
  belt: CurveLike;
  beltW: CurveLike;
  beltR: CurveLike;
  /** Edge where the side meets the top (roof rail, fender crest), and its rounding. */
  edge: CurveLike;
  edgeW: CurveLike;
  edgeR: CurveLike;
  /** Centre-line top height: bonnet, screen, roof, boot. */
  top: CurveLike;
  /** Shape of the top across the car: 2 parabolic, higher flatter in the middle. */
  topPow: CurveLike;
  /** Outward bow of the glasshouse side between belt and roof edge. */
  ghBulge: CurveLike;
  front: EndCap;
  rear: EndCap;
  arches: Arch[];
  windows: SideWindow[];
  /** z ranges across the side glass drawn as black trim (B-pillar, quarter-light divider). */
  dividers?: Array<readonly [number, number]>;
  /** Width of the black surround above and below each side window. */
  frame: number;
  frameFinish: SurfaceFinish;
  /** Roof rail / A-pillar width, measured in from the top edge. */
  pillar: number;
  /** The black ceramic border just inside the edge of the screens. */
  frit: number;
  windscreen?: { zHeader: number; zCowl: number; fritTop: number; fritBottom: number };
  rearGlass?: { zBottom: number; zTop: number; frit: number };
  roof?: { z0: number; z1: number; finish: SurfaceFinish };
  aPillar?: SurfaceFinish;
  /** z ranges where everything between the side glass and the roof edge is black (blacked-out pillars). */
  upperTrim?: Array<readonly [number, number]>;
  /** An open cockpit: the top is cut away here. */
  openTop?: { z0: number; z1: number };
  /** Where the cabin is, for the interior lining on the high model. */
  cabin?: { z0: number; z1: number };
  extraStations?: number[];
  /** Sideways push (m) for points on the side, for haunches, scallops and intakes. */
  displace?: (z: number, y: number) => number;
}

interface Params {
  yb: number;
  w: number;
  yw: number;
  sillTuck: number;
  sillR: number;
  sideR: number;
  yBelt: number;
  wBelt: number;
  beltR: number;
  yEdge: number;
  wEdge: number;
  edgeR: number;
  yTop: number;
  topPow: number;
  bulge: number;
}

interface Marks {
  iw0: number;
  iw1: number;
  side0: number;
  belt: number;
  ghTop: number;
  edge: number;
}

export interface Section {
  z: number;
  xs: number[];
  ys: number[];
  s: number[];
  ws: number[];
  marks: Marks;
}

type P2 = [number, number];

function polyLength(seg: P2[]): number {
  let L = 0;
  for (let i = 1; i < seg.length; i++) L += Math.hypot(seg[i]![0] - seg[i - 1]![0], seg[i]![1] - seg[i - 1]![1]);
  return L;
}

/** The stretch of a polyline between two distances along it, end points interpolated. */
function subPolyline(seg: P2[], d0: number, d1: number): P2[] {
  const out: P2[] = [];
  let acc = 0;
  const lerpP = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 1; i < seg.length; i++) {
    const a = seg[i - 1]!;
    const b = seg[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const s0 = acc;
    const s1 = acc + l;
    acc = s1;
    if (s1 < d0 || s0 > d1) continue;
    if (out.length === 0) out.push(l > 0 ? lerpP(a, b, clamp((d0 - s0) / l, 0, 1)) : a);
    if (s1 <= d1) out.push(b);
    else {
      out.push(l > 0 ? lerpP(a, b, clamp((d1 - s0) / l, 0, 1)) : b);
      break;
    }
  }
  if (out.length === 1) out.push(out[0]!);
  return out;
}

/**
 * A rounded polyline: segments joined end to end, each corner replaced by a
 * quadratic fillet reaching up to `radii[k]` along both neighbours. Returns
 * the points and, per corner, the index where its fillet starts and ends.
 */
function filletChain(segments: P2[][], radii: number[], fillet: number): { pts: P2[]; cornerStart: number[]; cornerEnd: number[] } {
  const lens = segments.map(polyLength);
  const trimStart: number[] = segments.map(() => 0);
  const trimEnd: number[] = segments.map(() => 0);
  // radii[k] is the corner between segment k-1 and segment k.
  for (let k = 1; k < segments.length; k++) {
    const r = Math.max(0, Math.min(radii[k] ?? 0, lens[k - 1]! * 0.45, lens[k]! * 0.45));
    trimEnd[k - 1] = r;
    trimStart[k] = r;
  }
  const pts: P2[] = [];
  const cornerStart: number[] = [];
  const cornerEnd: number[] = [];
  for (let k = 0; k < segments.length; k++) {
    const seg = segments[k]!;
    const part = subPolyline(seg, trimStart[k]!, lens[k]! - trimEnd[k]!);
    if (k > 0) {
      const from = pts[pts.length - 1]!;
      const corner = seg[0]!;
      const to = part[0]!;
      cornerStart.push(pts.length - 1);
      for (let i = 1; i < fillet; i++) {
        const t = i / fillet;
        const u = 1 - t;
        pts.push([u * u * from[0] + 2 * u * t * corner[0] + t * t * to[0], u * u * from[1] + 2 * u * t * corner[1] + t * t * to[1]]);
      }
      cornerEnd.push(pts.length);
    }
    for (const q of part) pts.push(q);
  }
  return { pts, cornerStart, cornerEnd };
}

function straight(a: P2, b: P2, step = 0.02): P2[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  return out;
}

function bowed(a: P2, b: P2, bulge: number, n = 16): P2[] {
  // Control point pushed out along the left normal of a->b, which for the
  // section's upward-running side is outboard (+x).
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const mx = (a[0] + b[0]) / 2 + (dy / len) * bulge * 2;
  const my = (a[1] + b[1]) / 2 - (dx / len) * bulge * 2;
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]);
  }
  return out;
}

export class Body {
  readonly spec: BodySpec;
  private readonly c: Record<keyof Omit<Params, never>, Curve>;
  private readonly winLo: Curve[];
  private readonly winHi: Curve[];

  constructor(spec: BodySpec) {
    this.spec = spec;
    this.c = {
      yb: toCurve(spec.bottom),
      w: toCurve(spec.width),
      yw: toCurve(spec.widthY),
      sillTuck: toCurve(spec.sillTuck),
      sillR: toCurve(spec.sillR),
      sideR: toCurve(spec.sideR),
      yBelt: toCurve(spec.belt),
      wBelt: toCurve(spec.beltW),
      beltR: toCurve(spec.beltR),
      yEdge: toCurve(spec.edge),
      wEdge: toCurve(spec.edgeW),
      edgeR: toCurve(spec.edgeR),
      yTop: toCurve(spec.top),
      topPow: toCurve(spec.topPow),
      bulge: toCurve(spec.ghBulge),
    };
    this.winLo = spec.windows.map((w) => toCurve(w.lo));
    this.winHi = spec.windows.map((w) => toCurve(w.hi));
  }

  params(z: number): Params {
    const c = this.c;
    const p: Params = {
      yb: c.yb(z),
      w: c.w(z),
      yw: c.yw(z),
      sillTuck: c.sillTuck(z),
      sillR: c.sillR(z),
      sideR: c.sideR(z),
      yBelt: c.yBelt(z),
      wBelt: c.wBelt(z),
      beltR: c.beltR(z),
      yEdge: c.yEdge(z),
      wEdge: c.wEdge(z),
      edgeR: c.edgeR(z),
      yTop: c.yTop(z),
      topPow: c.topPow(z),
      bulge: c.bulge(z),
    };
    // Keep the outline ordered whatever the curves say, so a stray key can
    // dent a body but never fold it inside out.
    p.wBelt = Math.min(p.wBelt, p.w - 0.002);
    p.wEdge = Math.min(p.wEdge, p.wBelt - 0.002);
    p.yBelt = Math.max(p.yBelt, p.yb + 0.08);
    p.yw = clamp(p.yw, p.yb + p.sillR + 0.02, p.yBelt - 0.02);
    p.yEdge = Math.max(p.yEdge, p.yBelt + 0.004);
    p.yTop = Math.max(p.yTop, p.yBelt - 0.25);
    return p;
  }

  /** The dense half-outline at z (x >= 0), bottom centre to top centre. */
  section(z: number): Section {
    const spec = this.spec;
    const p = this.params(z);
    const c1: P2 = [p.w - p.sillTuck, p.yb];
    const c2: P2 = [p.w, p.yw];
    const c3: P2 = [p.wBelt, p.yBelt];
    const c4: P2 = [p.wEdge, p.yEdge];
    // The top: from the edge in to the centre line along y = top + (edge - top) * (x / wEdge)^pow.
    const top: P2[] = [];
    const nTop = 28;
    for (let i = 0; i <= nTop; i++) {
      const f = 1 - i / nTop;
      // Sample denser near the edge, where the curvature is.
      const x = p.wEdge * Math.pow(f, 0.8);
      top.push([x, p.yTop + (p.yEdge - p.yTop) * Math.pow(x / Math.max(1e-6, p.wEdge), p.topPow)]);
    }
    top[top.length - 1] = [0, p.yTop];
    const segs: P2[][] = [straight([0, p.yb], c1), straight(c1, c2), straight(c2, c3), bowed(c3, c4, p.bulge), top];
    const radii = [0, p.sillR, p.sideR, p.beltR, p.edgeR];
    const chain = filletChain(segs, radii, 10);
    const pts = chain.pts;
    // Corner fillets: [sill, side, belt, edge].
    const beltMid = Math.round((chain.cornerStart[2]! + chain.cornerEnd[2]!) / 2);
    const ghTop = chain.cornerStart[3]!;
    const edge = chain.cornerEnd[3]!;
    const sillStart = chain.cornerStart[0]!;

    // The inboard wheel-well wall, on the underbody.
    let xIW = 0;
    let arch: Arch | null = null;
    for (const a of spec.arches) {
      xIW = Math.max(xIW, a.xInner);
      if (Math.abs(z - a.z) < a.r) arch = a;
    }
    xIW = Math.min(xIW, pts[sillStart]![0] - 0.01);
    // Split the outline at (xIW, yb) on the underbody run: `under` before it,
    // `rest` from it on. The marks are indices into `pts`; `mapIdx` carries
    // them across to the outline actually built.
    let iwIdx = 1;
    while (iwIdx < sillStart && pts[iwIdx]![0] < xIW) iwIdx++;
    const under = pts.slice(0, iwIdx);
    const dropFirst = Math.abs(pts[iwIdx]![0] - xIW) < 1e-4 ? 1 : 0;
    const rest = pts.slice(iwIdx + dropFirst);
    const iwPoint: P2 = [xIW, p.yb];
    let out: P2[];
    let restStart: number;
    let cutK = 0;
    let marks: Marks;
    if (arch) {
      const dz = z - arch.z;
      const yWell = Math.min(arch.yc + Math.sqrt(Math.max(0, arch.r * arch.r - dz * dz)), p.yBelt - 0.03);
      // First point up the outer side at or above the top of the opening.
      while (cutK < rest.length - 1 && !(rest[cutK]![1] >= yWell && rest[cutK]![0] > xIW)) cutK++;
      const a = rest[Math.max(0, cutK - 1)]!;
      const b = rest[cutK]!;
      const t = b[1] !== a[1] ? clamp((yWell - a[1]) / (b[1] - a[1]), 0, 1) : 0;
      const cut: P2 = [a[0] + (b[0] - a[0]) * t, yWell];
      out = [...under, iwPoint, [xIW, yWell], cut, ...rest.slice(cutK)];
      restStart = under.length + 3;
      marks = { iw0: under.length, iw1: under.length + 1, side0: under.length + 2, belt: 0, ghTop: 0, edge: 0 };
    } else {
      out = [...under, iwPoint, ...rest];
      restStart = under.length + 1;
      marks = { iw0: under.length, iw1: under.length, side0: under.length, belt: 0, ghTop: 0, edge: 0 };
    }
    const mapIdx = (k: number): number => {
      const inRest = k - iwIdx - dropFirst;
      if (inRest < cutK) return marks.side0;
      return restStart + (inRest - cutK);
    };
    marks.belt = mapIdx(beltMid);
    marks.ghTop = mapIdx(ghTop);
    marks.edge = mapIdx(edge);
    marks.belt = clamp(marks.belt, marks.side0, out.length - 1);
    marks.ghTop = clamp(marks.ghTop, marks.belt, out.length - 1);
    marks.edge = clamp(marks.edge, marks.ghTop, out.length - 1);

    // Flares and other sideways shaping, on the side-facing points only.
    const xs: number[] = new Array(out.length);
    const ys: number[] = new Array(out.length);
    for (let i = 0; i < out.length; i++) {
      xs[i] = out[i]![0];
      ys[i] = out[i]![1];
    }
    if (spec.displace || spec.arches.some((a) => a.flare)) {
      for (let i = marks.side0; i <= marks.edge; i++) {
        const prev = out[Math.max(0, i - 1)]!;
        const next = out[Math.min(out.length - 1, i + 1)]!;
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        const nx = ty / (Math.hypot(tx, ty) || 1);
        const weight = smoothstep(0.25, 0.75, nx);
        if (weight <= 0) continue;
        let push = spec.displace ? spec.displace(z, ys[i]!) : 0;
        for (const a of spec.arches) {
          if (!a.flare) continue;
          const d = Math.hypot(z - a.z, ys[i]! - a.yc) - a.r;
          const fw = a.flareWidth ?? 0.25;
          if (d > -0.01 && d < fw) push += a.flare * (1 - smoothstep(0, fw, Math.max(0, d)));
        }
        xs[i] = xs[i]! + push * weight;
      }
    }

    // Nose and tail: shrink in plan and draw in vertically towards the tip.
    const dF = spec.zFront - z;
    const dR = z - spec.zRear;
    const cap = dF < dR ? spec.front : spec.rear;
    const d = Math.min(dF, dR);
    const sPlan = endFalloff(d, cap.len, cap.pow);
    const sTop = endFalloff(d, cap.topLen, cap.topPow);
    const sBot = endFalloff(d, cap.botLen, cap.botPow);
    if (sPlan < 1 || sTop < 1 || sBot < 1) {
      for (let i = 0; i < xs.length; i++) {
        xs[i] = xs[i]! * sPlan;
        const y = ys[i]!;
        ys[i] = y > cap.yc ? cap.yc + (y - cap.yc) * sTop : cap.yc + (y - cap.yc) * sBot;
      }
    }

    const s: number[] = [0];
    const ws: number[] = [0];
    let prevAng = Math.atan2(ys[1]! - ys[0]!, xs[1]! - xs[0]!);
    for (let i = 1; i < xs.length; i++) {
      const dx = xs[i]! - xs[i - 1]!;
      const dy = ys[i]! - ys[i - 1]!;
      const l = Math.hypot(dx, dy);
      s.push(s[i - 1]! + l);
      const ang = l > 1e-7 ? Math.atan2(dy, dx) : prevAng;
      let turn = Math.abs(ang - prevAng);
      if (turn > Math.PI) turn = Math.PI * 2 - turn;
      prevAng = ang;
      ws.push(ws[i - 1]! + l + turn * 0.045);
    }
    return { z, xs, ys, s, ws, marks };
  }

  /** The window band (bottom, top) at z, or null if no side glass there. */
  windowBand(z: number): [number, number] | null {
    const ws = this.spec.windows;
    for (let k = 0; k < ws.length; k++) {
      const w = ws[k]!;
      if (z < w.z0 || z > w.z1) continue;
      let lo = this.winLo[k]!(z);
      let hi = this.winHi[k]!(z);
      const round = (dist: number, r: number): number => (r > 0 && dist < r ? r - Math.sqrt(Math.max(0, r * r - (r - dist) * (r - dist))) : 0);
      const cut = round(z - w.z0, w.r0 ?? 0) + round(w.z1 - z, w.r1 ?? 0);
      lo += cut;
      hi -= cut;
      if (hi < lo) hi = lo = (hi + lo) / 2;
      return [lo, hi];
    }
    return null;
  }

  inWindow(z: number): boolean {
    return this.spec.windows.some((w) => z > w.z0 && z < w.z1);
  }
}

// ── Rows ───────────────────────────────────────────────────────────────────

/** Row bands across a section, bottom centre to top centre. */
const Band = {
  Under: 0,
  WellWall: 1,
  WellRoof: 2,
  Side: 3,
  Sill: 4,
  FrameLo: 5,
  Glass: 6,
  FrameHi: 7,
  Upper: 8,
  Pillar: 9,
  Frit: 10,
  Top: 11,
} as const;
const BANDS = 12;

const ROW_COUNTS: Record<CarQuality, number[]> = {
  high: [3, 2, 3, 18, 3, 1, 6, 1, 6, 3, 1, 9],
  medium: [2, 1, 2, 9, 2, 1, 3, 1, 4, 2, 1, 5],
  low: [1, 1, 1, 5, 1, 1, 2, 1, 2, 1, 1, 2],
};

const STATION_STEP: Record<CarQuality, number> = { high: 0.034, medium: 0.075, low: 0.15 };
const END_STATIONS: Record<CarQuality, number> = { high: 16, medium: 8, low: 4 };

function sAtIndexValue(sec: Section, from: number, to: number, value: number, axis: "x" | "y", rising: boolean): number {
  const arr = axis === "x" ? sec.xs : sec.ys;
  if (rising ? value <= arr[from]! : value >= arr[from]!) return sec.s[from]!;
  for (let i = from + 1; i <= to; i++) {
    const v = arr[i]!;
    if (rising ? v >= value : v <= value) {
      const v0 = arr[i - 1]!;
      const t = v !== v0 ? (value - v0) / (v - v0) : 0;
      return sec.s[i - 1]! + (sec.s[i]! - sec.s[i - 1]!) * clamp(t, 0, 1);
    }
  }
  return sec.s[to]!;
}

/** Inverse of weighted arc length: the point at weighted distance `w`. */
function pointAtW(sec: Section, w: number): P2 {
  const ws = sec.ws;
  let lo = 0;
  let hi = ws.length - 1;
  if (w <= 0) return [sec.xs[0]!, sec.ys[0]!];
  if (w >= ws[hi]!) return [sec.xs[hi]!, sec.ys[hi]!];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ws[mid]! < w) lo = mid;
    else hi = mid;
  }
  const t = (w - ws[lo]!) / Math.max(1e-9, ws[hi]! - ws[lo]!);
  return [sec.xs[lo]! + (sec.xs[hi]! - sec.xs[lo]!) * t, sec.ys[lo]! + (sec.ys[hi]! - sec.ys[lo]!) * t];
}

function wAtS(sec: Section, s: number): number {
  const ss = sec.s;
  let lo = 0;
  let hi = ss.length - 1;
  if (s <= 0) return 0;
  if (s >= ss[hi]!) return sec.ws[hi]!;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ss[mid]! < s) lo = mid;
    else hi = mid;
  }
  const t = (s - ss[lo]!) / Math.max(1e-9, ss[hi]! - ss[lo]!);
  return sec.ws[lo]! + (sec.ws[hi]! - sec.ws[lo]!) * t;
}

function stationRows(body: Body, sec: Section, counts: number[]): { pts: P2[]; band: number[] } {
  const spec = body.spec;
  const m = sec.marks;
  const n = sec.xs.length - 1;
  const band = body.windowBand(sec.z);
  const yBelt = sec.ys[m.belt]!;
  const yGh = sec.ys[m.ghTop]!;
  let lo: number;
  let hi: number;
  if (band) {
    [lo, hi] = band;
  } else {
    lo = yBelt + (yGh - yBelt) * 0.45;
    hi = yBelt + (yGh - yBelt) * 0.55;
  }
  const sY = (y: number): number => sAtIndexValue(sec, m.belt, m.ghTop, y, "y", true);
  const xEdge = sec.xs[m.edge]!;
  const sX = (x: number): number => sAtIndexValue(sec, m.edge, n, x, "x", false);
  const anchors = [
    0,
    sec.s[m.iw0]!,
    sec.s[m.iw1]!,
    sec.s[m.side0]!,
    sec.s[m.belt]!,
    sY(lo - spec.frame),
    sY(lo),
    sY(hi),
    sY(hi + spec.frame),
    sec.s[m.edge]!,
    sX(xEdge - spec.pillar),
    sX(xEdge - spec.pillar - spec.frit),
    sec.s[n]!,
  ];
  for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i]!, anchors[i - 1]!);
  const pts: P2[] = [];
  const bandOf: number[] = [];
  for (let b = 0; b < BANDS; b++) {
    const w0 = wAtS(sec, anchors[b]!);
    const w1 = wAtS(sec, anchors[b + 1]!);
    const k = counts[b]!;
    for (let i = 0; i < k; i++) {
      pts.push(pointAtW(sec, w0 + ((w1 - w0) * i) / k));
      bandOf.push(b);
    }
  }
  pts.push([0, sec.ys[n]!]);
  bandOf.push(BANDS - 1);
  return { pts, band: bandOf };
}

function stationList(body: Body, quality: CarQuality): Array<{ z: number; feature: boolean }> {
  const spec = body.spec;
  const step = STATION_STEP[quality];
  const eps = 0.0006;
  const features: number[] = [spec.zRear, spec.zFront];
  const add = (...zs: number[]) => {
    for (const z of zs) if (z > spec.zRear && z < spec.zFront) features.push(z);
  };
  for (const a of spec.arches) add(a.z - a.r, a.z - a.r + eps, a.z, a.z + a.r - eps, a.z + a.r);
  for (const w of spec.windows) add(w.z0 - eps, w.z0, w.z1, w.z1 + eps);
  if (quality !== "low") {
    for (const [a, b] of spec.dividers ?? []) add(a, b);
    if (spec.windscreen) {
      const s = spec.windscreen;
      add(s.zHeader, s.zHeader + s.fritTop, s.zCowl - s.fritBottom, s.zCowl);
    }
    if (spec.rearGlass) {
      const r = spec.rearGlass;
      add(r.zBottom, r.zBottom + r.frit, r.zTop - r.frit, r.zTop);
    }
    if (spec.roof) add(spec.roof.z0, spec.roof.z1);
    for (const [a, b] of spec.upperTrim ?? []) add(a, b);
  } else {
    if (spec.windscreen) add(spec.windscreen.zHeader, spec.windscreen.zCowl);
    if (spec.rearGlass) add(spec.rearGlass.zBottom, spec.rearGlass.zTop);
  }
  if (spec.openTop) add(spec.openTop.z0, spec.openTop.z1);
  if (spec.cabin && quality === "high") add(spec.cabin.z0, spec.cabin.z1);
  add(...(spec.extraStations ?? []));
  const stations: Array<{ z: number; feature: boolean }> = features.map((z) => ({ z, feature: true }));
  // Ends: cosine spacing, dense at the tip where the outline turns fastest.
  const nEnd = END_STATIONS[quality];
  for (const [tip, cap, dir] of [
    [spec.zFront, spec.front, -1],
    [spec.zRear, spec.rear, 1],
  ] as const) {
    const len = Math.max(cap.len, cap.topLen, cap.botLen);
    for (let i = 1; i < nEnd; i++) {
      const f = 1 - Math.cos((i / nEnd) * (Math.PI / 2));
      stations.push({ z: tip + dir * f * len, feature: false });
    }
  }
  const zA = spec.zRear + Math.max(spec.rear.len, spec.rear.topLen, spec.rear.botLen);
  const zB = spec.zFront - Math.max(spec.front.len, spec.front.topLen, spec.front.botLen);
  const n = Math.max(2, Math.round((zB - zA) / step));
  for (let i = 0; i <= n; i++) stations.push({ z: zA + ((zB - zA) * i) / n, feature: false });
  stations.sort((a, b) => a.z - b.z);
  // Drop plain stations that crowd a feature; features always stay.
  const out: Array<{ z: number; feature: boolean }> = [];
  for (const st of stations) {
    if (!st.feature) {
      const near = stations.some((o) => o.feature && Math.abs(o.z - st.z) < step * 0.35);
      if (near) continue;
    }
    const last = out[out.length - 1];
    if (last && Math.abs(last.z - st.z) < 1e-6) continue;
    out.push(st);
  }
  return out;
}

// ── Height fields (for placing details on the surface) ─────────────────────

/**
 * The body seen from one side as a depth image. Details (lamps, grilles,
 * badges, panel gaps) are drawn in that view's 2D coordinates and dropped
 * onto the surface through it, so they follow the real curvature of the
 * shell, flares and all.
 */
export class HeightField {
  readonly na: number;
  readonly nb: number;
  readonly data: Float32Array;

  constructor(
    readonly a0: number,
    a1: number,
    readonly b0: number,
    b1: number,
    readonly cell: number,
  ) {
    this.na = Math.ceil((a1 - a0) / cell) + 1;
    this.nb = Math.ceil((b1 - b0) / cell) + 1;
    this.data = new Float32Array(this.na * this.nb).fill(Number.NEGATIVE_INFINITY);
  }

  triangle(a: P2, da: number, b: P2, db: number, c: P2, dc: number): void {
    const cell = this.cell;
    const minA = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - this.a0) / cell));
    const maxA = Math.min(this.na - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - this.a0) / cell));
    const minB = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - this.b0) / cell));
    const maxB = Math.min(this.nb - 1, Math.ceil((Math.max(a[1], b[1], c[1]) - this.b0) / cell));
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(det) < 1e-12) return;
    for (let j = minB; j <= maxB; j++) {
      const pb = this.b0 + j * cell;
      for (let i = minA; i <= maxA; i++) {
        const pa = this.a0 + i * cell;
        const l1 = ((b[1] - c[1]) * (pa - c[0]) + (c[0] - b[0]) * (pb - c[1])) / det;
        const l2 = ((c[1] - a[1]) * (pa - c[0]) + (a[0] - c[0]) * (pb - c[1])) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
        const d = l1 * da + l2 * db + l3 * dc;
        const k = j * this.na + i;
        if (d > this.data[k]!) this.data[k] = d;
      }
    }
  }

  /** Bilinear depth at (a, b), NaN where the body is not. */
  sample(a: number, b: number): number {
    const fa = (a - this.a0) / this.cell;
    const fb = (b - this.b0) / this.cell;
    const i = Math.floor(fa);
    const j = Math.floor(fb);
    const ta = fa - i;
    const tb = fb - j;
    let sum = 0;
    let wsum = 0;
    for (const [di, dj, w] of [
      [0, 0, (1 - ta) * (1 - tb)],
      [1, 0, ta * (1 - tb)],
      [0, 1, (1 - ta) * tb],
      [1, 1, ta * tb],
    ] as const) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= this.na || jj >= this.nb) continue;
      const v = this.data[jj * this.na + ii]!;
      if (!Number.isFinite(v)) continue;
      sum += v * w;
      wsum += w;
    }
    return wsum > 1e-6 ? sum / wsum : Number.NaN;
  }
}

export type View = "side" | "top" | "front" | "rear";

/** Point and normal on the body through one of its height fields. */
export class Surface {
  constructor(readonly fields: Record<View, HeightField>) {}

  /**
   * (a, b) are the view's own coordinates: side (z, y) on the +x side, top
   * (x, z), front (x, y), rear (x, y). Returns false off the body.
   */
  at(view: View, a: number, b: number, pos: THREE.Vector3, nrm: THREE.Vector3): boolean {
    const f = this.fields[view];
    const d = f.sample(a, b);
    if (!Number.isFinite(d)) return false;
    const h = f.cell * 1.5;
    const g = (da: number, db: number): number => {
      const v = f.sample(a + da, b + db);
      return Number.isFinite(v) ? v : d;
    };
    const dA = (g(h, 0) - g(-h, 0)) / (2 * h);
    const dB = (g(0, h) - g(0, -h)) / (2 * h);
    switch (view) {
      case "side":
        pos.set(d, b, a);
        nrm.set(1, -dB, -dA);
        break;
      case "top":
        pos.set(a, d, b);
        nrm.set(-dA, 1, -dB);
        break;
      case "front":
        pos.set(a, b, d);
        nrm.set(-dA, -dB, 1);
        break;
      case "rear":
        pos.set(a, b, -d);
        nrm.set(-dA, -dB, -1);
        break;
    }
    nrm.normalize();
    return true;
  }
}

// ── Building ───────────────────────────────────────────────────────────────

export interface Looks {
  trim: Look;
  matte: Look;
  well: Look;
  under: Look;
  chrome: Look;
  interior: Look;
  glass: Look;
}

export interface BodyResult {
  surface: Surface;
  /** Per station: z and the full loop of positions; used by the cabin and caps. */
  sections: (z: number) => Section;
  bounds: THREE.Box3;
}

/** Lofts the body into `sink` and returns the surface for detailing. */
export function buildBody(body: Body, quality: CarQuality, sink: PartSink, looks: Looks): BodyResult {
  const spec = body.spec;
  const counts = ROW_COUNTS[quality];
  const stations = stationList(body, quality);
  const S = stations.length;
  const half: P2[][] = [];
  let bandOf: number[] = [];
  for (const st of stations) {
    const sec = body.section(st.z);
    const rows = stationRows(body, sec, counts);
    half.push(rows.pts);
    bandOf = rows.band;
  }
  const H = half[0]!.length;
  const L = 2 * H - 2;
  // Full loop per station: up the +x side, then down the -x side.
  const pos = new Float32Array(S * L * 3);
  const vArc = new Float32Array(S * L);
  for (let i = 0; i < S; i++) {
    const z = stations[i]!.z;
    const h = half[i]!;
    let arc = 0;
    for (let j = 0; j < L; j++) {
      const k = j < H ? j : 2 * H - 2 - j;
      const pnt = h[k]!;
      const x = j < H ? pnt[0] : -pnt[0];
      const o = (i * L + j) * 3;
      pos[o] = x;
      pos[o + 1] = pnt[1];
      pos[o + 2] = z;
      if (j > 0) arc += Math.hypot(x - pos[o - 3]!, pnt[1] - pos[o - 2]!);
      vArc[i * L + j] = arc;
    }
  }
  const bandOfLoop = (j: number): number => (j < H - 1 ? bandOf[j]! : bandOf[2 * H - 3 - j]!);

  // Height fields from every quad, glass and cut-outs included.
  const bounds = new THREE.Box3();
  for (let k = 0; k < S * L; k++) bounds.expandByPoint(new THREE.Vector3(pos[k * 3]!, pos[k * 3 + 1]!, pos[k * 3 + 2]!));
  const cell = 0.008;
  const fields: Record<View, HeightField> = {
    side: new HeightField(bounds.min.z - 0.05, bounds.max.z + 0.05, bounds.min.y - 0.05, bounds.max.y + 0.05, cell),
    top: new HeightField(bounds.min.x - 0.05, bounds.max.x + 0.05, bounds.min.z - 0.05, bounds.max.z + 0.05, cell),
    front: new HeightField(bounds.min.x - 0.05, bounds.max.x + 0.05, bounds.min.y - 0.05, bounds.max.y + 0.05, cell),
    rear: new HeightField(bounds.min.x - 0.05, bounds.max.x + 0.05, bounds.min.y - 0.05, bounds.max.y + 0.05, cell),
  };
  const P = (i: number, j: number): [number, number, number] => {
    const o = (i * L + (j % L)) * 3;
    return [pos[o]!, pos[o + 1]!, pos[o + 2]!];
  };
  const raster = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    fields.side.triangle([a[2], a[1]], a[0], [b[2], b[1]], b[0], [c[2], c[1]], c[0]);
    fields.top.triangle([a[0], a[2]], a[1], [b[0], b[2]], b[1], [c[0], c[2]], c[1]);
    fields.front.triangle([a[0], a[1]], a[2], [b[0], b[1]], b[2], [c[0], c[1]], c[2]);
    fields.rear.triangle([a[0], a[1]], -a[2], [b[0], b[1]], -b[2], [c[0], c[1]], -c[2]);
  };
  for (let i = 0; i < S - 1; i++) {
    for (let j = 0; j < L; j++) {
      const a = P(i, j);
      const b = P(i + 1, j);
      const c = P(i, j + 1);
      const d = P(i + 1, j + 1);
      raster(a, c, b);
      raster(b, c, d);
    }
  }

  // Grid normals (area weighted), used to inset the cabin lining.
  const gridN = new Float32Array(S * L * 3);
  {
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const vc = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const addN = (i: number, j: number, n: THREE.Vector3) => {
      const o = (i * L + (j % L)) * 3;
      gridN[o] = gridN[o]! + n.x;
      gridN[o + 1] = gridN[o + 1]! + n.y;
      gridN[o + 2] = gridN[o + 2]! + n.z;
    };
    for (let i = 0; i < S - 1; i++) {
      for (let j = 0; j < L; j++) {
        for (const tri of [
          [
            [i, j],
            [i, j + 1],
            [i + 1, j],
          ],
          [
            [i + 1, j],
            [i, j + 1],
            [i + 1, j + 1],
          ],
        ] as const) {
          va.fromArray(P(tri[0][0], tri[0][1]));
          vb.fromArray(P(tri[1][0], tri[1][1]));
          vc.fromArray(P(tri[2][0], tri[2][1]));
          e1.subVectors(vb, va);
          e2.subVectors(vc, va);
          const n = e1.cross(e2);
          for (const [ti, tj] of tri) addN(ti, tj, n);
        }
      }
    }
  }

  // Classify every quad and pour it into its bucket.
  type Kind = "paint" | "glass" | "trim" | "matte" | "well" | "under" | "carbon" | "chrome" | "skip";
  const finishKind = (f: SurfaceFinish): Kind => f;
  const inRanges = (z: number, ranges?: Array<readonly [number, number]>) =>
    !!ranges && ranges.some(([a, b]) => z > Math.min(a, b) && z < Math.max(a, b));
  const classify = (bandIdx: number, z: number, zLen: number, ny: number): Kind => {
    if (zLen < 0.002) return bandIdx <= Band.Side ? "well" : "paint";
    const ws = spec.windscreen;
    const rg = spec.rearGlass;
    const inScreen = ws && z > ws.zHeader && z < ws.zCowl;
    const inRear = rg && z > rg.zBottom && z < rg.zTop;
    const inRoof = spec.roof && z > spec.roof.z0 && z < spec.roof.z1;
    const open = spec.openTop && z > spec.openTop.z0 && z < spec.openTop.z1;
    switch (bandIdx) {
      case Band.Under:
        return "under";
      case Band.WellWall:
      case Band.WellRoof:
        return "well";
      case Band.Side:
        return ny < -0.72 ? "under" : "paint";
      case Band.Sill:
        return "paint";
      case Band.FrameLo:
      case Band.FrameHi:
        return body.inWindow(z) ? finishKind(spec.frameFinish) : "paint";
      case Band.Glass:
        if (!body.inWindow(z)) return "paint";
        return inRanges(z, spec.dividers) ? "trim" : "glass";
      case Band.Upper:
        return inRanges(z, spec.upperTrim) ? "trim" : "paint";
      case Band.Pillar:
        if (open) return "paint";
        if (inScreen) return finishKind(spec.aPillar ?? "paint");
        if (inRoof) return finishKind(spec.roof!.finish);
        return "paint";
      case Band.Frit:
        if (open) return "paint";
        if (inScreen || inRear) return "trim";
        if (inRoof) return finishKind(spec.roof!.finish);
        return "paint";
      case Band.Top:
        if (open) return "skip";
        if (inScreen) return z < ws.zHeader + ws.fritTop || z > ws.zCowl - ws.fritBottom ? "trim" : "glass";
        if (inRear) return z < rg.zBottom + rg.frit || z > rg.zTop - rg.frit ? "trim" : "glass";
        if (inRoof) return finishKind(spec.roof!.finish);
        return "paint";
      default:
        return "paint";
    }
  };

  const seeThrough = quality === "high";
  type Out = { pos: number[]; uv: number[]; idx: number[]; map: Map<number, number> };
  const outs = new Map<Kind, Out>();
  const lining: number[] = [];
  const get = (k: Kind): Out => {
    let o = outs.get(k);
    if (!o) {
      o = { pos: [], uv: [], idx: [], map: new Map() };
      outs.set(k, o);
    }
    return o;
  };
  const vert = (o: Out, i: number, j: number): number => {
    const key = i * L + (j % L);
    let v = o.map.get(key);
    if (v === undefined) {
      v = o.pos.length / 3;
      o.pos.push(pos[key * 3]!, pos[key * 3 + 1]!, pos[key * 3 + 2]!);
      o.uv.push(pos[key * 3 + 2]!, j % L === 0 && j > 0 ? vArc[i * L + L - 1]! + 0.05 : vArc[key]!);
      o.map.set(key, v);
    }
    return v;
  };
  const cabin = seeThrough ? spec.cabin : undefined;
  const inset = 0.02;
  const insetPos = (i: number, j: number): [number, number, number] => {
    const o = (i * L + (j % L)) * 3;
    const nx = gridN[o]!;
    const ny = gridN[o + 1]!;
    const nz = gridN[o + 2]!;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [pos[o]! - (nx / len) * inset, pos[o + 1]! - (ny / len) * inset, pos[o + 2]! - (nz / len) * inset];
  };
  for (let i = 0; i < S - 1; i++) {
    const z0 = stations[i]!.z;
    const z1 = stations[i + 1]!.z;
    const zMid = (z0 + z1) / 2;
    for (let j = 0; j < L; j++) {
      const b = bandOfLoop(j);
      const o0 = (i * L + j) * 3 + 1;
      const o1 = (i * L + ((j + 1) % L)) * 3 + 1;
      const o2 = ((i + 1) * L + j) * 3 + 1;
      const o3 = ((i + 1) * L + ((j + 1) % L)) * 3 + 1;
      const ny = (gridN[o0]! + gridN[o1]! + gridN[o2]! + gridN[o3]!) / 4;
      const nl =
        Math.hypot(
          (gridN[o0 - 1]! + gridN[o1 - 1]! + gridN[o2 - 1]! + gridN[o3 - 1]!) / 4,
          ny,
          (gridN[o0 + 1]! + gridN[o1 + 1]! + gridN[o2 + 1]! + gridN[o3 + 1]!) / 4,
        ) || 1;
      let kind = classify(b, zMid, z1 - z0, ny / nl);
      if (kind === "skip" && !seeThrough && !spec.openTop) kind = "glass";
      if (kind === "skip") continue;
      const o = get(kind);
      const a = vert(o, i, j);
      const bb = vert(o, i + 1, j);
      const c = vert(o, i, j + 1);
      const d = vert(o, i + 1, j + 1);
      o.idx.push(a, c, bb, bb, c, d);
      if (cabin && zMid > cabin.z0 && zMid < cabin.z1 && kind !== "glass" && kind !== "well" && z1 - z0 > 0.002) {
        const A = insetPos(i, j);
        const B = insetPos(i + 1, j);
        const C = insetPos(i, j + 1);
        const D = insetPos(i + 1, j + 1);
        // Reversed winding: the lining faces into the cabin.
        lining.push(...A, ...B, ...C, ...B, ...D, ...C);
      }
    }
  }

  const bucketFor: Record<Kind, [Bucket, Look]> = {
    paint: ["paint", {}],
    glass: ["glass", looks.glass],
    trim: ["detail", looks.trim],
    matte: ["detail", looks.matte],
    well: ["detail", looks.well],
    under: ["detail", looks.under],
    carbon: ["carbon", {}],
    chrome: ["detail", looks.chrome],
    skip: ["detail", {}],
  };
  for (const [kind, o] of outs) {
    if (o.idx.length === 0) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(o.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(o.uv, 2));
    g.setIndex(o.idx);
    g.computeVertexNormals();
    const [bucket, look] = bucketFor[kind];
    sink.add(bucket, g, look);
    g.dispose();
  }
  if (lining.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(lining, 3));
    g.computeVertexNormals();
    sink.add("detail", g, looks.interior);
    g.dispose();
  }
  if (cabin) {
    // Bulkheads closing the cabin front and rear, so the windows show a
    // dark interior rather than the inside of the far panels.
    for (const [z, facing] of [
      [cabin.z1, -1],
      [cabin.z0, 1],
    ] as const) {
      const sec = body.section(z);
      const loop: THREE.Vector2[] = [];
      const step = Math.max(1, Math.floor(sec.xs.length / 40));
      for (let k = 0; k < sec.xs.length; k += step) loop.push(new THREE.Vector2(sec.xs[k]! * 0.97, sec.ys[k]!));
      loop.push(new THREE.Vector2(0, sec.ys[sec.ys.length - 1]! - 0.01));
      const full = [...loop, ...loop.slice(1, -1).reverse().map((v) => new THREE.Vector2(-v.x, v.y))];
      const tris = ShapeUtils.triangulateShape(full, []);
      const arr: number[] = [];
      for (const t of tris) {
        const order = facing > 0 ? [t[0]!, t[1]!, t[2]!] : [t[0]!, t[2]!, t[1]!];
        for (const k of order) arr.push(full[k]!.x, full[k]!.y, z - facing * 0.01);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      g.computeVertexNormals();
      // ShapeUtils winds clockwise in its own frame; make the cap face the cabin.
      const n = g.getAttribute("normal");
      if (n.count && Math.sign(n.getZ(0)) !== facing) {
        const flipped = g.toNonIndexed();
        sink.add("detail", flipped, looks.interior, new THREE.Matrix4().makeScale(-1, 1, 1));
        flipped.dispose();
      } else {
        sink.add("detail", g, looks.interior);
      }
      g.dispose();
    }
  }
  return { surface: new Surface(fields), sections: (z) => body.section(z), bounds };
}

