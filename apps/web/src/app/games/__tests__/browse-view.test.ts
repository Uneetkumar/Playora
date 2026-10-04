import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GAME_CATALOG } from "../../../lib/games/catalog";
import { EMPTY_BROWSE, type BrowseState } from "../../../lib/games/browse-url";
import { BrowseView } from "../browse-view";

/*
 * The browse page as the server renders it: what a crawler and the first
 * paint get before the browser has read any filters from the address bar.
 */

// See game-card-render.test.ts: esbuild's classic JSX wants React in scope.
(globalThis as { React?: typeof React }).React = React;

const NOW = Date.parse("2026-10-03T00:00:00Z");

function render(state: BrowseState): string {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(BrowseView, { state, now: NOW })
    )
  );
}

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe("BrowseView markup", () => {
  it("renders a card link for every game when nothing is filtered", () => {
    const html = render(EMPTY_BROWSE);
    expect(count(html, /data-game-card="/g)).toBe(GAME_CATALOG.length);
    for (const game of GAME_CATALOG) expect(html).toContain(`href="/games/${game.id}"`);
    expect(html).toContain("<h1");
    expect(html).not.toContain("Clear filters");
  });

  it("never puts a button inside a link", () => {
    const html = render({ ...EMPTY_BROWSE, players: "2p", q: "uno" });
    for (const anchor of html.match(/<a [\s\S]*?<\/a>/g) ?? []) {
      expect(anchor).not.toContain("<button");
    }
  });

  it("shows the empty state, with a way out, when nothing matches", () => {
    const html = render({ ...EMPTY_BROWSE, genres: ["Racing"], mode: "solo" });
    expect(count(html, /data-game-card="/g)).toBe(0);
    expect(html).toContain("No games match");
    expect(count(html, /Clear filters/g)).toBe(2);
  });

  it("presses the toggles the state names", () => {
    const html = render({ ...EMPTY_BROWSE, genres: ["Cards", "Party"], players: "2-4p" });
    expect(count(html, /data-state="on"/g)).toBe(3);
    expect(html).toMatch(
      /aria-label="Cards, \d+ games?"[^>]*data-state="on"|data-state="on"[^>]*aria-label="Cards/
    );
  });
});
