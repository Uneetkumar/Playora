/**
 * Which opponents get an engine voice.
 *
 * Only the few nearest are voiced — a field of eight one-oscillator engines is
 * cheap, but eight engines at once is mud, and the cars that matter are the
 * ones beside you. Each voice keeps its car while that car stays near, because
 * handing a voice from one car to another mid-sound is heard as a pitch jump.
 */
export interface RivalCandidate {
  id: string;
  distance: number;
}

/**
 * The incumbent's advantage: a voiced car keeps its voice until a newcomer is
 * at least this much closer, so two cars at nearly equal distance do not trade
 * the voice every frame.
 */
const STICKINESS = 0.85;

/**
 * Assigns up to `previous.length` candidates to slots. A car that keeps its
 * voice keeps its slot; slots freed go to the nearest unvoiced cars; anything
 * beyond `maxDistance` is not voiced at all.
 */
export function assignRivalSlots(
  previous: ReadonlyArray<string | null>,
  candidates: ReadonlyArray<RivalCandidate>,
  maxDistance: number,
): Array<string | null> {
  const incumbents = new Set(previous.filter((id): id is string => id !== null));
  const nearest = candidates
    .filter((c) => Number.isFinite(c.distance) && c.distance <= maxDistance)
    .map((c) => ({ id: c.id, score: c.distance * (incumbents.has(c.id) ? STICKINESS : 1) }))
    .sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1))
    .slice(0, previous.length)
    .map((c) => c.id);

  const keep = new Set(nearest);
  const next = previous.map((id) => (id !== null && keep.has(id) ? id : null));
  const placed = new Set(next);
  for (const id of nearest) {
    if (placed.has(id)) continue;
    const free = next.indexOf(null);
    if (free < 0) break;
    next[free] = id;
    placed.add(id);
  }
  return next;
}

/** A stable ±2% pitch offset per car, so two voices at equal revs do not phase into one. */
export function rivalDetune(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 0.98 + ((h >>> 0) % 1000) / 1000 * 0.04;
}
