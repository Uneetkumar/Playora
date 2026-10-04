import { describe, it, expect } from "vitest";
import type { GameId } from "@playora/game-types";
import { GAME_CATALOG, searchGames } from "../catalog";
import { GAME_GENRES, GAME_META } from "../meta";
import { gameViews } from "../view";
import { filterGames, sortGames } from "../browse";
import {
  EMPTY_BROWSE,
  MAX_QUERY_LENGTH,
  browseHref,
  browseResults,
  effectiveSort,
  genreCounts,
  hasFilters,
  parseBrowseParams,
  serializeBrowseState,
  toggleGenre,
  type BrowseState,
} from "../browse-url";
import { GENRE_NAV } from "../../../components/shell/nav";

const ids = (list: readonly { id: GameId }[]) => list.map((g) => g.id);
const parse = (query: string) => parseBrowseParams(new URLSearchParams(query));
const state = (patch: Partial<BrowseState>): BrowseState => ({ ...EMPTY_BROWSE, ...patch });

describe("parseBrowseParams", () => {
  it("reads nothing as the empty state", () => {
    expect(parse("")).toEqual(EMPTY_BROWSE);
    expect(parseBrowseParams(null)).toEqual(EMPTY_BROWSE);
  });

  it("reads every field", () => {
    expect(parse("q=uno&genre=Cards&players=2-4p&mode=online&sort=new")).toEqual({
      genres: ["Cards"],
      players: "2-4p",
      mode: "online",
      sort: "new",
      q: "uno",
    });
  });

  it("takes genres repeated or comma-separated, in any case, in catalogue order, once each", () => {
    expect(parse("genre=party&genre=CARDS").genres).toEqual(["Cards", "Party"]);
    expect(parse("genre=Party,Cards,party").genres).toEqual(["Cards", "Party"]);
  });

  it("drops what it does not know rather than failing", () => {
    expect(parse("genre=Shooter&players=9p&mode=career&sort=rating")).toEqual(EMPTY_BROWSE);
  });

  it("trims the query and caps its length", () => {
    expect(parse("q=%20%20chess%20").q).toBe("chess");
    expect(parse(`q=${"x".repeat(200)}`).q).toHaveLength(MAX_QUERY_LENGTH);
  });
});

describe("serializeBrowseState", () => {
  it("writes nothing for the default state, so an untouched page is /games", () => {
    expect(serializeBrowseState(EMPTY_BROWSE)).toBe("");
    expect(browseHref()).toBe("/games");
  });

  it("round-trips through the URL", () => {
    const states: BrowseState[] = [
      state({ q: "uno" }),
      state({ genres: ["Cards", "Party"], players: "2-4p" }),
      state({ mode: "solo", sort: "az" }),
      state({ q: "race", sort: "popular", genres: ["Racing"] }),
    ];
    for (const s of states) expect(parse(serializeBrowseState(s))).toEqual(s);
  });

  it("writes fields in one order, so equal states give equal URLs", () => {
    expect(serializeBrowseState(state({ sort: "new", genres: ["Party", "Cards"], q: "x" }))).toBe(
      "q=x&genre=Cards&genre=Party&sort=new"
    );
  });

  it("leaves Popular out unless a search would otherwise order by relevance", () => {
    expect(serializeBrowseState(state({ sort: "popular" }))).toBe("");
    expect(serializeBrowseState(state({ sort: "popular", q: "uno" }))).toBe("q=uno&sort=popular");
  });

  it("spells a genre link the way the sidebar does", () => {
    for (const item of GENRE_NAV) {
      expect(browseHref({ genres: [item.genre] })).toBe(item.href);
      expect(parse(item.href.split("?")[1] ?? "").genres).toEqual([item.genre]);
    }
  });
});

describe("effectiveSort", () => {
  it("is relevance while searching and Popular otherwise, unless chosen", () => {
    expect(effectiveSort(state({}))).toBe("popular");
    expect(effectiveSort(state({ q: "uno" }))).toBe("relevance");
    expect(effectiveSort(state({ q: "   " }))).toBe("popular");
    expect(effectiveSort(state({ q: "uno", sort: "az" }))).toBe("az");
  });
});

describe("hasFilters and toggleGenre", () => {
  it("counts every narrowing field, and not the order", () => {
    expect(hasFilters(EMPTY_BROWSE)).toBe(false);
    expect(hasFilters(state({ sort: "az" }))).toBe(false);
    expect(hasFilters(state({ q: "  " }))).toBe(false);
    expect(hasFilters(state({ genres: ["Racing"] }))).toBe(true);
    expect(hasFilters(state({ players: "1p" }))).toBe(true);
    expect(hasFilters(state({ mode: "ai" }))).toBe(true);
    expect(hasFilters(state({ q: "uno" }))).toBe(true);
  });

  it("adds and removes a genre, keeping catalogue order", () => {
    expect(toggleGenre([], "Party")).toEqual(["Party"]);
    expect(toggleGenre(["Party"], "Cards")).toEqual(["Cards", "Party"]);
    expect(toggleGenre(["Cards", "Party"], "Cards")).toEqual(["Party"]);
  });
});

describe("browseResults", () => {
  const views = gameViews({ now: Date.parse("2026-10-03T00:00:00Z") });

  it("shows the whole catalogue, most popular first, by default", () => {
    expect(ids(browseResults(EMPTY_BROWSE, views))).toEqual(
      ids(sortGames(GAME_CATALOG, "popular"))
    );
  });

  it("treats several genres as any of them", () => {
    const result = browseResults(state({ genres: ["Cards", "Party"] }), views);
    expect(result.length).toBe(
      filterGames({ genre: "Cards" }).length + filterGames({ genre: "Party" }).length
    );
    for (const g of result) expect(["Cards", "Party"]).toContain(GAME_META[g.id].genre);
  });

  it("applies players and mode on top of the genres", () => {
    const result = browseResults(state({ genres: ["Cards", "Party"], players: "2-4p" }), views);
    expect(ids(result).sort()).toEqual(["uno", "uno-no-mercy"]);
  });

  it("orders a search by relevance until another order is chosen", () => {
    const relevance = ids(searchGames("race"));
    expect(ids(browseResults(state({ q: "race" }), views))).toEqual(relevance);
    const az = ids(browseResults(state({ q: "race", sort: "az" }), views));
    expect([...az].sort()).toEqual([...relevance].sort());
    expect(az).toEqual(ids(sortGames(searchGames("race"), "az")));
  });

  it("finds nothing for a combination no game has", () => {
    expect(browseResults(state({ genres: ["Racing"], mode: "solo" }), views)).toEqual([]);
  });
});

describe("genreCounts", () => {
  const views = gameViews({ now: Date.parse("2026-10-03T00:00:00Z") });

  it("counts every game once with no other filter", () => {
    const counts = genreCounts(EMPTY_BROWSE, views);
    expect(GAME_GENRES.reduce((sum, g) => sum + counts[g], 0)).toBe(GAME_CATALOG.length);
    for (const item of GENRE_NAV) expect(counts[item.genre]).toBe(item.count);
  });

  it("counts what each chip would show under the other filters, ignoring the genres chosen", () => {
    const s = state({ players: "2-4p", genres: ["Racing"] });
    const counts = genreCounts(s, views);
    for (const genre of GAME_GENRES) {
      expect(counts[genre], genre).toBe(browseResults({ ...s, genres: [genre] }, views).length);
    }
  });
});
