import { describe, it, expect } from "vitest";
import type { GameId } from "@playora/game-types";
import { GAME_CATALOG } from "../catalog";
import { GAME_META } from "../meta";
import {
  NEW_WINDOW_DAYS,
  UPDATED_WINDOW_DAYS,
  badgeFor,
  formatPlayers,
  gameView,
  gameViews,
  playerRange,
} from "../view";
import { isSoloGame } from "../../play/modes";

const DAY = 86_400_000;
const at = (iso: string, plusDays = 0) => Date.parse(iso) + plusDays * DAY;

/** Synthetic dates, so the priority rules are tested apart from the real data. */
const RELEASED = "2026-01-01";
const meta = (over: Partial<{ releasedAt: string; updatedAt: string; featured: boolean }> = {}) => ({
  releasedAt: RELEASED,
  updatedAt: RELEASED,
  featured: false,
  ...over,
});

describe("badge priority: LIVE > NEW > UPDATED > HOT > none", () => {
  it("shows LIVE whenever anyone is playing, over every other badge", () => {
    const m = meta({ updatedAt: RELEASED, featured: true });
    expect(badgeFor(m, { now: at(RELEASED, 1), onlineCount: 1 })).toBe("live");
    expect(badgeFor(m, { now: at(RELEASED, 400), onlineCount: 12 })).toBe("live");
  });

  it("treats zero, negative and missing counts as not live", () => {
    const m = meta();
    for (const onlineCount of [0, -3, undefined, Number.NaN]) {
      expect(badgeFor(m, { now: at(RELEASED, 400), onlineCount }), String(onlineCount)).toBeNull();
    }
  });

  it("shows NEW for the window after release, and not on its last boundary", () => {
    const m = meta({ featured: true });
    expect(badgeFor(m, { now: at(RELEASED) })).toBe("new");
    expect(badgeFor(m, { now: at(RELEASED, NEW_WINDOW_DAYS - 0.01) })).toBe("new");
    expect(badgeFor(m, { now: at(RELEASED, NEW_WINDOW_DAYS) })).not.toBe("new");
  });

  it("never calls a game NEW before it has been released", () => {
    expect(badgeFor(meta(), { now: at(RELEASED, -1) })).toBeNull();
  });

  it("prefers NEW over UPDATED for a game that is both", () => {
    const m = meta({ updatedAt: "2026-01-10" });
    expect(badgeFor(m, { now: at("2026-01-11") })).toBe("new");
  });

  it("shows UPDATED once NEW has lapsed, for the update window", () => {
    const m = meta({ updatedAt: "2026-03-01", featured: true });
    expect(badgeFor(m, { now: at("2026-03-01", 2) })).toBe("updated");
    expect(badgeFor(m, { now: at("2026-03-01", UPDATED_WINDOW_DAYS) })).toBe("hot");
  });

  it("falls back to HOT for featured games and to nothing for the rest", () => {
    const now = at(RELEASED, 365);
    expect(badgeFor(meta({ featured: true }), { now })).toBe("hot");
    expect(badgeFor(meta({ featured: false }), { now })).toBeNull();
  });

  it("accepts a Date as well as a timestamp", () => {
    expect(badgeFor(meta(), { now: new Date(at(RELEASED, 1)) })).toBe("new");
  });
});

describe("gameView", () => {
  const now = at("2027-06-01");

  it("joins the catalog entry with its metadata", () => {
    const view = gameView("chess", { now });
    const catalog = GAME_CATALOG.find((g) => g.id === "chess");
    expect(view).toMatchObject({ ...catalog, ...GAME_META.chess });
    expect(view.category).toBe("Strategy");
    expect(view.playable).toBe(true);
  });

  it("is a pure function of its inputs", () => {
    expect(gameView("uno", { now, onlineCount: 4 })).toEqual(gameView("uno", { now, onlineCount: 4 }));
  });

  it("uses the real data for badges", () => {
    const chess = GAME_META.chess;
    expect(gameView("chess", { now: at(chess.releasedAt, 1) }).badge).toBe("new");
    expect(gameView("chess", { now: at(chess.releasedAt, 1), onlineCount: 9 }).badge).toBe("live");
    expect(gameView("chess", { now }).badge).toBe("hot");
    expect(gameView("minesweeper", { now }).badge).toBeNull();
  });

  it("reports the live count it was given, cleaned up", () => {
    expect(gameView("uno", { now, onlineCount: 7 }).onlineCount).toBe(7);
    expect(gameView("uno", { now, onlineCount: 2.9 }).onlineCount).toBe(2);
    expect(gameView("uno", { now, onlineCount: -1 }).onlineCount).toBe(0);
    expect(gameView("uno", { now }).onlineCount).toBe(0);
  });

  it("summarises modes from the capability table, in display order", () => {
    const labels = (id: GameId) => gameView(id, { now }).modes.map((m) => m.label);
    expect(labels("chess")).toEqual(["Online", "vs Bot", "Local"]);
    expect(labels("car-race")).toEqual(["Online", "vs Bot", "Career"]);
    expect(labels("battleship")).toEqual(["vs Bot"]);
    expect(labels("ludo")).toEqual(["vs Bot", "Local"]);
    expect(labels("game-2048")).toEqual(["Solo"]);
    expect(labels("bomb-pass")).toEqual(["Solo"]);
  });

  it("labels players by what can actually be played", () => {
    const label = (id: GameId) => gameView(id, { now }).playersLabel;
    expect(label("chess")).toBe("2P");
    expect(label("uno")).toBe("2-4P");
    expect(label("uno-no-mercy")).toBe("2-6P");
    expect(label("car-race")).toBe("1-8P");
    expect(label("game-2048")).toBe("1P");
    // Advertised as 2-8, but nothing can seat a second player yet.
    expect(GAME_CATALOG.find((g) => g.id === "bomb-pass")?.maxPlayers).toBe(8);
    expect(label("bomb-pass")).toBe("1P");
  });

  it("reads every solo game as one player", () => {
    for (const g of GAME_CATALOG) {
      if (isSoloGame(g.id)) expect(playerRange(g.id), g.id).toEqual({ min: 1, max: 1 });
    }
  });

  it("formats player ranges", () => {
    expect(formatPlayers({ min: 1, max: 1 })).toBe("1P");
    expect(formatPlayers({ min: 2, max: 8 })).toBe("2-8P");
  });

  it("builds every game's view in catalog order, with per-game live counts", () => {
    const views = gameViews({ now, onlineCounts: { uno: 3 } });
    expect(views.map((v) => v.id)).toEqual(GAME_CATALOG.map((g) => g.id));
    expect(views.find((v) => v.id === "uno")?.badge).toBe("live");
    expect(views.filter((v) => v.badge === "live")).toHaveLength(1);
  });

  it("refuses an id the catalog does not have", () => {
    expect(() => gameView("solitaire" as GameId, { now })).toThrow(/solitaire/);
  });
});
