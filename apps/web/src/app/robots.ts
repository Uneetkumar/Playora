import type { MetadataRoute } from "next";
import { absolute } from "../lib/seo";

/**
 * Crawl rules.
 *
 * Everything under a session is disallowed — not because it is secret (RLS
 * handles that) but because those pages are per-user and have no business in
 * a search index. `/play` is excluded too: it is a game surface addressed by
 * query string, and indexing it would compete with the real game pages for the
 * same terms.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/profile", "/settings", "/history", "/friends", "/rooms", "/play", "/login", "/lan"],
    },
    sitemap: absolute("/sitemap.xml"),
    host: absolute("/"),
  };
}
