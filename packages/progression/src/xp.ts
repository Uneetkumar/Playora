/**
 * Platform XP and level.
 *
 * Deliberately NOT a measure of skill (spec section 12): a player with more
 * games is not a better player. XP rewards showing up; rating measures ability.
 * Keeping them separate is why losing still earns XP.
 */

export const XP_REWARDS = {
  /** Awarded for finishing a match, win or lose. */
  matchCompleted: 20,
  win: 40,
  draw: 15,
  /** Small bonus so unrated offline/AI play still progresses the account. */
  unratedMultiplier: 0.5,
  /** Encourages finishing real games rather than farming quick abandons. */
  perMinuteCapped: 2,
  maxMinutesCounted: 10,
} as const;

export interface XpInput {
  outcome: "win" | "loss" | "draw";
  durationSeconds: number;
  /** False for AI and offline matches. */
  rated: boolean;
}

export function xpForMatch(input: XpInput): number {
  // Annotated: XP_REWARDS is `as const`, so inference would pin this to the
  // literal type 20 and reject every reassignment below.
  let xp: number = XP_REWARDS.matchCompleted;
  if (input.outcome === "win") xp += XP_REWARDS.win;
  if (input.outcome === "draw") xp += XP_REWARDS.draw;

  const minutes = Math.min(
    Math.floor(Math.max(0, input.durationSeconds) / 60),
    XP_REWARDS.maxMinutesCounted,
  );
  xp += minutes * XP_REWARDS.perMinuteCapped;

  if (!input.rated) xp = Math.round(xp * XP_REWARDS.unratedMultiplier);
  return xp;
}

/**
 * Total XP required to have reached a level.
 *
 * Mildly superlinear: early levels arrive quickly for a sense of progress,
 * later ones take longer without becoming a grind.
 */
export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return Math.round(100 * n + 25 * n * (n - 1));
}

export function levelForXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (totalXpForLevel(level + 1) <= safeXp) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0..1 through the current level, for a progress bar. */
  progress: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const floor = totalXpForLevel(level);
  const ceiling = totalXpForLevel(level + 1);
  const span = ceiling - floor;
  const into = xp - floor;
  return {
    level,
    xp,
    xpIntoLevel: into,
    xpForNextLevel: span,
    progress: span > 0 ? Math.min(1, into / span) : 0,
  };
}
