import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GAME_CATALOG } from "../../../lib/games/catalog";
import { FEATURED_GAME_IDS, GAME_META } from "../../../lib/games/meta";
import { GAME_BADGE_LABEL, gameView, type GameBadge } from "../../../lib/games/view";
import { isSoloGame } from "../../../lib/play/modes";
import {
  COVER_POSITION,
  GAME_CARD_VARIANTS,
  RAIL_WIDTHS,
  RAIL_WIDTH_CLASS,
  cardAriaLabel,
  cardBadge,
  catalogDay,
  coverFor,
  coverSizes,
  featuredGames,
  formatOnlineCount,
  playTarget,
  railKeyTarget,
  spokenPlayers,
  topBadge,
} from "../card-logic";

const NOW = Date.parse("2026-10-03T12:00:00Z");
const PUBLIC_DIR = path.resolve(__dirname, "../../../../public");

describe("formatOnlineCount", () => {
  it("is exact under a thousand", () => {
    expect(formatOnlineCount(1)).toBe("1");
    expect(formatOnlineCount(128)).toBe("128");
    expect(formatOnlineCount(999)).toBe("999");
  });

  it("rounds down, so a badge never claims a crowd that is not there", () => {
    expect(formatOnlineCount(1_000)).toBe("1k");
    expect(formatOnlineCount(1_240)).toBe("1.2k");
    expect(formatOnlineCount(1_999)).toBe("1.9k");
    expect(formatOnlineCount(9_999)).toBe("9.9k");
    expect(formatOnlineCount(10_000)).toBe("10k");
    expect(formatOnlineCount(12_650)).toBe("12k");
    expect(formatOnlineCount(999_999)).toBe("999k");
    expect(formatOnlineCount(1_250_000)).toBe("1.2M");
  });

  it("says 0 for nothing, nonsense or fractions of a player", () => {
    expect(formatOnlineCount(0)).toBe("0");
    expect(formatOnlineCount(-5)).toBe("0");
    expect(formatOnlineCount(Number.NaN)).toBe("0");
    expect(formatOnlineCount(Infinity)).toBe("0");
    expect(formatOnlineCount(12.9)).toBe("12");
  });
});

describe("cardBadge", () => {
  const base = { playable: true, onlineCount: 0 };

  it("shows nothing when the view has no badge", () => {
    expect(cardBadge({ ...base, badge: null })).toBeNull();
  });

  it("passes the view's badge through with its label, never re-deciding it", () => {
    for (const kind of ["new", "updated", "hot"] as const satisfies readonly GameBadge[]) {
      const badge = cardBadge({ ...base, badge: kind });
      expect(badge).toEqual({ kind, label: GAME_BADGE_LABEL[kind], spoken: GAME_BADGE_LABEL[kind].toLowerCase() });
    }
  });

  it("gives LIVE its count, short on the badge and in full for a screen reader", () => {
    expect(cardBadge({ playable: true, onlineCount: 1_240, badge: "live" })).toEqual({
      kind: "live",
      label: "Live",
      count: "1.2k",
      spoken: "live, 1,240 playing",
    });
  });

  it("puts SOON above everything for a game that cannot be played", () => {
    for (const badge of [null, "live", "new", "updated", "hot"] as const) {
      expect(cardBadge({ playable: false, onlineCount: 50, badge })?.kind).toBe("soon");
    }
  });

  it("agrees with gameView for every game: one badge, the view's", () => {
    for (const { id } of GAME_CATALOG) {
      const quiet = gameView(id, { now: NOW });
      expect(cardBadge(quiet)?.kind ?? null).toBe(quiet.playable ? quiet.badge : "soon");
      const live = gameView(id, { now: NOW, onlineCount: 7 });
      expect(cardBadge(live)?.kind).toBe(live.playable ? "live" : "soon");
    }
  });

  it("builds TOP badges for ranked rails", () => {
    expect(topBadge(3)).toEqual({ kind: "top", label: "Top 3", spoken: "number 3" });
  });
});

describe("coverFor", () => {
  const landscapeOnly = { landscape: "/games/x.jpg" };
  const allShapes = { landscape: "/games/x.jpg", portrait: "/games/x-2x3.jpg", square: "/games/x-1x1.jpg" };

  it("uses the landscape cover as drawn for the 16:9 shapes", () => {
    expect(coverFor(landscapeOnly, "landscape")).toEqual({ src: "/games/x.jpg", position: "50% 50%", cropped: false });
    expect(coverFor(landscapeOnly, "feature").src).toBe("/games/x.jpg");
  });

  it("crops the landscape cover, at that shape's position, when no crop has been drawn", () => {
    expect(coverFor(landscapeOnly, "portrait")).toEqual({
      src: "/games/x.jpg",
      position: COVER_POSITION.portrait,
      cropped: true,
    });
    expect(coverFor(landscapeOnly, "square")).toEqual({
      src: "/games/x.jpg",
      position: COVER_POSITION.square,
      cropped: true,
    });
  });

  it("prefers a dedicated crop, centred, once one exists", () => {
    expect(coverFor(allShapes, "portrait")).toEqual({ src: "/games/x-2x3.jpg", position: "50% 50%", cropped: false });
    expect(coverFor(allShapes, "square")).toEqual({ src: "/games/x-1x1.jpg", position: "50% 50%", cropped: false });
  });

  it("points every game, in every shape, at a file that exists", () => {
    for (const { id } of GAME_CATALOG) {
      for (const variant of GAME_CARD_VARIANTS) {
        const { src } = coverFor(GAME_META[id].covers, variant);
        expect(fs.existsSync(path.join(PUBLIC_DIR, src)), `${id} ${variant}: ${src}`).toBe(true);
      }
    }
  });
});

describe("rail widths and sizes", () => {
  it("keeps the Tailwind width classes and the pixel table in step", () => {
    for (const variant of GAME_CARD_VARIANTS) {
      const widths = [...RAIL_WIDTH_CLASS[variant].matchAll(/w-\[(\d+)px\]/g)].map((m) => Number(m[1]));
      expect(widths, variant).toEqual([...RAIL_WIDTHS[variant]]);
      expect(RAIL_WIDTH_CLASS[variant]).toMatch(/^w-\[\d+px\] md:w-\[\d+px\] xl:w-\[\d+px\]$/);
    }
  });

  it("matches the design system's rail sizes", () => {
    expect(RAIL_WIDTHS.landscape).toEqual([240, 288, 320]);
    expect(RAIL_WIDTHS.portrait).toEqual([132, 176, 200]);
  });

  it("tells the browser a rail card's exact width at each breakpoint", () => {
    expect(coverSizes("landscape", "rail")).toBe("(min-width: 1280px) 320px, (min-width: 768px) 288px, 240px");
    expect(coverSizes("portrait", "rail")).toBe("(min-width: 1280px) 200px, (min-width: 768px) 176px, 132px");
  });

  it("assumes the browse grid's columns for a grid card", () => {
    expect(coverSizes("landscape", "grid")).toContain("50vw");
    expect(coverSizes("feature", "grid")).toBe("(min-width: 768px) 50vw, 100vw");
  });
});

describe("words", () => {
  it("says player counts the way a person would", () => {
    expect(spokenPlayers({ min: 1, max: 1 })).toBe("1 player");
    expect(spokenPlayers({ min: 2, max: 2 })).toBe("2 players");
    expect(spokenPlayers({ min: 2, max: 4 })).toBe("2 to 4 players");
  });

  it("labels a card with its name, badge, genre, players and modes", () => {
    const uno = gameView("uno", { now: NOW, onlineCount: 128 });
    expect(cardAriaLabel(uno, cardBadge(uno))).toBe(
      "UNO, live, 128 playing. Cards, 2 to 4 players. Online, vs Bot, Local.",
    );
    expect(cardAriaLabel(uno, null)).toBe("UNO. Cards, 2 to 4 players. Online, vs Bot, Local.");
  });

  it("reads a solo game's real player count, not the catalogue's", () => {
    const bombPass = gameView("bomb-pass", { now: NOW });
    expect(cardAriaLabel(bombPass, null)).toBe("Bomb Pass. Party, 1 player. Solo.");
  });
});

describe("playTarget", () => {
  it("starts a solo game directly, on the route the detail page uses", () => {
    expect(playTarget(gameView("bridge-builder", { now: NOW }))).toEqual({
      href: "/play?game=bridge-builder&mode=solo",
      direct: true,
    });
  });

  it("sends a game with a choice of modes to its page's play box", () => {
    expect(playTarget(gameView("uno", { now: NOW }))).toEqual({ href: "/games/uno#play", direct: false });
    expect(playTarget(gameView("car-race", { now: NOW })).direct).toBe(false);
  });

  it("is direct exactly for the games the capability table calls solo", () => {
    for (const { id } of GAME_CATALOG) {
      expect(playTarget(gameView(id, { now: NOW })).direct, id).toBe(isSoloGame(id));
    }
  });
});

describe("featuredGames", () => {
  it("is the editorial rotation, in its order, all marked featured", () => {
    const slides = featuredGames({ now: NOW });
    expect(slides.map((g) => g.id)).toEqual([...FEATURED_GAME_IDS]);
    expect(slides.every((g) => g.featured && g.playable)).toBe(true);
  });
});

describe("railKeyTarget", () => {
  it("moves one card at a time and stops at the ends", () => {
    expect(railKeyTarget("ArrowRight", 0, 5)).toBe(1);
    expect(railKeyTarget("ArrowLeft", 3, 5)).toBe(2);
    expect(railKeyTarget("ArrowRight", 4, 5)).toBe(4);
    expect(railKeyTarget("ArrowLeft", 0, 5)).toBe(0);
  });

  it("jumps to either end with Home and End", () => {
    expect(railKeyTarget("Home", 3, 5)).toBe(0);
    expect(railKeyTarget("End", 1, 5)).toBe(4);
  });

  it("leaves every other key, and an empty or unknown position, alone", () => {
    expect(railKeyTarget("ArrowDown", 1, 5)).toBeNull();
    expect(railKeyTarget("Enter", 1, 5)).toBeNull();
    expect(railKeyTarget("ArrowRight", 0, 0)).toBeNull();
    expect(railKeyTarget("ArrowRight", -1, 5)).toBeNull();
  });
});

describe("catalogDay", () => {
  it("is midnight UTC, the same all day", () => {
    const morning = Date.parse("2026-10-03T00:00:01Z");
    const night = Date.parse("2026-10-03T23:59:59Z");
    expect(catalogDay(morning)).toBe(Date.parse("2026-10-03T00:00:00Z"));
    expect(catalogDay(night)).toBe(catalogDay(morning));
    expect(catalogDay(Date.parse("2026-10-04T00:00:00Z"))).toBeGreaterThan(catalogDay(night));
  });
});
