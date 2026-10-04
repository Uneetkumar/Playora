import { describe, it, expect } from "vitest";
import type { GameId } from "@playora/game-types";
import { GAME_CATALOG } from "../../../lib/games/catalog";
import { GAME_GENRES, GAME_META } from "../../../lib/games/meta";
import { gameViews } from "../../../lib/games/view";
import { parseBrowseParams } from "../../../lib/games/browse-url";
import { FRESH_LIMIT, HOME_SHELVES, freshGames, homeShelves } from "../home-shelves";

const ids = (list: readonly { id: GameId }[]) => list.map((g) => g.id);
const NOW = Date.parse("2026-10-03T00:00:00Z");

describe("HOME_SHELVES", () => {
  it("puts every genre on exactly one shelf, so no game is missing from the home page", () => {
    const placed = HOME_SHELVES.flatMap((s) => s.genres);
    expect([...placed].sort()).toEqual([...GAME_GENRES].sort());
  });

  it("runs in the order the home page promises", () => {
    expect(HOME_SHELVES.map((s) => s.title)).toEqual([
      "Racing",
      "Cards & Party",
      "Board & Strategy",
      "Arcade & Classics",
      "Puzzle",
    ]);
  });
});

describe("homeShelves", () => {
  const shelves = homeShelves(GAME_CATALOG);

  it("holds each game once across all shelves", () => {
    const all = shelves.flatMap((s) => ids(s.games));
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(ids(GAME_CATALOG).sort());
  });

  it("leads each shelf with its featured games", () => {
    for (const shelf of shelves) {
      const featured = shelf.games.map((g) => GAME_META[g.id].featured);
      const firstOther = featured.indexOf(false);
      if (firstOther !== -1) expect(featured.slice(firstOther)).not.toContain(true);
    }
    const cards = shelves.find((s) => s.id === "cards-party");
    expect(ids(cards?.games ?? []).slice(0, 2)).toEqual(["uno", "uno-no-mercy"]);
    expect(ids(shelves.find((s) => s.id === "board-strategy")?.games ?? [])[0]).toBe("chess");
  });

  it("links See all to Browse with the shelf's genres selected", () => {
    for (const shelf of shelves) {
      const query = shelf.href.split("?")[1] ?? "";
      expect(shelf.href.startsWith("/games?")).toBe(true);
      expect(parseBrowseParams(new URLSearchParams(query)).genres).toEqual(
        GAME_GENRES.filter((g) => shelf.genres.includes(g))
      );
    }
  });

  it("leaves out a shelf with nothing on it", () => {
    const racingOnly = GAME_CATALOG.filter((g) => GAME_META[g.id].genre === "Racing");
    expect(homeShelves(racingOnly).map((s) => s.id)).toEqual(["racing"]);
  });
});

describe("freshGames", () => {
  const views = gameViews({ now: NOW });

  it("holds only NEW and UPDATED games, newest release first, up to the limit", () => {
    const fresh = freshGames(views);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.length).toBeLessThanOrEqual(FRESH_LIMIT);
    for (const g of fresh) expect(["new", "updated"]).toContain(g.badge);
    const released = fresh.map((g) => g.releasedAt);
    expect([...released].sort().reverse()).toEqual(released);
  });

  it("is empty when nothing has changed lately", () => {
    const later = gameViews({ now: Date.parse("2027-06-01T00:00:00Z") });
    expect(freshGames(later)).toEqual([]);
  });
});
