import { describe, it, expect } from "vitest";
import {
  seasonPhase,
  timeRemaining,
  seasonProgress,
  seasonStartRating,
  isPlaced,
  placementTier,
  placementLabel,
  formatTimeRemaining,
  SEASON_PLACEMENT_GAMES,
  MIN_POPULATION_FOR_PERCENTILES,
  type Season,
} from "../seasons.js";
import { BASE_RATING } from "../rating.js";

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

function season(overrides: Partial<Season> = {}): Season {
  return {
    id: "s1",
    slug: "season-1",
    name: "Season One",
    startsAt: START,
    endsAt: START + 30 * DAY,
    closedAt: null,
    ...overrides,
  };
}

describe("seasonPhase", () => {
  it("is upcoming before the start", () => {
    expect(seasonPhase(season(), START - 1)).toBe("upcoming");
  });

  it("is active on the first instant", () => {
    expect(seasonPhase(season(), START)).toBe("active");
  });

  it("is ended on the last instant, not after it", () => {
    // The bound is exclusive so that a season and its successor can share an
    // edge without a gap where neither is active.
    const s = season();
    expect(seasonPhase(s, s.endsAt - 1)).toBe("active");
    expect(seasonPhase(s, s.endsAt)).toBe("ended");
  });

  it("does not consult closedAt", () => {
    // A season past its end date is over whether or not the job that writes
    // placements has run yet.
    expect(seasonPhase(season({ closedAt: START }), START + 31 * DAY)).toBe("ended");
  });
});

describe("timeRemaining and progress", () => {
  it("never goes negative", () => {
    expect(timeRemaining(season(), START + 100 * DAY)).toBe(0);
  });

  it("clamps progress into 0..1", () => {
    expect(seasonProgress(season(), START - DAY)).toBe(0);
    expect(seasonProgress(season(), START + 15 * DAY)).toBe(0.5);
    expect(seasonProgress(season(), START + 90 * DAY)).toBe(1);
  });

  it("survives a zero-length season without dividing by zero", () => {
    expect(seasonProgress(season({ endsAt: START }), START)).toBe(1);
  });
});

describe("seasonStartRating", () => {
  it("starts a new player at the base rating", () => {
    expect(seasonStartRating(null)).toBe(BASE_RATING);
  });

  it("pulls a high rating down toward the base", () => {
    expect(seasonStartRating(2000)).toBe(1680);
  });

  it("pulls a low rating up toward the base, symmetrically", () => {
    // Not a bug: the reset also clears games_played, so an over-placed player
    // is provisional again and falls back at K=40 within a few games.
    expect(seasonStartRating(900)).toBe(1020);
  });

  it("leaves a player already at the base where they are", () => {
    expect(seasonStartRating(BASE_RATING)).toBe(BASE_RATING);
  });

  it("compresses the spread between two players", () => {
    const spreadBefore = 2000 - 900;
    const spreadAfter = seasonStartRating(2000) - seasonStartRating(900);
    expect(spreadAfter).toBeLessThan(spreadBefore);
  });
});

describe("placement eligibility", () => {
  it("requires the minimum number of games", () => {
    expect(isPlaced(SEASON_PLACEMENT_GAMES - 1)).toBe(false);
    expect(isPlaced(SEASON_PLACEMENT_GAMES)).toBe(true);
  });
});

describe("placementTier", () => {
  it("gives first place champion regardless of population", () => {
    expect(placementTier(1, 3)).toBe("champion");
    expect(placementTier(1, 5000)).toBe("champion");
  });

  it("does not hand out percentile tiers to a tiny population", () => {
    // Second of four is not "elite" in any meaningful sense.
    expect(placementTier(2, 4)).toBe("competitor");
    expect(placementTier(4, 4)).toBe("competitor");
    expect(placementTier(2, MIN_POPULATION_FOR_PERCENTILES - 1)).toBe("competitor");
  });

  it("bands by percentile once the population is large enough", () => {
    const total = 1000;
    expect(placementTier(10, total)).toBe("elite"); // top 1%
    expect(placementTier(11, total)).toBe("veteran"); // just outside 1%
    expect(placementTier(100, total)).toBe("veteran"); // top 10%
    expect(placementTier(250, total)).toBe("challenger"); // top 25%
    expect(placementTier(500, total)).toBe("competitor"); // top 50%
    expect(placementTier(501, total)).toBe("participant");
    expect(placementTier(1000, total)).toBe("participant");
  });

  it("never returns a better tier for a worse rank", () => {
    const total = 500;
    const order = ["champion", "elite", "veteran", "challenger", "competitor", "participant"];
    let previous = -1;
    for (let rank = 1; rank <= total; rank++) {
      const index = order.indexOf(placementTier(rank, total));
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });

  it("labels every tier", () => {
    for (const tier of ["champion", "elite", "veteran", "challenger", "competitor", "participant"] as const) {
      expect(placementLabel(tier)).not.toBe("");
    }
    expect(placementLabel("champion")).toBe("Champion");
  });
});

describe("formatTimeRemaining", () => {
  it("rounds down so the countdown never overpromises", () => {
    const s = season();
    // 1 day and 23 hours left is "1 day", not "2 days".
    expect(formatTimeRemaining(s, s.endsAt - DAY - 23 * 3600_000)).toBe("1 day left");
  });

  it("steps down through the units", () => {
    const s = season();
    expect(formatTimeRemaining(s, s.endsAt - 5 * DAY)).toBe("5 days left");
    expect(formatTimeRemaining(s, s.endsAt - 4 * 3600_000)).toBe("4 hours left");
    expect(formatTimeRemaining(s, s.endsAt - 90_000)).toBe("1 minute left");
    expect(formatTimeRemaining(s, s.endsAt - 5_000)).toBe("Ending now");
  });

  it("says Ended once it is over", () => {
    const s = season();
    expect(formatTimeRemaining(s, s.endsAt)).toBe("Ended");
  });
});
