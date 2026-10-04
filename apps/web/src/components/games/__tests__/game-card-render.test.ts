import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gameView } from "../../../lib/games/view";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GameCard, GameCardSkeleton } from "../game-card";
import { HeroCarousel } from "../hero-carousel";
import { GameBadge } from "../game-badges";
import { ModeChips } from "../mode-chips";
import { cardBadge, featuredGames, topBadge } from "../card-logic";

/*
 * Server-rendered markup, read as a string: enough to hold the card to the
 * structural rules that a type check cannot see (one link, no button inside
 * it, the heart's state on aria-pressed) without a DOM in the test run.
 */

/*
 * The app compiles JSX with Next's automatic runtime, but this runner leaves
 * it to esbuild, which (with tsconfig's `jsx: "preserve"`) emits the classic
 * `React.createElement` and expects `React` in scope. Components that do not
 * import it find this one instead.
 */
(globalThis as { React?: typeof React }).React = React;

const NOW = Date.parse("2026-10-03T12:00:00Z");

function render(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function count(html: string, pattern: RegExp): number {
  return html.match(pattern)?.length ?? 0;
}

/** The markup between the card's <a …> and its </a>. */
function anchorBody(html: string): string {
  const start = html.indexOf("<a ");
  const end = html.indexOf("</a>", start);
  return html.slice(start, end);
}

describe("GameCard markup", () => {
  const uno = gameView("uno", { now: NOW, onlineCount: 128 });
  const control = { active: true, onToggle: () => {} };

  it("is one link to the game's page, labelled with everything the card shows", () => {
    const html = render(createElement(GameCard, { game: uno, favorite: false }));
    expect(count(html, /<a /g)).toBe(1);
    expect(html).toContain('href="/games/uno"');
    expect(html).toContain('aria-label="UNO, live, 128 playing. Cards, 2 to 4 players. Online, vs Bot, Local."');
  });

  it("keeps the favourite button outside the link, with its state on aria-pressed", () => {
    const html = render(createElement(GameCard, { game: uno, favorite: control }));
    expect(anchorBody(html)).not.toContain("<button");
    expect(count(html, /<button /g)).toBe(1);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Favourite UNO"');
  });

  it("renders no heart when told not to", () => {
    expect(render(createElement(GameCard, { game: uno, favorite: false }))).not.toContain("<button");
  });

  it("shows exactly one badge, the view's", () => {
    const html = render(createElement(GameCard, { game: uno, favorite: false }));
    expect(count(html, /bg-badge-/g)).toBe(1);
    expect(html).toContain("bg-badge-live");
  });

  it("lets a ranked rail replace the badge, or drop it", () => {
    const ranked = render(createElement(GameCard, { game: uno, favorite: false, badge: topBadge(1) }));
    expect(ranked).toContain("bg-badge-top");
    expect(ranked).not.toContain("bg-badge-live");
    const bare = render(createElement(GameCard, { game: uno, favorite: false, badge: null }));
    expect(count(bare, /bg-badge-/g)).toBe(0);
  });

  it("uses a decorative cover with the rail's exact sizes", () => {
    const html = render(createElement(GameCard, { game: uno, layout: "rail", favorite: false }));
    expect(html).toContain('alt=""');
    expect(html).toContain('sizes="(min-width: 1280px) 320px, (min-width: 768px) 288px, 240px"');
    expect(html).toContain("w-[240px] md:w-[288px] xl:w-[320px]");
  });

  it("sets the game's accent for the ring and glow to read", () => {
    const html = render(createElement(GameCard, { game: uno, favorite: false }));
    expect(html).toMatch(/--game-accent:#EF4444/i);
  });

  it("takes each shape's aspect ratio", () => {
    const shapes = { landscape: "aspect-video", portrait: "aspect-[2/3]", square: "aspect-square", feature: "aspect-video" } as const;
    for (const [variant, aspect] of Object.entries(shapes)) {
      const html = render(
        createElement(GameCard, { game: uno, variant: variant as keyof typeof shapes, favorite: false }),
      );
      expect(html, variant).toContain(aspect);
    }
  });

  it("adds the description only on the feature card", () => {
    expect(render(createElement(GameCard, { game: uno, variant: "feature", favorite: false }))).toContain(
      uno.description,
    );
    expect(render(createElement(GameCard, { game: uno, favorite: false }))).not.toContain(uno.description);
  });

  it("drops the mode icons on a compact portrait card, but still names the modes", () => {
    const html = render(createElement(GameCard, { game: uno, variant: "portrait", favorite: false }));
    expect(count(html, /<svg/g)).toBe(2); // the play glyph and the players icon
    expect(html).toContain("Online, vs Bot, Local.");
  });

  it("is hidden from assistive tech as a skeleton", () => {
    const html = render(createElement(GameCardSkeleton, { variant: "portrait", layout: "rail" }));
    expect(html).toMatch(/^<div aria-hidden="true"/);
    expect(html).toContain("aspect-[2/3]");
  });
});

describe("GameBadge", () => {
  it("shows the short label and count, and speaks the long form", () => {
    const chess = gameView("chess", { now: NOW, onlineCount: 1_240 });
    const html = render(createElement(GameBadge, { badge: cardBadge(chess) }));
    expect(html).toContain("Live");
    expect(html).toContain("1.2k");
    expect(html).toContain('<span class="sr-only">live, 1,240 playing</span>');
  });

  it("reads the badge from the game when given one", () => {
    const html = render(createElement(GameBadge, { game: { playable: false, onlineCount: 0, badge: null } }));
    expect(html).toContain("bg-badge-soon");
  });

  it("renders nothing for no badge", () => {
    expect(render(createElement(GameBadge, { badge: null }))).toBe("");
  });
});

describe("ModeChips", () => {
  const modes = gameView("chess", { now: NOW }).modes;

  it("gives icon-only chips a spoken list", () => {
    const html = render(createElement(ModeChips, { modes, variant: "icons" }));
    expect(count(html, /<svg/g)).toBe(modes.length);
    expect(html).toContain('<span class="sr-only">Online, vs Bot, Local</span>');
  });

  it("lists each mode with its word as a chip", () => {
    const html = render(createElement(ModeChips, { modes, variant: "chips" }));
    expect(count(html, /<li /g)).toBe(modes.length);
    for (const { label } of modes) expect(html).toContain(label);
  });

  it("renders nothing for a game with no modes", () => {
    expect(render(createElement(ModeChips, { modes: [] }))).toBe("");
  });
});

describe("HeroCarousel markup", () => {
  const slides = featuredGames({ now: NOW });
  const favorites = { isFavorite: (id: string) => id === "chess", toggle: () => {}, unavailable: false };

  function renderHero(): string {
    return render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(HeroCarousel, { games: slides, favorites }),
      ),
    );
  }

  it("renders one slide per featured game, only the first reachable", () => {
    const html = renderHero();
    expect(count(html, /aria-roledescription="slide"/g)).toBe(slides.length);
    expect(count(html, /inert=""/g)).toBe(slides.length - 1);
    expect(html).toContain(`aria-label="1 of ${slides.length}: ${slides[0]!.name}"`);
  });

  it("gives every slide the one green Play, pointed where that game starts", () => {
    const html = renderHero();
    expect(count(html, /bg-play /g)).toBe(slides.length);
    expect(html).toContain('href="/games/car-race#play"');
    expect(html).toContain('href="/play?game=bridge-builder&amp;mode=solo"');
  });

  it("marks the favourite it is given, and nests no control in another", () => {
    const html = renderHero();
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Favourite Chess"/);
    expect(html).not.toMatch(/<a [^>]*>(?:(?!<\/a>).)*<button/s);
  });

  it("renders nothing without slides", () => {
    const html = render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(HeroCarousel, { games: [], favorites }),
      ),
    );
    expect(html).toBe("");
  });
});
