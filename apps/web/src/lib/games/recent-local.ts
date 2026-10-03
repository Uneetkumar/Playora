/**
 * Recently played, for people who are not signed in.
 *
 * Most visitors to a casual games site never make an account, and telling them
 * "sign in to see what you played" is a worse experience than remembering it
 * locally. The shape matches the `recently_played` table exactly, so the
 * signed-in and signed-out paths render from the same type and the list can be
 * merged into the account later without a second format to migrate.
 *
 * Pure functions over a passed-in store, so the ordering and capping rules are
 * testable without a browser.
 */

export interface RecentEntry {
  gameSlug: string;
  /** ISO timestamp. */
  lastPlayedAt: string;
  playCount: number;
}

export const RECENT_STORAGE_KEY = "playora:recent";
/**
 * How many to keep.
 *
 * Enough to fill a shelf twice over; beyond that it is not "recent" any more,
 * and localStorage is a small, synchronous budget shared with everything else
 * on the origin.
 */
export const MAX_RECENT = 24;

/** Minimal storage surface, so tests do not need a DOM. */
export interface RecentStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function safeStore(): RecentStore | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    // Private browsing, or storage blocked by policy.
    return null;
  }
}

/**
 * Reads the list, newest first.
 *
 * Anything malformed is discarded rather than thrown: this is a convenience
 * feature, and a corrupt entry should cost the shelf, not the page.
 */
export function readRecent(store: RecentStore | null = safeStore()): RecentEntry[] {
  if (!store) return [];
  try {
    const raw = store.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const entries = parsed.filter(isEntry);
    return sortRecent(entries);
  } catch {
    return [];
  }
}

function isEntry(value: unknown): value is RecentEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.gameSlug === "string" &&
    e.gameSlug.length > 0 &&
    typeof e.lastPlayedAt === "string" &&
    typeof e.playCount === "number" &&
    Number.isFinite(e.playCount)
  );
}

function sortRecent(entries: RecentEntry[]): RecentEntry[] {
  return [...entries].sort(
    (a, b) => Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt),
  );
}

/**
 * Records a play and returns the new list.
 *
 * Upserts by slug rather than appending, so playing the same game twice moves
 * it to the front instead of filling the shelf with itself.
 */
export function recordLocalPlay(
  gameSlug: string,
  store: RecentStore | null = safeStore(),
  now: Date = new Date(),
): RecentEntry[] {
  const current = readRecent(store);
  const existing = current.find((e) => e.gameSlug === gameSlug);

  const updated: RecentEntry = {
    gameSlug,
    lastPlayedAt: now.toISOString(),
    playCount: (existing?.playCount ?? 0) + 1,
  };

  const next = sortRecent([
    updated,
    ...current.filter((e) => e.gameSlug !== gameSlug),
  ]).slice(0, MAX_RECENT);

  write(next, store);
  return next;
}

export function clearLocalRecent(store: RecentStore | null = safeStore()): void {
  if (!store) return;
  try {
    store.removeItem(RECENT_STORAGE_KEY);
  } catch {
    // Nothing to do — the list is a convenience, not state we own.
  }
}

function write(entries: RecentEntry[], store: RecentStore | null): void {
  if (!store) return;
  try {
    store.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or storage blocked. Losing the shelf is acceptable;
    // throwing on the way into a game is not.
  }
}
