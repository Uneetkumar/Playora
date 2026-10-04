import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { levelProgress } from "@playora/progression";
import { PlayerStatus, PlayerStatusLink } from "../player-status";

/*
 * The connected component is only checked signed out: its store renders its
 * initial state on the server, so a signed-in render has to go through the
 * pill itself, which takes the level directly.
 */

// See game-card-render.test.ts: esbuild's classic JSX wants React in scope.
(globalThis as { React?: typeof React }).React = React;

describe("PlayerStatus", () => {
  it("shows nothing when no one is signed in, rather than made-up progress", () => {
    const html = renderToStaticMarkup(
      createElement(QueryClientProvider, { client: new QueryClient() }, createElement(PlayerStatus))
    );
    expect(html).toBe("");
  });

  it("links to the profile with the level and XP spoken in full", () => {
    const progress = levelProgress(1_000);
    const { level, xpIntoLevel, xpForNextLevel } = progress;
    const html = renderToStaticMarkup(createElement(PlayerStatusLink, { progress }));
    expect(html).toContain('href="/profile"');
    expect(html).toContain(
      `aria-label="Level ${level}, ${xpIntoLevel} of ${xpForNextLevel} XP to the next level. Open your profile"`
    );
    expect(html).toContain(`Level ${level}`);
    // The ring is drawn in tokens, not a literal colour.
    expect(html).toContain("stroke-primary");
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("fills the ring by the share of the level done, within bounds", () => {
    const offset = (progress: number) => {
      const html = renderToStaticMarkup(
        createElement(PlayerStatusLink, { progress: { ...levelProgress(0), progress } })
      );
      return Number(/stroke-dashoffset="([\d.]+)"/.exec(html)?.[1]);
    };
    const full = 2 * Math.PI * 17;
    expect(offset(0)).toBeCloseTo(full);
    expect(offset(0.5)).toBeCloseTo(full / 2);
    expect(offset(1)).toBeCloseTo(0);
    expect(offset(7)).toBeCloseTo(0);
  });
});
