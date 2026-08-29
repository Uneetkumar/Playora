/**
 * Matchmaking pairing rules.
 *
 * Pure functions with no Worker or storage dependency, so the fairness policy
 * can be tested exhaustively without spinning up a Durable Object. The queue
 * itself lives in MatchmakingDurableObject.
 */

export interface QueueEntry {
  userId: string;
  displayName: string;
  rating: number;
  /** Epoch ms the player joined the queue. */
  enqueuedAt: number;
  connectionId: string;
}

/**
 * Rating tolerance as a function of waiting time (spec section 5).
 *
 * Starts strict for a fair game and widens so nobody waits forever. The last
 * step is unbounded: after a minute, any opponent beats no opponent.
 */
export function ratingWindowFor(waitedMs: number): number {
  if (waitedMs < 10_000) return 50;
  if (waitedMs < 20_000) return 150;
  if (waitedMs < 40_000) return 400;
  if (waitedMs < 60_000) return 1000;
  return Number.POSITIVE_INFINITY;
}

/** Two players match only if each is inside the other's window — never one-sided. */
export function isCompatible(a: QueueEntry, b: QueueEntry, now: number): boolean {
  if (a.userId === b.userId) return false;
  const gap = Math.abs(a.rating - b.rating);
  return (
    gap <= ratingWindowFor(now - a.enqueuedAt) && gap <= ratingWindowFor(now - b.enqueuedAt)
  );
}

/**
 * Selects the next group to play, or null if nobody is compatible yet.
 *
 * The longest-waiting player anchors the match, so waiting is never punished,
 * and partners are chosen by closest rating for game quality.
 */
export function findMatch(
  entries: QueueEntry[],
  now: number,
  playersNeeded: number,
): QueueEntry[] | null {
  if (playersNeeded < 2 || entries.length < playersNeeded) return null;

  const byWait = [...entries].sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  const anchor = byWait[0];
  if (!anchor) return null;

  const candidates = byWait
    .slice(1)
    .filter((entry) => isCompatible(anchor, entry, now))
    .sort((a, b) => Math.abs(a.rating - anchor.rating) - Math.abs(b.rating - anchor.rating));

  if (candidates.length < playersNeeded - 1) return null;
  return [anchor, ...candidates.slice(0, playersNeeded - 1)];
}

/** Entries that have waited past the give-up threshold. */
export function findExpired(entries: QueueEntry[], now: number, timeoutMs: number): QueueEntry[] {
  return entries.filter((entry) => now - entry.enqueuedAt >= timeoutMs);
}
