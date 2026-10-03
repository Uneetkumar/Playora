import { describe, it, expect } from "vitest";
import type { GameId } from "@playora/game-types";
import { GAME_CATALOG, searchGames } from "../catalog";
import { GAME_GENRES, GAME_META } from "../meta";
import { gameViews, playerRange } from "../view";
import {
  GAME_SORTS,
  MODE_FILTERS,
  PLAYERS_FILTERS,
  filterGames,
  gamesByGenre,
  isGameSort,
  isModeFilter,
  isPlayersFilter,
  similarGames,
  sortGames,
} from "../browse";
import { capabilitiesFor, isSoloGame } from "../../play/modes";

const ids = (list: readonly { id: GameId }[]) => list.map((g) => g.id);
const NETWORKED: GameId[] = ["chess", "uno", "uno-no-mercy", "car-race", "bike-race"];

describe("filterGames", () => {
  it("returns the whole catalog, in order, when nothing is set", () => {
    expect(ids(filterGames({}))).toEqual(ids(GAME_CATALOG));
    expect(ids(filterGames({ genre: null, players: null, mode: null, q: "  " }))).toEqual(
      ids(GAME_CATALOG),
    );
  });

  it("filters by genre", () => {
    for (const genre of GAME_GENRES) {
      const result = filterGames({ genre });
      expect(result.length, genre).toBeGreaterThan(0);
      for (const g of result) expect(GAME_META[g.id].genre, g.id).toBe(genre);
    }
    expect(ids(filterGames({ genre: "Racing" }))).toEqual(["car-race", "bike-race"]);
  });

  it("filters by online mode to exactly the games with a server engine", () => {
    expect(ids(filterGames({ mode: "online" })).sort()).toEqual([...NETWORKED].sort());
  });

  it("filters by bot, local and solo modes from the capability table", () => {
    for (const g of filterGames({ mode: "ai" })) expect(capabilitiesFor(g.id)?.ai, g.id).toBe(true);
    const local = ids(filterGames({ mode: "local" }));
    expect(local).toContain("chess");
    expect(local).not.toContain("car-race");
    expect(local).not.toContain("battleship");
    const solo = ids(filterGames({ mode: "solo" }));
    expect(solo).toEqual(ids(GAME_CATALOG.filter((g) => isSoloGame(g.id))));
  });

  it("buckets player counts by the real range, not the advertised one", () => {
    const onePlayer = ids(filterGames({ players: "1p" }));
    expect(onePlayer).toContain("game-2048");
    expect(onePlayer).toContain("bomb-pass");
    expect(onePlayer).toContain("car-race");
    expect(onePlayer).not.toContain("chess");

    const duel = ids(filterGames({ players: "2p" }));
    expect(duel).toContain("chess");
    expect(duel).not.toContain("game-2048");

    const group = ids(filterGames({ players: "2-4p" }));
    expect(group).toContain("uno");
    expect(group).toContain("ludo");
    expect(group).not.toContain("chess");

    const party = ids(filterGames({ players: "party" }));
    expect(party).toEqual(expect.arrayContaining(["uno-no-mercy", "car-race", "bike-race"]));
    // Party-themed, but solo until it has a networked engine.
    expect(party).not.toContain("bomb-pass");
    for (const id of party) expect(playerRange(id).max, id).toBeGreaterThanOrEqual(5);
  });

  it("combines filters as AND", () => {
    const result = filterGames({ genre: "Cards", mode: "online" });
    expect(ids(result).sort()).toEqual(["uno", "uno-no-mercy"]);
    expect(filterGames({ genre: "Puzzle", mode: "online" })).toEqual([]);
  });

  it("orders query results by search relevance and still applies the other filters", () => {
    expect(ids(filterGames({ q: "uno" }))).toEqual(ids(searchGames("uno")));
    expect(ids(filterGames({ q: "race", genre: "Racing" }))).toEqual(["car-race", "bike-race"]);
    expect(filterGames({ q: "zzzz-no-such-game" })).toEqual([]);
  });

  it("works over any list of games, such as view-models", () => {
    const views = gameViews({ now: 0 });
    const result = filterGames({ genre: "Board" }, views);
    expect(result.every((v) => "playersLabel" in v)).toBe(true);
    expect(ids(result)).toEqual(ids(filterGames({ genre: "Board" })));
  });
});

describe("sortGames", () => {
  it("sorts A-Z by name, with numbers first", () => {
    const names = sortGames(GAME_CATALOG, "az").map((g) => g.name);
    expect(names[0]).toBe("2048");
    const rest = names.slice(1);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  });

  it("sorts newest release first", () => {
    const sorted = sortGames(GAME_CATALOG, "new");
    for (let i = 1; i < sorted.length; i++) {
      const prev = GAME_META[sorted[i - 1]!.id].releasedAt;
      const cur = GAME_META[sorted[i]!.id].releasedAt;
      expect(prev >= cur, `${sorted[i - 1]!.id} before ${sorted[i]!.id}`).toBe(true);
    }
  });

  it("puts featured games first when there are no live counts", () => {
    const sorted = sortGames(GAME_CATALOG, "popular");
    const featuredCount = GAME_CATALOG.filter((g) => GAME_META[g.id].featured).length;
    expect(sorted.slice(0, featuredCount).every((g) => GAME_META[g.id].featured)).toBe(true);
  });

  it("lets live counts lead popular", () => {
    const sorted = sortGames(GAME_CATALOG, "popular", { onlineCounts: { ludo: 50, pong: 10 } });
    expect(ids(sorted.slice(0, 2))).toEqual(["ludo", "pong"]);
  });

  it("returns a copy and leaves the input alone", () => {
    const input = [...GAME_CATALOG];
    const before = ids(input);
    const out = sortGames(input, "az");
    expect(out).not.toBe(input);
    expect(ids(input)).toEqual(before);
  });
});

describe("gamesByGenre", () => {
  it("shelves every game exactly once, in genre order", () => {
    const shelves = gamesByGenre();
    expect(shelves.map((s) => s.genre)).toEqual([...GAME_GENRES]);
    const all = shelves.flatMap((s) => ids(s.games));
    expect(all.sort()).toEqual(ids(GAME_CATALOG).sort());
  });

  it("leaves out genres with nothing in them", () => {
    const shelves = gamesByGenre(GAME_CATALOG.filter((g) => g.id === "chess"));
    expect(shelves).toEqual([{ genre: "Strategy", games: [expect.objectContaining({ id: "chess" })] }]);
  });
});

describe("similarGames", () => {
  it("never includes the game itself and never repeats one", () => {
    for (const g of GAME_CATALOG) {
      const similar = ids(similarGames(g.id, 8));
      expect(similar, g.id).not.toContain(g.id);
      expect(new Set(similar).size, g.id).toBe(similar.length);
      expect(similar, g.id).toHaveLength(8);
    }
  });

  it("leads with the same genre", () => {
    expect(similarGames("car-race", 1)[0]?.id).toBe("bike-race");
    expect(similarGames("uno", 1)[0]?.id).toBe("uno-no-mercy");
    const strategy = ids(similarGames("chess", 2));
    for (const id of strategy) expect(GAME_META[id].genre, id).toBe("Strategy");
  });

  it("returns nothing for n of zero, and at most every other game", () => {
    expect(similarGames("chess", 0)).toEqual([]);
    expect(similarGames("chess", 100)).toHaveLength(GAME_CATALOG.length - 1);
  });
});

describe("filter option lists", () => {
  it("guard URL values against the option ids", () => {
    for (const f of PLAYERS_FILTERS) expect(isPlayersFilter(f.id)).toBe(true);
    for (const f of MODE_FILTERS) expect(isModeFilter(f.id)).toBe(true);
    for (const s of GAME_SORTS) expect(isGameSort(s.id)).toBe(true);
    expect(isPlayersFilter("3p")).toBe(false);
    expect(isModeFilter("career")).toBe(false);
    expect(isGameSort("rating")).toBe(false);
  });

  it("offers the mode filters in chip order", () => {
    expect(MODE_FILTERS.map((m) => m.label)).toEqual(["Online", "vs Bot", "Local", "Solo"]);
  });
});
