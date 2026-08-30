import type { Outcome } from "./rating.js";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

/**
 * A snapshot of everything an achievement is allowed to look at.
 *
 * Achievements are evaluated on the server after a match, from values it has
 * just written. Passing a snapshot rather than a database handle keeps every
 * rule a pure function — which is what makes the whole catalogue testable
 * without a database, and what stops a rule from quietly issuing queries.
 */
export interface AchievementContext {
  totals: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    currentStreak: number;
    bestStreak: number;
    level: number;
    xp: number;
  };
  /** Per-game rating and record, keyed by game slug. */
  perGame: Record<
    string,
    { gamesPlayed: number; wins: number; rating: number; peakRating: number }
  >;
  /** The match that just finished, or null when re-evaluating in the background. */
  match: {
    gameSlug: string;
    outcome: Outcome;
    durationSeconds: number;
    reason: string;
    rated: boolean;
  } | null;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Icon name; the UI maps this to a component. Kept as data so this package stays UI-free. */
  icon: string;
  tier: AchievementTier;
  /** Contributes to a total the profile can show. */
  points: number;
  /**
   * Hidden in the list until unlocked.
   *
   * Used only where knowing the condition would spoil it or encourage
   * unsporting play — never to pad the list with mystery.
   */
  secret?: boolean;
  check: (ctx: AchievementContext) => boolean;
}

const TIER_POINTS: Record<AchievementTier, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  platinum: 100,
};

function def(
  id: string,
  tier: AchievementTier,
  name: string,
  description: string,
  icon: string,
  check: (ctx: AchievementContext) => boolean,
  secret = false,
): AchievementDef {
  return { id, name, description, icon, tier, points: TIER_POINTS[tier], check, ...(secret ? { secret } : {}) };
}

const played = (ctx: AchievementContext, slug: string): number =>
  ctx.perGame[slug]?.gamesPlayed ?? 0;

const wonAt = (ctx: AchievementContext, slug: string): number => ctx.perGame[slug]?.wins ?? 0;

/**
 * The achievement catalogue.
 *
 * Weighted towards *playing* rather than winning: a list where every entry
 * requires beating someone rewards the people who least need encouraging, and
 * gives a new player nothing to reach for in their first hour.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Getting started
  def("first-match", "bronze", "First Match", "Finish your first game.", "play",
    (c) => c.totals.gamesPlayed >= 1),
  def("first-win", "bronze", "First Win", "Win a game.", "trophy",
    (c) => c.totals.wins >= 1),
  def("first-draw", "bronze", "Deadlock", "Draw a game.", "handshake",
    (c) => c.totals.draws >= 1),

  // Volume
  def("played-10", "bronze", "Regular", "Finish 10 games.", "play",
    (c) => c.totals.gamesPlayed >= 10),
  def("played-50", "silver", "Committed", "Finish 50 games.", "play",
    (c) => c.totals.gamesPlayed >= 50),
  def("played-250", "gold", "Fixture", "Finish 250 games.", "play",
    (c) => c.totals.gamesPlayed >= 250),

  // Winning
  def("wins-10", "silver", "Winner", "Win 10 games.", "trophy",
    (c) => c.totals.wins >= 10),
  def("wins-100", "gold", "Champion", "Win 100 games.", "trophy",
    (c) => c.totals.wins >= 100),

  // Streaks
  def("streak-3", "bronze", "On a Roll", "Win 3 games in a row.", "flame",
    (c) => c.totals.bestStreak >= 3),
  def("streak-10", "gold", "Unstoppable", "Win 10 games in a row.", "flame",
    (c) => c.totals.bestStreak >= 10),

  // Levels
  def("level-5", "bronze", "Level 5", "Reach platform level 5.", "star",
    (c) => c.totals.level >= 5),
  def("level-20", "silver", "Level 20", "Reach platform level 20.", "star",
    (c) => c.totals.level >= 20),
  def("level-50", "platinum", "Level 50", "Reach platform level 50.", "star",
    (c) => c.totals.level >= 50),

  // Rating
  def("rated-1400", "silver", "Climbing", "Reach 1400 rating in any game.", "trending-up",
    (c) => Object.values(c.perGame).some((g) => g.peakRating >= 1400)),
  def("rated-1600", "gold", "Strong Player", "Reach 1600 rating in any game.", "trending-up",
    (c) => Object.values(c.perGame).some((g) => g.peakRating >= 1600)),
  def("rated-1800", "platinum", "Expert", "Reach 1800 rating in any game.", "trending-up",
    (c) => Object.values(c.perGame).some((g) => g.peakRating >= 1800)),

  // Per game
  def("chess-10", "bronze", "Board Sense", "Play 10 games of Chess.", "crown",
    (c) => played(c, "chess") >= 10),
  def("chess-win-25", "gold", "Grandmaster's Path", "Win 25 games of Chess.", "crown",
    (c) => wonAt(c, "chess") >= 25),
  def("uno-10", "bronze", "Card Sharp", "Play 10 games of UNO.", "layers",
    (c) => played(c, "uno") >= 10),
  def("uno-win-25", "gold", "Colour Caller", "Win 25 games of UNO.", "layers",
    (c) => wonAt(c, "uno") >= 25),
  def("no-mercy-win", "silver", "No Mercy", "Win a game of UNO No Mercy.", "skull",
    (c) => wonAt(c, "uno-no-mercy") >= 1),

  // Breadth
  def("all-games", "gold", "Well Rounded", "Play every game on the platform.", "grid",
    (c) => ["chess", "uno", "uno-no-mercy"].every((slug) => played(c, slug) >= 1)),

  // Match-shaped, so they need the match that just finished
  def("quick-win", "silver", "Lightning", "Win a game in under two minutes.", "zap",
    (c) => c.match !== null && c.match.outcome === "win" && c.match.durationSeconds < 120),
  def("marathon", "silver", "Marathon", "Finish a game lasting over 30 minutes.", "hourglass",
    (c) => c.match !== null && c.match.durationSeconds > 1800),
  def("comeback", "silver", "Held the Line", "Win a game your opponent resigned.", "shield",
    (c) => c.match !== null && c.match.outcome === "win" && c.match.reason === "resignation",
    true),
] as const;

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/**
 * Which achievements this context newly unlocks.
 *
 * Already-unlocked ids are passed in and skipped rather than re-checked, so an
 * achievement is awarded exactly once even though the conditions stay true
 * forever afterwards.
 */
export function evaluateAchievements(
  ctx: AchievementContext,
  alreadyUnlocked: readonly string[] = [],
): AchievementDef[] {
  const have = new Set(alreadyUnlocked);
  const unlocked: AchievementDef[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (have.has(achievement.id)) continue;
    try {
      if (achievement.check(ctx)) unlocked.push(achievement);
    } catch {
      // A rule that throws must not cost the player the rest of their
      // achievements, or their match result.
    }
  }
  return unlocked;
}

/** Total points from a set of unlocked ids, ignoring anything unrecognised. */
export function achievementPoints(unlocked: readonly string[]): number {
  return unlocked.reduce((sum, id) => sum + (ACHIEVEMENTS_BY_ID[id]?.points ?? 0), 0);
}
