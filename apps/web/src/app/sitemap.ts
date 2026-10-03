import type { MetadataRoute } from "next";
import { indexableGames, absolute } from "../lib/seo";

/**
 * The sitemap, derived from the catalog.
 *
 * Built from the same list the UI renders, so a game cannot be on the site and
 * missing from here. Only public pages appear: profile, settings, history,
 * friends, rooms and admin are all behind a session and are marked `noindex`
 * in the layout rather than listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: absolute("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absolute("/games"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absolute("/leaderboard"), lastModified: now, changeFrequency: "hourly", priority: 0.6 },
    { url: absolute("/achievements"), lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    ...indexableGames().map((game) => ({
      url: absolute(`/games/${game.id}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      // The game pages are the point of the site, so they outrank everything
      // except the two hubs that lead to them.
      priority: 0.8,
    })),
  ];
}
