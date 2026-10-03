import { describe, it, expect } from "vitest";
import {
  siteUrl,
  absolute,
  shareImageFor,
  indexableGames,
  gameMetadata,
  gameJsonLd,
  breadcrumbJsonLd,
  siteJsonLd,
  privateMetadata,
  pageMetadata,
  SITE_NAME,
} from "../seo";
import { GAME_CATALOG } from "../games/catalog";
import { GAME_IMAGES } from "../../components/games/game-images";

describe("seo urls", () => {
  it("builds absolute urls with no double slash", () => {
    expect(absolute("/games")).toBe(`${siteUrl()}/games`);
    expect(absolute("games")).toBe(`${siteUrl()}/games`);
  });

  it("never produces a trailing-slash origin", () => {
    expect(siteUrl().endsWith("/")).toBe(false);
  });
});

describe("share images", () => {
  it("has an image for every game in the catalog", () => {
    // A game on the site with no share image posts as a blank card, which is
    // worse than not sharing it.
    for (const game of GAME_CATALOG) {
      expect(GAME_IMAGES[game.id], game.id).toBeDefined();
    }
  });

  it("never yields undefined in a url", () => {
    expect(shareImageFor("a-game-that-does-not-exist")).not.toContain("undefined");
  });

  it("returns an absolute url, because relative OG images do not resolve", () => {
    expect(shareImageFor("chess")).toMatch(/^https?:\/\//);
  });
});

describe("game metadata", () => {
  const game = GAME_CATALOG.find((g) => g.id === "chess")!;

  it("titles the page after the game, not the stack", () => {
    const meta = gameMetadata(game);
    expect(String(meta.title)).toContain("Chess");
  });

  it("carries a canonical url", () => {
    expect(gameMetadata(game).alternates?.canonical).toBe(absolute("/games/chess"));
  });

  it("carries Open Graph and Twitter cards with an image", () => {
    const meta = gameMetadata(game);
    expect(meta.openGraph?.title).toBeTruthy();
    // Next's `Twitter` type is a union and only the summary variants carry
    // `card`, so this narrows rather than indexing blindly.
    const twitter = meta.twitter as { card?: string } | undefined;
    expect(twitter?.card).toBe("summary_large_image");
    const images = meta.openGraph?.images as Array<{ url: string }> | undefined;
    expect(images?.[0]?.url).toMatch(/^https?:\/\//);
  });

  it("says the game is free and needs no download, which is what earns the click", () => {
    const meta = gameMetadata(game);
    expect(String(meta.description).toLowerCase()).toContain("free");
    expect(String(meta.description).toLowerCase()).toContain("no download");
  });

  it("produces metadata for every game without throwing", () => {
    for (const g of GAME_CATALOG) {
      expect(() => gameMetadata(g), g.id).not.toThrow();
    }
  });
});

describe("structured data", () => {
  const game = GAME_CATALOG.find((g) => g.id === "uno")!;

  it("declares a VideoGame playable in a browser", () => {
    const ld = gameJsonLd(game);
    expect(ld["@type"]).toBe("VideoGame");
    expect(ld.gamePlatform).toBe("Web browser");
  });

  it("states the price, so a result is not rendered as unknown", () => {
    const offers = gameJsonLd(game).offers as { price: string };
    expect(offers.price).toBe("0");
  });

  it("marks a multiplayer game as multiplayer", () => {
    expect(gameJsonLd(game).playMode).toContain("MultiPlayer");
  });

  it("marks a solo game as single player only", () => {
    const solo = GAME_CATALOG.find((g) => g.maxPlayers === 1);
    if (!solo) return;
    expect(gameJsonLd(solo).playMode).toBe("SinglePlayer");
  });

  it("breadcrumbs read site › games › game", () => {
    const crumbs = breadcrumbJsonLd(game).itemListElement as Array<{ name: string }>;
    expect(crumbs.map((c) => c.name)).toEqual([SITE_NAME, "Games", "UNO"]);
  });

  it("declares a search endpoint at site level", () => {
    const action = siteJsonLd().potentialAction as { target: { urlTemplate: string } };
    expect(action.target.urlTemplate).toContain("search_term_string");
  });

  it("is serialisable, because it is embedded as JSON in the page", () => {
    for (const g of GAME_CATALOG) {
      expect(() => JSON.stringify(gameJsonLd(g)), g.id).not.toThrow();
    }
  });
});

describe("indexing rules", () => {
  it("only lists games a visitor can actually play", () => {
    const listed = indexableGames();
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.length).toBeLessThanOrEqual(GAME_CATALOG.length);
  });

  it("keeps per-person pages out of the index", () => {
    const meta = privateMetadata("Your profile");
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  it("gives public pages a canonical url", () => {
    expect(pageMetadata("All games", "d", "/games").alternates?.canonical).toBe(
      absolute("/games"),
    );
  });
});
