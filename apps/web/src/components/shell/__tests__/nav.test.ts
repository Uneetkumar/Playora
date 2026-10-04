import { describe, it, expect } from "vitest";
import { GENRE_NAV, NAV, isNavActive } from "../nav";

const genreItem = (genre: string) => {
  const item = GENRE_NAV.find((g) => g.genre === genre);
  if (!item) throw new Error(`no genre shortcut for ${genre}`);
  return item;
};

describe("isNavActive", () => {
  it("lights every genre Browse is filtered by, and only those", () => {
    const active = GENRE_NAV.filter((item) => isNavActive(item, "/games", ["Cards", "Party"])).map((i) => i.genre);
    expect(active).toEqual(["Cards", "Party"]);
  });

  it("does not light Browse as well as a genre", () => {
    expect(isNavActive(NAV.browse, "/games", ["Cards", "Party"])).toBe(false);
    expect(isNavActive(NAV.browse, "/games", [])).toBe(true);
    // A game page is still Browse's, whatever the last filter was.
    expect(isNavActive(NAV.browse, "/games/chess", ["Cards"])).toBe(true);
  });

  it("only lights a genre on Browse itself", () => {
    expect(isNavActive(genreItem("Cards"), "/games/uno", ["Cards"])).toBe(false);
    expect(isNavActive(genreItem("Cards"), "/games", [])).toBe(false);
  });

  it("matches other items by path and anything nested under it", () => {
    expect(isNavActive(NAV.home, "/")).toBe(true);
    expect(isNavActive(NAV.home, "/games")).toBe(false);
    expect(isNavActive(NAV.rooms, "/rooms/ABCD")).toBe(true);
    expect(isNavActive(NAV.rooms, "/roomsx")).toBe(false);
  });
});
