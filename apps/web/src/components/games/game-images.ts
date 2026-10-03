import { GAME_META } from "../../lib/games/meta";

/**
 * Cover art paths, as plain data.
 *
 * `game-art.tsx` is a `"use client"` module because it exports React
 * components, which means the server cannot call `artFor()` at all — the build
 * failed on exactly that when the game pages started generating their Open
 * Graph tags. The image *paths* are not client code, so they live here and are
 * imported by both sides.
 *
 * The paths themselves are owned by `GAME_META[id].covers`; this map is the
 * landscape cover under the name the SEO code already uses, so the share image
 * and the card art cannot drift apart again.
 */

/** Share/preview image per game, keyed by game id. */
export const GAME_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(GAME_META).map(([id, meta]) => [id, meta.covers.landscape]),
);

/** Falls back to the chess hero, which is the site's own cover image. */
export function imageForGame(gameId: string): string {
  return GAME_IMAGES[gameId] ?? GAME_META.chess.covers.landscape;
}
